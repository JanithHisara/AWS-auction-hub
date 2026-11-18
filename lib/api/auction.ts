'use client'

import type { Bid } from '@/types/database'

export interface AuctionActivity {
  registeredCount: number
  winners: Array<{ gem_id: string; user_id: string; gem_name: string; winning_amount: number }>
}

async function read<T>(url: string): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) return { data: null, error: { message: body.error || 'Request failed.' } }
    return { data: body, error: null }
  } catch {
    return { data: null, error: { message: 'Unable to connect to the server.' } }
  }
}

export function getAuctionActivity(auctionId: string) {
  return read<AuctionActivity>(`/api/auctions/${encodeURIComponent(auctionId)}/activity`)
}

export async function getGemBids(gemId: string) {
  const result = await read<{ bids: Bid[] }>(`/api/gems/${encodeURIComponent(gemId)}/bids`)
  return { data: result.data?.bids ?? null, error: result.error }
}

export function getPaymentStatus(gemId: string) {
  return read<{ isWinner: boolean; paymentCompleted: boolean }>(
    `/api/gems/${encodeURIComponent(gemId)}/payment-status`
  )
}
