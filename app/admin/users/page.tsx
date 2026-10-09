import { requirePermission, getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PERMISSIONS } from '@/lib/permissions'
import UsersClient from '@/components/admin/UsersClient'

export default async function UsersPage() {
  await requirePermission(PERMISSIONS.MANAGE_USERS)
  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data: userData } = await supabase.from('users').select('role').eq('id', user?.id).single()
  const canChangeRoles = userData?.role === 'super_admin'

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
