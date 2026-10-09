import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Auction, Gem } from '@/types/database'
import RegisterButton from '@/components/auctions/RegisterButton'
import AuctionCountdown from '@/components/auctions/AuctionCountdown'
import AuctionLobbyClient from '@/components/auctions/AuctionLobbyClient'
import AuctionItemsPreview from '@/components/auctions/AuctionItemsPreview'
import LocalTime from '@/components/ui/LocalTime'

async function getAuction(id: string) {
  const supabase = await createClient()
  
  // Auto-process status transitions on demand (covers draft -> upcoming when publish time passes)
  try {
    await supabase.rpc('process_auction_schedule')
  } catch (err) {
    console.error('Failed to process auction schedule on details page:', err)
  }
  
  const { data: auction } = await supabase
    .from('auctions')
    .select('*')
    .eq('id', id)
    .single()

  if (!auction) return null

  // Get items
  const adminSupabase = createAdminClient()
  const { data: items } = await adminSupabase
    .from('gems')
    .select(`*, gem_images(*)`)
    .eq('auction_id', id)
    .order('created_at', { ascending: true })

  // Get approved registration count
  const { data: registeredCount } = await supabase
    .rpc('get_auction_registration_count', { auction_uuid: id })

  // Check if current user is registered
  const { data: { user } } = await supabase.auth.getUser()
  let isRegistered = false
  let registration = null
  
  if (user) {
    const { data: reg } = await supabase
      .from('auction_registrations')
      .select('*')
      .eq('auction_id', id)
      .eq('user_id', user.id)
      .single()
    
    if (reg) {
      isRegistered = true
      registration = reg
    }
  }

  return {
    ...auction,
    items: items || [],
    registered_count: registeredCount || 0,
    is_registered: isRegistered,
    registration,
    user_id: user?.id,
  }
}

