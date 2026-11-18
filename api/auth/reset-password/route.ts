import { randomBytes, createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { type Request, type Response } from 'express'
import prisma from '../../../lib/prisma'
import { jsonError, bodyOf } from '../../admin/_auth'
import { sendPasswordResetEmail } from '../../../lib/email/resend'

export async function POST(request: Request, response: Response) {
  const email = typeof bodyOf(request).email === 'string'
    ? bodyOf(request).email.trim().toLowerCase()
    : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    jsonError(response, 400, 'A valid email address is required.')
    return
  }
  if (!process.env.RESEND_API_KEY) {
    jsonError(response, 503, 'Password reset email is not configured.', 'EMAIL_PROVIDER_UNAVAILABLE')
    return
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, displayName: true },
  })
  if (user) {
    const token = randomBytes(32).toString('base64url')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    const resetUrl = new URL('/reset-password', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    resetUrl.searchParams.set('token', token)
    const stored = await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
      select: { id: true },
    })
    try {
      await sendPasswordResetEmail({ to: user.email, resetLink: resetUrl.toString() })
    } catch {
      await prisma.passwordResetToken.deleteMany({ where: { id: stored.id } })
      jsonError(response, 503, 'Unable to send password reset email.', 'EMAIL_DELIVERY_FAILED')
      return
    }
  }
  response.json({ success: true })
}

export async function PUT(request: Request, response: Response) {
  const body = bodyOf(request)
  const token = typeof body.token === 'string' ? body.token : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!token || password.length < 8) {
    jsonError(response, 400, 'A valid reset token and password of at least 8 characters are required.')
    return
  }
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const passwordHash = await bcrypt.hash(password, 10)
  const completed = await prisma.$transaction(async tx => {
    const reset = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    })
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) return false
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    })
    if (claimed.count !== 1) return false
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } })
    await tx.userSession.deleteMany({ where: { userId: reset.userId } })
    return true
  })
  if (!completed) {
    jsonError(response, 400, 'This password reset link is invalid or expired.')
    return
  }
  response.json({ success: true })
}
