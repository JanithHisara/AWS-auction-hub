import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_DEVICES)

    const body = await request.json()
    const { nfc_uid } = body

    if (!nfc_uid) {
      return NextResponse.json({ error: 'NFC UID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { data: card, error: findError } = await adminClient
      .from('nfc_cards')
      .select('id, nfc_type')
      .eq('nfc_uid', nfc_uid)
      .single()

    if (findError || !card) {
      return NextResponse.json({ error: 'NFC Card not found' }, { status: 404 })
    }

    if (card.nfc_type !== 'temporary') {
      return NextResponse.json({ error: 'Only temporary NFC cards can be deleted using this method' }, { status: 403 })
    }

    const { error: deleteError } = await adminClient
      .from('nfc_cards')
      .delete()
      .eq('id', card.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
}
