import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import type { UserRole } from '@/types/database'
import { ADMIN_ROLES, PERMISSIONS } from '@/lib/permissions'

export const SESSION_COOKIE_NAME = 'auction_hub_session'

export const SUPER_ADMIN_EMAILS = [
  'hisarajanith@gmail.com',
]

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  anonymous_name?: string
  display_name?: string | null
  phone?: string | null
  user_metadata?: {
    display_name?: string | null
    phone?: string | null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await prisma.session.create({
    data: {
      id: token,
      userId,
      expiresAt,
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })

  return token
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    try {
      await prisma.session.delete({
        where: { id: token },
      })
    } catch {
      // Ignore if session not in DB
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!token) return null

    const session = await prisma.session.findUnique({
      where: { id: token },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.session.delete({ where: { id: token } }).catch(() => {})
      }
      return null
    }

    const { user } = session
    const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase())
    const effectiveRole = (isSuperAdminEmail ? 'super_admin' : user.role) as UserRole
    return {
      id: user.id,
      email: user.email,
      role: effectiveRole,
      anonymous_name: user.anonymousName || undefined,
      display_name: user.displayName,
      phone: user.phone,
      user_metadata: {
        display_name: user.displayName,
        phone: user.phone,
      },
    }
  } catch (error: any) {
    if (error?.digest === 'DYNAMIC_SERVER_USAGE' || error?.message?.includes('Dynamic server usage')) {
      throw error
    }
    console.error('Error fetching current user:', error)
    return null
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth()
  
  if (!user.role || !ADMIN_ROLES.includes(user.role as typeof ADMIN_ROLES[number])) {
    redirect('/')
  }

  return user
}

export async function requireSuperAdmin(): Promise<AuthUser> {
  const user = await requireAuth()

  if (user.role !== 'super_admin') {
    redirect('/')
  }

  return user
}

export async function requirePermission(permissionKey: string): Promise<AuthUser> {
  const user = await requireAuth()

  if (!user.role) {
    redirect('/')
  }

  if (user.role === 'super_admin') {
    return user
  }

  if (user.role === 'admin') {
    if (permissionKey === 'manage_permissions') redirect('/')
    return user
  }

  if (!ADMIN_ROLES.includes(user.role as typeof ADMIN_ROLES[number])) {
    redirect('/')
  }

  const rolePerms = await prisma.rolePermission.findMany({
    where: { role: user.role },
    include: { permission: true },
  })

  const permissionKeys = rolePerms.map(rp => rp.permission?.key).filter(Boolean) as string[]

  if (!permissionKeys.includes(permissionKey)) {
    redirect('/')
  }

  return user
}

export async function getUserRole(): Promise<UserRole | null> {
  const user = await getCurrentUser()
  if (!user) return null
  return user.role || null
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  })

  if (!user?.role) return []

  const isSuperAdmin = user.role === 'super_admin' || SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase())

  if (isSuperAdmin) {
    const allPerms = await prisma.permission.findMany({ select: { key: true } })
    return allPerms.map(p => p.key)
  }

  if (user.role === 'admin') {
    const allPerms = await prisma.permission.findMany({ select: { key: true } })
    return allPerms.map(p => p.key).filter(k => k !== 'manage_permissions')
  }

  const rolePerms = await prisma.rolePermission.findMany({
    where: { role: user.role },
    include: { permission: true },
  })

  return rolePerms.map(rp => rp.permission?.key).filter(Boolean) as string[]
}

export async function checkPermission(permissionKey: string): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false

  if (user.role === 'super_admin') return true
  if (!ADMIN_ROLES.includes(user.role as typeof ADMIN_ROLES[number])) return false

  const permissions = await getUserPermissions(user.id)
  return permissions.includes(permissionKey)
}

export async function requireAuctionManager(
  auctionId?: string,
  gemId?: string,
  requiredGlobalPermission: string = PERMISSIONS.CONTROL_BIDDING
): Promise<AuthUser> {
  const user = await requireAuth()

  const hasGlobal = await checkPermission(requiredGlobalPermission)
  if (hasGlobal) return user

  let targetAuctionId = auctionId
  if (gemId && !targetAuctionId) {
    const gem = await prisma.gem.findUnique({
      where: { id: gemId },
      select: { auctionId: true },
    })
    if (gem?.auctionId) targetAuctionId = gem.auctionId
  }

  if (targetAuctionId) {
    const auction = await prisma.auction.findUnique({
      where: { id: targetAuctionId },
      select: { moderatorId: true },
    })
    if (auction?.moderatorId === user.id) {
      return user
    }
  }

  redirect('/')
}

const RESET_SECRET = process.env.AUTH_SECRET || 'auction_hub_super_secret_reset_key_2026'

export function generateResetToken(userId: string, email: string): string {
  const expiresAt = Date.now() + 1000 * 60 * 60 // 1 hour
  const payload = `${userId}:${email}:${expiresAt}`
  const crypto = require('crypto')
  const signature = crypto.createHmac('sha256', RESET_SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}:${signature}`).toString('base64url')
}

export function verifyResetToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const [userId, email, expiresAtStr, signature] = decoded.split(':')
    const expiresAt = parseInt(expiresAtStr, 10)
    if (!expiresAt || Date.now() > expiresAt) return null

    const payload = `${userId}:${email}:${expiresAtStr}`
    const crypto = require('crypto')
    const expectedSignature = crypto.createHmac('sha256', RESET_SECRET).update(payload).digest('hex')
    if (signature !== expectedSignature) return null

    return { userId, email }
  } catch {
    return null
  }
}

export function generateConfirmationToken(userId: string, email: string): string {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
  const payload = `${userId}:${email.toLowerCase()}:${expiresAt}:confirm`
  const crypto = require('crypto')
  const signature = crypto.createHmac('sha256', RESET_SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}:${signature}`).toString('base64url')
}

export function verifyConfirmationToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const [userId, email, expiresAtStr, type, signature] = decoded.split(':')
    if (type !== 'confirm') return null
    const expiresAt = parseInt(expiresAtStr, 10)
    if (!expiresAt || Date.now() > expiresAt) return null

    const payload = `${userId}:${email}:${expiresAtStr}:confirm`
    const crypto = require('crypto')
    const expectedSignature = crypto.createHmac('sha256', RESET_SECRET).update(payload).digest('hex')
    if (signature !== expectedSignature) return null

    return { userId, email }
  } catch {
    return null
  }
}
