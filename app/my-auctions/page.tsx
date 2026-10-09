import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AuctionRegistration, Auction } from '@/types/database'
import LocalTime from '@/components/ui/LocalTime'

async function getMyRegistrations() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }

  const { data: registrations } = await supabase
    .from('auction_registrations')
    .select(`
      *,
      auction:auctions(*)
    `)
    .eq('user_id', user.id)
    .order('registered_at', { ascending: false })

  return registrations as (AuctionRegistration & { auction: Auction })[] | null
}

async function getUserRewards() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const { data: rewards } = await supabase
    .from('user_rewards')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Get actual wins count from auction_winners (source of truth)
  const { count: winsCount } = await supabase
    .from('auction_winners')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return rewards ? { ...rewards, auctions_won: winsCount || 0 } : null
}


function getAuctionStatus(auction: Auction) {
  const now = new Date()
  const start = new Date(auction.auction_start)
  const end = new Date(auction.auction_end)
  
  if (auction.status === 'live' || (now >= start && now <= end)) {
    return { label: 'LIVE', color: 'bg-red-500', canEnter: true }
  }
  if (now < start) {
    return { label: 'Upcoming', color: 'bg-blue-500', canEnter: false }
  }
  return { label: 'Ended', color: 'bg-gray-500', canEnter: false }
}

export default async function MyAuctionsPage() {
  const registrations = await getMyRegistrations()
  const rewards = await getUserRewards()
  
  if (registrations === null) {
    redirect('/login?redirect=/my-auctions')
  }

  const liveAuctions = registrations.filter(r => r.auction?.status === 'live')
  const upcomingAuctions = registrations.filter(r => r.auction?.status !== 'live' && r.auction?.status !== 'ended' && r.auction?.status !== 'completed')
  const pastAuctions = registrations.filter(r => r.auction?.status === 'ended' || r.auction?.status === 'completed')

  return (
    <div className="min-h-screen bg-[var(--background)] relative">
      <div className="fixed inset-0 bg-grid-pattern opacity-30" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black text-white mb-2">My Auctions</h1>
            <p className="text-[var(--text-secondary)]">
              {registrations.length} registered auction{registrations.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          {/* Rewards Summary */}
          {rewards && (
            <div className="flex items-center gap-4 p-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
              <div className="text-center px-4">
                <div className="text-2xl font-black text-[var(--gold)]">{rewards.total_points}</div>
                <div className="text-xs text-[var(--text-muted)]">Points</div>
              </div>
              <div className="w-px h-10 bg-[var(--border)]" />
              <div className="text-center px-4">
                <div className="text-2xl font-black text-white">{rewards.total_bids_placed}</div>
                <div className="text-xs text-[var(--text-muted)]">Bids</div>
              </div>
              <div className="w-px h-10 bg-[var(--border)]" />
              <div className="text-center px-4">
                <div className="text-2xl font-black text-emerald-400">{rewards.auctions_won}</div>
                <div className="text-xs text-[var(--text-muted)]">Won</div>
              </div>
            </div>
          )}
        </div>

        {registrations.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[var(--surface)] border border-[var(--border)] mb-6">
              <span className="text-4xl"></span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">No Registrations Yet</h2>
            <p className="text-[var(--text-secondary)] mb-8">
              Register for auctions to start bidding on exclusive items
            </p>
            <Link href="/" className="btn-gold inline-block">
              <span>Browse Auctions</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Live Auctions */}
            {liveAuctions.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="live-badge">
                    <span className="live-dot" />
                    LIVE
                  </div>
                  <h2 className="text-2xl font-bold text-white">Active Auctions</h2>
                </div>
                
                <div className="grid gap-4">
                  {liveAuctions.map((reg) => (
                    <AuctionCard key={reg.id} registration={reg} />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming */}
            {upcomingAuctions.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-6">Upcoming</h2>
                <div className="grid gap-4">
                  {upcomingAuctions.map((reg) => (
                    <AuctionCard key={reg.id} registration={reg} />
                  ))}
                </div>
              </section>
            )}

            {/* Past  collapsed by default */}
            {pastAuctions.length > 0 && (
              <section>
                <details className="group">
                  <summary className="flex items-center gap-3 cursor-pointer list-none mb-6 select-none">
                    <h2 className="text-2xl font-bold text-white">Auction History</h2>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]">
                      {pastAuctions.length} ended
                    </span>
                    <span className="ml-auto text-[var(--text-muted)] text-sm group-open:rotate-180 transition-transform">
                      
                    </span>
                  </summary>
                  <div className="grid gap-4">
                    {pastAuctions.map((reg) => (
                      <AuctionCard key={reg.id} registration={reg} />
                    ))}
                  </div>
                </details>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AuctionCard({ registration }: { registration: AuctionRegistration & { auction: Auction } }) {
  const { auction } = registration
  const status = getAuctionStatus(auction)

  return (
    <div className="card-glass rounded-xl p-6 flex flex-col sm:flex-row sm:items-center gap-6">
      {/* Image */}
      <div className="w-full sm:w-32 h-32 rounded-xl overflow-hidden bg-[var(--surface)] flex-shrink-0">
        {auction.banner_image_url ? (
          <img 
            src={auction.banner_image_url}
            alt={auction.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-30"></span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-xl font-bold text-white truncate">{auction.name}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${status.color}`}>
            {status.label}
          </span>
        </div>
        
        <div className="flex flex-wrap gap-4 text-sm text-[var(--text-muted)]">
          <span> <LocalTime date={auction.auction_start} format="short" /></span>
          <span> Registered <LocalTime date={registration.registered_at} format="short" /></span>
          {registration.access_count > 0 && (
            <span> {registration.access_count} visits</span>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="flex-shrink-0">
        {status.canEnter ? (
          <Link 
            href={`/auction-room/${registration.access_token}`}
            className="btn-live flex items-center gap-2"
          >
            <span className="live-dot" />
            Enter Auction
          </Link>
        ) : status.label === 'Upcoming' ? (
          <div className="text-center">
            <p className="text-sm text-[var(--text-muted)] mb-1">Starts in</p>
            <p className="font-bold text-white">
              {getTimeUntil(auction.auction_start)}
            </p>
          </div>
        ) : (
          <Link 
            href={`/auctions/${auction.id}`}
            className="btn-outline"
          >
            View Results
          </Link>
        )}
      </div>
    </div>
  )
}

function getTimeUntil(dateStr: string) {
  const now = new Date()
  const target = new Date(dateStr)
  const diff = target.getTime() - now.getTime()
  
  if (diff <= 0) return 'Now'
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  
  if (days > 0) return `${days}d ${hours}h`
  
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${minutes}m`
  
  return `${minutes}m`
}


