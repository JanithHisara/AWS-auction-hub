import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Auction } from '@/types/database'
import Logo from '@/components/brand/Logo'
import LocalTime from '@/components/ui/LocalTime'

async function getUpcomingAuctions() {
  const supabase = await createClient()
  
  // Auto-process status transitions on demand (covers draft -> upcoming when publish time passes)
  try {
    await supabase.rpc('process_auction_schedule')
  } catch (err) {
    console.error('Failed to process auction schedule on homepage:', err)
  }

  const { data: { user } } = await supabase.auth.getUser()
  
  let userRegistrations: Record<string, string> = {}
  if (user) {
    const { data: regs } = await supabase
      .from('auction_registrations')
      .select('auction_id, approval_status')
      .eq('user_id', user.id)
    
    if (regs) {
      userRegistrations = regs.reduce((acc, curr) => {
        acc[curr.auction_id] = curr.approval_status
        return acc
      }, {} as Record<string, string>)
    }
  }

  const { data: auctions } = await supabase
    .from('auctions')
    .select(`
      *,
      gems:gems(count)
    `)
    .in('status', ['upcoming', 'registration_open', 'live'])
    .order('auction_start', { ascending: true })

  if (!auctions) return []

  // Get approved registration counts
  const auctionsWithCounts = await Promise.all(
    auctions.map(async (auction) => {
      const { data: count } = await supabase
        .rpc('get_auction_registration_count', { auction_uuid: auction.id })

      return {
        ...auction,
        items_count: auction.gems?.[0]?.count || 0,
        registered_count: count || 0,
        user_registration_status: userRegistrations[auction.id] || null,
      }
    })
  )

  return auctionsWithCounts as (Auction & { items_count: number; registered_count: number })[]
}

function getStatusConfig(status: string, auction: Auction) {
  const now = new Date()
  const start = new Date(auction.auction_start)
  const regStart = new Date(auction.registration_start)
  const regEnd = new Date(auction.registration_end)
  
  switch (status) {
    case 'live':
      return { label: 'LIVE NOW', color: 'bg-red-500', pulse: true, icon: '' }
    case 'registration_open':
      if (now < regStart) {
        return { label: 'Registration Not Started', color: 'bg-blue-500', pulse: false, icon: '' }
      }
      if (now > regEnd) {
        return { label: 'Registration Closed', color: 'bg-zinc-600', pulse: false, icon: '' }
      }
      return { label: 'Registration Open', color: 'bg-emerald-500', pulse: false, icon: '' }
    case 'upcoming':
      if (now < regStart) {
        return { label: 'Coming Soon', color: 'bg-blue-500', pulse: false, icon: '' }
      }
      return { label: 'Upcoming', color: 'bg-amber-500', pulse: false, icon: '' }
    case 'ended':
      return { label: 'Ended', color: 'bg-zinc-600', pulse: false, icon: '' }
    case 'completed':
      return { label: 'Completed', color: 'bg-purple-600', pulse: false, icon: '' }
    default:
      return { label: status, color: 'bg-gray-500', pulse: false, icon: '' }
  }
}


