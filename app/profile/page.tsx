import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import LocalTime from '@/components/ui/LocalTime'
import ChangePasswordForm from './ChangePasswordForm'

export default async function ProfilePage() {
  const user = await requireAuth()
  const [userData, bidStats, registrationCount, wins] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        email: true,
        role: true,
        anonymousName: true,
        createdAt: true,
      },
    }),
    prisma.bid.aggregate({
      where: { userId: user.id },
      _sum: { pointsEarned: true },
      _count: { _all: true },
    }),
    prisma.auctionRegistration.count({
      where: { userId: user.id },
    }),
    prisma.auctionWinner.findMany({
      where: { userId: user.id },
      orderBy: { selectedAt: 'desc' },
      include: {
        winningBid: { select: { bidAmount: true } },
        gem: {
          select: {
            id: true,
            name: true,
            images: {
              select: { imageUrl: true },
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
      },
    }),
  ])
  const totalPoints = bidStats._sum.pointsEarned ?? 0
  const bidCount = bidStats._count._all

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
                  {userData?.anonymousName || 'Anonymous Bidder'}
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
                    Since {userData?.createdAt ? <LocalTime date={userData.createdAt} format="full" /> : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <StatCard icon="" label="Total Bids" value={bidCount} />
            <StatCard icon="" label="Auctions" value={registrationCount || 0} />
            <StatCard icon="" label="Points" value={totalPoints} accent />
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
                  const gem = win.gem
                  const winningBid = win.winningBid
                  
                  return (
                    <Link
                      key={win.id}
                      href={`/payment/${gem?.id}`}
                      className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl hover:border-emerald-500/40 transition-all group"
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-[var(--surface)] flex-shrink-0">
                        {gem?.images?.[0]?.imageUrl ? (
                          <img 
                            src={gem.images[0].imageUrl}
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
                          Won on <LocalTime date={win.selectedAt} format="full" />
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-emerald-400">
                          {winningBid?.bidAmount ? formatCurrency(Number(winningBid.bidAmount)) : 'N/A'}
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
