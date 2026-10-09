import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    await requireAuth() // any authenticated user can list moderators
    const adminClient = createAdminClient()

    const { data: moderators, error } = await adminClient
      .from('users')
      .select('id, email, display_name')
      .eq('role', 'moderator')

    if (error) throw error

    return NextResponse.json({ moderators })
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Failed to fetch moderators' }, { status: 500 })
  }
}
