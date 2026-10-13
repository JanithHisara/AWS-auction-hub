'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatConversation, ChatMessage } from '@/types/database'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'

interface Props {
  auctionId: string
  userId: string
  initialOpen?: boolean
  onClose?: () => void
}

export default function AuctionChatWidget({ auctionId, userId, initialOpen = false, onClose }: Props) {
  const [isOpen, setIsOpen] = useState(initialOpen)
  const [conversation, setConversation] = useState<ChatConversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isEnded, setIsEnded] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Register on-page widget flag
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__hasAuctionChatWidget = auctionId
    }
    return () => {
      if (typeof window !== 'undefined' && (window as any).__hasAuctionChatWidget === auctionId) {
        delete (window as any).__hasAuctionChatWidget
      }
    }
  }, [auctionId])

  // Listen for open-auction-chat event
  useEffect(() => {
    const handleOpenChat = (e: any) => {
      const targetAuctionId = e.detail?.auctionId
      if (!targetAuctionId || targetAuctionId === auctionId) {
        setIsOpen(true)
        setUnreadCount(0)
      }
    }
    window.addEventListener('open-auction-chat', handleOpenChat)
    return () => window.removeEventListener('open-auction-chat', handleOpenChat)
  }, [auctionId])

  // Sync initialOpen prop changes
  useEffect(() => {
    if (initialOpen) {
      setIsOpen(true)
      setUnreadCount(0)
    }
  }, [initialOpen])

  // Fetch or sync conversation for this auction
  const fetchConversation = useCallback(async (isSilent = false) => {
    try {
      const res = await fetch(`/api/chat/conversations?auction_id=${auctionId}`, {
        headers: { 'Cache-Control': 'no-cache' }
      })

      if (res.status === 400) {
        const err = await res.json()
        if (err.error?.includes('ended')) {
          setIsEnded(true)
          setConversation(null)
          setMessages([])
          return
        }
      }

      if (!res.ok) {
        if (res.status === 404) {
          setConversation(null)
          setMessages([])
          setUnreadCount(0)
        }
        return
      }

      const data = await res.json()
      if (data?.id) {
        setConversation(data)
        if (!isOpen) {
          setUnreadCount(data.unread_by_user || 0)
        }
      } else {
        setConversation(null)
        setMessages([])
        setUnreadCount(0)
      }
    } catch (e) {
      console.error('Failed to sync conversation:', e)
    }
  }, [auctionId, isOpen])

  // Periodic polling for unread badge when chat is closed
  useEffect(() => {
    fetchConversation(false)
    const interval = setInterval(() => {
      fetchConversation(true)
    }, 3500)
    return () => clearInterval(interval)
  }, [fetchConversation])

  // Fetch messages when conversation is active and chat is open
  const fetchMessages = useCallback(async (isSilent = false) => {
    if (!conversation?.id) return
    if (!isSilent) setIsLoading(true)
    try {
      const res = await fetch(`/api/chat/conversations/${conversation.id}/messages`, {
        headers: { 'Cache-Control': 'no-cache' }
      })

      if (res.status === 404) {
        setConversation(null)
        setMessages([])
        return
      }

      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) {
        setMessages(prev => {
          const optimistic = prev.filter(m => m.id.toString().startsWith('temp-'))
          return [...data, ...optimistic]
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      if (!isSilent) setIsLoading(false)
    }
  }, [conversation?.id])

  // Handle open state: fetch messages, mark read, and poll while open
  useEffect(() => {
    if (!isOpen) return

    setUnreadCount(0)

    if (conversation?.id) {
      fetchMessages(false)
      setTimeout(scrollToBottom, 100)

      fetch(`/api/chat/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read' }),
      }).catch(() => {})

      const timer = setInterval(() => {
        fetchMessages(true)
      }, 2500)

      return () => clearInterval(timer)
    }
  }, [isOpen, conversation?.id, fetchMessages, scrollToBottom])

  // Realtime Supabase subscription
  useEffect(() => {
    if (!conversation?.id || !isOpen) return

    const channel = supabase
      .channel(`chat-msgs-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          if (newMsg.sender_id === userId) return
          setMessages(prev => [...prev, newMsg])
          setTimeout(scrollToBottom, 50)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation?.id, isOpen, userId, supabase, scrollToBottom])

  // Send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isSending || isEnded) return

    const messageContent = input.trim()
    setInput('')
    setIsSending(true)

    try {
      let convId = conversation?.id

      if (!convId) {
        const convRes = await fetch('/api/chat/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auction_id: auctionId }),
        })
        const convData = await convRes.json()
        if (convRes.status === 400 && convData.error?.includes('ended')) {
          setIsEnded(true)
          alert('This auction has ended. Chat is closed.')
          return
        }
        if (!convData?.id) throw new Error('Failed to create conversation')
        setConversation(convData)
        convId = convData.id
      }

      const optimistic: ChatMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: convId!,
        sender_id: userId,
        sender_role: 'user',
        content: messageContent,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, optimistic])
      setTimeout(scrollToBottom, 50)

      let res = await fetch(`/api/chat/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent }),
      })

      if (res.status === 404) {
        const newConvRes = await fetch('/api/chat/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auction_id: auctionId }),
        })
        const newConvData = await newConvRes.json()
        if (newConvData?.id) {
          setConversation(newConvData)
          convId = newConvData.id
          optimistic.conversation_id = newConvData.id
          res = await fetch(`/api/chat/conversations/${convId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: messageContent }),
          })
        }
      }

      if (!res.ok) throw new Error('Failed to send message')

      const sent = await res.json()
      setMessages(prev => prev.map(m => m.id === optimistic.id ? sent : m))
    } catch {
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')))
      setInput(messageContent)
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const handleClose = () => {
    setIsOpen(false)
    onClose?.()
  }

  return (
    <>
      {/* Floating chat button with unread red badge */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true)
            setUnreadCount(0)
          }}
          className="fixed bottom-4 left-4 z-50 w-14 h-14 bg-[var(--gold)] hover:bg-[var(--gold-dark)] text-black rounded-full shadow-lg shadow-[var(--gold-glow)] flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          aria-label="Open support chat"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 bg-red-600 border-2 border-[var(--background)] text-white text-[11px] font-black rounded-full flex items-center justify-center shadow-lg animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-4 left-4 z-50 w-[340px] sm:w-[380px] h-[480px] sm:h-[520px] bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--surface)] border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[var(--gold)]/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-[var(--gold)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Auction Support</h3>
                <p className="text-xs text-emerald-400">Admin Team Online</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg hover:bg-[var(--surface-elevated)] flex items-center justify-center text-[var(--text-muted)] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {isEnded ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mb-3">
                  <X className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-white mb-1">Auction Ended</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Chat is closed and message history has been erased for this auction.
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 bg-[var(--surface)] rounded-full flex items-center justify-center mb-3">
                  <MessageCircle className="w-6 h-6 text-[var(--text-muted)]" />
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Need assistance?</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Ask our auction moderators any questions regarding bidding, items, or rules.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.sender_role === 'user'
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="max-w-[80%]">
                      {!isUser && (
                        <p className="text-[10px] text-[var(--gold)] font-medium mb-1 ml-1">Support Admin</p>
                      )}
                      <div
                        className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                          isUser
                            ? 'bg-[var(--gold)] text-black font-medium rounded-br-md'
                            : 'bg-[var(--surface)] text-white rounded-bl-md border border-[var(--border)]'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <p className={`text-[9px] text-[var(--text-muted)] mt-1 ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {!isEnded && (
            <form onSubmit={handleSend} className="px-3 py-3 border-t border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message to support..."
                  className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)]/50"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isSending}
                  className="w-9 h-9 bg-[var(--gold)] hover:bg-[var(--gold-dark)] disabled:opacity-40 disabled:hover:bg-[var(--gold)] text-black rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                >
                  {isSending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  )
}