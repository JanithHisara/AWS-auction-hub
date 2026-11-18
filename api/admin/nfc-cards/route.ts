import type { Request, Response } from 'express'
import prisma from '../../../lib/prisma'
import { PERMISSIONS } from '../../../lib/permissions'
import { authorizeAdmin } from '../_auth'
import { broadcastEvent } from '../../../lib/events'

const cardSelect = {
  id: true,
  nfcUid: true,
  userId: true,
  isActive: true,
  label: true,
  type: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true, displayName: true } },
  createdBy: { select: { email: true, displayName: true } },
} as const

function toNfcCard(card: {
  id: string; nfcUid: string; userId: string; isActive: boolean; label: string | null
  type: string; createdAt: Date; updatedAt: Date
  user: { id: string; email: string; displayName: string | null }
  createdBy: { email: string; displayName: string | null } | null
}) {
  return {
    id: card.id,
    nfc_uid: card.nfcUid,
    user_id: card.userId,
    is_active: card.isActive,
    label: card.label,
    nfc_type: card.type,
    created_at: card.createdAt,
    updated_at: card.updatedAt,
    users: { id: card.user.id, email: card.user.email, display_name: card.user.displayName },
    created_by_user: card.createdBy
      ? { email: card.createdBy.email, display_name: card.createdBy.displayName }
      : null,
  }
}

export async function getNfcCards(request: Request, response: Response) {
  try {
    if (!await authorizeAdmin(request, response, PERMISSIONS.MANAGE_DEVICES)) return

    const page = Math.max(1, Number(request.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 20))
    const search = typeof request.query.search === 'string' ? request.query.search.trim() : ''
    const status = request.query.status === 'active' || request.query.status === 'inactive'
      ? request.query.status
      : ''
    const type: 'temporary' | 'permanent' =
      request.query.nfc_type === 'temporary' ? 'temporary' : 'permanent'
    const where = {
      type,
      ...(status ? { isActive: status === 'active' } : {}),
      ...(search ? {
        OR: [
          { nfcUid: { contains: search, mode: 'insensitive' as const } },
          { label: { contains: search, mode: 'insensitive' as const } },
          { user: { email: { contains: search, mode: 'insensitive' as const } } },
          { user: { displayName: { contains: search, mode: 'insensitive' as const } } },
        ],
      } : {}),
    }

    const [cards, total] = await prisma.$transaction([
      prisma.nfcCard.findMany({
        where,
        select: cardSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.nfcCard.count({ where }),
    ])

    response.json({
      nfcCards: cards.map(toNfcCard),
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    })
  } catch (error) {
    console.error('Failed to load NFC cards:', error)
    response.status(500).json({ error: 'Failed to load NFC cards.' })
  }
}

export async function createNfcCard(request: Request, response: Response) {
  try {
    const admin = await authorizeAdmin(request, response, PERMISSIONS.MANAGE_DEVICES)
    if (!admin) return

    const { nfc_uid: uid, user_id: userId, label, nfc_type: type, auction_id: auctionId } = request.body ?? {}
    if (typeof uid !== 'string' || !uid.trim() || typeof userId !== 'string' ||
      !['permanent', 'temporary'].includes(type)) {
      response.status(400).json({ error: 'NFC UID, user, and a valid card type are required.' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) {
      response.status(400).json({ error: 'The selected user does not exist.' })
      return
    }
    if (auctionId !== undefined && auctionId !== null && typeof auctionId !== 'string') {
      response.status(400).json({ error: 'Invalid auction ID.' })
      return
    }

    const card = await prisma.nfcCard.create({
      data: {
        nfcUid: uid.trim(),
        userId,
        type,
        label: typeof label === 'string' && label.trim() ? label.trim() : null,
        auctionId: typeof auctionId === 'string' && auctionId ? auctionId : null,
        createdById: admin.id,
      },
      select: cardSelect,
    })
    const formatted = toNfcCard(card)
    broadcastEvent({
      channel: 'admin-nfc',
      table: 'nfc_cards',
      eventType: 'INSERT',
      new: formatted,
    })
    response.status(201).json({ nfcCard: formatted })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      response.status(409).json({ error: 'An NFC card with this UID already exists.' })
      return
    }
    console.error('Failed to create NFC card:', error)
    response.status(500).json({ error: 'Failed to create NFC card.' })
  }
}
