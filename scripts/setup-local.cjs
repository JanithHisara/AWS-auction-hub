const fs = require('node:fs')
const path = require('node:path')
const { randomBytes } = require('node:crypto')
const { spawnSync } = require('node:child_process')
const { parse } = require('dotenv')

const root = path.resolve(__dirname, '..')
const target = path.join(root, '.env')
const read = file => fs.existsSync(file) ? parse(fs.readFileSync(file)) : {}

function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true })
  if (result.error || result.status !== 0) return null
  return result.stdout
}

try {
  const existing = read(target)
  if (existing.APP_ENV && existing.APP_ENV !== 'local') {
    throw new Error('The existing .env is not marked APP_ENV=local. Preserve it and configure local settings separately.')
  }
  const local = read(path.join(root, '.env.local'))
  const container = docker(['inspect', 'auctionhub_db'])
  let database = {}
  if (container) {
    const info = JSON.parse(container)[0]
    database = Object.fromEntries((info.Config.Env || []).map(entry => {
      const separator = entry.indexOf('=')
      return [entry.slice(0, separator), entry.slice(separator + 1)]
    }))
  }
  const values = { ...existing }
  const setMissing = (key, value) => { if (!values[key]) values[key] = value }
  setMissing('POSTGRES_USER', database.POSTGRES_USER || 'auction_user')
  setMissing('POSTGRES_DB', database.POSTGRES_DB || 'auctionhub')
  if (!values.POSTGRES_PASSWORD && !database.POSTGRES_PASSWORD) {
    const volumes = docker(['volume', 'ls', '--filter', 'label=com.docker.compose.volume=postgres_data', '--format', '{{.Name}}'])
    if (volumes === null) throw new Error('Cannot inspect Docker. Start Docker Desktop and rerun npm run setup:local.')
    if (volumes.trim()) throw new Error('An existing database volume has no container metadata. Set its current POSTGRES_PASSWORD in .env before rerunning; no credentials have been changed.')
  }
  setMissing('POSTGRES_PASSWORD', database.POSTGRES_PASSWORD || randomBytes(32).toString('hex'))
  if (!values.DATABASE_URL) {
    const url = new URL('postgresql://db:5432')
    url.username = values.POSTGRES_USER
    url.password = values.POSTGRES_PASSWORD
    url.pathname = `/${values.POSTGRES_DB}`
    url.searchParams.set('schema', 'public')
    values.DATABASE_URL = url.toString()
  }
  setMissing('AUTH_SECRET', randomBytes(32).toString('hex'))
  setMissing('CRON_SECRET', randomBytes(32).toString('hex'))
  setMissing('SUPER_ADMIN_EMAILS', local.SUPER_ADMIN_EMAILS || '')
  if (!values.SUPER_ADMIN_EMAILS) {
    throw new Error('Set SUPER_ADMIN_EMAILS in .env or .env.local to an email address you control, then rerun.')
  }
  setMissing('APP_ENV', 'local')
  setMissing('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  setMissing('FRONTEND_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000')

  // Keep comments and unrelated settings. Only fill missing or empty required values.
  let content = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '# Local Docker configuration. Contains secrets; do not commit.\n'
  for (const [key, value] of Object.entries(values)) {
    if (existing[key]) continue
    if (/[\r\n']/u.test(value)) throw new Error(`Cannot safely write ${key}; configure it manually.`)
    const line = `${key}='${value}'`
    const expression = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=.*$`, 'm')
    if (expression.test(content)) content = content.replace(expression, () => line)
    else content = content.replace(/\s*$/, '') + '\n' + line + '\n'
  }
  fs.writeFileSync(target, content, { mode: 0o600 })
  console.log('Local .env is ready. Existing settings and database credentials were preserved; secrets are not printed.')
  console.log('Next: docker compose config --quiet, then docker compose up -d --build')
  console.log('Open http://localhost:3000. Use APP_ENV=production and HTTPS settings on AWS.')
} catch (error) {
  console.error(`Local setup: ${error instanceof Error ? error.message : 'Unable to prepare configuration.'}`)
  process.exitCode = 1
}
