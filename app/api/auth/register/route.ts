import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword, generateConfirmationToken } from '@/lib/auth'
import { sendConfirmationEmail } from '@/lib/email/resend'

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
        emailVerified: false,
      },
    })

    // Initialize user rewards record
    await prisma.userRewards.create({
      data: {
        userId: user.id,
        totalPoints: 50, // Welcome points
      },
    }).catch(() => {})

    const token = generateConfirmationToken(user.id, user.email)
    const requestUrl = new URL(request.url)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin
    const confirmLink = `${appUrl}/api/auth/confirm-email?token=${token}`

    try {
      console.log('[Register] Sending confirmation email to:', user.email)
      const emailResult = await sendConfirmationEmail({
        to: user.email,
        userName: user.displayName || user.anonymousName,
        confirmLink,
      })
      console.log('[Register] Confirmation email sent successfully:', emailResult)
    } catch (err) {
      console.error('[Register] Could not send confirmation email:', err)
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        anonymous_name: user.anonymousName,
        display_name: user.displayName,
        phone: user.phone,
        email_verified: false,
      },
      message: 'Registration successful. Please check your email to confirm your account.',
      requiresConfirmation: true,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: error.message || 'Registration failed' }, { status: 500 })
  }
}
