import AuctionMonitorClient from '@/components/monitor/AuctionMonitorClient'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AuctionMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  
  // Get auction with items
  const { data: auction } = await supabase
    .from('auctions')
    .select(`
      *,
      gems (
        id,
        name,
        starting_price,
        current_price,
        min_bid_increment,
        status,
        gem_images (image_url)
      )
    `)
    .eq('id', id)
    .single()

  if (!auction) {
    notFound()
  }

  // Get initial bid data for each item
  const itemsWithBids = await Promise.all(
    (auction.gems || []).map(async (item: { id: string; name: string; starting_price: number; current_price: number; status: string; gem_images: { image_url: string }[] }) => {
      const { data: bids } = await supabase
        .from('bids')
        .select('bid_amount, created_at, user:users(anonymous_name, display_name)')
        .eq('gem_id', item.id)
        .order('bid_amount', { ascending: false })
        .limit(5)

      const { count: bidCount } = await supabase
        .from('bids')
        .select('*', { count: 'exact', head: true })
        .eq('gem_id', item.id)

      const { count: bidderCount } = await supabase
        .from('bids')
        .select('user_id', { count: 'exact', head: true })
        .eq('gem_id', item.id)

      return {
        ...item,
        bids: bids || [],
        bidCount: bidCount || 0,
        bidderCount: bidderCount || 0,
        highestBid: bids?.[0]?.bid_amount || item.starting_price,
      }
    })
  )

  // Get approved registration count
  const { data: registeredCount } = await supabase
    .rpc('get_auction_registration_count', { auction_uuid: id })

  return (
    <AuctionMonitorClient 
      auction={{
        ...auction,
        items: itemsWithBids,
        registeredCount: registeredCount || 0,
      }}
    />
  )
}


