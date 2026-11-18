import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import prisma from '../../lib/prisma'
import { ADMIN_ROLES, PERMISSIONS, type PermissionKey } from '../../lib/permissions'
import type { AuctionType } from '@prisma/client'
import { broadcastEvent } from '../../lib/events'

export const SESSION_COOKIE_NAME = 'auction_hub_session'
export const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

export { PERMISSIONS }

export interface ApiAdmin {
  id: string
  email: string
  role: string
  displayName?: string | null
  anonymousName?: string | null
  phone?: string | null
  permissions: Set<string>
}

export function getSessionToken(request: Request): string | null {
  const authHeader = request.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }

  const cookieHeader = request.headers.cookie
  if (!cookieHeader) return null

  const cookie = cookieHeader
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${SESSION_COOKIE_NAME}=`))

  if (!cookie) return null
  try {
    return decodeURIComponent(cookie.slice(SESSION_COOKIE_NAME.length + 1))
  } catch {
    return null
  }
}

export function validId(id: unknown): boolean {
  if (typeof id !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim())
}

export function jsonError(response: Response, status: number, message: string, code?: string) {
  response.status(status).json(code ? { error: message, code } : { error: message })
}

export function bodyOf(request: Request): Record<string, any> {
  return (request.body && typeof request.body === 'object' ? request.body : {}) as Record<string, any>
}

export function parsedDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export function getAuctionType(type: string): AuctionType | null {
  const norm = (type || '').toLowerCase()
  if (norm === 'incremental' || norm.includes('incremental')) return 'incremental_approval_auction'
  if (norm === 'progressive' || norm.includes('progressive')) return 'progressive_elimination_auction'
  if (norm === 'tender' || norm.includes('tender')) return 'tender_base_fixed_bid'
  return null
}

export function unavailable(response: Response, feature: string) {
  response.status(501).json({ error: `${feature} is not supported in this environment.` })
}

export function publicUser(user: {
  id: string
  email: string
  displayName?: string | null
  anonymousName?: string | null
  phone?: string | null
}) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.displayName || null,
    anonymous_name: user.anonymousName || null,
    phone: user.phone || null,
  }
}

export function mapRegistration(r: any) {
  return {
    id: r.id,
    auction_id: r.auctionId,
    user_id: r.userId,
    approval_status: r.approvalStatus,
    is_active: r.isActive,
    approved_at: r.approvedAt instanceof Date ? r.approvedAt.toISOString() : (r.approvedAt || null),
    created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt || null),
    updated_at: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : (r.updatedAt || null),
    user: r.user ? {
      id: r.user.id,
      email: r.user.email,
      display_name: r.user.displayName,
      anonymous_name: r.user.anonymousName,
      phone: r.user.phone,
    } : undefined,
  }
}

export function mapChatMessage(m: any) {
  return {
    id: m.id,
    conversation_id: m.conversationId,
    sender_id: m.senderId,
    sender_role: m.senderRole,
    content: m.content,
    created_at: m.createdAt instanceof Date ? m.createdAt.toISOString() : (m.createdAt || null),
    sender: m.sender ? {
      id: m.sender.id,
      display_name: m.sender.displayName,
      role: m.sender.role,
    } : undefined,
  }
}

export function mapConversation(c: any) {
  let unreadByAdmin = 0
  if (Array.isArray(c.messages) && c.messages.length > 0) {
    for (const msg of c.messages) {
      const isFromAdmin = ['super_admin', 'admin', 'moderator'].includes(msg.senderRole)
      if (isFromAdmin) break
      unreadByAdmin++
    }
  }

  let unreadByUser = 0
  if (Array.isArray(c.messages) && c.messages.length > 0) {
    for (const msg of c.messages) {
      const isFromUser = msg.senderRole === 'user'
      if (isFromUser) break
      unreadByUser++
    }
  }

  return {
    id: c.id,
    auction_id: c.auctionId,
    user_id: c.userId,
    assigned_admin_id: c.assignedAdminId || null,
    status: c.status,
    unread_by_admin: unreadByAdmin,
    unread_by_user: unreadByUser,
    created_at: c.createdAt instanceof Date ? c.createdAt.toISOString() : (c.createdAt || null),
    updated_at: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : (c.updatedAt || null),
    auction: c.auction ? {
      id: c.auction.id,
      name: c.auction.name,
      status: c.auction.status,
      auction_type: c.auction.auctionType,
    } : undefined,
    user: c.user ? {
      id: c.user.id,
      email: c.user.email,
      display_name: c.user.displayName,
    } : undefined,
    assigned_admin: c.assignedAdmin ? {
      id: c.assignedAdmin.id,
      email: c.assignedAdmin.email,
      display_name: c.assignedAdmin.displayName,
    } : null,
    last_message: c.messages && c.messages[0] ? mapChatMessage(c.messages[0]) : null,
  }
}

export function mapGem(g: any) {
  const roundEndTime = g.roundEndTime instanceof Date 
    ? g.roundEndTime.toISOString() 
    : (g.roundEndTime ?? g.round_end_time ?? null)
  const startingPrice = Number(g.startingPrice ?? g.starting_price ?? 0)
  const currentPrice = g.currentPrice !== null && g.currentPrice !== undefined 
    ? Number(g.currentPrice) 
    : (g.current_price !== null && g.current_price !== undefined ? Number(g.current_price) : startingPrice)
  const minBidIncrement = Number(g.minBidIncrement ?? g.min_bid_increment ?? 0)
  const incrementInterval = g.incrementInterval ?? g.increment_interval ?? 30
  const startTime = g.startTime instanceof Date ? g.startTime.toISOString() : (g.startTime ?? g.start_time ?? null)
  const endTime = g.endTime instanceof Date ? g.endTime.toISOString() : (g.endTime ?? g.end_time ?? null)
  const caratWeight = g.caratWeight !== null && g.caratWeight !== undefined 
    ? Number(g.caratWeight) 
    : (g.carat_weight !== null && g.carat_weight !== undefined ? Number(g.carat_weight) : null)
  const createdAt = g.createdAt instanceof Date ? g.createdAt.toISOString() : (g.createdAt ?? g.created_at ?? null)
  const auctionId = g.auctionId ?? g.auction_id

  const gemImages = (g.images || g.gem_images || []).map((img: any) => ({
    id: img.id,
    image_url: img.imageUrl || img.image_url,
    imageUrl: img.imageUrl || img.image_url,
    media_type: img.mediaType || img.media_type,
    mediaType: img.mediaType || img.media_type,
    display_order: img.displayOrder || img.display_order,
    displayOrder: img.displayOrder || img.display_order,
  }))

  const gemCertificates = (g.certificates || g.gem_certificates || []).map((cert: any) => ({
    id: cert.id,
    certificate_url: cert.certificateUrl || cert.certificate_url,
    certificateUrl: cert.certificateUrl || cert.certificate_url,
    certificate_type: cert.certificateType || cert.certificate_type,
    certificateType: cert.certificateType || cert.certificate_type,
  }))

  const winner = g.winner ? {
    user_id: g.winner.userId ?? g.winner.user_id,
    userId: g.winner.userId ?? g.winner.user_id,
    winning_amount: Number(g.winner.winningAmount ?? g.winner.winning_amount),
    winningAmount: Number(g.winner.winningAmount ?? g.winner.winning_amount),
  } : null

  return {
    id: g.id,
    auction_id: auctionId,
    auctionId: auctionId,
    name: g.name,
    description: g.description,
    starting_price: startingPrice,
    startingPrice: startingPrice,
    current_price: currentPrice,
    currentPrice: currentPrice,
    min_bid_increment: minBidIncrement,
    minBidIncrement: minBidIncrement,
    increment_interval: incrementInterval,
    incrementInterval: incrementInterval,
    status: g.status,
    start_time: startTime,
    startTime: startTime,
    end_time: endTime,
    endTime: endTime,
    round_end_time: roundEndTime,
    roundEndTime: roundEndTime,
    carat_weight: caratWeight,
    caratWeight: caratWeight,
    color: g.color || null,
    provenance: g.provenance || null,
    created_at: createdAt,
    createdAt: createdAt,
    gem_images: gemImages,
    images: gemImages,
    gem_certificates: gemCertificates,
    certificates: gemCertificates,
    winner,
  }
}

export async function auctionDetails(id: string) {
  const auction = await prisma.auction.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, email: true, displayName: true } },
      moderator: { select: { id: true, email: true, displayName: true } },
      gems: {
        include: { images: { orderBy: { displayOrder: 'asc' } }, certificates: true },
        orderBy: { createdAt: 'asc' },
      },
      registrations: {
        include: { user: { select: { id: true, email: true, displayName: true, anonymousName: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
      },
      bidderHolds: {
        where: { isActive: true },
        include: { user: { select: { id: true, email: true, displayName: true, anonymousName: true } } },
      },
    },
  })
  if (!auction) return null
  return {
    id: auction.id,
    name: auction.name,
    description: auction.description,
    auction_code: auction.auctionCode,
    banner_image_url: auction.bannerImageUrl,
    auction_type: auction.auctionType,
    status: auction.status,
    published_at: auction.publishedAt?.toISOString() || null,
    registration_start: auction.registrationStart?.toISOString() || null,
    registration_end: auction.registrationEnd?.toISOString() || null,
    auction_start: auction.auctionStart?.toISOString() || null,
    auction_end: auction.auctionEnd?.toISOString() || null,
    max_participants: auction.maxParticipants,
    entry_fee: Number(auction.entryFee),
    created_at: auction.createdAt.toISOString(),
    creator: auction.creator,
    moderator: auction.moderator,
    gems: auction.gems.map(mapGem),
    registrations: auction.registrations.map(mapRegistration),
    bidder_holds: auction.bidderHolds,
  }
}

export async function getApiUser(request: Request): Promise<ApiAdmin | null> {
  const token = getSessionToken(request)

  // 1. Path A: Browser Session Token (Web Users)
  if (token) {
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const session = await prisma.userSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: {
                  include: {
                    permissions: { include: { permission: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
      if (session) {
        await prisma.userSession.delete({ where: { id: session.id } }).catch(() => {})
      }
      return null
    }

    const email = session.user.email.toLowerCase()
    const role = SUPER_ADMIN_EMAILS.includes(email) ? 'super_admin' : session.user.role
    const permissions = new Set<string>(
      session.user.userRoles.flatMap(userRole =>
        userRole.role.permissions.map(({ permission }) => permission.key)
      )
    )

    if (role === 'super_admin') {
      Object.values(PERMISSIONS).forEach(key => permissions.add(key))
    } else if (role === 'admin') {
      Object.values(PERMISSIONS)
        .filter(key => key !== PERMISSIONS.MANAGE_PERMISSIONS)
        .forEach(key => permissions.add(key))
    } else if (role === 'moderator' && permissions.size === 0) {
      ;[
        PERMISSIONS.VIEW_DASHBOARD,
        PERMISSIONS.CREATE_AUCTIONS,
        PERMISSIONS.MANAGE_AUCTIONS,
        PERMISSIONS.CREATE_ITEMS,
        PERMISSIONS.MANAGE_ITEMS,
        PERMISSIONS.MANAGE_REGISTRATIONS,
        PERMISSIONS.CONTROL_BIDDING,
        PERMISSIONS.MANAGE_CHAT,
        PERMISSIONS.UPLOAD_FILES,
        PERMISSIONS.MANAGE_DEVICES,
      ].forEach(key => permissions.add(key))
    }

    return {
      id: session.user.id,
      email: session.user.email,
      role,
      displayName: session.user.displayName,
      anonymousName: session.user.anonymousName,
      phone: session.user.phone,
      permissions,
    }
  }

  // 2. Path B: Hardware NFC Card UID (ESP32 Device Users)
  const rawNfcUid = (request.headers['x-nfc-uid'] as string) || (request.body && request.body.nfc_uid)
  if (rawNfcUid) {
    const cleanUid = String(rawNfcUid).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    const cards = await prisma.nfcCard.findMany({
      where: { isActive: true },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: {
                  include: {
                    permissions: { include: { permission: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    const card = cards.find(c => c.nfcUid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanUid)
    if (!card || !card.user || !card.user.isActive) {
      return null
    }

    const email = card.user.email.toLowerCase()
    const role = SUPER_ADMIN_EMAILS.includes(email) ? 'super_admin' : card.user.role
    const permissions = new Set<string>(
      card.user.userRoles.flatMap(userRole =>
        userRole.role.permissions.map(({ permission }) => permission.key)
      )
    )

    if (role === 'super_admin') {
      Object.values(PERMISSIONS).forEach(key => permissions.add(key))
    } else if (role === 'admin') {
      Object.values(PERMISSIONS)
        .filter(key => key !== PERMISSIONS.MANAGE_PERMISSIONS)
        .forEach(key => permissions.add(key))
    }

    return {
      id: card.user.id,
      email: card.user.email,
      role,
      displayName: card.user.displayName,
      anonymousName: card.user.anonymousName,
      phone: card.user.phone,
      permissions,
    }
  }

  return null
}

export async function authorizeAdmin(
  request: Request,
  response: Response,
  permissionKey: string | string[]
): Promise<ApiAdmin | null> {
  const user = await getApiUser(request)
  if (!user) {
    response.status(401).json({ error: 'Authentication required.' })
    return null
  }

  if (!ADMIN_ROLES.includes(user.role as typeof ADMIN_ROLES[number])) {
    response.status(403).json({ error: 'Administrator access is required.' })
    return null
  }

  const hasPerm = Array.isArray(permissionKey)
    ? permissionKey.some(k => user.permissions.has(k))
    : user.permissions.has(permissionKey)

  if (!hasPerm) {
    response.status(403).json({ error: 'You do not have permission to perform this action.' })
    return null
  }

  return user
}

export async function authorize(
  request: Request,
  response: Response,
  permissionKey?: string | string[],
  allowAnyUser = false
): Promise<ApiAdmin | null> {
  const user = await getApiUser(request)
  if (!user) {
    response.status(401).json({ error: 'Authentication required.' })
    return null
  }

  if (allowAnyUser && !permissionKey) return user

  const isAdminRole = ADMIN_ROLES.includes(user.role as typeof ADMIN_ROLES[number])
  if (!isAdminRole && !allowAnyUser) {
    response.status(403).json({ error: 'Administrator access is required.' })
    return null
  }

  if (permissionKey) {
    const hasPerm = Array.isArray(permissionKey)
      ? permissionKey.some(k => user.permissions.has(k))
      : user.permissions.has(permissionKey)

    if (!hasPerm) {
      response.status(403).json({ error: 'You do not have permission to perform this action.' })
      return null
    }
  }

  return user
}

export async function placeBid(
  request: Request,
  response: Response,
  auctionId: string,
  gemId: string
): Promise<void> {
  const user = await getApiUser(request)
  if (!user) {
    jsonError(response, 401, 'Authentication required.')
    return
  }

  const activeHold = await prisma.bidderHold.findFirst({
    where: { auctionId, userId: user.id, isActive: true },
  })
  if (activeHold) {
    jsonError(response, 403, 'Your bidding is currently on hold. Please contact the auction administrator.')
    return
  }

  const body = bodyOf(request)

  try {
    const { bid, roundEndTime, broadcastPayload } = await prisma.$transaction(async (tx) => {
      // ── Exclusive Row Lock on gems table ──────────────────────────────────
      // Any concurrent request for this gem MUST wait here until this transaction commits.
      const lockedGems = await tx.$queryRaw<Array<{
        id: string;
        auction_id: string;
        status: string;
        starting_price: any;
        current_price: any;
        round_end_time: Date | null;
        auction_type: string;
        auction_status: string;
        auction_end: Date | null;
      }>>`
        SELECT g.id, g.auction_id, g.status, g.starting_price, g.current_price, 
               g.round_end_time, a.auction_type, a.status as auction_status, a.auction_end
        FROM gems g
        JOIN auctions a ON a.id = g.auction_id
        WHERE g.id = ${gemId}::uuid AND g.auction_id = ${auctionId}::uuid
        FOR UPDATE OF g
      `

      const gem = lockedGems && lockedGems.length > 0 ? lockedGems[0] : null
      if (!gem || gem.status !== 'active') {
        throw new Error('ITEM_NOT_ACTIVE')
      }

      const auctionType = gem.auction_type
      const now = new Date()
      let bidAmount: number

      if (auctionType === 'progressive_elimination_auction') {
        bidAmount = Number(gem.current_price ?? gem.starting_price)

        // 1. Check if another bidder already claimed this exact price under the lock
        const existingBid = await tx.bid.findFirst({
          where: { gemId, bidAmount },
        })
        if (existingBid) {
          if (existingBid.userId === user.id) {
            throw new Error('ALREADY_BID')
          } else {
            throw new Error('PRICE_CLAIMED')
          }
        }

        // 2. Check if the round timer naturally expired
        if (!gem.round_end_time || now >= gem.round_end_time) {
          throw new Error('ROUND_TIME_ENDED')
        }
      } else if (auctionType === 'incremental_approval_auction') {
        bidAmount = Number(gem.current_price ?? gem.starting_price)
        if (!gem.round_end_time || now >= gem.round_end_time) {
          throw new Error('ROUND_TIME_ENDED')
        }

        const elimination = await tx.gemElimination.findUnique({
          where: { gemId_userId: { gemId, userId: user.id } },
        })
        if (elimination) {
          throw new Error('USER_ELIMINATED')
        }

        const existingBid = await tx.bid.findFirst({
          where: { gemId, userId: user.id, bidAmount },
        })
        if (existingBid) {
          throw new Error('ALREADY_ACCEPTED')
        }
      } else {
        if (gem.auction_status !== 'live') {
          throw new Error('AUCTION_ENDED')
        }
        const end = gem.round_end_time || gem.auction_end
        if (end && now >= end) {
          throw new Error('TIME_ENDED')
        }

        const submittedAmount = Number(body.bid_amount ?? body.amount)
        if (!Number.isFinite(submittedAmount)) {
          throw new Error('INVALID_AMOUNT')
        }
        bidAmount = Math.round(submittedAmount * 100) / 100
        if (bidAmount < Number(gem.starting_price)) {
          throw new Error('AMOUNT_TOO_LOW')
        }

        const existingBid = await tx.bid.findFirst({
          where: { gemId, userId: user.id },
        })
        if (existingBid && auctionType !== 'tender_base_fixed_bid') {
          throw new Error('ALREADY_BID_ITEM')
        }
      }

      let newBid: any
      const existingBid = await tx.bid.findFirst({
        where: { gemId, userId: user.id },
      })

      if (existingBid && auctionType === 'tender_base_fixed_bid') {
        newBid = await tx.bid.update({
          where: { id: existingBid.id },
          data: { bidAmount },
          include: {
            user: { select: { id: true, displayName: true, anonymousName: true } },
          },
        })
      } else {
        newBid = await tx.bid.create({
          data: {
            gemId,
            userId: user.id,
            bidAmount,
          },
          include: {
            user: { select: { id: true, displayName: true, anonymousName: true } },
          },
        })
      }

      let updatedRoundEndTime = gem.round_end_time
      if (auctionType === 'progressive_elimination_auction') {
        updatedRoundEndTime = null
        await tx.gem.update({
          where: { id: gemId },
          data: { roundEndTime: null },
        })
      } else if (auctionType === 'incremental_approval_auction') {
        const registeredCount = await tx.auctionRegistration.count({
          where: { auctionId, approvalStatus: 'approved', isActive: true },
        })
        const eliminatedCount = await tx.gemElimination.count({
          where: { gemId },
        })
        const eligibleCount = Math.max(0, registeredCount - eliminatedCount)

        const currentTargetPrice = Number(gem.current_price ?? gem.starting_price)
        const approvedBidders = await tx.bid.findMany({
          where: {
            gemId,
            bidAmount: currentTargetPrice,
          },
          select: { userId: true },
          distinct: ['userId'],
        })

        if (eligibleCount > 0 && approvedBidders.length >= eligibleCount) {
          updatedRoundEndTime = null
          await tx.gem.update({
            where: { id: gemId },
            data: { roundEndTime: null },
          })
        }
      }

      return {
        bid: newBid,
        roundEndTime: updatedRoundEndTime,
        broadcastPayload: {
          id: newBid.id,
          gem_id: newBid.gemId,
          user_id: newBid.userId,
          bid_amount: Number(newBid.bidAmount),
          created_at: newBid.createdAt.toISOString(),
          user: newBid.user,
        },
      }
    }, {
      maxWait: 5000,
      timeout: 10000,
    })

    // ── Realtime Broadcasts (outside transaction) ───────────────────────────
    broadcastEvent({
      channel: `auction-${auctionId}`,
      table: 'bids',
      eventType: 'INSERT',
      new: broadcastPayload,
    })
    broadcastEvent({
      channel: `item-monitor-auction-${auctionId}`,
      table: 'bids',
      eventType: 'INSERT',
      new: broadcastPayload,
    })
    broadcastEvent({
      channel: `gem-${gemId}`,
      table: 'bids',
      eventType: 'INSERT',
      new: broadcastPayload,
    })
    broadcastEvent({
      channel: `bids:${gemId}`,
      table: 'bids',
      eventType: 'INSERT',
      new: broadcastPayload,
    })
    const gemUpdatePayload = {
      id: gemId,
      auction_id: auctionId,
      current_price: broadcastPayload.bid_amount,
      highest_bid: broadcastPayload.bid_amount,
      round_end_time: roundEndTime ? roundEndTime.toISOString() : null,
    }
    broadcastEvent({
      channel: `item-monitor-auction-${auctionId}`,
      table: 'gems',
      eventType: 'UPDATE',
      new: gemUpdatePayload,
    })
    broadcastEvent({
      channel: `auction-${auctionId}`,
      table: 'gems',
      eventType: 'UPDATE',
      new: gemUpdatePayload,
    })
    broadcastEvent({
      channel: `gem-${gemId}`,
      table: 'gems',
      eventType: 'UPDATE',
      new: gemUpdatePayload,
    })

    response.status(201).json({ success: true, bid: broadcastPayload })
  } catch (err: any) {
    if (err.message === 'PRICE_CLAIMED') {
      jsonError(response, 400, 'Another user has already claimed this price round.')
    } else if (err.message === 'ROUND_TIME_ENDED') {
      jsonError(response, 400, 'Bidding time has ended for this round.')
    } else if (err.message === 'ALREADY_BID') {
      jsonError(response, 400, 'You have already placed a bid for this price.')
    } else if (err.message === 'ITEM_NOT_ACTIVE') {
      jsonError(response, 400, 'Auction item is not active for bidding.')
    } else if (err.message === 'USER_ELIMINATED') {
      jsonError(response, 403, 'You have been eliminated from this auction item.')
    } else if (err.message === 'ALREADY_ACCEPTED') {
      jsonError(response, 400, 'You have already accepted this price.')
    } else if (err.message === 'AUCTION_ENDED') {
      jsonError(response, 400, 'Bidding has ended for this auction.')
    } else if (err.message === 'TIME_ENDED') {
      jsonError(response, 400, 'Bidding time has ended.')
    } else if (err.message === 'ALREADY_BID_ITEM') {
      jsonError(response, 400, 'You have already placed a bid for this item.')
    } else if (err.message === 'INVALID_AMOUNT') {
      jsonError(response, 400, 'A valid bid amount is required.')
    } else if (err.message === 'AMOUNT_TOO_LOW') {
      jsonError(response, 400, 'Bid amount is below the starting price.')
    } else {
      console.error('[PLACE_BID_ERR]', err)
      jsonError(response, 500, 'Failed to place bid.')
    }
  }
}
