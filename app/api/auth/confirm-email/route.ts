import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyConfirmationToken } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url)
    const token = searchParams.get('token')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin

    if (!token) {
      return NextResponse.redirect(`${appUrl}/login?error=Invalid+confirmation+link`)
    }

    const payload = verifyConfirmationToken(token)
    if (!payload) {
      return NextResponse.redirect(`${appUrl}/login?error=Confirmation+link+is+invalid+or+has+expired`)
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return NextResponse.redirect(`${appUrl}/login?error=User+not+found`)
    }

    // Mark user email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    })

    return NextResponse.redirect(`${appUrl}/auth/confirmed`)
  } catch (error: any) {
    console.error('Email confirmation error:', error)
    const { origin } = new URL(request.url)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin
    return NextResponse.redirect(`${appUrl}/login?error=Failed+to+confirm+email`)
  }
}
