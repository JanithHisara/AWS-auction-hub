'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Auction } from '@/types/database'
import { AuctionHammerIcon } from '@/components/brand/Logo'
import { getAuctionTypeLabel } from '@/lib/auction-types'

interface ItemBid {
  bid_amount: number
  created_at: string
  user: { anonymous_name: string } | null
}

interface MonitorItem {
  id: string
  name: string
  starting_price: number
  current_price: number
  status: string
  gem_images: { image_url: string }[]
  bids: ItemBid[]
  bidCount: number
  bidderCount: number
  highestBid: number
}

interface MonitorAuction extends Auction {
  items: MonitorItem[]
  registeredCount: number
}

interface Props {
  auction: MonitorAuction
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

export default function AuctionMonitorClient({ auction: initialAuction }: Props) {
  const [auction, setAuction] = useState(initialAuction)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [recentBids, setRecentBids] = useState<{ item: string; amount: number; bidder: string; time: string }[]>([])
  const [flashItem, setFlashItem] = useState<string | null>(null)
  const tickerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const hasItems = auction.items.length > 0
  const totalBids = auction.items.reduce((sum, item) => sum + item.bidCount, 0)
  const totalValue = auction.items.reduce((sum, item) => sum + item.highestBid, 0)
  const activeItems = auction.items.filter(i => i.status === 'active').length
  const isProgressiveElimination = auction.auction_type === 'progressive_elimination_auction'

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Realtime bid updates
  useEffect(() => {
    const channel = supabase
      .channel(`auction-monitor-${auction.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids',
        },
        async (payload) => {
          const newBid = payload.new as { gem_id: string; bid_amount: number; user_id: string; created_at: string }
          
          // Check if this bid belongs to our auction items
          const item = auction.items.find(i => i.id === newBid.gem_id)
          if (!item) return

          // Get bidder name
          const { data: user } = await supabase
            .from('users')
            .select('anonymous_name, display_name')
            .eq('id', newBid.user_id)
            .single()

          // Add to recent bids ticker
          setRecentBids(prev => [
            {
              item: item.name,
              amount: newBid.bid_amount,
              bidder: user?.anonymous_name || 'Anonymous',
              time: formatTime(newBid.created_at),
            },
            ...prev.slice(0, 19),
          ])

          // Flash the item
          setFlashItem(item.id)
          setTimeout(() => setFlashItem(null), 1500)

          // Update item data
          setAuction(prev => ({
            ...prev,
            items: prev.items.map(i => {
              if (i.id === newBid.gem_id) {
                return {
                  ...i,
                  highestBid: Math.max(i.highestBid, newBid.bid_amount),
                  bidCount: i.bidCount + 1,
                }
              }
              return i
            }),
          }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [auction.id, auction.items, supabase])

  return (
    <div className="monitor-display min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Scanline effect */}
      <div className="scanline" />
      
      {/* Header Bar */}
      <header className="relative z-10 bg-gradient-to-r from-[#0f0f18] via-[#1a1a2e] to-[#0f0f18] border-b border-[var(--gold)]/30">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-8 py-3 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto">
            {/* Brand Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <AuctionHammerIcon className="w-8 h-8 sm:w-12 sm:h-12" />
              <div className="hidden sm:flex flex-col">
                <span className="text-xl font-black tracking-tight text-white leading-none">
                  Auxtion<span className="text-[var(--gold)]">Hub</span>
                </span>
                <span className="text-[8px] tracking-[0.12em] text-[var(--gold)]/60 uppercase">
                  Where Tech Meets Trust
                </span>
              </div>
            </div>
            <div className="h-6 sm:h-10 w-px bg-[var(--gold)]/30" />
            <div className="live-indicator">
              <span className="live-dot" />
              <span className="text-sm sm:text-xl font-bold tracking-wider">LIVE</span>
            </div>
            <div className="h-6 sm:h-8 w-px bg-[var(--gold)]/30 hidden sm:block" />
            <h1 className="text-lg sm:text-2xl font-black tracking-wide text-white truncate flex-1">
              {auction.name}
            </h1>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-8 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-left sm:text-right">
              <div className="text-[10px] sm:text-xs text-[var(--gold)]/60 uppercase tracking-widest">Type</div>
              <div className={`text-sm sm:text-lg font-bold ${
                auction.auction_type === 'progressive_elimination_auction'
                  ? 'text-purple-400'
                  : auction.auction_type === 'incremental_approval_auction'
                    ? 'text-red-400'
                    : 'text-emerald-400'
              }`}>
                {getAuctionTypeLabel(auction.auction_type, true)}
              </div>
            </div>
            <div className="monitor-clock">
              <div className="text-2xl sm:text-5xl font-mono font-bold tabular-nums text-[var(--gold)]">
                {currentTime.toLocaleTimeString('en-US', { hour12: false })}
              </div>
              <div className="text-[10px] sm:text-sm text-[var(--gold)]/60 text-center uppercase tracking-widest hidden sm:block">
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Ticker */}
      <div className="stats-bar bg-[#12121a] border-b border-[var(--gold)]/20 py-2 sm:py-4">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-8 flex items-center justify-between gap-2 overflow-x-auto">
          <StatBox icon="" label="REG" value={auction.registeredCount} />
          <div className="h-6 sm:h-8 w-px bg-[var(--gold)]/20 flex-shrink-0" />
          <StatBox icon="" label="ITEMS" value={`${activeItems}/${auction.items.length}`} />
          <div className="h-6 sm:h-8 w-px bg-[var(--gold)]/20 flex-shrink-0" />
          <StatBox icon="" label="BIDS" value={totalBids} highlight />
          <div className="h-6 sm:h-8 w-px bg-[var(--gold)]/20 flex-shrink-0" />
          <StatBox icon="" label="VALUE" value={formatCurrency(totalValue)} gold />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8">
        {/* Items Board - Airport Style */}
        <div className="lg:col-span-8">
          <div className="monitor-board">
            <div className="board-header">
              <div className="col-item">ITEM</div>
              <div className="col-starting">STARTING</div>
              <div className="col-current">CURRENT BID</div>
              <div className="col-bids">BIDS</div>
              <div className="col-status">STATUS</div>
            </div>
            
            <div className="board-body">
              {auction.items.map((item, idx) => (
                <div 
                  key={item.id} 
                  className={`board-row ${flashItem === item.id ? 'flash' : ''}`}
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  <div className="col-item">
                    <div className="item-thumb">
                      {item.gem_images?.[0]?.image_url ? (
                        <img src={item.gem_images[0].image_url} alt="" />
                      ) : (
                        <span></span>
                      )}
                    </div>
                    <span className="item-name">{item.name}</span>
                  </div>
                  <div className="col-starting">
                    <span className="price-dim">{formatCurrency(item.starting_price)}</span>
                  </div>
                  <div className="col-current">
                    <span className={`price-current ${flashItem === item.id ? 'price-flash' : ''}`}>
                      {formatCurrency(item.highestBid)}
                    </span>
                    {item.highestBid > item.starting_price && item.starting_price > 0 && (
                      <span className="price-change">
                        +{Math.round(((item.highestBid - item.starting_price) / item.starting_price) * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="col-bids">
                    <span className="bid-count">{item.bidCount}</span>
                  </div>
                  <div className="col-status">
                    <span className={`status-badge ${item.status}`}>
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-4 space-y-4 sm:space-y-6">
          {/* Top Bid */}
          <div className="highlight-card">
            <div className="highlight-label">HIGHEST BID</div>
            <div className="highlight-value animate-glow">
              {hasItems ? formatCurrency(Math.max(...auction.items.map(i => i.highestBid))) : formatCurrency(0)}
            </div>
            <div className="highlight-item">
              {hasItems
                ? auction.items.reduce((max, item) => item.highestBid > max.highestBid ? item : max, auction.items[0])?.name
                : 'No items yet'}
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="activity-feed">
            <div className="feed-header">
              <span className="pulse-dot" />
              LIVE ACTIVITY
            </div>
            <div className="feed-list" ref={tickerRef}>
              {recentBids.length > 0 ? (
                recentBids.map((bid, idx) => (
                  <div key={idx} className="feed-item" style={{ animationDelay: `${idx * 0.05}s` }}>
                    <div className="feed-amount">{formatCurrency(bid.amount)}</div>
                    <div className="feed-details">
                      <span className="feed-item-name">{bid.item}</span>
                      <span className="feed-bidder">{bid.bidder}</span>
                    </div>
                    <div className="feed-time">{bid.time}</div>
                  </div>
                ))
              ) : (
                <div className="feed-empty">
                  <span className="text-4xl mb-2"></span>
                  <span>Waiting for bids...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Ticker */}
      <div className="bottom-ticker">
        <div className="ticker-content">
          {auction.items.map((item, idx) => (
            <span key={item.id} className="ticker-item">
              <span className="ticker-name">{item.name}</span>
              <span className="ticker-price">{formatCurrency(item.highestBid)}</span>
              {item.highestBid > item.starting_price && item.starting_price > 0 && (
                <span className="ticker-up"> +{Math.round(((item.highestBid - item.starting_price) / item.starting_price) * 100)}%</span>
              )}
              {idx < auction.items.length - 1 && <span className="ticker-sep"></span>}
            </span>
          ))}
          {/* Duplicate for seamless loop */}
          {auction.items.map((item, idx) => (
            <span key={`dup-${item.id}`} className="ticker-item">
              <span className="ticker-name">{item.name}</span>
              <span className="ticker-price">{formatCurrency(item.highestBid)}</span>
              {item.highestBid > item.starting_price && item.starting_price > 0 && (
                <span className="ticker-up"> +{Math.round(((item.highestBid - item.starting_price) / item.starting_price) * 100)}%</span>
              )}
              {idx < auction.items.length - 1 && <span className="ticker-sep"></span>}
            </span>
          ))}
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
          padding: 1rem 1.5rem;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid var(--gold);
          border-radius: 0.75rem;
        }

        .monitor-board {
          background: linear-gradient(180deg, #12121a 0%, #0a0a0f 100%);
          border: 1px solid var(--gold);
          border-radius: 1rem;
          overflow: hidden;
          box-shadow: 0 0 60px rgba(212, 175, 55, 0.1);
        }

        .board-header {
          display: none;
          grid-template-columns: 2fr 1fr 1.5fr 0.75fr 1fr;
          gap: 1rem;
          padding: 1rem 1.5rem;
          background: rgba(212, 175, 55, 0.1);
          border-bottom: 2px solid var(--gold);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--gold);
        }

        @media (min-width: 768px) {
          .board-header {
            display: grid;
          }
        }

        .board-body {
          max-height: 60vh;
          overflow-y: auto;
        }

        .board-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          padding: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          animation: slideIn 0.5s ease-out forwards;
          opacity: 0;
          transform: translateX(-20px);
          transition: background 0.3s;
        }

        @media (min-width: 768px) {
          .board-row {
            display: grid;
            grid-template-columns: 2fr 1fr 1.5fr 0.75fr 1fr;
            gap: 1rem;
            padding: 1rem 1.5rem;
          }
        }

        .board-row:hover {
          background: rgba(212, 175, 55, 0.05);
        }

        .board-row.flash {
          animation: rowFlash 1.5s ease-out;
        }

        @keyframes slideIn {
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes rowFlash {
          0%, 100% { background: transparent; }
          25%, 75% { background: rgba(212, 175, 55, 0.2); }
        }

        .col-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
        }

        @media (min-width: 768px) {
          .col-item {
            gap: 1rem;
            width: auto;
          }
        }

        .item-thumb {
          width: 40px;
          height: 40px;
          border-radius: 0.5rem;
          overflow: hidden;
          background: #1a1a2e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        @media (min-width: 768px) {
          .item-thumb {
            width: 48px;
            height: 48px;
            font-size: 1.5rem;
          }
        }

        .item-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .item-name {
          font-weight: 600;
          font-size: 1rem;
          color: white;
        }

        .col-starting {
          display: none;
        }

        .col-current, .col-bids, .col-status {
          display: flex;
          align-items: center;
        }

        @media (min-width: 768px) {
          .col-starting {
            display: flex;
            align-items: center;
          }
        }

        .price-dim {
          color: #6b7280;
          font-size: 1rem;
        }

        .price-current {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--gold);
          transition: all 0.3s;
        }

        .price-current.price-flash {
          animation: priceFlash 1s ease-out;
        }

        @keyframes priceFlash {
          0%, 100% { color: var(--gold); transform: scale(1); }
          50% { color: #10b981; transform: scale(1.1); }
        }

        .price-change {
          margin-left: 0.75rem;
          font-size: 0.875rem;
          color: #10b981;
          font-weight: 600;
        }

        .bid-count {
          font-size: 1.25rem;
          font-weight: 700;
          color: white;
          background: rgba(255, 255, 255, 0.1);
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
        }

        .status-badge {
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .status-badge.active {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.4);
        }

        .status-badge.draft {
          background: rgba(107, 114, 128, 0.2);
          color: #9ca3af;
          border: 1px solid rgba(107, 114, 128, 0.4);
        }

        .status-badge.ended {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.4);
        }

        .highlight-card {
          background: linear-gradient(135deg, #1a1a2e 0%, #0f0f18 100%);
          border: 2px solid var(--gold);
          border-radius: 1rem;
          padding: 2rem;
          text-align: center;
          box-shadow: 0 0 40px rgba(212, 175, 55, 0.15);
        }

        .highlight-label {
          font-size: 0.875rem;
          letter-spacing: 0.2em;
          color: var(--gold);
          opacity: 0.7;
          margin-bottom: 1rem;
        }

        .highlight-value {
          font-size: 2rem;
          font-weight: 800;
          color: var(--gold);
          text-shadow: 0 0 40px rgba(212, 175, 55, 0.5);
        }

        @media (min-width: 768px) {
          .highlight-value {
            font-size: 3rem;
          }
        }

        .animate-glow {
          animation: glow 2s ease-in-out infinite alternate;
        }

        @keyframes glow {
          from { text-shadow: 0 0 20px rgba(212, 175, 55, 0.3); }
          to { text-shadow: 0 0 40px rgba(212, 175, 55, 0.7); }
        }

        .highlight-item {
          margin-top: 0.75rem;
          font-size: 0.875rem;
          color: #9ca3af;
        }

        .activity-feed {
          background: linear-gradient(180deg, #12121a 0%, #0a0a0f 100%);
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 1rem;
          overflow: hidden;
        }

        .feed-header {
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

        .feed-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .feed-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.875rem 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          animation: fadeSlideIn 0.3s ease-out forwards;
          opacity: 0;
        }

        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .feed-amount {
          font-size: 1rem;
          font-weight: 700;
          color: var(--gold);
          min-width: 100px;
        }

        .feed-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .feed-item-name {
          font-size: 0.875rem;
          color: white;
          font-weight: 500;
        }

        .feed-bidder {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .feed-time {
          font-size: 0.75rem;
          color: #4b5563;
        }

        .feed-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          color: #4b5563;
          font-size: 0.875rem;
        }

        .bottom-ticker {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(90deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%);
          border-top: 1px solid var(--gold);
          padding: 1rem 0;
          overflow: hidden;
        }

        .ticker-content {
          display: flex;
          gap: 3rem;
          animation: ticker 30s linear infinite;
          white-space: nowrap;
        }

        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .ticker-name {
          font-weight: 600;
          color: white;
        }

        .ticker-price {
          font-weight: 700;
          color: var(--gold);
        }

        .ticker-up {
          font-size: 0.75rem;
          color: #10b981;
          font-weight: 600;
        }

        .ticker-sep {
          color: #4b5563;
          margin: 0 0.5rem;
        }
      `}</style>
    </div>
  )
}

function StatBox({ icon, label, value, highlight = false, gold = false }: { 
  icon: string
  label: string
  value: string | number
  highlight?: boolean
  gold?: boolean
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
      <span className="text-xl sm:text-3xl">{icon}</span>
      <div>
        <div className="text-[10px] sm:text-xs text-[var(--gold)]/60 uppercase tracking-widest">{label}</div>
        <div className={`text-lg sm:text-2xl font-bold tabular-nums ${gold ? 'text-[var(--gold)]' : highlight ? 'text-emerald-400' : 'text-white'}`}>
          {value}
        </div>
      </div>
    </div>
  )
}



