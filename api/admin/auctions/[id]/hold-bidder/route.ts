import { type Request, type Response } from 'express'
import prisma from '../../../../../lib/prisma'
import { authorize, jsonError, validId, bodyOf, PERMISSIONS } from '../../../_auth'
import { broadcastEvent } from '../../../../../lib/events'

export async function GET(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.CONTROL_BIDDING)
  if (!admin) return
  const auctionId = ((request as any).params?.id as string) || ''
  if (!validId(auctionId)) { jsonError(response, 400, 'Invalid auction ID.'); return }
  const holds = await prisma.bidderHold.findMany({
    where: { auctionId, isActive: true },
    include: { user: { select: { id: true, email: true, displayName: true, anonymousName: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  })
  response.json(holds.map(hold => ({
    id: hold.id,
    user_id: hold.userId,
    reason: hold.reason,
    held_at: hold.createdAt,
    user: {
      id: hold.user.id,
      email: hold.user.email,
      display_name: hold.user.displayName,
      anonymous_name: hold.user.anonymousName,
      phone: hold.user.phone,
    },
  })))
}

export async function POST(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.CONTROL_BIDDING)
  if (!admin) return
  const auctionId = ((request as any).params?.id as string) || ''
  const body = bodyOf(request)
  const userId = body.user_id
  if (!validId(auctionId) || !validId(userId)) {
    jsonError(response, 400, 'A valid auction and user ID are required.'); return
  }
  const existing = await prisma.bidderHold.findFirst({
    where: { auctionId, userId, isActive: true },
  })
  if (existing) response.status(409).json({ error: 'This bidder already has an active hold.' })
  else {
    const hold = await prisma.bidderHold.create({
      data: {
        auctionId, userId, adminId: admin.id,
        reason: typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null,
      },
    })
    broadcastEvent({
      channel: `auction-${auctionId}`,
      table: 'bidder_holds',
      eventType: 'INSERT',
      new: hold,
    })
    response.status(201).json({ hold })
  }
}

export async function PATCH(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.CONTROL_BIDDING)
  if (!admin) return
  const auctionId = ((request as any).params?.id as string) || ''
  const body = bodyOf(request)
  const userId = body.user_id
  if (!validId(auctionId) || !validId(userId)) {
    jsonError(response, 400, 'A valid auction and user ID are required.'); return
  }
  const hold = await prisma.bidderHold.findFirst({
    where: { auctionId, userId, isActive: true },
  })
  if (!hold) {
    jsonError(response, 404, 'No active hold found for this bidder.')
    return
  }
  const updated = await prisma.bidderHold.update({
    where: { id: hold.id },
    data: { isActive: false, releasedAt: new Date() },
  })
  broadcastEvent({
    channel: `auction-${auctionId}`,
    table: 'bidder_holds',
    eventType: 'UPDATE',
    new: updated,
  })
  response.json({ hold: updated })
}
