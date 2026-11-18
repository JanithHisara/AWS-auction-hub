import { type Request, type Response } from 'express'
import prisma from '../../lib/prisma'
import { authorize, jsonError, PERMISSIONS } from '../admin/_auth'

export async function GET(request: Request, response: Response) {
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const uid = typeof request.query.uid === 'string' ? request.query.uid.trim() : ''
  if (!uid) {
    jsonError(response, 400, 'NFC UID is required.')
    return
  }
  const card = await prisma.nfcCard.findUnique({
    where: { nfcUid: uid },
    select: {
      id: true, userId: true, auctionId: true, type: true, label: true, isActive: true,
      user: { select: { id: true, email: true, displayName: true, anonymousName: true } },
    },
  })
  if (!card || !card.isActive) {
    jsonError(response, 404, 'Active NFC card not found.')
    return
  }
  if (card.userId !== user.id && !user.permissions.has(PERMISSIONS.MANAGE_DEVICES)) {
    jsonError(response, 403, 'You may only inspect your own NFC card.')
    return
  }
  response.json({ card })
}
