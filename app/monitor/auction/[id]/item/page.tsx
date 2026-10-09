import ItemMonitorClient from '@/components/monitor/ItemMonitorClient'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ItemMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  
  // Verify auction exists
  const { data: auction } = await supabase
    .from('auctions')
    .select('id, name, status, auction_type')
    .eq('id', id)
    .single()

  if (!auction) {
    notFound()
  }

  return <ItemMonitorClient auctionId={id} auctionName={auction.name} />
}
