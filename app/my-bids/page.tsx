import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import MyBidsClient from './MyBidsClient'

interface BidWithDetails {
  id: string
  bid_amount: number
  points_earned: number
  created_at: string
  gem_id: string
  gem: {
    id: string
    name: string
    description: string
    starting_price: number
    current_price: number
    status: string
    end_time: string
    carat_weight: number | null
    cut: string | null
    color: string | null
    clarity: string | null
    provenance: string | null
    auction_id: string | null
  }
  highestBid: number
  images: { image_url: string; media_type: string }[]
  auctionName: string | null
  auctionId: string | null
}

export default async function MyBidsPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: bids } = await supabase
    .from('bids')
    .select('*, gem:gems(*, auction:auctions(id, name))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (!bids || bids.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--background)] relative">
        <div className="fixed inset-0 bg-grid-pattern opacity-30" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
          <h1 className="text-4xl font-black text-white mb-8">My Bids</h1>
          <div className="card-glass rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4"></div>
            <h2 className="text-2xl font-bold text-white mb-3">No Bids Yet</h2>
            <p className="text-[var(--text-secondary)] mb-6">Start bidding on exclusive items</p>
            <Link href="/" className="btn-gold inline-block">
              <span>Browse Auctions</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const bidsWithDetails: BidWithDetails[] = await Promise.all(
    bids.map(async (bid) => {
      const gem = bid.gem as Record<string, unknown>
      const auctionRaw = gem.auction as { id: string; name: string } | { id: string; name: string }[] | null
      const auctionData = Array.isArray(auctionRaw) ? auctionRaw[0] : auctionRaw

      const { data: highestBid } = await supabase
        .from('bids')
        .select('bid_amount')
        .eq('gem_id', gem.id as string)
        .order('bid_amount', { ascending: false })
        .limit(1)
        .single()

      const { data: images } = await supabase
        .from('gem_images')
        .select('image_url, media_type')
        .eq('gem_id', gem.id as string)
        .order('display_order')

      return {
        id: bid.id,
        bid_amount: bid.bid_amount,
        points_earned: bid.points_earned,
        created_at: bid.created_at,
        gem_id: gem.id as string,
        gem: {
          id: gem.id as string,
          name: gem.name as string,
          description: gem.description as string,
          starting_price: gem.starting_price as number,
          current_price: gem.current_price as number,
          status: gem.status as string,
          end_time: gem.end_time as string,
          carat_weight: gem.carat_weight as number | null,
          cut: gem.cut as string | null,
          color: gem.color as string | null,
          clarity: gem.clarity as string | null,
          provenance: gem.provenance as string | null,
          auction_id: gem.auction_id as string | null,
        },
        highestBid: highestBid?.bid_amount || (gem.starting_price as number),
        images: (images || []) as { image_url: string; media_type: string }[],
        auctionName: auctionData?.name || null,
        auctionId: auctionData?.id || null,
      }
    })
  )

  return <MyBidsClient bids={bidsWithDetails} />
}

