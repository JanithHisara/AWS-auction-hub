import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword, createSession } from '@/lib/auth'
import { sendWelcomeEmail } from '@/lib/email/resend'

export async function POST(request: Request) {
  try {
    const { email, password, options } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
    }

    // Generate unique anonymous name (e.g. Bidder-123456)
    let anonName = `Bidder-${Math.floor(100000 + Math.random() * 900000)}`
    let attempts = 0
    while (attempts < 10) {
      const exists = await prisma.user.findUnique({ where: { anonymousName: anonName } })
      if (!exists) break
      anonName = `Bidder-${Math.floor(100000 + Math.random() * 900000)}`
      attempts++
    }

    const hashedPassword = await hashPassword(password)
    const displayName = options?.data?.display_name || null
    const phone = options?.data?.phone || null

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: hashedPassword,
        role: 'user',
        anonymousName: anonName,
        displayName,
        phone,
      },
    })

    // Initialize user rewards record
    await prisma.userRewards.create({
      data: {
        userId: user.id,
        totalPoints: 50, // Welcome points
      },
    }).catch(() => {})

    await createSession(user.id)

    try {
      console.log('[Register] Sending registration confirmation email to:', user.email)
      const emailResult = await sendWelcomeEmail({
        to: user.email,
        userName: user.displayName || user.anonymousName,
      })
      console.log('[Register] Registration confirmation email sent successfully:', emailResult)
    } catch (err) {
      console.error('[Register] Could not send welcome/confirm email:', err)
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        anonymous_name: user.anonymousName,
        display_name: user.displayName,
        phone: user.phone,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: error.message || 'Registration failed' }, { status: 500 })
  }
}
