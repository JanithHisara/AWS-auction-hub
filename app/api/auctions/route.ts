import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')

    // Default to only 'registration_closed' and 'live' auctions
    const allowedStatuses = statusParam
      ? statusParam.split(',').map((s) => s.trim())
      : ['registration_closed', 'live']

    const auctions = await prisma.auction.findMany({
      where: {
        status: { in: allowedStatuses },
      },
      select: {
        id: true,
        name: true,
        auctionCode: true,
        password: true,
        auctionStart: true,
        status: true,
        auctionType: true,
      },
      orderBy: {
        auctionStart: 'desc',
      },
    })

    const formatted = auctions.map((a) => ({
      id: a.id,
      name: a.name,
      auction_code: a.auctionCode || null,
      password: a.password || null,
      start_time: a.auctionStart ? a.auctionStart.toISOString() : null,
      status: a.status,
      auction_type: a.auctionType,
    }))

    return NextResponse.json({
      total: formatted.length,
      auctions: formatted,
    })
  } catch (error: any) {
    console.error('Error fetching public auctions:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
