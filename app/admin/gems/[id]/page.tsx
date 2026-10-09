import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuctionManager } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import LocalTime from '@/components/ui/LocalTime'
import PublishButton from '@/components/admin/PublishButton'
import AdminControls from '@/components/admin/AdminControls'
import GemDetailClient from '@/components/admin/GemDetailClient'

export default async function GemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireAuctionManager(undefined, id, PERMISSIONS.MANAGE_ITEMS)
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: gem } = await supabase
    .from('gems')
    .select('*, auction:auctions(name, auction_type, status)')
    .eq('id', id)
    
    .single()

  if (!gem) notFound()

  const { data: images } = await supabase
    .from('gem_images')
    .select('*')
    .eq('gem_id', id)
    .order('display_order')

  const { data: certificates } = await supabase
    .from('gem_certificates')
    .select('*')
    .eq('gem_id', id)

  const { data: bids } = await adminClient
    .from('bids')
    .select('*, user:users(id, email, anonymous_name, display_name, phone)')
    .eq('gem_id', id)
    .order('bid_amount', { ascending: false })

  const { data: winner } = await adminClient
    .from('auction_winners')
    .select('*, user:users(email, anonymous_name)')
    .eq('gem_id', id)
    .single()

  const { count: registeredBiddersCount } = await supabase
    .from('auction_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('auction_id', gem.auction_id)
    .eq('approval_status', 'approved')

  const topBid = bids?.[0]
  const highestBidInfo = topBid ? {
    amount: topBid.bid_amount,
    bidderName: (topBid.user as { display_name?: string; anonymous_name?: string; email?: string } | null)?.display_name || (topBid.user as { anonymous_name?: string; email?: string } | null)?.anonymous_name || (topBid.user as { anonymous_name?: string; email?: string } | null)?.email || 'Unknown'
  } : null
  const isIncrementalApproval = (gem.auction as { auction_type?: string } | null)?.auction_type === 'incremental_approval_auction'
    const isTenderBase = (gem.auction as { auction_type?: string } | null)?.auction_type === 'tender_base_fixed_bid'
    const isRoundActive = ['active', 'running', 'ready'].includes(gem.status)
    const hideBids = isTenderBase && isRoundActive && (gem.auction as any)?.status !== 'ended' && (gem.auction as any)?.status !== 'completed'
  
  let eligibleBiddersCount = registeredBiddersCount || 0
  
  if (isIncrementalApproval) {
    const { count: eliminatedCount } = await supabase
      .from('gem_eliminations')
      .select('*', { count: 'exact', head: true })
      .eq('gem_id', gem.id)
      
    eligibleBiddersCount = Math.max(0, eligibleBiddersCount - (eliminatedCount || 0))
  }

  const currentPrice = gem.current_price || gem.starting_price
  const activeBiddersCount = new Set((bids || []).filter(b => b.bid_amount === currentPrice).map(b => b.user_id)).size
  const allRegisteredBiddersBid = eligibleBiddersCount > 0 && activeBiddersCount >= eligibleBiddersCount
  const hasNoBidsInCurrentRound = currentPrice > gem.starting_price && activeBiddersCount === 0

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-500/20 text-gray-400',
    pending: 'bg-blue-500/20 text-blue-400',
    active: 'bg-emerald-500/20 text-emerald-400',
    ended: 'bg-amber-500/20 text-amber-400',
    completed: 'bg-purple-500/20 text-purple-400',
  }

  return (
    <GemDetailClient gemId={gem.id} auctionId={gem.auction_id}>
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          {gem.auction_id ? (
            <Link href={`/admin/auctions/${gem.auction_id}`} className="text-sm text-[var(--text-muted)] hover:text-white mb-2 inline-block">
               Back to Auction
            </Link>
          ) : (
            <Link href="/admin/gems" className="text-sm text-[var(--text-muted)] hover:text-white mb-2 inline-block">
               Back to Items
            </Link>
          )}
          <h1 className="text-3xl font-bold text-white mb-2">{gem.name}</h1>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[gem.status]}`}>
              {gem.status.toUpperCase()}
            </span>
            {gem.auction && (
              <Link href={`/admin/auctions/${gem.auction_id}`} className="text-sm text-[var(--text-muted)] hover:text-[var(--gold)] transition-colors">
                 {(gem.auction as { name: string }).name}
              </Link>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/monitor/${gem.id}`}
            target="_blank"
            className="btn-outline flex items-center gap-2"
          >
             Monitor
          </Link>
          <Link href={`/admin/gems/${gem.id}/edit`} className="btn-outline">
             Edit
          </Link>
          {gem.status === 'draft' && (
            <PublishButton gemId={gem.id} />
          )}
        </div>
      </div>

      {/* Admin Controls */}
      <AdminControls
        gemId={gem.id}
        currentPrice={currentPrice}
        minIncrement={gem.min_bid_increment}
        status={gem.status}
        roundEndTime={gem.round_end_time}
        auctionType={(gem.auction as { auction_type?: string } | null)?.auction_type || 'tender_base_fixed_bid'}
        highestBid={highestBidInfo}
        allRegisteredBiddersBid={allRegisteredBiddersBid}
        hasNoBidsInCurrentRound={hasNoBidsInCurrentRound}
        startingPrice={gem.starting_price}
        auctionStatus={(gem.auction as any)?.status}
        eligibleBiddersCount={eligibleBiddersCount}
      />

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Details */}
        <div className="card-glass rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Details</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--text-muted)] uppercase">Description</label>
              <p className="text-[var(--text-secondary)] mt-1">{gem.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem label="Starting Price" value={formatCurrency(gem.starting_price)} highlight />
              <InfoItem label="Min Increment" value={formatCurrency(gem.min_bid_increment)} />
              <InfoItem label="Start Time" value={<LocalTime date={gem.start_time} format="full" />} />
              
            </div>
            {gem.carat_weight && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border)]">
                <InfoItem label="Carat Weight" value={`${gem.carat_weight} ct`} />
                {gem.color && <InfoItem label="Color" value={gem.color} />}
              </div>
            )}
            {gem.provenance && (
              <div className="pt-4 border-t border-[var(--border)]">
                <label className="text-xs text-[var(--text-muted)] uppercase">Provenance</label>
                <p className="text-[var(--text-secondary)] mt-1">{gem.provenance}</p>
              </div>
            )}
          </div>
        </div>

        {/* Auction Status */}
        <div className="card-glass rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Auction Status</h2>
          <div className="space-y-6">
            <div>
              <label className="text-xs text-[var(--text-muted)] uppercase">Current Highest Bid</label>
              <p className="text-4xl font-bold text-[var(--gold)] mt-1">{hideBids ? '*** (Sealed)' : formatCurrency(highestBidInfo?.amount || gem.starting_price)}</p>
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] uppercase">Total Bids</label>
              <p className="text-2xl font-bold text-white mt-1">{bids?.length || 0}</p>
            </div>
            {winner && (
              <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-xl">
                <label className="text-xs text-emerald-400 uppercase">Winner</label>
                <p className="text-emerald-300 font-bold mt-1">
                  {(winner.user as { display_name?: string; anonymous_name?: string; email: string })?.display_name || (winner.user as { anonymous_name?: string; email: string })?.anonymous_name || (winner.user as { email: string })?.email || 'Unknown'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Images */}
      {images && images.filter(img => img.media_type !== 'video').length > 0 && (
        <div className="card-glass rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Images</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {images.filter(img => img.media_type !== 'video').map((img) => (
              <img
                key={img.id}
                src={img.image_url}
                alt={gem.name}
                className="w-full aspect-square object-cover rounded-xl border border-[var(--border)]"
              />
            ))}
          </div>
        </div>
      )}

      {/* Videos */}
      {images && images.filter(img => img.media_type === 'video').length > 0 && (
        <div className="card-glass rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span></span> Videos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {images.filter(img => img.media_type === 'video').map((vid) => (
              <div key={vid.id} className="rounded-xl overflow-hidden border border-[var(--border)] bg-black">
                <video
                  src={vid.image_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full aspect-video object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certificates */}
      {certificates && certificates.length > 0 && (
        <div className="card-glass rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Certificates</h2>
          <div className="space-y-2">
            {certificates.map((cert) => (
              <a
                key={cert.id}
                href={cert.certificate_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-[var(--gold)]/50 transition-colors"
              >
                <span className="text-2xl"></span>
                <span className="text-white">{cert.certificate_type || 'Certificate'}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Bid History */}
      <div className="card-glass rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Bid History ({bids?.length || 0})</h2>
        {bids && bids.length > 0 ? (
          <div className="space-y-2">
            {bids.map((bid, idx) => {
              const bidUser = bid.user as { id?: string; anonymous_name?: string; display_name?: string | null; email: string; phone?: string | null } | null
              return (
                <div
                  key={bid.id}
                  className={`flex justify-between items-start p-4 rounded-xl border ${idx === 0 ? 'bg-[var(--gold)]/10 border-[var(--gold)]/30' : 'bg-[var(--surface)] border-[var(--border)]'
                    }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`font-bold font-mono ${idx === 0 ? 'text-[var(--gold)]' : 'text-white'}`}>
                      {hideBids ? '***' : formatCurrency(bid.bid_amount)}
                    </p>
                    {!hideBids ? (
                      <>
                        <p className="text-sm text-white mt-1">
                          {(gem.status === 'completed' || gem.status === 'ended' || !!winner) ? (bidUser?.display_name || bidUser?.anonymous_name || bidUser?.email || 'Unknown') : (bidUser?.anonymous_name || 'Anonymous')}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                          <p className="text-xs text-[var(--text-muted)]">{bidUser?.email}</p>
                          {bidUser?.phone && <p className="text-xs text-[var(--text-muted)]">{bidUser.phone}</p>}
                        </div>
                        {bidUser?.id && (
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono opacity-60">ID: {bidUser.id.slice(0, 8)}...</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-[var(--text-muted)] mt-1 italic">Bidder information hidden</p>
                    )}
                  </div>
                   <div className="text-right flex-shrink-0 ml-4">
                    {idx === 0 && !hideBids && <span className="text-xs text-[var(--gold)] font-bold">LEADING</span>}
                    <p className="text-xs text-[var(--text-muted)]"><LocalTime date={bid.created_at} format="full" /></p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-[var(--text-muted)] text-center py-8">No bids yet</p>
        )}
      </div>
    </div>
    </GemDetailClient>
  )
}

function InfoItem({ label, value, highlight = false }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div>
      <label className="text-xs text-[var(--text-muted)] uppercase">{label}</label>
      <p className={`mt-1 font-medium ${highlight ? 'text-[var(--gold)]' : 'text-white'}`}>{value}</p>
    </div>
  )
}


