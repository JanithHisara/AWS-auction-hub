'use client'

import { useState, useMemo } from 'react'
import { AuctionRegistration, RegistrationApprovalStatus } from '@/types/database'
import RegistrationStatusActions from '@/components/admin/RegistrationStatusActions'
import LocalTime from '@/components/ui/LocalTime'
import { Search, Users, ChevronDown } from 'lucide-react'

type RegistrationWithDetails = AuctionRegistration & {
  user: {
    email: string
    anonymous_name?: string
    phone?: string | null
    display_name?: string | null
  }
  auction: { id: string; name: string }
}

type AuctionGroup = {
  id: string
  name: string
  registrations: RegistrationWithDetails[]
}

type Props = {
  registrations: RegistrationWithDetails[]
  counts: { all: number; pending: number; approved: number; rejected: number }
  auctions: { id: string; name: string }[]
  statusFilter?: string
}

const statusColors: Record<RegistrationApprovalStatus, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-emerald-500/20 text-emerald-400',
  rejected: 'bg-red-500/20 text-red-400',
}

export default function ApprovalsClient({
  registrations,
  counts,
  auctions,
  statusFilter,
}: Props) {
  const [search, setSearch] = useState('')
  const [auctionFilter, setAuctionFilter] = useState('')

  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim()
    const auctionId = auctionFilter || undefined

    const filtered = registrations.filter((reg) => {
      if (auctionId && reg.auction_id !== auctionId) return false
      if (!q) return true
      const u = reg.user
      if (!u) return false
      return (
        u.display_name?.toLowerCase().includes(q) ||
        u.anonymous_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q)
      )
    })

    const map = new Map<string, AuctionGroup>()
    filtered.forEach((reg) => {
      const a = reg.auction
      if (!a) return
      const existing = map.get(a.id)
      if (existing) {
        existing.registrations.push(reg)
      } else {
        map.set(a.id, { id: a.id, name: a.name, registrations: [reg] })
      }
    })

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [registrations, search, auctionFilter])

  return (
    <div className="space-y-6">
      {/* Search and Auction Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3 sm:gap-4">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/50"
          />
        </div>
        <div className="relative">
          <select
            value={auctionFilter}
            onChange={(e) => setAuctionFilter(e.target.value)}
            className="w-full pl-4 pr-12 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/50 appearance-none cursor-pointer"
          >
            <option value="">All auctions</option>
            {auctions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
        </div>
      </div>

      {/* Categorized by auction */}
      {grouped.length > 0 ? (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div
              key={group.id}
              className="card-glass rounded-xl overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]/50">
                <Users className="w-5 h-5 text-[var(--gold)]" />
                <h2 className="font-bold text-white">{group.name}</h2>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">
                        Name
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">
                        Phone
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">
                        Registered
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">
                        Status
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {group.registrations.map((reg) => (
                      <tr
                        key={reg.id}
                        className={`hover:bg-[var(--surface-elevated)] ${
                          reg.approval_status === 'pending'
                            ? 'bg-amber-500/5 border-l-4 border-l-amber-500'
                            : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <p className="text-white font-medium">
                            {reg.user?.display_name || reg.user?.anonymous_name || reg.user?.email || "User " + (reg?.user_id || '').slice(-6)}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {reg.user?.email}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-[var(--text-secondary)]">
                          {reg.user?.phone || ''}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-secondary)] text-sm">
                          <LocalTime date={reg.registered_at} />
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold ${statusColors[reg.approval_status]}`}
                          >
                            {reg.approval_status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <RegistrationStatusActions
                            auctionId={reg.auction.id}
                            registrationId={reg.id}
                            currentStatus={reg.approval_status}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-[var(--border)]">
                {group.registrations.map((reg) => (
                  <div
                    key={reg.id}
                    className={`p-4 space-y-3 ${
                      reg.approval_status === 'pending'
                        ? 'bg-amber-500/5 border-l-4 border-l-amber-500'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white font-medium">
                          {reg.user?.display_name || reg.user?.anonymous_name || reg.user?.email || "User " + (reg?.user_id || '').slice(-6)}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {reg.user?.email}
                        </p>
                        {reg.user?.phone && (
                          <p className="text-xs text-[var(--text-muted)] mt-1">
                            {reg.user.phone}
                          </p>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${statusColors[reg.approval_status]}`}
                      >
                        {reg.approval_status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Registered: <LocalTime date={reg.registered_at} format="short" />
                    </div>
                    <RegistrationStatusActions
                      auctionId={group.id}
                      registrationId={reg.id}
                      currentStatus={reg.approval_status}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-glass rounded-xl py-16 text-center text-[var(--text-muted)]">
          <p className="text-4xl mb-4"></p>
          <p>
            {search || auctionFilter
              ? 'No matching registrations'
              : statusFilter === 'pending'
                ? 'No pending registrations'
                : 'No registrations found'}
          </p>
        </div>
      )}
    </div>
  )
}




