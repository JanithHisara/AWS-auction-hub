import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { generateResetToken, verifyResetToken, hashPassword } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/email/resend'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (user) {
      const token = generateResetToken(user.id, user.email)
      const requestUrl = new URL(request.url)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin
      const resetLink = `${appUrl}/reset-password?token=${token}`

      await sendPasswordResetEmail({
        to: user.email,
        resetLink,
      }).catch(err => {
        console.error('Failed to send reset email:', err)
      })
    }

    return NextResponse.json({ success: true, message: 'Password reset link sent' })
  } catch (error: any) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { token, password } = await request.json()
    if (!token || !password) {
      return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const payload = verifyResetToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Reset link is invalid or has expired' }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)
    await prisma.user.update({
      where: { id: payload.userId },
      data: { passwordHash: hashedPassword },
    })

    return NextResponse.json({ success: true, message: 'Password updated successfully' })
  } catch (error: any) {
    console.error('Confirm reset password error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update password' },
      { status: 500 }
    )
  }
}
