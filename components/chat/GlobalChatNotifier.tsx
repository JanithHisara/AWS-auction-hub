'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, MessageCircle, ArrowRight } from 'lucide-react'

interface Notification {
  id: string
  content: string
  sender_name: string
  auction_id: string
  timestamp: number
}

export default function GlobalChatNotifier({ userId, role }: { userId?: string; role?: string | null }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const supabase = createClient()

  const isGlobalAdmin = role === 'admin' || role === 'super_admin' || role === 'moderator', setNotifications] = useState<Notification[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!userId || !isGlobalAdmin) return

    const channel = supabase
      .channel('global-chat-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        async (payload) => {
          const newMsg = payload.new
          
          // Don't notify if we sent it
          if (newMsg.sender_id === userId) return

          // Fetch sender details and conversation details to verify we should see this
          const { data: conv } = await supabase
            .from('chat_conversations')
            .select('auction_id, user_id, assigned_admin_id')
            .eq('id', newMsg.conversation_id)
            .single()

          if (!conv) return

          // Determine if we should be notified
          const isParticipant = conv.user_id === userId || conv.assigned_admin_id === userId
          const isGlobalAdmin = role === 'admin' || role === 'super_admin' || role === 'moderator'
          // If we aren't a participant and we aren't a global admin, skip
          if (!isParticipant && !isGlobalAdmin) return

          // Fetch sender name via API to bypass RLS
          let senderName = 'Unknown User'
          try {
            const res = await fetch('/api/chat/user-profile?id=' + newMsg.sender_id)
            const data = await res.json()
            if (data.name) senderName = data.name
          } catch (e) {
            console.error(e)
          }

          const id = Math.random().toString(36).substr(2, 9)
          setNotifications(prev => [...prev, {
            id,
            content: newMsg.content,
            sender_name: senderName,
            auction_id: conv.auction_id,
            timestamp: Date.now()
          }])

          // Auto dismiss after 6 seconds
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id))
          }, 6000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, role, supabase])

  if (!isGlobalAdmin || notifications.length === 0) return null

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-full">
      {notifications.map(notif => {
        // Link logic: Admins click to go to admin chat page, users to their room
        const linkHref = (role === 'admin' || role === 'super_admin' || role === 'moderator') 
          ? '/admin/chat'
          : '/auctions/' + notif.auction_id

        return (
          <div 
            key={notif.id} 
            className="relative overflow-hidden bg-[var(--surface-elevated)] border border-[var(--gold)]/50 rounded-2xl p-4 shadow-[0_8px_32px_-8px_rgba(255,215,0,0.2)] pointer-events-auto animate-in slide-in-from-right-8 fade-in duration-300 group hover:scale-[1.02] transition-transform"
          >
            {/* Glowing background effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--gold)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[var(--gold)]/20">
                <MessageCircle className="w-6 h-6 text-black" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 truncate">
                  {notif.sender_name}
                </p>
                <p className="text-sm text-gray-300 line-clamp-2 mt-1 leading-relaxed">
                  {notif.content || 'Sent a new message'}
                </p>
                <a 
                  href={linkHref} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-[var(--gold)] hover:text-white transition-colors"
                >
                  VIEW MESSAGE <ArrowRight className="w-3 h-3" />
                </a>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                className="text-gray-500 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
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
