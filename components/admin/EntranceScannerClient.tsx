'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserPlus,
  Loader2,
  X,
  Scan,
} from 'lucide-react'

interface ScanResult {
  id: string
  nfc_uid: string
  status: 'registered' | 'already_registered' | 'card_not_found' | 'card_inactive' | 'error'
  message: string
  user?: { id: string; email: string; display_name: string | null; phone: string | null }
  timestamp: Date
}

export default function EntranceScannerClient({
  auctionId,
  auctionName,
}: {
  auctionId: string
  auctionName: string
}) {
  const [nfcInput, setNfcInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState<ScanResult[]>([])
  const [showCreateUser, setShowCreateUser] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultCountRef = useRef(0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleScan = useCallback(async (uid: string) => {
    const trimmedUid = uid.trim().toUpperCase()
    if (!trimmedUid || scanning) return

    setScanning(true)
    setNfcInput('')

    try {
      const res = await fetch(`/api/admin/auctions/${auctionId}/entrance-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nfc_uid: trimmedUid }),
      })

      const data = await res.json()

      if (!res.ok) {
        setResults(prev => [{
          id: `${Date.now()}-${resultCountRef.current++}`,
          nfc_uid: trimmedUid,
          status: 'error',
          message: data.error || 'Server error',
          timestamp: new Date(),
        }, ...prev])
        return
      }

      const result: ScanResult = {
        id: `${Date.now()}-${resultCountRef.current++}`,
        nfc_uid: trimmedUid,
        status: data.status,
        message: data.message,
        user: data.user,
        timestamp: new Date(),
      }

      if (data.status === 'card_not_found') {
        setShowCreateUser(trimmedUid)
      }

      setResults(prev => [result, ...prev])
    } catch {
      setResults(prev => [{
        id: `${Date.now()}-${resultCountRef.current++}`,
        nfc_uid: trimmedUid,
        status: 'error',
        message: 'Network error',
        timestamp: new Date(),
      }, ...prev])
    } finally {
      setScanning(false)
      inputRef.current?.focus()
    }
  }, [auctionId, scanning])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleScan(nfcInput)
    }
  }

  function handleCreateUserDone(nfcUid: string) {
    setShowCreateUser(null)
    handleScan(nfcUid)
  }

  const stats = {
    total: results.length,
    registered: results.filter(r => r.status === 'registered').length,
    existing: results.filter(r => r.status === 'already_registered').length,
    failed: results.filter(r => r.status === 'error' || r.status === 'card_not_found' || r.status === 'card_inactive').length,
  }

  return (
    <div className="space-y-6">
      {/* Scanner input */}
      <div className="card-glass rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-[var(--gold)]/20 flex items-center justify-center">
            <Scan className="w-6 h-6 text-[var(--gold)]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Scan NFC Card</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Tap card on reader or type UID manually
            </p>
          </div>
        </div>

        <div className="relative">
          <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[var(--text-secondary)]" />
          <input
            ref={inputRef}
            type="text"
            value={nfcInput}
            onChange={e => setNfcInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scan NFC card or type UID..."
            disabled={scanning}
            autoFocus
            className="w-full pl-14 pr-32 py-5 bg-[var(--background)] border-2 border-[var(--border)] rounded-xl text-lg text-white font-mono placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)] transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => handleScan(nfcInput)}
            disabled={scanning || !nfcInput.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 px-5 py-2.5 bg-[var(--gold)] text-black rounded-lg text-sm font-bold hover:bg-[var(--gold-light)] transition-colors disabled:opacity-50"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
            Scan
          </button>
        </div>
      </div>

      {/* Stats */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card-glass rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-[var(--text-secondary)]">Total Scans</div>
          </div>
          <div className="card-glass rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{stats.registered}</div>
            <div className="text-xs text-[var(--text-secondary)]">Registered</div>
          </div>
          <div className="card-glass rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.existing}</div>
            <div className="text-xs text-[var(--text-secondary)]">Already In</div>
          </div>
          <div className="card-glass rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
            <div className="text-xs text-[var(--text-secondary)]">Issues</div>
          </div>
        </div>
      )}

      {/* Recent scan results */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-white">Scan History</h3>
        {results.length === 0 ? (
          <div className="card-glass rounded-xl p-12 text-center">
            <CreditCard className="w-12 h-12 text-[var(--text-secondary)] mx-auto mb-3 opacity-30" />
            <p className="text-[var(--text-secondary)]">Waiting for NFC card scan...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map(result => (
              <ScanResultRow key={result.id} result={result} />
            ))}
          </div>
        )}
      </div>

      {/* Create user modal */}
      {showCreateUser && (
        <CreateUserAndCardModal
          nfcUid={showCreateUser}
          auctionId={auctionId}
          auctionName={auctionName}
          onClose={() => setShowCreateUser(null)}
          onCreated={handleCreateUserDone}
        />
      )}
    </div>
  )
}

function ScanResultRow({ result }: { result: ScanResult }) {
  const config = {
    registered: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    already_registered: { icon: CheckCircle2, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    card_not_found: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    card_inactive: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  }[result.status]

  const Icon = config.icon

  return (
    <div className={`flex items-center gap-4 px-4 py-3 rounded-xl border ${config.bg} transition-all`}>
      <Icon className={`w-5 h-5 ${config.color} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-medium text-white">{result.nfc_uid}</span>
          {result.user && (
            <span className="text-sm text-[var(--text-secondary)]">
              &mdash; {result.user.display_name || result.user.email}
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--text-secondary)]">{result.message}</div>
      </div>
      <div className="text-xs text-[var(--text-secondary)] shrink-0">
        {result.timestamp.toLocaleTimeString()}
      </div>
    </div>
  )
}

function CreateUserAndCardModal({
  nfcUid,
  auctionId,
  auctionName,
  onClose,
  onCreated,
}: {
  nfcUid: string
  auctionId: string
  auctionName: string
  onClose: () => void
  onCreated: (nfcUid: string) => void
}) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) { setError('Name is required'); return }

    setSubmitting(true)
    setError(null)

    try {
      // 1. Create user
      const userRes = await fetch('/api/admin/users/quick-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      })

      if (!userRes.ok) {
        const data = await userRes.json()
        throw new Error(data.error || 'Failed to create user')
      }

      const { user } = await userRes.json()

      // 2. Create NFC card mapping
      const cardRes = await fetch('/api/admin/nfc-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nfc_uid: nfcUid,
          user_id: user.id,
          label: `Card for ${displayName.trim()}`,
        }),
      })

      if (!cardRes.ok) {
        const data = await cardRes.json()
        throw new Error(data.error || 'Failed to create NFC card')
      }

      // 3. Re-scan to register for auction
      onCreated(nfcUid)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">New Attendee</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Card <span className="font-mono">{nfcUid}</span> is not registered
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-400">
          Creating a new user, assigning card <span className="font-mono">{nfcUid}</span>, and
          registering for <span className="font-medium">{auctionName}</span>.
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. John Doe"
              autoFocus
              className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. +94 77 123 4567"
              className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. john@example.com"
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
              disabled={submitting || !displayName.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-[var(--gold)] text-black rounded-lg text-sm font-bold hover:bg-[var(--gold-light)] transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create &amp; Register
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
