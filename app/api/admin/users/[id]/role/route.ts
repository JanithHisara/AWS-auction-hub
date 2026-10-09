import { NextResponse } from 'next/server'
import { requirePermission, requireAuth, getUserRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISSIONS, ASSIGNABLE_ROLES } from '@/lib/permissions'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const currentUserRole = await getUserRole()

    if (!currentUserRole || (currentUserRole !== 'super_admin' && !(await hasAssignPermission(user.id)))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id: targetUserId } = await params
    const body = await request.json()
    const { role: newRole } = body as { role: string }

    if (!newRole || !ASSIGNABLE_ROLES.includes(newRole as typeof ASSIGNABLE_ROLES[number])) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${ASSIGNABLE_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { data: targetUser, error: fetchError } = await adminClient
      .from('users')
      .select('role')
      .eq('id', targetUserId)
      .single()

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (targetUser.role === 'super_admin' && currentUserRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only Super Admin can modify another Super Admin' },
        { status: 403 }
      )
    }

    const { error: updateError } = await adminClient
      .from('users')
      .update({ role: newRole })
      .eq('id', targetUserId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, role: newRole })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
}

async function hasAssignPermission(userId: string): Promise<boolean> {
  const { checkPermission } = await import('@/lib/auth')
  return checkPermission(PERMISSIONS.ASSIGN_ROLES)
}
