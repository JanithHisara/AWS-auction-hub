'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getGemBids } from '@/lib/api/auction'
import type { Bid } from '@/types/database'

interface RealtimeBidUpdatesProps {
  gemId: string
  onBidUpdate: (bids: Bid[]) => void
}

export default function RealtimeBidUpdates({ gemId, onBidUpdate }: RealtimeBidUpdatesProps) {
  const [bids, setBids] = useState<Bid[]>([])

  useEffect(() => {
    const supabase = createClient()

    // Fetch initial bids
    const fetchBids = async () => {
      const { data } = await getGemBids(gemId)

      if (data) {
        setBids(data)
        onBidUpdate(data)
      }
    }

    fetchBids()

    // Subscribe to real-time updates
    if (!supabase?.channel) return
    const channel = supabase
      .channel(`bids:${gemId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bids',
          filter: `gem_id=eq.${gemId}`,
        },
        async () => {
          // Refetch bids when changes occur
          const { data } = await getGemBids(gemId)

          if (data) {
            setBids(data)
            onBidUpdate(data)
          }
        }
      )
      .subscribe()

    return () => {
      supabase?.removeChannel?.(channel)
    }
  }, [gemId, onBidUpdate])

  return null
}


