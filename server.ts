import { config } from 'dotenv'
import express from 'express'
import path from 'node:path'
import { validateServerEnvironment } from './lib/config'

config({ path: ['.env.local', '.env'] })

const app = express()
const port = Number(process.env.API_PORT || 4000)
const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

app.use((request, response, next) => {
  const origin = request.get('origin')
  let isAllowedOrigin = false
  if (!origin) {
    // Non-browser or server-to-server requests (like ESP32 or curl without Origin header)
    isAllowedOrigin = true
  } else {
    try {
      const parsed = new URL(origin)
      const host = parsed.hostname
      if (allowedOrigins.includes(origin)) {
        isAllowedOrigin = true
      } else if (process.env.NODE_ENV !== 'production' && parsed.port === '3000') {
        // Any local frontend running on port 3000
        isAllowedOrigin = true
      } else if (process.env.NODE_ENV !== 'production' && (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === 'frontend' ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)
      )) {
        isAllowedOrigin = true
      }
    } catch {
      isAllowedOrigin = false
    }
  }

  if (origin && !isAllowedOrigin) {
    response.status(403).json({ error: 'This origin is not allowed to access the API.' })
    return
  }

  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
  }
  response.setHeader('Access-Control-Allow-Credentials', 'true')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (request.method === 'OPTIONS') {
    response.sendStatus(204)
    return
  }

  next()
})

app.use(express.json({ limit: '16kb' }))
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads'), {
  dotfiles: 'deny',
  index: false,
  maxAge: '1d',
  fallthrough: false,
  setHeaders(response) {
    response.setHeader('X-Content-Type-Options', 'nosniff')
  },
}))

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' })
})