function getTimeUntil(dateStr: string) {
  const now = new Date()
  const target = new Date(dateStr)
  const diff = target.getTime() - now.getTime()
  
  if (diff <= 0) return 'Started'
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default async function HomePage() {
  const auctions = await getUpcomingAuctions()
  const liveAuctions = auctions.filter(a => a.status === 'live')
  const upcomingAuctions = auctions.filter(a => a.status !== 'live')

  return (
    <div className="min-h-screen bg-[var(--background)] relative overflow-x-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 bg-grid-pattern opacity-50" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] bg-gradient-radial from-[var(--gold-accent)]/10 via-transparent to-transparent rounded-full animate-float" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] bg-gradient-radial from-[var(--amethyst)]/10 via-transparent to-transparent rounded-full animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="pt-16 sm:pt-20 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            {/* Brand Logo */}
            <div className="flex justify-center mb-10 animate-reveal">
              <Logo size="xl" showTagline />
            </div>
            
            {/* Live indicator */}
            {liveAuctions.length > 0 && (
              <div className="inline-flex items-center gap-2 mb-8 px-6 py-3 bg-red-500/20 border border-red-500/40 rounded-full animate-reveal">
                <span className="live-dot" />
                <span className="text-red-400 font-bold uppercase tracking-wider text-sm">
                  {liveAuctions.length} Live Auction{liveAuctions.length > 1 ? 's' : ''} Now
                </span>
              </div>
            )}
            
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black mb-6 tracking-tight animate-reveal">
              <span className="block text-gradient-gold">Premium</span>
              <span className="block text-white mt-2">Gem Auctions</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-[var(--text-secondary)] max-w-3xl mx-auto mb-12 animate-reveal stagger-1">
              Exclusive access to rare gemstones. Register to bid.
              <br className="hidden sm:block" />
              <span className="text-[var(--gold)]">One link. One chance. Don't miss out.</span>
            </p>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-8 mb-16 animate-reveal stagger-2">
              <div className="text-center">
                <div className="text-4xl font-black text-gradient-gold">{auctions.length}</div>
                <div className="text-sm text-[var(--text-muted)] uppercase tracking-wider">Auctions</div>
              </div>
              <div className="w-px h-16 bg-[var(--border)]" />
              <div className="text-center">
                <div className="text-4xl font-black text-gradient-gold">
                  {auctions.reduce((sum, a) => sum + a.items_count, 0)}
                </div>
                <div className="text-sm text-[var(--text-muted)] uppercase tracking-wider">Items</div>
              </div>
              <div className="w-px h-16 bg-[var(--border)]" />
              <div className="text-center">
                <div className="text-4xl font-black text-gradient-gold">
                  {auctions.reduce((sum, a) => sum + a.registered_count, 0)}
                </div>
                <div className="text-sm text-[var(--text-muted)] uppercase tracking-wider">Registered</div>
              </div>
            </div>
          </div>
        </section>

        {/* Live Auctions Section */}
        {liveAuctions.length > 0 && (
          <section className="py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center gap-4 mb-8">
                <div className="live-badge">
                  <span className="live-dot" />
                  LIVE NOW
                </div>
                <h2 className="text-3xl font-bold text-white">Active Auctions</h2>
              </div>
              
              <div className="grid gap-6">
                {liveAuctions.map((auction) => (
                  <AuctionCard key={auction.id} auction={auction} isLive />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Upcoming Auctions */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                Upcoming <span className="text-gradient-gold">Auctions</span>
              </h2>
              <Link href="/my-auctions" className="btn-outline text-sm">
                My Registrations
              </Link>
            </div>

            {upcomingAuctions.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {upcomingAuctions.map((auction, idx) => (
                  <AuctionCard key={auction.id} auction={auction} delay={idx * 100} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[var(--surface)] border border-[var(--border)] mb-6">
                  <span className="text-4xl"></span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">No Upcoming Auctions</h3>
                <p className="text-[var(--text-secondary)]">Check back soon for new exclusive events</p>
              </div>
            )}
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[var(--background-secondary)]">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center text-white mb-16">
              How It <span className="text-gradient-gold">Works</span>
            </h2>
            
            <div className="grid sm:grid-cols-3 gap-8">
              {[
                { step: '01', title: 'Register', desc: 'Sign up for auctions before registration closes. Secure your spot.', icon: '' },
                { step: '02', title: 'Get Access', desc: 'Receive your unique auction link via email. This is your entry pass.', icon: '' },
                { step: '03', title: 'Bid & Win', desc: 'Join live auctions and place your bids. Earn rewards with every bid.', icon: '' },
              ].map((item, idx) => (
                <div key={item.step} className="text-center animate-reveal" style={{ animationDelay: `${idx * 150}ms` }}>
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] text-4xl mb-6 glow-gold">
                    {item.icon}
                  </div>
                  <div className="text-[var(--gold)] font-mono text-sm mb-2">{item.step}</div>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-[var(--text-secondary)]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function AuctionCard({ 
  auction, 
  isLive = false,
  delay = 0 
}: { 
  auction: Auction & { items_count: number; registered_count: number; user_registration_status?: string | null }
  isLive?: boolean
  delay?: number 
}) {
  const statusConfig = getStatusConfig(auction.status, auction)
  const now = new Date()
  const regStart = new Date(auction.registration_start)
  const regEnd = new Date(auction.registration_end)
  const registrationOpen = 
    auction.status === 'registration_open' &&
    now >= regStart &&
    now <= regEnd
  
  return (
    <Link 
      href={`/auctions/${auction.id}`}
      className="card-auction group block animate-reveal"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Banner Image */}
      <div className="relative h-48 sm:h-56 overflow-hidden">
        {auction.banner_image_url ? (
          <img 
            src={auction.banner_image_url} 
            alt={auction.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--background)] flex items-center justify-center">
            <span className="text-6xl opacity-30"></span>
          </div>
        )}
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-transparent" />
        
        {/* Status badge */}
        <div className="absolute top-4 left-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${statusConfig.color} text-white text-xs font-bold uppercase tracking-wider`}>
            {statusConfig.pulse && <span className="live-dot" />}
            {statusConfig.label}
          </div>
        </div>
        
        {/* Time until */}
        {!isLive && !['ended', 'completed'].includes(auction.status) && (
          <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm">
            <span className="text-xs text-[var(--text-muted)]">Starts in </span>
            <span className="text-sm font-bold text-white">{getTimeUntil(auction.auction_start)}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 group-hover:text-[var(--gold)] transition-colors">
          {auction.name}
        </h3>
        
        {auction.description && (
          <p className="text-[var(--text-secondary)] text-sm mb-4 line-clamp-2">
            {auction.description}
          </p>
        )}

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-muted)] mb-6">
          <div className="flex items-center gap-1.5">
            <span></span>
            <span><LocalTime date={auction.auction_start} format="weekday-short" /></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span></span>
            <span>{auction.items_count} items</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span></span>
            <span>{auction.registered_count} registered</span>
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-between">
          {auction.user_registration_status === 'pending' ? (
            <span className="bg-amber-500/20 text-amber-500 border border-amber-500/30 text-sm font-bold py-2 px-4 rounded-lg flex items-center gap-2">
              <span className="animate-pulse"></span> Pending Approval
            </span>
          ) : auction.user_registration_status === 'approved' ? (
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-bold py-2 px-4 rounded-lg flex items-center gap-2">
               Registered
            </span>
          ) : auction.user_registration_status === 'rejected' ? (
            <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-bold py-2 px-4 rounded-lg flex items-center gap-2">
               Denied
            </span>
          ) : registrationOpen ? (
            <span className="btn-gold text-sm py-2 px-4">
              <span>Register Now </span>
            </span>
          ) : auction.status === 'live' ? (
            <span className="btn-live text-sm py-2 px-4 flex items-center gap-2">
              <span className="live-dot" />
              Enter Auction
            </span>
          ) : ['ended', 'completed'].includes(auction.status) ? (
            <span className="btn-outline text-sm py-2 px-4">
              View Results
            </span>
          ) : auction.status === 'registration_open' && now > regEnd ? (
            <span className="text-[var(--text-muted)] text-sm">
              Registration closed
            </span>
          ) : (
            <span className="text-[var(--text-muted)] text-sm">
              Registration opens <LocalTime date={auction.registration_start} format="weekday-short" />
            </span>
          )}
          
          {auction.status !== 'ended' && auction.status !== 'completed' && auction.max_participants && (
            <span className="text-xs text-[var(--text-muted)]">
              {auction.max_participants - auction.registered_count} spots left
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

