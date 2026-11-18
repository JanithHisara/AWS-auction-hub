import { type Request, type Response } from 'express'
import prisma from '../../../lib/prisma'
import { jsonError } from '../../admin/_auth'

export async function GET(request: Request, response: Response) {
  const secret = process.env.CRON_SECRET
  const supplied = request.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    (typeof request.query.secret === 'string' ? request.query.secret : '')
  if (!secret || supplied !== secret) {
    jsonError(response, 401, 'Valid cron authorization is required.')
    return
  }
  const now = new Date()
  const [started, ended] = await prisma.$transaction([
    prisma.auction.updateMany({
      where: { status: 'published', auctionStart: { lte: now } },
      data: { status: 'live' },
    }),
    prisma.auction.updateMany({
      where: { status: { in: ['published', 'live', 'active'] }, auctionEnd: { lte: now } },
      data: { status: 'completed' },
    }),
  ])
  response.json({ success: true, started: started.count, completed: ended.count })
}

export async function POST(request: Request, response: Response) {
  return GET(request, response)
}
