'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import MediaRenderer from '@/components/gems/MediaRenderer'
import LocalTime from '@/components/ui/LocalTime'

interface BidItem {
  id: string
  bid_amount: number
  points_earned: number
  created_at: string
  gem_id: string
  gem: {
    id: string
    name: string
    description: string
    starting_price: number
    current_price: number
    status: string
    end_time: string
    carat_weight: number | null
    cut: string | null
    color: string | null
    clarity: string | null
    provenance: string | null
    auction_id: string | null
  }
  highestBid: number
  images: { image_url: string; media_type: string }[]
  auctionName: string | null
  auctionId: string | null
}

interface Props {
  bids: BidItem[]
}

export default function MyBidsClient({ bids }: Props) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggleExpand = (bidId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(bidId)) next.delete(bidId)
      else next.add(bidId)
      return next
    })
  }

  // Group bids by auction
  const grouped = bids.reduce<Record<string, { auctionName: string; auctionId: string | null; bids: BidItem[] }>>((acc, bid) => {
    const key = bid.auctionId || 'standalone'
    if (!acc[key]) {
      acc[key] = {
        auctionName: bid.auctionName || 'Standalone Items',
        auctionId: bid.auctionId,
        bids: [],
      }
    }
    acc[key].bids.push(bid)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-[var(--background)] relative">
      <div className="fixed inset-0 bg-grid-pattern opacity-30" />
      
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-white">My Bids</h1>
          <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[var(--surface)] rounded-full text-[var(--text-secondary)] text-sm">
            {bids.length} total bid{bids.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="space-y-8">
          {Object.entries(grouped).map(([key, group]) => (
            <section key={key}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-white">{group.auctionName}</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]">
                  {group.bids.length} item{group.bids.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-3">
                {group.bids.map((bid) => {
                  const { gem } = bid
                  const isHighest = bid.bid_amount >= bid.highestBid
                  const isActive = gem.status === 'active'
                  const isExpanded = expandedItems.has(bid.id)

                  return (
                    <div key={bid.id} className="card-glass rounded-xl overflow-hidden">
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 p-4 sm:p-5">
                        {/* Thumbnail */}
                        <div className="flex-shrink-0 w-full sm:w-20 h-32 sm:h-20 md:w-24 md:h-24 rounded-xl overflow-hidden bg-[var(--surface)]">
                          {bid.images[0]?.image_url ? (
                            <MediaRenderer
                              src={bid.images[0].image_url}
                              alt={gem.name}
                              mediaType={bid.images[0].media_type}
                              className="w-full h-full object-cover"
                              controls={false}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl opacity-30"></div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <Link href={`/gems/${gem.id}`} className="text-base sm:text-lg font-bold text-white hover:text-[var(--gold)] transition-colors truncate">
                              {gem.name}
                            </Link>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isHighest && isActive && (
                                <span className="px-2 py-0.5 bg-[var(--gold)] text-black text-xs font-bold rounded-full">
                                  LEADING
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${
                                isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--surface)] text-[var(--text-muted)]'
                              }`}>
                                {gem.status}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                            <div>
                              <p className="text-[10px] sm:text-xs text-[var(--text-muted)]">Your Bid</p>
                              <p className="text-[var(--gold)] font-bold font-mono">{formatCurrency(bid.bid_amount)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] sm:text-xs text-[var(--text-muted)]">Highest</p>
                              <p className="text-white font-bold font-mono">{formatCurrency(bid.highestBid)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] sm:text-xs text-[var(--text-muted)]">Placed</p>
                              <p className="text-[var(--text-secondary)] text-xs"><LocalTime date={bid.created_at} format="full" /></p>
                            </div>
                          </div>

                          {bid.points_earned > 0 && (
                            <span className="text-xs text-[var(--gold)]">+{bid.points_earned} pts</span>
                          )}
                        </div>
                      </div>

                      {/* Expand/Collapse */}
                      <button
                        onClick={() => toggleExpand(bid.id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-t border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface)] transition-colors"
                      >
                        {isExpanded ? (
                          <><ChevronUp className="w-4 h-4" /> Hide Details</>
                        ) : (
                          <><ChevronDown className="w-4 h-4" /> More Details</>
                        )}
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-[var(--border)] p-4 sm:p-5 bg-[var(--surface)]/50 space-y-4">
                          {/* Description */}
                          {gem.description && (
                            <div>
                              <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Description</h4>
                              <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                                {gem.description}
                              </p>
                            </div>
                          )}

                          {/* Specifications */}
                          {(gem.carat_weight || gem.cut || gem.color || gem.clarity) && (
                            <div>
                              <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Specifications</h4>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {gem.carat_weight && (
                                  <div className="p-2 bg-[var(--background)] rounded-lg">
                                    <p className="text-[10px] text-[var(--text-muted)]">Carat</p>
                                    <p className="text-sm font-bold text-white">{gem.carat_weight} ct</p>
                                  </div>
                                )}
                                {gem.cut && (
                                  <div className="p-2 bg-[var(--background)] rounded-lg">
                                    <p className="text-[10px] text-[var(--text-muted)]">Cut</p>
                                    <p className="text-sm font-bold text-white">{gem.cut}</p>
                                  </div>
                                )}
                                {gem.color && (
                                  <div className="p-2 bg-[var(--background)] rounded-lg">
                                    <p className="text-[10px] text-[var(--text-muted)]">Color</p>
                                    <p className="text-sm font-bold text-white">{gem.color}</p>
                                  </div>
                                )}
                                {gem.clarity && (
                                  <div className="p-2 bg-[var(--background)] rounded-lg">
                                    <p className="text-[10px] text-[var(--text-muted)]">Clarity</p>
                                    <p className="text-sm font-bold text-white">{gem.clarity}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Provenance */}
                          {gem.provenance && (
                            <div>
                              <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Provenance</h4>
                              <p className="text-sm text-[var(--text-secondary)]">{gem.provenance}</p>
                            </div>
                          )}

                          {/* Images Gallery */}
                          {bid.images.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Images</h4>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {bid.images.map((img, idx) => (
                                  <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-[var(--background)]">
                                    <MediaRenderer
                                      src={img.image_url}
                                      alt={`${gem.name} - ${idx + 1}`}
                                      mediaType={img.media_type}
                                      className="w-full h-full object-cover"
                                      controls={false}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Price Info */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-3 bg-[var(--background)] rounded-lg">
                              <p className="text-[10px] text-[var(--text-muted)]">Starting Price</p>
                              <p className="text-sm font-bold text-[var(--gold)]">{formatCurrency(gem.starting_price)}</p>
                            </div>
                            <div className="p-3 bg-[var(--background)] rounded-lg">
                              <p className="text-[10px] text-[var(--text-muted)]">Current Price</p>
                              <p className="text-sm font-bold text-white">{formatCurrency(gem.current_price)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

