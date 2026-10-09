'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RegistrationApprovalStatus } from '@/types/database'

interface Props {
  auctionId: string
  userId?: string
  existingStatus?: RegistrationApprovalStatus | null
}

const statusConfig = {
  pending: {
    icon: '',
    title: 'Registration Pending',
    description: 'Your registration is awaiting admin approval',
    bgClass: 'bg-amber-500/20 border-amber-500/40',
    textClass: 'text-amber-400',
  },
  approved: {
    icon: '',
    title: 'Registration Approved!',
    description: 'Check your email for auction access link',
    bgClass: 'bg-emerald-500/20 border-emerald-500/40',
    textClass: 'text-emerald-400',
  },
  rejected: {
    icon: '',
    title: 'Registration Rejected',
    description: 'Your registration was not approved',
    bgClass: 'bg-red-500/20 border-red-500/40',
    textClass: 'text-red-400',
  },
}

export default function RegisterButton({ auctionId, userId, existingStatus }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<RegistrationApprovalStatus | null>(existingStatus || null)
  const router = useRouter()

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
        // If already registered, show existing status
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

  // Show status if already registered
  if (status) {
    const config = statusConfig[status]
    return (
      <div className="space-y-4">
        <div className={`flex items-center gap-3 p-4 border rounded-xl ${config.bgClass}`}>
          <span className="text-2xl">{config.icon}</span>
          <div>
            <p className={`font-bold ${config.textClass}`}>{config.title}</p>
            <p className="text-sm text-[var(--text-muted)]">{config.description}</p>
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
        Registration requires admin approval. You&apos;ll receive an email once approved.
      </p>
    </div>
  )
}

