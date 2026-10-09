'use client'

import { useState } from 'react'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import type { Bid } from '@/types/database'
import { Trophy, Loader2 } from 'lucide-react'

export default function SelectWinnerButton({ gemId, bids }: { gemId: string; bids: Bid[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const confirm = useConfirm()

  // Find highest bid to show preview
  const highestBid = bids.length > 0 
    ? bids.reduce((max, bid) => bid.bid_amount > max.bid_amount ? bid : max)
    : null

  const handleSelectWinner = async () => {
    if (loading) return
    if (!await confirm('Select the highest bidder as winner? This action cannot be undone.')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/auctions/${gemId}/select-winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to select winner')
      }

      router.refresh()
    } catch (error) {
      confirm(error instanceof Error ? error.message : 'Failed to select winner', { title: 'Error', confirmText: 'OK', cancelText: 'Close' })
    } finally {
      setLoading(false)
    }
  }

  if (bids.length === 0) {
    return (
      <div className="px-6 py-3 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] rounded-lg">
        No bids to select from
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Preview highest bid */}
      {highestBid && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <p className="text-xs text-emerald-400 uppercase mb-1">Highest Bid (Auto-Winner)</p>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(highestBid.bid_amount)}</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {(highestBid.user as { anonymous_name?: string; display_name?: string })?.display_name || (highestBid.user as { anonymous_name?: string })?.anonymous_name || 'Anonymous'}
          </p>
        </div>
      )}
      
      <button
        onClick={handleSelectWinner}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Selecting...
          </>
        ) : (
          <>
            <Trophy className="w-5 h-5" />
            Select Winner Automatically
          </>
        )}
      </button>
      <p className="text-xs text-center text-[var(--text-muted)]">
        Winner is auto-selected based on highest bid
      </p>
    </div>
  )
}


