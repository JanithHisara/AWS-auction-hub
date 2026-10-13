import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST: Create or retrieve conversation for (auction_id, user_id)
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const adminClient = createAdminClient()
    const { auction_id } = await request.json()

    if (!auction_id) {
      return NextResponse.json({ error: 'auction_id is required' }, { status: 400 })
    }

    // Check auction status
    const { data: auction } = await adminClient
      .from('auctions')
      .select('id, name, status')
      .eq('id', auction_id)
      .single()

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
    }

    if (auction.status === 'ended' || auction.status === 'completed') {
      return NextResponse.json({ error: 'This auction has ended. Chat is closed.' }, { status: 400 })
    }

    // Look for existing conversation for this user in THIS specific auction
    const { data: existing } = await adminClient
      .from('chat_conversations')
      .select('*, auction:auctions(id, name, status)')
      .eq('auction_id', auction_id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json(existing)
    }

    // Create a new conversation for this auction and user
    const { data: conversation, error } = await adminClient
      .from('chat_conversations')
      .insert({
        auction_id,
        user_id: user.id,
        status: 'open',
      })
      .select('*, auction:auctions(id, name, status)')
      .single()

    if (error) throw error

    return NextResponse.json(conversation)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create conversation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET: Fetch conversations auction-wise
export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    const auctionId = searchParams.get('auction_id')

    const { data: userData } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdminRole = userData?.role === 'admin' || userData?.role === 'super_admin' || userData?.role === 'moderator'

    // Clean up any conversations belonging to ended or completed auctions
    try {
      const { data: endedAuctions } = await adminClient
        .from('auctions')
        .select('id')
        .in('status', ['ended', 'completed'])

      if (endedAuctions && endedAuctions.length > 0) {
        await adminClient
          .from('chat_conversations')
          .delete()
          .in('auction_id', endedAuctions.map(a => a.id))
      }
    } catch (cleanupErr) {
      console.error('Failed to cleanup ended auction chat:', cleanupErr)
    }

    if (isAdminRole) {
      // 1. Fetch all published / active auctions (not ended or completed)
      const { data: activeAuctions } = await adminClient
        .from('auctions')
        .select('id, name, status, auction_type, published_at')
        .not('status', 'in', '("ended","completed")')
        .order('created_at', { ascending: false })

      // 2. Fetch conversations
      let query = adminClient
        .from('chat_conversations')
        .select(`
          *,
          auction:auctions(id, name, status, auction_type),
          user:users!chat_conversations_user_id_fkey(id, email, anonymous_name, display_name, phone),
          assigned_admin:users!chat_conversations_assigned_admin_id_fkey(id, email, display_name)
        `)
        .order('last_message_at', { ascending: false })

      if (auctionId && auctionId !== 'all') {
        query = query.eq('auction_id', auctionId)
      }

      const { data: conversations, error } = await query
      if (error) throw error

      // 3. For each conversation, fetch the latest message preview if needed
      const convsWithLatestMsg = await Promise.all(
        (conversations || []).map(async (conv) => {
          const { data: lastMsg } = await adminClient
            .from('chat_messages')
            .select('id, content, sender_role, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          return {
            ...conv,
            last_message: lastMsg || null,
          }
        })
      )

      return NextResponse.json({
        conversations: convsWithLatestMsg,
        auctions: activeAuctions || [],
      })
    }

    // For regular users, find conversation for the specified auction
    if (!auctionId || auctionId === 'all') {
      return NextResponse.json({ error: 'auction_id is required' }, { status: 400 })
    }

    const { data: conversation, error } = await adminClient
      .from('chat_conversations')
      .select('*, auction:auctions(id, name, status)')
      .eq('user_id', user.id)
      .eq('auction_id', auctionId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return NextResponse.json(conversation || null)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get conversations'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE: Erase all chat conversations for a specific auction
export async function DELETE(request: Request) {
  try {
    const user = await requireAuth()
    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    const auctionId = searchParams.get('auction_id')

    const { data: userData } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin' || userData?.role === 'moderator'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!auctionId) {
      return NextResponse.json({ error: 'auction_id is required' }, { status: 400 })
    }

    const { error } = await adminClient
      .from('chat_conversations')
      .delete()
      .eq('auction_id', auctionId)

    if (error) throw error

    return NextResponse.json({ success: true, message: 'All chat conversations erased for this auction' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to erase chat'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
