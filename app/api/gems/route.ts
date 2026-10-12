import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { broadcastEvent } from '@/lib/events'

// GET /api/gems - Get gems from AWS Aurora PostgreSQL
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const auctionId = searchParams.get('auction_id')

    const where: any = {}
    if (status) where.status = status
    if (auctionId) where.auctionId = auctionId

    const gems = await prisma.gem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        certificates: true,
      },
    })

    const formatted = gems.map(g => ({
      id: g.id,
      auction_id: g.auctionId,
      admin_id: g.adminId,
      moderator_id: g.moderatorId,
      name: g.name,
      description: g.description,
      starting_price: Number(g.startingPrice),
      min_bid_increment: Number(g.minBidIncrement),
      current_price: g.currentPrice ? Number(g.currentPrice) : Number(g.startingPrice),
      start_time: g.startTime.toISOString(),
      end_time: g.endTime.toISOString(),
      round_end_time: g.roundEndTime ? g.roundEndTime.toISOString() : null,
      increment_interval: g.incrementInterval,
      status: g.status,
      carat_weight: g.caratWeight ? Number(g.caratWeight) : null,
      cut: g.cut,
      color: g.color,
      clarity: g.clarity,
      provenance: g.provenance,
      created_at: g.createdAt.toISOString(),
      published_at: g.publishedAt ? g.publishedAt.toISOString() : null,
      images: g.images.map(img => ({
        id: img.id,
        gem_id: img.gemId,
        image_url: img.imageUrl,
        display_order: img.displayOrder,
        media_type: img.mediaType,
        created_at: img.createdAt.toISOString(),
      })),
      gem_images: g.images.map(img => ({
        id: img.id,
        gem_id: img.gemId,
        image_url: img.imageUrl,
        display_order: img.displayOrder,
        media_type: img.mediaType,
        created_at: img.createdAt.toISOString(),
      })),
      certificates: g.certificates.map(cert => ({
        id: cert.id,
        gem_id: cert.gemId,
        certificate_url: cert.certificateUrl,
        certificate_type: cert.certificateType,
        created_at: cert.createdAt.toISOString(),
      })),
    }))

    return NextResponse.json(formatted)
  } catch (error: any) {
    console.error('Error fetching gems from AWS Aurora:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch gems' }, { status: 500 })
  }
}

// POST /api/gems - Create a new gem in AWS Aurora PostgreSQL
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    const newGem = await prisma.gem.create({
      data: {
        adminId: user.id,
        auctionId: body.auction_id || null,
        name: body.name,
        description: body.description,
        startingPrice: body.starting_price,
        minBidIncrement: body.min_bid_increment,
        currentPrice: body.starting_price,
        startTime: new Date(body.start_time),
        endTime: new Date(body.end_time),
        status: body.status || 'draft',
        caratWeight: body.carat_weight ? Number(body.carat_weight) : null,
        cut: body.cut || null,
        color: body.color || null,
        clarity: body.clarity || null,
        provenance: body.provenance || null,
      },
    })

    if (body.images && Array.isArray(body.images) && body.images.length > 0) {
      const mediaTypes: string[] = body.media_types || []
      await prisma.gemImage.createMany({
        data: body.images.map((url: string, index: number) => ({
          gemId: newGem.id,
          imageUrl: url,
          displayOrder: index,
          mediaType: mediaTypes[index] || 'image',
        })),
      })
    }

    if (body.certificates && Array.isArray(body.certificates) && body.certificates.length > 0) {
      await prisma.gemCertificate.createMany({
        data: body.certificates.map((cert: { url: string; type?: string }) => ({
          gemId: newGem.id,
          certificateUrl: cert.url,
          certificateType: cert.type || null,
        })),
      })
    }

    const created = {
      id: newGem.id,
      auction_id: newGem.auctionId,
      admin_id: newGem.adminId,
      name: newGem.name,
      description: newGem.description,
      starting_price: Number(newGem.startingPrice),
      min_bid_increment: Number(newGem.minBidIncrement),
      start_time: newGem.startTime.toISOString(),
      end_time: newGem.endTime.toISOString(),
      status: newGem.status,
      created_at: newGem.createdAt.toISOString(),
    }

    broadcastEvent({
      channel: 'gems',
      table: 'gems',
      eventType: 'INSERT',
      new: created,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error('Error creating gem in AWS Aurora:', error)
    return NextResponse.json({ error: error.message || 'Failed to create gem' }, { status: 500 })
  }
}
