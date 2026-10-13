import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import NfcManagementClient from '@/components/admin/NfcManagementClient'
export const dynamic = 'force-dynamic'
export const revalidate = 0


export default async function NfcManagementPage() {
  await requirePermission(PERMISSIONS.MANAGE_DEVICES)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">NFC Card Management</h1>
        <p className="text-[var(--text-secondary)]">
          Map NFC cards to users and auctions. Manage physical bidding devices.
        </p>
      </div>

      <NfcManagementClient />
    </div>
  )
}
