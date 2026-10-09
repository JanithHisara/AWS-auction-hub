'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AuctionCountdown from '@/components/shared/AuctionCountdown'
import { AuctionHammerIcon } from '@/components/brand/Logo'

interface ItemData {
  id: string
  name: string
  description: string
  starting_price: number
  current_price: number
  min_bid_increment: number
  status: string
  end_time: string
  round_end_time: string | null
  gem_images: { image_url: string }[]
  bidCount: number
  uniqueBidders: number
  highestBid: number
  recentBids: { id: string; bid_amount: number; created_at: string }[]; allRegisteredBiddersBid?: boolean;
}

interface MonitorData {
  auction: { id: string; name: string; status: string; auction_type: string }
  currentItem: ItemData | null
  nextItem: { id: string; name: string; status: string } | null
  allItems: { id: string; name: string; status: string }[]
  finishedCount: number
  totalItems: number
}

function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return 'Rs. 0';
  const val = Number(amount);
  if (val >= 1_000_000_000) {
    return 'LKR ' + (val / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  } else if (val >= 1_000_000) {
    return 'LKR ' + (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  } else if (val >= 1_000) {
    return 'LKR ' + (val / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  } else {
    return 'LKR ' + val.toString();
  }
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function ItemMonitorClient({ auctionId, auctionName }: { auctionId: string; auctionName: string }) {
  const [data, setData] = useState<MonitorData | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
    const [flashPrice, setFlashPrice] = useState(false)
  const [showFinished, setShowFinished] = useState(false)
  const supabase = createClient()

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/auctions/${auctionId}/current-item`)
      if (res.ok) {
        const newData = await res.json()
        if (data?.currentItem && newData.currentItem) {
          // Flash when price increases
          if (newData.currentItem.highestBid > data.currentItem.highestBid) {
            setFlashPrice(true)
            setTimeout(() => setFlashPrice(false), 1500)
          }
          // Show finished message when item changes
          if (newData.currentItem.id !== data.currentItem.id) {
            setShowFinished(true)
            setTimeout(() => setShowFinished(false), 3000)
          }
        }
        setData(newData)
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Initial fetch and clock
  useEffect(() => {
    fetchData()
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(clockTimer)
  }, [auctionId])

  // Realtime subscriptions
  useEffect(() => {
    if (!data?.currentItem) return

    const channel = supabase
      .channel(`item-monitor-${data.currentItem.id}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'bids', 
        filter: `gem_id=eq.${data.currentItem.id}` 
      }, () => fetchData())
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'gems', 
        filter: `id=eq.${data.currentItem.id}` 
      }, () => fetchData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [data?.currentItem?.id, supabase])

  // Poll for item changes (backup for when item status changes)
  useEffect(() => {
    const pollInterval = setInterval(fetchData, 5000)
    return () => clearInterval(pollInterval)
  }, [auctionId])

