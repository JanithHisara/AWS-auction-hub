import { type Request, type Response } from 'express'
import prisma from '../../../../../../lib/prisma'
import { broadcastEvent } from '../../../../../../lib/events'
import { authorize, validId, jsonError, bodyOf, PERMISSIONS } from '../../../../_auth'

function getId(request: Request): string {
  const param = (request as any).params?.id
  return (Array.isArray(param) ? param[0] : param) || ''
}

export async function POST(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.CONTROL_BIDDING)
  if (!admin) return
  const id = getId(request)
  const body = bodyOf(request)
  const gemId = body.gem_id ?? body.item_id ?? id
  if (!validId(gemId)) {
    jsonError(response, 400, 'A valid item ID is required.')
    return
  }

  const gem = await prisma.gem.findUnique({
    where: { id: gemId },
    include: { auction: true },
  })
  if (!gem) { jsonError(response, 404, 'Item not found.'); return }

  let userId = body.user_id ?? body.bidder_id ?? body.winner_id
  let winningBid: any = null

  if (userId && validId(userId)) {
    winningBid = await prisma.bid.findFirst({
      where: { gemId, userId },
      orderBy: [{ bidAmount: 'desc' }, { createdAt: 'asc' }],
    })
  } else {
    winningBid = await prisma.bid.findFirst({
      where: { gemId },
      orderBy: [{ bidAmount: 'desc' }, { createdAt: 'asc' }],
    })
    if (winningBid) userId = winningBid.userId
  }

  if (!winningBid || !userId) {
    jsonError(response, 404, 'No bids found for this item.')
    return
  }

  const winner = await prisma.$transaction(async tx => {
    const record = await tx.auctionWinner.upsert({
      where: { gemId },
      update: { userId, winningBidId: winningBid.id, winningAmount: winningBid.bidAmount, selectedById: admin.id },
      create: { gemId, userId, winningBidId: winningBid.id, winningAmount: winningBid.bidAmount, selectedById: admin.id },
    })
    await tx.gem.update({ where: { id: gemId }, data: { status: 'completed' } })
    return record
  })

  broadcastEvent({
    channel: `auction-${gem.auctionId}`,
    table: 'gems',
    eventType: 'UPDATE',
    new: {
      id: gemId,
      auction_id: gem.auctionId,
      status: 'completed',
    },
  })
  broadcastEvent({
    channel: `item-monitor-auction-${gem.auctionId}`,
    table: 'gems',
    eventType: 'UPDATE',
    new: {
      id: gemId,
      auction_id: gem.auctionId,
      status: 'completed',
    },
  })
  const winnerUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, anonymousName: true, email: true },
  })

  const winnerPayload = {
    id: winner.id,
    gem_id: gemId,
    gemId: gemId,
    user_id: userId,
    userId: userId,
    winning_bid_id: winningBid.id,
    winningBidId: winningBid.id,
    winning_amount: Number(winningBid.bidAmount),
    winningAmount: Number(winningBid.bidAmount),
    winner_name: winnerUser?.displayName || winnerUser?.anonymousName || 'Verified Winner',
    user: {
      id: userId,
      display_name: winnerUser?.displayName || null,
      anonymous_name: winnerUser?.anonymousName || null,
      email: winnerUser?.email || null,
    },
  }

  broadcastEvent({
    channel: `auction-${gem.auctionId}`,
    table: 'auction_winners',
    eventType: 'INSERT',
    new: winnerPayload,
  })
  broadcastEvent({
    channel: `auction-monitor-${gem.auctionId}`,
    table: 'auction_winners',
    eventType: 'INSERT',
    new: winnerPayload,
  })

  const nextPending = await prisma.gem.findFirst({
    where: { auctionId: gem.auctionId, status: 'pending' },
    orderBy: { startTime: 'asc' },
  })
  if (nextPending) {
    await prisma.gem.update({
      where: { id: nextPending.id },
      data: { status: 'active' },
    })
    broadcastEvent({
      channel: `auction-${gem.auctionId}`,
      table: 'gems',
      eventType: 'UPDATE',
      new: {
        id: nextPending.id,
        auction_id: gem.auctionId,
        status: 'active',
      },
    })
    broadcastEvent({
      channel: `item-monitor-auction-${gem.auctionId}`,
      table: 'gems',
      eventType: 'UPDATE',
      new: {
        id: nextPending.id,
        auction_id: gem.auctionId,
        status: 'active',
      },
    })
  }

  response.json({ message: 'Winner selected', winner })
}
