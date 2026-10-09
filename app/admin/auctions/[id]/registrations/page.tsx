import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { AuctionRegistration, RegistrationApprovalStatus } from '@/types/database'
import RegistrationStatusActions from '@/components/admin/RegistrationStatusActions'
import LocalTime from '@/components/ui/LocalTime'
import { ADMIN_ROLES } from '@/lib/permissions'

async function getData(auctionId: string, status?: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  
  if (!userData?.role || !ADMIN_ROLES.includes(userData.role as typeof ADMIN_ROLES[number])) redirect('/')

  // Use admin client for data fetching (bypasses RLS)
  const adminClient = createAdminClient()

  // Get auction
  const { data: auction } = await adminClient
    .from('auctions')
    .select('id, name, max_participants')
    .eq('id', auctionId)
    .single()

  if (!auction) return null

  // Get registrations with optional filter
  // Use explicit FK name because there are two FKs to users table (user_id and approved_by)
  let query = adminClient
    .from('auction_registrations')
    .select('*, user:users!auction_registrations_user_id_fkey(email, anonymous_name, phone, display_name)')
    .eq('auction_id', auctionId)
    .order('registered_at', { ascending: false })

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    query = query.eq('approval_status', status)
  }

  const { data: registrations, error: regError } = await query
  
  if (regError) {
    console.error('Registration fetch error:', regError)
  }

  // Get counts by status
  const { data: allRegs } = await adminClient
    .from('auction_registrations')
    .select('approval_status')
    .eq('auction_id', auctionId)

  const counts = {
    all: allRegs?.length || 0,
    pending: allRegs?.filter(r => r.approval_status === 'pending').length || 0,
    approved: allRegs?.filter(r => r.approval_status === 'approved').length || 0,
    rejected: allRegs?.filter(r => r.approval_status === 'rejected').length || 0,
  }

  return { auction, registrations: registrations || [], counts }
}


const statusColors: Record<RegistrationApprovalStatus, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-emerald-500/20 text-emerald-400',
  rejected: 'bg-red-500/20 text-red-400',
}

type RegistrationWithUser = AuctionRegistration & { 
  user: { email: string; anonymous_name?: string; phone?: string | null; display_name?: string | null } 
}

export default async function AuctionRegistrationsPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string }>
}) {
  const { id } = await params
  const { status } = await searchParams
  const data = await getData(id, status)

  if (!data) notFound()

  const { auction, registrations, counts } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link 
            href={`/admin/auctions/${id}`}
            className="text-sm text-[var(--text-muted)] hover:text-white mb-2 inline-block"
          >
             Back to Auction
          </Link>
          <h1 className="text-2xl font-bold text-white">Registrations</h1>
          <p className="text-[var(--text-secondary)]">{auction.name}</p>
        </div>
        {auction.max_participants && (
          <div className="text-right">
            <p className="text-sm text-[var(--text-muted)]">Approved / Max</p>
            <p className="text-xl font-bold text-white">
              {counts.approved} / {auction.max_participants}
            </p>
          </div>
        )}
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterTab href={`/admin/auctions/${id}/registrations`} active={!status} label="All" count={counts.all} />
        <FilterTab href={`/admin/auctions/${id}/registrations?status=pending`} active={status === 'pending'} label="Pending" count={counts.pending} color="amber" />
        <FilterTab href={`/admin/auctions/${id}/registrations?status=approved`} active={status === 'approved'} label="Approved" count={counts.approved} color="emerald" />
        <FilterTab href={`/admin/auctions/${id}/registrations?status=rejected`} active={status === 'rejected'} label="Rejected" count={counts.rejected} color="red" />
      </div>

      {/* Registrations List */}
      <div className="card-glass rounded-xl overflow-hidden">
        {registrations.length > 0 ? (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">Name</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">Display Name</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">Phone</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">Email</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">Registered</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">Link Sent</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                    {registrations.map((reg: RegistrationWithUser) => (
                    <tr key={reg.id} className="hover:bg-[var(--surface-elevated)]">
                      <td className="py-3 px-4">
                        <p className="text-white font-medium">{reg.user?.display_name || reg.user?.anonymous_name || reg.user?.email || "Unknown"}</p>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">{reg.user?.display_name || ''}</td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">{reg.user?.phone || ''}</td>
                      <td className="py-3 px-4 text-[var(--text-muted)] text-sm">{reg.user?.email}</td>
                      <td className="py-3 px-4 text-[var(--text-secondary)] text-sm">
                        <LocalTime date={reg.registered_at} />
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${statusColors[reg.approval_status]}`}>
                          {reg.approval_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {reg.email_sent_at ? (
                          <span className="text-emerald-400 text-sm"> Sent</span>
                        ) : reg.approval_status === 'approved' ? (
                          <span className="text-amber-400 text-sm">Pending</span>
                        ) : (
                          <span className="text-[var(--text-muted)] text-sm"></span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <RegistrationStatusActions 
                          auctionId={id} 
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
              {registrations.map((reg: RegistrationWithUser) => (
                <div key={reg.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-medium">{reg.user?.display_name || reg.user?.anonymous_name || reg.user?.email || "Unknown"}</p>
                      <p className="text-xs text-[var(--text-muted)]">{reg.user?.email}</p>
                      {reg.user?.phone && (
                        <p className="text-xs text-[var(--text-muted)] mt-1">{reg.user.phone}</p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusColors[reg.approval_status]}`}>
                      {reg.approval_status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span> <LocalTime date={reg.registered_at} format="short" /></span>
                    {reg.email_sent_at && <span> Sent</span>}
                  </div>
                  <RegistrationStatusActions 
                    auctionId={id} 
                    registrationId={reg.id} 
                    currentStatus={reg.approval_status}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-[var(--text-muted)]">
            <p className="text-4xl mb-4"></p>
            <p>No {status || ''} registrations</p>
          </div>
        )}
      </div>
    </div>
  )
}

function FilterTab({ 
  href, 
  active, 
  label, 
  count, 
  color 
}: { 
  href: string
  active: boolean
  label: string
  count: number
  color?: string
}) {
  const colorClasses = color 
    ? `border-${color}-500/50 ${active ? `bg-${color}-500/20 text-${color}-400` : 'text-[var(--text-secondary)]'}`
    : active ? 'bg-white/10 text-white border-white/20' : 'text-[var(--text-secondary)] border-[var(--border)]'

  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
        active 
          ? 'bg-white/10 text-white border-white/20' 
          : 'text-[var(--text-secondary)] border-[var(--border)] hover:bg-white/5'
      }`}
    >
      {label} <span className="opacity-60">({count})</span>
    </Link>
  )
}




