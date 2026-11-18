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
  const duration = Number(body.duration || 300)

  // Check if id is a gem ID
  const gem = await prisma.gem.findUnique({ where: { id } })
  if (gem) {
    const roundEndTime = new Date(Date.now() + duration * 1000)
    const updated = await prisma.gem.update({
      where: { id },
      data: { status: 'active', startTime: new Date(), roundEndTime },
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
    response.json({ message: 'Round started', round_end_time: roundEndTime, gem: mapped })
    return
  }

  // Otherwise id is an auction ID - target specific gem if provided
  const targetGemId = body.gem_id || body.item_id
  if (targetGemId && validId(targetGemId)) {
    const roundEndTime = new Date(Date.now() + duration * 1000)
    const updated = await prisma.gem.update({
      where: { id: targetGemId },
      data: { status: 'active', startTime: new Date(), roundEndTime },
    })
    const mapped = mapGem(updated)
    broadcastEvent({
      channel: `item-monitor-auction-${id}`,
      table: 'gems',
      eventType: 'UPDATE',
      new: mapped,
    })
    broadcastEvent({
      channel: `auction-${id}`,
      table: 'gems',
      eventType: 'UPDATE',
      new: mapped,
    })
    response.json({ message: 'Round started', round_end_time: roundEndTime, gem: mapped })
    return
  }

  const roundEndTime = body.round_end_time ? new Date(body.round_end_time) : new Date(Date.now() + duration * 1000)
  await prisma.gem.updateMany({
    where: { auctionId: id, status: { in: ['pending', 'draft'] } },
    data: { status: 'active', startTime: new Date(), roundEndTime },
  })
  const updatedGems = await prisma.gem.findMany({
    where: { auctionId: id, status: 'active' },
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
  response.json({ success: true, updated: updatedGems.length, round_end_time: roundEndTime })
}
