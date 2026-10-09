'use client'

import { useConfirm } from '@/components/ui/ConfirmProvider';
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import AuctionCountdown from '@/components/shared/AuctionCountdown'
import { Auction, Gem, Bid, UserRewards, AuctionRegistration, User } from '@/types/database'
import { Check, Loader2, Trophy, Pencil, LogOut } from 'lucide-react'
import AuctionChatWidget from '@/components/chat/AuctionChatWidget'
import MediaRenderer from '@/components/gems/MediaRenderer'
import ImageCarousel from '@/components/ui/ImageCarousel'
import Decimal from 'decimal.js'

interface WinnerInfo {
  gem_id: string
  user_id: string
  gem_name?: string
  winning_amount?: number
}

interface Props {
  auction: Auction
  items: (Gem & { gem_images: { image_url: string }[]; bids: Bid[] })[]
  user: User
  registration: AuctionRegistration
  rewards: UserRewards | null
  token: string
  initialIsHeld?: boolean
  adminPhone?: string | null
  initialEliminations?: { gem_id: string }[]
  totalRegisteredBidders?: number
  initialEliminationCounts?: Record<string, number>
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

export default function ProgressiveRoomClient({
  auction: initialAuction, items: initialItems, user, rewards: initialRewards, initialIsHeld = false, adminPhone = null, initialEliminations = [], totalRegisteredBidders = 0, initialEliminationCounts = {} }: Props) {
  const confirm = useConfirm();
  const [auction, setAuction] = useState(initialAuction)
  const [items, setItems] = useState(initialItems)
  const [selectedItem, setSelectedItem] = useState(() => {
    const active = initialItems.find(i => i.status === 'active')
    return active || initialItems[0] || null
  })
  const [bidAmount, setBidAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPointsPopup, setShowPointsPopup] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [rewards, setRewards] = useState(initialRewards)

  // --- Next.js router.refresh() Sync Hooks ---
  // When router.refresh() fetches new data, React passes new props but DOES NOT re-initialize useState.
  // We must explicitly sync the new props into the state to see real-time updates without a page reload.
  useEffect(() => {
    setAuction(initialAuction)
  }, [initialAuction])

  useEffect(() => {
    setItems(initialItems)
    setSelectedItem(prev => {
      if (!prev) return initialItems.find(i => i.status === 'active') || initialItems[0] || null
      // Keep the same item selected if it still exists, otherwise default to active
      return initialItems.find(i => i.id === prev.id) || initialItems.find(i => i.status === 'active') || initialItems[0] || null
    })
  }, [initialItems])

  useEffect(() => {
    setRewards(initialRewards)
  }, [initialRewards])

  useEffect(() => {
    setIsHeld(initialIsHeld)
  }, [initialIsHeld])

  useEffect(() => {
    setEliminatedGemIds(new Set(initialEliminations.map(e => e.gem_id)))
  }, [initialEliminations])

  // -------------------------------------------

  const [newBidHighlight, setNewBidHighlight] = useState<string | null>(null)
  const [hasAcceptedPrice, setHasAcceptedPrice] = useState(false)
  const [hasPlacedBid, setHasPlacedBid] = useState(false)
  const [userBidAmount, setUserBidAmount] = useState<number | null>(null)
  const [isEditingBid, setIsEditingBid] = useState(false)
  const [winners, setWinners] = useState<WinnerInfo[]>([])
  const [showWinnerPopup, setShowWinnerPopup] = useState(false)
  const [wonItem, setWonItem] = useState<{ name: string; amount: number } | null>(null)
  const [registeredCount, setRegisteredCount] = useState(0) // For % calculation
  const [biddingCountdown, setBiddingCountdown] = useState('')
  const [biddingTimeExpired, setBiddingTimeExpired] = useState(false)
  const [showNextRoundBanner, setShowNextRoundBanner] = useState(false)
  const [isHeld, setIsHeld] = useState(initialIsHeld)
  const [holdAdminPhone] = useState(adminPhone)
  const [showLeavePopup, setShowLeavePopup] = useState(false)
  // Incremental Approval: track eliminated items for the current user
  const [eliminatedGemIds, setEliminatedGemIds] = useState<Set<string>>(
    () => new Set(initialEliminations.map(e => e.gem_id))
  )
  const [eliminationCounts, setEliminationCounts] = useState<Record<string, number>>(initialEliminationCounts || {})

  useEffect(() => {
    setEliminationCounts(initialEliminationCounts || {})
  }, [initialEliminationCounts])
  const supabase = createClient()
  const bidsContainerRef = useRef<HTMLDivElement>(null)
  const selectedItemIdRef = useRef<string | null>(selectedItem?.id || null)
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Keep ref in sync with state
  useEffect(() => {
    selectedItemIdRef.current = selectedItem?.id || null
  }, [selectedItem?.id])

  // Auto-scroll to active item on mount
  useEffect(() => {
    const activeItem = initialItems.find(i => i.status === 'active')
    if (activeItem && itemRefs.current[activeItem.id]) {
      itemRefs.current[activeItem.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep selectedItem in sync with items array (for realtime updates)
  useEffect(() => {
    if (selectedItem) {
      const updatedItem = items.find(i => i.id === selectedItem.id)
      if (updatedItem && (
        updatedItem.round_end_time !== selectedItem.round_end_time ||
        updatedItem.status !== selectedItem.status ||
        updatedItem.current_price !== selectedItem.current_price
      )) {
        setSelectedItem(updatedItem)
      }
    }
  }, [items, selectedItem])

  const isFixedIncrement = auction.auction_type === 'progressive_elimination_auction'
  const isIncrementalApproval = auction.auction_type === 'incremental_approval_auction'
  const isFreeForm = !isFixedIncrement && !isIncrementalApproval
  const isBiddingActive = isFreeForm && selectedItem?.round_end_time && new Date(selectedItem.round_end_time) > new Date()

  // Is the current user eliminated for the selected item?
  const isEliminated = isIncrementalApproval && selectedItem ? eliminatedGemIds.has(selectedItem.id) : false

  // Calculate current bid and next minimum
  const currentBid = selectedItem?.bids?.length
    ? Math.max(...selectedItem.bids.map(b => b.bid_amount))
    : selectedItem?.starting_price || 0
  const minBid = isFreeForm
    ? selectedItem?.starting_price || 0  // Free-form: just starting price
    : currentBid + (selectedItem?.min_bid_increment || 100)
  const fixedPrice = selectedItem?.current_price || selectedItem?.starting_price || 0

  // For fixed increment: count unique bidders who accepted current price (>= fixedPrice to include device bids)
  const currentPriceBidders = (isFixedIncrement || isIncrementalApproval) && selectedItem?.bids
    ? new Set(selectedItem.bids.filter(b => b.bid_amount >= fixedPrice).map(b => b.user_id)).size
    : 0
  const bidderPercentage = registeredCount > 0
    ? Math.min(Math.round((currentPriceBidders / registeredCount) * 100), 100)
    : 0

  // Fetch registered count for percentage calculation (using RPC to bypass RLS)
  // Re-fetch periodically since new registrations can be approved during the auction
  useEffect(() => {
    const fetchRegisteredCount = async () => {
      const { data: count } = await supabase
        .rpc('get_auction_registration_count', { auction_uuid: auction.id })

      setRegisteredCount(count || 0)
    }
    fetchRegisteredCount()
    const interval = setInterval(fetchRegisteredCount, 15000)
    return () => clearInterval(interval)
  }, [auction.id, supabase])

  // Check if user has placed bid (for free-form) or accepted price (for fixed/incremental)
  useEffect(() => {
    if (selectedItem) {
      if (isFixedIncrement || isIncrementalApproval) {
        const userBid = selectedItem.bids?.find(
          b => b.user_id === user.id && b.bid_amount === fixedPrice
        )
        setHasAcceptedPrice(!!userBid)
      } else {
        // Free-form: check if user already placed any bid
        const userBids = selectedItem.bids?.filter(b => b.user_id === user.id) || []
          const userBid = userBids.length > 0 
            ? userBids.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] 
            : null
        setHasPlacedBid(!!userBid)
        setUserBidAmount(userBid?.bid_amount || null)
      }
    }
  }, [selectedItem, fixedPrice, user.id, isFixedIncrement, isIncrementalApproval])

  // Countdown timer for bidding rounds (both auction types)
  useEffect(() => {
    if (!selectedItem?.round_end_time) {
      setBiddingCountdown('')
      setBiddingTimeExpired(false)
      return
    }

    const updateCountdown = () => {
      const now = new Date().getTime()
      const end = new Date(selectedItem.round_end_time!).getTime()
      const distance = end - now

      let forceStop = false;
      if (isIncrementalApproval && selectedItem) {
        const eligibleBiddersCount = Math.max(0, (totalRegisteredBidders || 0) - (eliminationCounts[selectedItem.id] || 0));
        const activeBiddersCount = new Set((selectedItem.bids || []).filter(b => Number(b.bid_amount) === Number(selectedItem.current_price)).map(b => b.user_id)).size;
        
        if (eligibleBiddersCount > 0 && activeBiddersCount >= eligibleBiddersCount) {
          forceStop = true;
        }
      } else if (isFixedIncrement && selectedItem) {
        const hasClaimedBid = (selectedItem.bids || []).some(b => Number(b.bid_amount) === Number(selectedItem.current_price));
        if (hasClaimedBid) {
          forceStop = true;
        }
      }

      if (distance <= 0 || forceStop) {
        setBiddingCountdown('00:00')
        setBiddingTimeExpired(true) // Mark as expired to update UI
        return
      }

      setBiddingTimeExpired(false)
      const hours = Math.floor(distance / (1000 * 60 * 60))
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)

      if (hours > 0) {
        setBiddingCountdown(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      } else {
        setBiddingCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [selectedItem?.round_end_time, isIncrementalApproval, isFixedIncrement, selectedItem, eliminationCounts, totalRegisteredBidders])

  // Fetch existing winners on load (with winning amount from bid)
  useEffect(() => {
    const fetchWinners = async () => {
      const itemIds = items.map(i => i.id)
      if (itemIds.length === 0) return

      const { data: existingWinners } = await supabase
        .from('auction_winners')
        .select('gem_id, user_id, winning_bid:bids(bid_amount)')
        .in('gem_id', itemIds)

      if (existingWinners?.length) {
        const winnersWithNames = existingWinners.map(w => {
          // winning_bid could be object or array depending on relationship type
          const winningBid = w.winning_bid as unknown
          const bidAmount = Array.isArray(winningBid)
            ? (winningBid[0] as { bid_amount: number } | undefined)?.bid_amount
            : (winningBid as { bid_amount: number } | null)?.bid_amount
          return {
            gem_id: w.gem_id,
            user_id: w.user_id,
            gem_name: items.find(i => i.id === w.gem_id)?.name,
            winning_amount: bidAmount
          }
        })
        setWinners(winnersWithNames)
      }
    }
    fetchWinners()
  }, [items, supabase])

  // Subscribe to realtime updates for bids, items, and auction
  useEffect(() => {
    const channel = supabase
      .channel(`auction-${auction.id}`)
      // Listen for new bids
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids',
        },
        async (payload) => {
          const newBid = payload.new as Bid
          
          if (!initialItems.some(i => i.id === newBid.gem_id)) return

          // For free-form auctions, only process own bids (others are hidden)
          if (isFreeForm && newBid.user_id !== user.id) {
            return // Don't show other users' bids in free-form
          }

          const { data: bidUser } = await supabase
            .from('users')
            .select('anonymous_name, email, display_name')
            .eq('id', newBid.user_id)
            .single()

          const bidWithUser: Bid = {
            ...newBid,
            user: bidUser ? { email: bidUser.email || '', anonymous_name: bidUser.anonymous_name, display_name: bidUser.display_name } : undefined
          }

          // For fixed increment and incremental approval, update bids list as normal
          if (isFixedIncrement || isIncrementalApproval) {
            setItems(prev => prev.map(item => {
              if (item.id === newBid.gem_id) {
                return {
                  ...item,
                  bids: [bidWithUser, ...(item.bids || [])].sort((a, b) => b.bid_amount - a.bid_amount) as Bid[],
                }
              }
              return item
            }))

            if (selectedItemIdRef.current === newBid.gem_id) {
              setSelectedItem(prev => prev ? {
                ...prev,
                bids: [bidWithUser, ...(prev.bids || [])].sort((a, b) => b.bid_amount - a.bid_amount) as Bid[],
              } : prev)
            }

            setNewBidHighlight(newBid.id)
            setTimeout(() => setNewBidHighlight(null), 2000)
          }

          // For own bids (both free-form and fixed), update state
          if (newBid.user_id === user.id) {
            if (isFreeForm) {
              setHasPlacedBid(true)
              setUserBidAmount(newBid.bid_amount)
            }

            if (newBid.points_earned > 0) {
              setPointsEarned(newBid.points_earned)
              setShowPointsPopup(true)
              setTimeout(() => setShowPointsPopup(false), 2000)

              setRewards(prev => prev ? {
                ...prev,
                total_points: prev.total_points + newBid.points_earned,
                total_bids_placed: prev.total_bids_placed + 1,
              } : null)
            }
          }
        }
      )
      // Listen for bid updates (edited bids in Closed Bid auctions)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bids',
        },
        (payload) => {
          const updatedBid = payload.new as Bid
          
          if (!initialItems.some(i => i.id === updatedBid.gem_id)) return

          // Only process own bid updates (closed bids are private)
          if (updatedBid.user_id !== user.id) return

          if (isFreeForm) {
            setUserBidAmount(updatedBid.bid_amount)
          }

          // Update bid in items array
          setItems(prev => prev.map(item => {
            if (item.id === updatedBid.gem_id) {
              return {
                ...item,
                bids: item.bids.map(b => b.id === updatedBid.id ? { ...b, bid_amount: updatedBid.bid_amount } : b),
              }
            }
            return item
          }))

          if (selectedItemIdRef.current === updatedBid.gem_id) {
            setSelectedItem(prev => prev ? {
              ...prev,
              bids: prev.bids.map(b => b.id === updatedBid.id ? { ...b, bid_amount: updatedBid.bid_amount } : b),
            } : prev)
          }
        }
      )
      // Listen for item updates (status, price changes, round_end_time)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'gems',
          filter: `auction_id=eq.${auction.id}`,
        },
        (payload) => {
          const updatedGem = payload.new as Gem

          // Update items array
          setItems(prev => prev.map(item => {
            if (item.id === updatedGem.id) {
              return {
                ...item,
                status: updatedGem.status,
                current_price: updatedGem.current_price,
                round_end_time: updatedGem.round_end_time,
              }
            }
            return item
          }))

          // Auto-navigate to newly activated item
          if (updatedGem.status === 'active' && selectedItemIdRef.current !== updatedGem.id) {
            setItems(prev => {
              const found = prev.find(i => i.id === updatedGem.id)
              if (found) {
                setSelectedItem({ ...found, status: updatedGem.status, current_price: updatedGem.current_price, round_end_time: updatedGem.round_end_time })
              }
              return prev
            })
            setTimeout(() => {
              itemRefs.current[updatedGem.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }, 100)
          }

          // Update selectedItem using ref to avoid stale closure
          if (selectedItemIdRef.current === updatedGem.id) {
            setSelectedItem(prev => {
              if (!prev) return prev

              // Reset accepted price status when price changes (new round) - for fixed increment
              if (prev.current_price !== updatedGem.current_price) {
                setHasAcceptedPrice(false)
                setShowNextRoundBanner(true)
                setTimeout(() => setShowNextRoundBanner(false), 4000)
              }

              // Reset bidding expired state when round_end_time changes (new round started)
              if (prev.round_end_time !== updatedGem.round_end_time) {
                setBiddingTimeExpired(false)
              }

              return {
                ...prev,
                status: updatedGem.status,
                current_price: updatedGem.current_price,
                round_end_time: updatedGem.round_end_time,
              }
            })
          }
        }
      )
      // Listen for auction updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${auction.id}`,
        },
        (payload) => {
          const updatedAuction = payload.new as Auction
          // Update auction state in real-time
          setAuction(prev => ({
            ...prev,
            status: updatedAuction.status,
            auction_start: updatedAuction.auction_start,
            auction_end: updatedAuction.auction_end,
          }))
        }
      )
      // Listen for winner announcements
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'auction_winners',
        },
        async (payload) => {
          const newWinner = payload.new as { gem_id: string; user_id: string; winning_bid_id: string }

          // Check if this winner is for one of our items
          const wonGem = initialItems.find(i => i.id === newWinner.gem_id)
          if (!wonGem) return

          // Fetch the winning bid amount
          let winningAmount = wonGem.starting_price
          if (newWinner.winning_bid_id) {
            const { data: winningBid } = await supabase
              .from('bids')
              .select('bid_amount')
              .eq('id', newWinner.winning_bid_id)
              .single()
            if (winningBid) {
              winningAmount = winningBid.bid_amount
            }
          }

          // Add to winners list with winning amount
          setWinners(prev => [...prev, {
            gem_id: newWinner.gem_id,
            user_id: newWinner.user_id,
            gem_name: wonGem.name,
            winning_amount: winningAmount
          }])

          // Show popup if current user is the winner
          if (newWinner.user_id === user.id) {
            setWonItem({ name: wonGem.name, amount: winningAmount })
            setShowWinnerPopup(true)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [auction.id, initialItems, user.id, supabase, isFixedIncrement, isFreeForm, isIncrementalApproval])

  // Subscribe to elimination events (incremental approval auctions only)
  useEffect(() => {
    if (!isIncrementalApproval) return

    const elimChannel = supabase
      .channel(`eliminations-${auction.id}-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gem_eliminations',
        },
        (payload) => {
          const record = payload.new as { gem_id: string; user_id: string }
          if (record.user_id === user.id) {
            setEliminatedGemIds(prev => new Set([...prev, record.gem_id]))
          }
          // Also increment global elimination count for early stop calculation
          setEliminationCounts(prev => ({
            ...prev,
            [record.gem_id]: (prev[record.gem_id] || 0) + 1
          }))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(elimChannel) }
  }, [auction.id, user.id, supabase, isIncrementalApproval])

  // Subscribe to hold status changes
  useEffect(() => {
    const holdChannel = supabase
      .channel(`hold-${auction.id}-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bidder_holds',
          filter: `auction_id=eq.${auction.id}`,
        },
        (payload) => {
          const record = payload.new as { user_id: string; is_active: boolean } | undefined
          if (record && record.user_id === user.id) {
            setIsHeld(record.is_active)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(holdChannel) }
  }, [auction.id, user.id, supabase])

  // Free-form bid handler
  const handleVariableBid = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem || isSubmitting || hasPlacedBid || isHeld) return

    const decimalAmount = new Decimal(bidAmount || '0').toDecimalPlaces(2)
    const amount = decimalAmount.toNumber()
    if (isNaN(amount) || amount < minBid) {
      confirm(`Minimum bid is ${formatCurrency(minBid)}`, { isAlert: true, confirmText: 'OK', title: 'Notice' })
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/gems/${selectedItem.id}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid_amount: amount }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to place bid')
      }

      // Immediately update UI state (don't wait for realtime)
      setHasPlacedBid(true)
      setUserBidAmount(amount)
      setBidAmount('')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to place bid'
      confirm(message, { isAlert: true, confirmText: 'OK', title: 'Notice' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Edit existing bid handler (Free-form only)
  const handleEditBid = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem || isSubmitting || isHeld) return

    const decimalEditAmount = new Decimal(bidAmount || '0').toDecimalPlaces(2)
    const amount = decimalEditAmount.toNumber()
    if (isNaN(amount) || amount < minBid) {
      confirm(`Minimum bid is ${formatCurrency(minBid)}`, { isAlert: true, confirmText: 'OK', title: 'Notice' })
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/gems/${selectedItem.id}/bids`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid_amount: amount }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update bid')
      }

      setUserBidAmount(amount)
      setBidAmount('')
      setIsEditingBid(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update bid'
      confirm(message, { isAlert: true, confirmText: 'OK', title: 'Notice' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Fixed increment bid handler
  const handleFixedBid = async () => {
    if (!selectedItem || isSubmitting || hasAcceptedPrice || isHeld) return

    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/gems/${selectedItem.id}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to accept price')
      }

      setHasAcceptedPrice(true)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to accept price'
      confirm(message, { isAlert: true, confirmText: 'OK', title: 'Notice' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const quickBid = (multiplier: number) => {
    setBidAmount(new Decimal(minBid).times(multiplier).toDecimalPlaces(2).toString())
  }

  // Check if current user won the selected item and get winning amount
  const selectedItemWinner = selectedItem && winners.find(
    w => w.gem_id === selectedItem.id
  )
  const isWinnerOfSelectedItem = selectedItemWinner?.user_id === user.id
  const selectedItemWinningAmount = selectedItemWinner?.winning_amount || currentBid

  // Status badge config
  const statusConfig: Record<string, { color: string; text: string; icon: string }> = {
    draft: { color: 'bg-gray-500/20 text-gray-400', text: 'DRAFT', icon: '' },
    upcoming: { color: 'bg-blue-500/20 text-blue-400', text: 'UPCOMING', icon: '' },
    registration_open: { color: 'bg-amber-500/20 text-amber-400', text: 'REGISTRATION', icon: '' },
    live: { color: 'bg-red-500/20 text-red-400', text: 'LIVE', icon: '' },
    ended: { color: 'bg-amber-500/20 text-amber-400', text: 'ENDED', icon: '' },
    completed: { color: 'bg-purple-500/20 text-purple-400', text: 'COMPLETED', icon: '' },
  }

  const currentStatus = statusConfig[auction.status] || statusConfig.live
  const isAuctionLive = auction.status === 'live'

  return (
    <div className="auction-room min-h-screen">
      {/* Hold Overlay  shown when user is held by admin */}
      {isHeld && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f18] border-2 border-red-500/40 rounded-2xl p-8 max-w-md mx-4 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-3xl font-black text-red-400 mb-3">Account On Hold</h2>
            <p className="text-[var(--text-secondary)] mb-6">
              Your bidding has been temporarily paused by the auction administrator.
            </p>
            {holdAdminPhone && (
              <div className="p-4 bg-[var(--surface)] rounded-xl border border-[var(--border)] mb-6">
                <p className="text-xs text-[var(--text-muted)] uppercase mb-2">For inquiries, contact admin</p>
                <a
                  href={`tel:${holdAdminPhone}`}
                  className="text-2xl font-bold text-[var(--gold)] hover:underline"
                >
                  {holdAdminPhone}
                </a>
              </div>
            )}
            <p className="text-sm text-[var(--text-muted)]">
              This page will update automatically when you are released.
            </p>
          </div>
        </div>
      )}

      {/* Elimination Overlay  shown when user is eliminated from the selected item (Incremental Approval) */}
      {isEliminated && !isHeld && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[65] w-full max-w-sm px-4">
          <div className="bg-gradient-to-br from-[#2a0a0a] to-[#1a0505] border-2 border-red-500/60 rounded-2xl p-5 text-center shadow-2xl animate-bounce-in">
            <div className="text-4xl mb-2"></div>
            <h3 className="text-lg font-black text-red-400 mb-1">You&apos;ve Been Eliminated!</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              You did not approve the price in time. You can watch, but can no longer bid on this item.
            </p>
          </div>
        </div>
      )}

      {/* Status Overlay - shown when auction is not live */}
      {!isAuctionLive && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f18] border-2 border-[var(--border)] rounded-2xl p-8 max-w-md mx-4 text-center">
            {auction.status === 'ended' || auction.status === 'completed' ? (
              <>
                <div className="text-6xl mb-4"></div>
                <h2 className="text-3xl font-black text-[var(--gold)] mb-2">Auction Ended</h2>
                <p className="text-[var(--text-secondary)] mb-6">
                  This auction has finished. Thank you for participating!
                </p>
                <a href="/my-auctions" className="btn-gold px-8 py-3 text-lg inline-block">
                  View My Auctions
                </a>
              </>
            ) : auction.status === 'registration_open' ? (
              <>
                <div className="text-6xl mb-4"></div>
                <h2 className="text-3xl font-black text-white mb-2">Waiting to Start</h2>
                <p className="text-[var(--text-secondary)] mb-4">
                  The auction will begin shortly. Stay on this page for automatic updates.
                </p>
                <div className="p-4 bg-[var(--surface)] rounded-xl mb-4">
                  <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Scheduled Start</p>
                  <p className="text-xl font-bold text-[var(--gold)]">
                    {new Date(auction.auction_start).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-emerald-400">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-sm">Listening for updates...</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4"></div>
                <h2 className="text-3xl font-black text-white mb-2">Auction Not Available</h2>
                <p className="text-[var(--text-secondary)] mb-6">
                  This auction is currently {auction.status.replace('_', ' ')}.
                </p>
                <a href="/" className="btn-outline px-6 py-2 inline-block">
                  Back to Home
                </a>
              </>
            )}
          </div>
        </div>
      )}

      {/* Next Round Banner */}
      {showNextRoundBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] animate-bounce-in">
          <div className="px-6 py-3 bg-blue-500 text-white rounded-full font-bold text-sm shadow-2xl flex items-center gap-2">
            <span></span>
            New round started! Price updated to {formatCurrency(fixedPrice)}
          </div>
        </div>
      )}

      {/* Points Popup */}
      {showPointsPopup && (
        <div className="points-popup text-4xl z-50" style={{ top: '30%', left: '50%', transform: 'translateX(-50%)' }}>
          +{pointsEarned} Points! 
        </div>
      )}

      {/* Winner Popup */}
      {showWinnerPopup && wonItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f18] border-2 border-[var(--gold)] rounded-2xl p-8 max-w-md mx-4 text-center animate-bounce-in">
            <div className="text-6xl mb-4"></div>
            <h2 className="text-3xl font-black text-[var(--gold)] mb-2">You Won!</h2>
            <p className="text-xl text-white mb-4">{wonItem.name}</p>
            <div className="p-4 bg-[var(--surface)] rounded-xl mb-6">
              <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Winning Bid</p>
              <p className="text-3xl font-black text-emerald-400">{formatCurrency(wonItem.amount)}</p>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Congratulations! You&apos;ll receive payment instructions shortly.
            </p>
            <button
              onClick={() => setShowWinnerPopup(false)}
              className="btn-gold px-8 py-3 text-lg"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Countdown Overlay  always visible when bidding is active */}
      {biddingCountdown && biddingCountdown !== '00:00' && selectedItem?.round_end_time && !biddingTimeExpired && (
        <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
          <div className="bg-black/90 backdrop-blur-xl border border-[var(--gold)]/40 rounded-2xl px-5 py-4 shadow-2xl min-w-[200px]" style={{ boxShadow: '0 0 30px rgba(212, 175, 55, 0.15)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="live-dot" />
              <span className="text-xs font-bold text-[var(--gold)] uppercase tracking-wider">Bidding Ends In</span>
            </div>
            <div className={`text-4xl font-mono font-black tracking-wider ${
              parseInt(biddingCountdown.split(':')[0]) === 0 && parseInt(biddingCountdown.split(':')[1] || biddingCountdown.split(':')[0]) < 30
                ? 'text-red-400 animate-pulse'
                : 'text-white'
            }`}>
              {biddingCountdown}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1 truncate max-w-[180px]">{selectedItem.name}</p>
          </div>
        </div>
      )}

      {/* Leave Auction Popup */}
      {showLeavePopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-bounce-in">
            <h3 className="text-xl font-bold text-white mb-2">Leave Auction?</h3>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              Are you sure you want to leave? You can always rejoin using your access link if the auction is still active.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeavePopup(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] text-white hover:bg-[var(--background)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => window.location.href = '/my-auctions'}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors"
              >
                Yes, Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--background)]/90 backdrop-blur-xl border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 ${currentStatus.color}`}>
              {isAuctionLive && <span className="live-dot" />}
              {currentStatus.icon && <span>{currentStatus.icon}</span>}
              <span className="hidden sm:inline">{currentStatus.text}</span>
            </div>
            <h1 className="text-base sm:text-xl font-bold text-white truncate">{auction.name}</h1>
            <span className={`hidden sm:inline px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
              isIncrementalApproval
                ? 'bg-red-500/20 text-red-400'
                : isFixedIncrement
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {isIncrementalApproval
                ? ' Progressive Elimination Auction'
                : isFixedIncrement
                  ? 'English Auction'
                  : 'Closed Bid Auction'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {rewards && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-[var(--surface)] rounded-full">
                <span className="text-base sm:text-xl"></span>
                <span className="font-bold text-[var(--gold)] text-sm sm:text-base">{rewards.total_points}</span>
                <span className="text-xs sm:text-sm text-[var(--text-muted)] hidden sm:inline">pts</span>
              </div>
            )}
            <button
              onClick={() => setShowLeavePopup(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-full transition-colors text-sm font-medium border border-red-500/30"
              title="Leave Auction"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="grid lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Items List - horizontal scroll on mobile */}
          <div className="lg:col-span-1 space-y-3 sm:space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-white">Items ({items.length})</h2>
            <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:max-h-[calc(100vh-200px)] pb-2 lg:pb-0 lg:pr-2 -mx-3 px-3 lg:mx-0 lg:px-0">
              {items.map((item) => {
                // For free-form: only show starting price. For fixed: show current round price
                const displayPrice = isFreeForm
                  ? item.starting_price
                  : (item.current_price || item.starting_price)
                const isSelected = selectedItem?.id === item.id
                const isItemEnded = item.status === 'ended' || item.status === 'completed'
                const userWonThisItem = winners.some(w => w.gem_id === item.id && w.user_id === user.id)
                // Check if user has placed a bid on this item (for free-form)
                const userBidOnItem = isFreeForm && item.bids?.some(b => b.user_id === user.id)
                // Check if bidding has started for this item (free-form)
                const biddingStarted = !!item.round_end_time
                const biddingActive = biddingStarted && new Date(item.round_end_time!) > new Date()

                const isItemActive = item.status === 'active'

                  return (
                    <button
                      key={item.id}
                      ref={(el) => { itemRefs.current[item.id] = el }}
                      onClick={() => setSelectedItem(item)}
                      className={`flex-shrink-0 w-[140px] lg:w-full p-3 lg:p-4 rounded-xl text-left transition-all relative ${
                        userWonThisItem
                          ? 'bg-emerald-500/20 border-2 border-emerald-500/50'
                          : isSelected 
                            ? 'bg-[var(--gold)]/20 border-2 border-[var(--gold)]' 
                            : isItemEnded
                              ? 'bg-[var(--surface)]/50 border border-amber-500/30 opacity-75'
                              : 'bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--gold)]/50'
                      }`}
                    >
                      {userWonThisItem ? (
                        <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-500/30 border border-emerald-500/50 rounded text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                          <Trophy className="w-3 h-3" /> WON
                        </div>
                      ) : isItemEnded ? (
                        <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded text-[10px] font-bold text-amber-400">
                          ENDED
                        </div>
                      ) : userBidOnItem && (
                        <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                          <Check className="w-3 h-3" /> BID
                        </div>
                      )}
                      <div className="flex flex-col lg:flex-row items-center lg:items-center gap-2 lg:gap-3">
                        <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-lg overflow-hidden flex-shrink-0 ${
                          isItemEnded ? 'bg-[var(--background-secondary)] opacity-60' : 'bg-[var(--background-secondary)]'
                        }`}>
                          {item.gem_images?.[0]?.image_url ? (
                            <img 
                              src={item.gem_images[0].image_url}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl lg:text-2xl opacity-30"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-center lg:text-left">
                          <h3 className="font-bold text-white truncate text-xs lg:text-base">{item.name}</h3>
                          <p className={`font-mono text-xs lg:text-sm ${isItemEnded ? 'text-amber-400' : 'text-[var(--gold)]'}`}>
                            {formatCurrency(displayPrice)}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {isItemEnded 
                              ? 'Finished' 
                              : isFreeForm 
                                ? (!biddingStarted 
                                    ? ' Not started' 
                                    : userBidOnItem 
                                      ? 'Bid placed' 
                                      : biddingActive 
                                        ? ' Open' 
                                        : 'Closed')
                                : `${new Set(item.bids?.filter(b => b.bid_amount >= (item.current_price || item.starting_price)).map(b => b.user_id)).size || 0} accepted`
                            }
                          </p>
                        </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Main Bidding Area */}
          <div className="lg:col-span-2">
            {selectedItem ? (
              <div className="card-glass rounded-2xl overflow-hidden">
                {/* Item Image/Video */}
                <div className="relative aspect-[16/10] sm:aspect-[4/3] overflow-hidden">
                  {selectedItem.gem_images?.length > 0 ? (
                    <ImageCarousel 
                      media={selectedItem.gem_images.map(img => ({ url: img.image_url, type: (img as any).media_type }))}
                      alt={selectedItem.name}
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[var(--surface)] to-[var(--background)] flex items-center justify-center">
                      <span className="text-6xl sm:text-8xl opacity-20"></span>
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 sm:p-6">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs sm:text-sm text-[var(--text-muted)] uppercase tracking-wider">
                          {isFixedIncrement ? 'Round Price' : 'Starting Price'}
                        </p>
                        <p className="text-2xl sm:text-4xl font-black text-[var(--gold)] font-mono animate-number-pop">
                          {formatCurrency(isFixedIncrement ? fixedPrice : selectedItem.starting_price)}
                        </p>
                      </div>
                      {isFixedIncrement && (
                        <div className="text-right">
                          <p className="text-xs sm:text-sm text-[var(--text-muted)]">Round Status</p>
                          <p className="text-sm sm:text-lg text-white">
                            {selectedItem.bids?.some(b => b.bid_amount >= fixedPrice)
                              ? 'Bid Placed'
                              : 'Waiting for Bid'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Item Details & Bid Form */}
                <div className="p-4 sm:p-6">
                  <h2 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2">{selectedItem.name}</h2>
                  <p className="text-sm text-[var(--text-secondary)] mb-4 sm:mb-6 line-clamp-2">{selectedItem.description}</p>

                  {/* Check if item bidding has ended */}
                  {(selectedItem.status === 'ended' || selectedItem.status === 'completed') ? (
                    <div className="space-y-4">
                      {selectedItemWinner ? (
                        isWinnerOfSelectedItem ? (
                          /* User won this item */
                          <div className="p-6 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl text-center">
                            <div className="flex items-center justify-center gap-2 mb-3">
                              <Trophy className="w-10 h-10 text-[var(--gold)]" />
                            </div>
                            <h3 className="text-2xl font-bold text-emerald-400 mb-2">You Won!</h3>
                            <p className="text-[var(--text-secondary)] text-sm mb-4">
                              Congratulations! This item is yours.
                            </p>
                            <div className="p-4 bg-[var(--surface)] rounded-lg mb-4">
                              <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Your Winning Bid</p>
                              <p className="text-3xl font-black text-emerald-400">{formatCurrency(selectedItemWinningAmount)}</p>
                            </div>
                            <p className="text-sm text-[var(--gold)]">
                              Check your email for payment instructions
                            </p>
                          </div>
                        ) : (
                          /* Item ended and user didn't win (apology card) */
                          <div className="p-6 bg-amber-500/10 border-2 border-amber-500/30 rounded-xl text-center">
                            <div className="text-4xl mb-3"></div>
                            <h3 className="text-xl font-bold text-amber-400 mb-2">Bidding Finished</h3>
                            <p className="text-[var(--text-secondary)] text-sm mb-4">
                              We are sorry, you did not win this gem. Better luck in the next auction!
                            </p>
                            <div className="p-4 bg-[var(--surface)] rounded-lg">
                              <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Winning Price</p>
                              <p className="text-3xl font-black text-[var(--gold)]">{formatCurrency(selectedItemWinningAmount)}</p>
                            </div>
                          </div>
                        )
                      ) : (
                        /* Winner is not announced/selected yet */
                        <div className="p-6 bg-amber-500/10 border-2 border-amber-500/30 rounded-xl text-center">
                          <div className="text-4xl mb-3"></div>
                          <h3 className="text-xl font-bold text-amber-400 mb-2">Bidding Finished</h3>
                          <p className="text-[var(--text-secondary)] text-sm mb-4">
                            This item&apos;s auction has ended.
                          </p>
                          <div className="p-4 bg-[var(--surface)] rounded-lg">
                            <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Final Price</p>
                            <p className="text-3xl font-black text-[var(--gold)]">{formatCurrency(currentBid)}</p>
                          </div>
                        </div>
                      )}
                      {!selectedItemWinner && (
                        <p className="text-center text-xs text-[var(--text-muted)]">
                          Winner will be announced shortly
                        </p>
                      )}
                    </div>
                  ) : isIncrementalApproval ? (
                    /* Incremental Approval UI */
                    <div className="space-y-4">
                      {isEliminated ? (
                        /* User has been eliminated from this item */
                        <div className="p-6 bg-red-500/10 border-2 border-red-500/30 rounded-xl text-center">
                          <div className="text-5xl mb-3"></div>
                          <h3 className="text-xl font-bold text-red-400 mb-2">You Were Eliminated</h3>
                          <p className="text-[var(--text-secondary)] text-sm mb-4">
                            You did not approve the price increase in time and were eliminated from this item.
                          </p>
                          <div className="p-4 bg-[var(--surface)] rounded-lg">
                            <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Final Price You Declined</p>
                            <p className="text-3xl font-black text-red-400">{formatCurrency(fixedPrice)}</p>
                          </div>
                        </div>
                      ) : !selectedItem.round_end_time ? (
                        /* Waiting for admin to start the first round */
                        <div className="p-6 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl text-center">
                          <div className="text-4xl mb-3"></div>
                          <h3 className="text-xl font-bold text-blue-400 mb-2">Waiting for Round</h3>
                          <p className="text-[var(--text-secondary)] text-sm mb-4">
                            The auction host will start the first round shortly. Be ready to approve the price!
                          </p>
                          <div className="p-4 bg-[var(--surface)] rounded-lg">
                            <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Starting Price</p>
                            <p className="text-3xl font-black text-[var(--gold)]">{formatCurrency(fixedPrice)}</p>
                          </div>
                          <div className="flex items-center justify-center gap-2 text-emerald-400 mt-4">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            <span className="text-sm">Waiting for host...</span>
                          </div>
                        </div>
                      ) : biddingTimeExpired ? (
                        /* Round time expired */
                        <div className="p-6 bg-purple-500/10 border-2 border-purple-500/30 rounded-xl text-center">
                          <div className="text-4xl mb-3"></div>
                          <h3 className="text-xl font-bold text-purple-400 mb-2">Round Ended</h3>
                          <p className="text-[var(--text-secondary)] text-sm mb-4">
                            {hasAcceptedPrice
                              ? ' You approved! Waiting for the next round...'
                              : ' Time ran out. The host will now eliminate non-approvers.'}
                          </p>
                          <div className="p-4 bg-[var(--surface)] rounded-lg">
                            <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Round Price</p>
                            <p className="text-3xl font-black text-[var(--gold)]">{formatCurrency(fixedPrice)}</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {biddingCountdown && biddingCountdown !== '00:00' && (
                            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                              <p className="text-xs text-red-400 uppercase mb-1">Approve before time runs out!</p>
                              <p className="text-3xl font-mono font-bold text-red-400">{biddingCountdown}</p>
                            </div>
                          )}

                          <div className="p-4 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[var(--text-muted)]">Current Price</span>
                              <span className="text-2xl font-bold text-[var(--gold)]">{formatCurrency(fixedPrice)}</span>
                            </div>
                            <p className="text-xs text-red-400 font-medium">
                               You must approve this price or you will be permanently eliminated!
                            </p>
                          </div>

                          {hasAcceptedPrice ? (
                            <div className="flex items-center justify-center gap-3 py-4 px-6 bg-emerald-500/20 border border-emerald-500/40 rounded-xl">
                              <Check className="w-6 h-6 text-emerald-400" />
                              <span className="font-bold text-emerald-400">Price Approved! You&apos;re still in.</span>
                            </div>
                          ) : (
                            <button
                              onClick={handleFixedBid}
                              disabled={isSubmitting || biddingTimeExpired}
                              className="btn-gold w-full py-4 text-lg flex items-center justify-center gap-2"
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                  <span>Approving...</span>
                                </>
                              ) : (
                                <span> Approve {formatCurrency(fixedPrice)}</span>
                              )}
                            </button>
                          )}

                          <p className="text-center text-xs text-[var(--text-muted)]">
                            Not approving = permanent elimination from this item
                          </p>
                        </>
                      )}
                    </div>
                  ) : isFixedIncrement ? (
                    /* Fixed Increment UI */
                    <div className="space-y-4">
                      {/* Check if round has started */}
                      {!selectedItem.round_end_time ? (
                        /* Waiting for round to start */
                        <div className="p-6 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl text-center">
                          <div className="text-4xl mb-3"></div>
                          <h3 className="text-xl font-bold text-blue-400 mb-2">Waiting for Round</h3>
                          <p className="text-[var(--text-secondary)] text-sm mb-4">
                            The auction host will start the bidding round shortly.
                          </p>
                          <div className="p-4 bg-[var(--surface)] rounded-lg">
                            <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Starting Price</p>
                            <p className="text-3xl font-black text-[var(--gold)]">{formatCurrency(fixedPrice)}</p>
                          </div>
                        </div>
                      ) : biddingTimeExpired ? (
                        /* Round time expired */
                        <div className="p-6 bg-purple-500/10 border-2 border-purple-500/30 rounded-xl text-center">
                          <div className="text-4xl mb-3"></div>
                          <h3 className="text-xl font-bold text-purple-400 mb-2">Round Ended</h3>
                          <p className="text-[var(--text-secondary)] text-sm mb-4">
                            {selectedItem?.bids?.some(b => b.bid_amount >= fixedPrice)
                              ? selectedItem.bids.find(b => b.bid_amount >= fixedPrice)?.user_id === user.id
                                ? 'You won this round! Waiting for the next round...'
                                : `Round claimed by ${((auction?.status === 'completed' || !!selectedItemWinner) ? (selectedItem.bids.find(b => b.bid_amount >= fixedPrice)?.user?.display_name || selectedItem.bids.find(b => b.bid_amount >= fixedPrice)?.user?.anonymous_name) : selectedItem.bids.find(b => b.bid_amount >= fixedPrice)?.user?.anonymous_name) || 'Another User'}. Waiting for next round...`
                              : 'This round is over. Waiting for the host to proceed.'}
                          </p>
                          <div className="p-4 bg-[var(--surface)] rounded-lg">
                            <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Round Price</p>
                            <p className="text-3xl font-black text-[var(--gold)]">{formatCurrency(fixedPrice)}</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {biddingCountdown && biddingCountdown !== '00:00' && (
                            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center">
                              <p className="text-xs text-amber-400 uppercase mb-1">Round ends in</p>
                              <p className="text-3xl font-mono font-bold text-amber-400">{biddingCountdown}</p>
                            </div>
                          )}

                          <div className="p-4 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[var(--text-muted)]">Round Price</span>
                              <span className="text-2xl font-bold text-[var(--gold)]">{formatCurrency(fixedPrice)}</span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)]">
                              Be the first to bid at this price to win the round!
                            </p>
                          </div>

                          {selectedItem?.bids?.some(b => b.bid_amount >= fixedPrice) ? (
                            <div className="flex items-center justify-center gap-3 py-4 px-6 bg-emerald-500/20 border border-emerald-500/40 rounded-xl">
                              <Check className="w-6 h-6 text-emerald-400" />
                              <span className="font-bold text-emerald-400">
                                {selectedItem.bids.find(b => b.bid_amount >= fixedPrice)?.user_id === user.id
                                  ? 'You claimed this round!'
                                  : `Claimed by ${((auction?.status === 'completed' || !!selectedItemWinner) ? (selectedItem.bids.find(b => b.bid_amount >= fixedPrice)?.user?.display_name || selectedItem.bids.find(b => b.bid_amount >= fixedPrice)?.user?.anonymous_name) : selectedItem.bids.find(b => b.bid_amount >= fixedPrice)?.user?.anonymous_name) || 'Another User'}`}
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={handleFixedBid}
                              disabled={isSubmitting || biddingTimeExpired}
                              className="btn-gold w-full py-4 text-lg flex items-center justify-center gap-2"
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                  <span>Placing Bid...</span>
                                </>
                              ) : (
                                <span>Place Bid {formatCurrency(fixedPrice)}</span>
                              )}
                            </button>
                          )}

                          <p className="text-center text-xs text-[var(--text-muted)]">
                             Earn 10 points for each round you win!
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    /* Free-form Bidding UI */
                    <div className="space-y-4">
                      {/* Check if bidding round has started and is active */}
                      {!selectedItem.round_end_time ? (
                        /* Waiting for bidding to start */
                        <div className="p-6 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl text-center">
                          <div className="text-4xl mb-3"></div>
                          <h3 className="text-xl font-bold text-blue-400 mb-2">Bidding Not Started</h3>
                          <p className="text-[var(--text-secondary)] text-sm mb-4">
                            The auction host will start the bidding shortly.
                          </p>
                          <div className="p-4 bg-[var(--surface)] rounded-lg">
                            <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Starting Price</p>
                            <p className="text-3xl font-black text-[var(--gold)]">{formatCurrency(selectedItem.starting_price)}</p>
                          </div>
                          <div className="flex items-center justify-center gap-2 text-emerald-400 mt-4">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            <span className="text-sm">Waiting for start...</span>
                          </div>
                        </div>
                      ) : biddingTimeExpired ? (
                        /* Bidding time expired - waiting for winner */
                        <div className="p-6 bg-purple-500/10 border-2 border-purple-500/30 rounded-xl text-center">
                          <div className="text-4xl mb-3"></div>
                          <h3 className="text-xl font-bold text-purple-400 mb-2">Bidding Ended</h3>
                          {hasPlacedBid ? (
                            <>
                              <div className="p-4 bg-[var(--surface)] rounded-lg mb-4">
                                <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Your Bid</p>
                                <p className="text-2xl font-black text-emerald-400">{formatCurrency(userBidAmount || 0)}</p>
                              </div>
                              <p className="text-[var(--text-secondary)] text-sm mb-4">
                                Your bid has been submitted successfully.
                              </p>
                            </>
                          ) : (
                            <p className="text-[var(--text-secondary)] text-sm mb-4">
                              You did not place a bid for this item.
                            </p>
                          )}
                          <div className="flex items-center justify-center gap-2 text-purple-400">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                            <span className="text-sm">Waiting for winner announcement...</span>
                          </div>
                        </div>
                      ) : hasPlacedBid ? (
                        /* User already placed their bid  can edit before countdown ends */
                        <div className="space-y-4">
                          {biddingCountdown && biddingCountdown !== '00:00' && (
                            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center">
                              <p className="text-xs text-amber-400 uppercase mb-1">Bidding ends in</p>
                              <p className="text-3xl font-mono font-bold text-amber-400">{biddingCountdown}</p>
                            </div>
                          )}

                          {isEditingBid ? (
                            <form onSubmit={handleEditBid} className="space-y-4">
                              <fieldset disabled={isSubmitting} className="border-0 p-0 m-0 min-w-0 space-y-4">
                                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                                  <p className="text-sm text-blue-300 text-center">
                                    Update your bid before time runs out
                                  </p>
                                </div>
                                <div>
                                  <label className="block text-sm text-[var(--text-muted)] mb-2">
                                    New Bid Amount (min: {formatCurrency(minBid)})
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">LKR</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={bidAmount ? bidAmount.split('.').map((p,i) => i===0 ? p.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') : p).join('.') : ''}
                                      onChange={(e) => setBidAmount(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                                      placeholder={(userBidAmount || minBid).toString()}
                                      className="w-full pl-8 pr-4 py-4 text-2xl font-bold bg-[var(--surface)] border-2 border-[var(--border)] rounded-xl focus:border-[var(--gold)] text-white"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-3">
                                  <button
                                    type="button"
                                    onClick={() => { setIsEditingBid(false); setBidAmount('') }}
                                    className="flex-1 py-3 bg-[var(--surface)] border border-[var(--border)] text-white font-bold rounded-xl hover:bg-[var(--surface-elevated)] transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={isSubmitting || !bidAmount}
                                    className="flex-1 btn-gold py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                  >
                                    {isSubmitting ? (
                                      <><Loader2 className="w-5 h-5 animate-spin" /><span>Updating...</span></>
                                    ) : (
                                      <span>Update Bid</span>
                                    )}
                                  </button>
                                </div>
                              </fieldset>
                            </form>
                          ) : (
                            <>
                              <div className="flex items-center justify-center gap-3 py-6 px-6 bg-emerald-500/20 border border-emerald-500/40 rounded-xl">
                                <Check className="w-8 h-8 text-emerald-400" />
                                <div className="text-center">
                                  <span className="font-bold text-emerald-400 text-xl block">Bid Placed!</span>
                                  <span className="text-emerald-300 text-lg">{formatCurrency(userBidAmount || 0)}</span>
                                </div>
                              </div>

                              {!biddingTimeExpired && biddingCountdown && biddingCountdown !== '00:00' && (
                                <button
                                  onClick={() => { setIsEditingBid(true); setBidAmount((userBidAmount || '').toString()) }}
                                  className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] font-bold rounded-xl hover:border-[var(--gold)]/50 transition-colors"
                                >
                                  <Pencil className="w-4 h-4" />
                                  Edit Bid
                                </button>
                              )}

                              <p className="text-center text-sm text-[var(--text-muted)]">
                                {!biddingTimeExpired && biddingCountdown && biddingCountdown !== '00:00'
                                  ? 'You can edit your bid until the countdown ends.'
                                  : 'Your bid has been submitted. Winner will be announced when bidding ends.'}
                              </p>
                              <div className="p-4 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
                                <p className="text-xs text-[var(--text-muted)] uppercase mb-1 text-center">Note</p>
                                <p className="text-sm text-[var(--text-secondary)] text-center">
                                  Bids are closed. You cannot see other participants&apos; bids.
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        /* Bid form for new bidders */
                        <form onSubmit={handleVariableBid} className="space-y-4">
                          <fieldset disabled={isSubmitting} className="border-0 p-0 m-0 min-w-0 space-y-4">
                          {/* Countdown timer */}
                          {biddingCountdown && (
                            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                              <p className="text-xs text-red-400 uppercase mb-1">Time remaining</p>
                              <p className="text-3xl font-mono font-bold text-red-400">{biddingCountdown}</p>
                            </div>
                          )}
                          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                            <p className="text-sm text-blue-300 text-center">
                              Place your bid below. You can edit it until the countdown ends.
                            </p>
                          </div>
                          
                          <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-2">
                              Your Bid (min: {formatCurrency(minBid)})
                            </label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">LKR</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={bidAmount ? bidAmount.split('.').map((p,i) => i===0 ? p.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') : p).join('.') : ''}
                                onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
                                      setBidAmount(val)
                                    }}
                                placeholder={minBid.toString()}
                                className="w-full pl-8 pr-4 py-4 text-2xl font-bold bg-[var(--surface)] border-2 border-[var(--border)] rounded-xl focus:border-[var(--gold)] text-white"
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={isSubmitting || !bidAmount}
                            className="btn-gold w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Placing Bid...</span>
                              </>
                            ) : (
                              <span>Place Bid {bidAmount ? formatCurrency(new Decimal(bidAmount).toDecimalPlaces(2).toNumber()) : ''}</span>
                            )}
                          </button>

                          <p className="text-center text-xs text-[var(--text-muted)]">
                             Closed bid - others cannot see your bid
                          </p>
                          </fieldset>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card-glass rounded-2xl p-12 text-center">
                <span className="text-6xl mb-4 block"></span>
                <p className="text-[var(--text-secondary)]">Select an item to start bidding</p>
              </div>
            )}
          </div>

          {/* Bid History / Status Panel */}
          <div className="lg:col-span-1">
            {isIncrementalApproval ? (
              /* Incremental Approval: Show approvals and elimination status */
              <>
                <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">
                   Round Status
                </h2>

                {/* User status */}
                <div className={`p-4 rounded-xl border mb-4 ${
                  isEliminated
                    ? 'bg-red-500/10 border-red-500/30'
                    : hasAcceptedPrice
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-[var(--surface)] border-[var(--border)]'
                }`}>
                  <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Your Status</p>
                  <p className={`font-bold text-lg ${
                    isEliminated ? 'text-red-400' : hasAcceptedPrice ? 'text-emerald-400' : 'text-white'
                  }`}>
                    {isEliminated ? ' Eliminated' : hasAcceptedPrice ? ' Approved' : ' Pending'}
                  </p>
                </div>

                {/* Participation stats */}
                <div className="p-4 bg-[var(--surface)] rounded-xl border border-[var(--border)] mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[var(--text-muted)]">Approvals</span>
                    <span className="text-xl font-bold text-[var(--gold)]">{bidderPercentage}%</span>
                  </div>
                  <div className="w-full bg-[var(--background)] rounded-full h-3 mb-2">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${bidderPercentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    {currentPriceBidders} of {registeredCount} active bidders approved
                  </p>
                </div>

                <div
                  ref={bidsContainerRef}
                  className="bid-ticker max-h-[40vh] lg:max-h-[calc(100vh-400px)] overflow-y-auto"
                >
                  {selectedItem?.bids?.filter(b => b.bid_amount >= fixedPrice).length ? (
                    selectedItem.bids
                      .filter(b => b.bid_amount >= fixedPrice)
                      .map((bid) => (
                        <div
                          key={bid.id}
                          className={`bid-item ${newBidHighlight === bid.id ? 'animate-bid-flash' : ''}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-400" />
                              <span className="text-white font-medium">
                                {((auction?.status === 'completed' || !!selectedItemWinner) ? (bid.user?.display_name || bid.user?.anonymous_name) : bid.user?.anonymous_name) || 'Anonymous'}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-[var(--text-muted)]">
                            {new Date(bid.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div className="p-8 text-center text-[var(--text-muted)]">
                      <span className="text-4xl block mb-2"></span>
                      No approvals yet this round
                    </div>
                  )}
                </div>
              </>
            ) : isFixedIncrement ? (
              /* Fixed Increment: Show bid history */
              <>
                <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">
                  Bid History
                </h2>

                <div
                  ref={bidsContainerRef}
                  className="bid-ticker max-h-[40vh] lg:max-h-[calc(100vh-200px)] overflow-y-auto"
                >
                  {selectedItem?.bids?.length ? (
                    selectedItem.bids
                      .sort((a, b) => b.bid_amount - a.bid_amount)
                      .map((bid) => (
                        <div
                          key={bid.id}
                          className={`bid-item ${newBidHighlight === bid.id ? 'animate-bid-flash' : ''}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-400" />
                              <span className="text-white font-medium">
                                {((auction?.status === 'completed' || !!selectedItemWinner) ? (bid.user?.display_name || bid.user?.anonymous_name) : bid.user?.anonymous_name) || 'Anonymous'}
                              </span>
                            </div>
                            <div className="text-[var(--gold)] font-bold text-sm">
                              {formatCurrency(bid.bid_amount)}
                            </div>
                          </div>
                          <span className="text-xs text-[var(--text-muted)]">
                            {new Date(bid.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div className="p-8 text-center text-[var(--text-muted)]">
                      <span className="text-4xl block mb-2"></span>
                      No bids yet
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Free-form: Closed bids - show info panel */
              <>
                <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">
                  Auction Info
                </h2>
                <div className="space-y-4">
                  <div className="p-6 bg-[var(--surface)] rounded-xl border border-[var(--border)] text-center">
                    <span className="text-5xl block mb-3"></span>
                    <h3 className="text-lg font-bold text-white mb-2">Closed Bids</h3>
                    <p className="text-sm text-[var(--text-muted)]">
                      All bids are private. You cannot see other participants&apos; bids.
                    </p>
                  </div>

                  <div className="p-4 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl"></span>
                      <span className="font-bold text-white">Rules</span>
                    </div>
                    <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-400"></span>
                        One bid per item
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-400"></span>
                        Bids are hidden from others
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-400"></span>
                        Highest bid wins
                      </li>
                    </ul>
                  </div>

                  {hasPlacedBid && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-emerald-400">Your Bid</span>
                      </div>
                      <p className="text-2xl font-black text-emerald-300">{formatCurrency(userBidAmount || 0)}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chat Widget */}
      {isAuctionLive && (
        <AuctionChatWidget auctionId={auction.id} userId={user.id} />
      )}
    </div>
  )
}






