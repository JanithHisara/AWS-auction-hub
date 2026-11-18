import { createHash } from 'node:crypto'
import type { Request, Response } from 'express'
import prisma from '../../../lib/prisma'
import { sessionCookieSecure } from '../../../lib/config'

const SESSION_COOKIE_NAME = 'auction_hub_session'

function getSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.cookie
  if (!cookieHeader) return null

  const cookie = cookieHeader
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${SESSION_COOKIE_NAME}=`))

  return cookie ? cookie.slice(SESSION_COOKIE_NAME.length + 1) : null
}

export async function postLogout(request: Request, response: Response): Promise<void> {
  try {
    const token = getSessionToken(request)
    if (token) {
      const tokenHash = createHash('sha256').update(token).digest('hex')
      await prisma.userSession.deleteMany({ where: { tokenHash } })
    }

    response.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: sessionCookieSecure(),
      sameSite: 'lax',
      path: '/',
    })
    response.json({ success: true })
  } catch (error) {
    console.error('User logout failed:', error)
    response.status(500).json({ error: 'Unable to log out due to a server error.' })
  }
}
