import { requireAdmin, getUserPermissions, getCurrentUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { LayoutDashboard, Calendar, Gem, Plus, UserCheck, Shield, Users, CreditCard, MessageCircle } from 'lucide-react'
import { PERMISSIONS } from '@/lib/permissions'

async function getPendingCount(adminId: string) {
  const adminClient = createAdminClient()
  
  const { data: auctions } = await adminClient
    .from('auctions')
    .select('id')
    .eq('admin_id', adminId)

  if (!auctions?.length) return 0

  const { count } = await adminClient
    .from('auction_registrations')
    .select('*', { count: 'exact', head: true })
    .in('auction_id', auctions.map(a => a.id))
    .eq('approval_status', 'pending')

  return count || 0
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAdmin()
  const pendingCount = await getPendingCount(user.id)
  const permissions = await getUserPermissions(user.id)
  const supabase = await createClient()
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()

  const hasPermission = (key: string) => permissions.includes(key)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Background */}
      <div className="fixed inset-0 bg-grid-pattern opacity-20" />
      
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-4xl font-black text-white mb-1 sm:mb-2">
              Auxtion<span className="text-gradient-gold">Hub</span> Admin
            </h1>
            <p className="text-sm sm:text-base text-[var(--text-secondary)]">Manage auctions, items, and users</p>
          </div>

          {/* Navigation */}
          <nav className="mb-6 sm:mb-8 -mx-4 px-4 overflow-x-auto">
            <div className="flex gap-2 pb-3 sm:pb-4 border-b border-[var(--border)] min-w-max">
              {hasPermission(PERMISSIONS.VIEW_DASHBOARD) && userData?.role !== 'moderator' && (
                <NavLink href="/admin" icon={<LayoutDashboard className="w-4 h-4" />}>
                  Overview
                </NavLink>
              )}
              {(hasPermission(PERMISSIONS.MANAGE_AUCTIONS) || userData?.role === 'moderator') && (
                <NavLink href="/admin/auctions" icon={<Calendar className="w-4 h-4" />}>
                  Auctions
                </NavLink>
              )}

              {hasPermission(PERMISSIONS.MANAGE_REGISTRATIONS) && (
                <NavLink href="/admin/approvals" icon={<UserCheck className="w-4 h-4" />} badge={pendingCount}>
                  Approvals
                </NavLink>
              )}
              {hasPermission(PERMISSIONS.MANAGE_USERS) && (
                <NavLink href="/admin/users" icon={<Users className="w-4 h-4" />}>
                  Users
                </NavLink>
              )}
              {hasPermission(PERMISSIONS.MANAGE_DEVICES) && (
                <NavLink href="/admin/nfc-management" icon={<CreditCard className="w-4 h-4" />}>
                  NFC Cards
                </NavLink>
              )}
              {/* Chat Inbox accessible by admins/moderators */}
              <NavLink href="/admin/chat" icon={<MessageCircle className="w-4 h-4" />}>
                Chat Inbox
              </NavLink>
              {hasPermission(PERMISSIONS.MANAGE_PERMISSIONS) && (
                <NavLink href="/admin/access-control" icon={<Shield className="w-4 h-4" />}>
                  Access Control
                </NavLink>
              )}
              {hasPermission(PERMISSIONS.MANAGE_AUCTIONS) && (
                <NavLink href="/admin/auctions/new" icon={<Plus className="w-4 h-4" />} highlight>
                  New Auction
                </NavLink>
              )}
            </div>
          </nav>

          {/* Content */}
          {children}
        </div>
      </div>
    </div>
  )
}

function NavLink({ 
  href, 
  children, 
  icon, 
  highlight = false,
  badge = 0
}: { 
  href: string
  children: React.ReactNode
  icon?: React.ReactNode
  highlight?: boolean
  badge?: number
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
        highlight 
          ? 'bg-[var(--gold)] text-black hover:bg-[var(--gold-light)]' 
          : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)]'
      }`}
    >
      {icon}
      {children}
      {badge > 0 && (
        <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full min-w-[20px] text-center">
          {badge}
        </span>
      )}
    </Link>
  )
}
