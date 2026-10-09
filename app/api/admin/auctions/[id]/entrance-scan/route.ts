import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requirePermission } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_DEVICES)

    const { id: auctionId } = await params
    const body = await request.json()
    const { nfc_uid } = body

    if (!nfc_uid) {
      return NextResponse.json({ error: 'NFC UID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Verify auction exists
    const { data: auction } = await adminClient
      .from('auctions')
      .select('id, name, status')
      .eq('id', auctionId)
      .single()

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
    }

    // Look up NFC card
    const { data: nfcCard } = await adminClient
      .from('nfc_cards')
      .select(`
        id, nfc_uid, user_id, is_active, label,
        users (id, email, display_name, phone, role)
      `)
      .eq('nfc_uid', nfc_uid)
      .single()

    if (!nfcCard) {
      return NextResponse.json({
        status: 'card_not_found',
        message: 'NFC card not registered. Create a user and assign this card first.',
        nfc_uid,
      })
    }

    if (!nfcCard.is_active) {
      return NextResponse.json({
        status: 'card_inactive',
        message: 'This NFC card is deactivated',
        nfc_uid,
        user: nfcCard.users,
      })
    }

    const user = nfcCard.users as unknown as { id: string; email: string; display_name: string | null; phone: string | null; role: string }

    // Check if already registered
    const { data: existingReg } = await adminClient
      .from('auction_registrations')
      .select('id, approval_status')
      .eq('auction_id', auctionId)
      .eq('user_id', user.id)
      .single()

    if (existingReg) {
      return NextResponse.json({
        status: 'already_registered',
        message: `Already registered (${existingReg.approval_status})`,
        user,
        registration: existingReg,
      })
    }

    // Auto-register with approved status
    const { data: registration, error: regError } = await adminClient
      .from('auction_registrations')
      .insert({
        auction_id: auctionId,
        user_id: user.id,
        access_token: randomUUID(),
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        is_active: true,
      })
      .select()
      .single()

    if (regError) {
      return NextResponse.json({ error: regError.message }, { status: 500 })
    }

    return NextResponse.json({
      status: 'registered',
      message: `${user.display_name || user.email} registered for ${auction.name}`,
      user,
      registration,
      auction: { id: auction.id, name: auction.name, status: auction.status },
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
}
