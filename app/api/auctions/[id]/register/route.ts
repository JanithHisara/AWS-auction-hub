import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auctionId } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Get auction
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('*')
      .eq('id', auctionId)
      .single()

    if (auctionError || !auction) {
      return NextResponse.json({ message: 'Auction not found' }, { status: 404 })
    }

    // Registration is allowed when admin sets status to 'registration_open'
    if (auction.status !== 'registration_open' && auction.status !== 'live') {
      return NextResponse.json({ message: 'Registration is not open' }, { status: 400 })
    }

    // Enforce registration time limits
    const now = new Date()
    const regStart = new Date(auction.registration_start)
    const regEnd = new Date(auction.registration_end)

    if (now < regStart) {
      return NextResponse.json({ message: 'Registration has not started yet' }, { status: 400 })
    }
    if (now > regEnd) {
      return NextResponse.json({ message: 'Registration has closed' }, { status: 400 })
    }

    // Check if already registered
    const { data: existing } = await supabase
      .from('auction_registrations')
      .select('id, approval_status')
      .eq('auction_id', auctionId)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ 
        message: 'Already registered for this auction',
        approval_status: existing.approval_status 
      }, { status: 400 })
    }

    // Check max participants (only count approved registrations)
    if (auction.max_participants) {
      const { count } = await supabase
        .from('auction_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('auction_id', auctionId)
        .eq('approval_status', 'approved')

      if (count && count >= auction.max_participants) {
        return NextResponse.json({ message: 'Auction is full' }, { status: 400 })
      }
    }

    // Create registration with pending approval status (no email sent yet)
    const adminClient = createAdminClient()
    const { data: registration, error: regError } = await adminClient
      .from('auction_registrations')
      .insert({
        auction_id: auctionId,
        user_id: user.id,
        access_token: randomUUID(),
        approval_status: 'pending',
      })
      .select()
      .single()

    if (regError) {
      console.error('Registration error:', regError)
      return NextResponse.json({ message: 'Failed to register' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Registration submitted. You will receive an email once approved by admin.',
      registration: {
        id: registration.id,
        approval_status: registration.approval_status,
      },
    })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
