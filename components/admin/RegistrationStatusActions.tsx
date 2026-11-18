'use client'

import { useConfirm } from '@/components/ui/ConfirmProvider';
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { RegistrationApprovalStatus } from '@/types/database'
import { Loader2, CheckCircle, XCircle, RotateCcw } from 'lucide-react'

interface Props {
  auctionId: string
  registrationId: string
  currentStatus: RegistrationApprovalStatus
}

type ActionType = 'approve' | 'reject' | 'revoke'

const actionConfig: Record<
  ActionType,
  { label: string; description: string; icon: React.ReactNode; color: string }
> = {
  approve: {
    label: 'Approve',
    description:
      'The user will receive an email with auction access.',
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'bg-emerald-500 hover:bg-emerald-600',
  },
  reject: {
    label: 'Reject',
    description:
      'The user will not be able to participate in this auction.',
    icon: <XCircle className="w-4 h-4" />,
    color: 'bg-red-500 hover:bg-red-600',
  },
  revoke: {
    label: 'Revoke approval',
    description:
      'The user will lose access to the auction room.',
    icon: <RotateCcw className="w-4 h-4" />,
    color: 'bg-amber-500 hover:bg-amber-600',
  },
}

export default function RegistrationStatusActions({

  auctionId,
  registrationId,
  currentStatus,
}: Props) {
  const confirm = useConfirm();

  const router = useRouter()
  const [loading, setLoading] = useState<ActionType | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingAction, setPendingAction] = useState<ActionType | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updateStatus = async (newStatus: 'approved' | 'rejected') => {
    if (!pendingAction) return
    setLoading(pendingAction)
    try {
      const res = await fetch(
        `/api/admin/auctions/${auctionId}/registrations/${registrationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approval_status: newStatus }),
        }
      )

      if (!res.ok) {
        const data = await res.json()
        confirm(data.message || 'Failed to update', { isAlert: true, confirmText: 'OK', title: 'Notice' })
        return
      }

      setShowConfirm(false)
      setPendingAction(null)
      router.refresh()
    } catch {
      confirm('Failed to update status', { isAlert: true, confirmText: 'OK', title: 'Notice' })
    } finally {
      setLoading(null)
    }
  }

  const handleActionClick = (action: ActionType) => {
    setPendingAction(action)
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    if (pendingAction === 'approve') {
      updateStatus('approved')
    } else if (pendingAction === 'reject' || pendingAction === 'revoke') {
      updateStatus('rejected')
    }
  }

  if (currentStatus === 'approved') {
    return (
      <>
        <button
          onClick={() => handleActionClick('revoke')}
          disabled={!!loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading === 'revoke' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ...
            </>
          ) : (
            <>
              <RotateCcw className="w-3.5 h-3.5" />
              Revoke
            </>
          )}
        </button>

        {mounted && showConfirm && pendingAction && createPortal(
          <ConfirmModal
            config={actionConfig[pendingAction]}
            onConfirm={handleConfirm}
            onCancel={() => {
              setShowConfirm(false)
              setPendingAction(null)
            }}
            loading={!!loading}
          />,
          document.body
        )}
      </>
    )
  }

  if (currentStatus === 'rejected') {
    return (
      <>
        <button
          onClick={() => handleActionClick('approve')}
          disabled={!!loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading === 'approve' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ...
            </>
          ) : (
            <>
              <CheckCircle className="w-3.5 h-3.5" />
              Approve
            </>
          )}
        </button>

        {mounted && showConfirm && pendingAction && createPortal(
          <ConfirmModal
            config={actionConfig[pendingAction]}
            onConfirm={handleConfirm}
            onCancel={() => {
              setShowConfirm(false)
              setPendingAction(null)
            }}
            loading={!!loading}
          />,
          document.body
        )}
      </>
    )
  }

  // Pending - show both Approve and Reject
  return (
    <div className="flex gap-2 justify-end">
      <button
        onClick={() => handleActionClick('approve')}
        disabled={!!loading}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
      >
        {loading === 'approve' ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ...
          </>
        ) : (
          <>
            <CheckCircle className="w-3.5 h-3.5" />
            Approve
          </>
        )}
      </button>
      <button
        onClick={() => handleActionClick('reject')}
        disabled={!!loading}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
      >
        {loading === 'reject' ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ...
          </>
        ) : (
          <>
            <XCircle className="w-3.5 h-3.5" />
            Reject
          </>
        )}
      </button>

      {mounted && showConfirm && pendingAction && createPortal(
        <ConfirmModal
          config={actionConfig[pendingAction]}
          onConfirm={handleConfirm}
          onCancel={() => {
            setShowConfirm(false)
            setPendingAction(null)
          }}
          loading={!!loading}
        />,
        document.body
      )}
    </div>
  )
}

function ConfirmModal({
  config,
  onConfirm,
  onCancel,
  loading,
}: {
  config: { label: string; description: string; icon: React.ReactNode; color: string }
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a24] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="text-center mb-6">
          <div
            className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
              config.color.includes('emerald')
                ? 'bg-emerald-500/20'
                : config.color.includes('red')
                  ? 'bg-red-500/20'
                  : 'bg-amber-500/20'
            }`}
          >
            {config.icon}
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{config.label}?</h3>
          <p className="text-[var(--text-secondary)] text-sm">
            {config.description}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white font-medium hover:bg-[var(--surface-elevated)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-3 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-all ${config.color}`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                {config.icon}
                <span>Confirm</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
