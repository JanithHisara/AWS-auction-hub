import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { redirect } from 'next/navigation'

async function getStats() {
  const user = await requirePermission(PERMISSIONS.VIEW_DASHBOARD)
  const supabase = await createClient()

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (userData?.role === 'moderator') {
    redirect('/admin/auctions')
  }

  // Super admin and admin see all platform data; others see their own
  const isGlobalView = userData?.role === 'super_admin' || userData?.role === 'admin'

  // Get auctions
  const auctionsQuery = supabase.from('auctions').select('id, status')
  const { data: auctions } = isGlobalView
    ? await auctionsQuery
    : await auctionsQuery.eq('admin_id', user.id)

  // Get gems
  const gemsQuery = supabase.from('gems').select('id, status, starting_price')
  const { data: gems } = isGlobalView
    ? await gemsQuery
    : await gemsQuery.eq('admin_id', user.id)

  // Get bids
  const { data: bids } = await supabase
    .from('bids')
    .select('id, gem_id, bid_amount')
    .in('gem_id', gems?.map(g => g.id) || [])

  // Get registrations count
  const { count: totalRegistrations } = await supabase
    .from('auction_registrations')
    .select('*', { count: 'exact', head: true })
    .in('auction_id', auctions?.map(a => a.id) || [])

  const activeGems = gems?.filter(g => g.status === 'active') || []
  const highestBids = activeGems.map(gem => {
    const gemBids = bids?.filter(b => b.gem_id === gem.id) || []
    const highest = gemBids.reduce((max, bid) => 
      bid.bid_amount > max ? bid.bid_amount : max, 0
    )
    return { gemId: gem.id, amount: highest || gem.starting_price }
  })

  const totalValue = highestBids.reduce((sum, h) => sum + h.amount, 0)

  return {
    totalAuctions: auctions?.length || 0,
    liveAuctions: auctions?.filter(a => a.status === 'live').length || 0,
    totalGems: gems?.length || 0,
    activeItems: activeGems.length,
    totalBids: bids?.length || 0,
    totalRegistrations: totalRegistrations || 0,
    totalValue,
  }
}

export default async function AdminDashboard() {
  const stats = await getStats()

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard 
          icon="" 
          label="Total Auctions" 
          value={stats.totalAuctions} 
          accent="gold"
        />
        <StatCard 
          icon="" 
          label="Live Now" 
          value={stats.liveAuctions} 
          accent="red"
        />
        <StatCard 
          icon="" 
          label="Total Items" 
          value={stats.totalGems} 
          accent="blue"
        />
        <StatCard 
          icon="" 
          label="Registrations" 
          value={stats.totalRegistrations} 
          accent="emerald"
        />
        <StatCard 
          icon="" 
          label="Total Bids" 
          value={stats.totalBids} 
          accent="purple"
        />
        <StatCard 
          icon="" 
          label="Total Value" 
          value={formatCurrency(stats.totalValue)} 
          accent="gold"
        />
      </div>



      {/* Recent Activity Placeholder */}
      <div className="card-glass rounded-2xl p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-4">Platform Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="text-center p-6 bg-[var(--surface)] rounded-xl">
            <div className="text-4xl mb-2"></div>
            <p className="text-2xl font-bold text-[var(--gold)]">{stats.liveAuctions}</p>
            <p className="text-sm text-[var(--text-muted)]">Active Auctions</p>
          </div>
          <div className="text-center p-6 bg-[var(--surface)] rounded-xl">
            <div className="text-4xl mb-2"></div>
            <p className="text-2xl font-bold text-emerald-400">{stats.totalBids}</p>
            <p className="text-sm text-[var(--text-muted)]">Bids Placed</p>
          </div>
          <div className="text-center p-6 bg-[var(--surface)] rounded-xl">
            <div className="text-4xl mb-2"></div>
            <p className="text-2xl font-bold text-[var(--gold)]">{formatCurrency(stats.totalValue)}</p>
            <p className="text-sm text-[var(--text-muted)]">Current Value</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ 
  icon, 
  label, 
  value, 
  accent 
}: { 
  icon: string
  label: string
  value: string | number
  accent: 'gold' | 'red' | 'blue' | 'emerald' | 'purple'
}) {
  const accentColors = {
    gold: 'text-[var(--gold)] border-[var(--gold)]/30',
    red: 'text-red-400 border-red-500/30',
    blue: 'text-blue-400 border-blue-500/30',
    emerald: 'text-emerald-400 border-emerald-500/30',
    purple: 'text-purple-400 border-purple-500/30',
  }

  return (
    <div className={`card-glass rounded-xl p-5 border-l-4 ${accentColors[accent]}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className={`text-2xl font-bold ${accentColors[accent].split(' ')[0]}`}>{value}</p>
          <p className="text-xs text-[var(--text-muted)]">{label}</p>
        </div>
      </div>
    </div>
  )
}

function QuickAction({ 
  href, 
  icon, 
  title, 
  desc,
  primary = false 
}: { 
  href: string
  icon: string
  title: string
  desc: string
  primary?: boolean
}) {
  return (
    <Link 
      href={href}
      className={`p-3 sm:p-4 rounded-xl border transition-all group ${
        primary 
          ? 'bg-[var(--gold)] border-[var(--gold)] hover:bg-[var(--gold-light)]' 
          : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--gold)]/50'
      }`}
    >
      <span className="text-xl sm:text-2xl block mb-1 sm:mb-2">{icon}</span>
      <h3 className={`font-bold text-sm sm:text-base ${primary ? 'text-black' : 'text-white'}`}>{title}</h3>
      <p className={`text-[10px] sm:text-xs ${primary ? 'text-black/70' : 'text-[var(--text-muted)]'}`}>{desc}</p>
    </Link>
  )
}

