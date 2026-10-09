import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireAuctionManager } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireAuctionManager(undefined, id)

    const supabase = await createClient()
    const adminDb = createAdminClient()
    const body = await request.json().catch(() => ({}))
    
    const { data: gem } = await adminDb.from('gems').select('increment_interval')
      .eq('id', id)
      .single()

    if (!gem) {
        return NextResponse.json({ error: 'Gem not found' }, { status: 404 })
    }

    const durationSeconds = body.duration || gem.increment_interval
    
    const now = new Date()
    const roundEnd = new Date(now.getTime() + (durationSeconds * 1000))

    const { error } = await adminDb.from('gems').update({ round_end_time: roundEnd.toISOString() })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ message: 'Round started', round_end_time: roundEnd })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to start round'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
