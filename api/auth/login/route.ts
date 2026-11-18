import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../../../lib/prisma'
import { sessionCookieSecure } from '../../../lib/config'

const SESSION_COOKIE_NAME = 'auction_hub_session'
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000
const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function postLogin(request: Request, response: Response): Promise<void> {
  const body: unknown = request.body
  if (!body || typeof body !== 'object') {
    response.status(400).json({ error: 'Request body must be a JSON object.' })
    return
  }

  const { email: submittedEmail, password } = body as {
    email?: unknown
    password?: unknown
  }
  const email = typeof submittedEmail === 'string' ? submittedEmail.trim().toLowerCase() : ''

  if (!email || typeof password !== 'string' || !password) {
    response.status(400).json({ error: 'Email and password are required.' })
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
        displayName: true,
        anonymousName: true,
        phone: true,
      },
    })

    if (
      !user ||
      !user.passwordHash ||
      !user.isActive ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      response.status(401).json({ error: 'Invalid email or password.' })
      return
    }

    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS)

    await prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt,
      },
    })

    response.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: sessionCookieSecure(),
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    })

    const role = SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()) ? 'super_admin' : user.role
    if (role === 'super_admin' && user.role !== 'super_admin') {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'super_admin' },
      }).catch(() => {})
    }
    response.json({
      user: {
        id: user.id,
        email: user.email,
        role,
        anonymous_name: user.anonymousName,
        display_name: user.displayName,
        phone: user.phone,
      },
    })
  } catch (error) {
    console.error('User login failed:', error)
    response.status(500).json({ error: 'Login failed due to a server error.' })
  }
}
