import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireAuth()
    const supabase = await createClient()

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*, sender:users!chat_messages_sender_id_fkey(id, email, display_name, anonymous_name)')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json(messages)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get messages'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth()
    const supabase = await createClient()
    const { content } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', id)
      .single()

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin' || userData?.role === 'moderator'
    const senderRole = isAdmin ? 'admin' : 'user'

    if (!isAdmin && conversation.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data: msg, error: msgError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: id,
        sender_id: user.id,
        sender_role: senderRole,
        content: content.trim(),
      })
      .select('*, sender:users!chat_messages_sender_id_fkey(id, email, display_name, anonymous_name)')
      .single()

    if (msgError) throw msgError

    const convUpdate: Record<string, unknown> = {
      last_message_at: new Date().toISOString(),
    }

    if (isAdmin) {
      convUpdate.status = 'waiting'
      convUpdate.assigned_admin_id = user.id
      convUpdate.unread_by_user = (conversation.unread_by_user || 0) + 1
      convUpdate.unread_by_admin = 0
    } else {
      const shouldReopen = conversation.status === 'waiting' || conversation.status === 'resolved'
      convUpdate.status = shouldReopen ? 'open' : conversation.status === 'open' ? 'open' : 'active'
      convUpdate.unread_by_admin = (conversation.unread_by_admin || 0) + 1
      convUpdate.unread_by_user = 0
    }

    await supabase
      .from('chat_conversations')
      .update(convUpdate)
      .eq('id', id)

    return NextResponse.json(msg)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send message'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
