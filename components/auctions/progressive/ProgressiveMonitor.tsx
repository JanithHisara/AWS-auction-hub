'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Auction } from '@/types/database'
import { AuctionHammerIcon } from '@/components/brand/Logo'
import { getAuctionTypeLabel } from '@/lib/auction-types'
import { Clock, Trophy, Flame, UserCheck, UserX, ChevronRight, Gem as GemIcon } from 'lucide-react'

interface ItemBid {
  id?: string
  bid_amount: number
  created_at: string
  user: { anonymous_name?: string; display_name?: string } | null
}

interface MonitorItem {
  id: string
  name: string
  description?: string | null
  starting_price: number
  current_price: number
  min_bid_increment: number
  status: string
  carat_weight?: number | null
  cut?: string | null
  color?: string | null
  provenance?: string | null
  start_time?: string | null
  end_time?: string | null
  round_end_time?: string | null
  gem_images: { image_url: string; media_type?: string; display_order?: number }[]
  bids: ItemBid[]
  bidCount: number
  bidderCount: number
  eliminatedCount?: number
  highestBid: number
  winner?: {
    winning_amount: number
    user?: { anonymous_name?: string; display_name?: string } | null
  } | null
}

interface MonitorAuction extends Auction {
  items: MonitorItem[]
  registeredCount: number
}

interface Props {
  auction: MonitorAuction
}

