'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RegistrationApprovalStatus } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react'

interface Props {
  auctionId: string
  userId?: string
  existingStatus?: RegistrationApprovalStatus | null
}

export default function RegisterButton({ auctionId, userId, existingStatus }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<RegistrationApprovalStatus | null>(existingStatus || null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const router = useRouter()

  // Keep state in sync if parent prop changes (e.g. after router.refresh)
  useEffect(() => {
    setStatus(existingStatus || null)
  }, [existingStatus])

  // Realtime subscription and active polling for registration approval
  useEffect(() => {
    if (!userId || !auctionId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`reg-button-${auctionId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_registrations',
          filter: `auction_id=eq.${auctionId}`,
        },
        (payload) => {
          const row = payload.new || {}
          const rowUserId = row.user_id || row.userId
          if (rowUserId === userId) {
            const newStatus = (row.approval_status || row.approvalStatus) as RegistrationApprovalStatus
            if (newStatus) {
              setStatus(newStatus)
              router.refresh()
            }
          }
        }
      )
      .subscribe()

    // Poll every 2.5 seconds while pending as reliable fallback
    let pollInterval: NodeJS.Timeout | null = null
    if (status === 'pending') {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'auction_registrations',
              action: 'SELECT',
              filters: [
                { column: 'auction_id', operator: '=', value: auctionId },
                { column: 'user_id', operator: '=', value: userId },
              ],
              isSingle: true,
            }),
          })
          if (res.ok) {
            const result = await res.json()
            const freshStatus = result?.data?.approval_status
            if (freshStatus && freshStatus !== status) {
              setStatus(freshStatus)
              router.refresh()
            }
          }
        } catch {
          // Ignore background fetch error
        }
      }, 2500)
    }

    return () => {
      supabase.removeChannel(channel)
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [auctionId, userId, status, router])

  const handleRegister = async () => {
    if (isLoading) return
    if (!userId) {
      router.push('/login')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/auctions/${auctionId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.approval_status) {
          setStatus(data.approval_status)
          return
        }
        throw new Error(data.message || 'Registration failed')
      }

      setStatus(data.registration?.approval_status || 'pending')
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleManualCheck = async () => {
    setIsRefreshing(true)
    try {
      if (userId && auctionId) {
        const res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'auction_registrations',
            action: 'SELECT',
            filters: [
              { column: 'auction_id', operator: '=', value: auctionId },
              { column: 'user_id', operator: '=', value: userId },
            ],
            isSingle: true,
          }),
        })
        if (res.ok) {
          const result = await res.json()
          if (result?.data?.approval_status) {
            setStatus(result.data.approval_status)
          }
        }
      }
      router.refresh()
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  // Show status if already registered
  if (status === 'approved') {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-4 border rounded-xl bg-emerald-500/20 border-emerald-500/40 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-emerald-400">Registration Approved!</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Your registration has been approved. You are ready to participate in this auction.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-4 border rounded-xl bg-amber-500/20 border-amber-500/40 animate-fade-in">
          <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-amber-400">Registration Pending</p>
              <span className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Your registration is awaiting admin approval. This page will automatically update in real time as soon as you are approved.
            </p>
            <button
              type="button"
              onClick={handleManualCheck}
              disabled={isRefreshing}
              className="mt-3 text-xs text-[var(--gold)] hover:underline flex items-center gap-1 font-semibold disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Checking...' : 'Check Status Now'}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-4 border rounded-xl bg-red-500/20 border-red-500/40 animate-fade-in">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-red-400">Registration Rejected</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Your registration was not approved for this auction. Please contact the administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      
      <button
        onClick={handleRegister}
        disabled={isLoading}
        className="btn-gold w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span>
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Registering...
            </span>
          ) : (
            'Register for Auction'
          )}
        </span>
      </button>
      
      <p className="text-xs text-center text-[var(--text-muted)]">
        Registration requires admin approval. Live status updates automatically once approved.
      </p>
    </div>
  )
}
