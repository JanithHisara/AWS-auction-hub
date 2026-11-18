import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { test } from 'node:test'

test('production HTTP server removes generic database access and enforces authentication and origins', async t => {
  const reservation = createServer()
  await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve))
  const address = reservation.address()
  assert.ok(address && typeof address !== 'string')
  const port = address.port
  await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()))

  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    env: {
      ...process.env, NODE_ENV: 'production', APP_ENV: 'production', API_PORT: String(port),
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
      AUTH_SECRET: randomBytes(32).toString('hex'), CRON_SECRET: randomBytes(32).toString('hex'),
      NEXT_PUBLIC_APP_URL: 'https://auction.example.test', FRONTEND_ORIGINS: 'https://auction.example.test',
      SUPER_ADMIN_EMAILS: '', RESEND_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  t.after(async () => {
    if (child.exitCode !== null) return
    await new Promise<void>(resolve => { child.once('exit', () => resolve()); child.kill() })
  })
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('API startup timed out')), 45000)
    child.once('error', error => { clearTimeout(timeout); reject(error) })
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`API exited before readiness (${code})`)) })
    child.stdout.on('data', data => {
      if (data.toString().includes('API server listening on port')) { clearTimeout(timeout); resolve() }
    })
    // Consume output without logging potentially sensitive diagnostics.
    child.stderr.resume()
  })

  const base = `http://127.0.0.1:${port}`
  const health = await fetch(`${base}/health`)
  assert.equal(health.status, 200)
  for (const method of ['GET', 'POST']) {
    const result = await fetch(`${base}/api/db`, {
      method, ...(method === 'POST' ? {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'users', action: 'DELETE' }),
      } : {}),
    })
    assert.equal(result.status, 404)
  }
  const id = '11111111-1111-4111-8111-111111111111'
  for (const path of [`/api/auctions/${id}/activity`, `/api/gems/${id}/payment-status`, `/api/gems/${id}/bids`]) {
    const result = await fetch(`${base}${path}`)
    assert.equal(result.status, 401)
  }
  const forbidden = await fetch(`${base}/health`, { headers: { Origin: 'https://untrusted.example.test:3000' } })
  assert.equal(forbidden.status, 403)
  const allowed = await fetch(`${base}/health`, { headers: { Origin: 'https://auction.example.test' } })
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://auction.example.test')
})
