import type { Request, Response } from 'express'
import prisma from '../../../lib/prisma'
import { PERMISSIONS } from '../../../lib/permissions'
import { authorizeAdmin } from '../_auth'

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

export async function getUsers(request: Request, response: Response) {
  try {
    if (!await authorizeAdmin(request, response, [PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_REGISTRATIONS])) return

    const page = Math.max(1, Number(request.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 20))
    const search = typeof request.query.search === 'string' ? request.query.search.trim() : ''
    const role = typeof request.query.role === 'string' ? request.query.role : ''
    const where = {
      ...(role ? { role } : {}),
      ...(search ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { displayName: { contains: search, mode: 'insensitive' as const } },
          { anonymousName: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          role: true,
          displayName: true,
          anonymousName: true,
          phone: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ])

    response.json({
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        role: SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()) ? 'super_admin' : user.role,
        display_name: user.displayName,
        anonymous_name: user.anonymousName,
        phone: user.phone,
        created_at: user.createdAt,
      })),
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    })
  } catch (error) {
    console.error('Failed to load admin users:', error)
    response.status(500).json({ error: 'Failed to load users.' })
  }
}
