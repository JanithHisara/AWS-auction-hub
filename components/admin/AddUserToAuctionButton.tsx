'use client'

import { useState, useEffect } from 'react'
import { UserPlus, X, Loader2, Search, CheckCircle2 } from 'lucide-react'

interface UserOption {
  id: string
  email: string
  display_name: string | null
  anonymous_name?: string | null
}

export default function AddUserToAuctionButton({ auctionId }: { auctionId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--gold)]/20 border border-[var(--gold)]/30 rounded-lg text-sm text-[var(--gold)] hover:bg-[var(--gold)]/30 transition-colors"
      >
        <UserPlus className="w-3.5 h-3.5" />
        Add User
      </button>
      {open && (
        <AddUserModal auctionId={auctionId} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

function AddUserModal({ auctionId, onClose }: { auctionId: string; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(false)
  const [registering, setRegistering] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!search || search.length < 2) { setUsers([]); return }
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}&limit=10`)
        if (res.ok) {
          const data = await res.json()
          setUsers((data.users || []).map((u: UserOption) => ({
            id: u.id,
            email: u.email,
            display_name: u.display_name,
            anonymous_name: u.anonymous_name,
          })))
        }
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  async function handleRegister(user: UserOption) {
    setRegistering(user.id)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/admin/auctions/${auctionId}/register-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to register user')
        return
      }

      setSuccess(`${user.display_name || user.email} registered successfully`)
      setUsers(prev => prev.filter(u => u.id !== user.id))
    } catch {
      setError('Network error')
    } finally {
      setRegistering(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--gold)]/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-[var(--gold)]" />
            </div>
            <h3 className="text-lg font-bold text-white">Add User to Auction</h3>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm flex items-center justify-between">
            {error}
            <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {success && (
          <div className="mb-4 px-4 py-3 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or phone..."
            autoFocus
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[var(--gold)]" />
          )}
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {users.length === 0 && search.length >= 2 && !loading ? (
            <div className="text-center py-8 text-[var(--text-secondary)] text-sm">
              No users found
            </div>
          ) : (
            users.map(user => (
              <div
                key={user.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div>
                  <div className="text-sm font-medium text-white">
                    {user.display_name || user.anonymous_name || user.email}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">{user.email}</div>
                </div>
                <button
                  onClick={() => handleRegister(user)}
                  disabled={registering === user.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--gold)] text-black rounded-lg text-xs font-bold hover:bg-[var(--gold-light)] transition-colors disabled:opacity-50"
                >
                  {registering === user.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <UserPlus className="w-3 h-3" />
                  )}
                  Register
                </button>
              </div>
            ))
          )}
          {search.length < 2 && (
            <div className="text-center py-8 text-[var(--text-secondary)] text-sm">
              Type at least 2 characters to search
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-[var(--border)] mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}



