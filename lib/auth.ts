import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { UserRole } from '@/types/database'
import { ADMIN_ROLES, PERMISSIONS } from '@/lib/permissions'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

export async function requireAdmin() {
  const user = await requireAuth()
  const supabase = await createClient()
  
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = userData?.role as UserRole | undefined
  if (!role || !ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number])) {
    redirect('/')
  }

  return user
}

export async function requireSuperAdmin() {
  const user = await requireAuth()
  const supabase = await createClient()
  
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'super_admin') {
    redirect('/')
  }

  return user
}

export async function requirePermission(permissionKey: string) {
  const user = await requireAuth()
  const supabase = await createClient()
  
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData?.role) {
    redirect('/')
  }

  if (userData.role === 'super_admin') {
    return user
  }

  if (userData.role === 'admin') {
    if (permissionKey === 'manage_permissions') redirect('/')
    return user
  }

  if (!ADMIN_ROLES.includes(userData.role as typeof ADMIN_ROLES[number])) {
    redirect('/')
  }

  const { data: permissions } = await supabase
    .from('role_permissions')
    .select('permission_id, permissions!inner(key)')
    .eq('role', userData.role)

  const permissionKeys = (permissions || []).map((rp: Record<string, unknown>) => {
    const p = rp.permissions as { key: string } | { key: string }[]
    return Array.isArray(p) ? p[0]?.key : p?.key
  }).filter(Boolean) as string[]

  if (!permissionKeys.includes(permissionKey)) {
    redirect('/')
  }

  return user
}

export async function getUserRole(): Promise<UserRole | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  return (userData?.role as UserRole) || null
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const supabase = await createClient()
  
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (!userData?.role) return []

  if (userData.role === 'super_admin') {
    const { data: allPerms } = await supabase
      .from('permissions')
      .select('key')
    return allPerms?.map((p: { key: string }) => p.key) || []
  }

  if (userData.role === 'admin') {
    const { data: allPerms } = await supabase
      .from('permissions')
      .select('key')
    return (allPerms || []).map((p: { key: string }) => p.key).filter(k => k !== 'manage_permissions')
  }

  const { data: rolePerms } = await supabase
    .from('role_permissions')
    .select('permissions!inner(key)')
    .eq('role', userData.role)

  return (rolePerms || []).map((rp: Record<string, unknown>) => {
    const p = rp.permissions as { key: string } | { key: string }[]
    return Array.isArray(p) ? p[0]?.key : p?.key
  }).filter(Boolean) as string[]
}

export async function checkPermission(permissionKey: string): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false

  const supabase = await createClient()
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData?.role) return false
  if (userData.role === 'super_admin') return true
  if (!ADMIN_ROLES.includes(userData.role as typeof ADMIN_ROLES[number])) return false

  const { data: permissions } = await supabase
    .from('role_permissions')
    .select('permission_id, permissions!inner(key)')
    .eq('role', userData.role)

  const keys = (permissions || []).map((rp: Record<string, unknown>) => {
    const p = rp.permissions as { key: string } | { key: string }[]
    return Array.isArray(p) ? p[0]?.key : p?.key
  }).filter(Boolean) as string[]

  return keys.includes(permissionKey)
}


export async function requireAuctionManager(auctionId?: string, gemId?: string, requiredGlobalPermission: string = PERMISSIONS.CONTROL_BIDDING) {
  const user = await requireAuth()
  const supabase = await createClient()
  const adminDb = createAdminClient()

  const hasGlobal = await checkPermission(requiredGlobalPermission)
  if (hasGlobal) return user

  let targetAuctionId = auctionId
  if (gemId && !targetAuctionId) {
    const { data: gem } = await adminDb.from('gems').select('auction_id').eq('id', gemId).single()
    if (gem?.auction_id) targetAuctionId = gem.auction_id
  }

  if (targetAuctionId) {
    const { data: auction } = await adminDb.from('auctions').select('moderator_id').eq('id', targetAuctionId).single()
    if (auction?.moderator_id === user.id) {
      return user
    }
  }

  redirect('/')
}
