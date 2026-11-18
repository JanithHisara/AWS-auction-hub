import assert from 'node:assert/strict'
import { afterEach, before, beforeEach, mock, test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { Request, Response } from 'express'
import { seedAdmins } from '../prisma/seed'
import { requiredSecret, sessionCookieSecure, validateServerEnvironment } from '../lib/config'

// No connection is opened: every database method used by a handler is replaced below.
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test'
let prisma: typeof import('../lib/prisma').default
let activity: typeof import('../api/auctions/[id]/activity/route').GET
let paymentStatus: typeof import('../api/gems/[id]/payment-status/route').GET
let gemBids: typeof import('../api/gems/[id]/bids/route').GET
let updateProfile: typeof import('../api/chat/user-profile/route').PATCH
let auth: typeof import('../lib/auth')
before(async () => {
  prisma = (await import('../lib/prisma')).default
  activity = (await import('../api/auctions/[id]/activity/route')).GET
  paymentStatus = (await import('../api/gems/[id]/payment-status/route')).GET
  gemBids = (await import('../api/gems/[id]/bids/route')).GET
  updateProfile = (await import('../api/chat/user-profile/route')).PATCH
  auth = await import('../lib/auth')
})

const userId = '11111111-1111-4111-8111-111111111111'
const auctionId = '22222222-2222-4222-8222-222222222222'
const gemId = '33333333-3333-4333-8333-333333333333'
const otherUserId = '44444444-4444-4444-8444-444444444444'

function request(id: string, authenticated = true, extra: Record<string, unknown> = {}) {
  return {
    params: { id }, query: {}, body: {},
    headers: authenticated ? { authorization: 'Bearer test-session' } : {},
    ...extra,
  } as unknown as Request
}

function response() {
  const result = {
    statusCode: 200, body: undefined as any, headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this },
    json(body: any) { this.body = body; return this },
    setHeader(name: string, value: string) { this.headers[name] = value; return this },
  }
  return result as typeof result & Response
}

beforeEach(() => {
  stub(prisma.userSession, 'findUnique', async () => ({
    id: 'session', expiresAt: new Date(Date.now() + 60000),
    user: { id: userId, email: 'bidder@example.test', isActive: true, role: 'user', userRoles: [] },
  }))
})
afterEach(() => {
  while (restorers.length) restorers.pop()!()
  mock.restoreAll()
})

const restorers: Array<() => void> = []
function stub(object: any, name: string, implementation: (...args: any[]) => any) {
  const original = object[name]
  const replacement = mock.fn(implementation)
  object[name] = replacement
  restorers.push(() => { object[name] = original })
  return replacement
}

test('auction activity rejects anonymous requests before accessing auction data', async () => {
  const lookup = stub(prisma.auction, 'findUnique', async () => { throw new Error('Unexpected query') })
  const res = response()
  await activity(request(auctionId, false), res)
  assert.equal(res.statusCode, 401)
  assert.equal(lookup.mock.callCount(), 0)
})

test('auction activity rejects expired sessions and malformed IDs', async () => {
  const res = response()
  await activity(request('not-a-uuid'), res)
  assert.equal(res.statusCode, 400)
  stub(prisma.userSession, 'findUnique', async () => null)
  const expired = response()
  await activity(request(auctionId), expired)
  assert.equal(expired.statusCode, 401)
})

test('pending, inactive, and missing registrations cannot read auction activity', async () => {
  stub(prisma.auction, 'findUnique', async () => ({ id: auctionId, status: 'live' }))
  const winners = stub(prisma.auctionWinner, 'findMany', async () => { throw new Error('Unexpected query') })
  for (const registration of [null, { approvalStatus: 'pending', isActive: true }, { approvalStatus: 'approved', isActive: false }]) {
    stub(prisma.auctionRegistration, 'findUnique', async (args: any) => {
      assert.equal(args.where.auctionId_userId.userId, userId)
      return registration
    })
    const res = response()
    await activity(request(auctionId), res)
    assert.equal(res.statusCode, 403)
  }
  assert.equal(winners.mock.callCount(), 0)
})

test('approved participants get only activity from the requested auction', async () => {
  stub(prisma.auction, 'findUnique', async () => ({ id: auctionId, status: 'live' }))
  stub(prisma.auctionRegistration, 'findUnique', async () => ({ approvalStatus: 'approved', isActive: true }))
  stub(prisma.auctionRegistration, 'count', async (args: any) => {
    assert.deepEqual(args.where, { auctionId, isActive: true })
    return 3
  })
  stub(prisma.auctionWinner, 'findMany', async (args: any) => {
    assert.deepEqual(args.where, { gem: { auctionId } })
    assert.equal(args.select.user, undefined)
    return [{ gemId, userId, winningAmount: 0, gem: { name: 'Gem', startingPrice: 20 }, winningBid: { bidAmount: 10 } }]
  })
  const res = response()
  await activity(request(auctionId), res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { registeredCount: 3, winners: [{ gem_id: gemId, user_id: userId, gem_name: 'Gem', winning_amount: 0 }] })
  assert.equal(res.headers['Cache-Control'], 'private, no-store')
})

