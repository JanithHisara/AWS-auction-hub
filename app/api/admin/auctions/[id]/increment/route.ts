import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireAuctionManager } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireAuctionManager(undefined, id)

    const supabase = await createClient()
    const adminDb = createAdminClient()
    
    const { data: gem } = await supabase
      .from('gems')
      .select('*, auction:auctions(auction_type)')
      .eq('id', id)
      .single()

    if (!gem) {
        return NextResponse.json({ error: 'Gem not found' }, { status: 404 })
    }

    const auctionType = (gem.auction as any)?.auction_type

    if (auctionType === 'incremental_approval_auction') {
      // Count registered active users
      const { data: registrations } = await supabase
        .from('auction_registrations')
        .select('user_id')
        .eq('auction_id', gem.auction_id)
        .eq('approval_status', 'approved')
        .eq('is_active', true)

      // Count eliminated users
      const { data: eliminations } = await supabase
        .from('gem_eliminations')
        .select('user_id')
        .eq('gem_id', gem.id)

      const regUserIds = new Set((registrations || []).map(r => r.user_id))
      const elimUserIds = new Set((eliminations || []).map(e => e.user_id))

      // Active = registered and not eliminated
      const activeUsers = [...regUserIds].filter(uid => !elimUserIds.has(uid))

      if (activeUsers.length <= 1) {
        if (activeUsers.length === 1) {
          // Find the last active bidder's details from bids at current price
          const { data: latestBid } = await supabase
            .from('bids')
            .select('user:users(anonymous_name, email)')
            .eq('gem_id', id)
            .eq('bid_amount', gem.current_price)
            .limit(1)
            .single()

          const winnerName = latestBid?.user
            ? (latestBid.user as any).anonymous_name || (latestBid.user as any).email
            : 'Unknown Bidder'

          return NextResponse.json({
            error: `Only 1 active bidder left (${winnerName}). Bidding has ended. Please announce the winner.`
          }, { status: 400 })
        } else {
          return NextResponse.json({
            error: 'No active bidders left. Bidding has ended.'
          }, { status: 400 })
        }
      }
    }

    const body = await request.json().catch(() => ({}))
    const incrementAmount = body.increment || gem.min_bid_increment
    const durationSeconds = body.duration || gem.increment_interval
    
    const newPrice = Math.round(new Decimal(gem.current_price).plus(new Decimal(incrementAmount)).toNumber())
    const now = new Date()
    const nextRoundEnd = new Date(now.getTime() + (durationSeconds * 1000))
    
    const { error } = await adminDb
      .from('gems')
      .update({ 
          current_price: newPrice,
          round_end_time: nextRoundEnd.toISOString(),
          status: 'active'
      })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ message: 'Price incremented', current_price: newPrice })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to increment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
