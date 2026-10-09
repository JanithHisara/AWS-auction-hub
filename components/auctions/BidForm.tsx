'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { Gem } from '@/types/database'
import { Loader2, Check } from 'lucide-react'

interface BidFormProps {
  gem: Gem
  currentBid: number
}

export default function BidForm({ gem, currentBid }: BidFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRegistered, setIsRegistered] = useState(false)
  const [checkingRegistration, setCheckingRegistration] = useState(true)
  const [hasAcceptedCurrentPrice, setHasAcceptedCurrentPrice] = useState(false)

  const roundPrice = gem.current_price || gem.starting_price

  useEffect(() => {
    checkRegistration()
    checkIfAccepted()
  }, [gem.id, roundPrice])

  const checkRegistration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setCheckingRegistration(false)
        return
      }

      const response = await fetch(`/api/gems/${gem.id}/register`)
      if (response.ok) {
        const data = await response.json()
        setIsRegistered(data.isRegistered)
      }
    } catch (err) {
      console.error('Failed to check registration', err)
    } finally {
      setCheckingRegistration(false)
    }
  }

  const checkIfAccepted = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('bids')
        .select('id')
        .eq('gem_id', gem.id)
        .eq('user_id', user.id)
        .eq('bid_amount', roundPrice)
        .single()
      
      setHasAcceptedCurrentPrice(!!data)
    } catch (err) {
      console.error('Failed to check acceptance', err)
    }
  }

  const handleRegister = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      router.push('/login')
      return
    }

    try {
      const response = await fetch(`/api/gems/${gem.id}/register`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to register')
      }

      setIsRegistered(true)
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to register'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptPrice = async () => {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        router.push('/login')
        return
      }

      const response = await fetch(`/api/gems/${gem.id}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), 
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to accept price')
      }

      setHasAcceptedCurrentPrice(true)
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to place bid'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (checkingRegistration) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 animate-pulse">
        <div className="h-6 bg-[var(--border)] rounded w-1/3 mb-4"></div>
        <div className="h-12 bg-[var(--border)] rounded w-full"></div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
      <h3 className="text-lg font-bold text-white mb-4">
        {isRegistered ? 'Place Your Bid' : 'Join Auction'}
      </h3>
      
      {error && (
        <div className="error-message text-sm mb-4">
          {error}
        </div>
      )}

      {!isRegistered ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Register to start bidding on this item
          </p>
          <button
            onClick={handleRegister}
            disabled={loading}
            className="btn-gold w-full flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Registering...</span>
              </>
            ) : (
              <span>Register to Bid</span>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-[var(--text-muted)]">Current Price:</span>
            <span className="font-bold text-[var(--gold)] text-lg">{formatCurrency(roundPrice)}</span>
          </div>
          
          {hasAcceptedCurrentPrice ? (
            <div className="w-full px-6 py-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-xl flex items-center justify-center gap-2">
              <Check className="w-5 h-5" />
              <span className="font-semibold">Bid Accepted</span>
            </div>
          ) : (
            <button
              onClick={handleAcceptPrice}
              disabled={loading}
              className="btn-gold w-full flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Accept {formatCurrency(roundPrice)}</span>
              )}
            </button>
          )}
          <p className="text-xs text-center text-[var(--text-muted)]">
            Confirm to stay in at {formatCurrency(roundPrice)}
          </p>
        </div>
      )}
    </div>
  )
}
