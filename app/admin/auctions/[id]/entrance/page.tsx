import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import EntranceScannerClient from '@/components/admin/EntranceScannerClient'

async function getAuction(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData?.role || !['admin', 'moderator', 'super_admin'].includes(userData.role)) {
    redirect('/')
  }

  const { data: auction } = await supabase
    .from('auctions')
    .select('id, name, status, auction_type')
    .eq('id', id)
    .single()

  return auction
}

export default async function EntranceScannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auction = await getAuction(id)

  if (!auction) notFound()

  return (
    <div className="space-y-6">
      <div>
        <a
          href={`/admin/auctions/${id}`}
          className="text-sm text-[var(--text-muted)] hover:text-white mb-2 inline-block"
        >
          &larr; Back to {auction.name}
        </a>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Entrance Scanner</h1>
        <p className="text-[var(--text-secondary)]">
          Scan NFC cards to register attendees for <span className="text-white font-medium">{auction.name}</span>
        </p>
      </div>
      <EntranceScannerClient auctionId={id} auctionName={auction.name} />
    </div>
  )
}
