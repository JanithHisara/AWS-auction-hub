import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ProgressiveRoomClient from '@/components/auction-room/ProgressiveRoomClient'
import TenderRoomClient from '@/components/auction-room/TenderRoomClient'
import IncrementalRoomClient from '@/components/auction-room/IncrementalRoomClient'
import { Gem, Bid, Auction, AuctionRegistration, UserRewards, User, GemElimination } from '@/types/database'
import LocalTime from '@/components/ui/LocalTime'

type ItemWithRelations = Gem & { gem_images: { image_url: string }[]; bids: Bid[] }

type ValidAccessResult = {
  valid: true
  auction: Auction
  items: ItemWithRelations[]
  user: User
  registration: AuctionRegistration
  rewards: UserRewards | null
  isHeld: boolean
  adminPhone: string | null
  eliminations: Pick<GemElimination, 'gem_id'>[]
  totalRegisteredBidders: number
  eliminationCounts: Record<string, number>
}

type InvalidAccessResult = {
  valid: false
  reason: string
  auction?: Auction
}

type AccessResult = ValidAccessResult | InvalidAccessResult

async function validateAccess(token: string): Promise<AccessResult> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { valid: false, reason: 'not_authenticated' }
  }

  // Get registration by token
  const { data: registration } = await supabase
    .from('auction_registrations')
    .select(`
      *,
      auction:auctions(*)
    `)
    .eq('access_token', token)
    .single()

  if (!registration) {
    return { valid: false, reason: 'invalid_token' }
  }

  // Verify user matches registration
  if (registration.user_id !== user.id) {
    return { valid: false, reason: 'user_mismatch' }
  }

  // Check if registration is active
  if (!registration.is_active) {
    return { valid: false, reason: 'registration_inactive' }
  }

  // Check auction status
  const auction = registration.auction as Auction | null
  if (!auction) {
    return { valid: false, reason: 'auction_not_found' }
  }

  if (auction.status !== 'live') {
    return { valid: false, reason: 'auction_not_live', auction }
  }

  // Get auction items
  const { data: items } = await supabase
    .from('gems')
    .select(`
      *,
      gem_images(*),
      bids(
        id,
        bid_amount,
        user_id,
        created_at,
        points_earned,
        user:users(anonymous_name, display_name)
      )
    `)
    .eq('auction_id', auction.id)
    .order('created_at', { ascending: true })

  // For tender base / fixed bid auctions, filter bids to only show user's own
  const isTenderBaseFixedBid = auction.auction_type === 'tender_base_fixed_bid'
  const filteredItems = (items || []).map(item => ({
    ...item,
    bids: isTenderBaseFixedBid 
      ? (item.bids || []).filter((b: { user_id: string }) => b.user_id === user.id)
      : (item.bids || [])
  }))

  const adminSupabase = createAdminClient()
  
  // Get total registered bidders for this auction (using admin client to bypass RLS)
  const { count: totalRegisteredBidders } = await adminSupabase
    .from('auction_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('auction_id', auction.id)
    .eq('approval_status', 'approved')

  // Get elimination status and counts
  let eliminations: Pick<GemElimination, 'gem_id'>[] = []
  let eliminationCounts: Record<string, number> = {}
  
  if (auction.auction_type === 'incremental_approval_auction') {
    const itemIds = (items || []).map(i => i.id)
    if (itemIds.length > 0) {
      // Fetch total eliminations grouped by gem (using admin client to bypass RLS)
      const { data: allElims } = await adminSupabase
        .from('gem_eliminations')
        .select('gem_id')
        .in('gem_id', itemIds)
        
      if (allElims) {
        allElims.forEach(e => {
          eliminationCounts[e.gem_id] = (eliminationCounts[e.gem_id] || 0) + 1
        })
      }
  
      // Fetch specifically this user's eliminations using regular client
      const { data: elimData } = await supabase
        .from('gem_eliminations')
        .select('gem_id')
        .eq('user_id', user.id)
        .in('gem_id', itemIds)
      eliminations = elimData || []
    }
  }

  // Get user rewards
  const { data: rewards } = await supabase
    .from('user_rewards')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Check hold status
  const { data: activeHold } = await supabase
    .from('bidder_holds')
    .select('*, admin:users!bidder_holds_admin_id_fkey(phone)')
    .eq('auction_id', auction.id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const isHeld = !!activeHold
  const adminPhone = activeHold
    ? (activeHold.admin as { phone?: string | null } | null)?.phone || null
    : null

  // Update access tracking
  await supabase
    .from('auction_registrations')
    .update({
      access_count: registration.access_count + 1,
      first_access_at: registration.first_access_at || new Date().toISOString(),
      last_access_at: new Date().toISOString(),
    })
    .eq('id', registration.id)

  return {
    valid: true,
    auction,
    items: filteredItems as ItemWithRelations[],
    user: user as unknown as User,
    registration: registration as unknown as AuctionRegistration,
    rewards: rewards as UserRewards | null,
    isHeld,
    adminPhone,
    eliminations,
    totalRegisteredBidders: totalRegisteredBidders || 0,
    eliminationCounts: eliminationCounts || {},
  }
}

export default async function AuctionRoomPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await validateAccess(token)

  if (!result.valid) {
    // Handle different error cases
    if (result.reason === 'not_authenticated') {
      redirect(`/login?redirect=/auction-room/${token}`)
    }

    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
        <div className="card-glass rounded-2xl p-8 max-w-md w-full text-center">
          {result.reason === 'invalid_token' && (
            <>
              <div className="text-6xl mb-6"></div>
              <h1 className="text-2xl font-bold text-white mb-4">Invalid Access Link</h1>
              <p className="text-[var(--text-secondary)] mb-6">
                This auction link is invalid or has expired. Please use the link sent to your registered email.
              </p>
            </>
          )}
          
          {result.reason === 'user_mismatch' && (
            <>
              <div className="text-6xl mb-6"></div>
              <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
              <p className="text-[var(--text-secondary)] mb-6">
                This auction link belongs to a different account. Please log in with the correct account.
              </p>
            </>
          )}
          
          {result.reason === 'auction_not_live' && (
            <>
              <div className="text-6xl mb-6"></div>
              <h1 className="text-2xl font-bold text-white mb-4">Auction Not Live</h1>
              <p className="text-[var(--text-secondary)] mb-6">
                This auction is not currently live. Please wait for the scheduled start time.
              </p>
              {result.auction && (
                <p className="text-sm text-[var(--gold)]">
                  Starts: <LocalTime date={result.auction.auction_start} format="full" />
                </p>
              )}
            </>
          )}
          
          <a href="/" className="btn-outline inline-block mt-4">
            Back to Auctions
          </a>
        </div>
      </div>
    )
  }

  return (
    <>
        {result.auction.auction_type === 'progressive_elimination_auction' && (
          <ProgressiveRoomClient 
            auction={result.auction}
            items={result.items}
            user={result.user}
            registration={result.registration}
            rewards={result.rewards}
            token={token}
            initialIsHeld={result.isHeld}
            adminPhone={result.adminPhone}
            initialEliminations={result.eliminations}
            totalRegisteredBidders={result.totalRegisteredBidders}
            initialEliminationCounts={result.eliminationCounts}
          />
        )}
        {result.auction.auction_type === 'tender_base_fixed_bid' && (
          <TenderRoomClient 
            auction={result.auction}
            items={result.items}
            user={result.user}
            registration={result.registration}
            rewards={result.rewards}
            token={token}
            initialIsHeld={result.isHeld}
            adminPhone={result.adminPhone}
            initialEliminations={result.eliminations}
            totalRegisteredBidders={result.totalRegisteredBidders}
            initialEliminationCounts={result.eliminationCounts}
          />
        )}
        {result.auction.auction_type === 'incremental_approval_auction' && (
          <IncrementalRoomClient 
            auction={result.auction}
            items={result.items}
            user={result.user}
            registration={result.registration}
            rewards={result.rewards}
            token={token}
            initialIsHeld={result.isHeld}
            adminPhone={result.adminPhone}
            initialEliminations={result.eliminations}
            totalRegisteredBidders={result.totalRegisteredBidders}
            initialEliminationCounts={result.eliminationCounts}
          />
        )}
      </>
  )
}


