import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import GemForm from '@/components/gems/GemForm'
import Link from 'next/link'

async function getAuctions() {
  const user = await requirePermission(PERMISSIONS.MANAGE_ITEMS)
  const supabase = await createClient()

  const { data: auctions } = await supabase
    .from('auctions')
    .select('id, name, status, auction_start, auction_end, auction_type')
    .eq('admin_id', user.id)
    .in('status', ['draft', 'upcoming', 'registration_open'])
    .order('auction_start', { ascending: true })

  return auctions || []
}

export default async function NewGemPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ auction_id?: string }> 
}) {
  const auctions = await getAuctions()
  const { auction_id } = await searchParams

  return (
    <div className="max-w-3xl mx-auto">
      <Link 
        href="/admin/gems"
        className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-white mb-6 transition-colors"
      >
         Back to Items
      </Link>

      <div className="card-glass rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Add New Item</h1>
        <p className="text-[var(--text-secondary)] mb-8">Create a new auction item</p>
        
        <GemForm auctions={auctions as any} defaultAuctionId={auction_id} />
      </div>
    </div>
  )
}

