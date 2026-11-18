import { type Request, type Response } from 'express'
import prisma from '../../../lib/prisma'
import { authorize, getSessionToken, jsonError } from '../../admin/_auth'
import bcrypt from 'bcryptjs'
import { createHash } from 'node:crypto'

export async function GET(request: Request, response: Response) {
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  response.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  })
}

export async function PATCH(request: Request, response: Response) {
  const sessionToken = getSessionToken(request)
  if (!sessionToken) {
    jsonError(response, 401, 'Authentication required.')
    return
  }
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const body: Record<string, any> = (request as any).body ?? {}
  if (Object.keys(body).some(key => !['display_name', 'current_password', 'new_password'].includes(key))) {
    jsonError(response, 400, 'Only display name and password changes are supported.')
    return
  }
  const data: Record<string, any> = {}
  if (typeof body.display_name === 'string' && body.display_name.trim()) data.displayName = body.display_name.trim()
  if ('current_password' in body || 'new_password' in body) {
    if (typeof body.current_password !== 'string' || typeof body.new_password !== 'string' ||
        body.new_password.length < 8 || Buffer.byteLength(body.new_password, 'utf8') > 72) {
      jsonError(response, 400, 'Current password and a new password of at least 8 characters (maximum 72 UTF-8 bytes) are required.')
      return
    }
    const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } })
    if (!record || !record.passwordHash || !await bcrypt.compare(body.current_password, record.passwordHash)) {
      jsonError(response, 400, 'Current password is incorrect.')
      return
    }
    data.passwordHash = await bcrypt.hash(body.new_password, 10)
  }
  if (Object.keys(data).length === 0) {
    jsonError(response, 400, 'No valid fields to update.')
    return
  }
  const updated = await prisma.$transaction(async tx => {
    const result = await tx.user.update({
      where: { id: user.id }, data,
      select: { id: true, email: true, displayName: true, role: true },
    })
    if (data.passwordHash) {
      await tx.userSession.deleteMany({
        where: { userId: user.id, tokenHash: { not: createHash('sha256').update(sessionToken).digest('hex') } },
      })
    }
    return result
  })
  response.json({
    id: updated.id,
    email: updated.email,
    displayName: updated.displayName,
    role: updated.role,
  })
}
