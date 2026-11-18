import { type Request, type Response } from 'express'
import prisma from '../../lib/prisma'
import { authorize, validId, jsonError, PERMISSIONS, getApiUser } from '../admin/_auth'
import { realtimeEmitter } from '../../lib/events'

export async function GET(request: Request, response: Response) {
  const channel = typeof request.query.channel === 'string' ? request.query.channel.trim() : ''
  if (!channel || channel.length > 200) {
    jsonError(response, 400, 'A valid realtime channel is required.')
    return
  }

  // 1. Public channels (Home page, public auction catalog) - guest visitors or authenticated users allowed
  const isPublicChannel = channel === 'public-auctions' || channel === 'auctions' || channel === 'home-auctions'

  let user: any = null
  if (!isPublicChannel) {
    user = await authorize(request, response, undefined, true)
    if (!user) return
  } else {
    // Optional user session for public channel
    user = await getApiUser(request).catch(() => null)
  }

  // 2. Admin broadcast channels
  const isAdminChannel = [
    'admin-all',
    'admin-auctions',
    'admin-approvals',
    'admin-users',
    'admin-nfc',
  ].includes(channel)

  if (isAdminChannel) {
    const isAdmin = user && (
      ['admin', 'super_admin', 'moderator'].includes(user.role) ||
      user.permissions.has(PERMISSIONS.VIEW_DASHBOARD) ||
      user.permissions.has(PERMISSIONS.MANAGE_AUCTIONS) ||
      user.permissions.has(PERMISSIONS.MANAGE_REGISTRATIONS) ||
      user.permissions.has(PERMISSIONS.MANAGE_USERS) ||
      user.permissions.has(PERMISSIONS.MANAGE_DEVICES)
    )
    if (!isAdmin) {
      jsonError(response, 403, 'Administrator access is required for admin channels.')
      return
    }
  } else if (channel.startsWith('my-auctions-') || channel.startsWith('my-bids-') || channel.startsWith('user-')) {
    // 3. User private channels
    const targetUserId = channel.replace(/^(my-auctions-|my-bids-|user-)/, '')
    if (user.id !== targetUserId && !['admin', 'super_admin'].includes(user.role)) {
      jsonError(response, 403, 'You may only subscribe to your own real-time updates.')
      return
    }
  } else if (channel.startsWith('chat-msgs-')) {
    // 4. Chat conversation channel
    const conversationId = channel.slice('chat-msgs-'.length)
    const conversation = validId(conversationId)
      ? await prisma.chatConversation.findUnique({ where: { id: conversationId }, select: { userId: true } })
      : null
    if (!conversation || (conversation.userId !== user.id && !user.permissions.has(PERMISSIONS.MANAGE_CHAT))) {
      jsonError(response, 403, 'You may not subscribe to this conversation.')
      return
    }
  } else if (!isPublicChannel) {
    // 5. Auction or Gem channel with UUID
    const ids = channel.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/ig) || []
    const isGemChannel = channel.startsWith('gem-') || channel.startsWith('bids:') || channel.startsWith('gem_updates:')
    const gem = isGemChannel && ids[0]
      ? await prisma.gem.findUnique({ where: { id: ids[0] }, select: { auctionId: true } })
      : null
    const auctionId = gem?.auctionId ?? ids[0]

    if (auctionId && validId(auctionId)) {
      const auction = await prisma.auction.findUnique({
        where: { id: auctionId },
        select: { status: true },
      })

      if (auction) {
        const canManage = ['admin', 'super_admin', 'moderator'].includes(user.role) ||
          user.permissions.has(PERMISSIONS.MANAGE_AUCTIONS) ||
          user.permissions.has(PERMISSIONS.CONTROL_BIDDING) ||
          user.permissions.has(PERMISSIONS.MANAGE_DEVICES)

        const isOwnRegButton = channel.startsWith('reg-button-') && channel.includes(user.id)
        const isLiveAuction = ['published', 'active', 'live', 'upcoming', 'registration_open'].includes(auction.status)
        const isPublicAuctionChannel = channel.startsWith('auction-') || channel.startsWith('auction-monitor-') || isGemChannel

        if (!canManage && !isOwnRegButton && !(isLiveAuction && isPublicAuctionChannel)) {
          const registration = await prisma.auctionRegistration.findUnique({
            where: { auctionId_userId: { auctionId, userId: user.id } },
            select: { approvalStatus: true, isActive: true },
          })
          if (!registration || registration.approvalStatus !== 'approved' || !registration.isActive) {
            jsonError(response, 403, 'Approved auction registration is required.')
            return
          }
        }
      }
    }
  }

  // ── Establish Server-Sent Events (SSE) stream ─────────────────────────────
  response.status(200)
  response.setHeader('Content-Type', 'text/event-stream')
  response.setHeader('Cache-Control', 'no-cache, no-transform')
  response.setHeader('Connection', 'keep-alive')
  response.flushHeaders()

  response.write(`data: ${JSON.stringify({ type: 'connected', channel })}\n\n`)

  const channelIds = channel.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/ig) || []

  const listener = (event: unknown) => {
    const payload = event as {
      channel?: string
      table?: string
      eventType?: 'INSERT' | 'UPDATE' | 'DELETE'
      new?: Record<string, any>
      old?: Record<string, any>
    }

    const row = payload.new ?? payload.old ?? {}
    const rowIds = Object.values(row).filter((v): v is string => typeof v === 'string' && validId(v))

    let matches = false

    if (!channel || payload.channel === channel) {
      matches = true
    } else if (channelIds.length > 0 && channelIds.some(id => payload.channel?.includes(id) || rowIds.includes(id))) {
      matches = true
    } else if (isPublicChannel) {
      // Public channels receive all changes to auctions, gems, and registration counts
      if (['auctions', 'gems', 'auction_registrations'].includes(payload.table || '')) {
        matches = true
      }
    } else if (channel === 'admin-all') {
      matches = true
    } else if (channel === 'admin-auctions') {
      if (['auctions', 'gems', 'auction_registrations', 'bids'].includes(payload.table || '')) {
        matches = true
      }
    } else if (channel === 'admin-approvals') {
      if (payload.table === 'auction_registrations') {
        matches = true
      }
    } else if (channel === 'admin-users') {
      if (['users', 'roles', 'user_roles', 'permissions'].includes(payload.table || '')) {
        matches = true
      }
    } else if (channel === 'admin-nfc') {
      if (payload.table === 'nfc_cards') {
        matches = true
      }
    } else if (user && (channel.startsWith('my-auctions-') || channel.startsWith('my-bids-') || channel.startsWith('user-'))) {
      const rowUserId = row.userId || row.user_id
      if (rowUserId === user.id) {
        matches = true
      } else if (['auctions', 'auction_winners'].includes(payload.table || '')) {
        matches = true
      } else if (channel.startsWith('my-bids-') && ['bids', 'gems'].includes(payload.table || '')) {
        matches = true
      }
    }

    if (matches) {
      try {
        response.write(`data: ${JSON.stringify(event)}\n\n`)
      } catch {
        // stream write error handled by request close
      }
    }
  }

  realtimeEmitter.on('change', listener)
  const heartbeat = setInterval(() => {
    try {
      response.write(': keep-alive\n\n')
    } catch {
      // client disconnected
    }
  }, 25000)

  request.on('close', () => {
    clearInterval(heartbeat)
    realtimeEmitter.off('change', listener)
  })
}
