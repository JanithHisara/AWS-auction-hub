import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function GemRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: gem } = await supabase
    .from('gems')
    .select('id, auction:auctions(auction_type)')
    .eq('id', id)
    .maybeSingle()

  if (!gem) notFound()

  const auctionType = (gem.auction as { auction_type?: string } | null)?.auction_type
  const targetSegment = auctionType === 'incremental_approval_auction'
    ? 'incremental'
    : auctionType === 'progressive_elimination_auction'
    ? 'progressive'
    : 'tender'

  redirect(`/gems/${targetSegment}/${id}`)
}

