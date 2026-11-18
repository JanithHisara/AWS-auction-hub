import { type Request, type Response } from 'express'
import prisma from '../../../../lib/prisma'
import { authorize, validId, jsonError, mapRegistration } from '../../../admin/_auth'
import { broadcastEvent } from '../../../../lib/events'

function getAuctionId(request: Request): string {
  const param = request.params?.id
  return (Array.isArray(param) ? param[0] : param) || ''
}

export async function GET(request: Request, response: Response) {
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const auctionId = getAuctionId(request)
  if (!validId(auctionId)) {
    jsonError(response, 400, 'Invalid auction ID.')
    return
  }
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } })
  if (!auction || !['published', 'active', 'live', 'upcoming', 'registration_open'].includes(auction.status)) {
    jsonError(response, 404, 'Auction not found.')
    return
  }
  const registration = await prisma.auctionRegistration.findUnique({
    where: { auctionId_userId: { auctionId, userId: user.id } },
  })
  response.json({ registration: registration ? mapRegistration(registration) : null })
}

export async function POST(request: Request, response: Response) {
  const user = await authorize(request, response, undefined, true)
  if (!user) return
  const auctionId = getAuctionId(request)
  if (!validId(auctionId)) {
    jsonError(response, 400, 'Invalid auction ID.')
    return
  }
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } })
  if (!auction || !['published', 'active', 'live', 'upcoming', 'registration_open'].includes(auction.status)) {
    jsonError(response, 404, 'Auction not found.')
    return
  }
  const now = new Date()
  if ((auction.registrationStart && auction.registrationStart > now) ||
    (auction.registrationEnd && auction.registrationEnd < now)) {
    jsonError(response, 409, 'Auction registration is not currently open.')
    return
  }
  const result = await prisma.$transaction(async tx => {
    const existing = await tx.auctionRegistration.findUnique({
      where: { auctionId_userId: { auctionId, userId: user.id } },
    })
    if (existing) return { registration: existing, created: false }
    if (auction.maxParticipants !== null) {
      const registeredCount = await tx.auctionRegistration.count({
        where: { auctionId, isActive: true },
      })
      if (registeredCount >= auction.maxParticipants) return null
    }
    const registration = await tx.auctionRegistration.create({ data: { auctionId, userId: user.id } })
    return { registration, created: true }
  }, { isolationLevel: 'Serializable' })
  if (!result) {
    jsonError(response, 409, 'This auction has reached its participant limit.')
    return
  }
  if (result.created) {
    broadcastEvent({
      channel: `auction-${auctionId}`,
      table: 'auction_registrations',
      eventType: 'INSERT',
      new: mapRegistration(result.registration),
    })
  }
  response.status(result.created ? 201 : 200).json({ registration: mapRegistration(result.registration) })
}
