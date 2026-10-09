import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { GemStatus } from '@/types/database'
import LocalTime from '@/components/ui/LocalTime'

export default async function GemsPage() {
  const user = await requirePermission(PERMISSIONS.MANAGE_ITEMS)
  const supabase = await createClient()

  const { data: gems } = await supabase
    .from('gems')
    .select('*, auction:auctions(name), gem_images(*)')
    .eq('admin_id', user.id)
    .order('created_at', { ascending: false })

  const gemsWithBids = await Promise.all(
    (gems || []).map(async (gem) => {
      const { data: bids } = await supabase
        .from('bids')
        .select('bid_amount')
        .eq('gem_id', gem.id)
        .order('bid_amount', { ascending: false })
        .limit(1)

      return {
        ...gem,
        highestBid: bids?.[0]?.bid_amount || gem.starting_price,
        bidCount: bids?.length || 0,
      }
    })
  )

  const statusColors: Record<GemStatus, string> = {
    draft: 'bg-gray-500/20 text-gray-400',
    pending: 'bg-blue-500/20 text-blue-400',
    active: 'bg-emerald-500/20 text-emerald-400',
    ended: 'bg-amber-500/20 text-amber-400',
    completed: 'bg-purple-500/20 text-purple-400',
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Items</h1>
          <p className="text-[var(--text-secondary)]">{gemsWithBids.length} items total</p>
        </div>
        <Link href="/admin/gems/new" className="btn-gold">
          <span>+ Add Item</span>
        </Link>
      </div>

      {gemsWithBids.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {gemsWithBids.map((gem) => (
            <Link
              key={gem.id}
              href={`/admin/gems/${gem.id}`}
              className="card-auction group"
            >
              {/* Image */}
              <div className="aspect-square overflow-hidden bg-[var(--surface)]">
                {gem.gem_images?.[0]?.image_url ? (
                  <img 
                    src={gem.gem_images[0].image_url}
                    alt={gem.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-6xl opacity-20"></span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-bold text-white group-hover:text-[var(--gold)] transition-colors truncate">
                    {gem.name}
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${statusColors[gem.status as GemStatus]}`}>
                    {gem.status}
                  </span>
                </div>

                {gem.auction && (
                  <p className="text-xs text-[var(--text-muted)] mb-3 truncate">
                     {(gem.auction as { name: string }).name}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-[var(--text-muted)] text-xs">Starting</p>
                    <p className="text-white font-mono">{formatCurrency(gem.starting_price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[var(--text-muted)] text-xs">Current</p>
                    <p className="text-[var(--gold)] font-mono font-bold">{formatCurrency(gem.highestBid)}</p>
                  </div>
                </div>

                {gem.bidCount > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">{gem.bidCount} bids</span>
                    {gem.status === 'active' && gem.end_time && (
                      <span className="text-amber-400">Ends <LocalTime date={gem.end_time} format="full" /></span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[var(--surface)] border border-[var(--border)] mb-6">
            <span className="text-4xl"></span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">No Items Yet</h3>
          <p className="text-[var(--text-secondary)] mb-6">Create your first auction item</p>
          <Link href="/admin/gems/new" className="btn-gold inline-block">
            <span>+ Add Item</span>
          </Link>
        </div>
      )}
    </div>
  )
}

