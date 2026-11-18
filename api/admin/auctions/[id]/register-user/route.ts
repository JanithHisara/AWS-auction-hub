import { type Request, type Response } from 'express'
import prisma from '../../../../../lib/prisma'
import { authorize, jsonError, validId, bodyOf, mapRegistration, PERMISSIONS } from '../../../_auth'
import { randomUUID } from 'crypto'
import { broadcastEvent } from '../../../../../lib/events'

export async function POST(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.MANAGE_REGISTRATIONS)
  if (!admin) return
  const auctionId = ((request as any).params?.id as string) || ''
  const userId = bodyOf(request).user_id
  if (!validId(auctionId) || !validId(userId)) {
    jsonError(response, 400, 'A valid auction and user ID are required.')
    return
  }
  const [auction, targetUser] = await prisma.$transaction([
    prisma.auction.findUnique({ where: { id: auctionId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
  ])
  if (!auction || !targetUser) {
    jsonError(response, 404, 'Auction or user not found.')
    return
  }
  const registration = await prisma.auctionRegistration.upsert({
    where: { auctionId_userId: { auctionId, userId } },
    update: { isActive: true },
    create: { auctionId, userId, approvalStatus: 'approved', approvedAt: new Date(), accessTokenHash: randomUUID() },
  })
  broadcastEvent({
    channel: `auction-${auctionId}`,
    table: 'auction_registrations',
    eventType: 'INSERT',
    new: mapRegistration(registration),
  })
  response.status(201).json({ registration: mapRegistration(registration) })
}
