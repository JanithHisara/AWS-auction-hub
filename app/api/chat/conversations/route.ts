import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const { auction_id } = await request.json()

    // Look for any existing conversation for this user globally
    const { data: existing } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      return NextResponse.json(existing)
    }

    // Only fallback to creating a new one if none exists (use provided auction_id or a dummy if none)
    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .insert({
        auction_id: auction_id || '00000000-0000-0000-0000-000000000000', // dummy uuid if none provided
        user_id: user.id,
        status: 'open',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(conversation)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create conversation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const auctionId = searchParams.get('auction_id')

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdminRole = userData?.role === 'admin' || userData?.role === 'super_admin' || userData?.role === 'moderator'
    if (isAdminRole) {
      const adminClient = createAdminClient()
      
      let query = adminClient
        .from('chat_conversations')
        .select(`
          *,
          user:users!chat_conversations_user_id_fkey(id, email, anonymous_name, display_name, phone),
          assigned_admin:users!chat_conversations_assigned_admin_id_fkey(id, email, display_name)
        `)
        .order('last_message_at', { ascending: false })
        
      if (auctionId && auctionId !== 'all') {
         query = query.eq('auction_id', auctionId)
      }

      const { data: conversations, error } = await query

      if (error) throw error
      
      // Deduplicate conversations by user_id so admins only see one thread per user globally
      const uniqueConvs = conversations.filter((conv, index, self) =>
        index === self.findIndex((c) => (
          c.user_id === conv.user_id
        ))
      )
      
      return NextResponse.json(uniqueConvs)
    }

    // For regular users, find their single global conversation
    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return NextResponse.json(conversation || null)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get conversations'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}