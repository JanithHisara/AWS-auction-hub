import type { Request, Response } from 'express'
import prisma from '../../../lib/prisma'
import { PERMISSIONS } from '../../../lib/permissions'
import { authorizeAdmin } from '../_auth'

export async function getAuctionsList(request: Request, response: Response) {
  try {
    if (!await authorizeAdmin(request, response, PERMISSIONS.MANAGE_DEVICES)) return
    const auctions = await prisma.auction.findMany({
      where: { status: { in: ['registration_open', 'live'] } },
      select: { id: true, name: true, status: true },
      orderBy: { name: 'asc' },
    })
    response.json({ auctions })
  } catch (error) {
    console.error('Failed to load auctions for NFC cards:', error)
    response.status(500).json({ error: 'Failed to load auctions.' })
  }
}
