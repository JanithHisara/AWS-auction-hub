'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Bell } from 'lucide-react'

interface Props {
  userId: string
  children: React.ReactNode
}

export default function MyAuctionsRealtime({ userId, children }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`my-auctions-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_registrations',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = (payload.new || {}) as any
          const status = row.approval_status || row.approvalStatus
          if (status === 'approved') {
            setToast('Your auction registration was approved! Updated access.')
            setTimeout(() => setToast(null), 5000)
          }
          router.refresh()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auctions',
        },
        (payload) => {
          const row = (payload.new || {}) as any
          if (row.status === 'live') {
            setToast(`Auction "${row.name || 'Live'}" is now LIVE!`)
            setTimeout(() => setToast(null), 5000)
          }
          router.refresh()
        }
      )
      .subscribe()

    // Background poll fallback every 4 seconds
    const interval = setInterval(() => {
      router.refresh()
    }, 4000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [userId, router, supabase])

  return (
    <>
      {toast && (
        <div className="fixed top-6 right-6 z-[100] animate-bounce-in max-w-sm">
          <div className="px-5 py-3 rounded-2xl bg-emerald-500 text-white font-bold text-sm shadow-2xl flex items-center gap-2 border border-emerald-400/40">
            <Bell className="w-5 h-5 flex-shrink-0 animate-pulse" />
            <span>{toast}</span>
          </div>
        </div>
      )}
      {children}
    </>
  )
}
