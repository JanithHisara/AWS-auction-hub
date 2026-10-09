import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import LocalTime from '@/components/ui/LocalTime'
import ChangePasswordForm from './ChangePasswordForm'

export default async function ProfilePage() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: rewards } = await supabase
    .from('user_rewards')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { count: bidCount } = await supabase
    .from('bids')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: registrationCount } = await supabase
    .from('auction_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Fetch user's wins
  const { data: wins } = await supabase
    .from('auction_winners')
    .select(`
      id,
      selected_at,
      winning_bid:bids(bid_amount),
      gem:gems(
        id,
        name,
        gem_images(image_url)
      )
    `)
    .eq('user_id', user.id)
    .order('selected_at', { ascending: false })

  return (
    <div className="min-h-screen bg-[var(--background)] relative">
      <div className="fixed inset-0 bg-grid-pattern opacity-30" />
      
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-black text-white mb-8">Profile</h1>

        <div className="grid gap-6">
          {/* User Info */}
          <div className="card-glass rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] flex items-center justify-center text-3xl flex-shrink-0">
                
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 truncate">
                  {userData?.anonymous_name || 'Anonymous Bidder'}
                </h2>
                <p className="text-[var(--text-muted)] truncate">{userData?.email}</p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    userData?.role === 'super_admin' ? 'bg-[var(--gold)]/20 text-[var(--gold)]' :
                    userData?.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                    userData?.role === 'moderator' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {userData?.role === 'super_admin' ? 'SUPER ADMIN' : userData?.role?.toUpperCase()}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    Since {userData?.created_at ? <LocalTime date={userData.created_at} format="full" /> : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <StatCard icon="" label="Total Bids" value={bidCount || 0} />
            <StatCard icon="" label="Auctions" value={registrationCount || 0} />
            <StatCard icon="" label="Points" value={rewards?.total_points || 0} accent />
            <StatCard icon="" label="Wins" value={wins?.length || 0} />
          </div>

          {/* My Wins */}
          {wins && wins.length > 0 && (
            <div className="card-glass rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span></span> My Wins
              </h3>
              <div className="space-y-3">
                {wins.map((win) => {
                  // Handle joins - could be object or array
                  const gemRaw = win.gem as unknown
                  const gem = Array.isArray(gemRaw)
                    ? (gemRaw[0] as { id: string; name: string; gem_images: { image_url: string }[] } | undefined)
                    : (gemRaw as { id: string; name: string; gem_images: { image_url: string }[] } | null)
                  const bidRaw = win.winning_bid as unknown
                  const winningBid = Array.isArray(bidRaw)
                    ? (bidRaw[0] as { bid_amount: number } | undefined)
                    : (bidRaw as { bid_amount: number } | null)
                  
                  return (
                    <Link
                      key={win.id}
                      href={`/payment/${gem?.id}`}
                      className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl hover:border-emerald-500/40 transition-all group"
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-[var(--surface)] flex-shrink-0">
                        {gem?.gem_images?.[0]?.image_url ? (
                          <img 
                            src={gem.gem_images[0].image_url}
                            alt={gem.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl opacity-30"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white truncate">{gem?.name || 'Item'}</h4>
                        <p className="text-sm text-[var(--text-muted)]">
                          Won on {win.selected_at ? <LocalTime date={win.selected_at} format="full" /> : 'N/A'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-emerald-400">
                          {winningBid?.bid_amount ? formatCurrency(winningBid.bid_amount) : 'N/A'}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">Winning Bid</p>
                      </div>
                      <div className="text-[var(--text-muted)] group-hover:text-emerald-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rewards */}
          {rewards && (
            <div className="card-glass rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span></span> Rewards & Achievements
              </h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 bg-[var(--surface)] rounded-xl text-center">
                  <div className="text-3xl mb-2"></div>
                  <p className="text-2xl font-bold text-[var(--gold)]">{rewards.current_streak}</p>
                  <p className="text-xs text-[var(--text-muted)]">Current Streak</p>
                </div>
                <div className="p-4 bg-[var(--surface)] rounded-xl text-center">
                  <div className="text-3xl mb-2"></div>
                  <p className="text-2xl font-bold text-white">{rewards.longest_streak}</p>
                  <p className="text-xs text-[var(--text-muted)]">Longest Streak</p>
                </div>
                <div className="p-4 bg-[var(--surface)] rounded-xl text-center">
                  <div className="text-3xl mb-2"></div>
                  <p className="text-2xl font-bold text-white">{rewards.auctions_participated}</p>
                  <p className="text-xs text-[var(--text-muted)]">Auctions</p>
                </div>
              </div>
            </div>
          )}

          {/* Security / Password */}
          <ChangePasswordForm />
          
          {/* Quick Links */}
          <div className="card-glass rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Quick Links</h3>
            <div className="flex flex-wrap gap-3">
              <Link href="/my-auctions" className="btn-outline text-sm">
                My Auctions
              </Link>
              <Link href="/my-bids" className="btn-outline text-sm">
                My Bids
              </Link>
              <Link href="/" className="btn-gold text-sm">
                <span>Browse Auctions</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, accent = false }: { icon: string; label: string; value: number; accent?: boolean }) {
  return (
    <div className="card-glass rounded-xl p-4 text-center">
      <div className="text-2xl mb-2">{icon}</div>
      <p className={`text-2xl font-bold ${accent ? 'text-[var(--gold)]' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  )
}

