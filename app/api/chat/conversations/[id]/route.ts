import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin' || userData?.role === 'moderator'

    if (body.action === 'resolve') {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Only admins can resolve conversations' }, { status: 403 })
      }

      const { error } = await supabase
        .from('chat_conversations')
        .update({ status: 'resolved' })
        .eq('id', id)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (body.action === 'mark_read') {
      const update = isAdmin
        ? { unread_by_admin: 0 }
        : { unread_by_user: 0 }

      const { error } = await supabase
        .from('chat_conversations')
        .update(update)
        .eq('id', id)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update conversation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