test('payment status derives ownership from the session and ignores supplied user IDs', async () => {
  stub(prisma.auctionWinner, 'findFirst', async (args: any) => {
    assert.deepEqual(args.where, { gemId, userId })
    return null
  })
  stub(prisma.payment, 'findFirst', async (args: any) => {
    assert.deepEqual(args.where, { gemId, userId, status: 'completed' })
    return null
  })
  const res = response()
  await paymentStatus(request(gemId, true, { query: { user_id: otherUserId }, body: { userId: otherUserId } }), res)
  assert.deepEqual(res.body, { isWinner: false, paymentCompleted: false })
})

test('payment status requires a browser session, including when an NFC UID is supplied', async () => {
  const res = response()
  await paymentStatus(request(gemId, false, { body: { nfc_uid: 'known-card' } }), res)
  assert.equal(res.statusCode, 401)
})

test('sealed bids are limited to the authenticated bidder and omit private profile fields', async () => {
  stub(prisma.gem, 'findUnique', async () => ({ auctionId, auction: { status: 'live', auctionType: 'tender_base_fixed_bid' } }))
  stub(prisma.auctionRegistration, 'findUnique', async () => ({ approvalStatus: 'approved', isActive: true }))
  stub(prisma.bid, 'findMany', async (args: any) => {
    assert.deepEqual(args.where, { gemId, userId })
    assert.equal(args.select.user.select.passwordHash, undefined)
    assert.equal(args.select.user.select.email, undefined)
    return [{ id: 'bid', userId, bidAmount: 50, pointsEarned: 1, createdAt: new Date(), user: { anonymousName: 'Bidder', displayName: 'Me' } }]
  })
  const res = response()
  await gemBids(request(gemId), res)
  assert.equal(res.body.bids[0].bid_amount, 50)
  assert.equal(res.body.bids[0].user.email, '')
})

test('admin bootstrap preserves existing passwords, roles, and activation on every rerun', async () => {
  const existing = { id: userId, passwordHash: 'existing-hash', role: 'user', isActive: false }
  const original = { ...existing }
  const database = { user: {
    findUnique: async () => existing,
    create: async () => { throw new Error('Must not create existing accounts') },
  } }
  const logs: string[] = []
  mock.method(console, 'log', (message: string) => { logs.push(message) })
  await seedAdmins(database as any, { SUPER_ADMIN_EMAILS: 'existing@example.test' })
  await seedAdmins(database as any, { SUPER_ADMIN_EMAILS: 'existing@example.test', SUPER_ADMIN_INITIAL_PASSWORD: 'UnusedPasswordWith123' })
  assert.deepEqual(existing, original)
  assert.ok(!logs.join('\n').includes('UnusedPasswordWith123'))
})

test('admin bootstrap requires explicit credentials and never logs the initial password', async () => {
  let created: any
  const database = { user: {
    findUnique: async () => created || null,
    create: async ({ data }: any) => { created = { id: userId, ...data }; return created },
  } }
  const logs: string[] = []
  mock.method(console, 'log', (message: string) => { logs.push(message) })
  await assert.rejects(seedAdmins(database as any, {}), /SUPER_ADMIN_EMAILS/)
  await assert.rejects(seedAdmins(database as any, { SUPER_ADMIN_EMAILS: 'admin@example.test' }), /SUPER_ADMIN_INITIAL_PASSWORD/)
  const password = 'Fresh-Admin-Password-5792'
  await seedAdmins(database as any, { SUPER_ADMIN_EMAILS: 'ADMIN@example.test', SUPER_ADMIN_INITIAL_PASSWORD: password })
  assert.equal(created.email, 'admin@example.test')
  assert.notEqual(created.passwordHash, password)
  assert.ok(await bcrypt.compare(password, created.passwordHash))
  assert.ok(!logs.join('\n').includes(password))
  await seedAdmins(database as any, { SUPER_ADMIN_EMAILS: 'admin@example.test' })
})

test('failed manual seed command returns a nonzero exit code', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], {
    encoding: 'utf8', env: { ...process.env, SUPER_ADMIN_EMAILS: '' }, timeout: 15000,
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Set SUPER_ADMIN_EMAILS/)
})

