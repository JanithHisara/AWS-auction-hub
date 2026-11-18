import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../../../../lib/prisma'
import { PERMISSIONS } from '../../../../lib/permissions'
import { authorizeAdmin } from '../../_auth'

export async function quickCreateUser(request: Request, response: Response) {
  try {
    if (!await authorizeAdmin(request, response, PERMISSIONS.MANAGE_USERS)) return

    const { display_name: displayName, email, phone, password } = request.body ?? {}
    if (typeof displayName !== 'string' || !displayName.trim() ||
      typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof phone !== 'string' || !phone.trim() ||
      typeof password !== 'string' || password.length < 8) {
      response.status(400).json({ error: 'Name, valid email, phone, and a password of at least 8 characters are required.' })
      return
    }

    const user = await prisma.user.create({
      data: {
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        passwordHash: await bcrypt.hash(password, 10),
      },
      select: { id: true, email: true, displayName: true },
    })
    response.status(201).json({
      user: { id: user.id, email: user.email, display_name: user.displayName },
    })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      response.status(409).json({ error: 'An account with this email already exists.' })
      return
    }
    console.error('Failed to quick-create user:', error)
    response.status(500).json({ error: 'Failed to create user.' })
  }
}
