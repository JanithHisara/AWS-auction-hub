import { formatCurrency, formatDate } from '@/lib/utils'
import type { Bid } from '@/types/database'

interface BidHistoryProps {
  isSealed?: boolean
  revealNames?: boolean
  bids: Bid[]
}

export default function BidHistory({ bids, isSealed, revealNames }: BidHistoryProps) {
  if (bids.length === 0) {
    return (
      <div className="card-glass rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Bid History</h2>
        <p className="text-[var(--text-muted)] text-center py-8">No bids yet</p>
      </div>
    )
  }

  return (
    <div className="card-glass rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white mb-4">Bid History ({bids.length})</h2>
      <div className="space-y-2">
        {bids.slice(0, 10).map((bid, index) => (
          <div
            key={bid.id}
            className={`flex justify-between items-center p-4 rounded-xl border ${
              index === 0
                ? 'bg-[var(--gold)]/10 border-[var(--gold)]/30'
                : 'bg-[var(--surface)] border-[var(--border)]'
            }`}
          >
            <div className="flex-1 min-w-0 pr-3">
              <p className={`font-bold font-mono ${index === 0 ? 'text-[var(--gold)]' : 'text-white'}`}>
                {isSealed ? '*** (Sealed)' : formatCurrency(bid.bid_amount)}
              </p>
              <p className="text-xs text-[var(--text-muted)] truncate">
                {(revealNames ? ((bid.user as { anonymous_name?: string, display_name?: string })?.display_name || (bid.user as { anonymous_name?: string })?.anonymous_name) : (bid.user as { anonymous_name?: string })?.anonymous_name) || 'Anonymous'}  {formatDate(bid.created_at)}
              </p>
            </div>
            {index === 0 && !isSealed && (
              <span className="px-3 py-1 bg-[var(--gold)] text-black text-xs font-bold rounded-full flex-shrink-0">
                LEADING
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}



