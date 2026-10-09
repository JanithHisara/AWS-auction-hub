'use client'

import { useConfirm } from '@/components/ui/ConfirmProvider';
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { Loader2, Play, SkipForward, Trophy, Square, Clock } from 'lucide-react'
import Decimal from 'decimal.js'

interface AdminControlsProps {
  gemId: string
  currentPrice: number
  minIncrement: number
  status: string
  roundEndTime: string | null
  auctionType: string
  highestBid?: { amount: number; bidderName: string } | null
  allRegisteredBiddersBid?: boolean
  hasNoBidsInCurrentRound?: boolean
  startingPrice?: number
  auctionStatus?: string
  eligibleBiddersCount?: number
}

export default function AdminControls({ gemId, currentPrice, minIncrement, status, roundEndTime, auctionType, highestBid, allRegisteredBiddersBid, hasNoBidsInCurrentRound, startingPrice, auctionStatus, eligibleBiddersCount }: AdminControlsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const confirm = useConfirm()
  const [showNextRoundModal, setShowNextRoundModal] = useState(false)
  const [showStartBiddingModal, setShowStartBiddingModal] = useState(false)
  const [showAnnounceWinnerModal, setShowAnnounceWinnerModal] = useState(false)
  const [customIncrement, setCustomIncrement] = useState(minIncrement.toString())
  const [biddingDuration, setBiddingDuration] = useState('300')
  const [showProgressiveStartModal, setShowProgressiveStartModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [useCustomIncrement, setUseCustomIncrement] = useState(false)
  const [countdown, setCountdown] = useState('')

  const isProgressiveElimination = auctionType === 'progressive_elimination_auction'
  const isIncrementalApproval = auctionType === 'incremental_approval_auction'
  const isTenderBaseFixedBid = !isProgressiveElimination && !isIncrementalApproval
  const isRoundActive = !!roundEndTime && new Date(roundEndTime) > new Date()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Countdown timer for active round
  useEffect(() => {
    if (!roundEndTime) {
      setCountdown('')
      return
    }

    const updateCountdown = () => {
      const now = new Date().getTime()
      const end = new Date(roundEndTime).getTime()
      const distance = end - now

      let forceStop = false;
      if (isProgressiveElimination && highestBid && Number(highestBid.amount) === Number(currentPrice)) {
        forceStop = true;
      }
      
      if (isIncrementalApproval && allRegisteredBiddersBid) {
        forceStop = true;
      }

      if (distance <= 0 || forceStop) {
        setCountdown('00:00')
        return
      }

      const hours = Math.floor(distance / (1000 * 60 * 60))
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)

      if (hours > 0) {
        setCountdown(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      } else {
        setCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [roundEndTime, router, isProgressiveElimination, isIncrementalApproval, highestBid, currentPrice, allRegisteredBiddersBid])

  const handleAction = async (action: 'start' | 'increment' | 'end' | 'end-round' | 'activate' | 'eliminate-and-increment', options?: { duration?: number; increment?: number }) => {
    setLoading(true)
    try {
      let endpoint = ''
      let body: Record<string, unknown> = {}
      let method = 'POST'

      if (action === 'start') {
        endpoint = `/api/admin/auctions/${gemId}/start-round`
        if (options?.duration) {
          body = { duration: options.duration }
        }
      } else if (action === 'increment') {
        endpoint = `/api/admin/auctions/${gemId}/increment`
        if (options?.increment !== undefined) {
          body.increment = options.increment
        }
        if (options?.duration !== undefined) {
          body.duration = options.duration
        }
      } else if (action === 'eliminate-and-increment') {
        // Step 1: Eliminate non-approvers for the current price
        const elimRes = await fetch(`/api/admin/auctions/${gemId}/eliminate-non-approvers`, { method: 'POST' })
        if (!elimRes.ok) {
          const err = await elimRes.json()
          confirm(err.error || 'Failed to eliminate non-approvers', { isAlert: true, confirmText: 'OK', title: 'Notice' })
          setLoading(false)
          return
        }
        const elimData = await elimRes.json()
        if (elimData.eliminated_count > 0) {
          console.log(`Eliminated ${elimData.eliminated_count} non-approvers`)
        }
        // Step 2: Increment price and start next round
        endpoint = `/api/admin/auctions/${gemId}/increment`
        if (options?.increment !== undefined) {
          body.increment = options.increment
        }
        if (options?.duration !== undefined) {
          body.duration = options.duration
        }
      } else if (action === 'end') {
        endpoint = `/api/admin/auctions/${gemId}/select-winner`
      } else if (action === 'end-round') {
        endpoint = `/api/admin/auctions/${gemId}/end-round`
      } else if (action === 'activate') {
        // Activate this item (set status to 'active')
        endpoint = `/api/gems/${gemId}`
        body = { status: 'active' }
        method = 'PATCH'
      }

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body) 
      })

      if (!res.ok) {
        const error = await res.json()
        confirm(error.error || 'Action failed', { isAlert: true, confirmText: 'OK', title: 'Notice' })
      } else {
        setShowNextRoundModal(false)
        setShowStartBiddingModal(false)
        router.refresh()
      }
    } catch (e) {
      console.error(e)
      confirm('Action failed', { isAlert: true, confirmText: 'OK', title: 'Notice' })
    } finally {
      setLoading(false)
    }
  }

  const handleNextRound = () => {
    let increment: number
    try {
      increment = useCustomIncrement ? new Decimal(customIncrement || '0').toNumber() : minIncrement
    } catch {
      confirm('Please enter a valid increment amount', { isAlert: true, confirmText: 'OK', title: 'Notice' })
      return
    }
    if (isNaN(increment) || increment <= 0) {
      confirm('Please enter a valid increment amount', { isAlert: true, confirmText: 'OK', title: 'Notice' })
      return
    }
    const duration = parseInt(biddingDuration)
    if (isNaN(duration) || duration <= 0) {
      confirm('Please enter a valid duration', { isAlert: true, confirmText: 'OK', title: 'Notice' })
      return
    }
      if (hasNoBidsInCurrentRound) {
        const minAllowedPrice = highestBid?.amount ?? startingPrice ?? 0;
        const newPrice = new Decimal(currentPrice).minus(increment).toNumber();
        
        if (newPrice <= minAllowedPrice) {
          confirm(`The decreased price (${formatCurrency(newPrice)}) cannot be less than or equal to the last accepted price (${formatCurrency(minAllowedPrice)}).`, { isAlert: true, confirmText: 'OK', title: 'Invalid Price' });
          return;
        }
      }

      // For Incremental Approval: eliminate non-approvers first, then increment
    const action = isIncrementalApproval ? 'eliminate-and-increment' : 'increment'
    const effectiveIncrement = hasNoBidsInCurrentRound ? -increment : increment
    handleAction(action, { increment: effectiveIncrement, duration })
  }


  const handleStartBidding = () => {
    const duration = parseInt(biddingDuration)
    if (isNaN(duration) || duration <= 0) {
      confirm('Please enter a valid duration', { isAlert: true, confirmText: 'OK', title: 'Notice' })
      return
    }
    handleAction('start', { duration })
  }

  const isForceStopped = 
    (isProgressiveElimination && highestBid && Number(highestBid.amount) === Number(currentPrice)) ||
    (isIncrementalApproval && allRegisteredBiddersBid) || false;
    
  const isBiddingFinished = !isRoundActive || isForceStopped;

  const durationOptions = [
    { value: '60', label: '1 minute' },
    { value: '120', label: '2 minutes' },
    { value: '300', label: '5 minutes' },
    { value: '600', label: '10 minutes' },
    { value: '900', label: '15 minutes' },
    { value: '1800', label: '30 minutes' },
    { value: '3600', label: '1 hour' },
  ]

  return (
    <>
      <div className="card-glass rounded-xl p-6 mb-6">
        <h3 className="text-lg font-bold text-white mb-4">Auction Controls</h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-[var(--surface)] rounded-xl">
            <div className="text-xs text-[var(--text-muted)] uppercase mb-1">
              {isTenderBaseFixedBid ? 'Starting Price' : 'Current Price'}
            </div>
            <div className="text-2xl font-bold text-[var(--gold)]">{formatCurrency(currentPrice)}</div>
          </div>
          {isProgressiveElimination && (
            <div className="p-4 bg-[var(--surface)] rounded-xl">
              <div className="text-xs text-[var(--text-muted)] uppercase mb-1">Default Increment</div>
              <div className="text-2xl font-bold text-white">{formatCurrency(minIncrement)}</div>
            </div>
          )}
          <div className="p-4 bg-[var(--surface)] rounded-xl">
            <div className="text-xs text-[var(--text-muted)] uppercase mb-1">Status</div>
            <div className="text-2xl font-bold text-white uppercase">{status}</div>
          </div>
          {roundEndTime && (
            <div className="p-4 bg-[var(--surface)] rounded-xl">
              <div className="text-xs text-[var(--text-muted)] uppercase mb-1">Time Left</div>
              <div className={`text-2xl font-bold font-mono ${isRoundActive ? 'text-emerald-400' : 'text-amber-400'}`}>
                {countdown || ''}
              </div>
            </div>
          )}
        </div>

        {/* Auction Type Badge */}
        <div className="mb-4">
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
            isProgressiveElimination
              ? 'bg-purple-500/20 text-purple-400'
              : isIncrementalApproval
                ? 'bg-red-500/20 text-red-400'
                : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            {isProgressiveElimination
              ? ' English Auction'
              : isIncrementalApproval
                ? ' Progressive Elimination Auction'
                : ' Closed Bid Auction'}
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* ACTIVATE BUTTON - For pending items */}
          {status === 'pending' && (
            <button
              onClick={async () => {
                  if (await confirm('Activate this item? It will become the current active item for bidding.')) {
                  handleAction('activate')
                }
              }}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Activate Item
            </button>
          )}

          {/* TENDER BASE / FIXED BID CONTROLS */}
          {isTenderBaseFixedBid && (auctionStatus === 'registration_closed' || auctionStatus === 'ended' || auctionStatus === 'completed') && (
            <>
              {/* For sealed bid, admin just needs to announce winner after auction ends */}
              <button
                onClick={() => setShowAnnounceWinnerModal(true)}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                Announce Winner
              </button>
            </>
          )}

          {/* PROGRESSIVE ELIMINATION CONTROLS */}
          {isProgressiveElimination && (
            <>
              {(status === 'active' || status === 'ended') && !roundEndTime && (
                <button
                  onClick={() => setShowProgressiveStartModal(true)}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Start First Round
                </button>
              )}

              {(status === 'active' || status === 'ended') && roundEndTime && isBiddingFinished && (
                <>
                  {hasNoBidsInCurrentRound ? (
                    <button
                      onClick={() => setShowAnnounceWinnerModal(true)}
                      disabled={loading}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                      Announce Winner
                    </button>
                  ) : (
                    <>
                  <button
                    onClick={async () => {
                      const duration = parseInt(biddingDuration)
                      const durLabel = duration >= 60
                        ? `${Math.floor(duration / 60)}m ${duration % 60 ? duration % 60 + 's' : ''}`
                        : `${duration}s`
                      if (await confirm(`Start default round with +${formatCurrency(minIncrement)} increment and ${durLabel} duration?`)) {
                        handleAction('increment', { increment: minIncrement, duration: duration || undefined })
                      }
                    }}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipForward className="w-4 h-4" />}
                    Default Round ({formatCurrency(minIncrement)})
                  </button>
                  <button
                    onClick={() => setShowNextRoundModal(true)}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipForward className="w-4 h-4" />}
                    Custom Round
                  </button>
                  </>
                  )}
                </>
              )}

              
            </>
          )}

          {/* INCREMENTAL APPROVAL CONTROLS */}
          {isIncrementalApproval && (
            <>
              {(status === 'active' || status === 'ended') && !roundEndTime && (
                <button
                  onClick={() => setShowProgressiveStartModal(true)}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Start First Round
                </button>
              )}

              {(status === 'active' || status === 'ended') && roundEndTime && (!isRoundActive || allRegisteredBiddersBid) && (
                <>
                  {eligibleBiddersCount !== undefined && eligibleBiddersCount === 1 ? (
                    <button
                      onClick={() => setShowAnnounceWinnerModal(true)}
                      disabled={loading}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                      Announce Winner
                    </button>
                  ) : hasNoBidsInCurrentRound ? (
                    <button
                      onClick={() => setShowNextRoundModal(true)}
                      disabled={loading}
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipForward className="w-4 h-4" />}
                      Decrease Price Round
                    </button>
                  ) : (
                    <>
                  <button
                    onClick={async () => {
                      const duration = parseInt(biddingDuration)
                      const durLabel = duration >= 60
                        ? `${Math.floor(duration / 60)}m ${duration % 60 ? duration % 60 + 's' : ''}`
                        : `${duration}s`
                      if (await confirm(`Eliminate non-approvers and start default round with +${formatCurrency(minIncrement)} increment and ${durLabel} duration?`)) {
                        handleAction('eliminate-and-increment', { increment: minIncrement, duration: duration || undefined })
                      }
                    }}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipForward className="w-4 h-4" />}
                    Default Round ({formatCurrency(minIncrement)})
                  </button>
                  <button
                    onClick={() => setShowNextRoundModal(true)}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipForward className="w-4 h-4" />}
                    Custom Round
                  </button>
                  </>
                  )}
                </>
              )}

              
            </>
          )}
        </div>
      </div>

      {/* Announce Winner Modal */}
      {mounted && showAnnounceWinnerModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a24] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Announce Winner</h3>
                <p className="text-sm text-[var(--text-muted)]">Review and confirm the winner</p>
              </div>
            </div>

            {/* Winner Preview */}
            {highestBid ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-6">
                <p className="text-xs text-emerald-400 uppercase mb-2">Winner (Highest Bid)</p>
                <p className="text-3xl font-bold text-emerald-400 mb-1">{formatCurrency(highestBid.amount)}</p>
                <p className="text-sm text-[var(--text-secondary)]">{highestBid.bidderName}</p>
              </div>
            ) : (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-6">
                <p className="text-amber-400 text-center">No bids found</p>
              </div>
            )}

            <p className="text-sm text-[var(--text-muted)] mb-6">
              This will mark the item as completed, notify the winner via email, and move to the next item if available.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAnnounceWinnerModal(false)}
                className="flex-1 px-4 py-3 bg-[var(--surface)] text-white font-bold rounded-xl hover:bg-[var(--surface-elevated)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowAnnounceWinnerModal(false)
                  handleAction('end')
                }}
                disabled={loading || !highestBid}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                Announce
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Start Bidding Modal (Closed Bid Auction) */}
      {mounted && showStartBiddingModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a24] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Start Bidding</h3>
                <p className="text-sm text-[var(--text-secondary)]">Set the bidding duration</p>
              </div>
            </div>

            {/* Duration Selection */}
            <div className="space-y-3 mb-6">
              <label className="block text-sm text-[var(--text-muted)] mb-2">
                Bidding Duration
              </label>
              <div className="grid grid-cols-2 gap-2">
                {durationOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBiddingDuration(opt.value)}
                    className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                      biddingDuration === opt.value
                        ? 'bg-emerald-500 text-white'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Custom duration */}
              <div className="mt-4">
                <label className="block text-sm text-[var(--text-muted)] mb-2">
                  Or enter custom (seconds)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={biddingDuration}
                  onChange={(e) => setBiddingDuration(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white focus:border-[var(--gold)]"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 bg-[var(--surface)] rounded-xl mb-6">
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)]">Bidding will end in</span>
                <span className="text-xl font-bold text-emerald-400">
                  {Math.floor(parseInt(biddingDuration || '0') / 60)}:{(parseInt(biddingDuration || '0') % 60).toString().padStart(2, '0')} min
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowStartBiddingModal(false)}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white font-medium hover:bg-[var(--surface-elevated)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartBidding}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-emerald-500 rounded-lg text-white font-medium flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Start Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Start Round Modal (Progressive Elimination) */}
      {mounted && showProgressiveStartModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a24] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Start Round</h3>
                <p className="text-sm text-[var(--text-secondary)]">Set the round duration</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <label className="block text-sm text-[var(--text-muted)] mb-2">
                Round Duration
              </label>
              <div className="grid grid-cols-2 gap-2">
                {durationOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBiddingDuration(opt.value)}
                    className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                      biddingDuration === opt.value
                        ? 'bg-emerald-500 text-white'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label className="block text-sm text-[var(--text-muted)] mb-2">
                  Or enter custom (seconds)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={biddingDuration}
                  onChange={(e) => setBiddingDuration(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white focus:border-[var(--gold)]"
                />
              </div>
            </div>

            <div className="p-4 bg-[var(--surface)] rounded-xl mb-6">
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)]">Round will end in</span>
                <span className="text-xl font-bold text-emerald-400">
                  {Math.floor(parseInt(biddingDuration || '0') / 60)}:{(parseInt(biddingDuration || '0') % 60).toString().padStart(2, '0')} min
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowProgressiveStartModal(false)}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white font-medium hover:bg-[var(--surface-elevated)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const duration = parseInt(biddingDuration)
                  if (isNaN(duration) || duration <= 0) {
                    confirm('Please enter a valid duration', { isAlert: true, confirmText: 'OK', title: 'Notice' })
                    return
                  }
                  setShowProgressiveStartModal(false)
                  handleAction('start', { duration })
                }}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-emerald-500 rounded-lg text-white font-medium flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Starting...</span></>
                ) : (
                  <><Play className="w-4 h-4" /><span>Start Round</span></>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Next Round Modal (Progressive Elimination) */}
      {mounted && showNextRoundModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a24] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${hasNoBidsInCurrentRound ? 'bg-amber-500/20' : 'bg-blue-500/20'}`}>
                <SkipForward className={`w-6 h-6 ${hasNoBidsInCurrentRound ? 'text-amber-400' : 'text-blue-400'}`} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{hasNoBidsInCurrentRound ? 'Decrease Price & Restart Round' : 'Start Next Round'}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{hasNoBidsInCurrentRound ? 'Decrease the price from the unaccepted amount' : 'Configure the price increment'}</p>
              </div>
            </div>

            {/* Price Preview */}
            <div className="p-4 bg-[var(--surface)] rounded-xl mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[var(--text-muted)]">{hasNoBidsInCurrentRound ? 'Unaccepted Price' : 'Current Price'}</span>
                <span className="text-xl font-bold text-white">{formatCurrency(currentPrice)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[var(--text-muted)]">{hasNoBidsInCurrentRound ? 'Decrease By' : 'Increment'}</span>
                <span className={`text-xl font-bold ${hasNoBidsInCurrentRound ? 'text-amber-400' : 'text-blue-400'}`}>
                  {hasNoBidsInCurrentRound ? '-' : '+'}{formatCurrency(useCustomIncrement ? new Decimal(customIncrement || '0').toNumber() : minIncrement)}
                </span>
              </div>
              <div className="border-t border-[var(--border)] pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-muted)]">New Price</span>
                  <span className="text-2xl font-bold text-[var(--gold)]">
                    {formatCurrency(new Decimal(currentPrice)[hasNoBidsInCurrentRound ? 'minus' : 'plus'](useCustomIncrement ? new Decimal(customIncrement || '0') : minIncrement).toNumber())}
                  </span>
                </div>
              </div>
            </div>

            {/* Increment Options */}
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--gold)]/50">
                <input
                  type="radio"
                  checked={!useCustomIncrement}
                  onChange={() => setUseCustomIncrement(false)}
                  className="w-4 h-4 text-[var(--gold)]"
                />
                <div>
                  <p className="text-white font-medium">{hasNoBidsInCurrentRound ? 'Default Decrease' : 'Default Increment'}</p>
                  <p className="text-sm text-[var(--text-muted)]">{formatCurrency(minIncrement)}</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--gold)]/50">
                <input
                  type="radio"
                  checked={useCustomIncrement}
                  onChange={() => setUseCustomIncrement(true)}
                  className="w-4 h-4 text-[var(--gold)] mt-1"
                />
                <div className="flex-1">
                  <p className="text-white font-medium mb-2">{hasNoBidsInCurrentRound ? 'Custom Decrease' : 'Custom Increment'}</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">LKR</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customIncrement}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '')
                        setCustomIncrement(val)
                        setUseCustomIncrement(true)
                      }}
                      placeholder="Enter amount"
                      className="w-full pl-12 pr-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-white focus:border-[var(--gold)]"
                    />
                  </div>
                </div>
              </label>
            </div>

            {/* Round Duration */}
            <div className="space-y-3 mb-6">
              <label className="block text-sm text-[var(--text-muted)]">Round Duration</label>
              <div className="grid grid-cols-3 gap-2">
                {durationOptions.slice(0, 6).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBiddingDuration(opt.value)}
                    className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                      biddingDuration === opt.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Custom (seconds)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={biddingDuration}
                  onChange={(e) => setBiddingDuration(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white text-sm focus:border-[var(--gold)]"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowNextRoundModal(false)}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white font-medium hover:bg-[var(--surface-elevated)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNextRound}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-blue-500 rounded-lg text-white font-medium flex items-center justify-center gap-2 hover:bg-blue-600 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <SkipForward className="w-4 h-4" />
                    <span>Start Round</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}


