'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  Gavel, Trophy, Search, ExternalLink, ArrowUpRight, Flame
} from 'lucide-react'
import BiddingItemCard, { BiddingItem, BidRecord } from '@/components/bids/BiddingItemCard'

export type { BiddingItem, BidRecord }

interface Props {
  items: BiddingItem[]
  currentUserId: string
}

type FilterTab = 'all' | 'won' | 'leading' | 'outbid'

export default function MyBidsClient({ items, currentUserId }: Props) {
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter items based on tab and search
  const filteredItems = items.filter(item => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = item.name.toLowerCase().includes(q)
      const matchAuction = (item.auction?.name || '').toLowerCase().includes(q)
      const matchDesc = (item.description || '').toLowerCase().includes(q)
      if (!matchName && !matchAuction && !matchDesc) return false
    }

    // Filter tab
    if (filterTab === 'won') {
      return item.isUserWinner
    }
    if (filterTab === 'leading') {
      return item.isUserLeading && !item.isUserWinner
    }
    if (filterTab === 'outbid') {
      return !item.isUserWinner && !item.isUserLeading
    }

    return true
  })

  // Group items by Main Category: Auction
  const groupedByAuction = filteredItems.reduce<Record<string, {
    auctionId: string
    auctionName: string
    auctionType?: string | null
    auctionStatus?: string
    auctionCode?: string | null
    items: BiddingItem[]
  }>>((acc, item) => {
    const key = item.auctionId || 'standalone'
    if (!acc[key]) {
      acc[key] = {
        auctionId: item.auctionId || 'standalone',
        auctionName: item.auction?.name || 'Independent Items',
        auctionType: item.auction?.auctionType,
        auctionStatus: item.auction?.status,
        auctionCode: item.auction?.auctionCode,
        items: [],
      }
    }
    acc[key].items.push(item)
    return acc
  }, {})

  // Calculate high-level stats
  const totalBidsCount = items.reduce((sum, item) => sum + item.bids.filter(b => b.isCurrentUser).length, 0)
  const wonCount = items.filter(i => i.isUserWinner).length
  const leadingCount = items.filter(i => i.isUserLeading).length
  const uniqueAuctionsCount = Object.keys(groupedByAuction).length

  return (
    <div className="min-h-screen bg-[var(--background)] relative">
      <div className="fixed inset-0 bg-grid-pattern opacity-25" />
      
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Header & Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black uppercase tracking-wider text-[var(--gold)] px-2.5 py-0.5 rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/20 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> Bidding Hub
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              My Bidding History
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
              Organized auction-wise with all items, winning summaries, and full bidder histories.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link 
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--surface-elevated)] border border-[var(--border)] text-white hover:border-[var(--gold)]/40 hover:text-[var(--gold)] transition-all"
            >
              Browse Auctions <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="card-glass rounded-2xl p-4 border border-[var(--border)]">
            <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase">Participated</p>
            <p className="text-2xl font-black text-white mt-1">{items.length} <span className="text-xs font-normal text-[var(--text-muted)]">Items</span></p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">across {uniqueAuctionsCount} auctions</p>
          </div>

          <div className="card-glass rounded-2xl p-4 border border-[var(--border)] bg-gradient-to-br from-amber-500/5 to-transparent">
            <p className="text-[11px] font-bold text-[var(--gold)] uppercase flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" /> Won Items
            </p>
            <p className="text-2xl font-black text-[var(--gold)] mt-1">{wonCount}</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Winning bidder</p>
          </div>

          <div className="card-glass rounded-2xl p-4 border border-[var(--border)]">
            <p className="text-[11px] font-bold text-emerald-400 uppercase flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" /> Leading
            </p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{leadingCount}</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Active highest bids</p>
          </div>

          <div className="card-glass rounded-2xl p-4 border border-[var(--border)]">
            <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase">Total Bids</p>
            <p className="text-2xl font-black text-white mt-1">{totalBidsCount}</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Placed by you</p>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="card-glass rounded-2xl p-3 border border-[var(--border)] mb-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex gap-1 w-full sm:w-auto bg-[var(--background)] p-1 rounded-xl border border-[var(--border)]">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'all'
                  ? 'bg-[var(--gold)] text-black shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              All Items ({items.length})
            </button>
            <button
              onClick={() => setFilterTab('won')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'won'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              Won ({wonCount})
            </button>
            <button
              onClick={() => setFilterTab('leading')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'leading'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              Leading ({leadingCount})
            </button>
            <button
              onClick={() => setFilterTab('outbid')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'outbid'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              Outbid
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by auction or item name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)] transition-colors"
            />
          </div>
        </div>

        {/* Main Content: Grouped by Auction Header (Main Category) */}
        {Object.keys(groupedByAuction).length === 0 ? (
          <div className="card-glass rounded-2xl p-12 text-center border border-[var(--border)]">
            <p className="text-sm text-[var(--text-muted)]">No bidding items match your current filter.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(groupedByAuction).map(([key, group]) => (
              <section key={key} className="space-y-4">
                {/* Main Category: Auction Header */}
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/15 border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] shrink-0">
                        <Gavel className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                            {group.auctionName}
                          </h2>
                          {group.auctionCode && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[var(--text-muted)] font-mono">
                              {group.auctionCode}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                          <span>{group.items.length} {group.items.length === 1 ? 'Item' : 'Items'} participating</span>
                          {group.auctionType && (
                            <span>• {group.auctionType.replace(/_/g, ' ')}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {group.auctionStatus && (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          group.auctionStatus === 'live'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : group.auctionStatus === 'completed' || group.auctionStatus === 'ended'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]/30'
                        }`}>
                          {group.auctionStatus.replace(/_/g, ' ')}
                        </span>
                      )}

                      {group.auctionId !== 'standalone' && (
                        <Link
                          href={`/auctions/${group.auctionId}`}
                          className="p-2 rounded-xl text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-elevated)] transition-colors"
                          title="View Auction Lobby"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub-Category: Items inside this Auction (Shown by Default) */}
                <div className="space-y-4">
                  {group.items.map((item) => (
                    <BiddingItemCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}