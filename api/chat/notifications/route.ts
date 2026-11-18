import { type Request, type Response } from 'express'
import prisma from '../../../lib/prisma'
import { authorize } from '../../admin/_auth'

export async function GET(request: Request, response: Response) {
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const adminUser = ['super_admin', 'admin', 'moderator'].includes(user.role)
  if (adminUser) {
    const unassigned = await prisma.chatConversation.count({ where: { assignedAdminId: null, status: 'open' } })
    const assigned = await prisma.chatConversation.count({ where: { assignedAdminId: user.id, status: 'open' } })
    response.json({ unassignedCount: unassigned, assignedToMe: assigned })
    return
  }
  const unread = await prisma.chatConversation.count({
    where: { userId: user.id, status: 'open' },
  })
  response.json({ unreadCount: unread })
}
