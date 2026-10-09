import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const { data: bids, error } = await supabase
      .from('bids')
      .select('*, user:users(anonymous_name, display_name)')
      .eq('gem_id', id)
      .order('bid_amount', { ascending: false })

    if (error) throw error

    return NextResponse.json(bids)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get bids'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))
    
    // Get gem with auction info
    const { data: gem } = await supabase
      .from('gems')
      .select('*, auction:auctions(auction_type, auction_end, status)')
      .eq('id', id)
      .eq('status', 'active')
      .single()

    if (!gem) {
      return NextResponse.json({ error: 'Auction not found or not active' }, { status: 404 })
    }

    const auctionType = (gem.auction as { auction_type: string } | null)?.auction_type || 'tender_base_fixed_bid'

    // Check if user is on hold (use admin client to bypass RLS)
    const adminDb = createAdminClient()
    const { data: activeHold } = await adminDb
      .from('bidder_holds')
      .select('id')
      .eq('auction_id', gem.auction_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)

    if (activeHold && activeHold.length > 0) {
      return NextResponse.json({ error: 'Your bidding is currently on hold. Please contact the auction administrator.' }, { status: 403 })
    }

    const now = new Date()

    // Get highest current bid
    const { data: highestBidData } = await supabase
      .from('bids')
      .select('bid_amount')
      .eq('gem_id', id)
      .order('bid_amount', { ascending: false })
      .limit(1)
      .single()

    const currentHighestBid = highestBidData?.bid_amount || gem.starting_price

    let bidAmount: number

    if (auctionType === 'progressive_elimination_auction') {
      // Progressive elimination: user accepts current price
      bidAmount = gem.current_price || gem.starting_price

      // Check if bidding round is active
      if (!gem.round_end_time) {
        return NextResponse.json({ error: 'Bidding has not started yet' }, { status: 400 })
      }
      const roundEndTime = new Date(gem.round_end_time)
      if (now >= roundEndTime) {
        return NextResponse.json({ error: 'Bidding time has ended for this round' }, { status: 400 })
      }

      // Check if ANY user already bid on this price (only one winner per round)
      const { data: existingBid } = await supabase
        .from('bids')
        .select('id, user_id')
        .eq('gem_id', id)
        .eq('bid_amount', bidAmount)
        .limit(1)

      if (existingBid && existingBid.length > 0) {
        if (existingBid[0].user_id === user.id) {
          return NextResponse.json({ error: 'You have already placed a bid for this price' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Another user has already claimed this price round' }, { status: 400 })
      }
    } else if (auctionType === 'incremental_approval_auction') {
      // Incremental Approval: user accepts current price; non-approvers are eliminated
      bidAmount = gem.current_price || gem.starting_price

      // Check if bidding round is active
      if (!gem.round_end_time) {
        return NextResponse.json({ error: 'Bidding has not started yet' }, { status: 400 })
      }
      const roundEndTime = new Date(gem.round_end_time)
      if (now >= roundEndTime) {
        return NextResponse.json({ error: 'Bidding time has ended for this round' }, { status: 400 })
      }

      // Check if user is eliminated from this item
      const { data: elimination } = await supabase
        .from('gem_eliminations')
        .select('id')
        .eq('gem_id', id)
        .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)

      if (elimination) {
        return NextResponse.json({ error: 'You have been eliminated from this auction item' }, { status: 403 })
      }

      // Check if user already accepted this price
      const { data: existingBid } = await supabase
        .from('bids')
        .select('id')
        .eq('gem_id', id)
        .eq('user_id', user.id)
        .eq('bid_amount', bidAmount)
        .single()

      if (existingBid) {
        return NextResponse.json({ error: 'You have already accepted this price' }, { status: 400 })
      }
    } else {

      // Tender base / fixed bid: user submits custom amount (one bid only)
      
      // Check if bidding round is active
      // Check if auction is still live
      if ((gem.auction as any)?.status && (gem.auction as any).status !== 'live') {
        return NextResponse.json({ error: 'Bidding has ended for this auction' }, { status: 400 })
      }

      const endTimeStr = gem.round_end_time || (gem.auction as any)?.auction_end || gem.end_time;
      if (endTimeStr) {
        const roundEndTime = new Date(endTimeStr)
        if (now >= roundEndTime) {
          return NextResponse.json({ error: 'Bidding time has ended' }, { status: 400 })
        }
      } else if (!gem.round_end_time && auctionType !== 'tender_base_fixed_bid') {
         return NextResponse.json({ error: 'Bidding has not started yet' }, { status: 400 })
      }
      
      // Check if user already placed a bid (one bid only rule)
      const { data: existingBid } = await supabase
        .from('bids')
        .select('id')
        .eq('gem_id', id)
        .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)

      if (existingBid && existingBid.length > 0) {
        return NextResponse.json({ error: 'You have already placed a bid for this item' }, { status: 400 })
      }

      if (!body.bid_amount || (typeof body.bid_amount !== 'number' && typeof body.bid_amount !== 'string')) {
        return NextResponse.json({ error: 'Bid amount is required' }, { status: 400 })
      }

      try {
        bidAmount = new Decimal(body.bid_amount).toDecimalPlaces(2).toNumber()
      } catch {
        return NextResponse.json({ error: 'Invalid bid amount' }, { status: 400 })
      }

      // For tender base: bid must be >= starting price (hidden bids, so no increment from current)
      if (bidAmount < gem.starting_price) {
        return NextResponse.json({ 
          error: `Bid must be at least ${gem.starting_price}`,
          minBid: gem.starting_price 
        }, { status: 400 })
      }
    }

    // Create bid
    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .insert({
        gem_id: id,
        user_id: user.id,
        bid_amount: bidAmount,
      })
      .select()
      .single()

    if (bidError) throw bidError

    if (auctionType === 'progressive_elimination_auction') {
      const { error: gemError } = await supabase
        .from('gems')
        .update({ round_end_time: new Date().toISOString() })
        .eq('id', id)

      if (gemError) throw gemError
    }

    return NextResponse.json(bid)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to place bid'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()

    const { data: gem } = await supabase
      .from('gems')
      .select('*, auction:auctions(auction_type, auction_end, status)')
      .eq('id', id)
      .eq('status', 'active')
      .single()

    if (!gem) {
      return NextResponse.json({ error: 'Item not found or not active' }, { status: 404 })
    }

    const auctionType = (gem.auction as { auction_type: string } | null)?.auction_type || 'tender_base_fixed_bid'

    // Check if user is on hold (use admin client to bypass RLS)
    const adminDb = createAdminClient()
    const { data: activeHold } = await adminDb
      .from('bidder_holds')
      .select('id')
      .eq('auction_id', gem.auction_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)

    if (activeHold && activeHold.length > 0) {
      return NextResponse.json({ error: 'Your bidding is currently on hold. Please contact the auction administrator.' }, { status: 403 })
    }

    const isClosed = auctionType.toLowerCase().includes('tender') || 
                     auctionType.toLowerCase().includes('closed') || 
                     auctionType.toLowerCase().includes('sealed');
                     
    if (!isClosed) {
      return NextResponse.json({ error: 'Bid editing is only available for Closed Bid auctions' }, { status: 400 })
    }

    if ((gem.auction as any)?.status && (gem.auction as any).status !== 'live') {
      return NextResponse.json({ error: 'Bidding has ended for this auction' }, { status: 400 })
    }

    const endTimeStr = gem.round_end_time || (gem.auction as any)?.auction_end || gem.end_time;
    const now = new Date()
    if (endTimeStr && now >= new Date(endTimeStr)) {
      return NextResponse.json({ error: 'Bidding time has ended. Bid is locked.' }, { status: 400 })
    }

    const { data: existingBid } = await supabase
      .from('bids')
      .select('id')
      .eq('gem_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!existingBid || existingBid.length === 0) {
      return NextResponse.json({ error: 'No existing bid found to edit' }, { status: 404 })
    }

    if (!body.bid_amount) {
      return NextResponse.json({ error: 'Bid amount is required' }, { status: 400 })
    }

    let newAmount: number
    try {
      newAmount = new Decimal(body.bid_amount).toDecimalPlaces(2).toNumber()
    } catch {
      return NextResponse.json({ error: 'Invalid bid amount' }, { status: 400 })
    }

    if (newAmount < gem.starting_price) {
      return NextResponse.json({ error: `Bid must be at least ${gem.starting_price}` }, { status: 400 })
    }

    const { data: updatedBid, error: updateError } = await supabase
      .from('bids')
      .update({ bid_amount: newAmount, created_at: new Date().toISOString() })
      .eq('id', existingBid[0].id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json(updatedBid)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update bid'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

