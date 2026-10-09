'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Loader2, ChevronLeft, ChevronRight, UserCog } from 'lucide-react'
import { ROLE_LABELS, ASSIGNABLE_ROLES } from '@/lib/permissions'
import type { UserRole } from '@/types/database'
import LocalTime from '@/components/ui/LocalTime'

interface UserRow {
  id: string
  email: string
  role: UserRole
  display_name: string | null
  phone: string | null
  created_at: string
  anonymous_name: string | null
}

export default function UsersClient({ canChangeRoles = true }: { canChangeRoles?: boolean }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    userId: string
    userName: string
    currentRole: string
    newRole: string
  } | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: page.toString() })
      if (search) params.set('search', search)
      if (roleFilter) params.set('role', roleFilter)

      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error('Failed to load users')
      const data = await res.json()
      setUsers(data.users)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    setPage(1)
  }, [search, roleFilter])

  function requestRoleChange(user: UserRow, newRole: string) {
    if (newRole === user.role) return
    setConfirmDialog({
      userId: user.id,
      userName: user.display_name || user.email,
      currentRole: user.role,
      newRole,
    })
  }

  async function confirmRoleChange() {
    if (!confirmDialog) return

    setChangingRole(confirmDialog.userId)
    setError(null)
    setSuccess(null)
    setConfirmDialog(null)

    try {
      const res = await fetch(`/api/admin/users/${confirmDialog.userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: confirmDialog.newRole }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update role')
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === confirmDialog.userId ? { ...u, role: confirmDialog.newRole as UserRole } : u
        )
      )
      setSuccess(
        `${confirmDialog.userName}'s role changed to ${ROLE_LABELS[confirmDialog.newRole]}`
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setChangingRole(null)
    }
  }


  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-400 text-sm">
          {success}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--gold)]/50"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--gold)]/50"
        >
          <option value="">All Roles</option>
          {Object.entries(ROLE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="text-sm text-[var(--text-secondary)]">
        {total} user{total !== 1 ? 's' : ''} found
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--surface)]">
                <th className="text-left px-4 py-3 text-sm font-semibold text-white">User</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-white">Role</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-white hidden md:table-cell">
                  Joined
                </th>
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
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-[var(--text-secondary)]">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-[var(--border)] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {user.display_name || user.anonymous_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-[var(--text-secondary)]">
                        <LocalTime date={user.created_at} format="full" />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!canChangeRoles ? (
                        <span className="text-xs text-[var(--text-secondary)]">View Only</span>
                      ) : changingRole === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[var(--gold)] mx-auto" />
                      ) : user.role === 'super_admin' ? (
                        <span className="text-xs text-[var(--text-secondary)]">Protected</span>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => requestRoleChange(user, e.target.value)}
                          className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs text-white focus:outline-none focus:border-[var(--gold)]/50"
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)]">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-white disabled:opacity-30 hover:bg-[var(--surface-hover)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-white disabled:opacity-30 hover:bg-[var(--surface-hover)] transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <UserCog className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Change Role</h3>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Change <strong className="text-white">{confirmDialog.userName}</strong>&apos;s role from{' '}
              <RoleBadge role={confirmDialog.currentRole as UserRole} inline /> to{' '}
              <RoleBadge role={confirmDialog.newRole as UserRole} inline />?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRoleChange}
                className="px-4 py-2 bg-[var(--gold)] text-black rounded-lg text-sm font-medium hover:bg-[var(--gold-light)] transition-colors"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RoleBadge({ role, inline = false }: { role: UserRole | string; inline?: boolean }) {
  const colors: Record<string, string> = {
    super_admin: 'bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30',
    admin: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    moderator: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    user: 'bg-white/5 text-[var(--text-secondary)] border-white/10',
  }

  return (
    <span
      className={`${inline ? 'inline-flex' : 'flex w-fit'} items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
        colors[role] || colors.user
      }`}
    >
      {ROLE_LABELS[role] || role}
    </span>
  )
}
