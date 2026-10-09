import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Auction } from '@/types/database'
import { ADMIN_ROLES } from '@/lib/permissions'
import LocalTime from '@/components/ui/LocalTime'
import { getAuctionTypeLabel } from '@/lib/auction-types'

async function getAuctions() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  
  if (!userData?.role || !ADMIN_ROLES.includes(userData.role as typeof ADMIN_ROLES[number])) redirect('/')

  const { data: auctions } = await supabase
    .from('auctions')
    .select('*')
    .order('created_at', { ascending: false })

  // Get counts for each auction
  const auctionsWithCounts = await Promise.all(
    (auctions || []).map(async (auction) => {
      const { count: itemsCount } = await supabase
        .from('gems')
        .select('*', { count: 'exact', head: true })
        .eq('auction_id', auction.id)

      const { data: registeredCount } = await supabase
        .rpc('get_auction_registration_count', { auction_uuid: auction.id })

      return {
        ...auction,
        items_count: itemsCount || 0,
        registered_count: registeredCount || 0,
      }
    })
  )

  return auctionsWithCounts as (Auction & { items_count: number; registered_count: number })[]
}


const statusColors: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400',
  upcoming: 'bg-blue-500/20 text-blue-400',
  registration_open: 'bg-emerald-500/20 text-emerald-400',
  live: 'bg-red-500/20 text-red-400',
  ended: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-purple-500/20 text-purple-400',
}

export default async function AdminAuctionsPage() {
  const auctions = await getAuctions()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userData } = await supabase.from('users').select('role').eq('id', user?.id).single()

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Auctions</h1>
          <p className="text-[var(--text-secondary)]">Manage your auction events</p>
        </div>
        {userData?.role !== 'moderator' && (
            <Link 
              href="/admin/auctions/new"
              className="btn-gold"
            >
              <span>+ Create Auction</span>
            </Link>
          )}
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Auctions', value: auctions.length, icon: '' },
          { label: 'Live', value: auctions.filter(a => a.status === 'live').length, icon: '' },
          { label: 'Upcoming', value: auctions.filter(a => ['upcoming', 'registration_open'].includes(a.status)).length, icon: '' },
          { label: 'Total Items', value: auctions.reduce((sum, a) => sum + a.items_count, 0), icon: '' },
        ].map((stat) => (
          <div key={stat.label} className="card-glass rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-[var(--text-muted)]">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Auctions - Desktop Table / Mobile Cards */}
      {auctions.length === 0 ? (
        <div className="card-glass rounded-xl p-12 text-center text-[var(--text-muted)]">
          No auctions yet. Create your first auction to get started.
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block card-glass rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-6 py-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Auction</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Items</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Registered</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Date</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {auctions.map((auction) => (
                  <tr key={auction.id} className="hover:bg-[var(--surface-elevated)] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-[var(--surface)] flex items-center justify-center overflow-hidden">
                          {auction.banner_image_url ? (
                            <img src={auction.banner_image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl opacity-50"></span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-white">{auction.name}</p>
                          <p className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">
                            {auction.description || 'No description'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold inline-block w-fit ${statusColors[auction.status]}`}>
                          {auction.auction_type === 'tender_base_fixed_bid' && auction.status === 'registration_closed' ? 'BIDDING CLOSED' : auction.auction_type === 'tender_base_fixed_bid' && auction.status === 'live' ? 'BIDDING OPEN' : auction.status.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs inline-block w-fit ${
                          auction.auction_type === 'progressive_elimination_auction' 
                            ? 'bg-purple-500/20 text-purple-400' 
                            : auction.auction_type === 'incremental_approval_auction'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {getAuctionTypeLabel(auction.auction_type, true)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white">{auction.items_count}</td>
                    <td className="px-6 py-4 text-white">{auction.registered_count}</td>
                    <td className="px-6 py-4 text-[var(--text-secondary)] text-sm">
                      <LocalTime date={auction.auction_start} format="full" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link 
                          href={`/admin/auctions/${auction.id}`}
                          className="px-3 py-1.5 text-xs font-medium bg-[var(--surface)] hover:bg-[var(--surface-elevated)] text-white rounded-lg transition-colors"
                        >
                          View
                        </Link>
                        <Link 
                          href={`/admin/auctions/${auction.id}/edit`}
                          className="px-3 py-1.5 text-xs font-medium bg-[var(--gold)]/20 hover:bg-[var(--gold)]/30 text-[var(--gold)] rounded-lg transition-colors"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {auctions.map((auction) => (
              <div key={auction.id} className="card-glass rounded-xl p-4">
                <div className="flex gap-4 mb-4">
                  <div className="w-16 h-16 rounded-lg bg-[var(--surface)] flex-shrink-0 overflow-hidden">
                    {auction.banner_image_url ? (
                      <img src={auction.banner_image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl opacity-50"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate">{auction.name}</h3>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-1">{auction.description || 'No description'}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[auction.status]}`}>
                        {auction.auction_type === 'tender_base_fixed_bid' && auction.status === 'registration_closed' ? 'BIDDING CLOSED' : auction.auction_type === 'tender_base_fixed_bid' && auction.status === 'live' ? 'BIDDING OPEN' : auction.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        auction.auction_type === 'progressive_elimination_auction' 
                          ? 'bg-purple-500/20 text-purple-400' 
                          : auction.auction_type === 'incremental_approval_auction'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {getAuctionTypeLabel(auction.auction_type, true)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 py-3 border-t border-b border-[var(--border)] mb-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-white">{auction.items_count}</p>
                    <p className="text-xs text-[var(--text-muted)]">Items</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{auction.registered_count}</p>
                    <p className="text-xs text-[var(--text-muted)]">Registered</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]"><LocalTime date={auction.auction_start} format="full" /></p>
                    <p className="text-xs text-[var(--text-muted)]">Start</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link 
                    href={`/admin/auctions/${auction.id}`}
                    className="flex-1 py-2.5 text-center text-sm font-medium bg-[var(--surface)] hover:bg-[var(--surface-elevated)] text-white rounded-lg transition-colors"
                  >
                    View
                  </Link>
                  <Link 
                    href={`/admin/auctions/${auction.id}/edit`}
                    className="flex-1 py-2.5 text-center text-sm font-medium bg-[var(--gold)]/20 hover:bg-[var(--gold)]/30 text-[var(--gold)] rounded-lg transition-colors"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}


