import { type Request, type Response } from 'express'
import prisma from '../../../../lib/prisma'
import { authorize, validId, jsonError, bodyOf, mapConversation, unavailable } from '../../../admin/_auth'

function getConversationId(request: Request): string {
  const param = request.params?.id
  return (Array.isArray(param) ? param[0] : param) || ''
}

export async function PATCH(request: Request, response: Response) {
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const adminUser = ['super_admin', 'admin', 'moderator'].includes(user.role)
  if (!adminUser) {
    jsonError(response, 403, 'Administrator access is required.')
    return
  }
  const conversationId = getConversationId(request)
  if (!validId(conversationId)) {
    jsonError(response, 400, 'Invalid conversation ID.')
    return
  }
  const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId } })
  if (!conversation) {
    jsonError(response, 404, 'Conversation not found.')
    return
  }
  const body = bodyOf(request)
  const data: Record<string, any> = {}
  if (body.action === 'mark_read') {
    unavailable(response, 'Chat read receipts')
    return
  }
  if (body.action === 'resolve') data.status = 'closed'
  else if (body.action === 'reopen') data.status = 'open'
  else if (body.action === 'assign') data.assignedAdminId = user.id
  else if (['open', 'closed', 'resolved'].includes(body.status)) {
    data.status = body.status === 'resolved' ? 'closed' : body.status
  }
  if (body.assigned_admin_id === null || validId(body.assigned_admin_id)) {
    data.assignedAdminId = body.assigned_admin_id
  }
  const updated = await prisma.chatConversation.update({
    where: { id: conversationId },
    data,
    include: {
      auction: { select: { id: true, name: true, status: true, auctionType: true } },
      user: { select: { id: true, email: true, displayName: true } },
      assignedAdmin: { select: { id: true, email: true, displayName: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  response.json(mapConversation(updated))
}

export async function DELETE(request: Request, response: Response) {
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const adminUser = ['super_admin', 'admin', 'moderator'].includes(user.role)
  if (!adminUser) {
    jsonError(response, 403, 'Administrator access is required.')
    return
  }
  const conversationId = getConversationId(request)
  if (!validId(conversationId)) {
    jsonError(response, 400, 'Invalid conversation ID.')
    return
  }
  await prisma.chatConversation.delete({ where: { id: conversationId } })
  response.json({ success: true })
}
