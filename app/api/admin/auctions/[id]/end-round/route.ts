import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireAuctionManager } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireAuctionManager(undefined, id)

    const supabase = await createClient()
    
    const { data: gem } = await supabase
      .from('gems')
      .select('auction_id, auction:auctions(auction_type)')
      .eq('id', id)
      .single()

    const auctionData = gem?.auction as unknown
    const auctionType = Array.isArray(auctionData)
      ? (auctionData[0] as { auction_type: string } | undefined)?.auction_type
      : (auctionData as { auction_type: string } | null)?.auction_type
    const isFreeForm = auctionType === 'tender_base_fixed_bid'

    const updateData: { round_end_time: null; status?: string } = { 
      round_end_time: null 
    }
    
    if (isFreeForm) {
      updateData.status = 'ended'
    }

    const { error } = await supabase
      .from('gems')
      .update(updateData)
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ message: 'Round ended', status: isFreeForm ? 'ended' : undefined })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to end round'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