test('production configuration fails closed on missing, shared, or example secrets', () => {
  for (const value of ['', 'short', 'your-super-secret-jwt-key-replace-me']) {
    assert.throws(() => requiredSecret('AUTH_SECRET', { AUTH_SECRET: value }))
  }
  const environment = {
    NODE_ENV: 'production' as const, DATABASE_URL: 'postgresql://test:test@db:5432/test',
    NEXT_PUBLIC_APP_URL: 'https://auction.example.test', FRONTEND_ORIGINS: 'https://auction.example.test',
    AUTH_SECRET: randomBytes(32).toString('hex'), CRON_SECRET: randomBytes(32).toString('hex'),
  }
  assert.doesNotThrow(() => validateServerEnvironment(environment))
  assert.throws(() => validateServerEnvironment({ ...environment, CRON_SECRET: environment.AUTH_SECRET }), /different/)
  assert.throws(() => validateServerEnvironment({ ...environment, NEXT_PUBLIC_APP_URL: 'http://example.test' }), /HTTPS/)
})

test('local HTTP requires an explicit local mode and loopback URLs', () => {
  const environment = {
    NODE_ENV: 'production', APP_ENV: 'local', DATABASE_URL: 'postgresql://test:test@db:5432/test',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000', FRONTEND_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000',
    AUTH_SECRET: randomBytes(32).toString('hex'), CRON_SECRET: randomBytes(32).toString('hex'),
  }
  assert.doesNotThrow(() => validateServerEnvironment(environment))
  assert.equal(sessionCookieSecure(environment), false)
  for (const url of ['http://public.example.test', 'http://localhost.example.test', 'http://192.168.1.2:3000']) {
    assert.throws(() => validateServerEnvironment({ ...environment, NEXT_PUBLIC_APP_URL: url }), /HTTPS/)
    assert.equal(sessionCookieSecure({ ...environment, NEXT_PUBLIC_APP_URL: url }), true)
    assert.throws(() => validateServerEnvironment({ ...environment, FRONTEND_ORIGINS: url }), /HTTPS/)
  }
  assert.throws(() => validateServerEnvironment({ ...environment, APP_ENV: 'production' }), /HTTPS/)
  assert.equal(sessionCookieSecure({ ...environment, APP_ENV: 'production' }), true)
})

test('profile changes reject unverified email and privilege fields', async () => {
  const update = stub(prisma.user, 'update', async () => { throw new Error('Unexpected write') })
  for (const body of [{ email: 'admin@example.test' }, { role: 'super_admin' }, { passwordHash: 'fake' }]) {
    const res = response()
    await updateProfile(request(userId, true, { body }), res)
    assert.equal(res.statusCode, 400)
  }
  assert.equal(update.mock.callCount(), 0)
})

test('password changes require the correct current password', async () => {
  stub(prisma.user, 'findUnique', async () => ({ passwordHash: await bcrypt.hash('OldPassword-731', 4) }))
  const update = stub(prisma.user, 'update', async () => { throw new Error('Unexpected write') })
  const res = response()
  await updateProfile(request(userId, true, { body: { current_password: 'wrong', new_password: 'NewPassword-8592' } }), res)
  assert.equal(res.statusCode, 400)
  assert.equal(update.mock.callCount(), 0)
})

test('password changes hash the new password and revoke other sessions atomically', async () => {
  stub(prisma.user, 'findUnique', async () => ({ passwordHash: await bcrypt.hash('OldPassword-731', 4) }))
  let changed = false
  let revoked = false
  stub(prisma, '$transaction', async (run: any) => run({
    user: { update: async (args: any) => {
      assert.deepEqual(args.where, { id: userId })
      assert.ok(await bcrypt.compare('NewPassword-8592', args.data.passwordHash))
      changed = true
      return { id: userId, email: 'bidder@example.test', displayName: 'Bidder', role: 'user' }
    } },
    userSession: { deleteMany: async (args: any) => {
      assert.deepEqual(args.where, { userId, tokenHash: { not: createHash('sha256').update('test-session').digest('hex') } })
      revoked = true
    } },
  }))
  const res = response()
  await updateProfile(request(userId, true, { body: { current_password: 'OldPassword-731', new_password: 'NewPassword-8592' } }), res)
  assert.equal(res.statusCode, 200)
  assert.ok(changed && revoked)
  assert.equal(res.body.passwordHash, undefined)
})

test('confirmation signatures require a configured secret and reject tampered tokens', () => {
  const original = process.env.AUTH_SECRET
  try {
    process.env.AUTH_SECRET = randomBytes(32).toString('hex')
    const token = auth.generateConfirmationToken(userId, 'BIDDER@example.test')
    assert.deepEqual(auth.verifyConfirmationToken(token), { userId, email: 'bidder@example.test' })
    const decoded = Buffer.from(token, 'base64url').toString('utf8').replace(userId, otherUserId)
    assert.equal(auth.verifyConfirmationToken(Buffer.from(decoded).toString('base64url')), null)
    delete process.env.AUTH_SECRET
    assert.throws(() => auth.generateConfirmationToken(userId, 'bidder@example.test'), /AUTH_SECRET/)
    assert.equal(auth.verifyConfirmationToken(token), null)
  } finally {
    if (original === undefined) delete process.env.AUTH_SECRET
    else process.env.AUTH_SECRET = original
  }
})
