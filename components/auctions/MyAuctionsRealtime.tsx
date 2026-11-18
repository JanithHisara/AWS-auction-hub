'use client'

import RealtimeAutoRefresh from '@/components/realtime/RealtimeAutoRefresh'
import type { ReactNode } from 'react'

interface Props {
  userId: string
  children: ReactNode
}

export default function MyAuctionsRealtime({ userId, children }: Props) {
  return (
    <>
      <RealtimeAutoRefresh
        channel={`my-auctions-${userId}`}
        tables={['auction_registrations', 'auctions']}
      />
      {children}
    </>
  )
}
