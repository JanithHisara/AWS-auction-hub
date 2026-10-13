'use client'

import { useState } from 'react'
import { 
  ChevronDown, ChevronUp, Gavel, Trophy, Clock, Flame
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import MediaRenderer from '@/components/gems/MediaRenderer'
import LocalTime from '@/components/ui/LocalTime'

export interface BidRecord {
  id: string
  bidAmount: number
  pointsEarned: number
  createdAt: string
  userId: string
  bidderName: string
  isCurrentUser: boolean
  isWinningBid: boolean
}

export interface BiddingItem {
  id: string
  name: string
  description: string
  startingPrice: number
  currentPrice: number | null
  status: string
  startTime: string
  endTime: string
  caratWeight: number | null
  cut: string | null
  color: string | null
  clarity: string | null
  provenance: string | null
  auctionId: string | null
  auction: {
    id: string
    name: string
    status: string
    auctionType?: string | null
    auctionCode?: string | null
  } | null
  images: {
    imageUrl: string
    mediaType: string
    displayOrder: number
  }[]
  winningPrice: number | null
  winningTime: string | null
  winnerName: string | null
  isUserWinner: boolean
  isUserLeading: boolean
  userHighestBid: number | null
  highestBidOverall: number
  bids: BidRecord[]
}

export default function BiddingItemCard({ item }: { item: BiddingItem }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const uniqueBiddersCount = new Set(item.bids.map(b => b.userId)).size
  const hasWinner = item.isUserWinner || (item.winningPrice !== null && (item.status === 'ended' || item.status === 'completed' || item.status === 'sold'))

  return (
    <div 
      className={`card-glass rounded-2xl overflow-hidden border transition-all ${
        item.isUserWinner
          ? 'border-[var(--gold)]/60 shadow-lg shadow-[var(--gold)]/10'
          : item.isUserLeading
            ? 'border-emerald-500/50 shadow-md shadow-emerald-500/10'
            : 'border-[var(--border)] hover:border-[var(--border-hover)]'
      }`}
    >
      {/* Item Card Body */}
      <div className="p-4 sm:p-5">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-5 items-start">
          {/* Media Thumbnail */}
          <div className="w-full md:w-32 h-40 md:h-32 rounded-xl overflow-hidden bg-[var(--surface-elevated)] shrink-0 border border-[var(--border)]">
            {item.images.length > 0 ? (
              <MediaRenderer
                src={item.images[0].imageUrl}
                alt={item.name}
                mediaType={item.images[0].mediaType}
                className="w-full h-full object-cover"
                controls={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                <Gavel className="w-8 h-8 opacity-20" />
              </div>
            )}
          </div>

          {/* Item Information & Highlights */}
          <div className="flex-1 min-w-0 w-full">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  {item.name}
                </h3>
                {item.caratWeight && (
                  <span className="text-xs text-[var(--gold)] font-bold">
                    {item.caratWeight} ct
                  </span>
                )}
              </div>

              {/* Outcome Badges */}
              <div className="flex items-center gap-2">
                {item.isUserWinner && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-xs font-black rounded-full shadow-md animate-pulse">
                    <Trophy className="w-3.5 h-3.5" /> YOU WON!
                  </span>
                )}

                {!item.isUserWinner && item.isUserLeading && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-black rounded-full">
                    <Flame className="w-3.5 h-3.5" /> LEADING
                  </span>
                )}

                {!item.isUserWinner && !item.isUserLeading && item.status === 'active' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/25">
                    OUTBID
                  </span>
                )}

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  item.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-white/10 text-[var(--text-muted)]'
                }`}>
                  {item.status}
                </span>
              </div>
            </div>

            {/* Specs Snippet */}
            {(item.cut || item.color || item.clarity || item.provenance) && (
              <p className="text-xs text-[var(--text-muted)] mb-3 truncate">
                {[item.cut, item.color, item.clarity, item.provenance].filter(Boolean).join(' • ')}
              </p>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-[var(--surface-elevated)]/60 border border-[var(--border)] text-xs mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                  {hasWinner ? 'Winning Price' : 'Current Leading'}
                </p>
                <p className={`font-mono font-black text-sm ${
                  item.isUserWinner ? 'text-[var(--gold)] text-base' : 'text-white'
                }`}>
                  {formatCurrency(item.winningPrice ?? item.highestBidOverall)}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                  {hasWinner ? 'Winning Time' : 'End Time'}
                </p>
                <p className="text-[var(--text-secondary)] font-medium truncate">
                  {item.winningTime ? (
                    <LocalTime date={item.winningTime} format="full" />
                  ) : item.endTime ? (
                    <LocalTime date={item.endTime} format="full" />
                  ) : (
                    'Active'
                  )}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                  Your Top Bid
                </p>
                <p className="font-mono font-bold text-[var(--gold)]">
                  {item.userHighestBid !== null ? formatCurrency(item.userHighestBid) : 'None'}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                  {hasWinner ? 'Winner' : 'Participation'}
                </p>
                <p className="font-bold text-white truncate">
                  {item.isUserWinner ? (
                    <span className="text-yellow-400 font-black">You</span>
                  ) : item.winnerName ? (
                    <span>{item.winnerName}</span>
                  ) : (
                    <span>{uniqueBiddersCount} {uniqueBiddersCount === 1 ? 'Bidder' : 'Bidders'}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Pull Down Action Button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-bold text-white transition-all group cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Gavel className="w-3.5 h-3.5 text-[var(--gold)]" />
                <span>All Bidders &amp; Bidding Information ({item.bids.length} bids)</span>
              </span>
              <span className="text-[var(--gold)] flex items-center gap-1 group-hover:translate-y-0.5 transition-transform">
                {isExpanded ? (
                  <><span>Collapse</span> <ChevronUp className="w-4 h-4" /></>
                ) : (
                  <><span>Pull Down</span> <ChevronDown className="w-4 h-4" /></>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Pull-Down Details Drawer */}
      {isExpanded && (
        <div className="border-t border-[var(--border)] bg-[var(--surface)]/70 p-4 sm:p-6 space-y-6 animate-in slide-in-from-top-2 duration-300">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[var(--gold)]" />
                All Bidders &amp; Placed Bids ({item.bids.length} bids from {uniqueBiddersCount} bidders)
              </h4>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                Starting: {formatCurrency(item.startingPrice)}
              </span>
            </div>

            {item.bids.length > 0 ? (
              <div className="divide-y divide-[var(--border)]/40 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--background)]">
                {item.bids.map((bid, index) => {
                  const isTopRank = index === 0
                  return (
                    <div
                      key={bid.id}
                      className={`flex items-center justify-between p-3 text-xs transition-colors ${
                        bid.isCurrentUser
                          ? 'bg-[var(--gold)]/10 border-l-4 border-l-[var(--gold)] font-medium'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 ${
                          isTopRank
                            ? 'bg-[var(--gold)] text-black'
                            : 'bg-[var(--surface)] text-[var(--text-muted)]'
                        }`}>
                          #{index + 1}
                        </span>

                        <div className="min-w-0">
                          <p className="font-bold text-white truncate flex items-center gap-2">
                            <span>{bid.bidderName}</span>
                            {bid.isCurrentUser && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--gold)] text-black font-black">
                                YOU
                              </span>
                            )}
                            {bid.isWinningBid && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-black flex items-center gap-1">
                                <Trophy className="w-2.5 h-2.5" /> WINNER
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <LocalTime date={bid.createdAt} format="full" />
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-mono font-black text-sm text-[var(--gold)]">
                          {formatCurrency(bid.bidAmount)}
                        </p>
                        {bid.pointsEarned > 0 && (
                          <p className="text-[10px] text-[var(--text-muted)]">
                            +{bid.pointsEarned} pts
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] p-4 text-center bg-[var(--background)] rounded-xl border border-[var(--border)]">
                No bids placed on this item yet.
              </p>
            )}
          </div>

          {/* Item Full Details & Specifications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {item.description && (
              <div className="p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                <h5 className="text-[10px] font-black uppercase text-[var(--text-muted)] mb-1.5">
                  Item Description
                </h5>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                  {item.description}
                </p>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-2">
              <h5 className="text-[10px] font-black uppercase text-[var(--text-muted)] mb-1.5">
                Gem Specifications
              </h5>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {item.caratWeight && (
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)]">Carat:</span>
                    <p className="font-bold text-white">{item.caratWeight} ct</p>
                  </div>
                )}
                {item.cut && (
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)]">Cut:</span>
                    <p className="font-bold text-white">{item.cut}</p>
                  </div>
                )}
                {item.color && (
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)]">Color:</span>
                    <p className="font-bold text-white">{item.color}</p>
                  </div>
                )}
                {item.clarity && (
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)]">Clarity:</span>
                    <p className="font-bold text-white">{item.clarity}</p>
                  </div>
                )}
                {item.provenance && (
                  <div className="col-span-2">
                    <span className="text-[10px] text-[var(--text-muted)]">Provenance:</span>
                    <p className="font-bold text-white">{item.provenance}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}