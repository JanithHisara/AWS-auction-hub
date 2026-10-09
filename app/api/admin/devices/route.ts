import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_DEVICES)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const statusFilter = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20
    const offset = (page - 1) * limit

    const adminClient = createAdminClient()

    let query = adminClient
      .from('devices')
      .select(`
        *,
        auction_places:auction_place_id (id, name),
        created_by_user:users!created_by (id, email, display_name)
      `, { count: 'exact' })

    if (search) {
      query = query.or(`device_id.ilike.%${search}%,name.ilike.%${search}%`)
    }

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data: devices, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const mapped = (devices || []).map(d => ({
      ...d,
      auction_place: d.auction_places || null,
      auction_places: undefined,
    }))

    return NextResponse.json({
      devices: mapped,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_DEVICES)

    const body = await request.json()
    const { device_id, name, auction_place_id, firmware_version, hardware_version } = body

    if (!device_id) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 },
      )
    }

    const adminClient = createAdminClient()

    const { data: existing } = await adminClient
      .from('devices')
      .select('id')
      .eq('device_id', device_id)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'A device with this ID already exists' },
        { status: 409 },
      )
    }

    if (auction_place_id) {
      const { data: place } = await adminClient
        .from('auction_places')
        .select('id')
        .eq('id', auction_place_id)
        .single()

      if (!place) {
        return NextResponse.json({ error: 'Auction place not found' }, { status: 404 })
      }
    }

    const { data: device, error } = await adminClient
      .from('devices')
      .insert({
        device_id,
        name: name || null,
        status: 'active',
        auction_place_id: auction_place_id || null,
        firmware_version: firmware_version || null,
        hardware_version: hardware_version || null,
        created_by: user.id
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ device }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
}

