import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyPassword, createSession } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (user.passwordHash) {
      const isValid = await verifyPassword(password, user.passwordHash)
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
      }
    } else {
      // First-time login for user migrated without password: set password
      const bcrypt = await import('bcryptjs')
      const hash = await bcrypt.hash(password, 10)
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hash },
      })
    }

    await createSession(user.id)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        anonymous_name: user.anonymousName,
        display_name: user.displayName,
        phone: user.phone,
      },
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 })
  }
}