async function startServer() {
  validateServerEnvironment()
  const { postLogin } = await import('./api/auth/login/route')
  const { postLogout } = await import('./api/auth/logout/route')
  const { postRegister } = await import('./api/auth/register/route')
  const { GET: getMe } = await import('./api/auth/me/route')
  const { POST: postResetPassword, PUT: putResetPassword } = await import('./api/auth/reset-password/route')
  const { GET: getConfirmEmail } = await import('./api/auth/confirm-email/route')
  const { GET: getAuctions } = await import('./api/auctions/route')
  const { GET: getAuctionRegister, POST: postAuctionRegister } = await import('./api/auctions/[id]/register/route')
  const { GET: getIncCurrentItem } = await import('./api/auctions/incremental/[id]/current-item/route')
  const { GET: getProgCurrentItem } = await import('./api/auctions/progressive/[id]/current-item/route')
  const { GET: getTenderCurrentItem } = await import('./api/auctions/tender/[id]/current-item/route')
  const { GET: getIncGemRegister } = await import('./api/auctions/incremental/[id]/gems/[gemId]/register/route')
  const { GET: getProgGemRegister } = await import('./api/auctions/progressive/[id]/gems/[gemId]/register/route')
  const { GET: getTenderGemRegister } = await import('./api/auctions/tender/[id]/gems/[gemId]/register/route')
  const { GET: getIncGemBids, POST: postIncGemBids, PATCH: patchIncGemBids } = await import('./api/auctions/incremental/[id]/gems/[gemId]/bids/route')
  const { GET: getProgGemBids, POST: postProgGemBids, PATCH: patchProgGemBids } = await import('./api/auctions/progressive/[id]/gems/[gemId]/bids/route')
  const { GET: getTenderGemBids, POST: postTenderGemBids, PATCH: patchTenderGemBids } = await import('./api/auctions/tender/[id]/gems/[gemId]/bids/route')
  const { GET: getGems, POST: postGems } = await import('./api/gems/route')
  const { GET: getGem, PUT: putGem, PATCH: patchGem } = await import('./api/gems/[id]/route')
  const { GET: getGemBids, POST: postGemBids } = await import('./api/gems/[id]/bids/route')
  const { GET: getNfc } = await import('./api/nfc/route')
  const { GET: getPayments, POST: postPayments } = await import('./api/payments/route')
  const { GET: getAuctionActivity } = await import('./api/auctions/[id]/activity/route')
  const { GET: getPaymentStatus } = await import('./api/gems/[id]/payment-status/route')
  const { GET: getRealtime } = await import('./api/realtime/route')
  const { GET: getSync } = await import('./api/sync/route')
  const { GET: getCron, POST: postCron } = await import('./api/cron/update-auctions/route')
  const { GET: getChatConvs, POST: postChatConvs, DELETE: deleteChatConvs } = await import('./api/chat/conversations/route')
  const { PATCH: patchChatConv, DELETE: deleteChatConv } = await import('./api/chat/conversations/[id]/route')
  const { GET: getChatMsgs, POST: postChatMsgs, DELETE: deleteChatMsg } = await import('./api/chat/conversations/[id]/messages/route')
  const { GET: getChatNotifications } = await import('./api/chat/notifications/route')
  const { GET: getChatUserProfile, PATCH: patchChatUserProfile } = await import('./api/chat/user-profile/route')
  const { getRoles, updateRolePermissions } = await import('./api/admin/roles/route')
  const { getUsers } = await import('./api/admin/users/route')
  const { updateUserRole } = await import('./api/admin/users/[id]/role/route')
  const { quickCreateUser } = await import('./api/admin/users/quick-create/route')
  const { getNfcCards, createNfcCard } = await import('./api/admin/nfc-cards/route')
  const { updateNfcCard, deleteNfcCard } = await import('./api/admin/nfc-cards/[id]/route')
  const { quickDeleteNfcCard } = await import('./api/admin/nfc-cards/quick-delete/route')
  const { getAuctionsList } = await import('./api/admin/auctions-list/route')
  const { createIncrementalAuction } = await import('./api/admin/auctions/incremental/route')
  const { createProgressiveAuction } = await import('./api/admin/auctions/progressive/route')
  const { createTenderAuction } = await import('./api/admin/auctions/tender/route')
  const { GET: getAdminStats } = await import('./api/admin/stats/route')
  const { GET: getAdminAuction, PATCH: patchAdminAuction, PUT: putAdminAuction, DELETE: deleteAdminAuction } = await import('./api/admin/auctions/[id]/route')
  const { GET: getHoldBidder, POST: postHoldBidder, PATCH: patchHoldBidder } = await import('./api/admin/auctions/[id]/hold-bidder/route')
  const { POST: postRegisterUser } = await import('./api/admin/auctions/[id]/register-user/route')
  const { PATCH: patchRegistration } = await import('./api/admin/auctions/[id]/registrations/[registrationId]/route')
  const { GET: getIncStatus, POST: postIncStatus } = await import('./api/admin/auctions/incremental/[id]/status/route')
  const { POST: postIncStartRound } = await import('./api/admin/auctions/incremental/[id]/start-round/route')
  const { POST: postIncEndRound } = await import('./api/admin/auctions/incremental/[id]/end-round/route')
  const { POST: postIncIncrement } = await import('./api/admin/auctions/incremental/[id]/increment/route')
  const { POST: postIncSelectWinner } = await import('./api/admin/auctions/incremental/[id]/select-winner/route')
  const { POST: postIncEliminateNonApprovers } = await import('./api/admin/auctions/incremental/[id]/eliminate-non-approvers/route')
  const { GET: getProgStatus, POST: postProgStatus } = await import('./api/admin/auctions/progressive/[id]/status/route')
  const { POST: postProgStartRound } = await import('./api/admin/auctions/progressive/[id]/start-round/route')
  const { POST: postProgEndRound } = await import('./api/admin/auctions/progressive/[id]/end-round/route')
  const { POST: postProgIncrement } = await import('./api/admin/auctions/progressive/[id]/increment/route')
  const { POST: postProgSelectWinner } = await import('./api/admin/auctions/progressive/[id]/select-winner/route')
  const { POST: postTenderSelectWinner } = await import('./api/admin/auctions/tender/[id]/select-winner/route')
  const { POST: postTenderActivateAllItems } = await import('./api/admin/auctions/tender/[id]/activate-all-items/route')
  const { getModerators } = await import('./api/admin/moderators/route')
  const { postUpload } = await import('./api/upload/route')
  const prisma = (await import('./lib/prisma')).default
  const { broadcastEvent } = await import('./lib/events')
  const bcrypt = (await import('bcryptjs')).default
  const { placeBid } = await import('./api/admin/_auth')

  // ── Auth ────────────────────────────────────────────────────────
  app.post('/api/auth/login', postLogin)
  app.post('/api/auth/logout', postLogout)
  app.post('/api/auth/register', postRegister)
  app.get('/api/auth/me', getMe)
  app.post('/api/auth/reset-password', postResetPassword)
  app.put('/api/auth/reset-password', putResetPassword)
  app.get('/api/auth/confirm-email', getConfirmEmail)

  // ── Auctions ────────────────────────────────────────────────────
  app.get('/api/auctions', getAuctions)
  app.get('/api/auctions/:id/register', getAuctionRegister)
  app.post('/api/auctions/:id/register', postAuctionRegister)
  app.get('/api/auctions/incremental/:id/current-item', getIncCurrentItem)
  app.get('/api/auctions/progressive/:id/current-item', getProgCurrentItem)
  app.get('/api/auctions/tender/:id/current-item', getTenderCurrentItem)
  app.get('/api/auctions/incremental/:id/gems/:gemId/register', getIncGemRegister)
  app.get('/api/auctions/progressive/:id/gems/:gemId/register', getProgGemRegister)
  app.get('/api/auctions/tender/:id/gems/:gemId/register', getTenderGemRegister)
  app.get('/api/auctions/incremental/:id/gems/:gemId/bids', getIncGemBids)
  app.post('/api/auctions/incremental/:id/gems/:gemId/bids', postIncGemBids)
  app.patch('/api/auctions/incremental/:id/gems/:gemId/bids', patchIncGemBids)
  app.get('/api/auctions/progressive/:id/gems/:gemId/bids', getProgGemBids)
  app.post('/api/auctions/progressive/:id/gems/:gemId/bids', postProgGemBids)
  app.patch('/api/auctions/progressive/:id/gems/:gemId/bids', patchProgGemBids)
  app.get('/api/auctions/tender/:id/gems/:gemId/bids', getTenderGemBids)
  app.post('/api/auctions/tender/:id/gems/:gemId/bids', postTenderGemBids)
  app.patch('/api/auctions/tender/:id/gems/:gemId/bids', patchTenderGemBids)

  // ── Gems ────────────────────────────────────────────────────────
  app.get('/api/gems', getGems)
  app.post('/api/gems', postGems)
  app.get('/api/gems/:id', getGem)
  app.put('/api/gems/:id', putGem)
  app.patch('/api/gems/:id', patchGem)
  app.get('/api/gems/:id/bids', getGemBids)
  app.post('/api/gems/:id/bids', postGemBids)

  // ── NFC / Payments / DB / Realtime / Sync / Cron ────────────────
  app.get('/api/nfc', getNfc)
  app.get('/api/payments', getPayments)
  app.post('/api/payments', postPayments)
  app.get('/api/auctions/:id/activity', getAuctionActivity)
  app.get('/api/gems/:id/payment-status', getPaymentStatus)
  app.get('/api/realtime', getRealtime)
  app.get('/api/sync', getSync)
  app.get('/api/cron/update-auctions', getCron)
  app.post('/api/cron/update-auctions', postCron)

  // ── Chat ────────────────────────────────────────────────────────
  app.get('/api/chat/conversations', getChatConvs)
  app.post('/api/chat/conversations', postChatConvs)
  app.delete('/api/chat/conversations', deleteChatConvs)
  app.patch('/api/chat/conversations/:id', patchChatConv)
  app.delete('/api/chat/conversations/:id', deleteChatConv)
  app.get('/api/chat/conversations/:id/messages', getChatMsgs)
  app.post('/api/chat/conversations/:id/messages', postChatMsgs)
  app.delete('/api/chat/conversations/:id/messages/:messageId', deleteChatMsg)
  app.delete('/api/chat/conversations/:id/messages', deleteChatMsg)
  app.get('/api/chat/notifications', getChatNotifications)
  app.get('/api/chat/user-profile', getChatUserProfile)
  app.patch('/api/chat/user-profile', patchChatUserProfile)

  // ── Admin ───────────────────────────────────────────────────────
  app.get('/api/admin/roles', getRoles)
  app.put('/api/admin/roles', updateRolePermissions)
  app.get('/api/admin/users', getUsers)
  app.patch('/api/admin/users/:id/role', updateUserRole)
  app.post('/api/admin/users/quick-create', quickCreateUser)
  app.get('/api/admin/nfc-cards', getNfcCards)
  app.post('/api/admin/nfc-cards', createNfcCard)
  app.patch('/api/admin/nfc-cards/:id', updateNfcCard)
  app.delete('/api/admin/nfc-cards/:id', deleteNfcCard)
  app.post('/api/admin/nfc-cards/quick-delete', quickDeleteNfcCard)
  app.get('/api/admin/auctions-list', getAuctionsList)
  app.post('/api/admin/auctions/incremental', createIncrementalAuction)
  app.post('/api/admin/auctions/progressive', createProgressiveAuction)
  app.post('/api/admin/auctions/tender', createTenderAuction)
  app.get('/api/admin/stats', getAdminStats)
  app.get('/api/admin/auctions/:id', getAdminAuction)
  app.patch('/api/admin/auctions/:id', patchAdminAuction)
  app.put('/api/admin/auctions/:id', putAdminAuction)
  app.delete('/api/admin/auctions/:id', deleteAdminAuction)
  app.get('/api/admin/auctions/:id/hold-bidder', getHoldBidder)
  app.post('/api/admin/auctions/:id/hold-bidder', postHoldBidder)
  app.patch('/api/admin/auctions/:id/hold-bidder', patchHoldBidder)
  app.post('/api/admin/auctions/:id/register-user', postRegisterUser)
  app.patch('/api/admin/auctions/:id/registrations/:registrationId', patchRegistration)

  // Direct action routes on /api/admin/auctions/:id/...
  app.get('/api/admin/auctions/:id/status', getIncStatus)
  app.post('/api/admin/auctions/:id/status', postIncStatus)
  app.post('/api/admin/auctions/:id/start-round', postIncStartRound)
  app.post('/api/admin/auctions/:id/end-round', postIncEndRound)
  app.post('/api/admin/auctions/:id/increment', postIncIncrement)
  app.post('/api/admin/auctions/:id/select-winner', async (request, response) => {
    const rawId = (request as any).params?.id
    const gemId = (request as any).body?.gem_id ?? (request as any).body?.item_id ?? rawId
    if (gemId) {
      try {
        const { default: prismaClient } = await import('./lib/prisma')
        const gem = await prismaClient.gem.findUnique({
          where: { id: gemId },
          include: { auction: true },
        })
        if (gem?.auction?.auctionType === 'tender_base_fixed_bid') {
          return postTenderSelectWinner(request, response)
        }
        if (gem?.auction?.auctionType === 'progressive_elimination_auction') {
          return postProgSelectWinner(request, response)
        }
      } catch {
        // Fall back to default
      }
    }
    return postIncSelectWinner(request, response)
  })
  app.post('/api/admin/auctions/:id/eliminate-non-approvers', postIncEliminateNonApprovers)
  app.post('/api/admin/auctions/:id/activate-all-items', postTenderActivateAllItems)

  // Auction-type specific action routes
  app.get('/api/admin/auctions/incremental/:id/status', getIncStatus)
  app.post('/api/admin/auctions/incremental/:id/status', postIncStatus)
  app.post('/api/admin/auctions/incremental/:id/start-round', postIncStartRound)
  app.post('/api/admin/auctions/incremental/:id/end-round', postIncEndRound)
  app.post('/api/admin/auctions/incremental/:id/increment', postIncIncrement)
  app.post('/api/admin/auctions/incremental/:id/select-winner', postIncSelectWinner)
  app.post('/api/admin/auctions/incremental/:id/eliminate-non-approvers', postIncEliminateNonApprovers)
  app.get('/api/admin/auctions/progressive/:id/status', getProgStatus)
  app.post('/api/admin/auctions/progressive/:id/status', postProgStatus)
  app.post('/api/admin/auctions/progressive/:id/start-round', postProgStartRound)
  app.post('/api/admin/auctions/progressive/:id/end-round', postProgEndRound)
  app.post('/api/admin/auctions/progressive/:id/increment', postProgIncrement)
  app.post('/api/admin/auctions/progressive/:id/select-winner', postProgSelectWinner)
  app.get('/api/admin/auctions/tender/:id/status', getIncStatus)
  app.post('/api/admin/auctions/tender/:id/status', postIncStatus)
  app.post('/api/admin/auctions/tender/:id/end-round', postIncEndRound)
  app.post('/api/admin/auctions/tender/:id/select-winner', postTenderSelectWinner)
  app.post('/api/admin/auctions/tender/:id/activate-all-items', postTenderActivateAllItems)

  app.get('/api/admin/moderators', getModerators)
  app.post('/api/upload', postUpload)

  // ── Hardware IoT Device Endpoints ─────────────────────────────────────────
  app.get('/api/device/nfc/:uid', async (request, response) => {
    try {
      const rawUid = (request.params.uid || '').trim()
      if (!rawUid) {
        response.status(400).json({ success: false, error: 'UID is required' })
        return
      }
      const cleanUid = rawUid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      const cards = await prisma.nfcCard.findMany({
        where: { isActive: true },
        include: {
          user: {
            select: { id: true, displayName: true, email: true, anonymousName: true, isActive: true },
          },
        },
      })
      const card = cards.find(c => c.nfcUid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanUid)
      if (!card || !card.user || !card.user.isActive) {
        response.status(404).json({ success: false, error: 'NFC card not found or inactive' })
        return
      }

      response.json({
        success: true,
        card: {
          uid: card.nfcUid,
          type: card.type,
          label: card.label,
        },
        user: {
          id: card.user.id,
          displayName: card.user.displayName || card.user.anonymousName || card.user.email.split('@')[0],
          email: card.user.email,
        },
      })
    } catch (err: any) {
      console.error('[DEVICE_NFC_ERR]', err)
      response.status(500).json({ success: false, error: 'Internal server error' })
    }
  })

  app.post('/api/device/verify-auction-password', async (request, response) => {
    try {
      const { auctionId, password } = request.body || {}
      if (!auctionId || password === undefined) {
        response.status(400).json({ success: false, error: 'Auction ID and password are required' })
        return
      }

      const isValidUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
      if (!isValidUuid(String(auctionId))) {
        response.status(400).json({ success: false, error: 'Invalid auction ID format' })
        return
      }

      const auction = await prisma.auction.findUnique({
        where: { id: auctionId },
        select: { id: true, name: true, passwordHash: true },
      })

      if (!auction) {
        response.status(404).json({ success: false, error: 'Auction not found' })
        return
      }

      if (!auction.passwordHash) {
        // No password configured for this auction
        response.json({ success: true, verified: true })
        return
      }

      const match = await bcrypt.compare(String(password).trim(), auction.passwordHash)
      if (!match) {
        response.status(401).json({ success: false, verified: false, error: 'Incorrect password' })
        return
      }

      response.json({ success: true, verified: true })
    } catch (err: any) {
      console.error('[DEVICE_PASSWORD_VERIFY_ERR]', err)
      response.status(500).json({ success: false, error: 'Internal server error' })
    }
  })

  app.post('/api/device/bid', async (request, response) => {
    try {
      const { nfcUid, auctionId, gemId, amount } = request.body || {}
      if (!nfcUid || !auctionId || !gemId) {
        response.status(400).json({ success: false, error: 'Missing required parameters: nfcUid, auctionId, gemId' })
        return
      }

      request.headers['x-nfc-uid'] = String(nfcUid)
      if (amount !== undefined && request.body.bid_amount === undefined) {
        request.body.bid_amount = amount
      }

      await placeBid(request, response, String(auctionId), String(gemId))
    } catch (err: any) {
      console.error('[DEVICE_BID_ERR]', err)
      response.status(500).json({ success: false, error: 'Internal server error' })
    }
  })

  // ── Fallback 404 handler for all /api requests (always returns JSON) ──
  app.use('/api', (_request: express.Request, response: express.Response) => {
    response.status(404).json({ error: 'Endpoint not found.' })
  })

  app.use((
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction
  ) => {
    if (error instanceof SyntaxError) {
      response.status(400).json({ error: 'Request body must be valid JSON.' })
      return
    }

    console.error('API request failed:', error)
    response.status(500).json({ error: 'The API could not complete the request.' })
  })

  app.listen(port, () => {
    console.log(`API server listening on port ${port}`)
  })
}

startServer().catch(error => {
  console.error('Failed to start API server:', error)
  process.exitCode = 1
})
