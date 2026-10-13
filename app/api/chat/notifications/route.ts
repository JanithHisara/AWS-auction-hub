import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    })

    const isAdmin = dbUser?.role === 'admin' || dbUser?.role === 'super_admin' || dbUser?.role === 'moderator'

    let sinceDate: Date | undefined
    if (since) {
      const sinceNum = Number(since)
      const d = !isNaN(sinceNum) && sinceNum > 0 ? new Date(sinceNum) : new Date(since)
      if (!isNaN(d.getTime())) {
        sinceDate = d
      }
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        senderRole: isAdmin ? 'user' : 'admin',
        ...(sinceDate ? { createdAt: { gt: sinceDate } } : {}),
        conversation: {
          ...(isAdmin ? {} : { userId: user.id }),
          auction: {
            status: { notIn: ['ended', 'completed'] },
          },
        },
      },
      include: {
        conversation: {
          include: {
            auction: {
              select: { id: true, name: true, status: true },
            },
          },
        },
        sender: {
          select: { id: true, email: true, displayName: true, anonymousName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    const notifications = messages.map((m) => {
      const sender = m.sender
      const senderName = m.senderRole === 'admin'
        ? 'Auction Support'
        : (sender?.displayName || sender?.anonymousName || sender?.email || 'Bidder')

      return {
        id: m.id,
        conversation_id: m.conversationId,
        auction_id: m.conversation?.auctionId,
        auction_name: m.conversation?.auction?.name || 'Auction',
        content: m.content,
        sender_name: senderName,
        sender_role: m.senderRole,
        created_at: m.createdAt.toISOString(),
        timestamp: m.createdAt.getTime(),
      }
    })

    return NextResponse.json({ ok: true, notifications })
  } catch (error: any) {
    return NextResponse.json({ ok: false, notifications: [], error: error.message }, { status: 200 })
  }
}