function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return 'Rs. 0';
  const val = Number(amount);
  if (val >= 1_000_000_000) {
    return 'Rs. ' + (val / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  } else if (val >= 1_000_000) {
    return 'Rs. ' + (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  } else if (val >= 1_000) {
    return 'Rs. ' + (val / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  } else {
    return 'Rs. ' + val.toString();
  }
}

export default async function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auction = await getAuction(id)

  if (!auction) {
    notFound()
  }

  const now = new Date()
  const registrationOpen = 
    (auction.status === 'registration_open' || (auction.status === 'live' && auction.auction_type === 'tender_base_fixed_bid')) &&
    now >= new Date(auction.registration_start) &&
    now <= new Date(auction.registration_end)
  const isLive = auction.status === 'live'
  // Registration allowed when admin sets status to 'registration_open'
  const canRegister = registrationOpen && !auction.is_registered

  return (
    <AuctionLobbyClient auctionId={auction.id} userId={auction.user_id}>
    <div className="min-h-screen bg-[var(--background)] relative">
      {/* Background */}
      <div className="fixed inset-0 bg-grid-pattern opacity-30" />
      
      <div className="relative z-10">
        {/* Hero Banner */}
        <div className="relative h-[40vh] sm:h-[50vh] overflow-hidden">
          {auction.banner_image_url ? (
            <img 
              src={auction.banner_image_url}
              alt={auction.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[var(--surface)] via-[var(--background-secondary)] to-[var(--background)] flex items-center justify-center">
              <span className="text-[200px] opacity-10"></span>
            </div>
          )}
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/60 to-transparent" />
          
          {/* Back button */}
          <Link 
            href="/"
            className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-sm rounded-full text-white hover:bg-black/60 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>

          {/* Status badge */}
          <div className="absolute top-6 right-6">
            {isLive ? (
              <div className="live-badge">
                <span className="live-dot" />
                LIVE NOW
              </div>
            ) : registrationOpen ? (
              <div className="px-4 py-2 bg-emerald-500 text-white rounded-full text-sm font-bold uppercase">
                Registration Open
              </div>
            ) : auction.status === 'registration_open' ? (
              now < new Date(auction.registration_start) ? (
                <div className="px-4 py-2 bg-blue-500 text-white rounded-full text-sm font-bold uppercase">
                  Registration Not Started
                </div>
              ) : (
                <div className="px-4 py-2 bg-zinc-600 text-white rounded-full text-sm font-bold uppercase">
                  Registration Closed
                </div>
              )
            ) : (
              <div className="px-4 py-2 bg-[var(--surface)] text-[var(--text-secondary)] rounded-full text-sm font-medium">
                {auction.status}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 sm:-mt-32 relative">
          <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6 sm:space-y-8">
              {/* Title Card */}
              <div className="card-glass rounded-2xl p-5 sm:p-8">
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white mb-3 sm:mb-4">
                  {auction.name}
                </h1>
                {auction.description && (
                  <p className="text-sm sm:text-lg text-[var(--text-secondary)] leading-relaxed">
                    {auction.description}
                  </p>
                )}
              </div>

              {/* Items Preview */}
              <div className="card-glass rounded-2xl p-5 sm:p-8">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-2xl font-bold text-white">
                    Items to Auction
                  </h2>
                  <span className="px-2 sm:px-3 py-1 bg-[var(--gold)]/20 text-[var(--gold)] rounded-full text-xs sm:text-sm font-bold">
                    {auction.items.length} items
                  </span>
                </div>

                                {auction.items.length > 0 ? (
                  <AuctionItemsPreview items={auction.items} />
                ) : (
                  <div className="text-center py-12 bg-[var(--background-secondary)] rounded-xl border border-[var(--border)] border-dashed">
                    <p className="text-[var(--text-muted)]">No items added to this auction yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4 sm:space-y-6">
              {/* Countdown Card */}
              {(auction.status === 'upcoming' || auction.status === 'registration_open') && auction.auction_start && (
                  <div className="card-glass rounded-2xl p-6 border-glow">
                    <AuctionCountdown 
                      targetDate={auction.auction_start}
                      label="Auction Starts In"
                    />
                  </div>
                )}

              {/* Registration Card */}
              <div className="card-glass rounded-2xl p-5 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Registration</h3>
                
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-[var(--text-muted)]">Opens</span>
                    <span className="text-white text-right"><LocalTime date={auction.registration_start} format="long" /></span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-[var(--text-muted)]">Closes</span>
                    <span className="text-white text-right"><LocalTime date={auction.registration_end} format="long" /></span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-[var(--text-muted)]">Registered</span>
                    <span className="text-[var(--gold)] font-bold">{auction.registered_count} bidders</span>
                  </div>
                  {auction.max_participants && (
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-[var(--text-muted)]">Spots Left</span>
                      <span className="text-white">{auction.max_participants - auction.registered_count}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-[var(--border)] my-6" />

                {auction.is_registered ? (
                  <div className="space-y-4">
                    <RegisterButton 
                      auctionId={auction.id} 
                      userId={auction.user_id}
                      existingStatus={auction.registration?.approval_status}
                    />
                    
                    {isLive && auction.registration?.approval_status === 'approved' && auction.registration?.access_token && (
                      <Link 
                        href={`/auction-room/${auction.registration.access_token}`}
                        className="btn-live w-full flex items-center justify-center gap-2"
                      >
                        <span className="live-dot" />
                        Enter Auction Room
                      </Link>
                    )}
                  </div>
                ) : canRegister ? (
                  <RegisterButton 
                    auctionId={auction.id} 
                    userId={auction.user_id}
                  />
                ) : !auction.user_id ? (
                  <Link href="/login" className="btn-gold w-full block text-center">
                    <span>Login to Register</span>
                  </Link>
                ) : (
                  <div className="text-center text-[var(--text-muted)] py-4">
                    {now < new Date(auction.registration_start)
                      ? 'Registration has not started yet'
                      : 'Registration is currently closed'}
                  </div>
                )}
              </div>

              {/* Schedule Card */}
              <div className="card-glass rounded-2xl p-5 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Schedule</h3>
                
                <div className="space-y-4">
                  <div className="relative pl-6 pb-6 border-l-2 border-[var(--border)]">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[var(--gold)] border-4 border-[var(--background)]" />
                    <p className="text-sm text-[var(--text-muted)]">Auction Starts</p>
                    <p className="font-bold text-white"><LocalTime date={auction.auction_start} format="long" /></p>
                  </div>
                  
                </div>
              </div>

              {/* Entry Fee */}
              {auction.entry_fee > 0 && (
                <div className="card-glass rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Entry Fee</span>
                    <span className="text-2xl font-bold text-[var(--gold)]">
                      {formatCurrency(auction.entry_fee)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </AuctionLobbyClient>
  )
}


