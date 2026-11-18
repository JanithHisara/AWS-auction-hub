import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import GemDetailClient from '@/components/gems/GemDetailClient'
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getGem(id: string) {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: gem } = await supabase
    .from('gems')
    .select('*, auction:auctions(auction_type)')
    .eq('id', id)
    .maybeSingle()

  if (!gem) return null

  const { data: images } = await supabase
    .from('gem_images')
    .select('*')
    .eq('gem_id', id)
    .order('display_order')

  const { data: certificates } = await supabase
    .from('gem_certificates')
    .select('*')
    .eq('gem_id', id)

  const { data: bids } = await adminClient
    .from('bids')
    .select('*, user:users(email, anonymous_name, display_name)')
    .eq('gem_id', id)
    .order('bid_amount', { ascending: false })

  const { data: winner } = await adminClient
    .from('auction_winners')
    .select('*, user:users(email, anonymous_name, display_name)')
    .eq('gem_id', id)
    .maybeSingle()

  let isRegistered = false
  if (user && gem.auction_id) {
    const { data: reg } = await supabase
      .from('auction_registrations')
      .select('id')
      .eq('auction_id', gem.auction_id)
      .eq('user_id', user.id)
      .maybeSingle()
    isRegistered = !!reg
  }

  const now = new Date()
  const isActive = gem.status === 'active' && (!gem.end_time || new Date(gem.end_time) >= now)
  const auctionType = (gem.auction as any)?.auction_type

  return {
    ...gem,
    images: images || [],
    certificates: certificates || [],
    bids: bids || [],
    winner: winner || null,
    isActive,
    currentUserId: user?.id || null,
    isRegisteredForAuction: isRegistered,
    isSealed: auctionType === 'tender_base_fixed_bid',
  }
}

export default async function GemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gemData = await getGem(id)

  if (!gemData) notFound()

  const actualType = (gemData.auction as { auction_type?: string } | null)?.auction_type
  if (actualType && actualType !== 'incremental_approval_auction') {
    const targetSegment = actualType === 'progressive_elimination_auction'
      ? 'progressive'
      : actualType === 'tender_base_fixed_bid'
      ? 'tender'
      : 'incremental'
    redirect(`/gems/${targetSegment}/${id}`)
  }

  return (
    <div className="min-h-screen bg-[var(--background)] relative">
      <div className="fixed inset-0 bg-grid-pattern opacity-30" />
      <div className="relative z-10 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <GemDetailClient initialGem={gemData} auctionType="incremental" />
        </div>
      </div>
    </div>
  )
}
