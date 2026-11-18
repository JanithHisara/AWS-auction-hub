import { type Request, type Response } from 'express'
import prisma from '../../../../../../lib/prisma'
import { broadcastEvent } from '../../../../../../lib/events'
import { authorize, validId, jsonError, PERMISSIONS } from '../../../../_auth'

function getId(request: Request): string {
  const param = (request as any).params?.id
  return (Array.isArray(param) ? param[0] : param) || ''
}

export async function POST(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.MANAGE_AUCTIONS)
  if (!admin) return
  const id = getId(request)
  if (!validId(id)) { jsonError(response, 400, 'Invalid auction ID.'); return }

  const result = await prisma.gem.updateMany({
    where: { auctionId: id, status: { in: ['draft', 'pending'] } },
    data: { status: 'active', publishedAt: new Date() },
  })

  broadcastEvent({
    channel: `item-monitor-auction-${id}`,
    table: 'gems',
    eventType: 'UPDATE',
    new: { auction_id: id, status: 'active' },
  })

  response.json({ success: true, activated: result.count })
}
