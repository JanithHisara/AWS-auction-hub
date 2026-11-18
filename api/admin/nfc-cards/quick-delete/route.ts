import type { Request, Response } from 'express'
import prisma from '../../../../lib/prisma'
import { PERMISSIONS } from '../../../../lib/permissions'
import { authorizeAdmin } from '../../_auth'
import { broadcastEvent } from '../../../../lib/events'

export async function quickDeleteNfcCard(request: Request, response: Response) {
  try {
    if (!await authorizeAdmin(request, response, PERMISSIONS.MANAGE_DEVICES)) return
    const uid = typeof request.body?.nfc_uid === 'string' ? request.body.nfc_uid.trim() : ''
    if (!uid) {
      response.status(400).json({ error: 'NFC UID is required.' })
      return
    }

    const card = await prisma.nfcCard.findUnique({ where: { nfcUid: uid }, select: { id: true, type: true } })
    if (!card || card.type !== 'temporary') {
      response.status(404).json({ error: 'Temporary NFC card not found.' })
      return
    }
    await prisma.nfcCard.delete({ where: { id: card.id } })
    broadcastEvent({
      channel: 'admin-nfc',
      table: 'nfc_cards',
      eventType: 'DELETE',
      old: { id: card.id },
    })
    response.json({ success: true })
  } catch (error) {
    console.error('Failed to quick-delete NFC card:', error)
    response.status(500).json({ error: 'Failed to delete NFC card.' })
  }
}
