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
          status: { in: ['registration_closed', 'upcoming'] },
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
    } catch (schedErr) {
      console.error('Schedule processing error in sync route:', schedErr)
    }

    // 2. Fetch minimal states to construct the system state fingerprint
    const [auctions, latestBid, regCount, activeGems, userRegs] = await Promise.all([
      prisma.auction.findMany({
        select: { id: true, status: true },
      }),
      prisma.bid.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      }),
      prisma.auctionRegistration.count({
        where: { approvalStatus: 'approved' },
      }),
      prisma.gem.count({
        where: { status: 'active' },
      }),
      userId
        ? prisma.auctionRegistration.findMany({
            where: { userId },
            select: { auctionId: true, approvalStatus: true },
          })
        : Promise.resolve([]),
    ])

    const liveCount = auctions.filter(a => a.status === 'live').length
    const auctionStatusStr = auctions
      .map(a => `${a.id}:${a.status}`)
      .sort()
      .join(',')

    const userRegStr = userRegs
      .map(r => `${r.auctionId}:${r.approvalStatus}`)
      .sort()
      .join(',')

    const fingerprint = `${liveCount}|${auctionStatusStr}|${latestBid?.id || ''}|${regCount}|${activeGems}|${userRegStr}`

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
