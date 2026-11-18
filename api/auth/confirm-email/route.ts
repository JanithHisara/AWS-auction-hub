import { type Request, type Response } from 'express'
import prisma from '../../../lib/prisma'
import { verifyConfirmationToken } from '../../../lib/auth'

export async function GET(request: Request, response: Response) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
    const token = typeof request.query.token === 'string' ? request.query.token : ''

    if (!token) {
      response.redirect(`${appUrl}/login?error=Invalid+confirmation+link`)
      return
    }

    const payload = verifyConfirmationToken(token)
    if (!payload) {
      response.redirect(`${appUrl}/login?error=Confirmation+link+is+invalid+or+has+expired`)
      return
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user || user.email.toLowerCase() !== payload.email) {
      response.redirect(`${appUrl}/login?error=User+not+found`)
      return
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    })

    response.redirect(`${appUrl}/auth/confirmed`)
  } catch (error) {
    console.error('Email confirmation error:', error)
    response.redirect(`${appUrl}/login?error=Failed+to+confirm+email`)
  }
}
