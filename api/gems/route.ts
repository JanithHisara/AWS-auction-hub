import { type Request, type Response } from 'express'
import prisma from '../../lib/prisma'
import { authorize, validId, jsonError, bodyOf, parsedDate, mapGem, PERMISSIONS } from '../admin/_auth'
import { broadcastEvent } from '../../lib/events'

export async function GET(request: Request, response: Response) {
  const auctionId = typeof request.query.auction_id === 'string' ? request.query.auction_id : undefined
  if (auctionId && !validId(auctionId)) {
    jsonError(response, 400, 'Invalid auction ID.')
    return
  }
  const gems = await prisma.gem.findMany({
    where: {
      ...(auctionId ? { auctionId } : {}),
      status: { in: ['active', 'live', 'current', 'published', 'sold'] },
      auction: { status: { in: ['published', 'active', 'live', 'upcoming'] } },
    },
    include: {
      images: { orderBy: { displayOrder: 'asc' } },
      certificates: true,
      winner: { select: { userId: true, winningAmount: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 250,
  })
  response.json({ gems: gems.map(mapGem) })
}

export async function POST(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.CREATE_ITEMS)
  if (!admin) return
  const body = bodyOf(request)
  if (!validId(body.auction_id) || typeof body.name !== 'string' || !body.name.trim()) {
    jsonError(response, 400, 'A valid auction ID and item name are required.')
    return
  }
  const startingPrice = Number(body.starting_price)
  if (!Number.isFinite(startingPrice) || startingPrice < 0) {
    jsonError(response, 400, 'A valid starting price is required.')
    return
  }
  const auction = await prisma.auction.findUnique({ where: { id: body.auction_id }, select: { id: true } })
  if (!auction) {
    jsonError(response, 404, 'Auction not found.')
    return
  }
  if (body.images !== undefined && !Array.isArray(body.images)) {
    jsonError(response, 400, 'Images must be provided as a list.')
    return
  }
  if (body.certificates !== undefined && !Array.isArray(body.certificates)) {
    jsonError(response, 400, 'Certificates must be provided as a list.')
    return
  }
  const caratWeight = body.carat_weight == null || body.carat_weight === ''
    ? null
    : Number(body.carat_weight)
  if (caratWeight !== null && (!Number.isFinite(caratWeight) || caratWeight < 0)) {
    jsonError(response, 400, 'Invalid carat weight.')
    return
  }
  const status = typeof body.status === 'string' ? body.status : 'draft'
  if (!['draft', 'pending', 'active', 'live', 'published'].includes(status)) {
    jsonError(response, 400, 'Invalid item status.')
    return
  }
  const mediaTypes = Array.isArray(body.media_types) ? body.media_types : []
  const images = (body.images ?? []).filter((url: unknown): url is string =>
    typeof url === 'string' && url.trim().length > 0
  ).map((url: string, index: number) => ({
    imageUrl: url.trim(),
    mediaType: ['image', 'gif', 'video'].includes(mediaTypes[index]) ? mediaTypes[index] : 'image',
    displayOrder: index,
  }))
  const certificates = (body.certificates ?? []).filter((certificate: unknown) =>
    certificate && typeof certificate === 'object' &&
    typeof (certificate as any).url === 'string' && (certificate as any).url.trim()
  ).map((certificate: any) => ({
    certificateUrl: certificate.url.trim(),
    certificateType: typeof certificate.type === 'string' && certificate.type.trim()
      ? certificate.type.trim()
      : null,
  }))
  const startTime = body.start_time == null || body.start_time === '' ? null : parsedDate(body.start_time)
  const endTime = body.end_time == null || body.end_time === '' ? null : parsedDate(body.end_time)
  if ((body.start_time && !startTime) || (body.end_time && !endTime)) {
    jsonError(response, 400, 'Invalid item start or end time.')
    return
  }
  const gem = await prisma.gem.create({
    data: {
      auctionId: body.auction_id,
      createdById: admin.id,
      name: body.name.trim(),
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      startingPrice,
      currentPrice: startingPrice,
      minBidIncrement: Number.isFinite(Number(body.min_bid_increment)) && Number(body.min_bid_increment) >= 0
        ? Number(body.min_bid_increment)
        : 100,
      incrementInterval: Number.isInteger(Number(body.increment_interval)) && Number(body.increment_interval) > 0
        ? Number(body.increment_interval)
        : 60,
      status,
      startTime,
      endTime,
      caratWeight,
      color: typeof body.color === 'string' ? body.color : null,
      provenance: typeof body.provenance === 'string' ? body.provenance : null,
      images: { create: images },
      certificates: { create: certificates },
    },
    include: { images: { orderBy: { displayOrder: 'asc' } }, certificates: true },
  })
  broadcastEvent({
    channel: `auction-${gem.auctionId}`,
    table: 'gems',
    eventType: 'INSERT',
    new: mapGem(gem),
  })
  response.status(201).json({ id: gem.id, gem: mapGem(gem) })
}
