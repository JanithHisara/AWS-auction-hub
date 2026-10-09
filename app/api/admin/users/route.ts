import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
        try {
      await requirePermission(PERMISSIONS.MANAGE_USERS)
    } catch {
      await requirePermission(PERMISSIONS.MANAGE_REGISTRATIONS)
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const roleFilter = searchParams.get('role') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20
    const offset = (page - 1) * limit

    const adminClient = createAdminClient()

    let query = adminClient
      .from('users')
      .select('id, email, role, display_name, phone, created_at, anonymous_name', { count: 'exact' })

    if (search) {
      query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%,anonymous_name.ilike.%${search}%`)
    }

    if (roleFilter) {
      query = query.eq('role', roleFilter)
    }

    const { data: users, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      users,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
}
