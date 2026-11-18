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

  useEffect(() => {
    if (!auctionId) return
    const supabase = createClient()
    if (!supabase?.channel) return
    const channel = supabase
      .channel(`auction-${auctionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_winners' }, () => {
        router.refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gems' }, () => {
        router.refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, () => {
        router.refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_registrations' }, () => {
        router.refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bidder_holds' }, () => {
        router.refresh()
      })
      .subscribe()

    return () => {
      supabase?.removeChannel?.(channel)
    }
  }, [auctionId, router])

  return <>{children}</>
}
