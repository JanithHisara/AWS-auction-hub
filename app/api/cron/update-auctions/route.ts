import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Simple cron endpoint to update auction statuses
  // In production, this should be called by a scheduled job
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()

    // Call the database function to process all auction and gem schedule transitions
    const { error } = await supabase.rpc('process_auction_schedule')

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Auctions and gems schedule processed' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

