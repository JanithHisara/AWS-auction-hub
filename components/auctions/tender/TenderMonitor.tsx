'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Auction } from '@/types/database'
import { AuctionHammerIcon } from '@/components/brand/Logo'
import { getAuctionTypeLabel } from '@/lib/auction-types'
import {
  Lock,
  Unlock,
  Trophy,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Gem as GemIcon,
  CheckCircle2,
  Clock,
  Eye,
  ShieldCheck,
  Award
} from 'lucide-react'

interface MonitorWinner {
  id: string
  winning_amount: number
  selected_at?: string
  user?: {
    id?: string
    display_name?: string | null
    anonymous_name?: string | null
    email?: string | null
  } | null
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
  gem_images: { image_url: string; media_type?: string; display_order?: number }[]
  bidCount: number
  bidderCount: number
  winner?: MonitorWinner | null
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

export default function TenderMonitor({ auction: initialAuction }: Props) {
  const [auction, setAuction] = useState(initialAuction)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [mounted, setMounted] = useState(false)
  const [currentLotIndex, setCurrentLotIndex] = useState(0)
  const [revealedLotIds, setRevealedLotIds] = useState<Set<string>>(new Set())
  const [revealState, setRevealState] = useState<'presenting' | 'suspense' | 'revealed'>('presenting')
  const [suspenseCount, setSuspenseCount] = useState(3)
  const [autoPlay, setAutoPlay] = useState(false)
  const [showPodium, setShowPodium] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  // Determine if bidding is closed / reveal ceremony is active
  const isBiddingClosed = useMemo(() => {
    if (['registration_closed', 'ended', 'completed'].includes(auction.status)) return true
    if (auction.auction_end && new Date() >= new Date(auction.auction_end)) return true
    return false
  }, [auction.status, auction.auction_end])

  // Current spotlight item
  const currentItem = auction.items[currentLotIndex] || auction.items[0] || null

  // Clock ticker
  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-initially reveal items that already have an official winner in the database
  useEffect(() => {
    const alreadyRevealed = new Set<string>()
    auction.items.forEach(item => {
      if ((item as any).hasOfficialWinner || (item.status === 'completed' && item.winner)) {
        alreadyRevealed.add(item.id)
      }
    })
    setRevealedLotIds(alreadyRevealed)
  }, [auction.items])

  // When switching current item, set appropriate revealState
  useEffect(() => {
    setActiveImageIndex(0)
    if (!currentItem) return
    if (revealedLotIds.has(currentItem.id)) {
      setRevealState('revealed')
    } else {
      setRevealState('presenting')
    }
  }, [currentLotIndex, currentItem?.id, revealedLotIds])

  const revealIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Trigger suspense sequence for a specific item (or current item)
  const triggerWinnerReveal = (gemId: string, winnerPayload?: any, forceReplay = false) => {
    // Switch to target item lot index if not currently on it
    const targetIdx = auction.items.findIndex(i => i.id === gemId)
    if (targetIdx !== -1 && targetIdx !== currentLotIndex) {
      setCurrentLotIndex(targetIdx)
    }

    // Update item winner state if data provided
    if (winnerPayload?.winning_amount) {
      setAuction(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === gemId ? {
          ...i,
          hasOfficialWinner: true,
          status: 'completed',
          winner: {
            id: winnerPayload.id || i.winner?.id || '',
            winning_amount: Number(winnerPayload.winning_amount),
            selected_at: winnerPayload.selected_at || new Date().toISOString(),
            user: {
              id: winnerPayload.user?.id || winnerPayload.user_id,
              display_name: winnerPayload.winner_name || winnerPayload.user?.display_name || i.winner?.user?.display_name || 'Verified Winner',
              anonymous_name: winnerPayload.user?.anonymous_name || i.winner?.user?.anonymous_name || null,
            }
          },
          highestBid: Number(winnerPayload.winning_amount)
        } : i)
      }))
    }

    // If already revealed and not a forced replay, remain in revealed state
    if (revealedLotIds.has(gemId) && !forceReplay) {
      setRevealState('revealed')
      return
    }

    // Begin 3-second suspense animation (3... 2... 1... UNSEALED)
    if (revealIntervalRef.current) clearInterval(revealIntervalRef.current)
    setRevealState('suspense')
    setSuspenseCount(3)

    let count = 3
    revealIntervalRef.current = setInterval(() => {
      count--
      if (count <= 0) {
        if (revealIntervalRef.current) clearInterval(revealIntervalRef.current)
        revealIntervalRef.current = null
        setRevealedLotIds(prev => new Set([...prev, gemId]))
        setRevealState('revealed')
      } else {
        setSuspenseCount(count)
      }
    }, 900)
  }

  const startReveal = () => {
    if (!currentItem) return
    triggerWinnerReveal(currentItem.id, currentItem.winner, true)
  }

  const isRefreshingRef = useRef(false)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Refresh auction data from API with debouncing and in-flight guard
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
      const res = await fetch(`/api/auctions/tender/${auction.id}/current-item?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.auction) {
          setAuction(prev => {
            const wasClosed = ['registration_closed', 'ended', 'completed'].includes(prev.status)
            const nowClosed = ['registration_closed', 'ended', 'completed'].includes(data.auction.status)
            if (!wasClosed && nowClosed) {
              window.location.reload()
            }
            return {
              ...prev,
              status: data.auction.status,
            }
          })
        }
        if (Array.isArray(data?.allItems)) {
          data.allItems.forEach((remoteItem: any) => {
            if (remoteItem.hasOfficialWinner && remoteItem.winner) {
              setAuction(prev => ({
                ...prev,
                items: prev.items.map(i => i.id === remoteItem.id ? {
                  ...i,
                  hasOfficialWinner: true,
                  status: 'completed',
                  winner: remoteItem.winner,
                  highestBid: Number(remoteItem.winner.winning_amount || i.highestBid)
                } : i)
              }))
            }
          })
        }
      }
    } catch {
      // ignore
    } finally {
      isRefreshingRef.current = false
    }
  }

  // Subscribe to realtime winner selections
  useEffect(() => {
    const supabase = createClient()
    if (!supabase?.channel) return
    const channel = supabase
      .channel(`auction-monitor-${auction.id}`)
      .on('broadcast', { event: '*' }, (payload: any) => {
        const { event, data } = payload.payload || payload
        if (event === 'winner_selected' || event === 'status_changed') {
          if (data?.gem_id) {
            triggerWinnerReveal(data.gem_id, data)
          }
          scheduleRefresh(150)
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auction_winners' },
        (payload) => {
          const row = (payload.new || {}) as any
          const targetGemId = row?.gem_id || row?.gemId
          if (targetGemId) {
            triggerWinnerReveal(targetGemId, row)
          }
          scheduleRefresh(200)
        }
      )
      .subscribe()

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      supabase?.removeChannel?.(channel)
      if (revealIntervalRef.current) clearInterval(revealIntervalRef.current)
    }
  }, [auction.id])

  // Auto-Play Timer: cycles through each lot every 10s if active
  useEffect(() => {
    if (!autoPlay || !isBiddingClosed) return

    const timer = setInterval(() => {
      // If current item is presenting, unseal it
      if (currentItem && !revealedLotIds.has(currentItem.id)) {
        startReveal()
      } else {
        // Move to next lot
        setCurrentLotIndex(prev => {
          if (prev >= auction.items.length - 1) {
            setAutoPlay(false)
            setShowPodium(true)
            return prev
          }
          return prev + 1
        })
      }
    }, 10000)

    return () => clearInterval(timer)
  }, [autoPlay, currentItem, revealedLotIds, isBiddingClosed, auction.items.length])

  // Navigation handlers
  const handleNext = () => {
    if (currentLotIndex < auction.items.length - 1) {
      setCurrentLotIndex(prev => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentLotIndex > 0) {
      setCurrentLotIndex(prev => prev - 1)
    }
  }

  const handleRevealAll = () => {
    // Only reveal lots that have an official announced winner
    const eligibleIds = new Set(auction.items.filter(i => (i as any).hasOfficialWinner || i.winner).map(i => i.id))
    if (eligibleIds.size > 0) {
      setRevealedLotIds(prev => new Set([...prev, ...eligibleIds]))
      if (currentItem && eligibleIds.has(currentItem.id)) {
        setRevealState('revealed')
      }
    }
  }

  const isCurrentRevealed = currentItem ? revealedLotIds.has(currentItem.id) : false
  const winner = currentItem?.winner
  const winningAmount = winner?.winning_amount || currentItem?.highestBid || currentItem?.starting_price
  const winnerName = winner?.user?.display_name || winner?.user?.anonymous_name || winner?.user?.email || (currentItem?.bidCount > 0 ? 'Verified High Bidder' : 'Reserve Not Met')
  const priceJump = currentItem?.starting_price ? Math.round(((winningAmount - currentItem.starting_price) / currentItem.starting_price) * 100) : 0

  return (
    <div className="min-h-screen bg-[#07070b] text-white flex flex-col font-sans select-none overflow-x-hidden">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <header className="relative z-10 bg-[#0f0f18]/90 backdrop-blur-md border-b border-[var(--gold)]/20 px-6 py-3.5">
        <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <AuctionHammerIcon className="w-10 h-10 text-[var(--gold)]" />
              <div>
                <span className="text-xl font-black tracking-tight text-white">
                  Auxtion<span className="text-[var(--gold)]">Hub</span>
                </span>
                <span className="block text-[9px] tracking-[0.2em] text-[var(--gold)]/70 uppercase font-semibold">
                  Tender Reveal Ceremony
                </span>
              </div>
            </div>

            <div className="h-8 w-px bg-white/10 hidden sm:block" />

            <div className="flex items-center gap-2 px-3.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
              <Trophy className="w-3.5 h-3.5 text-[var(--gold)]" />
              <span className="text-xs font-black text-[var(--gold)] tracking-wider uppercase">
                {isBiddingClosed ? 'WINNER REVEAL STAGE' : 'SEALED TENDER VAULT'}
              </span>
            </div>

            <h1 className="text-lg md:text-xl font-bold text-white truncate max-w-md hidden lg:block">
              {auction.name}
            </h1>
          </div>

          <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-[var(--gold)]/70 uppercase tracking-widest font-semibold">Format</div>
              <div className="text-sm font-bold text-emerald-400">
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

      {/* ── Bidding Active Screen: Sealed Vault Mode ─────────────── */}
      {!isBiddingClosed ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-radial-gradient from-[var(--gold)]/5 to-transparent pointer-events-none" />

          <div className="max-w-2xl bg-[#11111a] border border-[var(--gold)]/30 rounded-3xl p-10 shadow-2xl relative">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[var(--gold)]/10 border-2 border-[var(--gold)]/40 flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.2)]">
              <Lock className="w-12 h-12 text-[var(--gold)] animate-pulse" />
            </div>

            <span className="text-xs font-mono font-bold text-[var(--gold)] uppercase tracking-widest px-3 py-1 bg-[var(--gold)]/10 rounded-full border border-[var(--gold)]/20 inline-block mb-3">
              Confidential Sealed Bidding
            </span>

            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Tender Submissions Sealed
            </h2>

            <p className="text-white/70 text-sm sm:text-base leading-relaxed mb-8">
              Tender bids are currently being submitted under cryptographic seal. In accordance with tender auction rules, bids remain strictly confidential.
              <br /><br />
              <strong className="text-white font-semibold">The Grand Winner Reveal Ceremony</strong> will commence live on this screen immediately once bidding closes.
            </p>

            <div className="grid grid-cols-2 gap-4 bg-[#0a0a10] border border-white/5 rounded-2xl p-4 text-left">
              <div>
                <span className="text-[10px] text-white/40 uppercase tracking-wider block">Tender Lots</span>
                <span className="text-xl font-bold font-mono text-white">{auction.items.length} Gems</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-white/40 uppercase tracking-wider block">Approved Bidders</span>
                <span className="text-xl font-bold font-mono text-emerald-400">{auction.registeredCount || 0} Participants</span>
              </div>
            </div>
          </div>
        </div>
      ) : showPodium ? (
        /* ── Full Podium View ───────────────────────────────────── */
        <div className="flex-1 max-w-[1920px] w-full mx-auto p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
            <div>
              <span className="text-xs font-bold text-[var(--gold)] uppercase tracking-wider">
                Ceremony Complete
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">Grand Auction Podium Summary</h2>
            </div>
            <button
              onClick={() => setShowPodium(false)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
            >
              <Eye className="w-4 h-4" /> View Lot-by-Lot Stage
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto">
            {auction.items.map((item, idx) => {
              const won = item.winner
              const winningBid = won?.winning_amount || item.highestBid || item.starting_price
              return (
                <div key={item.id} className="bg-[#11111a] border border-[var(--gold)]/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-[var(--gold)]">LOT #{String(idx + 1).padStart(2, '0')}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      REVEALED
                    </span>
                  </div>

                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-black/60 mb-4 border border-white/10">
                    {item.gem_images?.[0]?.image_url ? (
                      <img src={item.gem_images[0].image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20">
                        <GemIcon className="w-10 h-10" />
                      </div>
                    )}
                  </div>

                  <h3 className="font-bold text-lg text-white mb-2 truncate">{item.name}</h3>

                  <div className="bg-[#0b0b12] p-3 rounded-xl border border-white/5 space-y-1 mb-3">
                    <span className="text-[10px] text-white/40 uppercase block">Winning Tender</span>
                    <span className="text-2xl font-black text-[var(--gold)] font-mono">
                      {formatCurrency(winningBid)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <Award className="w-4 h-4 text-emerald-400" />
                    <span className="truncate">
                      Winner: <strong className="text-white">{won?.user?.display_name || won?.user?.anonymous_name || 'Verified Tenderer'}</strong>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* ── Winner Reveal Stage (Lot-by-Lot Ceremony) ───────────── */
        <div className="flex-1 max-w-[1920px] w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ── LEFT PANEL: Lots Queue (4 Cols) ──────────────────── */}
          <aside className="lg:col-span-4 bg-[#11111a] border border-white/10 rounded-2xl overflow-hidden flex flex-col max-h-[calc(100vh-175px)] shadow-xl">
            <div className="p-4 bg-[#151522] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[var(--gold)]" />
                <h2 className="text-sm font-black tracking-widest uppercase text-white">
                  Tender Lots ({auction.items.length})
                </h2>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                {revealedLotIds.size} / {auction.items.length} Revealed
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/5 p-2 space-y-2">
              {auction.items.map((item, idx) => {
                const isSelected = idx === currentLotIndex
                const isRevealed = revealedLotIds.has(item.id)

                return (
                  <div
                    key={item.id}
                    onClick={() => setCurrentLotIndex(idx)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all duration-300 relative flex items-center gap-3.5 ${
                      isSelected
                        ? 'bg-gradient-to-r from-[var(--gold)]/20 via-[#1a1a2e] to-transparent border-2 border-[var(--gold)] shadow-[0_0_20px_rgba(212,175,55,0.2)]'
                        : isRevealed
                        ? 'bg-white/5 border border-white/10'
                        : 'hover:bg-white/5 border border-transparent opacity-85'
                    }`}
                  >
                    {/* Lot Number */}
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
                      {isRevealed && (
                        <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-[1px] flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        </div>
                      )}
                    </div>

                    {/* Lot Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-sm text-white truncate">{item.name}</h3>
                        {isRevealed ? (
                          <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                            REVEALED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> SEALED
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono">
                        {isRevealed ? (
                          <span className="text-[var(--gold)] font-bold">
                            {formatCurrency(item.winner?.winning_amount || item.highestBid || item.starting_price)}
                          </span>
                        ) : (
                          <span className="text-white/40">
                            {item.bidCount} sealed tenders
                          </span>
                        )}
                      </div>

                      {isRevealed && item.winner && (
                        <p className="text-[10px] text-emerald-400/90 truncate mt-0.5 font-medium">
                          {item.winner.user?.display_name || item.winner.user?.anonymous_name || item.winner.user?.email || 'Verified Winner'}
                        </p>
                      )}
                    </div>

                    <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${isSelected ? 'translate-x-1 text-[var(--gold)]' : ''}`} />
                  </div>
                )
              })}
            </div>

            <div className="p-3 bg-[#0d0d15] border-t border-white/10 flex items-center justify-between">
              <button
                onClick={handleRevealAll}
                className="text-xs text-[var(--gold)] hover:underline font-bold"
              >
                Reveal All Lots
              </button>
              <button
                onClick={() => setShowPodium(true)}
                className="text-xs text-white/70 hover:text-white font-bold flex items-center gap-1"
              >
                <Trophy className="w-3.5 h-3.5 text-[var(--gold)]" /> Podium View
              </button>
            </div>
          </aside>

          {/* ── RIGHT PANEL: Main Reveal Stage (8 Cols) ───────────── */}
          <main className="lg:col-span-8 space-y-6">
            {currentItem ? (
              <div className="bg-gradient-to-b from-[#151522] to-[#0d0d15] border border-[var(--gold)]/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                {/* Gold ambient glow */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--gold)]/10 rounded-full blur-3xl pointer-events-none" />

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  
                  {/* Left: Gem Visual Showcase */}
                  <div className="md:col-span-5 flex flex-col items-center">
                    <div className="w-full aspect-square rounded-2xl overflow-hidden bg-black/60 border border-[var(--gold)]/20 relative shadow-inner group">
                      {currentItem.gem_images?.[activeImageIndex]?.image_url ? (
                        <img
                          src={currentItem.gem_images[activeImageIndex].image_url}
                          alt={currentItem.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">
                          <GemIcon className="w-20 h-20 text-[var(--gold)]/30" />
                        </div>
                      )}

                      <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-2 border border-white/10">
                        <span className="text-[10px] font-mono font-bold text-[var(--gold)] uppercase">
                          LOT #{String(currentLotIndex + 1).padStart(2, '0')} OF {String(auction.items.length).padStart(2, '0')}
                        </span>
                      </div>

                      {/* Image dots */}
                      {currentItem.gem_images?.length > 1 && (
                        <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                          {currentItem.gem_images.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setActiveImageIndex(i)}
                              className={`w-2.5 h-2.5 rounded-full transition-all ${
                                activeImageIndex === i ? 'bg-[var(--gold)] w-6' : 'bg-white/40'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Specs Row */}
                    <div className="grid grid-cols-3 gap-2 w-full mt-3 text-center">
                      {currentItem.carat_weight && (
                        <div className="bg-white/5 border border-white/5 rounded-lg py-1.5 px-2">
                          <span className="text-[9px] text-white/40 uppercase block">Weight</span>
                          <span className="text-xs font-bold text-white">{currentItem.carat_weight} ct</span>
                        </div>
                      )}
                      {currentItem.color && (
                        <div className="bg-white/5 border border-white/5 rounded-lg py-1.5 px-2">
                          <span className="text-[9px] text-white/40 uppercase block">Color</span>
                          <span className="text-xs font-bold text-white">{currentItem.color}</span>
                        </div>
                      )}
                      {currentItem.cut && (
                        <div className="bg-white/5 border border-white/5 rounded-lg py-1.5 px-2">
                          <span className="text-[9px] text-white/40 uppercase block">Cut</span>
                          <span className="text-xs font-bold text-white">{currentItem.cut}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Reveal Action & Winner Card */}
                  <div className="md:col-span-7 space-y-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-mono font-bold text-[var(--gold)] uppercase tracking-wider">
                          Sealed Tender Lot
                        </span>
                        {currentItem.provenance && (
                          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/70">
                            {currentItem.provenance}
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                        {currentItem.name}
                      </h2>
                      {currentItem.description && (
                        <p className="text-xs sm:text-sm text-white/70 line-clamp-2 mt-1">
                          {currentItem.description}
                        </p>
                      )}
                    </div>

                    {/* Tenders Overview Box */}
                    <div className="grid grid-cols-2 gap-3 bg-[#0a0a10] border border-white/10 rounded-2xl p-4 font-mono">
                      <div>
                        <span className="text-[10px] text-white/40 uppercase block font-sans">Starting Reserve</span>
                        <span className="text-lg font-bold text-white">{formatCurrency(currentItem.starting_price)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-white/40 uppercase block font-sans">Tenders Submitted</span>
                        <span className="text-lg font-bold text-emerald-400">{currentItem.bidCount} Bids</span>
                      </div>
                    </div>

                    {/* ── STAGE A: Presenting (Before Unsealing) ───── */}
                    {revealState === 'presenting' && (
                      <div className="bg-[#0b0b14] border-2 border-dashed border-[var(--gold)]/30 rounded-2xl p-8 text-center space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/30 flex items-center justify-center">
                          <Lock className="w-8 h-8 text-[var(--gold)] animate-bounce" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-white">Sealed Bids Under Vault</h4>
                          <p className="text-xs text-white/60 mt-1">
                            {currentItem.bidCount} sealed offers awaiting official unsealing.
                          </p>
                        </div>
                        {currentItem.winner ? (
                          <button
                            onClick={startReveal}
                            className="px-8 py-3.5 bg-gradient-to-r from-[var(--gold)] to-amber-500 hover:brightness-110 text-black font-black tracking-wider text-sm rounded-xl uppercase shadow-xl shadow-[var(--gold)]/20 transition-all transform hover:scale-105 active:scale-95 inline-flex items-center gap-2"
                          >
                            <Unlock className="w-4 h-4" /> Unseal Winning Tender
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-amber-400 text-sm font-semibold">
                            <Clock className="w-4 h-4 animate-spin" />
                            Awaiting Auctioneer Official Announcement
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── STAGE B: Suspense Countdown (3-2-1) ──────── */}
                    {revealState === 'suspense' && (
                      <div className="bg-[#0b0b14] border-2 border-[var(--gold)] rounded-2xl p-10 text-center space-y-4 shadow-[0_0_40px_rgba(212,175,55,0.3)] animate-pulse">
                        <span className="text-xs uppercase font-mono tracking-widest text-[var(--gold)] block">
                          Unsealing Highest Tender...
                        </span>
                        <div className="text-7xl font-black font-mono text-[var(--gold)]">
                          {suspenseCount}
                        </div>
                        <div className="w-32 h-1 bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent mx-auto" />
                      </div>
                    )}

                    {/* ── STAGE C: Winner Revealed Card ───────────── */}
                    {revealState === 'revealed' && (
                      <div className="bg-gradient-to-br from-[#121c15] via-[#10141f] to-[#1a150a] border-2 border-emerald-500/50 rounded-2xl p-6 shadow-[0_0_40px_rgba(16,185,129,0.2)] relative overflow-hidden space-y-5 animate-in fade-in zoom-in duration-500">
                        {/* Winner Header */}
                        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-[var(--gold)] animate-spin" />
                            <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
                              Official Winning Tender
                            </span>
                          </div>
                          {priceJump > 0 && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              +{priceJump}% Above Reserve
                            </span>
                          )}
                        </div>

                        {/* Huge Winning Price */}
                        <div>
                          <span className="text-[10px] text-white/50 uppercase tracking-widest font-mono block">
                            Confirmed Winning Offer
                          </span>
                          <div className="text-3xl sm:text-5xl font-black text-[var(--gold)] font-mono tracking-tight drop-shadow-[0_0_20px_rgba(212,175,55,0.5)]">
                            {formatCurrency(winningAmount)}
                          </div>
                        </div>

                        {/* Winner Identity Badge */}
                        <div className="bg-black/50 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                              <Trophy className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] text-white/40 uppercase block tracking-wider">Acquired By</span>
                              <div className="text-base font-bold text-white truncate">
                                {winnerName}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 flex-shrink-0">
                            <ShieldCheck className="w-4 h-4" /> Verified
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* ── Presenter Control Bar ────────────────────────── */}
                <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrev}
                      disabled={currentLotIndex === 0}
                      className="p-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-xl text-white transition-colors"
                      title="Previous Lot"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-xs font-mono text-white/60 px-2">
                      Lot {currentLotIndex + 1} of {auction.items.length}
                    </span>
                    <button
                      onClick={handleNext}
                      disabled={currentLotIndex === auction.items.length - 1}
                      className="p-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-xl text-white transition-colors"
                      title="Next Lot"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setAutoPlay(!autoPlay)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                        autoPlay
                          ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      {autoPlay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      {autoPlay ? 'Auto-Cycle Active' : 'Start Auto-Cycle'}
                    </button>

                    {isCurrentRevealed && (
                      <button
                        onClick={startReveal}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white/80 transition-colors flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Replay Reveal
                      </button>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="py-24 text-center text-white/40 bg-[#11111a] rounded-2xl border border-white/10">
                <GemIcon className="w-12 h-12 mx-auto mb-3 text-white/20" />
                <p className="text-base font-bold">No items available in this tender auction</p>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  )
}
