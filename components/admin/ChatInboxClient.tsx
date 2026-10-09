'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatConversation, ChatMessage, User } from '@/types/database'
import { MessageCircle, Send, Loader2, Circle, ArrowLeft, CheckCircle } from 'lucide-react'

type Tab = 'unassigned' | 'mine' | 'all' | 'resolved'

type ConversationWithRelations = ChatConversation & {
  user?: User
  assigned_admin?: User
}

export default function ChatInboxClient({ adminId }: { adminId: string }) {
  const [conversations, setConversations] = useState<ConversationWithRelations[]>([])
  const [activeConv, setActiveConv] = useState<ConversationWithRelations | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingConvs, setIsLoadingConvs] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('unassigned')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    setIsLoadingConvs(true)
    try {
      const res = await fetch(`/api/chat/conversations?auction_id=all`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setConversations(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingConvs(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Subscribe to all conversations
  useEffect(() => {
    const channel = supabase
      .channel(`global-admin-chat-convs`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_conversations' },
        () => fetchConversations()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchConversations])

  // Active conversation logic
  useEffect(() => {
    if (!activeConv?.id) return

    const fetchMessages = async () => {
      setIsLoadingMessages(true)
      const res = await fetch(`/api/chat/conversations/${activeConv.id}/messages`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setMessages(data)
      }
      setIsLoadingMessages(false)
      setTimeout(scrollToBottom, 100)
    }
    fetchMessages()

    fetch(`/api/chat/conversations/${activeConv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read' }),
    })
  }, [activeConv?.id, scrollToBottom])

  // Subscribe to active conversation messages
  useEffect(() => {
    if (!activeConv?.id) return

    const channel = supabase
      .channel(`global-admin-chat-msgs-${activeConv.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${activeConv.id}` },
        async (payload) => {
          const newMsg = payload.new as ChatMessage
          if (newMsg.sender_id === adminId) return

          const { data: sender } = await supabase
            .from('users')
            .select('display_name, anonymous_name, email')
            .eq('id', newMsg.sender_id)
            .single()

          setMessages(prev => [...prev, { ...newMsg, sender: sender as ChatMessage['sender'] }])
          setTimeout(scrollToBottom, 100)

          fetch(`/api/chat/conversations/${activeConv.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_read' }),
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeConv?.id, adminId, supabase, scrollToBottom])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isSending || !activeConv) return

    const messageContent = input.trim()
    setInput('')
    setIsSending(true)

    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConv.id,
      sender_id: adminId,
      sender_role: 'admin',
      content: messageContent,
      created_at: new Date().toISOString(),
      sender: { display_name: 'You' } as ChatMessage['sender']
    }

    setMessages(prev => [...prev, optimistic])
    setTimeout(scrollToBottom, 50)

    try {
      const res = await fetch(`/api/chat/conversations/${activeConv.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent }),
      })
      if (!res.ok) throw new Error()
      
      const sent = await res.json()
      setMessages(prev => prev.map(m => m.id === optimistic.id ? sent : m))
      
      // Update local last message immediately for the list
      setConversations(prev => prev.map(c => 
        c.id === activeConv.id 
          ? { ...c, last_message: sent, last_message_at: sent.created_at }
          : c
      ).sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()))
      
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setInput(messageContent)
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  const handleResolve = async () => {
    if (!activeConv?.id) return
    await fetch(`/api/chat/conversations/${activeConv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve' }),
    })
    setActiveConv(null)
    fetchConversations()
  }

  const handleAssign = async () => {
    if (!activeConv?.id) return
    await fetch(`/api/chat/conversations/${activeConv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign' }),
    })
    fetchConversations()
  }

  const getUserDisplayName = (conv: ConversationWithRelations) => {
    return conv.user?.display_name || conv.user?.anonymous_name || conv.user?.email || 'Unknown User'
  }

  const filteredConversations = conversations.filter(conv => {
    switch (activeTab) {
      case 'unassigned': return conv.status === 'open' || conv.status === 'active'
      case 'mine': return conv.assigned_admin_id === adminId && conv.status !== 'resolved'
      case 'resolved': return conv.status === 'resolved'
      case 'all': default: return true
    }
  })

  return (
    <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-200px)]">
      {/* Sidebar - Conversation List */}
      <div className={`w-full md:w-80 flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden ${activeConv ? 'hidden md:flex' : 'flex'}`}>
        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-[var(--border)] bg-[var(--surface-elevated)] p-2 gap-2 hide-scrollbar">
          {(['unassigned', 'mine', 'all', 'resolved'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-[var(--gold)]/20 text-[var(--gold)]'
                  : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface)]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'unassigned' && conversations.filter(c => c.status === 'open' || c.status === 'active').length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[var(--gold)] text-black text-[10px]">
                  {conversations.filter(c => c.status === 'open' || c.status === 'active').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoadingConvs ? (
            <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--gold)]" /></div>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveConv(conv)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  activeConv?.id === conv.id
                    ? 'bg-[var(--surface-elevated)] border border-[var(--gold)]/30'
                    : 'hover:bg-[var(--surface-elevated)] border border-transparent'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-white text-sm truncate pr-2">
                    {getUserDisplayName(conv)}
                  </span>
                  {conv.unread_by_admin > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[var(--gold)] text-black text-[10px] font-bold flex items-center justify-center shrink-0">
                      {conv.unread_by_admin}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {conv.last_message?.content || 'No messages yet'}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded ${
                    conv.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400' :
                    conv.assigned_admin_id ? 'bg-blue-500/20 text-blue-400' :
                    'bg-[var(--gold)]/20 text-[var(--gold)]'
                  }`}>
                    {conv.status.toUpperCase()}
                  </span>
                  {conv.assigned_admin && (
                    <span className="text-[var(--text-muted)] truncate">
                      Admin: {conv.assigned_admin.display_name || conv.assigned_admin.email}
                    </span>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-8 text-sm text-[var(--text-muted)]">
              No conversations found
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden ${!activeConv ? 'hidden md:flex' : 'flex'}`}>
        {activeConv ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface-elevated)]">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveConv(null)} className="md:hidden p-2 -ml-2 text-[var(--text-muted)] hover:text-white">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-[var(--gold)]/20 flex items-center justify-center">
                  <span className="text-[var(--gold)] font-bold">{getUserDisplayName(activeConv).charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{getUserDisplayName(activeConv)}</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {activeConv.user?.email || ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!activeConv.assigned_admin_id && activeConv.status !== 'resolved' && (
                  <button onClick={handleAssign} className="text-xs px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors">
                    Assign to me
                  </button>
                )}
                {activeConv.status !== 'resolved' && (
                  <button onClick={handleResolve} className="text-xs flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors">
                    <CheckCircle className="w-3 h-3" /> Resolve
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingMessages ? (
                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-[var(--gold)]" /></div>
              ) : messages.length > 0 ? (
                messages.map((msg, i) => {
                  const isAdmin = msg.sender_role === 'admin'
                  const showSender = i === 0 || messages[i-1].sender_id !== msg.sender_id
                  return (
                    <div key={msg.id} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                      {showSender && (
                        <span className="text-[10px] text-[var(--text-muted)] mb-1 px-1">
                          {isAdmin ? (msg.sender?.display_name || 'Admin') : getUserDisplayName(activeConv)}
                        </span>
                      )}
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                        isAdmin
                          ? 'bg-[var(--gold)] text-black rounded-tr-sm'
                          : 'bg-[var(--surface-elevated)] border border-[var(--border)] text-white rounded-tl-sm'
                      }`}>
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] mt-1 px-1">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })
              ) : (
                <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-sm">
                  Say hi to {getUserDisplayName(activeConv)}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {activeConv.status !== 'resolved' && (
              <form onSubmit={handleSend} className="p-3 border-t border-[var(--border)] flex gap-2 bg-[var(--surface-elevated)]">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 text-sm focus:border-[var(--gold)] focus:outline-none"
                  disabled={isSending}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isSending}
                  className="w-10 h-10 rounded-xl bg-[var(--gold)] text-black flex items-center justify-center disabled:opacity-50 transition-colors hover:bg-[var(--gold-light)] shrink-0"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            )}
            {activeConv.status === 'resolved' && (
              <div className="p-4 text-center border-t border-[var(--border)] text-sm text-[var(--text-muted)] bg-[var(--surface-elevated)]">
                This conversation is resolved.
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
            <MessageCircle className="w-12 h-12 mb-4 opacity-20" />
            <p>Select a conversation to start chatting</p>
          </div>
        )}
      </div>
    </div>
  )
}
