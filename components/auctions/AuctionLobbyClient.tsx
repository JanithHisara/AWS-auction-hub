'use client'

import { useEffect, useState, useRef } from 'react'
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
  initialStatus: _initialStatus,
  initialApprovalStatus: _initialApprovalStatus,
  children,
}: Props) {
  const router = useRouter()
  const [notification, setNotification] = useState<{
    type: 'approved' | 'live' | 'round_ended' | 'next_round'
    message: string
  } | null>(null)
  const lastApprovalStatus = useRef<string | null>(_initialApprovalStatus || null)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase?.channel) return
    const channel = supabase
      .channel(`auction-${auctionId}`)
      // 1. Listen for auction status changes (e.g. going live)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${auctionId}`,
        },
        (payload) => {
          const updated = (payload.new || {}) as { status?: string }
          if (updated.status === 'live' || updated.status === 'active') {
            setNotification({ type: 'live', message: 'The auction is now LIVE! Transitioning...' })
            setTimeout(() => {
              router.refresh()
            }, 1000)
          } else {
            router.refresh()
          }
        }
      )
      // 2. Listen for registration status updates
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_registrations',
          filter: `auction_id=eq.${auctionId}`,
        },
        (payload) => {
          const updated = (payload.new || {}) as { user_id?: string; userId?: string; approval_status?: string; approvalStatus?: string }
          const targetUserId = updated.user_id ?? updated.userId
          const status = updated.approval_status ?? updated.approvalStatus
          if (userId && targetUserId === userId && status) {
            if (status !== lastApprovalStatus.current) {
              lastApprovalStatus.current = status
              if (status === 'approved') {
                setNotification({ type: 'approved', message: 'Your registration has been approved! Updating pass...' })
              }
              setTimeout(() => {
                router.refresh()
              }, 1200)
              return
            }
          }
          // Also refresh registration counts
          router.refresh()
        }
      )
      // 3. Listen for item changes (new item, round start / end, price)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gems',
        },
        (payload) => {
          const updated = (payload.new || payload.old || {}) as any
          const itemAuctionId = updated.auction_id ?? updated.auctionId
          if (!itemAuctionId || itemAuctionId === auctionId) {
            const roundEndTime = updated.round_end_time ?? updated.roundEndTime
            if (updated.status === 'active' && roundEndTime) {
              setNotification({ type: 'next_round', message: 'Bidding round has started!' })
              setTimeout(() => setNotification(null), 4000)
            } else if (updated.status === 'active' && !roundEndTime) {
              setNotification({ type: 'round_ended', message: 'Round ended. Waiting for next round...' })
              setTimeout(() => setNotification(null), 4000)
            }
            router.refresh()
          }
        }
      )

    channel.subscribe()

    return () => {
      supabase?.removeChannel?.(channel)
    }
  }, [auctionId, userId, router])

  return (
    <>
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-bounce-in">
          <div
            className={`px-6 py-3 rounded-full font-bold text-sm shadow-2xl flex items-center gap-2 border ${
              notification.type === 'approved'
                ? 'bg-emerald-600/90 text-white border-emerald-400'
                : notification.type === 'live'
                ? 'bg-red-600/90 text-white border-red-400'
                : notification.type === 'round_ended'
                ? 'bg-amber-600/90 text-white border-amber-400'
                : 'bg-blue-600/90 text-white border-blue-400'
            }`}
          >
            <span>
              {notification.type === 'approved'
                ? '✅'
                : notification.type === 'live'
                ? '🔴'
                : notification.type === 'round_ended'
                ? '⏰'
                : '🔔'}
            </span>
            <span>{notification.message}</span>
          </div>
        </div>
      )}
      {children}
    </>
  )
}
