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
  const body = bodyOf(request)
  const gemId = body.gem_id || body.item_id || id
  if (!validId(gemId)) {
    jsonError(response, 400, 'A valid item ID is required.')
    return
  }
  const gem = await prisma.gem.findUnique({
    where: { id: gemId },
    include: { auction: true },
  })
  if (!gem) { jsonError(response, 404, 'Auction item not found.'); return }

  const incrementAmount = Number(body.increment ?? body.amount ?? gem.minBidIncrement)
  const duration = Number(body.duration ?? gem.incrementInterval ?? 30)
  const newPrice = Math.round(Number(gem.currentPrice ?? gem.startingPrice) + incrementAmount)
  const nextRoundEnd = new Date(Date.now() + duration * 1000)

  const updated = await prisma.gem.update({
    where: { id: gemId },
    data: {
      currentPrice: newPrice,
      roundEndTime: nextRoundEnd,
      status: 'active',
    },
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
  response.json({ message: 'Price incremented', current_price: newPrice, gem: mapped })
}
