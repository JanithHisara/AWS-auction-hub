import { NextResponse } from 'next/server'
import { requirePermission, requireAuth, getUserRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.VIEW_DASHBOARD)
    const supabase = await createClient()

    const { data: permissions, error: permError } = await supabase
      .from('permissions')
      .select('*')
      .order('group_name', { ascending: true })
      .order('name', { ascending: true })

    if (permError) {
      return NextResponse.json({ error: permError.message }, { status: 500 })
    }

    const { data: rolePermissions, error: rpError } = await supabase
      .from('role_permissions')
      .select('*')

    if (rpError) {
      return NextResponse.json({ error: rpError.message }, { status: 500 })
    }

    const rolePermMap: Record<string, string[]> = {}
    for (const rp of rolePermissions || []) {
      if (!rolePermMap[rp.role]) rolePermMap[rp.role] = []
      rolePermMap[rp.role].push(rp.permission_id)
    }

    return NextResponse.json({
      permissions,
      rolePermissions: rolePermMap,
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuth()
    const role = await getUserRole()

    if (role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can modify permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { role: targetRole, permissionIds } = body as {
      role: string
      permissionIds: string[]
    }

    if (!targetRole || !Array.isArray(permissionIds)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (targetRole === 'super_admin' || targetRole === 'user') {
      return NextResponse.json(
        { error: 'Cannot modify permissions for this role' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    const { error: deleteError } = await adminClient
      .from('role_permissions')
      .delete()
      .eq('role', targetRole)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    if (permissionIds.length > 0) {
      const rows = permissionIds.map((pid) => ({
        role: targetRole,
        permission_id: pid,
      }))

      const { error: insertError } = await adminClient
        .from('role_permissions')
        .insert(rows)

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
}
