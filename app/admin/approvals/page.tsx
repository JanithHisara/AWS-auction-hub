import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AuctionRegistration } from '@/types/database'
import ApprovalsClient from '@/components/admin/ApprovalsClient'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'

async function getData(status?: string) {
  const user = await requirePermission(PERMISSIONS.MANAGE_REGISTRATIONS)

  const adminClient = createAdminClient()

  const { data: auctions } = await adminClient
    .from('auctions')
    .select('id, name')
    .eq('admin_id', user.id)

  if (!auctions?.length) {
    return { registrations: [], counts: { all: 0, pending: 0, approved: 0, rejected: 0 }, auctions: [] }
  }

  const auctionIds = auctions.map((a) => a.id)

  let query = adminClient
    .from('auction_registrations')
    .select(
      '*, user:users!auction_registrations_user_id_fkey(email, anonymous_name, phone, display_name), auction:auctions(id, name)'
    )
    .in('auction_id', auctionIds)
    .order('registered_at', { ascending: false })

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    query = query.eq('approval_status', status)
  }

  const { data: registrations } = await query

  const { data: allRegs } = await adminClient
    .from('auction_registrations')
    .select('approval_status')
    .in('auction_id', auctionIds)

  const counts = {
    all: allRegs?.length || 0,
    pending: allRegs?.filter((r) => r.approval_status === 'pending').length || 0,
    approved: allRegs?.filter((r) => r.approval_status === 'approved').length || 0,
    rejected: allRegs?.filter((r) => r.approval_status === 'rejected').length || 0,
  }

  return {
    registrations: (registrations || []) as (AuctionRegistration & {
      user: { email: string; anonymous_name?: string; phone?: string | null; display_name?: string | null }
      auction: { id: string; name: string }
    })[],
    counts,
    auctions,
  }
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const { registrations, counts, auctions } = await getData(status)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Registration Approvals</h1>
          <p className="text-[var(--text-secondary)]">
            Manage registration requests, categorized by auction
          </p>
        </div>
        {counts.pending > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-lg">
            <span className="text-amber-400 font-bold">{counts.pending}</span>
            <span className="text-amber-400/80 text-sm">
              pending approval{counts.pending !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterTab href="/admin/approvals" active={!status} label="All" count={counts.all} />
        <FilterTab
          href="/admin/approvals?status=pending"
          active={status === 'pending'}
          label="Pending"
          count={counts.pending}
          color="amber"
        />
        <FilterTab
          href="/admin/approvals?status=approved"
          active={status === 'approved'}
          label="Approved"
          count={counts.approved}
          color="emerald"
        />
        <FilterTab
          href="/admin/approvals?status=rejected"
          active={status === 'rejected'}
          label="Rejected"
          count={counts.rejected}
          color="red"
        />
      </div>

      {/* Categorized registrations with search */}
      <ApprovalsClient
        registrations={registrations}
        counts={counts}
        auctions={auctions}
        statusFilter={status}
      />
    </div>
  )
}

function FilterTab({
  href,
  active,
  label,
  count,
  color,
}: {
  href: string
  active: boolean
  label: string
  count: number
  color?: string
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
        active
          ? 'bg-white/10 text-white border-white/20'
          : 'text-[var(--text-secondary)] border-[var(--border)] hover:bg-white/5'
      } ${color === 'amber' && count > 0 ? 'border-amber-500/50' : ''}`}
    >
      {label}
      <span
        className={`ml-1 ${color === 'amber' && count > 0 ? 'text-amber-400 font-bold' : 'opacity-60'}`}
      >
        ({count})
      </span>
    </Link>
  )
}
