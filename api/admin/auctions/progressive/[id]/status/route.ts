import { type Request, type Response } from 'express'
import prisma from '../../../../../../lib/prisma'
import { broadcastEvent } from '../../../../../../lib/events'
import { authorize, validId, jsonError, bodyOf, auctionDetails, PERMISSIONS } from '../../../../_auth'

function getId(request: Request): string {
  const param = (request as any).params?.id
  return (Array.isArray(param) ? param[0] : param) || ''
}

export async function GET(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.MANAGE_AUCTIONS)
  if (!admin) return
  const id = getId(request)
  if (!validId(id)) { jsonError(response, 400, 'A valid auction ID is required.'); return }
  const auction = await auctionDetails(id)
  if (!auction) jsonError(response, 404, 'Auction not found.')
  else response.json({ auction })
}

export async function POST(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.MANAGE_AUCTIONS)
  if (!admin) return
  const id = getId(request)
  if (!validId(id)) { jsonError(response, 400, 'A valid auction ID is required.'); return }
  const body = bodyOf(request)
  if (typeof body.status !== 'string') { jsonError(response, 400, 'A valid auction status is required.'); return }

  const auction = await prisma.auction.findUnique({
    where: { id },
    select: { id: true, auctionType: true },
  })
  if (!auction) { jsonError(response, 404, 'Auction not found.'); return }

  const validStatuses = ['draft', 'upcoming', 'registration_open', 'registration_closed', 'published', 'active', 'live', 'completed', 'cancelled', 'ended']
  if (!validStatuses.includes(body.status)) {
    jsonError(response, 400, 'Invalid auction status.'); return
  }

  const updated = await prisma.auction.update({
    where: { id },
    data: {
      status: body.status,
      publishedAt: ['published', 'active', 'live', 'registration_open'].includes(body.status) ? new Date() : undefined,
    },
  })

  const rawAuction = updated as any
  const auctionPayload = {
    ...updated,
    id: updated.id,
    status: updated.status,
    auction_start: rawAuction.startTime instanceof Date ? rawAuction.startTime.toISOString() : (rawAuction.startTime || null),
    startTime: rawAuction.startTime instanceof Date ? rawAuction.startTime.toISOString() : (rawAuction.startTime || null),
    auction_end: rawAuction.endTime instanceof Date ? rawAuction.endTime.toISOString() : (rawAuction.endTime || null),
    endTime: rawAuction.endTime instanceof Date ? rawAuction.endTime.toISOString() : (rawAuction.endTime || null),
    auction_type: updated.auctionType,
    auctionType: updated.auctionType,
    name: updated.name,
  }

  broadcastEvent({
    channel: `auction-${id}`,
    table: 'auctions',
    eventType: 'UPDATE',
    new: auctionPayload,
  })
  broadcastEvent({
    channel: `item-monitor-auction-${id}`,
    table: 'auctions',
    eventType: 'UPDATE',
    new: { id, status: body.status },
  })

  response.json({ success: true, status: body.status, auction: updated })
}
