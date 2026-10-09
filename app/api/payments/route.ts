import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()

    // Verify user is the winner
    const { data: winner } = await supabase
      .from('auction_winners')
      .select('*, bid:bids(id, bid_amount)')
      .eq('gem_id', body.gem_id)
      .eq('user_id', user.id)
      .single()

    if (!winner) {
      return NextResponse.json({ error: 'You are not the winner of this auction' }, { status: 403 })
    }

    // Verify payment hasn't been processed
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('gem_id', body.gem_id)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .single()

    if (existingPayment) {
      return NextResponse.json({ error: 'Payment already processed' }, { status: 400 })
    }

    // Dummy payment processing - accept any card number
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Create payment record
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        gem_id: body.gem_id,
        user_id: user.id,
        bid_id: (winner.bid as any).id,
        amount: (winner.bid as any).bid_amount,
        status: 'completed',
        payment_method: 'card',
        transaction_id: transactionId,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      payment,
      message: 'Payment processed successfully',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const gemId = searchParams.get('gem_id')

    let query = supabase
      .from('payments')
      .select('*, gem:gems(name)')
      .eq('user_id', user.id)

    if (gemId) {
      query = query.eq('gem_id', gemId)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

