import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await requirePermission(PERMISSIONS.VIEW_DASHBOARD)
    const supabase = await createClient()

    const { data: gems } = await supabase
      .from('gems')
      .select('id, status')
      .eq('admin_id', user.id)

    const { data: bids } = await supabase
      .from('bids')
      .select('id, gem_id')
      .in('gem_id', gems?.map(g => g.id) || [])

    const stats = {
      totalGems: gems?.length || 0,
      activeAuctions: gems?.filter(g => g.status === 'active').length || 0,
      completedAuctions: gems?.filter(g => g.status === 'completed').length || 0,
      draftGems: gems?.filter(g => g.status === 'draft').length || 0,
      totalBids: bids?.length || 0,
    }

    return NextResponse.json(stats)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

