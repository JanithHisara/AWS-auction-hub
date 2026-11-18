import { type Request, type Response } from 'express'
import prisma from '../../../../../../lib/prisma'
import { authorize, jsonError, validId, bodyOf, mapRegistration, PERMISSIONS } from '../../../../_auth'
import { randomUUID } from 'crypto'
import { broadcastEvent } from '../../../../../../lib/events'

export async function PATCH(request: Request, response: Response) {
  const admin = await authorize(request, response, PERMISSIONS.MANAGE_REGISTRATIONS)
  if (!admin) return
  const auctionId = ((request as any).params?.id as string) || ''
  const registrationId = ((request as any).params?.registrationId as string) || ''
  if (!validId(auctionId) || !validId(registrationId)) {
    jsonError(response, 400, 'Invalid auction or registration ID.')
    return
  }
  const registration = await prisma.auctionRegistration.findFirst({
    where: { id: registrationId, auctionId },
  })
  if (!registration) {
    jsonError(response, 404, 'Registration not found.')
    return
  }
  const body = bodyOf(request)
  const approvalStatus = body.approval_status ?? body.status
  if (!['approved', 'pending', 'rejected'].includes(approvalStatus)) {
    jsonError(response, 400, 'Invalid registration status.')
    return
  }
  const updated = await prisma.auctionRegistration.update({
    where: { id: registration.id },
    data: {
      approvalStatus,
      approvedAt: approvalStatus === 'approved' ? new Date() : null,
      isActive: approvalStatus !== 'rejected',
      ...(approvalStatus === 'approved' && !registration.accessTokenHash
        ? { accessTokenHash: randomUUID() }
        : {}),
    },
  })
  broadcastEvent({
    channel: `auction-${auctionId}`,
    table: 'auction_registrations',
    eventType: 'UPDATE',
    new: mapRegistration(updated),
  })
  response.json({ registration: mapRegistration(updated) })
}
