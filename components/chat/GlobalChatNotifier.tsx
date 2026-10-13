'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { X, MessageCircle, ArrowRight } from 'lucide-react'

interface NotificationItem {
  id: string
  conversation_id: string
  auction_id: string
  auction_name: string
  sender_name: string
  sender_role: string
  content: string
  created_at: string
  timestamp: number
}

function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1) // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
  } catch {}
}

export default function GlobalChatNotifier({ userId, role }: { userId?: string; role?: string | null }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const seenIdsRef = useRef<Set<string>>(new Set())
  const lastCheckTimeRef = useRef<number>(Date.now() - 10000)
  const isCheckingRef = useRef(false)

  const isGlobalAdmin = role === 'admin' || role === 'super_admin' || role === 'moderator'

  const checkNotifications = useCallback(async () => {
    if (!userId || isCheckingRef.current) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

    isCheckingRef.current = true
    try {
      const res = await fetch(`/api/chat/notifications?since=${lastCheckTimeRef.current}`, {
        headers: { 'Cache-Control': 'no-cache' }
      })
      if (!res.ok) return
      const data = await res.json()

      if (Array.isArray(data.notifications) && data.notifications.length > 0) {
        const newNotifs: NotificationItem[] = []
        for (const notif of data.notifications) {
          if (!seenIdsRef.current.has(notif.id)) {
            seenIdsRef.current.add(notif.id)
            newNotifs.push(notif)
          }
        }

        if (newNotifs.length > 0) {
          playChime()
          setNotifications(prev => [...prev, ...newNotifs])

          // Auto dismiss each after 7 seconds
          newNotifs.forEach(n => {
            setTimeout(() => {
              setNotifications(prev => prev.filter(item => item.id !== n.id))
            }, 7000)
          })
        }
      }
      lastCheckTimeRef.current = Date.now()
    } catch {
      // Ignore transient errors
    } finally {
      isCheckingRef.current = false
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return

    checkNotifications()
    const interval = setInterval(checkNotifications, 3000)
    return () => clearInterval(interval)
  }, [userId, checkNotifications])

  if (!userId || notifications.length === 0) return null

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-full">
      {notifications.map(notif => {
        const linkHref = isGlobalAdmin
          ? `/admin/chat?auctionId=${encodeURIComponent(notif.auction_id)}&convId=${encodeURIComponent(notif.conversation_id)}`
          : `/auctions/${encodeURIComponent(notif.auction_id)}`

        const handleActionClick = (e: React.MouseEvent) => {
          if (!isGlobalAdmin) {
            // For regular users in an auction room, dispatch event to open chat widget directly
            window.dispatchEvent(new CustomEvent('open-auction-chat', {
              detail: { auctionId: notif.auction_id }
            }))
          }
        }

        return (
          <div 
            key={notif.id} 
            className="relative overflow-hidden bg-[var(--surface-elevated)] border border-[var(--gold)]/50 rounded-2xl p-4 shadow-[0_8px_32px_-8px_rgba(255,215,0,0.25)] pointer-events-auto animate-in slide-in-from-right-8 fade-in duration-300 group hover:scale-[1.02] transition-transform"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--gold)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[var(--gold)]/20 mt-0.5">
                <MessageCircle className="w-5 h-5 text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-black text-white truncate">
                    {notif.sender_name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--gold)]/20 text-[var(--gold)] font-bold truncate max-w-[130px]">
                    {notif.auction_name}
                  </span>
                </div>
                <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                  {notif.content || 'Sent a new message'}
                </p>
                <a 
                  href={linkHref}
                  onClick={handleActionClick}
                  className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-bold text-[var(--gold)] hover:text-white transition-colors"
                >
                  {isGlobalAdmin ? 'OPEN IN CHAT' : 'VIEW CHAT'} <ArrowRight className="w-3 h-3" />
                </a>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                className="text-gray-500 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}