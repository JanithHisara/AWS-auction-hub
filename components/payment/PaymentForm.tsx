'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { CreditCard, Lock, Loader2 } from 'lucide-react'

interface PaymentFormProps {
  gemId: string
  amount: number
}

export default function PaymentForm({ gemId, amount }: PaymentFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gem_id: gemId,
          ...formData,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Payment failed')
      }

      router.push(`/gems/${gemId}?payment=success`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset disabled={loading} className="border-0 p-0 m-0 min-w-0 space-y-6">
      {error && (
        <div className="error-message text-sm">
          {error}
        </div>
      )}

      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        <p className="text-amber-400 text-sm flex items-center gap-2">
          <span></span>
          Demo mode - any card details will be accepted
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Card Number</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <CreditCard className="h-5 w-5 text-[var(--text-muted)]" />
          </div>
          <input
            type="text"
            value={formData.cardNumber}
            onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value.replace(/\s/g, '') })}
            placeholder="1234 5678 9012 3456"
            maxLength={16}
            required
            className="w-full pl-12 pr-4 py-3.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Expiry Date</label>
          <input
            type="text"
            value={formData.expiryDate}
            onChange={(e) => {
              let value = e.target.value.replace(/\D/g, '')
              if (value.length >= 2) {
                value = value.slice(0, 2) + '/' + value.slice(2, 4)
              }
              setFormData({ ...formData, expiryDate: value })
            }}
            placeholder="MM/YY"
            maxLength={5}
            required
            className="w-full py-3.5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">CVV</label>
          <input
            type="text"
            value={formData.cvv}
            onChange={(e) => setFormData({ ...formData, cvv: e.target.value.replace(/\D/g, '') })}
            placeholder="123"
            maxLength={4}
            required
            className="w-full py-3.5"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Cardholder Name</label>
        <input
          type="text"
          value={formData.cardholderName}
          onChange={(e) => setFormData({ ...formData, cardholderName: e.target.value })}
          placeholder="John Doe"
          required
          className="w-full py-3.5"
        />
      </div>

      <div className="pt-6 border-t border-[var(--border)]">
        <div className="flex justify-between items-center mb-6">
          <span className="text-lg text-[var(--text-secondary)]">Total Amount</span>
          <span className="text-3xl font-bold text-[var(--gold)] font-mono">{formatCurrency(amount)}</span>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-gold w-full py-4 text-lg flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Lock className="w-5 h-5" />
              <span>Complete Payment</span>
            </>
          )}
        </button>
        <p className="text-xs text-center text-[var(--text-muted)] mt-4 flex items-center justify-center gap-2">
          <Lock className="w-3 h-3" />
          Your payment is secure and encrypted
        </p>
      </div>
      </fieldset>
    </form>
  )
}

