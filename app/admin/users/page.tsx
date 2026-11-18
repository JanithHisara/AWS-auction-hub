import { requirePermission, getCurrentUser, SUPER_ADMIN_EMAILS } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import UsersClient from '@/components/admin/UsersClient'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function UsersPage() {
  await requirePermission(PERMISSIONS.MANAGE_USERS)
  const user = await getCurrentUser()
  const isSuperAdmin = user?.role === 'super_admin' || 
    (user?.email ? SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()) : false)
  const canChangeRoles = isSuperAdmin || user?.role === 'admin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-[var(--text-secondary)]">
          View and manage users. Assign roles to control access levels.
        </p>
      </div>

      <UsersClient canChangeRoles={canChangeRoles} />
    </div>
  )
}