if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-[var(--gold)] text-xl animate-pulse">Loading Monitor...</div>
      </div>
    )
  }

  const { currentItem, nextItem, finishedCount, totalItems, auction } = data
  const isItemFinished = !currentItem && finishedCount === totalItems
  const isSealed = auction?.auction_type === 'tender_base_fixed_bid'

  return (
    <div className="monitor-display min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Scanline effect */}
      <div className="scanline" />

      {/* Finished Item Transition */}
      {showFinished && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="text-center animate-fade-in">
            <div className="text-6xl mb-4"></div>
            <div className="text-3xl font-bold text-[var(--gold)] mb-2">Item Finished!</div>
            <div className="text-xl text-white/60">Loading next item...</div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="relative z-10 bg-gradient-to-r from-[#0f0f18] via-[#1a1a2e] to-[#0f0f18] border-b border-[var(--gold)]/30">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <AuctionHammerIcon className="w-8 h-8 sm:w-12 sm:h-12" />
              <div className="hidden sm:flex flex-col">
                <span className="text-xl font-black tracking-tight text-white leading-none">
                  Auxtion<span className="text-[var(--gold)]">Hub</span>
                </span>
                <span className="text-[8px] tracking-[0.12em] text-[var(--gold)]/60 uppercase">
                  Live Item Monitor
                </span>
              </div>
            </div>
            <div className="h-8 w-px bg-[var(--gold)]/30" />
            <div className={`live-indicator ${isItemFinished ? 'ended' : ''}`}>
              <span className="live-dot" />
              <span className="text-sm sm:text-lg font-bold tracking-wider">
                {isItemFinished ? 'ENDED' : 'LIVE'}
              </span>
            </div>
            <div className="h-8 w-px bg-[var(--gold)]/30 hidden sm:block" />
            <div className="hidden sm:block">
              <div className="text-xs text-[var(--gold)]/60 uppercase">Auction</div>
              <div className="text-lg font-bold text-white">{auctionName}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-xs text-[var(--gold)]/60 uppercase">Progress</div>
              <div className="text-xl font-bold text-white">{finishedCount}/{totalItems}</div>
            </div>
            <div className="monitor-clock">
              <div className="text-xl sm:text-4xl font-mono font-bold tabular-nums text-[var(--gold)]">
                {currentTime.toLocaleTimeString('en-US', { hour12: false })}
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto p-4 sm:p-8">
        {currentItem ? (
          <>
            {/* Item Header */}
            <div className="text-center mb-6 sm:mb-10">
              <div className="text-sm text-[var(--gold)]/60 uppercase tracking-widest mb-2">
                Now Bidding
              </div>
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-wide">
                {currentItem.name}
              </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
              {/* Left: Item Image */}
              <div className="lg:col-span-5 space-y-6">
                <div className="aspect-square rounded-2xl overflow-hidden border-2 border-[var(--gold)]/30 bg-[#12121a]">
                  {currentItem.gem_images?.[0]?.image_url ? (
                    <img 
                      src={currentItem.gem_images[0].image_url} 
                      alt={currentItem.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-8xl opacity-30"></div>
                  )}
                </div>

                {/* Stats Row */}
                <div className={`grid ${isSealed ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>
                  <StatCard label={isSealed ? "Initial Price" : "Starting"} value={formatCurrency(currentItem.starting_price)} />
                  {!isSealed && <StatCard label="Total Bids" value={currentItem.bidCount.toString()} highlight />}
                  {!isSealed && <StatCard label="Bidders" value={currentItem.uniqueBidders.toString()} />}
                </div>
              </div>
              
              {/* Center: Current Price */}
              <div className={`flex flex-col items-center justify-center ${isSealed ? 'lg:col-span-7' : 'lg:col-span-4'}`}>
                <div className="price-display">
                  <div className="text-sm sm:text-lg text-[var(--gold)]/60 uppercase tracking-[0.2em] mb-4">
                    {isSealed ? 'Initial Price' : 'Current Price'}
                  </div>
                  <div className={`price-value ${flashPrice && !isSealed ? 'flash' : ''}`}>
                    {formatCurrency(isSealed ? currentItem.starting_price : currentItem.highestBid)}
                  </div>
                  {!isSealed && currentItem.highestBid > currentItem.starting_price && currentItem.starting_price > 0 && (
                    <div className="price-increase">
                       +{Math.round(((currentItem.highestBid - currentItem.starting_price) / currentItem.starting_price) * 100)}% from starting
                    </div>
                  )}
                  
                  {/* Countdown */}
                  {data?.currentItem?.round_end_time && (
                    <div className="countdown-box">
                      <div className="text-xs text-[var(--gold)]/60 uppercase tracking-widest mb-2">
                        {'Round Ends In'}
                      </div>
                      <div className="text-4xl sm:text-5xl font-mono font-bold text-white tabular-nums">
                            {(() => {
      let forceStop = false;
      if (data?.auction?.auction_type === 'progressive_elimination_auction') {
        const hasClaimedBid = (data?.currentItem?.recentBids || []).some(b => Number(b.bid_amount) === Number(data?.currentItem?.current_price));
        if (hasClaimedBid) { forceStop = true; }
      } else if (data?.auction?.auction_type === 'incremental_approval_auction') {
        if (data?.currentItem?.allRegisteredBiddersBid) { forceStop = true; }
      }
      return <AuctionCountdown roundEndTime={data?.currentItem?.round_end_time || null} forceStop={forceStop} onExpire={fetchData} />;
    })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Next Item Preview */}
                {nextItem && (
                  <div className="mt-6 p-4 bg-[#12121a] border border-[var(--gold)]/20 rounded-xl text-center w-full max-w-md">
                    <div className="text-xs text-[var(--gold)]/60 uppercase tracking-widest mb-1">Up Next</div>
                    <div className="text-lg font-bold text-white">{nextItem.name}</div>
                  </div>
                )}
              </div>

              {/* Right: Live Bids */}
              {!isSealed && (
              <div className="lg:col-span-3">
                <div className="activity-card">
                  <div className="card-header">
                    <span className="pulse-dot" />
                    LIVE BIDS
                  </div>
                  <div className="activity-list">
                    {currentItem.recentBids.length > 0 ? (
                      currentItem.recentBids.map((bid, idx) => (
                        <div key={bid.id} className="activity-item" style={{ animationDelay: `${idx * 0.05}s` }}>
                          <div className="activity-amount">{formatCurrency(bid.bid_amount)}</div>
                          <div className="activity-time">{formatTime(bid.created_at)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="no-bids">
                        <span className="text-4xl mb-3"></span>
                        <span>Waiting for bids...</span>
                      </div>
                    )}
                  </div>
                  <div className="privacy-notice">
                    Bidder identities are hidden until auction ends
                  </div>
                </div>
              </div>
              )}
            </div>
          </>
        ) : isItemFinished ? (
          /* All Items Finished */
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="text-8xl mb-6"></div>
            <h1 className="text-4xl font-black text-[var(--gold)] mb-4">Auction Complete!</h1>
            <p className="text-xl text-white/60">All {totalItems} items have finished bidding.</p>
          </div>
        ) : (
          /* Waiting for First Item */
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="text-8xl mb-6 animate-pulse"></div>
            <h1 className="text-4xl font-black text-white mb-4">Waiting for Auction to Start</h1>
            <p className="text-xl text-white/60">The first item will appear here when bidding begins.</p>
          </div>
        )}
      </div>
      
      <style jsx>{`
        .monitor-display {
          font-family: 'JetBrains Mono', 'SF Mono', monospace;
          position: relative;
        }

        .scanline {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.1) 0px,
            rgba(0, 0, 0, 0.1) 1px,
            transparent 1px,
            transparent 2px
          );
          z-index: 100;
        }

        .live-indicator {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 1.25rem;
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          border-radius: 9999px;
          color: #ef4444;
        }

        .live-indicator.ended {
          background: rgba(245, 158, 11, 0.2);
          border-color: rgba(245, 158, 11, 0.4);
          color: #f59e0b;
        }

        .live-indicator.ended .live-dot {
          background: #f59e0b;
          box-shadow: 0 0 20px #f59e0b;
          animation: none;
        }

        .live-dot {
          width: 12px;
          height: 12px;
          background: #ef4444;
          border-radius: 50%;
          animation: pulse-live 1.5s ease-in-out infinite;
          box-shadow: 0 0 20px #ef4444;
        }

        @keyframes pulse-live {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.9); }
        }

        .monitor-clock {
          padding: 0.75rem 1.25rem;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid var(--gold);
          border-radius: 0.75rem;
        }

        .price-display {
          text-align: center;
          padding: 3rem 2rem;
          background: linear-gradient(135deg, #1a1a2e 0%, #0f0f18 100%);
          border: 2px solid var(--gold);
          border-radius: 1.5rem;
          box-shadow: 0 0 60px rgba(212, 175, 55, 0.15);
        }

        .price-value {
          font-size: 3.5rem;
          font-weight: 800;
          color: var(--gold);
          text-shadow: 0 0 40px rgba(212, 175, 55, 0.5);
          transition: all 0.3s;
        }

        @media (min-width: 768px) {
          .price-value {
            font-size: 5rem;
          }
        }

        .price-value.flash {
          animation: priceFlash 1.5s ease-out;
        }

        @keyframes priceFlash {
          0%, 100% { color: var(--gold); transform: scale(1); }
          25%, 75% { color: #10b981; transform: scale(1.05); }
        }

        .price-increase {
          margin-top: 1rem;
          font-size: 1.25rem;
          color: #10b981;
          font-weight: 600;
        }

        .countdown-box {
          margin-top: 2rem;
          padding: 1.5rem;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 1rem;
        }

        .activity-card {
          background: linear-gradient(180deg, #12121a 0%, #0a0a0f 100%);
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 1rem;
          overflow: hidden;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          background: rgba(212, 175, 55, 0.1);
          border-bottom: 1px solid rgba(212, 175, 55, 0.2);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: var(--gold);
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse-live 1.5s ease-in-out infinite;
        }

        .activity-list {
          flex: 1;
          overflow-y: auto;
          max-height: 400px;
        }

        .activity-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          animation: fadeSlideIn 0.3s ease-out forwards;
          opacity: 0;
        }

        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .activity-amount {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--gold);
        }

        .activity-time {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .no-bids {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          color: #4b5563;
          font-size: 0.875rem;
          text-align: center;
        }

        .privacy-notice {
          padding: 0.75rem 1.25rem;
          background: rgba(0, 0, 0, 0.3);
          font-size: 0.7rem;
          color: #6b7280;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

function StatCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="p-4 bg-[#12121a] border border-[var(--gold)]/20 rounded-xl text-center">
      <div className="text-xs text-[var(--gold)]/60 uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-xl font-bold ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
    </div>
  )
}

