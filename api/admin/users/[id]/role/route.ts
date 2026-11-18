import type { Request, Response } from 'express'
import prisma from '../../../../../lib/prisma'
import { ASSIGNABLE_ROLES, PERMISSIONS } from '../../../../../lib/permissions'
import { authorizeAdmin } from '../../../_auth'
import { broadcastEvent } from '../../../../../lib/events'

export async function updateUserRole(request: Request, response: Response) {
  try {
    const admin = await authorizeAdmin(request, response, PERMISSIONS.ASSIGN_ROLES)
    if (!admin) return

    const userId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id
    const role = request.body?.role
    if (!userId || typeof role !== 'string' ||
      !ASSIGNABLE_ROLES.includes(role as typeof ASSIGNABLE_ROLES[number])) {
      response.status(400).json({ error: 'A valid user ID and assignable role are required.' })
      return
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    })
    if (!target) {
      response.status(404).json({ error: 'User not found.' })
      return
    }
    if (target.role === 'super_admin' ||
      (process.env.SUPER_ADMIN_EMAILS || '').split(',').some(email =>
        email.trim().toLowerCase() === target.email.toLowerCase()
      )) {
      response.status(403).json({ error: 'Super admin roles cannot be changed here.' })
      return
    }

    const roleRecord = await prisma.role.upsert({
      where: { name: role },
      update: {},
      create: { name: role },
    })
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { role } }),
      prisma.userRole.deleteMany({ where: { userId } }),
      prisma.userRole.create({ data: { userId, roleId: roleRecord.id } }),
    ])
    broadcastEvent({
      channel: 'admin-users',
      table: 'users',
      eventType: 'UPDATE',
      new: { id: userId, role },
    })
    response.json({ success: true })
  } catch (error) {
    console.error('Failed to update user role:', error)
    response.status(500).json({ error: 'Failed to update user role.' })
  }
}
