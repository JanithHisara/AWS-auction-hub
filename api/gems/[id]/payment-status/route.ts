import type { Request, Response } from 'express'
import prisma from '../../../../lib/prisma'
import { authorize, getSessionToken, jsonError, validId } from '../../../admin/_auth'

export async function GET(request: Request, response: Response) {
  response.setHeader('Cache-Control', 'private, no-store')
  if (!getSessionToken(request)) {
    jsonError(response, 401, 'Authentication required.')
    return
  }
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const gemId = request.params.id
  if (!validId(gemId)) {
    jsonError(response, 400, 'Invalid item ID.')
    return
  }
  const [winner, payment] = await Promise.all([
    prisma.auctionWinner.findFirst({
      where: { gemId: gemId as string, userId: user.id },
      select: { id: true },
    }),
    prisma.payment.findFirst({
      where: { gemId: gemId as string, userId: user.id, status: 'completed' },
      select: { id: true },
    }),
  ])
  response.json({ isWinner: Boolean(winner), paymentCompleted: Boolean(payment) })
}
