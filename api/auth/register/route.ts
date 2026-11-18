import type { Request, Response } from 'express'
import prisma from '../../../lib/prisma'
import { hashPassword } from '../../../lib/auth'

interface RegisterRequest {
  name?: unknown
  phone?: unknown
  email?: unknown
  password?: unknown
}

export async function postRegister(request: Request, response: Response): Promise<void> {
  const body = request.body as RegisterRequest | undefined

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!name || !phone || !email || !password) {
    response.status(400).json({ error: 'Name, phone, email, and password are required.' })
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    response.status(400).json({ error: 'Enter a valid email address.' })
    return
  }
  if (!/^\+?\d{7,15}$/.test(phone.replace(/[\s\-().]/g, ''))) {
    response.status(400).json({ error: 'Enter a valid phone number.' })
    return
  }
  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    response.status(400).json({
      error: 'Password must be at least 8 characters and include uppercase, lowercase, and numeric characters.',
    })
    return
  }

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        displayName: name,
        phone,
      },
      select: {
        id: true,
        email: true,
      },
    })

    response.status(201).json({ user })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      response.status(409).json({ error: 'An account with this email already exists.' })
      return
    }

    console.error('User registration failed:', error)
    response.status(500).json({ error: 'Registration failed due to a server error.' })
  }
}
