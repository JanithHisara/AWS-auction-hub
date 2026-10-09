'use client'

import { useConfirm } from '@/components/ui/ConfirmProvider';
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Loader2, Play, Users, Radio, StopCircle, CheckCircle, AlertTriangle, Lock } from 'lucide-react'

type AuctionStatus = 'draft' | 'upcoming' | 'registration_open' | 'registration_closed' | 'live' | 'ended' | 'completed'

interface Props {
  auctionId: string
  currentStatus: AuctionStatus
  itemCount: number
unpublishedItemCount?: number
  approvedCount: number
}

const statusFlow: Record<AuctionStatus, { next: AuctionStatus | null; label: string; icon: React.ReactNode; color: string; description: string }> = {
  draft: { 
    next: 'upcoming', 
    label: 'Publish Auction', 
    icon: <Play className="w-4 h-4" />,
    color: 'bg-blue-500 hover:bg-blue-600',
    description: 'Make this auction visible to users. They can see it but cannot register yet.'
  },
  upcoming: { 
    next: 'registration_open', 
    label: 'Open Registration', 
    icon: <Users className="w-4 h-4" />,
    color: 'bg-emerald-500 hover:bg-emerald-600',
    description: 'Allow users to register for this auction. Make sure all items are added.'
  },
    registration_open: { 
    next: 'registration_closed', 
    label: 'Close Registration', 
    icon: <Lock className="w-4 h-4" />,
    color: 'bg-indigo-500 hover:bg-indigo-600',
    description: 'Stop accepting new registrations. Devices will now show the auction screen.'
  },
  registration_closed: { 
    next: 'live', 
    label: 'Go Live', 
    icon: <Radio className="w-4 h-4" />,
    color: 'bg-red-500 hover:bg-red-600',
    description: 'Start the live auction. Approved bidders will be able to place bids.'
  },
  live: { 
    next: 'ended', 
    label: 'End Auction', 
    icon: <StopCircle className="w-4 h-4" />,
    color: 'bg-amber-500 hover:bg-amber-600',
    description: 'Stop accepting bids. You can then select winners for each item.'
  },
  ended: { 
    next: 'completed', 
    label: 'Mark Complete', 
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'bg-purple-500 hover:bg-purple-600',
    description: 'Finalize the auction. All winners have been selected and notified.'
  },
  completed: { 
    next: null, 
    label: 'Auction Completed', 
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'bg-gray-500',
    description: 'This auction has been completed.'
  },
}

export default function IncrementalStatusActions({
  auctionId, currentStatus, itemCount, unpublishedItemCount = 0, approvedCount }: Props) {
  const confirm = useConfirm();
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  const current = statusFlow[currentStatus]
  const nextStatus = current.next

  const handleAction = async () => {
    if (!nextStatus || isLoading) return
    
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/auctions/${auctionId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update status')
      }

      setShowConfirm(false)
      router.refresh()
    } catch (error) {
      confirm(error instanceof Error ? error.message : 'Failed to update status', { isAlert: true, confirmText: 'OK', title: 'Notice' })
    } finally {
      setIsLoading(false)
    }
  }

  // Warnings based on current state
  const warnings: string[] = []
  const blockingErrors: string[] = []
  if (nextStatus === 'registration_open' && unpublishedItemCount > 0) {
    blockingErrors.push('Cannot open registration: ' + unpublishedItemCount + ' item(s) are not published')
  }

    if (currentStatus === 'upcoming' && itemCount === 0) {
    warnings.push('No items added to this auction yet')
  }
  if (currentStatus === 'registration_open' && approvedCount === 0) {
    warnings.push('No approved registrations yet')
  }
  if (currentStatus === 'registration_open' && itemCount === 0) {
    warnings.push('No items in this auction')
  }

  if (!nextStatus) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/40 rounded-lg">
        <CheckCircle className="w-5 h-5 text-purple-400" />
        <span className="text-purple-400 font-medium">Auction Completed</span>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium transition-all ${current.color}`}
      >
        {current.icon}
        <span>{current.label}</span>
      </button>

      {/* Confirmation Modal - Portal to document.body */}
      {mounted && showConfirm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a24] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${current.color.split(' ')[0]}/20`}>
                {current.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{current.label}?</h3>
              <p className="text-[var(--text-secondary)] text-sm">
                {current.description}
              </p>
            </div>

            {/* Status change preview */}
            <div className="flex items-center justify-center gap-3 mb-6 p-3 bg-[var(--surface)] rounded-lg">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-500/20 text-gray-400">
                {currentStatus.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-[var(--text-muted)]"></span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                nextStatus === 'live' ? 'bg-red-500/20 text-red-400' :
                nextStatus === 'registration_open' ? 'bg-emerald-500/20 text-emerald-400' :
                nextStatus === 'ended' ? 'bg-amber-500/20 text-amber-400' :
                nextStatus === 'completed' ? 'bg-purple-500/20 text-purple-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>
                {nextStatus.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-400 font-medium text-sm mb-1">Warning</p>
                    <ul className="text-xs text-amber-400/80 space-y-1">
                      {warnings.map((w, i) => (
                        <li key={i}> {w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Blocking Errors */}
            {blockingErrors.length > 0 && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium text-sm mb-1">Cannot Proceed</p>
                    <ul className="text-xs text-red-400/80 space-y-1">
                      {blockingErrors.map((e, i) => (
                        <li key={i}> {e}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 bg-[var(--surface)] rounded-lg text-center">
                <p className="text-2xl font-bold text-white">{itemCount}</p>
                <p className="text-xs text-[var(--text-muted)]">Items</p>
              </div>
              <div className="p-3 bg-[var(--surface)] rounded-lg text-center">
                <p className="text-2xl font-bold text-white">{approvedCount}</p>
                <p className="text-xs text-[var(--text-muted)]">Approved Bidders</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white font-medium hover:bg-[var(--surface-elevated)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                  disabled={isLoading || blockingErrors.length > 0}
                className={`flex-1 px-4 py-3 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-all ${current.color}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    {current.icon}
                    <span>Confirm</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}


