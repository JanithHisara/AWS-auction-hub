import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { redirect } from 'next/navigation'
import PaymentForm from '@/components/payment/PaymentForm'
import Link from 'next/link'

export default async function PaymentPage({ params }: { params: Promise<{ gemId: string }> }) {
  const { gemId } = await params
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: winner } = await supabase
    .from('auction_winners')
    .select('*, bid:bids(id, bid_amount), gem:gems(*)')
    .eq('gem_id', gemId)
    .eq('user_id', user.id)
    .single()

  if (!winner) redirect('/')

  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('gem_id', gemId)
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .single()

  if (payment) redirect(`/gems/${gemId}`)

  const gem = winner.gem as Record<string, unknown>
  const bid = winner.bid as Record<string, unknown>

  return (
    <div className="min-h-screen bg-[var(--background)] relative">
      <div className="fixed inset-0 bg-grid-pattern opacity-30" />
      
      <div className="relative z-10 py-8 sm:py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="text-[var(--text-muted)] hover:text-white mb-4 sm:mb-6 inline-flex items-center gap-1 text-sm">
             Back
          </Link>

          <div className="card-glass rounded-2xl p-5 sm:p-8">
            {/* Header */}
            <div className="text-center mb-6 sm:mb-8">
              <div className="w-14 sm:w-16 h-14 sm:h-16 mx-auto bg-[var(--gold)]/20 rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
                <span className="text-2xl sm:text-3xl"></span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Congratulations!</h1>
              <p className="text-sm sm:text-base text-[var(--text-secondary)]">Complete your payment to claim your item</p>
            </div>

            {/* Item Summary */}
            <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-[var(--gold)]/10 border border-[var(--gold)]/30 rounded-xl">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">{gem.name as string}</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm sm:text-base text-[var(--text-secondary)]">Winning Bid</span>
                  <span className="text-[var(--gold)] font-bold text-xl sm:text-2xl font-mono">
                    {formatCurrency(bid.bid_amount as number)}
                  </span>
                </div>
                <div className="pt-3 border-t border-[var(--border)]">
                  <div className="flex justify-between items-center">
                    <span className="text-sm sm:text-base text-[var(--text-secondary)]">Total Due</span>
                    <span className="text-white font-bold text-xl sm:text-2xl font-mono">
                      {formatCurrency(bid.bid_amount as number)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <PaymentForm gemId={gemId} amount={bid.bid_amount as number} />
          </div>
        </div>
      </div>
    </div>
  )
}

