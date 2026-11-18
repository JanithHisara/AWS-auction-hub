import { type Request, type Response } from 'express'
import prisma from '../../../lib/prisma'
import { authorize, validId, jsonError, bodyOf, mapConversation, PERMISSIONS } from '../../admin/_auth'

export async function GET(request: Request, response: Response) {
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const adminUser = ['super_admin', 'admin', 'moderator'].includes(user.role)
  if (adminUser && !user.permissions.has(PERMISSIONS.MANAGE_CHAT)) {
    jsonError(response, 403, 'You do not have permission to manage support conversations.')
    return
  }
  const auctionId = typeof request.query.auction_id === 'string' ? request.query.auction_id : ''
  if (!adminUser) {
    if (!validId(auctionId)) {
      jsonError(response, 400, 'A valid auction ID is required.')
      return
    }
    const conversation = await prisma.chatConversation.findFirst({
      where: { auctionId, userId: user.id, status: 'open' },
      include: {
        auction: { select: { id: true, name: true, status: true, auctionType: true } },
        user: { select: { id: true, email: true, displayName: true } },
        assignedAdmin: { select: { id: true, email: true, displayName: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!conversation) jsonError(response, 404, 'No open conversation exists for this auction.')
    else response.json(mapConversation(conversation))
    return
  }
  const conversations = await prisma.chatConversation.findMany({
    where: auctionId && auctionId !== 'all' && validId(auctionId) ? { auctionId } : {},
    include: {
      auction: { select: { id: true, name: true, status: true, auctionType: true } },
      user: { select: { id: true, email: true, displayName: true } },
      assignedAdmin: { select: { id: true, email: true, displayName: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })
  response.json(conversations.map(mapConversation))
}

export async function POST(request: Request, response: Response) {
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const body = bodyOf(request)
  if (!validId(body.auction_id)) {
    jsonError(response, 400, 'A valid auction ID is required.')
    return
  }
  const auction = await prisma.auction.findUnique({ where: { id: body.auction_id }, select: { id: true } })
  if (!auction) {
    jsonError(response, 404, 'Auction not found.')
    return
  }
  const existing = await prisma.chatConversation.findFirst({
    where: { auctionId: auction.id, userId: user.id, status: 'open' },
  })
  const conversation = existing ?? await prisma.chatConversation.create({
    data: { auctionId: auction.id, userId: user.id },
  })
  response.status(existing ? 200 : 201).json(mapConversation(conversation))
}

export async function DELETE(request: Request, response: Response) {
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const adminUser = ['super_admin', 'admin', 'moderator'].includes(user.role)
  const body = bodyOf(request)
  if (!validId(body.id)) {
    jsonError(response, 400, 'A valid conversation ID is required.')
    return
  }
  const result = await prisma.chatConversation.updateMany({
    where: { id: body.id, ...(adminUser ? {} : { userId: user.id }) },
    data: { status: 'closed' },
  })
  if (!result.count) jsonError(response, 404, 'Conversation not found.')
  else response.json({ success: true })
}
