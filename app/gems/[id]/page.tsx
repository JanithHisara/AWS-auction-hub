import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import GemDetailClient from '@/components/gems/GemDetailClient'

async function getGem(id: string) {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const now = new Date().toISOString()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: gem } = await supabase
    .from('gems')
      .select('*, auction:auctions(auction_type)')
    .eq('id', id)
    .eq('status', 'active')
    .gte('end_time', now)
    .single()

  if (!gem) {
    const { data: endedGem } = await supabase
      .from('gems')
      .select('*, auction:auctions(auction_type)')
      .eq('id', id)
      .in('status', ['ended', 'completed'])
      .single()

    if (!endedGem) return null

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
      .single()

    let isRegistered = false
    if (user && endedGem.auction_id) {
      const { data: reg } = await supabase
        .from('auction_registrations')
        .select('id')
        .eq('auction_id', endedGem.auction_id)
        .eq('user_id', user.id)
        .single()
      isRegistered = !!reg
    }

    return {
      ...endedGem,
      images: images || [],
      certificates: certificates || [],
      bids: bids || [],
      winner,
      isActive: false,
        currentUserId: user?.id || null,
        isRegisteredForAuction: isRegistered,
        isSealed: (endedGem?.auction as any)?.auction_type === 'tender_base_fixed_bid',
    }
  }

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

  let isRegistered = false
  if (user && gem.auction_id) {
    const { data: reg } = await supabase
      .from('auction_registrations')
      .select('id')
      .eq('auction_id', gem.auction_id)
      .eq('user_id', user.id)
      .single()
    isRegistered = !!reg
  }

  return {
    ...gem,
    images: images || [],
    certificates: certificates || [],
    bids: bids || [],
    isActive: true,
      currentUserId: user?.id || null,
      isRegisteredForAuction: isRegistered,
      isSealed: (gem?.auction as any)?.auction_type === 'tender_base_fixed_bid',
    

  }
}

export default async function GemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gemData = await getGem(id)

  if (!gemData) notFound()

  return (
    <div className="min-h-screen bg-[var(--background)] relative">
      <div className="fixed inset-0 bg-grid-pattern opacity-30" />
      <div className="relative z-10 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <GemDetailClient initialGem={gemData} />
        </div>
      </div>
    </div>
  )
}

