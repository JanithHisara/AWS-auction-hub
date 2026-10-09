'use client'

import { useConfirm } from '@/components/ui/ConfirmProvider';
import { useEffect, useState, useCallback } from 'react'
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CreditCard,
  Cpu,
  Smartphone,
  MapPin,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Pencil,
  UserPlus,
  Usb,
} from 'lucide-react'

// ---- Types ----

interface NfcCard {
  created_by_user?: { display_name: string | null; email: string } | null
  id: string
  nfc_uid: string
  user_id: string
  is_active: boolean
  label: string | null
  nfc_type?: 'permanent' | 'temporary' 
  created_at: string
  updated_at: string
  users: { id: string; email: string; display_name: string | null }
}

interface Device {
  created_by_user?: { display_name: string | null; email: string } | null
  id: string
  device_id: string
  name: string | null
  status: string
  auction_place_id: string | null
  firmware_version: string | null
  hardware_version: string | null
  last_seen_at: string | null
  created_at: string
  auction_place?: { id: string; name: string } | null
}

interface UserOption {
  id: string
  email: string
  display_name: string | null
}

interface AuctionPlaceOption {
  created_by_user?: { display_name: string | null; email: string } | null
  id: string
  name: string
}

interface AuctionOption {
  id: string
  name: string
  status: string
}

// ---- Component ----

