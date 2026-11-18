import { type Request, type Response } from 'express'
import prisma from '../../../../../../lib/prisma'
import { broadcastEvent } from '../../../../../../lib/events'
import { authorize, validId, jsonError, bodyOf, PERMISSIONS } from '../../../../_auth'

function getId(request: Request): string {
  const param = (request as any).params?.id
  return (Array.isArray(param) ? param[0] : param) || ''
}

export async function POST(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.MANAGE_AUCTIONS)
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
    const currentPrice = Number(gem.currentPrice ?? gem.startingPrice)
    const registrations = await prisma.auctionRegistration.findMany({
      where: { auctionId: gem.auctionId, approvalStatus: 'approved', isActive: true },
      select: { userId: true },
    })

    const currentPriceBids = await prisma.bid.findMany({
      where: { gemId: gem.id, bidAmount: currentPrice },
      select: { userId: true },
    })
    const approverIds = new Set(currentPriceBids.map(b => b.userId))

    if (approverIds.size === 0) {
      response.json({
        message: 'No bids received. Bidders preserved for price decrease.',
        eliminated_count: 0,
        at_price: currentPrice,
      })
      return
    }

    const nonApproverIds = registrations
      .map(r => r.userId)
      .filter(uid => !approverIds.has(uid))

    let count = 0
    for (const userId of nonApproverIds) {
      await prisma.gemElimination.upsert({
        where: { gemId_userId: { gemId: gem.id, userId } },
        update: { priceAtElimination: currentPrice },
        create: { gemId: gem.id, userId, priceAtElimination: currentPrice },
      }).catch(() => {})
      count++
      broadcastEvent({
        channel: `eliminations-${gem.auctionId}-${userId}`,
        table: 'gem_eliminations',
        eventType: 'INSERT',
        new: {
          gem_id: gem.id,
          gemId: gem.id,
          user_id: userId,
          userId: userId,
          auction_id: gem.auctionId,
          auctionId: gem.auctionId,
          price_at_elimination: currentPrice,
        },
      })
    }

    const elimPayload = {
      gem_id: gem.id,
      gemId: gem.id,
      auction_id: gem.auctionId,
      auctionId: gem.auctionId,
      eliminated_count: count,
      price_at_elimination: currentPrice,
    }

    broadcastEvent({
      channel: `item-monitor-auction-${gem.auctionId}`,
      table: 'gem_eliminations',
      eventType: 'INSERT',
      new: elimPayload,
    })
    broadcastEvent({
      channel: `auction-${gem.auctionId}`,
      table: 'gem_eliminations',
      eventType: 'INSERT',
      new: elimPayload,
    })

    response.json({
      message: 'Non-approvers eliminated',
      eliminated_count: count,
      at_price: currentPrice,
    })
    return
  }

  // If id is auction ID
  const result = await prisma.auctionRegistration.updateMany({
    where: { auctionId: id, approvalStatus: { not: 'approved' }, isActive: true },
    data: { isActive: false },
  })
  response.json({ success: true, eliminated_count: result.count })
}
