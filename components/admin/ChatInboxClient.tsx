'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatConversation, ChatMessage, User, Auction } from '@/types/database'
import { 
  MessageCircle, Send, Loader2, ArrowLeft, CheckCircle, RotateCcw, 
  Trash2, Search, Gavel, UserCheck, RefreshCw
} from 'lucide-react'

type Tab = 'all' | 'unread' | 'mine' | 'resolved'

type ConversationWithRelations = ChatConversation & {
  user?: User
  assigned_admin?: User
  auction?: {
    id: string
    name: string
    status: string
    auction_type?: string
  }
}

export default function ChatInboxClient({ adminId }: { adminId: string }) {
  const [conversations, setConversations] = useState<ConversationWithRelations[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [selectedAuctionId, setSelectedAuctionId] = useState<string>('all')
  const [activeConv, setActiveConv] = useState<ConversationWithRelations | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingConvs, setIsLoadingConvs] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isErasingAuction, setIsErasingAuction] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Read URL query parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const urlAuctionId = params.get('auctionId')
      const urlConvId = params.get('convId')
      if (urlAuctionId) {
        setSelectedAuctionId(urlAuctionId)
      }
      if (urlConvId) {
        sessionStorage.setItem('pending_conv_id', urlConvId)
      }
    }
  }, [])

  // Fetch conversations and published auctions
  const fetchConversations = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoadingConvs(true)
    try {
      const res = await fetch('/api/chat/conversations?auction_id=all')
      if (!res.ok) return
      const data = await res.json()
      
      let convList: ConversationWithRelations[] = []
      if (data?.conversations && Array.isArray(data.conversations)) {
        convList = data.conversations
        if (Array.isArray(data.auctions)) {
          setAuctions(data.auctions)
        }
      } else if (Array.isArray(data)) {
        convList = data
      }

      setConversations(convList)

      // Handle pending conversation selection from URL
      const pendingConvId = typeof window !== 'undefined' ? sessionStorage.getItem('pending_conv_id') : null
      if (pendingConvId) {
        const found = convList.find(c => c.id === pendingConvId)
        if (found) {
          setActiveConv(found)
          if (found.auction_id) {
            setSelectedAuctionId(found.auction_id)
          }
          sessionStorage.removeItem('pending_conv_id')
        }
      }
    } catch (e) {
      console.error('Failed to load conversations:', e)
    } finally {
      if (!isSilent) setIsLoadingConvs(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
    const timer = setInterval(() => fetchConversations(true), 4000)
    return () => clearInterval(timer)
  }, [fetchConversations])

  // Fetch messages for active conversation
  const fetchActiveMessages = useCallback(async (isSilent = false) => {
    if (!activeConv?.id) return
    if (!isSilent) setIsLoadingMessages(true)
    try {
      const res = await fetch(`/api/chat/conversations/${activeConv.id}/messages`)
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) {
        setMessages(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      if (!isSilent) setIsLoadingMessages(false)
    }
  }, [activeConv?.id])

  useEffect(() => {
    if (!activeConv?.id) {
      setMessages([])
      return
    }

    fetchActiveMessages(false)
    setTimeout(scrollToBottom, 150)

    // Mark as read
    fetch(`/api/chat/conversations/${activeConv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read' }),
    }).then(() => {
      setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, unread_by_admin: 0 } : c))
    }).catch(() => {})

    // Polling for new messages in active chat
    const interval = setInterval(() => {
      fetchActiveMessages(true)
    }, 3000)

    return () => clearInterval(interval)
  }, [activeConv?.id, fetchActiveMessages, scrollToBottom])

  // Send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !activeConv || isSending) return

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
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(scrollToBottom, 50)

    try {
      const res = await fetch(`/api/chat/conversations/${activeConv.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent }),
      })

      if (!res.ok) throw new Error('Failed to send')
      const sent = await res.json()
      setMessages(prev => prev.map(m => m.id === optimistic.id ? sent : m))
      fetchConversations(true)
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setInput(messageContent)
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  // Erase all chat for the selected auction
  const handleEraseAuctionChat = async () => {
    if (selectedAuctionId === 'all') return
    const currentAuction = auctions.find(a => a.id === selectedAuctionId)
    const auctionName = currentAuction?.name || 'this auction'
    
    if (!window.confirm(`Are you sure you want to erase all chat history for ${auctionName}? All conversations and messages will be permanently deleted.`)) {
      return
    }

    setIsErasingAuction(true)
    try {
      const res = await fetch(`/api/chat/conversations?auction_id=${selectedAuctionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to erase')

      setConversations(prev => prev.filter(c => c.auction_id !== selectedAuctionId))
      if (activeConv?.auction_id === selectedAuctionId) {
        setActiveConv(null)
      }
      alert(`All chat conversations for ${auctionName} have been erased.`)
    } catch (err: any) {
      alert(`Error erasing chat: ${err.message}`)
    } finally {
      setIsErasingAuction(false)
    }
  }

  // Delete active single conversation
  const handleDeleteActiveConv = async () => {
    if (!activeConv) return
    const userName = getUserDisplayName(activeConv)
    if (!window.confirm(`Delete conversation with ${userName}?`)) return

    try {
      await fetch(`/api/chat/conversations/${activeConv.id}`, {
        method: 'DELETE',
      })
      setConversations(prev => prev.filter(c => c.id !== activeConv.id))
      setActiveConv(null)
    } catch (err: any) {
      alert(`Failed to delete conversation: ${err.message}`)
    }
  }

  // Resolve / Reopen
  const handleToggleResolve = async () => {
    if (!activeConv) return
    const newAction = activeConv.status === 'resolved' ? 'reopen' : 'resolve'
    try {
      await fetch(`/api/chat/conversations/${activeConv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: newAction }),
      })
      const updatedStatus = newAction === 'resolve' ? 'resolved' : 'open'
      setActiveConv(prev => prev ? { ...prev, status: updatedStatus } : null)
      setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, status: updatedStatus } : c))
    } catch (e) {
      console.error(e)
    }
  }

  // Assign to me
  const handleAssign = async () => {
    if (!activeConv) return
    try {
      await fetch(`/api/chat/conversations/${activeConv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign' }),
      })
      setActiveConv(prev => prev ? { ...prev, assigned_admin_id: adminId } : null)
      setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, assigned_admin_id: adminId } : c))
    } catch (e) {
      console.error(e)
    }
  }

  const getUserDisplayName = (conv: ConversationWithRelations) => {
    if (conv.user?.display_name) return conv.user.display_name
    if (conv.user?.anonymous_name) return conv.user.anonymous_name
    return 'Bidder'
  }

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    // Auction filter
    if (selectedAuctionId !== 'all' && c.auction_id !== selectedAuctionId) {
      return false
    }

    // Tab filter
    if (activeTab === 'unread' && (c.unread_by_admin || 0) === 0) return false
    if (activeTab === 'mine' && c.assigned_admin_id !== adminId) return false
    if (activeTab === 'resolved' && c.status !== 'resolved') return false
    if (activeTab === 'all' && c.status === 'resolved') return false

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const name = getUserDisplayName(c).toLowerCase()
      const email = (c.user?.email || '').toLowerCase()
      const lastMsg = (c.last_message?.content || '').toLowerCase()
      return name.includes(q) || email.includes(q) || lastMsg.includes(q)
    }

    return true
  })

  // Calculate unread badge count for an auction
  const getAuctionUnreadCount = (auctionId: string) => {
    return conversations
      .filter(c => auctionId === 'all' || c.auction_id === auctionId)
      .reduce((sum, c) => sum + (c.unread_by_admin || 0), 0)
  }

  const getAuctionUserCount = (auctionId: string) => {
    return conversations.filter(c => auctionId === 'all' || c.auction_id === auctionId).length
  }

  const selectedAuction = auctions.find(a => a.id === selectedAuctionId)

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] gap-4 p-4 max-w-7xl mx-auto">
      {/* Top Bar: Auction Selector */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)]">
              <Gavel className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                AUCTION CHAT INBOX
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20">
                  Auction-Wise
                </span>
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Select a published auction to inspect user queries and respond
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedAuctionId !== 'all' && (
              <button
                onClick={handleEraseAuctionChat}
                disabled={isErasingAuction}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all disabled:opacity-50"
                title="Erase all conversations and messages for this auction"
              >
                {isErasingAuction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Erase Auction Chat
              </button>
            )}

            <button
              onClick={() => fetchConversations()}
              disabled={isLoadingConvs}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-elevated)] transition-colors"
              title="Refresh conversations"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingConvs ? 'animate-spin text-[var(--gold)]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Horizontal Auction Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {/* All Auctions Tab */}
          <button
            onClick={() => setSelectedAuctionId('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border ${
              selectedAuctionId === 'all'
                ? 'bg-[var(--gold)] text-black border-[var(--gold)] shadow-md shadow-[var(--gold)]/20'
                : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--gold)]/50 hover:text-white'
            }`}
          >
            <span>All Active Auctions</span>
            {getAuctionUnreadCount('all') > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedAuctionId === 'all' ? 'bg-black text-[var(--gold)]' : 'bg-[var(--gold)] text-black'
              }`}>
                {getAuctionUnreadCount('all')}
              </span>
            )}
          </button>

          {/* Published Auctions List */}
          {auctions.map(auc => {
            const isSelected = selectedAuctionId === auc.id
            const unread = getAuctionUnreadCount(auc.id)
            const userCount = getAuctionUserCount(auc.id)
            return (
              <button
                key={auc.id}
                onClick={() => setSelectedAuctionId(auc.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-[var(--gold)] text-black border-[var(--gold)] shadow-md shadow-[var(--gold)]/20'
                    : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--gold)]/50 hover:text-white'
                }`}
              >
                <span>{auc.name}</span>
                <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-black ${
                  isSelected ? 'bg-black/20 text-black' : 'bg-black/40 text-[var(--text-muted)]'
                }`}>
                  {auc.status}
                </span>
                {userCount > 0 && (
                  <span className="text-[10px] opacity-75 font-medium">
                    ({userCount})
                  </span>
                )}
                {unread > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isSelected ? 'bg-black text-[var(--gold)]' : 'bg-[var(--gold)] text-black'
                  }`}>
                    {unread}
                  </span>
                )}
              </button>
            )
          })}

          {auctions.length === 0 && (
            <span className="text-xs text-[var(--text-muted)] italic py-1 px-2">
              No published auctions currently active
            </span>
          )}
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        {/* Left Column: Users List for Selected Auction */}
        <div className={`w-full md:w-96 flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden ${activeConv ? 'hidden md:flex' : 'flex'}`}>
          {/* Subheader: Selected auction info & Search */}
          <div className="p-3.5 border-b border-[var(--border)] bg-[var(--surface-elevated)]/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--gold)] truncate max-w-[220px]">
                  {selectedAuction ? selectedAuction.name : 'All Auctions'}
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {filteredConversations.length} {filteredConversations.length === 1 ? 'user conversation' : 'user conversations'}
                </p>
              </div>

              {selectedAuction && (
                <span className="text-[10px] uppercase px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {selectedAuction.status}
                </span>
              )}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search users by name, email, message..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)]"
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[var(--background)] p-1 rounded-xl border border-[var(--border)]">
              {(['all', 'unread', 'mine', 'resolved'] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1 text-[11px] font-bold rounded-lg capitalize transition-all ${
                    activeTab === tab
                      ? 'bg-[var(--gold)] text-black'
                      : 'text-[var(--text-muted)] hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations / Users List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]/50 p-2 space-y-1">
            {isLoadingConvs ? (
              <div className="flex flex-col items-center justify-center p-12 text-[var(--text-muted)]">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--gold)] mb-2" />
                <span className="text-xs">Loading conversations...</span>
              </div>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map(conv => {
                const isActive = activeConv?.id === conv.id
                const displayName = getUserDisplayName(conv)
                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConv(conv)}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-[var(--surface-elevated)] border border-[var(--gold)]/40 shadow-sm'
                        : 'hover:bg-[var(--surface-elevated)] border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--gold)]/30 to-[var(--gold)]/10 border border-[var(--gold)]/30 flex items-center justify-center flex-shrink-0 text-[var(--gold)] font-bold text-xs">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                          <span className="font-bold text-white text-xs truncate pr-1">
                            {displayName}
                          </span>
                          {(conv.unread_by_admin || 0) > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-[var(--gold)] text-black text-[9px] font-black shrink-0">
                              {conv.unread_by_admin} NEW
                            </span>
                          )}
                        </div>

                        {selectedAuctionId === 'all' && conv.auction?.name && (
                          <span className="inline-block text-[9px] px-1.5 py-0.2 rounded bg-[var(--gold)]/10 text-[var(--gold)] font-medium mb-1 truncate max-w-[160px]">
                            {conv.auction.name}
                          </span>
                        )}

                        <p className="text-[11px] text-[var(--text-muted)] truncate mb-1">
                          {conv.last_message?.content || 'No messages yet'}
                        </p>

                        <div className="flex items-center gap-1.5 text-[9px]">
                          <span className={`px-1.5 py-0.2 rounded font-bold ${
                            conv.status === 'resolved'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-[var(--gold)]/15 text-[var(--gold)]'
                          }`}>
                            {conv.status.toUpperCase()}
                          </span>
                          {conv.assigned_admin && (
                            <span className="text-[var(--text-muted)] truncate">
                              • Admin: {conv.assigned_admin.display_name || conv.assigned_admin.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="text-center py-12 px-4 text-xs text-[var(--text-muted)] space-y-2">
                <MessageCircle className="w-8 h-8 mx-auto opacity-20" />
                <p>No user messages found {selectedAuction ? `for ${selectedAuction.name}` : ''}.</p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  When users send messages in this auction room, they will appear here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Chat Thread */}
        <div className={`flex-1 flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden ${!activeConv ? 'hidden md:flex' : 'flex'}`}>
          {activeConv ? (
            <>
              {/* Active Chat Header */}
              <div className="p-3.5 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface-elevated)]/60">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setActiveConv(null)}
                    className="md:hidden p-1.5 -ml-1 text-[var(--text-muted)] hover:text-white rounded-lg hover:bg-white/5"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-[var(--gold)]/20 border border-[var(--gold)]/40 flex items-center justify-center flex-shrink-0 text-[var(--gold)] font-bold text-sm">
                    {getUserDisplayName(activeConv).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-sm truncate">
                        {getUserDisplayName(activeConv)}
                      </h3>
                      {activeConv.auction?.name && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--gold)]/15 text-[var(--gold)] font-bold truncate max-w-[180px]">
                          {activeConv.auction.name}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">
                      {activeConv.user?.email || 'Registered Bidder'}
                      {activeConv.user?.phone ? ` • ${activeConv.user.phone}` : ''}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!activeConv.assigned_admin_id && (
                    <button
                      onClick={handleAssign}
                      className="text-xs font-bold px-2.5 py-1.5 bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 rounded-xl transition-colors flex items-center gap-1"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Assign to me
                    </button>
                  )}

                  <button
                    onClick={handleToggleResolve}
                    className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border transition-colors flex items-center gap-1 ${
                      activeConv.status === 'resolved'
                        ? 'bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30 hover:bg-[var(--gold)]/25'
                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                    }`}
                  >
                    {activeConv.status === 'resolved' ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" /> Reopen
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" /> Resolve
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDeleteActiveConv}
                    className="p-1.5 text-red-400 hover:bg-red-500/15 rounded-xl border border-red-500/20 transition-colors"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoadingMessages ? (
                  <div className="flex justify-center p-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--gold)]" />
                  </div>
                ) : messages.length > 0 ? (
                  messages.map((msg, i) => {
                    const isAdmin = msg.sender_role === 'admin'
                    const showSender = i === 0 || messages[i-1].sender_id !== msg.sender_id
                    return (
                      <div key={msg.id} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                        {showSender && (
                          <span className="text-[10px] text-[var(--text-muted)] mb-1 px-1 font-semibold">
                            {isAdmin ? 'Admin (You)' : getUserDisplayName(activeConv)}
                          </span>
                        )}
                        <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                          isAdmin
                            ? 'bg-[var(--gold)] text-black font-medium rounded-tr-sm'
                            : 'bg-[var(--surface-elevated)] border border-[var(--border)] text-white rounded-tl-sm'
                        }`}>
                          {msg.content}
                        </div>
                        <span className="text-[9px] text-[var(--text-muted)] mt-1 px-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] text-xs text-center p-8 space-y-2">
                    <MessageCircle className="w-8 h-8 opacity-20" />
                    <p>No messages in this conversation yet.</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      Type a message below to start chatting with {getUserDisplayName(activeConv)}.
                    </p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Form */}
              <form onSubmit={handleSend} className="p-3 border-t border-[var(--border)] flex gap-2 bg-[var(--surface-elevated)]/70">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={`Reply to ${getUserDisplayName(activeConv)}...`}
                  className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-2 text-xs text-white placeholder-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none"
                  disabled={isSending}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isSending}
                  className="px-4 py-2 rounded-xl bg-[var(--gold)] text-black text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors hover:bg-[var(--gold-light)] shrink-0"
                >
                  {isSending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Send</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--gold)]/40">
                <MessageCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Select a User Conversation</h4>
                <p className="text-xs text-[var(--text-muted)] max-w-sm mt-1">
                  {selectedAuction 
                    ? `Showing user messages for auction "${selectedAuction.name}". Click any user on the left to chat.`
                    : 'Select an auction from the top tabs and click a user to view and reply to their messages.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}