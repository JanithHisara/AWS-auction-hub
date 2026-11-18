import { type Request, type Response } from 'express'
import prisma from '../../../lib/prisma'
import { authorize, validId, jsonError, bodyOf, parsedDate, mapGem, getApiUser, placeBid, PERMISSIONS } from '../../admin/_auth'
import { broadcastEvent } from '../../../lib/events'

export async function GET(request: Request, response: Response) {
  const gemId = (request as any).params?.id
  if (!validId(gemId)) {
    jsonError(response, 400, 'Invalid item ID.')
    return
  }
  const gem = await prisma.gem.findFirst({
    where: {
      id: gemId,
      auction: { status: { in: ['published', 'active', 'live', 'upcoming'] } },
    },
    include: { images: { orderBy: { displayOrder: 'asc' } }, certificates: true },
  })
  if (!gem || !['active', 'live', 'current', 'published', 'sold'].includes(gem.status)) {
    jsonError(response, 404, 'Item not found.')
  } else response.json({ id: gem.id, gem: mapGem(gem) })
}

export async function PUT(request: Request, response: Response) {
  if (!await authorize(request, response, PERMISSIONS.MANAGE_ITEMS)) return
  const gemId = (request as any).params?.id
  if (!validId(gemId)) {
    jsonError(response, 400, 'Invalid item ID.')
    return
  }
  const existing = await prisma.gem.findUnique({ where: { id: gemId }, select: { id: true } })
  if (!existing) {
    jsonError(response, 404, 'Item not found.')
    return
  }
  const body = bodyOf(request)
  const data: Record<string, any> = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (typeof body.description === 'string' || body.description === null) data.description = body.description
  if (typeof body.status === 'string') {
    if (!['draft', 'pending', 'active', 'live', 'published', 'completed', 'sold'].includes(body.status)) {
      jsonError(response, 400, 'Invalid item status.')
      return
    }
    data.status = body.status
  }
  for (const [key, column] of [
    ['starting_price', 'startingPrice'], ['current_price', 'currentPrice'],
    ['min_bid_increment', 'minBidIncrement'], ['carat_weight', 'caratWeight'],
  ]) {
    if (body[key] !== undefined) {
      const n = Number(body[key])
      if (!Number.isFinite(n) || n < 0) {
        jsonError(response, 400, `Invalid ${key}.`)
        return
      }
      data[column] = n
    }
  }
  if (body.start_time !== undefined) {
    const startTime = body.start_time === null || body.start_time === '' ? null : parsedDate(body.start_time)
    if (body.start_time && !startTime) {
      jsonError(response, 400, 'Invalid item start time.')
      return
    }
    data.startTime = startTime
  }
  if (body.end_time !== undefined) {
    const endTime = body.end_time === null || body.end_time === '' ? null : parsedDate(body.end_time)
    if (body.end_time && !endTime) {
      jsonError(response, 400, 'Invalid item end time.')
      return
    }
    data.endTime = endTime
  }
  if (typeof body.color === 'string' || body.color === null) data.color = body.color
  if (typeof body.provenance === 'string' || body.provenance === null) data.provenance = body.provenance
  if (body.images !== undefined && !Array.isArray(body.images)) {
    jsonError(response, 400, 'Images must be provided as a list.')
    return
  }
  if (body.certificates !== undefined && !Array.isArray(body.certificates)) {
    jsonError(response, 400, 'Certificates must be provided as a list.')
    return
  }
  if (Array.isArray(body.images)) {
    const mediaTypes = Array.isArray(body.media_types) ? body.media_types : []
    data.images = {
      deleteMany: {},
      create: body.images.filter((url: unknown): url is string =>
        typeof url === 'string' && url.trim().length > 0
      ).map((url: string, index: number) => ({
        imageUrl: url.trim(),
        mediaType: ['image', 'gif', 'video'].includes(mediaTypes[index]) ? mediaTypes[index] : 'image',
        displayOrder: index,
      })),
    }
  }
  if (Array.isArray(body.certificates)) {
    data.certificates = {
      deleteMany: {},
      create: body.certificates.filter((certificate: unknown) =>
        certificate && typeof certificate === 'object' &&
        typeof (certificate as any).url === 'string' && (certificate as any).url.trim()
      ).map((certificate: any) => ({
        certificateUrl: certificate.url.trim(),
        certificateType: typeof certificate.type === 'string' && certificate.type.trim()
          ? certificate.type.trim()
          : null,
      })),
    }
  }
  const gem = await prisma.gem.update({
    where: { id: gemId },
    data,
    include: { images: { orderBy: { displayOrder: 'asc' } }, certificates: true },
  })
  broadcastEvent({
    channel: `auction-${gem.auctionId}`,
    table: 'gems',
    eventType: 'UPDATE',
    new: mapGem(gem),
  })
  broadcastEvent({
    channel: `gem-${gem.id}`,
    table: 'gems',
    eventType: 'UPDATE',
    new: mapGem(gem),
  })
  response.json({ id: gem.id, gem: mapGem(gem) })
}

export async function PATCH(request: Request, response: Response) {
  return PUT(request, response)
}

export async function DELETE(request: Request, response: Response) {
  if (!await authorize(request, response, PERMISSIONS.MANAGE_ITEMS)) return
  const gemId = (request as any).params?.id
  if (!validId(gemId)) {
    jsonError(response, 400, 'Invalid item ID.')
    return
  }
  const existing = await prisma.gem.findUnique({ where: { id: gemId }, select: { id: true, auctionId: true } })
  if (!existing) {
    jsonError(response, 404, 'Item not found.')
    return
  }
  await prisma.gem.delete({ where: { id: gemId } })
  broadcastEvent({
    channel: `auction-${existing.auctionId}`,
    table: 'gems',
    eventType: 'DELETE',
    old: { id: gemId, auction_id: existing.auctionId },
  })
  broadcastEvent({
    channel: `gem-${gemId}`,
    table: 'gems',
    eventType: 'DELETE',
    old: { id: gemId },
  })
  response.json({ success: true })
}