export default function NfcManagementClient() {
  const [activeTab, setActiveTab] = useState<'nfc' | 'devices' | 'places'>('nfc')

  const [quickDeleteUid, setQuickDeleteUid] = useState('')
  const [quickDeleting, setQuickDeleting] = useState(false)
  const [quickDeleteMsg, setQuickDeleteMsg] = useState<{text: string, type: 'success'|'error'} | null>(null)



  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-[var(--border)] pb-2">
        <button
            onClick={() => setActiveTab('nfc')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'nfc'
                ? 'bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30'
                : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)]'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            NFC Cards
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'devices'
                ? 'bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30'
                : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)]'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Devices
          </button>
          
          <button
            onClick={() => setActiveTab('places')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'places'
                ? 'bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30'
                : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)]'
            }`}
          >
            <MapPin className="w-4 h-4" />
            Auction Places
          </button>
      </div>

      {activeTab === 'nfc' ? <NfcCardsTab /> : activeTab === 'devices' ? <DevicesTab /> : <AuctionPlacesTab />}
    </div>
  )
}

// ---- NFC Cards Tab ----

function NfcCardsTab() {
  const [cards, setCards] = useState<NfcCard[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const confirm = useConfirm()
  const [error, setError] = useState<string | null>(null)
    const [editingDevice, setEditingDevice] = useState<any | null>(null)
    const [deletingDevice, setDeletingDevice] = useState<any | null>(null)
    const [editForm, setEditForm] = useState({ name: '', auctionPlaceId: '', firmwareVersion: '', hardwareVersion: '' })
    const [actionSubmitting, setActionSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingCard, setEditingCard] = useState<NfcCard | null>(null)
  const [nfcSubTab, setNfcSubTab] = useState<'permanent' | 'temporary'>('permanent')
  const [auctions, setAuctions] = useState<any[]>([])
  const [showQuickDelete, setShowQuickDelete] = useState(false)
  const [quickDeleteUid, setQuickDeleteUid] = useState('')
  const [quickDeleting, setQuickDeleting] = useState(false)

  

  

  const fetchCards = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: page.toString() })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (nfcSubTab) params.set('nfc_type', nfcSubTab)

      const res = await fetch(`/api/admin/nfc-cards?${params}`)
      if (!res.ok) throw new Error('Failed to load NFC cards')
      const data = await res.json()
      setCards(data.nfcCards)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      setError('Failed to load NFC cards')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, nfcSubTab])

  useEffect(() => {
    async function loadAuctions() {
      try {
        const res = await fetch('/api/admin/auctions-list')
        if (res.ok) {
          const data = await res.json()
          const activeAuctions = data.auctions.filter((a: any) => ['registration_open', 'live'].includes(a.status.toLowerCase()))
          setAuctions(activeAuctions)
        }
      } catch (err) {
        console.error('Failed to load auctions:', err)
      }
    }
    loadAuctions()
  }, [])

  useEffect(() => { fetchCards() }, [fetchCards])

  useEffect(() => { setPage(1) }, [search, statusFilter, nfcSubTab])

  async function handleToggleActive(card: NfcCard) {
    try {
      const res = await fetch(`/api/admin/nfc-cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !card.is_active }),
      })
      if (!res.ok) throw new Error('Failed to update')
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, is_active: !c.is_active } : c))
      setSuccess(`Card ${card.nfc_uid} ${card.is_active ? 'deactivated' : 'activated'}`)
    } catch {
      setError('Failed to update card status')
    }
  }

  async function handleDelete(card: NfcCard) {
    if (!await confirm(`Delete NFC card mapping for ${card.nfc_uid}?`)) return
    try {
      const res = await fetch(`/api/admin/nfc-cards/${card.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setCards(prev => prev.filter(c => c.id !== card.id))
      setTotal(prev => prev - 1)
      setSuccess(`Card ${card.nfc_uid} deleted`)
    } catch {
      setError('Failed to delete card')
    }
  }


  async function handleQuickDelete(e: React.FormEvent) {
    e.preventDefault()
    if (!quickDeleteUid.trim()) return
    setQuickDeleting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/nfc-cards/quick-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nfc_uid: quickDeleteUid.trim() })
      })
      
      let data: any = {}
      const text = await res.text()
      if (text) {
        try {
          data = JSON.parse(text)
        } catch (e) {
          throw new Error(`Server returned non-JSON response: ${text || res.statusText}`)
        }
      }
      
      if (!res.ok) throw new Error(data.error || `Failed to delete (${res.status})`)
      setSuccess(`Temporary card ${quickDeleteUid} successfully deleted.`)
      setQuickDeleteUid('')
      setShowQuickDelete(false)
      fetchCards()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting card')
    } finally {
      setQuickDeleting(false)
    }
  }

  function handleCreated() {
    setShowCreateForm(false)
    setSuccess('NFC card mapping created')
    fetchCards()
  }

  function handleUpdated(card: NfcCard) {
    setCards(prev => prev.map(c => c.id === card.id ? card : c))
    setEditingCard(null)
    setSuccess('NFC card updated')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-[var(--border)] pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => { setNfcSubTab('permanent'); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${nfcSubTab === 'permanent' ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-transparent text-[var(--text-secondary)] hover:text-white'}`}
          >
            Permanent Cards
          </button>
          <button
            onClick={() => { setNfcSubTab('temporary'); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${nfcSubTab === 'temporary' ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-transparent text-[var(--text-secondary)] hover:text-white'}`}
          >
            Temporary Cards
          </button>
        </div>
        
        <div className="flex gap-3 items-center">
          {nfcSubTab === 'temporary' && (
            <button
              onClick={() => setShowQuickDelete(true)}
              className="px-4 py-2 bg-red-500/20 text-red-500 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Delete Card
            </button>
          )}
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-gold flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Add Card
          </button>
        </div>
      </div>

      {showQuickDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Delete Temporary Card</h3>
              <button onClick={() => setShowQuickDelete(false)} className="text-[var(--text-secondary)] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleQuickDelete} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  NFC Card UID
                </label>
                <input
                  type="text"
                  value={quickDeleteUid}
                  onChange={e => setQuickDeleteUid(e.target.value)}
                  placeholder="Enter UID to delete..."
                  className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-white font-mono placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
                  required
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowQuickDelete(false)} className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white">Cancel</button>
                <button type="submit" disabled={quickDeleting || !quickDeleteUid} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                  {quickDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="px-4 py-3 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-400 text-sm flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search by NFC UID or label..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--gold)]/50"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--gold)] text-black rounded-lg text-sm font-medium hover:bg-[var(--gold-light)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Card
        </button>
      </div>

      <div className="text-sm text-[var(--text-secondary)]">
        {total} card{total !== 1 ? 's' : ''} found
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--surface)]">
                <th className="text-left px-4 py-3 text-sm font-semibold text-white">NFC Card</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-white">User</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-white">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-white">Created By</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--gold)] mx-auto" />
                  </td>
                </tr>
              ) : cards.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-[var(--text-secondary)]">
                    No NFC cards found
                  </td>
                </tr>
              ) : (
                cards.map((card) => (
                  <tr key={card.id} className="border-t border-[var(--border)] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[var(--gold)] shrink-0" />
                        <div>
                          <div className="flex gap-2 items-center"><div className="text-sm font-mono font-medium text-white">{card.nfc_uid}</div><span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-secondary)]">{card.nfc_type === 'temporary' ? 'Temp' : 'Perm'}</span></div>
                          {card.label && (
                            <div className="text-xs text-[var(--text-secondary)]">{card.label}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {card.users?.display_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">{card.users?.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggleActive(card)} title={card.is_active ? 'Deactivate' : 'Activate'}>
                        {card.is_active ? (
                          <ToggleRight className="w-6 h-6 text-emerald-400 mx-auto" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-[var(--text-secondary)] mx-auto" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{card.created_by_user ? (card.created_by_user.display_name || card.created_by_user.email) : "Unknown"}</td>
                      <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setEditingCard(card)}
                          className="p-1.5 text-[var(--text-secondary)] hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(card)}
                          className="p-1.5 text-[var(--text-secondary)] hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)]">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-white disabled:opacity-30 hover:bg-[var(--surface-hover)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-white disabled:opacity-30 hover:bg-[var(--surface-hover)] transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showCreateForm && (
        <CreateNfcCardModal
          auctions={auctions}
          onClose={() => setShowCreateForm(false)}
          onCreated={handleCreated}
        />
      )}

      {editingCard && (
        <EditNfcCardModal
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}

// ---- Create Modal with inline user creation ----

function CreateNfcCardModal({
  onClose,
  onCreated,
  auctions,
}: {
  onClose: () => void
  onCreated: () => void
  auctions: any[]
}) {
  const [nfcUid, setNfcUid] = useState('')
  const [label, setLabel] = useState('')
  const [selectedAuction, setSelectedAuction] = useState('')
  const [userId, setUserId] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null)
  const [users, setUsers] = useState<UserOption[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
    const [editingPlace, setEditingPlace] = useState<any | null>(null)
    const [deletingPlace, setDeletingPlace] = useState<any | null>(null)
    const [editName, setEditName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showCreateUser, setShowCreateUser] = useState(false)
    const [nfcType, setNfcType] = useState<'permanent' | 'temporary'>('permanent')

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!userSearch || userSearch.length < 2) { setUsers([]); return }
      setLoadingUsers(true)
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(userSearch)}&limit=10`)
        if (res.ok) {
          const data = await res.json()
          setUsers((data.users || []).map((u: UserOption & { anonymous_name?: string }) => ({
            id: u.id,
            email: u.email,
            display_name: u.display_name,
          })))
        }
      } catch { /* ignore */ } finally {
        setLoadingUsers(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [userSearch])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nfcUid || !userId) {
      setError('NFC UID and User are required')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/nfc-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nfc_uid: nfcUid.trim(),
              user_id: userId,
              label: label.trim() || null,
              nfc_type: nfcType,
              auction_id: selectedAuction || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create')
      }

      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create NFC card mapping')
    } finally {
      setSubmitting(false)
    }
  }

  function handleUserCreated(user: { id: string; email: string; display_name: string | null }) {
    setUserId(user.id)
    setSelectedUser(user)
    setUsers([])
    setUserSearch('')
    setShowCreateUser(false)
  }



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--gold)]/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-[var(--gold)]" />
            </div>
            <h3 className="text-lg font-bold text-white">New NFC Card</h3>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              NFC Card Type
            </label>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 text-white">
                <input type="radio" checked={nfcType === 'permanent'} onChange={() => { setNfcType('permanent'); setShowCreateUser(false); }} className="accent-[var(--gold)]" />
                Permanent
              </label>
              <label className="flex items-center gap-2 text-white">
                <input type="radio" checked={nfcType === 'temporary'} onChange={() => setNfcType('temporary')} className="accent-[var(--gold)]" />
                Temporary
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              NFC Card UID *
            </label>
            <input
              type="text"
              value={nfcUid}
              onChange={e => setNfcUid(e.target.value)}
              placeholder="e.g. 04A3B21C7F8890"
              className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-white font-mono placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
              required
            />
          </div>

          {nfcType === 'temporary' && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Assign to Auction
              </label>
              <select
                value={selectedAuction}
                onChange={e => setSelectedAuction(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--gold)]/50"
              >
                <option value="">-- No Auction (Skip Registration) --</option>
                {auctions.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.status})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Card #12"
              className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">User *</label>
              {!selectedUser && nfcType === 'temporary' && (
                <button
                  type="button"
                  onClick={() => setShowCreateUser(true)}
                  className="flex items-center gap-1 text-xs text-[var(--gold)] hover:underline"
                >
                  <UserPlus className="w-3 h-3" /> Create New User
                </button>
              )}
            </div>
            {selectedUser ? (
              <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg">
                <div>
                  <div className="text-sm text-white">{selectedUser.display_name || selectedUser.email}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{selectedUser.email}</div>
                </div>
                <button type="button" onClick={() => { setUserId(''); setUserSearch(''); setSelectedUser(null) }} className="text-[var(--text-secondary)] hover:text-white">  
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search users by email or name..."
                  className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
                />
                {loadingUsers && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[var(--gold)]" />
                )}
                {users.length > 0 && !userId && (
                  <div className="absolute z-10 w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {users.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setSelectedUser(u); setUserId(u.id); setUserSearch('') }}
                        className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors"
                      >
                        <div className="text-sm text-white">{u.display_name || u.email}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{u.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !nfcUid || !userId}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--gold)] text-black rounded-lg text-sm font-medium hover:bg-[var(--gold-light)] transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Card
            </button>
          </div>
        </form>

        {showCreateUser && (
          <InlineCreateUserModal
            onClose={() => setShowCreateUser(false)}
            onCreated={handleUserCreated}
          />
        )}
      </div>
    </div>
  )
}

// ---- Inline Create User Modal ----

function InlineCreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (user: { id: string; email: string; display_name: string | null }) => void
}) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) { setError('Name is required'); return }
    if (!email.trim()) { setError('Email is required'); return }
    if (!phone.trim()) { setError('Phone is required'); return }
    if (!password.trim()) { setError('Password is required'); return }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/users/quick-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          password: password.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create user')
      }

      const { user } = await res.json()
      onCreated(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[var(--gold)]" />
            <h4 className="text-base font-bold text-white">Quick Create User</h4>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Name *</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Full name"
              autoFocus
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+94 77 123 4567"
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Initial Password *</label>
            <input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter initial password"
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
              required
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !displayName.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--gold)] text-black rounded-lg text-xs font-bold hover:bg-[var(--gold-light)] disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Edit Modal (simplified - no auction) ----

function EditNfcCardModal({
  card,
  onClose,
  onUpdated,
}: {
  card: NfcCard
  onClose: () => void
  onUpdated: (card: NfcCard) => void
}) {
  const [label, setLabel] = useState(card.label || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/nfc-cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() || null }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }

      const data = await res.json()
      onUpdated(data.nfcCard)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Pencil className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Edit NFC Card</h3>
              <p className="text-xs text-[var(--text-secondary)] font-mono">{card.nfc_uid}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4 px-4 py-3 bg-white/5 rounded-lg">
          <div className="text-xs text-[var(--text-secondary)] mb-1">Mapped User</div>
          <div className="text-sm text-white">{card.users?.display_name || card.users?.email}</div>
          <div className="text-xs text-[var(--text-secondary)]">{card.users?.email}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Label</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Card #12"
              className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--gold)] text-black rounded-lg text-sm font-medium hover:bg-[var(--gold-light)] transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Devices Tab (with auction assignment) ----

function DevicesTab() {
  const [devices, setDevices] = useState<Device[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const confirm = useConfirm()
  const [error, setError] = useState<string | null>(null)
    const [editingDevice, setEditingDevice] = useState<any | null>(null)
    const [deletingDevice, setDeletingDevice] = useState<any | null>(null)
    const [editForm, setEditForm] = useState({ name: '', auctionPlaceId: '', firmwareVersion: '', hardwareVersion: '' })
    const [actionSubmitting, setActionSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const fetchDevices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: page.toString() })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/admin/devices?${params}`)
      if (!res.ok) throw new Error('Failed to load devices')
      const data = await res.json()
      setDevices(data.devices)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      setError('Failed to load devices')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { fetchDevices() }, [fetchDevices])
  useEffect(() => { setPage(1) }, [search, statusFilter])

  function handleCreated() {
    setShowCreateForm(false)
    setSuccess('Device registered')
    fetchDevices()
  }

  function formatLastSeen(dateStr: string | null) {
    if (!dateStr) return 'Never'
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return new Date(dateStr).toLocaleDateString()
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="px-4 py-3 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-400 text-sm flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search by device ID or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--gold)]/50"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--gold)] text-black rounded-lg text-sm font-medium hover:bg-[var(--gold-light)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Register Device
        </button>
      </div>

      <div className="text-sm text-[var(--text-secondary)]">
        {total} device{total !== 1 ? 's' : ''} found
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--surface)]">
                <th className="text-left px-4 py-3 text-sm font-semibold text-white">Device</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-white hidden md:table-cell">Auction Place</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-white hidden lg:table-cell">Firmware</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-white">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-white hidden md:table-cell">Last Seen</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-white">Created By</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--gold)] mx-auto" />
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[var(--text-secondary)]">
                    No devices registered
                  </td>
                </tr>
              ) : (
                devices.map(device => (
                  <tr key={device.id} className="border-t border-[var(--border)] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-blue-400 shrink-0" />
                        <div>
                          <div className="text-sm font-mono font-medium text-white">{device.device_id}</div>
                          {device.name && (
                            <div className="text-xs text-[var(--text-secondary)]">{device.name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {device.auction_place ? (
                        <div className="text-sm text-white">{device.auction_place.name}</div>
                      ) : (
                        <span className="text-xs text-[var(--text-secondary)]">Not assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm text-[var(--text-secondary)]">
                        {device.firmware_version || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <DeviceStatusBadge status={device.status} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-[var(--text-secondary)]">
                        {formatLastSeen(device.last_seen_at)}
                      </span>
                    </td>
                                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                        {device.created_by_user ? (device.created_by_user.display_name || device.created_by_user.email) : "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <button onClick={() => { setEditingDevice(device); setEditForm({ name: device.name || '', auctionPlaceId: device.auction_place_id || '', firmwareVersion: device.firmware_version || '', hardwareVersion: device.hardware_version || '' }) }} className="p-1 text-[var(--text-secondary)] hover:text-white transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeletingDevice(device)} className="p-1 text-[var(--text-secondary)] hover:text-red-400 transition-colors ml-2">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)]">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-white disabled:opacity-30 hover:bg-[var(--surface-hover)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-white disabled:opacity-30 hover:bg-[var(--surface-hover)] transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showCreateForm && (
        <CreateDeviceModal
          onClose={() => setShowCreateForm(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}

// ---- Create Device Modal (with auction assignment) ----

function CreateDeviceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [deviceId, setDeviceId] = useState('')
    const [name, setName] = useState('')
    const [auctionPlaceId, setAuctionPlaceId] = useState('')
    const [firmwareVersion, setFirmwareVersion] = useState('')
    const [hardwareVersion, setHardwareVersion] = useState('')
    const [auctionPlaces, setAuctionPlaces] = useState<AuctionPlaceOption[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loadingPlaces, setLoadingPlaces] = useState(false)
    const [readingUsb, setReadingUsb] = useState(false)
  useEffect(() => {
    async function loadPlaces() {
      setLoadingPlaces(true)
      try {
        const res = await fetch('/api/admin/auction-places')
        if (res.ok) {
          const data = await res.json()
          setAuctionPlaces(data.places || [])
        }
      } catch { /* ignore */ } finally {
        setLoadingPlaces(false)
      }
    }
    loadPlaces()
  }, [])

  async function readDeviceIdFromUSB() {
    try {
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API not supported in this browser. Use Chrome, Edge, or Opera.')
      }
      
      setReadingUsb(true)
      setError(null)
      
      // Request a port and open it
      const navSerial = (navigator as any).serial;
      const port = await navSerial.requestPort()
      await port.open({ baudRate: 115200 }) // Common ESP32 baud rate
      
      // Auto-reset ESP32 using standard DTR/RTS sequence
      try {
        await port.setSignals({ dataTerminalReady: false, requestToSend: true })
        await new Promise(resolve => setTimeout(resolve, 100))
        await port.setSignals({ dataTerminalReady: false, requestToSend: false })
      } catch (e) {
        console.warn('Failed to set signals for auto-reset:', e)
      }
      
      const reader = port.readable?.getReader()
      if (!reader) throw new Error('Cannot read from port')

      const decoder = new TextDecoder()
      let buffer = ''
      
      // Read loop with 10s timeout
      const timeout = setTimeout(() => {
        reader.cancel()
      }, 10000)
      
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          if (value) {
            buffer += decoder.decode(value, { stream: true })
            
            // Look for DEVICE_ID:XX:XX:XX:XX:XX:XX or just a MAC address pattern
            // Allowing for plain MAC address format like 24:0A:C4:00:01:10
            const macMatch = buffer.match(/(?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2})/)
            if (macMatch) {
              setDeviceId(macMatch[0].toUpperCase())
              clearTimeout(timeout)
              reader.cancel()
              break
            }
          }
        }
      } finally {
        reader.releaseLock()
        await port.close()
      }
      
    } catch (err) {
      if (err instanceof Error && err.name === 'NotFoundError') {
        // User cancelled port selection
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to read from USB')
    } finally {
      setReadingUsb(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!deviceId.trim()) { setError('Device ID is required'); return }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId.trim(),
            name: name.trim() || null,
            auction_place_id: auctionPlaceId || null,
            firmware_version: firmwareVersion.trim() || null,
            hardware_version: hardwareVersion.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to register device')
      }

      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register device')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Register Device</h3>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Device ID *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={deviceId}
                onChange={e => setDeviceId(e.target.value)}
                placeholder="e.g. 24:0A:C4:00:01:10"
                className="flex-1 px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-white font-mono placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
                required
              />
              <button
                type="button"
                onClick={readDeviceIdFromUSB}
                disabled={readingUsb}
                className="px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] hover:border-[var(--gold)]/50 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                title="Connect ESP32 via USB and read its MAC Address"
              >
                {readingUsb ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <Usb className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{readingUsb ? 'Reading...' : 'Read USB'}</span>
              </button>
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
              Click &quot;Read USB&quot; to automatically restart your ESP32 and capture its ID.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Auction Place</label>
            {loadingPlaces ? (
              <div className="px-4 py-2.5 text-sm text-[var(--text-secondary)]">Loading auctions...</div>
            ) : (
              <select
                value={auctionPlaceId}
                onChange={e => setAuctionPlaceId(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--gold)]/50"
              >
                <option value="">Unassigned place</option>
                {auctionPlaces.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </div>


          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !deviceId.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--gold)] text-black rounded-lg text-sm font-medium hover:bg-[var(--gold-light)] transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Register
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Badge Components ----

function AuctionStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    live: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    registration_open: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    upcoming: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    ended: 'bg-white/5 text-[var(--text-secondary)] border-white/10',
    completed: 'bg-white/5 text-[var(--text-secondary)] border-white/10',
    draft: 'bg-white/5 text-[var(--text-secondary)] border-white/10',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[status] || colors.draft}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function DeviceStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    inactive: 'bg-white/5 text-[var(--text-secondary)] border-white/10',
    maintenance: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${colors[status] || colors.inactive}`}>
      {status}
    </span>
  )
}


function AuctionPlacesTab() {
  const [places, setPlaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const confirm = useConfirm()
  const [error, setError] = useState<string | null>(null)
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newPlaceName, setNewPlaceName] = useState('')
  const [submitting, setSubmitting] = useState(false)
    const [editingPlace, setEditingPlace] = useState<any | null>(null)
    const [deletingPlace, setDeletingPlace] = useState<any | null>(null)
    const [editName, setEditName] = useState('')

  const loadPlaces = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/auction-places')
      if (!res.ok) throw new Error('Failed to load auction places')
      const data = await res.json()
      setPlaces(data.places || [])
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlaces()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlaceName.trim()) return

    try {
      setSubmitting(true)
      const res = await fetch('/api/admin/auction-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlaceName.trim() })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create place')
      }

      setIsCreateModalOpen(false)
      setNewPlaceName('')
      loadPlaces()
    } catch (err: any) {
      confirm(err.message, { isAlert: true, confirmText: 'OK', title: 'Error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && places.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[var(--gold)] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Auction Places</h2>
          <p className="text-[var(--text-secondary)] mt-1">Manage physical locations for devices</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-[var(--gold)] text-black px-4 py-2 rounded-lg font-medium hover:bg-[var(--gold)]/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Place
        </button>
      </div>

      {error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-light)]/50">
                  <th className="text-left px-4 py-3 text-sm font-semibold text-white">Place Name</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-white">Created At</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-white">Created By</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {places.map((place) => (
                  <tr key={place.id} className="hover:bg-[var(--surface-light)]/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm text-white font-medium">{place.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-[var(--text-secondary)]">
                        {new Date(place.created_at).toLocaleDateString()}
                      </div>
                    </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                        {place.created_by_user ? (place.created_by_user.display_name || place.created_by_user.email) : 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <button onClick={() => { setEditingPlace(place); setEditName(place.name) }} className="p-1 text-[var(--text-secondary)] hover:text-white transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeletingPlace(place)} className="p-1 text-[var(--text-secondary)] hover:text-red-400 transition-colors ml-2">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                  </tr>
                ))}
                {places.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                      No auction places found. Create one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && setIsCreateModalOpen(false)} />
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md relative z-10 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Create Auction Place</h3>
              <button 
                onClick={() => !submitting && setIsCreateModalOpen(false)}
                className="p-2 hover:bg-[var(--surface-light)] rounded-lg transition-colors text-[var(--text-secondary)] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Place Name</label>
                <input
                  type="text"
                  required
                  value={newPlaceName}
                  onChange={e => setNewPlaceName(e.target.value)}
                  placeholder="e.g. Main Hall"
                  className="w-full bg-[var(--surface-light)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[var(--gold)] transition-colors placeholder:text-gray-600"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg font-medium text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-light)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newPlaceName.trim()}
                  className="px-4 py-2 rounded-lg font-medium bg-[var(--gold)] text-black hover:bg-[var(--gold)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Place'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPlace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Edit Auction Place</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(true);
              try {
                const res = await fetch(`/api/admin/auction-places/${editingPlace.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: editName })
                });
                if (!res.ok) throw new Error('Failed to update');
                setEditingPlace(null);
                loadPlaces();
              } catch (err: any) {
                confirm(err.message, { isAlert: true, confirmText: 'OK', title: 'Error' });
              } finally {
                setSubmitting(false);
              }
            }}>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-white mb-4 focus:outline-none focus:border-[var(--gold)]/50" required />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setEditingPlace(null)} className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-[var(--gold)] text-black rounded-lg text-sm font-medium hover:bg-[var(--gold-light)] transition-colors disabled:opacity-50">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingPlace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Delete Auction Place?</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6">Are you sure you want to delete "{deletingPlace.name}"? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingPlace(null)} className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors">Cancel</button>
              <button onClick={async () => {
                setSubmitting(true);
                try {
                  const res = await fetch(`/api/admin/auction-places/${deletingPlace.id}`, { method: 'DELETE' });
                  if (!res.ok) throw new Error('Failed to delete');
                  setDeletingPlace(null);
                  loadPlaces();
                } catch (err: any) {
                  confirm(err.message, { isAlert: true, confirmText: 'OK', title: 'Error' });
                } finally {
                  setSubmitting(false);
                }
              }} disabled={submitting} className="px-4 py-2 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

