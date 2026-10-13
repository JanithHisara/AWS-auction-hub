import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // 1. Process automated schedule transitions on demand
    const now = new Date()
    try {
      await prisma.auction.updateMany({
        where: {
          status: 'upcoming',
          registrationStart: { lte: now },
          registrationEnd: { gt: now },
        },
        data: { status: 'registration_open' },
      })

      await prisma.auction.updateMany({
        where: {
          status: 'registration_open',
          registrationEnd: { lte: now },
        },
        data: { status: 'registration_closed' },
      })

      await prisma.auction.updateMany({
        where: {
          status: { in: ['registration_open', 'upcoming'] },
          auctionStart: { lte: now },
          auctionEnd: { gt: now },
        },
        data: { status: 'live' },
      })

      await prisma.auction.updateMany({
        where: {
          status: 'live',
          auctionEnd: { lte: now },
        },
        data: { status: 'ended' },
      })

      try {
        await prisma.chatConversation.deleteMany({
          where: {
            auction: {
              status: { in: ['ended', 'completed'] }
            }
          }
        })
      } catch (err) {
        console.error('Failed to cleanup ended auction chat in sync:', err)
      }
    } catch (schedErr) {
      console.error('Schedule processing error in sync route:', schedErr)
    }

    // 2. Fetch system states to construct a comprehensive real-time fingerprint
    const [
      auctions,
      totalBids,
      latestBid,
      totalRegs,
      pendingRegs,
      approvedRegs,
      gems,
      activeHolds,
      winnersCount,
      userRegs,
    ] = await Promise.all([
      prisma.auction.findMany({
        select: { id: true, status: true },
      }),
      prisma.bid.count(),
      prisma.bid.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true, bidAmount: true },
      }),
      prisma.auctionRegistration.count(),
      prisma.auctionRegistration.count({
        where: { approvalStatus: 'pending' },
      }),
      prisma.auctionRegistration.count({
        where: { approvalStatus: 'approved' },
      }),
      prisma.gem.findMany({
        select: { id: true, status: true, currentPrice: true, roundEndTime: true },
      }),
      prisma.bidderHold.count({
        where: { isActive: true },
      }),
      prisma.auctionWinner.count(),
      userId
        ? prisma.auctionRegistration.findMany({
            where: { userId },
            select: { auctionId: true, approvalStatus: true },
          })
        : Promise.resolve([]),
    ])

    const liveCount = auctions.filter(a => a.status === 'live').length
    const auctionStr = auctions
      .map(a => `${a.id}:${a.status}`)
      .sort()
      .join(',')

    const gemStr = gems
      .map(g => `${g.id}:${g.status}:${g.currentPrice || 0}:${g.roundEndTime?.toISOString() || ''}`)
      .sort()
      .join(',')

    const userRegStr = userRegs
      .map(r => `${r.auctionId}:${r.approvalStatus}`)
      .sort()
      .join(',')

    const fingerprint = [
      liveCount,
      auctionStr,
      gemStr,
      totalBids,
      latestBid ? `${latestBid.id}:${latestBid.bidAmount}` : 'no-bids',
      totalRegs,
      pendingRegs,
      approvedRegs,
      activeHolds,
      winnersCount,
      userRegStr,
    ].join('|')

    return NextResponse.json({
      ok: true,
      liveCount,
      fingerprint,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Sync failed' },
      { status: 500 }
    )
  }
}
