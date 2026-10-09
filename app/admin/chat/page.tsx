import { requireAuth, getUserRole } from '@/lib/auth'
import ChatInboxClient from '@/components/admin/ChatInboxClient'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Chat Inbox | AuxtionHub Admin',
}

export default async function ChatInboxPage() {
  const user = await requireAuth()
  const role = await getUserRole()
  
  if (role !== 'admin' && role !== 'super_admin' && role !== 'moderator') {
    redirect('/')
  }

  return <ChatInboxClient adminId={user.id} />
}