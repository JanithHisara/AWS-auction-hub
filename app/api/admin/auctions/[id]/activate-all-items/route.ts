import { NextResponse } from 'next/server'
import { requireAuctionManager } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireAuctionManager(id, undefined, PERMISSIONS.MANAGE_ITEMS)
    
    const adminDb = createAdminClient()

    // Update all non-completed/non-ended gems in this auction to 'active'
    const { error } = await adminDb
      .from('gems')
      .update({ status: 'active', published_at: new Date().toISOString() })
      .eq('auction_id', id)
      .not('status', 'in', ['ended', 'completed'])

    if (error) {
      console.error('Failed to activate all items:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
