'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  auctionId: string
  userId?: string
  initialStatus?: string
  initialApprovalStatus?: string
  children: React.ReactNode
}

export default function AuctionLobbyClient({
  auctionId,
  userId,
  initialStatus,
  initialApprovalStatus,
  children,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [notification, setNotification] = useState<{ type: 'approved' | 'live' | 'round_ended' | 'next_round'; message: string } | null>(null)
  const lastApprovalStatus = useRef<string | null>(initialApprovalStatus || null)
  const lastAuctionStatus = useRef<string | null>(initialStatus || null)

  const pollAuctionStatus = useCallback(async () => {
    try {
      await supabase.rpc('process_auction_schedule').catch(() => {})

      const { data } = await supabase
        .from('auctions')
        .select('status')
        .eq('id', auctionId)
        .single()

      if (!data) return

      if (lastAuctionStatus.current !== null && data.status !== lastAuctionStatus.current) {
        const prev = lastAuctionStatus.current
        lastAuctionStatus.current = data.status
        if (data.status === 'live' && prev !== 'live') {
          setNotification({ type: 'live', message: 'The auction is now LIVE! Unlocking live room...' })
        }
        setTimeout(() => router.refresh(), 500)
      } else if (lastAuctionStatus.current === null) {
        lastAuctionStatus.current = data.status
      }
    } catch {
      // Ignore background poll errors
    }
  }, [auctionId, supabase, router])

  const pollRegistrationStatus = useCallback(async () => {
    if (!userId) return
    try {
      const { data } = await supabase
        .from('auction_registrations')
        .select('approval_status')
        .eq('auction_id', auctionId)
        .eq('user_id', userId)
        .single()

      if (!data) return

      if (lastApprovalStatus.current !== null && data.approval_status !== lastApprovalStatus.current) {
        lastApprovalStatus.current = data.approval_status
        if (data.approval_status === 'approved') {
          setNotification({ type: 'approved', message: 'Your registration has been approved! Updating room access...' })
        }
        setTimeout(() => router.refresh(), 500)
      } else if (lastApprovalStatus.current === null) {
        lastApprovalStatus.current = data.approval_status
      }
    } catch {
      // Ignore background poll errors
    }
  }, [auctionId, userId, supabase, router])

  // Poll auction & registration status as reliable fallback
  useEffect(() => {
    const runPoll = () => {
      pollAuctionStatus()
      if (userId) pollRegistrationStatus()
    }

    runPoll()
    const interval = setInterval(runPoll, 2500)
    return () => clearInterval(interval)
  }, [userId, pollAuctionStatus, pollRegistrationStatus])

  // Realtime WebSocket channel subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`lobby-${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${auctionId}`,
        },
        (payload) => {
          const updated = payload.new as { status?: string }
          if (updated && updated.status) {
            if (updated.status === 'live') {
              setNotification({ type: 'live', message: 'The auction is now LIVE! Unlocking live room...' })
            }
            lastAuctionStatus.current = updated.status
            router.refresh()
          }
        }
      )

    if (userId) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_registrations',
          filter: `auction_id=eq.${auctionId}`,
        },
        (payload) => {
          const row = payload.new as any || {}
          const rowUserId = row.user_id || row.userId
          if (rowUserId === userId) {
            const approval = row.approval_status || row.approvalStatus
            lastApprovalStatus.current = approval || null
            if (approval === 'approved') {
              setNotification({ type: 'approved', message: 'Your registration has been approved! Updating room access...' })
            }
            router.refresh()
          }
        }
      )
    }

    // Listen for gem updates (round changes & price changes)
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'gems',
      },
      (payload) => {
        const updated = payload.new as any || {}
        const gemAuctionId = updated.auction_id || updated.auctionId
        if (gemAuctionId === auctionId) {
          if (updated.status === 'active' && updated.round_end_time === null) {
            setNotification({ type: 'round_ended', message: 'Round has ended. Waiting for next round...' })
            setTimeout(() => setNotification(null), 4000)
          }
          if (updated.round_end_time && updated.current_price) {
            setNotification({ type: 'next_round', message: 'New bidding round has started!' })
            setTimeout(() => setNotification(null), 4000)
          }
          router.refresh()
        }
      }
    )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [auctionId, userId, router, supabase])

  return (
    <>
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-bounce-in">
          <div className={`px-6 py-3 rounded-full font-bold text-sm shadow-2xl flex items-center gap-2 ${
            notification.type === 'approved'
              ? 'bg-emerald-500 text-white'
              : notification.type === 'live'
                ? 'bg-red-500 text-white'
                : notification.type === 'round_ended'
                  ? 'bg-amber-500 text-white'
                  : 'bg-blue-500 text-white'
          }`}>
            <span>{
              notification.type === 'approved' ? '✓' :
              notification.type === 'live' ? '🔴' :
              notification.type === 'round_ended' ? '⏱' : '⚡'
            }</span>
            {notification.message}
          </div>
        </div>
      )}
      {children}
    </>
  )
}
