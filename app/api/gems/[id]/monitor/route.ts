import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get gem details including current_price, round_end_time
    const { data: gem } = await supabase
      .from('gems')
      .select('starting_price, min_bid_increment, status, end_time, current_price, round_end_time')
      .eq('id', id)
      .single()

    if (!gem) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
    }

    // Call RPC to get stats securely (bypassing RLS)
    const { data: stats, error: rpcError } = await supabase
      .rpc('get_monitor_stats', { p_gem_id: id })
      .single()

    if (rpcError) throw rpcError

    const statsData = stats as { total_registered?: number; active_bidders?: number } | null
    const totalRegistered = statsData?.total_registered || 0
    const currentLevelBidders = statsData?.active_bidders || 0
    const currentPrice = gem.current_price
    
    // Calculate stats (cap at 100% since bidders can't exceed registered count)
    const percentageLeft = totalRegistered > 0 
      ? Math.min(Math.round((currentLevelBidders / totalRegistered) * 100), 100)
      : 0

    return NextResponse.json({
      totalRegistered,
      uniqueBidders: currentLevelBidders, // Active Bidders for this price
      currentPrice,
      percentageLeft,
      status: gem.status,
      endTime: gem.end_time,
      roundEndTime: gem.round_end_time,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
