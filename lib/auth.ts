import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import type { UserRole } from '@/types/database'
import { ADMIN_ROLES, PERMISSIONS } from '@/lib/permissions'
import { requiredSecret, sessionCookieSecure } from '@/lib/config'

export const SESSION_COOKIE_NAME = 'auction_hub_session'
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

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
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS)

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: sessionCookieSecure(),
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
    await prisma.userSession.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    })
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!token) return null

    const session = await prisma.userSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.userSession.delete({ where: { id: session.id } })
      }
      return null
    }

    const { user } = session
    if (!user.isActive) {
      await prisma.userSession.delete({ where: { id: session.id } })
      return null
    }
    const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase())
    const effectiveRole = (isSuperAdminEmail ? 'super_admin' : user.role) as UserRole
    if (isSuperAdminEmail && user.role !== 'super_admin') {
      prisma.user.update({
        where: { id: user.id },
        data: { role: 'super_admin' },
      }).catch(() => {})
    }
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

export const DEFAULT_MODERATOR_PERMISSIONS: string[] = [
  PERMISSIONS.VIEW_DASHBOARD,
  PERMISSIONS.CREATE_AUCTIONS,
  PERMISSIONS.MANAGE_AUCTIONS,
  PERMISSIONS.CREATE_ITEMS,
  PERMISSIONS.MANAGE_ITEMS,
  PERMISSIONS.MANAGE_REGISTRATIONS,
  PERMISSIONS.CONTROL_BIDDING,
  PERMISSIONS.MANAGE_CHAT,
  PERMISSIONS.UPLOAD_FILES,
  PERMISSIONS.MANAGE_DEVICES,
]

export async function requirePermission(permissionKey: string | string[]): Promise<AuthUser> {
  const user = await requireAuth()

  if (!user.role) {
    redirect('/')
  }

  if (user.role === 'super_admin') {
    return user
  }

  const requestedKeys = Array.isArray(permissionKey) ? permissionKey : [permissionKey]

  if (user.role === 'admin') {
    if (requestedKeys.length === 1 && requestedKeys[0] === 'manage_permissions') redirect('/')
    return user
  }

  if (!ADMIN_ROLES.includes(user.role as typeof ADMIN_ROLES[number])) {
    redirect('/')
  }

  const rolePerms = await prisma.rolePermission.findMany({
    where: { role: { name: user.role } },
    include: { permission: true },
  })

  let permissionKeys = rolePerms.map(rp => rp.permission?.key).filter(Boolean) as string[]

  if (user.role === 'moderator' && permissionKeys.length === 0) {
    permissionKeys = DEFAULT_MODERATOR_PERMISSIONS
  }

  const hasPerm = requestedKeys.some(key => permissionKeys.includes(key))

  if (!hasPerm) {
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
    select: {
      email: true,
      role: true,
      userRoles: {
        select: {
          role: {
            select: {
              permissions: {
                select: {
                  permission: {
                    select: { key: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!user?.role) return []

  const isSuperAdmin = user.role === 'super_admin' || SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase())

  if (isSuperAdmin) {
    return Object.values(PERMISSIONS)
  }

  if (user.role === 'admin') {
    return Object.values(PERMISSIONS).filter(
      permission => permission !== PERMISSIONS.MANAGE_PERMISSIONS
    )
  }

  const explicit = user.userRoles.flatMap(userRole =>
    userRole.role.permissions.map(({ permission }) => permission.key)
  )

  if (user.role === 'moderator' && explicit.length === 0) {
    return DEFAULT_MODERATOR_PERMISSIONS
  }

  return explicit
}

export async function checkPermission(permissionKey: string | string[]): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false

  if (user.role === 'super_admin') return true
  if (!ADMIN_ROLES.includes(user.role as typeof ADMIN_ROLES[number])) return false

  const permissions = await getUserPermissions(user.id)
  const requestedKeys = Array.isArray(permissionKey) ? permissionKey : [permissionKey]
  return requestedKeys.some(key => permissions.includes(key))
}

export async function requireAuctionManager(
  auctionId?: string,
  gemId?: string,
  requiredGlobalPermission: string = PERMISSIONS.CONTROL_BIDDING
): Promise<AuthUser> {
  const user = await requireAuth()

  if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'moderator') {
    return user
  }

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
      select: {
        moderatorId: true,
        createdById: true,
        moderators: { where: { userId: user.id }, select: { userId: true } },
      },
    })
    if (
      auction &&
      (auction.moderatorId === user.id ||
        auction.createdById === user.id ||
        auction.moderators.length > 0 ||
        ADMIN_ROLES.includes(user.role as typeof ADMIN_ROLES[number]))
    ) {
      return user
    }
  }

  redirect('/')
}

export function generateConfirmationToken(userId: string, email: string): string {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
  const payload = `${userId}:${email.toLowerCase()}:${expiresAt}:confirm`
  const signature = createHmac('sha256', requiredSecret('AUTH_SECRET')).update(payload).digest('hex')
  return Buffer.from(`${payload}:${signature}`).toString('base64url')
}

export function verifyConfirmationToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const parts = decoded.split(':')
    const [userId, email, expiresAtStr, type, signature] = parts
    if (parts.length !== 5 || type !== 'confirm' || !/^[a-f0-9]{64}$/.test(signature || '')) return null
    const expiresAt = Number(expiresAtStr)
    if (!expiresAt || Date.now() > expiresAt) return null

    const payload = `${userId}:${email}:${expiresAtStr}:confirm`
    const expectedSignature = createHmac('sha256', requiredSecret('AUTH_SECRET')).update(payload).digest('hex')
    if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) return null

    return { userId, email }
  } catch {
    return null
  }
}
