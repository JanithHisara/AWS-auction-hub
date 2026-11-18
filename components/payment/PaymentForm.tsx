'use client'

import { formatCurrency } from '@/lib/utils'
import { CreditCard, Lock } from 'lucide-react'

interface PaymentFormProps {
  gemId: string
  amount: number
  successUrl: string
}

export default function PaymentForm({ amount }: PaymentFormProps) {
  return (
    <section className="space-y-6">
      <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        <p className="flex items-center gap-2 text-amber-300 font-medium">
          <CreditCard className="h-5 w-5" />
          Payments are currently unavailable
        </p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          No payment provider is configured, so this auction cannot accept payments yet.
          No card details have been collected or stored.
        </p>
      </div>

      <div className="flex justify-between items-center py-4 border-t border-[var(--border)]">
        <span className="text-[var(--text-secondary)]">Amount due</span>
        <span className="text-2xl font-bold text-[var(--gold)] font-mono">
          {formatCurrency(amount)}
        </span>
      </div>

      <p className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
        <Lock className="w-3 h-3" />
        Payment processing will be enabled once a provider is configured.
      </p>
    </section>
  )
}
