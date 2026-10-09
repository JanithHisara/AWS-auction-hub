import { requireSuperAdmin } from '@/lib/auth'
import PermissionMatrix from '@/components/admin/PermissionMatrix'

export default async function AccessControlPage() {
  await requireSuperAdmin()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Access Control</h1>
        <p className="text-[var(--text-secondary)]">
          Manage role permissions. Toggle permissions for each role to control access.
        </p>
      </div>

      <PermissionMatrix />
    </div>
  )
}
