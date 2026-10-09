import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requirePermission(PERMISSIONS.MANAGE_DEVICES)

    const body = await request.json()
    const adminClient = createAdminClient()
    
    const updatePayload: any = {}
    if (body.name !== undefined) updatePayload.name = body.name || null
    if (body.auction_place_id !== undefined) updatePayload.auction_place_id = body.auction_place_id || null
    if (body.firmware_version !== undefined) updatePayload.firmware_version = body.firmware_version || null
    if (body.hardware_version !== undefined) updatePayload.hardware_version = body.hardware_version || null
    if (body.status !== undefined) updatePayload.status = body.status

    const { data: device, error } = await adminClient
      .from('devices')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ device }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requirePermission(PERMISSIONS.MANAGE_DEVICES)

    const adminClient = createAdminClient()

    const { error } = await adminClient
      .from('devices')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
}
