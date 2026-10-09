'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatConversation, ChatMessage } from '@/types/database'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'

interface Props {
  auctionId: string
  userId: string
}

export default function AuctionChatWidget({ auctionId, userId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [conversation, setConversation] = useState<ChatConversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const fetchConversation = async () => {
      const res = await fetch(`/api/chat/conversations?auction_id=${auctionId}`)
      const data = await res.json()
      if (data?.id) {
        setConversation(data)
        setUnreadCount(data.unread_by_user || 0)
      }
    }
    fetchConversation()
  }, [auctionId])

  useEffect(() => {
    if (!conversation?.id || !isOpen) return

    const fetchMessages = async () => {
      setIsLoading(true)
      const res = await fetch(`/api/chat/conversations/${conversation.id}/messages`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setMessages(prev => {
          const optimistic = prev.filter(m => m.id.toString().startsWith('temp-'))
          return [...data, ...optimistic]
        })
      }
      setIsLoading(false)
      setTimeout(scrollToBottom, 100)
    }
    fetchMessages()

    fetch(`/api/chat/conversations/${conversation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read' }),
    })
    setUnreadCount(0)
  }, [conversation?.id, isOpen, scrollToBottom])

  useEffect(() => {
    if (!conversation?.id) return

    const channel = supabase
      .channel(`chat-user-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage
          if (newMsg.sender_id === userId) return

          const enriched: ChatMessage = {
            ...newMsg,
            sender: { id: '', email: '', role: 'admin', created_at: '', display_name: 'Support' } as ChatMessage['sender'],
          }
          setMessages(prev => [...prev, enriched])

          if (isOpen) {
            fetch(`/api/chat/conversations/${conversation.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'mark_read' }),
            })
            setTimeout(scrollToBottom, 100)
          } else {
            setUnreadCount(prev => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation?.id, userId, isOpen, supabase, scrollToBottom])

  // Also listen for conversation creation (if another flow creates it)
  useEffect(() => {
    if (conversation?.id) return

    const channel = supabase
      .channel(`chat-conv-watch-${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_conversations',
          filter: `auction_id=eq.${auctionId}`,
        },
        (payload) => {
          const newConv = payload.new as ChatConversation
          if (newConv.user_id === userId) {
            setConversation(newConv)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation?.id, auctionId, userId, supabase])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isSending) return

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

      const res = await fetch(`/api/chat/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent }),
      })

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

  return (
    <>
      {/* Floating chat button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 left-4 z-50 w-14 h-14 bg-[var(--gold)] hover:bg-[var(--gold-dark)] text-black rounded-full shadow-lg shadow-[var(--gold-glow)] flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
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
                <h3 className="text-sm font-bold text-white">Support</h3>
                <p className="text-xs text-emerald-400">Online</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-lg hover:bg-[var(--surface-elevated)] flex items-center justify-center text-[var(--text-muted)] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 bg-[var(--surface)] rounded-full flex items-center justify-center mb-3">
                  <MessageCircle className="w-6 h-6 text-[var(--text-muted)]" />
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Need help?</p>
                <p className="text-xs text-[var(--text-muted)]">Send a message and our team will respond shortly.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.sender_role === 'user'
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${isUser ? 'order-1' : 'order-1'}`}>
                      {!isUser && (
                        <p className="text-[10px] text-[var(--gold)] font-medium mb-1 ml-1">Support</p>
                      )}
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                          isUser
                            ? 'bg-[var(--gold)] text-black rounded-br-md'
                            : 'bg-[var(--surface)] text-white rounded-bl-md border border-[var(--border)]'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <p className={`text-[10px] text-[var(--text-muted)] mt-1 ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
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
          <form onSubmit={handleSend} className="px-3 py-3 border-t border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)]/50"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className="w-10 h-10 bg-[var(--gold)] hover:bg-[var(--gold-dark)] disabled:opacity-40 disabled:hover:bg-[var(--gold)] text-black rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
