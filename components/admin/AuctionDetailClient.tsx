'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  auctionId: string
  children: React.ReactNode
}

export default function AuctionDetailClient({ auctionId, children }: Props) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`admin-auction-${auctionId}`)
      // Auction updates (status changes)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${auctionId}`,
        },
        () => {
          router.refresh()
        }
      )
      // New bids
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids',
        },
        () => {
          router.refresh()
        }
      )
      // Item updates
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gems',
          filter: `auction_id=eq.${auctionId}`,
        },
        () => {
          router.refresh()
        }
      )
      // Registration updates
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_registrations',
          filter: `auction_id=eq.${auctionId}`,
        },
        () => {
          router.refresh()
        }
      )
      // Winner announcements
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'auction_winners',
        },
        () => {
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [auctionId, router, supabase])

  return <>{children}</>
}
