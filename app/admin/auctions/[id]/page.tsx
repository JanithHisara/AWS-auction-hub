import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Auction, Gem, AuctionRegistration, RegistrationApprovalStatus } from '@/types/database'
import LocalTime from '@/components/ui/LocalTime'
import { ADMIN_ROLES } from '@/lib/permissions'

async function getAuction(id: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  
  if (!userData?.role || !ADMIN_ROLES.includes(userData.role as typeof ADMIN_ROLES[number])) redirect('/')

  const { data: auction } = await supabase
    .from('auctions')
    .select('*')
    .eq('id', id)
    .single()

  if (!auction) return null

  // Get items with bid counts
  const { data: items } = await supabase
    .from('gems')
    .select('*, gem_images(*)')
    .eq('auction_id', id)
    .order('created_at')

  // Get bid counts for each item
  const itemsWithBids = await Promise.all(
    (items || []).map(async (item) => {
      const { count } = await supabase
        .from('bids')
        .select('*', { count: 'exact', head: true })
        .eq('gem_id', item.id)
      
      const { data: highestBid } = await supabase
        .from('bids')
        .select('bid_amount')
        .eq('gem_id', item.id)
        .order('bid_amount', { ascending: false })
        .limit(1)
        .single()

      return {
        ...item,
        bidsCount: count || 0,
        highestBid: highestBid?.bid_amount || item.starting_price,
      }
    })
  )

  // Get registrations using admin client to bypass RLS on users join
  const adminClient = createAdminClient()
  const { data: registrations } = await adminClient
    .from('auction_registrations')
    .select('*, user:users!auction_registrations_user_id_fkey(email, anonymous_name, phone, display_name)')
    .eq('auction_id', id)
    .order('registered_at', { ascending: false })

  return {
    auction,
    items: itemsWithBids,
    registrations: registrations || [],
  }
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400',
  upcoming: 'bg-blue-500/20 text-blue-400',
  registration_open: 'bg-emerald-500/20 text-emerald-400',
    registration_closed: 'bg-indigo-500/20 text-indigo-400',
  live: 'bg-red-500/20 text-red-400',
  ended: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-purple-500/20 text-purple-400',
}

const itemStatusColors: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400',
  pending: 'bg-blue-500/20 text-blue-400',
  active: 'bg-emerald-500/20 text-emerald-400',
  ended: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-purple-500/20 text-purple-400',
}

import ProgressiveStatusActions from '@/components/admin/ProgressiveStatusActions'
import TenderStatusActions from '@/components/admin/TenderStatusActions'
import IncrementalStatusActions from '@/components/admin/IncrementalStatusActions'
import AuctionDetailClient from '@/components/admin/AuctionDetailClient'
import BidderHoldManager from '@/components/admin/BidderHoldManager'
import AddUserToAuctionButton from '@/components/admin/AddUserToAuctionButton'


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

type ItemWithBids = Gem & { 
  gem_images: { image_url: string }[]
  bidsCount: number
  highestBid: number
}

