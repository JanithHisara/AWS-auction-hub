'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  gemId: string
  auctionId: string | null
  children: React.ReactNode
}

export default function GemDetailClient({ gemId, auctionId, children }: Props) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`admin-gem-${gemId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bids',
          filter: `gem_id=eq.${gemId}`,
        },
        () => {
          router.refresh()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'gems',
          filter: `id=eq.${gemId}`,
        },
        () => {
          router.refresh()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'auction_winners',
        },
        (payload) => {
          const record = payload.new as { gem_id?: string }
          if (record.gem_id === gemId) {
            router.refresh()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gemId, auctionId, router, supabase])

  return <>{children}</>
}
