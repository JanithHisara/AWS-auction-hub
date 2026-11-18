import { randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import type { AuctionType } from '@prisma/client'
import prisma from '../../../../lib/prisma'
import { PERMISSIONS } from '../../../../lib/permissions'
import { authorizeAdmin } from '../../_auth'
import { broadcastEvent } from '../../../../lib/events'

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function createProgressiveAuction(request: Request, response: Response) {
  try {
    const admin = await authorizeAdmin(request, response, PERMISSIONS.CREATE_AUCTIONS)
    if (!admin) return

    const body = request.body ?? {}
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const registrationStart = parseDate(body.registration_start)
    const registrationEnd = parseDate(body.registration_end)
    const auctionStart = parseDate(body.auction_start)
    const submittedAuctionEnd = parseDate(body.auction_end)
    const auctionEnd = submittedAuctionEnd ?? new Date('2099-12-31T23:59:59.000Z')
    const entryFee = Number(body.entry_fee ?? 0)
    const maxParticipants = body.max_participants === '' || body.max_participants == null
      ? null
      : Number(body.max_participants)
    const moderatorId = typeof body.moderator_id === 'string' && body.moderator_id
      ? body.moderator_id
      : null

    if (!name || name.length > 200 ||
      typeof body.password !== 'string' || !/^\d{4}$/.test(body.password) ||
      !registrationStart || !registrationEnd || !auctionStart ||
      !Number.isFinite(entryFee) || entryFee < 0 ||
      (maxParticipants !== null && (!Number.isInteger(maxParticipants) || maxParticipants < 1))) {
      response.status(400).json({ error: 'Please provide valid progressive auction details.' })
      return
    }

    const now = new Date(Date.now() - 60000)
    if (registrationStart <= now || registrationEnd <= now ||
      auctionStart <= now ) {
      response.status(400).json({ error: 'Auction dates must be in the future.' })
      return
    }
    if (registrationEnd <= registrationStart || auctionStart <= registrationEnd) {
      response.status(400).json({ error: 'Auction dates are not in the correct order.' })
      return
    }
    if (submittedAuctionEnd && (submittedAuctionEnd <= now || submittedAuctionEnd <= auctionStart)) {
      response.status(400).json({ error: 'Auction end time must be after auction start time.' })
      return
    }

    const duplicate = await prisma.auction.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    })
    if (duplicate) {
      response.status(409).json({ error: 'An auction with this name already exists. Please choose a different name.' })
      return
    }

    if (moderatorId) {
      const moderator = await prisma.user.findFirst({
        where: { id: moderatorId, role: { in: ['moderator', 'admin', 'super_admin'] }, isActive: true },
        select: { id: true },
      })
      if (!moderator) {
        response.status(400).json({ error: 'The selected moderator is not available.' })
        return
      }
    }

    const auction = await prisma.auction.create({
      data: {
        createdById: admin.id,
        moderatorId,
        name,
        description: typeof body.description === 'string' && body.description.trim()
          ? body.description.trim()
          : null,
        auctionCode: `AUC-${randomBytes(5).toString('hex').toUpperCase()}`,
        bannerImageUrl: typeof body.banner_image_url === 'string' && body.banner_image_url.trim()
          ? body.banner_image_url.trim()
          : null,
        passwordHash: await bcrypt.hash(body.password, 10),
        auctionType: 'progressive_elimination_auction' as AuctionType,
        status: 'draft',
        publishedAt: null,
        registrationStart,
        registrationEnd,
        auctionStart,
        auctionEnd,
        maxParticipants,
        entryFee,
      },
      select: { id: true, name: true, auctionCode: true, auctionType: true, status: true },
    })

    broadcastEvent({
      channel: 'public-auctions',
      table: 'auctions',
      eventType: 'INSERT',
      new: auction,
    })
    broadcastEvent({
      channel: 'admin-auctions',
      table: 'auctions',
      eventType: 'INSERT',
      new: auction,
    })

    response.status(201).json({
      auction: {
        id: auction.id,
        name: auction.name,
        auction_code: auction.auctionCode,
        auction_type: auction.auctionType,
        status: auction.status,
      },
    })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      response.status(409).json({ error: 'Could not generate a unique auction code. Please try again.' })
      return
    }
    console.error('Failed to create progressive auction:', error)
    response.status(500).json({ error: 'Failed to create progressive auction.' })
  }
}
