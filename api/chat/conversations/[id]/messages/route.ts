import { type Request, type Response } from 'express'
import prisma from '../../../../../lib/prisma'
import { authorize, validId, jsonError, bodyOf, mapChatMessage } from '../../../../admin/_auth'
import { broadcastEvent } from '../../../../../lib/events'

function getConversationId(request: Request): string {
  const param = request.params?.id
  return (Array.isArray(param) ? param[0] : param) || ''
}

export async function GET(request: Request, response: Response) {
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const adminUser = ['super_admin', 'admin', 'moderator'].includes(user.role)
  const conversationId = getConversationId(request)
  if (!validId(conversationId)) {
    jsonError(response, 400, 'Invalid conversation ID.')
    return
  }
  const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId } })
  if (!conversation || (!adminUser && conversation.userId !== user.id)) {
    jsonError(response, 404, 'Conversation not found.')
    return
  }
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId },
    include: { sender: { select: { id: true, displayName: true, role: true } } },
    orderBy: { createdAt: 'asc' },
    take: 500,
  })
  response.json(messages.map(mapChatMessage))
}

export async function POST(request: Request, response: Response) {
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const adminUser = ['super_admin', 'admin', 'moderator'].includes(user.role)
  const conversationId = getConversationId(request)
  if (!validId(conversationId)) {
    jsonError(response, 400, 'Invalid conversation ID.')
    return
  }
  const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId } })
  if (!conversation || (!adminUser && conversation.userId !== user.id)) {
    jsonError(response, 404, 'Conversation not found.')
    return
  }
  const content = typeof bodyOf(request).content === 'string' ? bodyOf(request).content.trim() : ''
  if (!content || content.length > 8000) {
    jsonError(response, 400, 'Message content must be between 1 and 8000 characters.')
    return
  }
  const message = await prisma.$transaction(async tx => {
    const created = await tx.chatMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        senderRole: user.role,
        content,
      },
      include: { sender: { select: { id: true, displayName: true, role: true } } },
    })
    await tx.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date(), ...(adminUser ? {} : { status: 'open' }) },
    })
    return created
  })
    broadcastEvent({
    channel: `chat-msgs-${conversationId}`,
    table: 'chat_messages',
    eventType: 'INSERT',
    new: mapChatMessage(message),
  })
  response.status(201).json(mapChatMessage(message))
}

export async function DELETE(request: Request, response: Response) {
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const adminUser = ['super_admin', 'admin', 'moderator'].includes(user.role)
  const conversationId = getConversationId(request)
  if (!validId(conversationId)) {
    jsonError(response, 400, 'Invalid conversation ID.')
    return
  }

  const body = bodyOf(request)
  const messageId =
    (request.params?.messageId as string) ||
    (request.query?.message_id as string) ||
    (body.message_id as string) ||
    (body.id as string)

  if (!validId(messageId)) {
    jsonError(response, 400, 'Invalid message ID.')
    return
  }

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  })

  if (!message || message.conversationId !== conversationId) {
    jsonError(response, 404, 'Message not found.')
    return
  }

  if (!adminUser && message.senderId !== user.id) {
    jsonError(response, 403, 'You do not have permission to delete this message.')
    return
  }

  await prisma.chatMessage.delete({ where: { id: messageId } })

  broadcastEvent({
    channel: `chat-msgs-${conversationId}`,
    table: 'chat_messages',
    eventType: 'DELETE',
    old: { id: messageId },
  })

  response.json({ success: true, messageId })
}
