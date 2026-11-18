import type { Request, Response } from 'express'
import prisma from '../../../../lib/prisma'
import { PERMISSIONS } from '../../../../lib/permissions'
import { authorizeAdmin } from '../../_auth'
import { broadcastEvent } from '../../../../lib/events'

export async function updateNfcCard(request: Request, response: Response) {
  try {
    if (!await authorizeAdmin(request, response, PERMISSIONS.MANAGE_DEVICES)) return
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id
    const data: { label?: string | null; isActive?: boolean } = {}
    if (typeof request.body?.is_active === 'boolean') data.isActive = request.body.is_active
    if (typeof request.body?.label === 'string' || request.body?.label === null) {
      data.label = typeof request.body.label === 'string' && request.body.label.trim()
        ? request.body.label.trim()
        : null
    }
    if (!id || Object.keys(data).length === 0) {
      response.status(400).json({ error: 'A card ID and at least one valid field are required.' })
      return
    }

    const updated = await prisma.nfcCard.update({
      where: { id },
      data,
      select: {
        id: true, nfcUid: true, userId: true, isActive: true, label: true, type: true,
        createdAt: true, updatedAt: true,
        user: { select: { id: true, email: true, displayName: true } },
        createdBy: { select: { email: true, displayName: true } },
      },
    })
    const mappedCard = {
      id: updated.id, nfc_uid: updated.nfcUid, user_id: updated.userId,
      is_active: updated.isActive, label: updated.label, nfc_type: updated.type,
      created_at: updated.createdAt, updated_at: updated.updatedAt,
      users: { id: updated.user.id, email: updated.user.email, display_name: updated.user.displayName },
      created_by_user: updated.createdBy
        ? { email: updated.createdBy.email, display_name: updated.createdBy.displayName }
        : null,
    }
    broadcastEvent({
      channel: 'admin-nfc',
      table: 'nfc_cards',
      eventType: 'UPDATE',
      new: mappedCard,
    })
    response.json({ nfcCard: mappedCard })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      response.status(404).json({ error: 'NFC card not found.' })
      return
    }
    console.error('Failed to update NFC card:', error)
    response.status(500).json({ error: 'Failed to update NFC card.' })
  }
}

export async function deleteNfcCard(request: Request, response: Response) {
  try {
    if (!await authorizeAdmin(request, response, PERMISSIONS.MANAGE_DEVICES)) return
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id
    if (!id) {
      response.status(400).json({ error: 'A card ID is required.' })
      return
    }
    await prisma.nfcCard.delete({ where: { id } })
    broadcastEvent({
      channel: 'admin-nfc',
      table: 'nfc_cards',
      eventType: 'DELETE',
      old: { id },
    })
    response.json({ success: true })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      response.status(404).json({ error: 'NFC card not found.' })
      return
    }
    console.error('Failed to delete NFC card:', error)
    response.status(500).json({ error: 'Failed to delete NFC card.' })
  }
}
