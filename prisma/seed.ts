import { config } from 'dotenv'
import bcrypt from 'bcryptjs'
import type { PrismaClient } from '@prisma/client'

export async function seedAdmins(database: Pick<PrismaClient, 'user'>, environment: Readonly<Record<string, string | undefined>> = process.env) {
  const emails = [...new Set((environment.SUPER_ADMIN_EMAILS || '')
    .split(',').map(email => email.trim().toLowerCase()).filter(Boolean))]
  if (!emails.length || emails.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error('Set SUPER_ADMIN_EMAILS to the admin email addresses before running db:seed.')
  }
  const missing: string[] = []
  for (const email of emails) {
    const existing = await database.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) console.log(`[SEED] Existing account preserved: ${email}`)
    else missing.push(email)
  }
  if (!missing.length) return

  const password = environment.SUPER_ADMIN_INITIAL_PASSWORD || ''
  if (password.length < 16 || Buffer.byteLength(password, 'utf8') > 72 ||
      !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) ||
      /admin@1234|replace[-_ ]?me|change[-_ ]?me/i.test(password)) {
    throw new Error('Set SUPER_ADMIN_INITIAL_PASSWORD to a unique password of at least 16 characters (maximum 72 UTF-8 bytes), including uppercase, lowercase, and numbers.')
  }
  const passwordHash = await bcrypt.hash(password, 12)
  for (const email of missing) {
    try {
      await database.user.create({
        data: { email, passwordHash, role: 'super_admin', isActive: true, displayName: 'Super Admin', emailVerifiedAt: new Date() },
      })
      console.log(`[SEED] Admin account created: ${email}`)
    } catch (error) {
      // A concurrent bootstrap may have created the same email. Never update it.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        console.log(`[SEED] Existing account preserved: ${email}`)
      } else throw error
    }
  }
}

if (require.main === module) {
  config({ path: ['.env.local', '.env'] })
  let database: PrismaClient | undefined
  async function main() {
    database = (await import('../lib/prisma')).default
    await seedAdmins(database)
  }
  main().catch(error => {
    // Do not print database errors, connection strings, password hashes, or passwords.
    const message = error instanceof Error && error.message.startsWith('Set SUPER_ADMIN_')
      ? error.message : 'Admin setup failed. Check database access and configuration.'
    console.error(`[SEED] ${message}`)
    process.exitCode = 1
  }).finally(async () => {
    await database?.$disconnect()
  })
}