function formatCountdown(totalSeconds: number | null) {
  if (totalSeconds === null || isNaN(totalSeconds) || totalSeconds < 0) return '00:00'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return 'Rs. 0'
  const val = Number(amount)
  if (val >= 1_000_000_000) {
    return 'LKR ' + (val / 1_000_000_000).toFixed(2).replace(/\.00$/, '') + 'B'
  } else if (val >= 1_000_000) {
    return 'LKR ' + (val / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M'
  } else if (val >= 1_000) {
    return 'LKR ' + (val / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  } else {
    return 'LKR ' + val.toLocaleString('en-US')
  }
}

export default function ProgressiveMonitor({ auction: initialAuction }: Props) {
  const [auction, setAuction] = useState(initialAuction)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [mounted, setMounted] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [recentBids, setRecentBids] = useState<{ id: string; amount: number; bidder: string; time: string }[]>([])
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

  // Find currently active item
  const activeItem = useMemo(() => {
    return auction.items.find(i => i.status === 'active') || null
  }, [auction.items])

  // Spotlit item: user selected or active item or first item
  const spotlitItem = useMemo(() => {
    if (selectedItemId) {
      const found = auction.items.find(i => i.id === selectedItemId)
      if (found) return found
    }
    return activeItem || auction.items[0] || null
  }, [selectedItemId, activeItem, auction.items])

  // Clock ticker
  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-spotlight active item when active item changes
  useEffect(() => {
    if (activeItem) {
      setSelectedItemId(activeItem.id)
    }
  }, [activeItem?.id])

  // Force-stop when someone bids the current price in progressive elimination
  const isForceStopped = useMemo(() => {
    if (!spotlitItem) return false
    // If no bids placed yet, cannot be force stopped
    if (!spotlitItem.bidCount || spotlitItem.bidCount === 0) return false
    if (!spotlitItem.bids || spotlitItem.bids.length === 0) return false

    const targetPrice = spotlitItem.current_price || spotlitItem.starting_price
    const hasActualBidAtPrice = (spotlitItem.bids || []).some(b => Number(b.bid_amount) >= Number(targetPrice))
    return hasActualBidAtPrice
  }, [spotlitItem])

  // Countdown timer for active item round
  useEffect(() => {
    if (!spotlitItem?.round_end_time || spotlitItem.status !== 'active') {
      setTimeRemaining(null)
      return
    }

    const updateTimer = () => {
      if (isForceStopped) {
        setTimeRemaining(0)
        return
      }
      const end = new Date(spotlitItem.round_end_time!).getTime()
      const now = Date.now()
      const diff = Math.max(0, Math.floor((end - now) / 1000))
      setTimeRemaining(diff)
    }

    updateTimer()
    const timer = setInterval(updateTimer, 500)
    return () => clearInterval(timer)
  }, [spotlitItem?.round_end_time, spotlitItem?.status, isForceStopped])

  // Calculate round number
  const roundNumber = useMemo(() => {
    if (!spotlitItem) return 1
    const start = spotlitItem.starting_price || 0
    const current = spotlitItem.current_price || spotlitItem.highestBid || start
    const inc = spotlitItem.min_bid_increment || 1
    if (current <= start) return 1
    return Math.max(1, Math.floor((current - start) / inc) + 1)
  }, [spotlitItem?.current_price, spotlitItem?.highestBid, spotlitItem?.starting_price, spotlitItem?.min_bid_increment])

  const isRefreshingRef = useRef(false)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Refresh data from API with debouncing and in-flight guard
  const scheduleRefresh = (delay = 250) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }
    refreshTimeoutRef.current = setTimeout(() => {
      refreshData()
    }, delay)
  }

  const refreshData = async () => {
    if (isRefreshingRef.current) return
    isRefreshingRef.current = true
    try {
      const res = await fetch(`/api/auctions/progressive/${auction.id}/current-item?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.auction) {
          const freshCurrent = data.currentItem
          setAuction(prev => ({
            ...prev,
            status: data.auction.status || prev.status,
            registeredCount: data.registeredCount ?? prev.registeredCount,
            items: prev.items.map(i => {
              if (freshCurrent && i.id === freshCurrent.id) {
                return {
                  ...i,
                  status: freshCurrent.status,
                  current_price: freshCurrent.current_price ?? i.current_price,
                  highestBid: freshCurrent.highestBid ?? i.highestBid,
                  bidCount: freshCurrent.bidCount ?? i.bidCount,
                  round_end_time: freshCurrent.round_end_time !== undefined ? freshCurrent.round_end_time : i.round_end_time,
                  eliminatedCount: freshCurrent.eliminatedCount ?? i.eliminatedCount,
                  bids: freshCurrent.recentBids?.length
                    ? freshCurrent.recentBids.map((b: any) => ({
                        id: b.id,
                        bid_amount: Number(b.bid_amount),
                        created_at: b.created_at,
                        user: { display_name: b.bidder || 'Qualified Participant' },
                      }))
                    : i.bids,
                }
              }
              const freshFromList = data.allItems?.find((ci: any) => ci.id === i.id)
              if (freshFromList) {
                return {
                  ...i,
                  status: freshFromList.status,
                  current_price: freshFromList.current_price ?? i.current_price,
                  round_end_time: freshFromList.round_end_time !== undefined ? freshFromList.round_end_time : i.round_end_time,
                }
              }
              return i
            })
          }))
        }
      }
    } catch (e) {
      // background poll error ignored
    } finally {
      isRefreshingRef.current = false
    }
  }

  // Real-time Supabase subscription
  useEffect(() => {
    const supabase = createClient()
    if (!supabase?.channel) return
    const channel = supabase
      .channel(`auction-monitor-${auction.id}`)
      .on('broadcast', { event: '*' }, (payload: any) => {
        const { event, data } = payload.payload || payload
        if (event === 'round_start' || event === 'price_increment' || event === 'winner_selected' || event === 'elimination') {
          scheduleRefresh(150)
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gems', filter: `auction_id=eq.${auction.id}` },
        () => scheduleRefresh(200)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids' },
        (payload) => {
          const newBid = payload.new as any
          setRecentBids(prev => [
            {
              id: newBid.id,
              amount: Number(newBid.bid_amount),
              bidder: 'Qualified Participant',
              time: new Date().toLocaleTimeString('en-US', { hour12: false })
            },
            ...prev.slice(0, 15)
          ])
          scheduleRefresh(200)
        }
      )
      .subscribe()

    // Sync once if user returns to this tab from background
    const handleFocus = () => scheduleRefresh(50)
    window.addEventListener('focus', handleFocus)

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      supabase?.removeChannel?.(channel)
      window.removeEventListener('focus', handleFocus)
    }
  }, [auction.id])

  const activeLotsCount = auction.items.filter(i => i.status === 'active').length
  const soldLotsCount = auction.items.filter(i => ['completed', 'ended', 'sold'].includes(i.status)).length
  const totalBidsCount = auction.items.reduce((acc, item) => acc + (item.bidCount || 0), 0)
  const totalAuctionValue = auction.items.reduce((acc, item) => acc + (item.highestBid || item.starting_price || 0), 0)

  return (
    <div className="min-h-screen bg-[#07070b] text-white flex flex-col font-sans select-none overflow-x-hidden">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <header className="relative z-10 bg-[#0f0f18]/90 backdrop-blur-md border-b border-[var(--gold)]/20 px-6 py-3">
        <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <AuctionHammerIcon className="w-10 h-10 text-[var(--gold)]" />
              <div>
                <span className="text-xl font-black tracking-tight text-white">
                  Auxtion<span className="text-[var(--gold)]">Hub</span>
                </span>
                <span className="block text-[9px] tracking-[0.2em] text-[var(--gold)]/70 uppercase font-semibold">
                  Live Stage Monitor
                </span>
              </div>
            </div>

            <div className="h-8 w-px bg-white/10 hidden sm:block" />

            <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
              <span className="text-xs font-black text-purple-400 tracking-wider uppercase">LIVE ELIMINATION</span>
            </div>

            <h1 className="text-lg md:text-xl font-bold text-white truncate max-w-md hidden lg:block">
              {auction.name}
            </h1>
          </div>

          <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-[var(--gold)]/70 uppercase tracking-widest font-semibold">Format</div>
              <div className="text-sm font-bold text-purple-400">
                {getAuctionTypeLabel(auction.auction_type, true)}
              </div>
            </div>

            <div className="h-8 w-px bg-white/10 hidden sm:block" />

            {/* Synchronized Wall Clock */}
            <div className="text-right" suppressHydrationWarning>
              <div
                suppressHydrationWarning
                className="text-2xl sm:text-3xl font-mono font-black tabular-nums text-[var(--gold)] drop-shadow-[0_0_12px_rgba(212,175,55,0.3)]"
              >
                {mounted ? currentTime.toLocaleTimeString('en-US', { hour12: false }) : '--:--:--'}
              </div>
              <div
                suppressHydrationWarning
                className="text-[10px] text-white/50 tracking-widest uppercase font-mono"
              >
                {mounted ? currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Key Metrics Bar ──────────────────────────────────────── */}
      <div className="bg-[#0b0b12] border-b border-white/5 px-6 py-2.5">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4 overflow-x-auto text-xs">
          <div className="flex items-center gap-2">
            <span className="text-white/40 uppercase tracking-wider font-semibold">Active Lots:</span>
            <span className="font-bold text-emerald-400 font-mono">
              {activeLotsCount} / {auction.items.length}
            </span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-white/40 uppercase tracking-wider font-semibold">Completed:</span>
            <span className="font-bold text-white font-mono">{soldLotsCount}</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-white/40 uppercase tracking-wider font-semibold">Registered:</span>
            <span className="font-bold text-purple-400 font-mono">{auction.registeredCount || 0}</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-white/40 uppercase tracking-wider font-semibold">Total Tenders/Bids:</span>
            <span className="font-bold text-[var(--gold)] font-mono">{totalBidsCount}</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-white/40 uppercase tracking-wider font-semibold">Auction Volume:</span>
            <span className="font-bold text-[var(--gold)] font-mono">{formatCurrency(totalAuctionValue)}</span>
          </div>
        </div>
      </div>

      {/* ── Main Arena: Dual Panel Layout ────────────────────────── */}
      <div className="flex-1 max-w-[1920px] w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── LEFT PANEL: All Lots Queue & Activity Stream (4 Cols) ─── */}
        <aside className="lg:col-span-4 flex flex-col gap-6 order-2 lg:order-1">
          {/* Lots Card */}
          <div className="bg-[#11111a] border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-xl">
            <div className="p-4 bg-[#151522] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GemIcon className="w-5 h-5 text-purple-400" />
                <h2 className="text-sm font-black tracking-widest uppercase text-white">
                  Auction Lots ({auction.items.length})
                </h2>
              </div>
              <span className="text-[11px] text-purple-300 font-mono font-bold bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                {activeItem ? 'Live Stage Ongoing' : 'Waiting for Stage'}
              </span>
            </div>

            <div className="overflow-y-auto divide-y divide-white/5 p-2 space-y-2 max-h-[380px] sm:max-h-[430px]">
              {auction.items.map((item, idx) => {
                const isSelected = spotlitItem?.id === item.id
                const isActive = item.status === 'active'
                const isSold = ['completed', 'ended', 'sold'].includes(item.status)

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all duration-300 relative flex items-center gap-3.5 ${isActive
                        ? 'bg-gradient-to-r from-purple-500/20 via-[#1a1a2e] to-transparent border-2 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                        : isSelected
                          ? 'bg-white/10 border border-white/20'
                          : 'hover:bg-white/5 border border-transparent opacity-85'
                      }`}
                  >
                    {/* Lot Index */}
                    <div className="text-[11px] font-mono font-bold text-white/50 w-6 flex-shrink-0">
                      #{String(idx + 1).padStart(2, '0')}
                    </div>

                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex-shrink-0 relative">
                      {item.gem_images?.[0]?.image_url ? (
                        <img
                          src={item.gem_images[0].image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">
                          <GemIcon className="w-6 h-6" />
                        </div>
                      )}
                      {isActive && (
                        <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
                      )}
                    </div>

                    {/* Lot Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-sm text-white truncate">{item.name}</h3>
                        {isActive && (
                          <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-purple-600 text-white rounded-full animate-pulse">
                            LIVE
                          </span>
                        )}
                        {isSold && (
                          <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                            SOLD
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[var(--gold)] font-bold">
                          {formatCurrency(item.highestBid || item.current_price || item.starting_price)}
                        </span>
                        <span className="text-white/40 text-[11px]">
                          {item.bidCount || 0} bids
                        </span>
                      </div>

                      {isSold && item.winner && (
                        <p className="text-[10px] text-emerald-400/90 truncate mt-0.5 font-medium">
                          Won by {item.winner.user?.display_name || item.winner.user?.anonymous_name || 'Anonymous'}
                        </p>
                      )}
                    </div>

                    <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${isSelected ? 'translate-x-1 text-purple-400' : ''}`} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Live Activity Stream (Below the lots on the left side) */}
          <div className="bg-[#11111a] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
                <h3 className="text-xs font-black tracking-widest text-white uppercase">
                  Live Elimination Activity
                </h3>
              </div>
              <span className="text-[10px] text-white/40 font-mono">
                Real-time Sync
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1">
              {spotlitItem?.bids && spotlitItem.bids.length > 0 ? (
                spotlitItem.bids.slice(0, 10).map((bid, i) => (
                  <div
                    key={bid.id || i}
                    className="bg-[#161624] border border-white/5 p-2.5 sm:p-3 rounded-xl flex items-center justify-between gap-3 hover:border-purple-500/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white font-mono truncate">
                        {bid.user?.display_name || bid.user?.anonymous_name || 'Qualified Participant'}
                      </div>
                      <div className="text-[10px] text-white/40 font-mono" suppressHydrationWarning>
                        {mounted ? new Date(bid.created_at).toLocaleTimeString('en-US', { hour12: false }) : ''}
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-[var(--gold)] font-mono whitespace-nowrap">
                      {formatCurrency(bid.bid_amount)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-white/30 text-xs">
                  No bids submitted yet for this lot.
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ── RIGHT PANEL: Main Active Stage Spotlight (8 Cols) ─── */}
        <main className="lg:col-span-8 order-1 lg:order-2">
          {spotlitItem ? (
            <div className="bg-gradient-to-b from-[#151522] to-[#0d0d15] border border-purple-500/30 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl relative overflow-hidden">
              {/* Purple ambient light */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-center">

                {/* Left: Gem Visual */}
                <div className="md:col-span-5 flex flex-col items-center">
                  <div className="w-full aspect-square max-w-[420px] rounded-3xl overflow-hidden bg-black/60 border border-purple-500/20 relative shadow-inner group">
                    {spotlitItem.gem_images?.[activeImageIndex]?.image_url ? (
                      <img
                        src={spotlitItem.gem_images[activeImageIndex].image_url}
                        alt={spotlitItem.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20">
                        <GemIcon className="w-20 h-20 text-purple-400/30" />
                      </div>
                    )}

                    {/* Live Badge Overlay */}
                    {spotlitItem.status === 'active' && (
                      <div className="absolute top-3 left-3 bg-purple-600/90 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-2 border border-purple-400/30">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        <span className="text-[10px] font-black tracking-widest text-white uppercase">
                          CURRENT LOT
                        </span>
                      </div>
                    )}

                    {/* Image dots */}
                    {spotlitItem.gem_images?.length > 1 && (
                      <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                        {spotlitItem.gem_images.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveImageIndex(i)}
                            className={`w-2.5 h-2.5 rounded-full transition-all ${activeImageIndex === i ? 'bg-purple-400 w-6' : 'bg-white/40'
                              }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Specs Row */}
                  <div className="grid grid-cols-3 gap-2 w-full max-w-[420px] mt-4 text-center">
                    {spotlitItem.carat_weight && (
                      <div className="bg-white/5 border border-white/5 rounded-xl py-2 px-2">
                        <span className="text-[9px] text-white/40 uppercase block">Weight</span>
                        <span className="text-xs font-bold text-white font-mono">{spotlitItem.carat_weight} ct</span>
                      </div>
                    )}
                    {spotlitItem.color && (
                      <div className="bg-white/5 border border-white/5 rounded-xl py-2 px-2">
                        <span className="text-[9px] text-white/40 uppercase block">Color</span>
                        <span className="text-xs font-bold text-white font-mono">{spotlitItem.color}</span>
                      </div>
                    )}
                    {spotlitItem.cut && (
                      <div className="bg-white/5 border border-white/5 rounded-xl py-2 px-2">
                        <span className="text-[9px] text-white/40 uppercase block">Cut</span>
                        <span className="text-xs font-bold text-white font-mono">{spotlitItem.cut}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Round Engine & Price Control */}
                <div className="md:col-span-7 space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono font-bold text-purple-400 uppercase tracking-wider">
                        Lot Specifications
                      </span>
                      {spotlitItem.provenance && (
                        <span className="text-xs bg-white/10 px-2.5 py-0.5 rounded text-white/70">
                          {spotlitItem.provenance}
                        </span>
                      )}
                    </div>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
                      {spotlitItem.name}
                    </h2>
                  </div>

                  {/* Current Round & Timer Block - BIGGER COUNTDOWN */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#0a0a10]/90 border border-purple-500/30 rounded-3xl p-5 sm:p-6 shadow-inner">
                    {/* Round Number */}
                    <div className="flex flex-col justify-center">
                      <div className="text-[11px] uppercase tracking-widest text-white/50 font-bold mb-1.5 flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-purple-400 animate-pulse" />
                        Elimination Round
                      </div>
                      <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                        STAGE {roundNumber}
                      </div>
                      <div className="text-xs text-[var(--gold)] font-medium mt-1">
                        Step increment: +{formatCurrency(spotlitItem.min_bid_increment)}
                      </div>
                    </div>

                    {/* Timer Display - BIGGER COUNT DOWN */}
                    <div className="text-left sm:text-right flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-4">
                      <div className="text-[11px] uppercase tracking-widest text-white/50 font-bold mb-1 flex items-center sm:justify-end gap-1.5">
                        <Clock className="w-4 h-4 text-purple-400" /> Stage Timer
                      </div>
                      {timeRemaining !== null ? (
                        <div
                          className={`text-4xl sm:text-5xl lg:text-6xl font-mono font-black tabular-nums tracking-wider ${
                            isForceStopped || timeRemaining <= 0
                              ? 'text-amber-400'
                              : timeRemaining <= 10
                                ? 'text-red-500 animate-pulse'
                                : 'text-emerald-400'
                          }`}
                        >
                          {formatCountdown(timeRemaining)}
                        </div>
                      ) : (
                        <div className="text-xl sm:text-2xl font-bold text-white/40 font-mono py-2">
                          {spotlitItem.status === 'active' ? 'Untimed Stage' : 'Round Concluded'}
                        </div>
                      )}
                      <span className="text-xs text-white/50 font-medium mt-1">
                        {isForceStopped
                          ? 'Bid placed - Stage concluded'
                          : timeRemaining !== null && timeRemaining <= 0
                            ? 'Time expired - Stage concluded'
                            : spotlitItem.status === 'active' && timeRemaining !== null
                              ? 'Live countdown active'
                              : 'Awaiting next action'}
                      </span>
                    </div>
                  </div>

                  {/* Giant Price Box */}
                  <div className="bg-gradient-to-r from-purple-500/10 via-[var(--gold)]/5 to-transparent border border-purple-500/40 rounded-3xl p-6 sm:p-7 shadow-lg">
                    <div className="text-xs font-bold text-purple-300 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                      <span>Current Qualifying Price</span>
                      {spotlitItem.highestBid > spotlitItem.starting_price && (
                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
                          +{Math.round(((spotlitItem.highestBid - spotlitItem.starting_price) / spotlitItem.starting_price) * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="text-4xl sm:text-6xl lg:text-7xl font-black text-[var(--gold)] font-mono tracking-tight drop-shadow-[0_0_25px_rgba(212,175,55,0.45)]">
                      {formatCurrency(spotlitItem.current_price || spotlitItem.highestBid || spotlitItem.starting_price)}
                    </div>
                    <div className="text-xs sm:text-sm text-white/50 mt-1.5 font-mono">
                      Base starting price: {formatCurrency(spotlitItem.starting_price)}
                    </div>
                  </div>

                  {/* Participant / Elimination Gauges */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                      <div className="flex items-center gap-1.5 text-xs text-white/50 mb-1">
                        <UserCheck className="w-4 h-4 text-emerald-400" />
                        <span>Qualified</span>
                      </div>
                      <div className="text-2xl font-bold font-mono text-emerald-400">
                        {Math.max(0, (auction.registeredCount || 0) - (spotlitItem.eliminatedCount || 0))}
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                      <div className="flex items-center gap-1.5 text-xs text-white/50 mb-1">
                        <UserX className="w-4 h-4 text-red-400" />
                        <span>Eliminated</span>
                      </div>
                      <div className="text-2xl font-bold font-mono text-red-400">
                        {spotlitItem.eliminatedCount || 0}
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                      <div className="flex items-center gap-1.5 text-xs text-white/50 mb-1">
                        <Trophy className="w-4 h-4 text-[var(--gold)]" />
                        <span>Total Bids</span>
                      </div>
                      <div className="text-2xl font-bold font-mono text-white">
                        {spotlitItem.bidCount || 0}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-white/40 bg-[#11111a] rounded-2xl border border-white/10">
              <GemIcon className="w-12 h-12 mx-auto mb-3 text-white/20" />
              <p className="text-base font-bold">No items available in this auction</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
