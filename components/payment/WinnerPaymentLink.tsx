'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getPaymentStatus } from '@/lib/api/auction'

export default function WinnerPaymentLink({ gemId }: { gemId: string }) {
  const [isWinner, setIsWinner] = useState(false)
  const [paymentCompleted, setPaymentCompleted] = useState(false)

  useEffect(() => {
    let active = true
    setIsWinner(false)
    setPaymentCompleted(false)
    const checkWinner = async () => {
      const { data } = await getPaymentStatus(gemId)
      if (active && data) {
        setIsWinner(data.isWinner)
        setPaymentCompleted(data.paymentCompleted)
      }
    }

    checkWinner()
    return () => { active = false }
  }, [gemId])

  if (!isWinner) return null

  if (paymentCompleted) {
    return (
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-green-700 text-sm">Payment completed</p>
      </div>
    )
  }

  return (
    <Link
      href={`/payment/${gemId}`}
      className="block w-full mt-4 px-6 py-3 bg-gradient-to-r from-[var(--gold-dark)] to-[var(--gold-accent)] text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-[var(--gold)]/30 transition-all duration-200 text-center shadow-md"
    >
      Complete Payment
    </Link>
  )
}

