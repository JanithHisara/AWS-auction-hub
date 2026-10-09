'use client'

import { useConfirm } from '@/components/ui/ConfirmProvider';
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Shield, ShieldOff, Phone } from 'lucide-react'

interface HeldBidder {
  id: string
  user_id: string
  reason: string | null
  held_at: string
  user?: {
    id: string
    email: string
    anonymous_name?: string
    phone?: string | null
    display_name?: string | null
  }
}

interface Registration {
  id: string
  user_id: string
  approval_status: string
  user?: {
    email: string
    anonymous_name?: string
    display_name?: string | null
  }
}

interface Props {
  auctionId: string
  registrations: Registration[]
}

export default function BidderHoldManager({
  auctionId, registrations }: Props) {
  const confirm = useConfirm();
  const [holds, setHolds] = useState<HeldBidder[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [holdReason, setHoldReason] = useState('')
  const [showHoldModal, setShowHoldModal] = useState<string | null>(null)
  const supabase = createClient()

  const fetchHolds = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/auctions/${auctionId}/hold-bidder`)
      if (res.ok) {
        const data = await res.json()
        setHolds(data)
      }
    } catch (e) {
      console.error('Failed to fetch holds', e)
    } finally {
      setLoading(false)
    }
  }, [auctionId])

  useEffect(() => {
    fetchHolds()
  }, [fetchHolds])

  useEffect(() => {
    const channel = supabase
      .channel(`holds-${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bidder_holds',
          filter: `auction_id=eq.${auctionId}`,
        },
        () => { fetchHolds() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [auctionId, supabase, fetchHolds])

  const handleHold = async (userId: string) => {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/admin/auctions/${auctionId}/hold-bidder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, reason: holdReason || null }),
      })

      if (!res.ok) {
        let errMsg = 'Failed to hold bidder';
        try { const err = await res.json(); errMsg = err.error || errMsg; } catch { errMsg = 'Server returned HTML or invalid JSON (Status: ' + res.status + ')' }
        confirm(errMsg, { isAlert: true, confirmText: 'OK', title: 'Notice' })
      } else {
        setShowHoldModal(null)
        setHoldReason('')
        await fetchHolds()
      }
    } catch (error: any) {
      confirm(error?.message || 'Failed to hold bidder', { isAlert: true, confirmText: 'OK', title: 'Notice' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleRelease = async (userId: string) => {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/admin/auctions/${auctionId}/hold-bidder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })

      if (!res.ok) {
        let errMsg = 'Failed to release bidder';
        try { const err = await res.json(); errMsg = err.error || errMsg; } catch { errMsg = 'Server returned HTML or invalid JSON (Status: ' + res.status + ')' }
        confirm(errMsg, { isAlert: true, confirmText: 'OK', title: 'Notice' })
      } else {
        await fetchHolds()
      }
    } catch (error: any) {
      confirm(error?.message || 'Failed to release bidder', { isAlert: true, confirmText: 'OK', title: 'Notice' })
    } finally {
      setActionLoading(null)
    }
  }

  const heldUserIds = new Set(holds.map(h => h.user_id))
  const approvedRegistrations = registrations.filter(r => r.approval_status === 'approved')

  return (
    <div className="space-y-6">
      {/* Held Bidders Panel */}
      {holds.length > 0 && (
        <div className="card-glass rounded-xl p-4 sm:p-6 border border-red-500/30">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-red-400" />
            <h3 className="text-lg font-bold text-white">Held Bidders ({holds.length})</h3>
          </div>

          <div className="space-y-3">
            {holds.map((hold) => (
              <div key={hold.id} className="flex items-center justify-between gap-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">
                    {hold.user?.display_name || hold.user?.anonymous_name || hold.user?.email || "Unknown"}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{hold.user?.email}</p>
                  {hold.reason && (
                    <p className="text-xs text-red-300 mt-1">Reason: {hold.reason}</p>
                  )}
                  <p className="text-xs text-[var(--text-muted)]">
                    Held {new Date(hold.held_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleRelease(hold.user_id)}
                  disabled={actionLoading === hold.user_id}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {actionLoading === hold.user_id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldOff className="w-4 h-4" />
                  )}
                  Release
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bidders List with Hold Actions */}
      <div className="card-glass rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-[var(--text-muted)]" />
          <h3 className="text-lg font-bold text-white">Bidder Hold Controls</h3>
        </div>

        <p className="text-sm text-[var(--text-muted)] mb-4">
          Hold a bidder to freeze their ability to place bids. They will see a notification with your contact info.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : approvedRegistrations.length > 0 ? (
          <div className="space-y-2">
            {approvedRegistrations.map((reg) => {
              const isHeld = heldUserIds.has(reg.user_id)

              return (
                <div key={reg.id} className="flex items-center justify-between gap-4 p-3 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate text-sm">
                      {reg.user?.display_name || reg.user?.anonymous_name || reg.user?.email || "User " + (reg?.user_id || '').slice(-6)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">{reg.user?.email}</p>
                  </div>

                  {isHeld ? (
                    <span className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-lg flex items-center gap-1.5">
                      <Shield className="w-3 h-3" /> ON HOLD
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowHoldModal(reg.user_id)}
                      disabled={actionLoading === reg.user_id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {actionLoading === reg.user_id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Shield className="w-3 h-3" />
                      )}
                      Hold
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-center py-8 text-[var(--text-muted)]">No approved bidders yet</p>
        )}
      </div>

      {/* Hold Confirmation Modal */}
      {showHoldModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a24] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Hold Bidder</h3>
                <p className="text-sm text-[var(--text-muted)]">This will freeze the bidder&apos;s actions</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="e.g., Verification needed"
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white focus:border-red-400"
                />
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-300">
                    The bidder will see your admin phone number for inquiries. Make sure it&apos;s up to date in your profile.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowHoldModal(null); setHoldReason('') }}
                className="flex-1 px-4 py-3 bg-[var(--surface)] text-white font-bold rounded-xl hover:bg-[var(--surface-elevated)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleHold(showHoldModal)}
                disabled={actionLoading === showHoldModal}
                className="flex-1 px-4 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === showHoldModal ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                Confirm Hold
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

