import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_DEVICES)

    const { id } = await params
    const body = await request.json()
    const { is_active, label } = body

    const adminClient = createAdminClient()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active
    }

    if (label !== undefined) {
      updateData.label = label
    }

    const { data: nfcCard, error } = await adminClient
      .from('nfc_cards')
      .update(updateData)
      .eq('id', id)
      .select(`
        id, nfc_uid, user_id, is_active, label, created_at, updated_at,
        users!inner (id, email, display_name)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!nfcCard) {
      return NextResponse.json({ error: 'NFC card not found' }, { status: 404 })
    }

    return NextResponse.json({ nfcCard })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_DEVICES)

    const { id } = await params
    const adminClient = createAdminClient()

    const { error } = await adminClient
      .from('nfc_cards')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
}
