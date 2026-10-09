import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions'
import { sendAuctionAccessEmail } from '@/lib/email/resend'

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_DEVICES)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const statusFilter = searchParams.get('status') || ''
    const nfcTypeFilter = searchParams.get('nfc_type') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20
    const offset = (page - 1) * limit

    const adminClient = createAdminClient()

    let query = adminClient
      .from('nfc_cards')
      .select(`
        id, nfc_uid, user_id, is_active, label, nfc_type, created_at, updated_at,
        users:users!user_id (id, email, display_name),
        created_by_user:users!created_by (id, email, display_name)
      `, { count: 'exact' })

    if (search) {
      query = query.or(`nfc_uid.ilike.%${search}%,label.ilike.%${search}%`)
    }

    if (statusFilter === 'active') {
      query = query.eq('is_active', true)
    } else if (statusFilter === 'inactive') {
      query = query.eq('is_active', false)
    }

    if (nfcTypeFilter) {
      query = query.eq('nfc_type', nfcTypeFilter)
    }

    const { data: nfcCards, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      nfcCards,
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
    const { nfc_uid, user_id, label, nfc_type, auction_id } = body

    if (!nfc_uid || !user_id) {
      return NextResponse.json(
        { error: 'NFC UID and User ID are required' },
        { status: 400 },
      )
    }

    const adminClient = createAdminClient()

    const { data: targetUser } = await adminClient
      .from('users')
      .select('id, email')
      .eq('id', user_id)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // NFC UID must be unique (one card = one user)
    const { data: existing } = await adminClient
      .from('nfc_cards')
      .select('id')
      .eq('nfc_uid', nfc_uid)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'This NFC card is already registered' },
        { status: 409 },
      )
    }

    const { data: nfcCard, error } = await adminClient
      .from('nfc_cards')
      .insert({
        nfc_uid,
        user_id,
        label: label || null,
        nfc_type: nfc_type || 'permanent',
        is_active: true,
      })
      .select(`
        id, nfc_uid, user_id, is_active, label, nfc_type, created_at, updated_at,
        users:users!user_id (id, email, display_name),
        created_by_user:users!created_by (id, email, display_name)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (auction_id && nfc_type === 'temporary') {
      const { randomUUID } = require('crypto')
      const token = randomUUID()
      
      // Check if already registered
      const { data: existingReg } = await adminClient
        .from('auction_registrations')
        .select('id')
        .eq('auction_id', auction_id)
        .eq('user_id', user_id)
        .limit(1)
        
      if (!existingReg || existingReg.length === 0) {
        const { error: regError } = await adminClient.from('auction_registrations').insert({
          auction_id,
          user_id,
          access_token: token,
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          is_active: true
        })
        if (regError) {
          console.error("Auction registration error:", regError)
        } else if (targetUser.email) {
          // Fetch auction details for the email
          const { data: auction } = await adminClient
            .from('auctions')
            .select('name, description, auction_start')
            .eq('id', auction_id)
            .single()

          if (auction) {
            try {
              const auctionDate = new Date(auction.auction_start).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
              
              await sendAuctionAccessEmail({
                to: targetUser.email,
                auctionName: auction.name,
                auctionDate,
                auctionDescription: auction.description,
                accessToken: token,
              })
            } catch (emailErr) {
              console.error('Failed to send confirm email:', emailErr)
            }
          }
        }
      }
    }

    return NextResponse.json({ nfcCard }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
}
