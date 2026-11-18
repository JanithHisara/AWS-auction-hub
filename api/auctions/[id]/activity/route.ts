import type { Request, Response } from 'express'
import prisma from '../../../../lib/prisma'
import { authorize, getSessionToken, jsonError, PERMISSIONS, validId } from '../../../admin/_auth'

// A fixed projection for auction rooms; callers cannot choose tables or SQL filters.
export async function GET(request: Request, response: Response) {
  response.setHeader('Cache-Control', 'private, no-store')
  if (!getSessionToken(request)) {
    jsonError(response, 401, 'Authentication required.')
    return
  }
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const auctionId = request.params.id
  if (!validId(auctionId)) {
    jsonError(response, 400, 'Invalid auction ID.')
    return
  }
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId as string },
    select: { id: true, status: true },
  })
  if (!auction) {
    jsonError(response, 404, 'Auction not found.')
    return
  }
  const canManage = user.permissions.has(PERMISSIONS.MANAGE_AUCTIONS) ||
    user.permissions.has(PERMISSIONS.CONTROL_BIDDING)
  if (!canManage) {
    const registration = await prisma.auctionRegistration.findUnique({
      where: { auctionId_userId: { auctionId: auction.id, userId: user.id } },
      select: { approvalStatus: true, isActive: true },
    })
    if (!registration?.isActive || registration.approvalStatus !== 'approved' || auction.status === 'draft') {
      jsonError(response, 403, 'Approved auction registration is required.')
      return
    }
  }
  const [registeredCount, winners] = await Promise.all([
    prisma.auctionRegistration.count({ where: { auctionId: auction.id, isActive: true } }),
    prisma.auctionWinner.findMany({
      where: { gem: { auctionId: auction.id } },
      select: {
        gemId: true, userId: true, winningAmount: true,
        gem: { select: { name: true, startingPrice: true } },
        winningBid: { select: { bidAmount: true } },
      },
    }),
  ])
  response.json({
    registeredCount,
    winners: winners.map(winner => ({
      gem_id: winner.gemId,
      user_id: winner.userId,
      gem_name: winner.gem.name,
      winning_amount: Number(winner.winningAmount ?? winner.winningBid?.bidAmount ?? winner.gem.startingPrice),
    })),
  })
}
