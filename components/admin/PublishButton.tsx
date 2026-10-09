'use client'

import { useState } from 'react'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useRouter } from 'next/navigation'

export default function PublishButton({ gemId }: { gemId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const confirm = useConfirm()

  const handlePublish = async () => {
    if (loading) return
    if (!await confirm('Are you sure you want to publish this item? It will be queued for auction.')) {
      return
    }

    setLoading(true)
    try {
      // Set to 'pending' - item is published but waiting for its turn
      // Admin will manually activate when ready to auction this item
      const response = await fetch(`/api/gems/${gemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      })

      if (!response.ok) throw new Error('Failed to publish')

      router.refresh()
    } catch (error) {
      confirm('Failed to publish item', { title: 'Error', confirmText: 'OK', cancelText: 'Close' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handlePublish}
      disabled={loading}
      className="px-6 py-3 bg-gradient-to-r from-[var(--gold-dark)] to-[var(--gold-accent)] text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-[var(--gold)]/30 transition-all duration-200 disabled:opacity-50 shadow-md"
    >
      {loading ? 'Publishing...' : 'Publish'}
    </button>
  )
}

