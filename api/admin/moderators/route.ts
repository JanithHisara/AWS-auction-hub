import type { Request, Response } from 'express'
import prisma from '../../../lib/prisma'
import { PERMISSIONS } from '../../../lib/permissions'
import { authorizeAdmin } from '../_auth'

export async function getModerators(request: Request, response: Response) {
  try {
    if (!await authorizeAdmin(request, response, PERMISSIONS.MANAGE_AUCTIONS)) return

    const users = await prisma.user.findMany({
      where: { role: { in: ['moderator', 'admin', 'super_admin'] }, isActive: true },
      select: { id: true, email: true, displayName: true, role: true },
      orderBy: { email: 'asc' },
    })
    response.json({
      moderators: users.map(user => ({
        id: user.id,
        email: user.email,
        display_name: user.displayName || user.email.split('@')[0],
        role: user.role,
      })),
    })
  } catch (error) {
    console.error('Failed to load moderators:', error)
    response.status(500).json({ error: 'Failed to load moderators.' })
  }
}
