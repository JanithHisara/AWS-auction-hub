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
  auction?: { name: string } | null
}

interface BidData {
  id: string
  bid_amount: number
  created_at: string
  user_id: string
}

interface MonitorData {
  item: ItemData
  bidCount: number
  uniqueBidders: number
  highestBid: number
  recentBids: BidData[]
  isFinished: boolean
  allRegisteredBiddersBid?: boolean
  topBidders: { anonymous_name: string; bid_amount: number }[]
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

export default function MonitorClient({ gemId }: { gemId: string }) {
  const [data, setData] = useState<MonitorData | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
    const [flashPrice, setFlashPrice] = useState(false)
  const supabase = createClient()

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/gems/${gemId}/monitor-data`)
      if (res.ok) {
        const newData = await res.json()
        if (data && newData.highestBid > data.highestBid) {
          setFlashPrice(true)
          setTimeout(() => setFlashPrice(false), 1500)
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
  }, [gemId])
    
    // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`item-monitor-${gemId}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'bids', 
        filter: `gem_id=eq.${gemId}` 
      }, () => fetchData())
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'gems', 
        filter: `id=eq.${gemId}` 
      }, () => fetchData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gemId, supabase])



  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-[var(--gold)] text-xl animate-pulse">Loading Monitor...</div>
      </div>
    )
  }

  const { item, bidCount, uniqueBidders, highestBid, isFinished, topBidders, recentBids } = data
  const auctionType = Array.isArray(item?.auction) ? item?.auction[0]?.auction_type : (item?.auction as any)?.auction_type;
  const isSealed = auctionType === 'tender_base_fixed_bid';
  const priceIncrease = highestBid > item.starting_price && item.starting_price > 0
    ? Math.round(((highestBid - item.starting_price) / item.starting_price) * 100) 
    : 0

  return (
    <div className="monitor-display min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Scanline effect */}
      <div className="scanline" />
      
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
            <div className={`live-indicator ${isFinished ? 'ended' : ''}`}>
              <span className="live-dot" />
              <span className="text-sm sm:text-lg font-bold tracking-wider">
                {isFinished ? 'ENDED' : 'LIVE'}
              </span>
            </div>
          </div>
          
          <div className="monitor-clock">
            <div className="text-xl sm:text-4xl font-mono font-bold tabular-nums text-[var(--gold)]">
              {currentTime.toLocaleTimeString('en-US', { hour12: false })}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto p-4 sm:p-8">
        {/* Item Header */}
        <div className="text-center mb-6 sm:mb-10">
          {item.auction && (
            <div className="text-sm text-[var(--gold)]/60 uppercase tracking-widest mb-2">
              {item.auction.name}
            </div>
          )}
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-wide">
            {item.name}
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          {/* Left: Item Image & Info */}
          <div className="lg:col-span-5 space-y-6">
            {/* Main Image */}
            <div className="aspect-square rounded-2xl overflow-hidden border-2 border-[var(--gold)]/30 bg-[#12121a]">
              {item.gem_images?.[0]?.image_url ? (
                <img 
                  src={item.gem_images[0].image_url} 
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl opacity-30"></div>
              )}
            </div>

            {/* Stats Row */}
            <div className={`grid ${isSealed ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>
              <StatCard label={isSealed ? "Initial Price" : "Starting"} value={formatCurrency(item.starting_price)} />
              {!isSealed && <StatCard label="Total Bids" value={bidCount.toString()} highlight />}
              {!isSealed && <StatCard label="Bidders" value={uniqueBidders.toString()} />}
            </div>
          </div>
          
          {/* Center: Current Price */}
          <div className={`flex flex-col items-center justify-center ${isSealed ? 'lg:col-span-7' : 'lg:col-span-4'}`}>
            <div className="price-display">
              <div className="text-sm sm:text-lg text-[var(--gold)]/60 uppercase tracking-[0.2em] mb-4">
                {isSealed ? 'Initial Price' : 'Current Price'}
              </div>
              <div className={`price-value ${flashPrice && !isSealed ? 'flash' : ''}`}>
                {formatCurrency(isSealed ? item.starting_price : highestBid)}
              </div>
              {!isSealed && priceIncrease > 0 && (
                <div className="price-increase">
                   +{priceIncrease}% from starting
                </div>
              )}
              
              {/* Countdown */}
              {data?.item?.round_end_time && !isFinished && (
                <div className="countdown-box">
                  <div className="text-xs text-[var(--gold)]/60 uppercase tracking-widest mb-2">
                    {'Round Ends In'}
                  </div>
              <div className="text-4xl sm:text-5xl font-mono font-bold text-white tabular-nums">
                    {(() => {
      let forceStop = false;
      if (auctionType === 'progressive_elimination_auction') {
        const hasClaimedBid = (data?.recentBids || []).some(b => Number(b.bid_amount) === Number(data?.item?.current_price));
        if (hasClaimedBid) { forceStop = true; }
      } else if (auctionType === 'incremental_approval_auction') {
        if (data?.allRegisteredBiddersBid) { forceStop = true; }
      }
      return <AuctionCountdown roundEndTime={data?.item?.round_end_time || null} forceStop={forceStop} />;
    })()}
              </div>
            </div>
          )}

              {isFinished && (
                <div className="mt-8 px-6 py-3 bg-amber-500/20 border border-amber-500/40 rounded-xl">
                  <span className="text-amber-400 font-bold uppercase tracking-wider">Auction Ended</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Activity / Results */}
          {!isSealed && (
          <div className="lg:col-span-3">
            {isFinished ? (
              /* Show bidder details after auction ends */
              <div className="results-card">
                <div className="card-header">
                  <span className="text-xl"></span>
                  TOP BIDDERS
        </div>
                <div className="results-list">
                  {topBidders.length > 0 ? (
                    topBidders.map((bidder, idx) => (
                      <div key={idx} className={`result-item ${idx === 0 ? 'winner' : ''}`}>
                        <div className="result-rank">
                          {idx === 0 ? '' : `#${idx + 1}`}
              </div>
                        <div className="result-info">
                          <span className="result-name">{bidder.anonymous_name}</span>
                          <span className="result-amount">{formatCurrency(bidder.bid_amount)}</span>
              </div>
           </div>
                    ))
                  ) : (
                    <div className="no-bids">No bids placed</div>
                  )}
                </div>
              </div>
            ) : (
              /* Show anonymized activity during auction */
              <div className="activity-card">
                <div className="card-header">
                  <span className="pulse-dot" />
                  LIVE BIDS
                </div>
                <div className="activity-list">
                  {recentBids.length > 0 ? (
                    recentBids.map((bid, idx) => (
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
            )}
           </div>
          )}
        </div>
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

        .activity-card, .results-card {
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

        .activity-list, .results-list {
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

        .result-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }

        .result-item.winner {
          background: rgba(212, 175, 55, 0.1);
        }

        .result-rank {
          width: 40px;
          text-align: center;
          font-size: 1.25rem;
        }

        .result-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .result-name {
          font-weight: 600;
          color: white;
        }

        .result-amount {
          font-size: 0.875rem;
          color: var(--gold);
          font-weight: 700;
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

