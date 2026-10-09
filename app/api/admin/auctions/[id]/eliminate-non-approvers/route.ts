import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireAuctionManager } from '@/lib/auth'
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
    const adminDb = createAdminClient()

    // Get the gem info
    const { data: gem } = await supabase
      .from('gems')
      .select('id, current_price, starting_price, status, auction_id, auction:auctions(auction_type)')
      .eq('id', id)
      .single()

    if (!gem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const auctionType = (gem.auction as unknown as { auction_type: string } | null)?.auction_type
    if (auctionType !== 'incremental_approval_auction') {
      return NextResponse.json(
        { error: 'This action is only available for Incremental Approval Auctions' },
        { status: 400 }
      )
    }

    if (gem.status !== 'active') {
      return NextResponse.json({ error: 'Item must be active to eliminate non-approvers' }, { status: 400 })
    }

    const currentPrice = gem.current_price || gem.starting_price

    // Check if anyone bid at the current price
    const { count: activeBiddersCount } = await supabase
      .from('bids')
      .select('*', { count: 'exact', head: true })
      .eq('gem_id', id)
      .eq('bid_amount', currentPrice)

    if (activeBiddersCount === 0) {
      // No one bid at the current high price. 
      // Do NOT revert the price here, because the admin will use the Next Round modal 
      // to explicitly decrease the price from this current high point.
      // And importantly, do NOT eliminate anyone, because they didn't accept the high price.
      return NextResponse.json({
        message: 'No bids received. Bidders preserved for price decrease.',
        eliminated_count: 0,
        at_price: currentPrice,
      })
    }

    // Call the Postgres function to eliminate non-approvers
    const { data: eliminatedCount, error } = await supabase
      .rpc('eliminate_non_approvers', {
        p_gem_id: id,
        p_price: currentPrice,
      })

    if (error) throw error

    return NextResponse.json({
      message: 'Non-approvers eliminated',
      eliminated_count: eliminatedCount,
      at_price: currentPrice,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to eliminate non-approvers'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
