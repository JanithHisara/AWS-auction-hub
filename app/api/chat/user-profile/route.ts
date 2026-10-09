import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')
    if (!userId) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: user } = await adminClient
      .from('users')
      .select('display_name, anonymous_name, email, role')
      .eq('id', userId)
      .single()

    if (!user) {
      return NextResponse.json({ name: 'Unknown User' })
    }

    const name = user.display_name || user.anonymous_name || user.email || 'Unknown User'
    return NextResponse.json({ name, role: user.role })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}