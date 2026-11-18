import { type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../../../../lib/prisma'
import { broadcastEvent } from '../../../../lib/events'
import { authorize, validId, jsonError, bodyOf, auctionDetails, PERMISSIONS } from '../../_auth'

function getId(request: Request): string {
  const param = (request as any).params?.id
  return (Array.isArray(param) ? param[0] : param) || ''
}

export async function GET(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.MANAGE_AUCTIONS)
  if (!admin) return
  const id = getId(request)
  if (!validId(id)) { jsonError(response, 400, 'Invalid auction ID.'); return }
  const auction = await auctionDetails(id)
  if (!auction) jsonError(response, 404, 'Auction not found.')
  else response.json({ ...auction, auction })
}

export async function PATCH(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.MANAGE_AUCTIONS)
  if (!admin) return
  const id = getId(request)
  if (!validId(id)) { jsonError(response, 400, 'Invalid auction ID.'); return }
  const auction = await prisma.auction.findUnique({ where: { id } })
  if (!auction) { jsonError(response, 404, 'Auction not found.'); return }
  const body = bodyOf(request)
  const data: Record<string, any> = {}

  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (typeof body.description === 'string' || body.description === null) data.description = body.description
  if (typeof body.status === 'string' && ['draft', 'upcoming', 'registration_open', 'registration_closed', 'published', 'active', 'live', 'completed', 'cancelled', 'ended'].includes(body.status)) {
    data.status = body.status
    data.publishedAt = ['published', 'active', 'live', 'registration_open'].includes(body.status) ? new Date() : auction.publishedAt
  }
  if (typeof body.banner_image_url === 'string' || body.banner_image_url === null) {
    data.bannerImageUrl = body.banner_image_url
  }
  if (typeof body.password === 'string' && /^\d{4}$/.test(body.password)) {
    data.passwordHash = await bcrypt.hash(body.password, 10)
  }
  if (body.moderator_id !== undefined) {
    const rawModeratorId = typeof body.moderator_id === 'string' ? body.moderator_id.trim() : body.moderator_id
    if (!rawModeratorId || rawModeratorId === 'none' || rawModeratorId === 'null') {
      data.moderatorId = null
    } else if (validId(rawModeratorId)) {
      const moderator = await prisma.user.findFirst({
        where: { id: rawModeratorId, role: { in: ['moderator', 'admin', 'super_admin'] }, isActive: true },
        select: { id: true },
      })
      if (!moderator) { jsonError(response, 400, 'The selected moderator is not available.'); return }
      data.moderatorId = rawModeratorId
    } else {
      jsonError(response, 400, 'Invalid moderator ID.'); return
    }
  }
  for (const [source, target] of [
    ['registration_start', 'registrationStart'], ['registration_end', 'registrationEnd'],
    ['auction_start', 'auctionStart'], ['auction_end', 'auctionEnd'],
  ] as const) {
    if (body[source] !== undefined) {
      const date = new Date(body[source])
      if (isNaN(date.getTime())) { jsonError(response, 400, `Invalid ${source}.`); return }
      data[target] = date
    }
  }
  if (body.entry_fee !== undefined) {
    const entryFee = Number(body.entry_fee)
    if (!Number.isFinite(entryFee) || entryFee < 0) { jsonError(response, 400, 'Invalid entry fee.'); return }
    data.entryFee = entryFee
  }
  if (body.max_participants !== undefined) {
    data.maxParticipants = body.max_participants === '' || body.max_participants === null
      ? null
      : Number(body.max_participants)
  }

  const updated = await prisma.auction.update({ where: { id }, data, select: { id: true, name: true, status: true } })
  broadcastEvent({
    channel: `auction-${id}`,
    table: 'auctions',
    eventType: 'UPDATE',
    new: updated,
  })
  broadcastEvent({
    channel: 'public-auctions',
    table: 'auctions',
    eventType: 'UPDATE',
    new: updated,
  })
  broadcastEvent({
    channel: 'admin-auctions',
    table: 'auctions',
    eventType: 'UPDATE',
    new: updated,
  })
  response.json({ ...updated, auction: updated })
}

export async function PUT(request: Request, response: Response) {
  return PATCH(request, response)
}

export async function DELETE(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.MANAGE_AUCTIONS)
  if (!admin) return
  const id = getId(request)
  if (!validId(id)) { jsonError(response, 400, 'Invalid auction ID.'); return }
  await prisma.auction.delete({ where: { id } })
  broadcastEvent({
    channel: `auction-${id}`,
    table: 'auctions',
    eventType: 'DELETE',
    old: { id },
  })
  broadcastEvent({
    channel: 'public-auctions',
    table: 'auctions',
    eventType: 'DELETE',
    old: { id },
  })
  broadcastEvent({
    channel: 'admin-auctions',
    table: 'auctions',
    eventType: 'DELETE',
    old: { id },
  })
  response.json({ success: true })
}
