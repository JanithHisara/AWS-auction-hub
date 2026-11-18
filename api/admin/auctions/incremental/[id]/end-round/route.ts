import { type Request, type Response } from 'express'
import prisma from '../../../../../../lib/prisma'
import { broadcastEvent } from '../../../../../../lib/events'
import { authorize, validId, jsonError, bodyOf, mapGem, PERMISSIONS } from '../../../../_auth'

function getId(request: Request): string {
  const param = (request as any).params?.id
  return (Array.isArray(param) ? param[0] : param) || ''
}

export async function POST(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.CONTROL_BIDDING)
  if (!admin) return
  const id = getId(request)
  if (!validId(id)) { jsonError(response, 400, 'Invalid ID.'); return }
  const body = bodyOf(request)
  const targetGemId = body.gem_id || body.item_id || id

  const gem = await prisma.gem.findUnique({
    where: { id: targetGemId },
    include: { auction: true },
  })
  if (gem) {
    const isTender = gem.auction.auctionType === 'tender_base_fixed_bid'
    const status = isTender ? 'ended' : 'active'
    const updated = await prisma.gem.update({
      where: { id: gem.id },
      data: { roundEndTime: null, ...(isTender ? { status: 'ended', endTime: new Date() } : {}) },
    })
    const mapped = mapGem(updated)
    broadcastEvent({
      channel: `item-monitor-auction-${gem.auctionId}`,
      table: 'gems',
      eventType: 'UPDATE',
      new: mapped,
    })
    broadcastEvent({
      channel: `auction-${gem.auctionId}`,
      table: 'gems',
      eventType: 'UPDATE',
      new: mapped,
    })
    response.json({ message: 'Round ended', status, gem: mapped })
    return
  }

  await prisma.gem.updateMany({
    where: { auctionId: id, status: { in: ['active', 'live'] } },
    data: { status: 'completed', endTime: new Date(), roundEndTime: null },
  })
  const updatedGems = await prisma.gem.findMany({
    where: { auctionId: id },
  })
  for (const g of updatedGems) {
    const mapped = mapGem(g)
    broadcastEvent({
      channel: `auction-${id}`,
      table: 'gems',
      eventType: 'UPDATE',
      new: mapped,
    })
    broadcastEvent({
      channel: `item-monitor-auction-${id}`,
      table: 'gems',
      eventType: 'UPDATE',
      new: mapped,
    })
  }
  response.json({ success: true, updated: updatedGems.length })
}
