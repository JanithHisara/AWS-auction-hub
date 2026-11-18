import { type Request, type Response } from 'express'
import prisma from '../../lib/prisma'

export async function GET(request: Request, response: Response) {
  try {
    const statusParam = typeof request.query.status === 'string' ? request.query.status : undefined
    const allowedStatuses = statusParam
      ? statusParam.split(',').map(s => s.trim()).filter(Boolean)
      : ['published', 'active', 'live', 'upcoming', 'registration_open', 'registration_closed']

    const auctions = await prisma.auction.findMany({
      where: { status: { in: allowedStatuses } },
      select: {
        id: true,
        name: true,
        description: true,
        auctionCode: true,
        bannerImageUrl: true,
        auctionType: true,
        status: true,
        publishedAt: true,
        registrationStart: true,
        registrationEnd: true,
        auctionStart: true,
        auctionEnd: true,
        maxParticipants: true,
        entryFee: true,
        _count: { select: { registrations: true, gems: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const formatted = auctions.map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      auction_code: a.auctionCode || null,
      banner_image_url: a.bannerImageUrl || null,
      auction_type: a.auctionType,
      status: a.status,
      published_at: a.publishedAt?.toISOString() || null,
      registration_start: a.registrationStart?.toISOString() || null,
      registration_end: a.registrationEnd?.toISOString() || null,
      auction_start: a.auctionStart?.toISOString() || null,
      start_time: a.auctionStart?.toISOString() || null,
      auction_end: a.auctionEnd?.toISOString() || null,
      max_participants: a.maxParticipants,
      entry_fee: Number(a.entryFee),
      items_count: a._count.gems,
      registered_count: a._count.registrations,
    }))

    response.json({
      total: formatted.length,
      auctions: formatted,
    })
  } catch (error) {
    console.error('Error fetching auctions:', error)
    response.status(500).json({ error: 'Failed to fetch auctions.' })
  }
}
