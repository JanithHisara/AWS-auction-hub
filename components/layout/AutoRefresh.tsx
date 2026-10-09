'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AutoRefresh() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const triggerRefresh = () => {
      router.refresh()
    }

    const isAuctionRoom = pathname?.includes('/auction-room/')

    let channel = null
    
    // Only subscribe to Postgres changes globally if we are NOT in the auction room.
    // The auction room handles real-time WebSockets instantly via its own local state.
    // Running router.refresh() on every WebSocket event in the auction room causes race conditions.
    if (!isAuctionRoom) {
      channel = supabase
        .channel('global-admin-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gems' }, triggerRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, triggerRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_registrations' }, triggerRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, triggerRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bidder_holds' }, triggerRefresh)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gem_eliminations' }, triggerRefresh)
        .subscribe()
    }

    // ALWAYS refresh immediately when the user returns to the tab (even in the auction room).
    // This fixes the issue where users miss WebSocket events while their computer is asleep or tab is hidden.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerRefresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Slow fallback polling (every 30 seconds) just in case realtime connection drops/fails.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        triggerRefresh()
      }
    }, 30000)

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [router, supabase, pathname])

  return null
}
