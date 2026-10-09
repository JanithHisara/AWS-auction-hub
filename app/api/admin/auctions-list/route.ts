import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.MANAGE_DEVICES)

    const adminClient = createAdminClient()

    try {
      await adminClient.rpc('process_auction_schedule')
    } catch (err) {
      console.error('Failed to process auction schedule in admin list:', err)
    }

    const { data: auctions, error } = await adminClient
      .from('auctions')
      .select('id, name, status')
      .in('status', ['draft', 'upcoming', 'registration_open', 'live'])
      .order('auction_start', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ auctions: auctions || [] })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
}
