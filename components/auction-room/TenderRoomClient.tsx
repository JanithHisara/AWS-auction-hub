'use client'

import { useState, useEffect } from 'react'
import AuctionChatWidget from '@/components/chat/AuctionChatWidget'
import { createClient } from '@/lib/supabase/client'
import AuctionCountdown from '@/components/shared/AuctionCountdown'
import { Auction, Gem, Bid, AuctionRegistration, User } from '@/types/database'
import { Check, Loader2, Lock } from 'lucide-react'
import MediaRenderer from '@/components/gems/MediaRenderer'
import ImageCarousel from '@/components/ui/ImageCarousel'
import { useConfirm } from '@/components/ui/ConfirmProvider'

interface Props {
  auction: Auction
  items: (Gem & { gem_images: { image_url: string }[]; bids: Bid[] })[]
  user: User
  registration: AuctionRegistration
  [key: string]: any // allow other props
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

export default function TenderRoomClient({ auction, items: initialItems, user, registration }: Props) {
  const confirm = useConfirm()
  const supabase = createClient()
  const [items, setItems] = useState(initialItems)
  const [biddingInputs, setBiddingInputs] = useState<Record<string, string>>({})
  const [submittingGems, setSubmittingGems] = useState<Record<string, boolean>>({})

  // Bids placed by the current user
  const [userBids, setUserBids] = useState<Record<string, number>>(() => {
    const initialBids: Record<string, number> = {}
    initialItems.forEach(item => {
      // Find the user's highest bid for this item
      const myBids = item.bids.filter(b => b.user_id === user.id)
      if (myBids.length > 0) {
        initialBids[item.id] = Math.max(...myBids.map(b => b.bid_amount))
      }
    })
    return initialBids
  })

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  const activeItems = items.filter(item => item.status === 'active')

  const handlePlaceBid = async (gem: Gem) => {
    const inputVal = biddingInputs[gem.id]
    if (!inputVal) return

    const bidAmount = parseInt(inputVal, 10)
    if (isNaN(bidAmount) || bidAmount <= 0) {
      confirm('Please enter a valid bid amount.', { isAlert: true, confirmText: 'OK', title: 'Invalid Bid' })
      return
    }

    if (bidAmount < (gem.starting_price || 0)) {
      confirm(`Bid must be at least the starting price of ${formatCurrency(gem.starting_price)}`, { isAlert: true, confirmText: 'OK', title: 'Invalid Bid' })
      return
    }

    setSubmittingGems(prev => ({ ...prev, [gem.id]: true }))

    try {
      const isUpdate = !!userBids[gem.id]
      const res = await fetch(`/api/gems/${gem.id}/bids`, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid_amount: bidAmount }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to place bid')
      }

      setUserBids(prev => ({ ...prev, [gem.id]: bidAmount }))
      setBiddingInputs(prev => ({ ...prev, [gem.id]: '' }))
      
    } catch (err: any) {
      confirm(err.message || 'Failed to place bid', { isAlert: true, confirmText: 'OK', title: 'Error' })
    } finally {
      setSubmittingGems(prev => ({ ...prev, [gem.id]: false }))
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">{auction.name}</h1>
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-md font-bold">LIVE (SEALED BID)</span>
            <span>Registration: #{registration.id.slice(0, 8)}</span>
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          <p className="text-sm text-[var(--text-secondary)] mb-1">Bidding Ends In</p>
          <div className="text-xl sm:text-2xl font-bold text-[var(--gold)] tabular-nums">
            <AuctionCountdown roundEndTime={auction.auction_end} onExpire={() => window.location.reload()} />
          </div>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 mb-6 flex items-start gap-3">
        <Lock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-[var(--text-secondary)]">
          <strong className="text-white">Sealed Bid Auction:</strong> You can place bids on any active item below. 
          Your bids are hidden from other participants. You can update your bid at any time before the auction ends.
        </p>
      </div>

      {activeItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
          <p className="text-[var(--text-muted)] text-lg">No active items available for bidding right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeItems.map(gem => {
            const currentBid = userBids[gem.id]
            const isSubmitting = submittingGems[gem.id]

            return (
              <div key={gem.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col">
                <div className="aspect-[4/3] relative bg-black/50">
                  {gem.gem_images && gem.gem_images.length > 0 ? (
                    <ImageCarousel media={gem.gem_images.map((img: any) => ({ url: img.image_url }))} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <img src="/placeholder.png" alt="No image" className="object-cover opacity-50 w-full h-full" />
                    </div>
                  )}
                </div>
                
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-white leading-tight">{gem.name}</h3>
                  </div>
                  
                  <div className="text-sm text-[var(--text-secondary)] mb-4 space-y-1">
                    <p>Starting Price: <span className="text-white font-medium">{formatCurrency(gem.starting_price)}</span></p>
                    {gem.carat_weight && <p>Weight: {gem.carat_weight} ct</p>}
                  </div>

                  <div className="mt-auto space-y-3">
                    {currentBid ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-emerald-400 mb-1 font-medium">Your Sealed Bid</p>
                        <p className="text-lg font-bold text-white">{formatCurrency(currentBid)}</p>
                      </div>
                    ) : null}

                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Enter amount..."
                        value={biddingInputs[gem.id] || ''}
                        onChange={(e) => setBiddingInputs(prev => ({ ...prev, [gem.id]: e.target.value }))}
                        className="flex-1 min-w-0 bg-black/50 border border-[var(--border)] rounded-lg px-3 text-sm focus:border-[var(--gold)] outline-none"
                      />
                      <button
                        onClick={() => handlePlaceBid(gem)}
                        disabled={isSubmitting || !biddingInputs[gem.id]}
                        className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center justify-center gap-2 ${
                          currentBid 
                            ? 'bg-[var(--surface-elevated)] border border-[var(--border)] text-white hover:border-[var(--gold)]'
                            : 'bg-[var(--gold)] text-black hover:bg-[var(--gold-light)]'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (currentBid ? 'Update Bid' : 'Place Bid')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {/* Chat Widget */}
      <AuctionChatWidget auctionId={auction.id} userId={user.id} />
    </div>
  )
}
