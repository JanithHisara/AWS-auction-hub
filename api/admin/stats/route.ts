import { type Request, type Response } from 'express'
import prisma from '../../../lib/prisma'
import { authorize, PERMISSIONS } from '../_auth'

export async function GET(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.VIEW_DASHBOARD)
  if (!admin) return
  const [users, auctions, gems, registrations, payments] = await prisma.$transaction([
    prisma.user.count(), prisma.auction.count(), prisma.gem.count(),
    prisma.auctionRegistration.count(), prisma.payment.count(),
  ])
  response.json({ users, auctions, gems, registrations, payments })
}
