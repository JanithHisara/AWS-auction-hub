import { type Request, type Response } from 'express'
import prisma from '../../lib/prisma'
import { authorize, jsonError, PERMISSIONS } from '../admin/_auth'

export async function GET(request: Request, response: Response) {
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const payments = await prisma.payment.findMany({
    where: user.permissions.has(PERMISSIONS.MANAGE_AUCTIONS) ? {} : { userId: user.id },
    select: {
      id: true, auctionId: true, gemId: true, userId: true, amount: true,
      status: true, provider: true, createdAt: true, paidAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  response.json({ payments })
}

export async function POST(request: Request, response: Response) {
  jsonError(response, 503, 'No payment processor is configured; payment was not created.', 'PAYMENT_PROVIDER_UNAVAILABLE')
}
