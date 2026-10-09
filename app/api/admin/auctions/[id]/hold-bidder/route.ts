import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auctionId } = await params
    await requirePermission(PERMISSIONS.CONTROL_BIDDING)
    const supabase = createAdminClient()

    const { data: holds, error } = await supabase
      .from('bidder_holds')
      .select('*, user:users!bidder_holds_user_id_fkey(id, email, anonymous_name, phone, display_name)')
      .eq('auction_id', auctionId)
      .eq('is_active', true)
      .order('held_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(holds || [])
  } catch (error: unknown) {
    const message = (error as any)?.message || (error as any)?.details || 'Failed to fetch holds'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auctionId } = await params
    const admin = await requirePermission(PERMISSIONS.CONTROL_BIDDING)
    const supabase = createAdminClient()
    const body = await request.json()

    const { user_id, reason } = body

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const { data: existingHold } = await supabase
      .from('bidder_holds')
      .select('id')
      .eq('auction_id', auctionId)
      .eq('user_id', user_id)
      .eq('is_active', true)
      .single()

    if (existingHold) {
      return NextResponse.json({ error: 'User is already on hold' }, { status: 400 })
    }

    const { data: hold, error } = await supabase
      .from('bidder_holds')
      .insert({
        auction_id: auctionId,
        user_id,
        admin_id: admin.id,
        reason: reason || null,
      })
      .select('*, user:users!bidder_holds_user_id_fkey(id, email, anonymous_name, phone, display_name)')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'User is already on hold' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json(hold)
  } catch (error: unknown) {
    const message = (error as any)?.message || (error as any)?.details || 'Failed to hold bidder'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auctionId } = await params
    await requirePermission(PERMISSIONS.CONTROL_BIDDING)
    const supabase = createAdminClient()
    const body = await request.json()

    const { user_id } = body

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const { data: hold, error } = await supabase
      .from('bidder_holds')
      .update({
        is_active: false,
        released_at: new Date().toISOString(),
      })
      .eq('auction_id', auctionId)
      .eq('user_id', user_id)
      .eq('is_active', true)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'User is already on hold' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json(hold)
  } catch (error: unknown) {
    const message = (error as any)?.message || (error as any)?.details || 'Failed to release bidder'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
