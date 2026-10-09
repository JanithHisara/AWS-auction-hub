import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get auction with items ordered by start time
    const { data: auction } = await supabase
      .from('auctions')
      .select('id, name, status, auction_type')
      .eq('id', id)
      .single()

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
    }

    // Get all items for this auction
    const { data: items } = await supabase
      .from('gems')
      .select(`
        id,
        name,
        description,
        starting_price,
        current_price,
        min_bid_increment,
        status,
        end_time,
        round_end_time,
        gem_images (image_url)
      `)
      .eq('auction_id', id)
      .order('start_time', { ascending: true })

    if (!items || items.length === 0) {
      return NextResponse.json({ 
        auction,
        currentItem: null,
        nextItem: null,
        allItems: [],
        message: 'No items in this auction' 
      })
    }

    // Find current active item (first item that is 'active')
    const currentItem = items.find(item => item.status === 'active')
    
    // Find next item (first item that is still 'draft' after current)
    const currentIndex = currentItem ? items.findIndex(i => i.id === currentItem.id) : -1
    const nextItem = currentIndex >= 0 && currentIndex < items.length - 1 
      ? items[currentIndex + 1] 
      : null

    // Get bid data for current item
    let bidData = null
    if (currentItem) {
      const { count: bidCount } = await supabase
        .from('bids')
        .select('*', { count: 'exact', head: true })
        .eq('gem_id', currentItem.id)

      const { data: uniqueBiddersData } = await supabase
        .from('bids')
        .select('user_id')
        .eq('gem_id', currentItem.id)

      const uniqueBidders = new Set(uniqueBiddersData?.map(b => b.user_id) || []).size

      const { data: highestBidData } = await supabase
        .from('bids')
        .select('bid_amount')
        .eq('gem_id', currentItem.id)
        .order('bid_amount', { ascending: false })
        .limit(1)
        .single()

      const { data: recentBids } = await supabase
        .from('bids')
        .select('id, bid_amount, created_at')
        .eq('gem_id', currentItem.id)
        .order('created_at', { ascending: false })
        .limit(10)

      // Calculate allRegisteredBiddersBid for Incremental Approval
      const { count: totalRegisteredBidders } = await supabase
        .from('auction_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('auction_id', id)

      const { count: eliminationCounts } = await supabase
        .from('gem_eliminations')
        .select('*', { count: 'exact', head: true })
        .eq('gem_id', currentItem.id)

      const activeBiddersCount = (totalRegisteredBidders || 0) - (eliminationCounts || 0)
      
      const { data: currentBids } = await supabase
        .from('bids')
        .select('user_id')
        .eq('gem_id', currentItem.id)
        .eq('bid_amount', currentItem.current_price || currentItem.starting_price)

      const uniqueBiddersForCurrentPrice = new Set(currentBids?.map(b => b.user_id) || []).size
      const allRegisteredBiddersBid = uniqueBiddersForCurrentPrice > 0 && activeBiddersCount > 0 && uniqueBiddersForCurrentPrice >= activeBiddersCount

      bidData = {
        bidCount: bidCount || 0,
        uniqueBidders,
        highestBid: highestBidData?.bid_amount || currentItem.current_price || currentItem.starting_price,
        recentBids: recentBids || [],
        allRegisteredBiddersBid,
      }
    }

    // Check for finished items to show results
    const finishedItems = items.filter(i => i.status === 'ended' || i.status === 'completed')
    
    return NextResponse.json({
      auction,
      currentItem: currentItem ? { ...currentItem, ...bidData } : null,
      nextItem,
      allItems: items.map(i => ({ id: i.id, name: i.name, status: i.status })),
      finishedCount: finishedItems.length,
      totalItems: items.length,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
