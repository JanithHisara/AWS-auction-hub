import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')

    const adminClient = createAdminClient()

    const { data: userData } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin' || userData?.role === 'moderator'

    let query = adminClient
      .from('chat_messages')
      .select(`
        id,
        content,
        created_at,
        sender_role,
        sender_id,
        sender:users!chat_messages_sender_id_fkey(id, email, display_name, anonymous_name),
        conversation:chat_conversations!chat_messages_conversation_id_fkey(
          id,
          auction_id,
          user_id,
          auction:auctions(id, name, status)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20)

    if (isAdmin) {
      query = query.eq('sender_role', 'user')
    } else {
      query = query.eq('sender_role', 'admin')
    }

    if (since) {
      const sinceNum = Number(since)
      const sinceDate = !isNaN(sinceNum) && sinceNum > 0 ? new Date(sinceNum) : new Date(since)
      if (!isNaN(sinceDate.getTime())) {
        query = query.gt('created_at', sinceDate.toISOString())
      }
    }

    const { data: messages, error } = await query
    if (error) throw error

    const notifications = (messages || [])
      .filter((m: any) => {
        const conv = m.conversation
        if (!conv) return false
        const status = conv.auction?.status
        if (status === 'ended' || status === 'completed') return false
        
        if (isAdmin) {
          return true
        } else {
          return conv.user_id === user.id
        }
      })
      .map((m: any) => {
        const sender = m.sender
        const senderName = m.sender_role === 'admin'
          ? 'Auction Support'
          : (sender?.display_name || sender?.anonymous_name || sender?.email || 'Bidder')

        return {
          id: m.id,
          conversation_id: m.conversation?.id,
          auction_id: m.conversation?.auction_id,
          auction_name: m.conversation?.auction?.name || 'Auction',
          content: m.content,
          sender_name: senderName,
          sender_role: m.sender_role,
          created_at: m.created_at,
          timestamp: new Date(m.created_at).getTime(),
        }
      })

    return NextResponse.json({ ok: true, notifications })
  } catch (error: any) {
    return NextResponse.json({ ok: false, notifications: [], error: error.message }, { status: 200 })
  }
}
