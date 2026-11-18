import { type Request, type Response } from 'express'
import prisma from '../../../../lib/prisma'
import { authorize, validId, jsonError, getApiUser, placeBid, PERMISSIONS } from '../../../admin/_auth'

export async function GET(request: Request, response: Response) {
  response.setHeader('Cache-Control', 'private, no-store')
  const gemId = (request as any).params?.id
  if (!validId(gemId)) {
    jsonError(response, 400, 'Invalid item ID.')
    return
  }
  const user = await getApiUser(request)
  if (!user) {
    jsonError(response, 401, 'Authentication required.')
    return
  }
  const gem = await prisma.gem.findUnique({
    where: { id: gemId },
    select: { auctionId: true, auction: { select: { status: true, auctionType: true } } },
  })
  if (!gem || !['published', 'active', 'live', 'upcoming'].includes(gem.auction.status)) {
    jsonError(response, 404, 'Item not found.')
    return
  }
  const canManage = user.permissions.has(PERMISSIONS.MANAGE_AUCTIONS) ||
    user.permissions.has(PERMISSIONS.CONTROL_BIDDING)
  if (!canManage) {
    const registration = await prisma.auctionRegistration.findUnique({
      where: { auctionId_userId: { auctionId: gem.auctionId, userId: user.id } },
      select: { approvalStatus: true, isActive: true },
    })
    if (!registration || registration.approvalStatus !== 'approved' || !registration.isActive) {
      jsonError(response, 403, 'Approved auction registration is required.')
      return
    }
  }
  const bids = await prisma.bid.findMany({
    where: {
      gemId,
      ...(gem.auction.auctionType === 'tender_base_fixed_bid' && !canManage ? { userId: user.id } : {}),
    },
    select: {
      id: true, userId: true, bidAmount: true, pointsEarned: true, createdAt: true,
      user: { select: { id: true, displayName: true, anonymousName: true } },
    },
    orderBy: [{ bidAmount: 'desc' }, { createdAt: 'asc' }],
    take: 100,
  })
  response.json({
    bids: bids.map(b => ({
      id: b.id,
      gem_id: gemId,
      user_id: b.userId,
      bid_amount: Number(b.bidAmount),
      points_earned: b.pointsEarned,
      created_at: b.createdAt.toISOString(),
      user: {
        anonymous_name: b.user.anonymousName,
        display_name: canManage || b.userId === user.id ? b.user.displayName : null,
        email: '',
      },
    })),
  })
}

export async function POST(request: Request, response: Response) {
  const gemId = (request as any).params?.id
  if (!validId(gemId)) {
    jsonError(response, 400, 'Invalid item ID.')
    return
  }
  const gem = await prisma.gem.findUnique({ where: { id: gemId }, select: { auctionId: true } })
  if (!gem) {
    jsonError(response, 404, 'Item not found.')
    return
  }
  await placeBid(request, response, gem.auctionId, gemId)
}
