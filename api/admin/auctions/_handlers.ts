import { type Request, type Response } from 'express'
import type { AuctionType } from '@prisma/client'
import prisma from '../../../lib/prisma'
import {
  validId,
  jsonError,
  bodyOf,
  getApiUser,
  placeBid,
} from '../_auth'

function getId(request: Request): string {
  const param = (request as any).params?.id
  return (Array.isArray(param) ? param[0] : param) || ''
}

export async function handleCurrentItem(request: Request, response: Response, _auctionType: AuctionType) {
  const id = getId(request)
  if (!validId(id)) {
    jsonError(response, 400, 'Invalid auction ID.')
    return
  }
  const auction = await prisma.auction.findUnique({
    where: { id },
    select: { id: true, name: true, status: true, auctionType: true },
  })
  if (!auction) {
    jsonError(response, 404, 'Auction not found.')
    return
  }

  const items = await prisma.gem.findMany({
    where: { auctionId: id },
    include: {
      images: { orderBy: { displayOrder: 'asc' } },
      winner: {
        include: {
          user: { select: { id: true, displayName: true, anonymousName: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const currentItem = items.find(item => item.status === 'active')
  const currentIndex = currentItem ? items.findIndex(i => i.id === currentItem.id) : -1
  const nextItem = currentIndex >= 0 && currentIndex < items.length - 1 ? items[currentIndex + 1] : null

  let bidData: any = null
  if (currentItem) {
    const bids = await prisma.bid.findMany({
      where: { gemId: currentItem.id },
      orderBy: [{ bidAmount: 'desc' }, { createdAt: 'desc' }],
    })
    const bidCount = bids.length
    const uniqueBidders = new Set(bids.map(b => b.userId)).size
    const highestBid = bids[0] ? Number(bids[0].bidAmount) : Number(currentItem.currentPrice ?? currentItem.startingPrice)
    const recentBids = bids.slice(0, 10).map(b => ({
      id: b.id,
      bid_amount: Number(b.bidAmount),
      created_at: b.createdAt.toISOString(),
    }))

    const totalRegistrations = await prisma.auctionRegistration.count({
      where: { auctionId: id, approvalStatus: 'approved', isActive: true },
    })
    const eliminationCounts = await prisma.gemElimination.count({
      where: { gemId: currentItem.id },
    })
    const activeBiddersCount = Math.max(0, totalRegistrations - eliminationCounts)
    const currentPriceBids = bids.filter(b => Number(b.bidAmount) === Number(currentItem.currentPrice ?? currentItem.startingPrice))
    const uniqueBiddersForCurrentPrice = new Set(currentPriceBids.map(b => b.userId)).size
    const allRegisteredBiddersBid = uniqueBiddersForCurrentPrice > 0 && activeBiddersCount > 0 && uniqueBiddersForCurrentPrice >= activeBiddersCount

    bidData = {
      bidCount,
      uniqueBidders,
      highestBid,
      recentBids,
      allRegisteredBiddersBid,
      eliminatedCount: eliminationCounts,
      activeBiddersCount,
      registeredCount: totalRegistrations,
    }
  }

  const finishedItems = items.filter(i => i.status === 'ended' || i.status === 'completed' || i.status === 'sold')

  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  response.json({
    auction: {
      id: auction.id,
      name: auction.name,
      status: auction.status,
      auction_type: auction.auctionType,
    },
    currentItem: currentItem ? {
      id: currentItem.id,
      name: currentItem.name,
      description: currentItem.description,
      starting_price: Number(currentItem.startingPrice),
      current_price: Number(currentItem.currentPrice ?? currentItem.startingPrice),
      min_bid_increment: Number(currentItem.minBidIncrement),
      status: currentItem.status,
      end_time: currentItem.endTime ? currentItem.endTime.toISOString() : null,
      round_end_time: currentItem.roundEndTime ? currentItem.roundEndTime.toISOString() : null,
      gem_images: currentItem.images.map(img => ({ image_url: img.imageUrl })),
      ...bidData,
    } : null,
    nextItem: nextItem ? {
      id: nextItem.id,
      name: nextItem.name,
      status: nextItem.status,
    } : null,
    allItems: items.map(i => ({
      id: i.id,
      name: i.name,
      status: i.status,
      starting_price: Number(i.startingPrice),
      current_price: Number(i.currentPrice ?? i.startingPrice),
      min_bid_increment: Number(i.minBidIncrement),
      round_end_time: i.roundEndTime ? i.roundEndTime.toISOString() : null,
      gem_images: i.images.map(img => ({ image_url: img.imageUrl })),
      hasOfficialWinner: Boolean(i.winner),
      winner: i.winner ? {
        id: i.winner.id,
        winning_amount: Number(i.winner.winningAmount),
        selected_at: i.winner.selectedAt ? i.winner.selectedAt.toISOString() : undefined,
        user: {
          id: i.winner.user?.id,
          display_name: i.winner.user?.displayName || null,
          anonymous_name: i.winner.user?.anonymousName || null,
        },
      } : null,
    })),
    finishedCount: finishedItems.length,
    totalItems: items.length,
  })
}

export async function handleGemRegister(request: Request, response: Response, _auctionType: AuctionType) {
  const user = await getApiUser(request)
  if (!user) {
    jsonError(response, 401, 'Authentication required.')
    return
  }
  const auctionId = getId(request)
  const gemId = (request as any).params?.gemId as string
  if (!validId(auctionId) || !validId(gemId)) {
    jsonError(response, 400, 'Invalid auction or item ID.')
    return
  }
  const registration = await prisma.auctionRegistration.findUnique({
    where: { auctionId_userId: { auctionId, userId: user.id } },
    select: { id: true, approvalStatus: true, isActive: true },
  })
  const isRegistered = Boolean(registration && registration.approvalStatus === 'approved' && registration.isActive)
  response.json({ isRegistered, registration })
}

export async function handleGemBids(request: Request, response: Response, _auctionType: AuctionType) {
  const auctionId = getId(request)
  const gemId = (request as any).params?.gemId as string
  if (!validId(auctionId) || !validId(gemId)) {
    jsonError(response, 400, 'Invalid auction or item ID.')
    return
  }

  if (request.method === 'GET') {
    const bids = await prisma.bid.findMany({
      where: { gemId },
      include: { user: { select: { id: true, displayName: true, anonymousName: true } } },
      orderBy: [{ bidAmount: 'desc' }, { createdAt: 'desc' }],
    })
    const formatted = bids.map(b => ({
      id: b.id,
      gem_id: b.gemId,
      user_id: b.userId,
      bid_amount: Number(b.bidAmount),
      points_earned: b.pointsEarned,
      created_at: b.createdAt.toISOString(),
      user: {
        id: b.user.id,
        display_name: b.user.displayName,
        anonymous_name: b.user.anonymousName,
      },
    }))
    response.json({ bids: formatted })
    return
  }

  if (request.method === 'POST') {
    await placeBid(request, response, auctionId, gemId)
    return
  }

  if (request.method === 'PATCH') {
    const user = await getApiUser(request)
    if (!user) {
      jsonError(response, 401, 'Authentication required.')
      return
    }
    const gem = await prisma.gem.findFirst({
      where: { id: gemId, auctionId },
      include: { auction: true },
    })
    if (!gem || gem.status !== 'active') {
      jsonError(response, 400, 'Item not active for bidding.')
      return
    }
    if (gem.auction.auctionType !== 'tender_base_fixed_bid') {
      jsonError(response, 400, 'Bid editing is only available for tender/closed bid auctions.')
      return
    }
    const body = bodyOf(request)
    const amount = Number(body.bid_amount ?? body.amount)
    if (!Number.isFinite(amount) || amount < Number(gem.startingPrice)) {
      jsonError(response, 400, `Bid must be at least ${Number(gem.startingPrice)}.`)
      return
    }
    const existingBid = await prisma.bid.findFirst({
      where: { gemId, userId: user.id },
    })
    if (!existingBid) {
      jsonError(response, 404, 'No existing bid found to update.')
      return
    }
    const updated = await prisma.bid.update({
      where: { id: existingBid.id },
      data: { bidAmount: amount },
    })
    response.json({ success: true, bid: updated })
    return
  }

  response.status(405).json({ error: 'Method not allowed.' })
}
