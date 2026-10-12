import { createClient } from '@/lib/supabase/server'
import { requireAuctionManager } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireAuctionManager(id, undefined, PERMISSIONS.MANAGE_AUCTIONS)

    const supabase = await createClient()
    const { data: auction, error } = await supabase
      .from('auctions')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
    }

    return NextResponse.json(auction)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get auction'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireAuctionManager(id, undefined, PERMISSIONS.MANAGE_AUCTIONS)

    const supabase = await createClient()
    const body = await request.json()

    const updateData: Record<string, any> = {
      name: body.name,
      description: body.description ?? null,
      banner_image_url: body.banner_image_url ?? null,
      password: body.password ?? null,
      auction_type: body.auction_type,
      registration_start: body.registration_start,
      registration_end: body.registration_end,
      auction_start: body.auction_start,
      auction_end: body.auction_end,
      max_participants: body.max_participants ? parseInt(body.max_participants) : null,
      entry_fee: parseFloat(body.entry_fee) || 0,
      moderator_id: body.moderator_id || null,
    }

    if (body.published_at !== undefined) {
      updateData.published_at = body.published_at
    }

    const { data: auction, error } = await supabase
      .from('auctions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update auction error:', error)
      return NextResponse.json({ error: error.message || 'Failed to update auction' }, { status: 400 })
    }

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
    }

    revalidatePath(`/admin/auctions/${id}`)
    revalidatePath('/admin/auctions')
    revalidatePath(`/auctions/${id}`)
    revalidatePath('/auctions')

    return NextResponse.json(auction)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update auction'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