export default async function AdminAuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getAuction(id)

  if (!data) notFound()

  const { auction, items, registrations } = data
  const totalBids = items.reduce((sum, item) => sum + item.bidsCount, 0)
  const totalValue = items.reduce((sum, item) => sum + item.highestBid, 0)
    const unpublishedItemCount = items?.filter(item => item.status !== 'published').length || 0;
  const approvedCount = registrations.filter(r => r.approval_status === 'approved').length

  return (
    <AuctionDetailClient auctionId={id}>
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link 
            href="/admin/auctions"
            className="text-sm text-[var(--text-muted)] hover:text-white mb-2 inline-block"
          >
             Back to Auctions
          </Link>
          <h1 className="text-3xl font-bold text-white">{auction.name}</h1>
          <p className="text-[var(--text-secondary)]">{auction.description || 'No description'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
            auction.auction_type === 'progressive_elimination_auction' 
              ? 'bg-purple-500/20 text-purple-400' 
              : auction.auction_type === 'incremental_approval_auction'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            {auction.auction_type === 'progressive_elimination_auction' 
              ? ' English Auction' 
              : auction.auction_type === 'incremental_approval_auction'
                ? ' Progressive Elimination'
                : ' Closed Bid'}
          </span>
          <span className={`px-4 py-2 rounded-full text-sm font-bold ${statusColors[auction.status]}`}>
            {auction.auction_type === 'tender_base_fixed_bid' && auction.status === 'registration_closed' ? 'BIDDING CLOSED' : auction.auction_type === 'tender_base_fixed_bid' && auction.status === 'live' ? 'BIDDING OPEN' : auction.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card-glass rounded-xl p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Auction Controls</h2>
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
          {auction.auction_type === 'progressive_elimination_auction' && (
            <ProgressiveStatusActions 
              auctionId={id} 
              currentStatus={auction.status as any} 
              itemCount={items.length} unpublishedItemCount={unpublishedItemCount}
              approvedCount={approvedCount}
            />
          )}
          {auction.auction_type === 'tender_base_fixed_bid' && (
            <TenderStatusActions 
              auctionId={id} 
              currentStatus={auction.status as any} 
              itemCount={items.length} unpublishedItemCount={unpublishedItemCount}
              approvedCount={approvedCount}
            />
          )}
          {auction.auction_type === 'incremental_approval_auction' && (
            <IncrementalStatusActions 
              auctionId={id} 
              currentStatus={auction.status as any} 
              itemCount={items.length} unpublishedItemCount={unpublishedItemCount}
              approvedCount={approvedCount}
            />
          )}
          <Link 
            href={`/admin/auctions/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--gold)]/20 border border-[var(--gold)]/30 rounded-lg text-[var(--gold)] hover:bg-[var(--gold)]/30 transition-colors"
          >
             Edit Auction
          </Link>
          {auction.status === 'live' && (
            <Link 
              href={`/monitor/auction/${id}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white hover:border-[var(--gold)] transition-colors"
              target="_blank"
            >
               Open Monitor
            </Link>
          )}
          {auction.status === 'live' && (
            <Link 
              href={`/monitor/auction/${id}/item`}
              className="flex items-center gap-2 px-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white hover:border-[var(--gold)] transition-colors"
              target="_blank"
            >
               Item Monitor
            </Link>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard icon="" label="Registered" value={registrations.length} />
        <StatCard icon="" label="Items" value={items.length} />
        <StatCard icon="" label="Bids" value={totalBids} />
        <StatCard icon="" label="Value" value={formatCurrency(totalValue)} accent />
        <StatCard icon="" label="Max" value={auction.max_participants || ''} />
      </div>

      {/* Schedule */}
      <div className="card-glass rounded-xl p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Schedule</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {auction.auction_type === 'tender_base_fixed_bid' ? (
            <>
              <ScheduleItem label="Registration Open" value={<LocalTime date={auction.registration_start} format="full" />} />
              <ScheduleItem label="Bid Open" value={<LocalTime date={auction.auction_start} format="full" />} />
              <ScheduleItem label="Bid Close" value={<LocalTime date={auction.auction_end} format="full" />} />
            </>
          ) : (
            <>
              <ScheduleItem label="Reg Opens" value={<LocalTime date={auction.registration_start} format="full" />} />
              <ScheduleItem label="Reg Closes" value={<LocalTime date={auction.registration_end} format="full" />} />
              <ScheduleItem label="Starts" value={<LocalTime date={auction.auction_start} format="full" />} />
            </>
          )}
        </div>
      </div>

      {/* Items Section */}
      <div className="card-glass rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Auction Items</h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">{items.length} items  {totalBids} bids</p>
          </div>
          <Link href={`/admin/gems/new?auction_id=${id}`} className="btn-gold w-full sm:w-auto text-center">
            <span>+ Add Item</span>
          </Link>
        </div>
        
        {items.length > 0 ? (
          <div className="space-y-4">
            {items.map((item: ItemWithBids) => (
              <Link 
                key={item.id}
                href={`/admin/gems/${item.id}`}
                className="group flex flex-col sm:flex-row gap-3 sm:gap-4 p-3 sm:p-4 bg-[var(--surface)] rounded-xl border border-[var(--border)] hover:border-[var(--gold)]/50 transition-all"
              >
                {/* Image */}
                <div className="w-full sm:w-20 h-32 sm:h-20 md:w-24 md:h-24 flex-shrink-0 rounded-xl overflow-hidden bg-[var(--background)]">
                  {item.gem_images?.[0]?.image_url ? (
                    <img 
                      src={item.gem_images[0].image_url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl opacity-30"></div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-white group-hover:text-[var(--gold)] transition-colors truncate text-sm sm:text-base">
                      {item.name}
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${itemStatusColors[item.status]}`}>
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-1 mb-2 sm:mb-3">
                    {item.description}
                  </p>

                  <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-6 text-xs sm:text-sm">
                    <div>
                      <span className="text-[var(--text-muted)] block sm:inline">Start </span>
                      <span className="text-white font-mono">{formatCurrency(item.starting_price)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block sm:inline">Now </span>
                      <span className="text-[var(--gold)] font-mono font-bold">{formatCurrency(item.highestBid)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block sm:inline">Bids </span>
                      <span className="text-white">{item.bidsCount}</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="hidden sm:flex items-center">
                  <span className="text-[var(--text-muted)] group-hover:text-[var(--gold)] group-hover:translate-x-1 transition-all">
                    
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto bg-[var(--surface)] rounded-2xl flex items-center justify-center mb-4">
              <span className="text-3xl"></span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No Items Yet</h3>
            <p className="text-[var(--text-muted)] mb-4">Add items to this auction</p>
            <Link href={`/admin/gems/new?auction_id=${id}`} className="btn-gold inline-block">
              <span>+ Add First Item</span>
            </Link>
          </div>
        )}
      </div>

      {/* Registrations */}
      <div className="card-glass rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-white">Registrations ({registrations.length})</h2>
          <div className="flex items-center gap-3">
            <AddUserToAuctionButton auctionId={id} />
            <Link 
              href={`/admin/auctions/${id}/registrations`}
              className="text-sm text-[var(--gold)] hover:underline"
            >
              Manage 
            </Link>
          </div>
        </div>
        
        {registrations.length > 0 ? (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">User</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">Registered</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">Approval</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">Email</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {registrations.map((reg: AuctionRegistration & { user: { email: string; anonymous_name?: string; display_name?: string | null; phone?: string | null } }) => (
                    <tr key={reg.id} className="hover:bg-[var(--surface-elevated)]">
                      <td className="py-3 px-4">
                        <p className="text-white font-medium">{reg.user?.display_name || reg.user?.anonymous_name || reg.user?.email || 'Unknown'}</p>
                        <p className="text-xs text-[var(--text-muted)]">{reg.user?.email}</p>
                        {reg.user?.phone && <p className="text-xs text-[var(--text-muted)]">{reg.user.phone}</p>}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)] text-sm">
                        <LocalTime date={reg.registered_at} />
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          reg.approval_status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                          reg.approval_status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {(reg.approval_status || 'pending').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {reg.email_sent_at ? (
                          <span className="text-emerald-400 text-sm"> Sent</span>
                        ) : reg.approval_status === 'approved' ? (
                          <span className="text-amber-400 text-sm">Pending</span>
                        ) : (
                          <span className="text-[var(--text-muted)] text-sm"></span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-white">{reg.access_count}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {registrations.map((reg: AuctionRegistration & { user: { email: string; anonymous_name?: string; display_name?: string | null; phone?: string | null } }) => (
                <div key={reg.id} className="p-3 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-white font-medium text-sm">{reg.user?.display_name || reg.user?.anonymous_name || reg.user?.email || 'Unknown'}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">{reg.user?.email}</p>
                      {reg.user?.phone && <p className="text-xs text-[var(--text-muted)]">{reg.user.phone}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      reg.approval_status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                      reg.approval_status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>
                      {(reg.approval_status || 'pending').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
                    <span> <LocalTime date={reg.registered_at} format="short" /></span>
                    <span>{reg.email_sent_at ? ' Sent' : ' Pending'}</span>
                    <span> {reg.access_count}x</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-[var(--text-muted)]">
            No registrations yet
          </div>
        )}
      </div>
      {/* Bidder Hold Management */}
      {(auction.status === 'live' || auction.status === 'registration_open' || auction.status === 'registration_closed') && (
        <BidderHoldManager
          auctionId={id}
          registrations={registrations.map(r => ({
            id: r.id,
            user_id: r.user_id,
            approval_status: r.approval_status || 'pending',
            user: r.user as { email: string; anonymous_name?: string; display_name?: string | null } | undefined,
          }))}
        />
      )}
    </div>
    </AuctionDetailClient>
  )
}

function StatCard({ icon, label, value, accent = false }: { icon: string; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="card-glass rounded-xl p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className={`text-2xl font-bold ${accent ? 'text-[var(--gold)]' : 'text-white'}`}>{value}</p>
          <p className="text-xs text-[var(--text-muted)]">{label}</p>
        </div>
      </div>
    </div>
  )
}

function ScheduleItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-3 bg-[var(--surface)] rounded-lg">
      <p className="text-xs text-[var(--text-muted)] uppercase mb-1">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  )
}









