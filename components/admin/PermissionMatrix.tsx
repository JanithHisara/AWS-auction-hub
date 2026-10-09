'use client'

import { useEffect, useState } from 'react'
import { Shield, Check, X, Loader2, Save } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/permissions'
import type { Permission } from '@/types/database'

interface RolePermMap {
  [role: string]: string[]
}

const EDITABLE_ROLES = ['admin', 'moderator'] as const
const ALL_DISPLAY_ROLES = ['super_admin', 'admin', 'moderator', 'user'] as const

export default function PermissionMatrix() {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [rolePerms, setRolePerms] = useState<RolePermMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [dirty, setDirty] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/admin/roles')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setPermissions(data.permissions)
      setRolePerms(data.rolePermissions)
    } catch {
      setError('Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }

  function togglePermission(role: string, permId: string) {
    if (!EDITABLE_ROLES.includes(role as typeof EDITABLE_ROLES[number])) return

    setRolePerms((prev) => {
      const current = prev[role] || []
      const updated = current.includes(permId)
        ? current.filter((id) => id !== permId)
        : [...current, permId]
      return { ...prev, [role]: updated }
    })
    setDirty((prev) => new Set(prev).add(role))
    setSuccess(null)
  }

  async function saveRole(role: string) {
    setSaving(role)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          permissionIds: rolePerms[role] || [],
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      setDirty((prev) => {
        const next = new Set(prev)
        next.delete(role)
        return next
      })
      setSuccess(`${ROLE_LABELS[role]} permissions saved successfully`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions')
    } finally {
      setSaving(null)
    }
  }

  function isGranted(role: string, permId: string): boolean {
    if (role === 'super_admin') return true
    if (role === 'user') return false
    return (rolePerms[role] || []).includes(permId)
  }

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.group_name]) acc[p.group_name] = []
    acc[p.group_name].push(p)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--gold)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
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

      {/* Save buttons for dirty roles */}
      {dirty.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <span className="text-amber-400 text-sm">Unsaved changes for:</span>
          {Array.from(dirty).map((role) => (
            <button
              key={role}
              onClick={() => saveRole(role)}
              disabled={saving !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--gold)] text-black rounded-lg text-sm font-medium hover:bg-[var(--gold-light)] disabled:opacity-50 transition-colors"
            >
              {saving === role ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
      )}

      {/* Permission Matrix Table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--surface)]">
                <th className="text-left px-4 py-3 text-sm font-semibold text-white min-w-[240px]">
                  Permission
                </th>
                {ALL_DISPLAY_ROLES.map((role) => (
                  <th key={role} className="px-4 py-3 text-center min-w-[120px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-sm font-semibold ${
                        role === 'super_admin' ? 'text-[var(--gold)]' : 'text-white'
                      }`}>
                        {ROLE_LABELS[role]}
                      </span>
                      {role === 'super_admin' && (
                        <span className="text-[10px] text-[var(--gold)]/60 uppercase tracking-wider">Full Access</span>
                      )}
                      {role === 'user' && (
                        <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">No Admin</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([group, perms]) => (
                <>
                  <tr key={`group-${group}`}>
                    <td
                      colSpan={ALL_DISPLAY_ROLES.length + 1}
                      className="px-4 py-2.5 bg-[var(--surface-hover)] border-t border-[var(--border)]"
                    >
                      <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        {group}
                      </span>
                    </td>
                  </tr>
                  {perms.map((perm) => (
                    <tr
                      key={perm.id}
                      className="border-t border-[var(--border)] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-white">{perm.name}</div>
                          <div className="text-xs text-[var(--text-secondary)]">{perm.description}</div>
                        </div>
                      </td>
                      {ALL_DISPLAY_ROLES.map((role) => {
                        const granted = isGranted(role, perm.id)
                        const editable = EDITABLE_ROLES.includes(role as typeof EDITABLE_ROLES[number])

                        return (
                          <td key={role} className="px-4 py-3 text-center">
                            {editable ? (
                              <button
                                onClick={() => togglePermission(role, perm.id)}
                                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                                  granted
                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                    : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'
                                }`}
                              >
                                {granted ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <X className="w-4 h-4 opacity-40" />
                                )}
                              </button>
                            ) : (
                              <div
                                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${
                                  granted
                                    ? role === 'super_admin'
                                      ? 'bg-[var(--gold)]/15 text-[var(--gold)]'
                                      : 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-white/5 text-[var(--text-secondary)]'
                                }`}
                              >
                                {granted ? (
                                  role === 'super_admin' ? (
                                    <Shield className="w-4 h-4" />
                                  ) : (
                                    <Check className="w-4 h-4" />
                                  )
                                ) : (
                                  <X className="w-4 h-4 opacity-20" />
                                )}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-[var(--gold)]/15 flex items-center justify-center">
            <Shield className="w-3 h-3 text-[var(--gold)]" />
          </div>
          <span>Always granted (Super Admin)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-3 h-3 text-emerald-400" />
          </div>
          <span>Granted (click to toggle)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center">
            <X className="w-3 h-3 opacity-40" />
          </div>
          <span>Not granted (click to toggle)</span>
        </div>
      </div>
    </div>
  )
}
