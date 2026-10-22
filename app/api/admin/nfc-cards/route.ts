import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requirePermission } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { sendAuctionAccessEmail } from '@/lib/email/resend'

export async function GET(request: NextRequest) {
  try {
    try {
      await requirePermission(PERMISSIONS.MANAGE_DEVICES)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''
    const statusFilter = searchParams.get('status') || ''
    const nfcTypeFilter = searchParams.get('nfc_type') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = 20
    const offset = (page - 1) * limit

    const where: any = {}

    // Search filter across nfcUid or label
    if (search) {
      where.OR = [
        { nfcUid: { contains: search, mode: 'insensitive' } },
        { label: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Active status filter
    if (statusFilter === 'active') {
      where.isActive = true
    } else if (statusFilter === 'inactive') {
      where.isActive = false
    }

    // Temporary vs Permanent filter
    // Temporary cards have auctionId assigned; Permanent cards have auctionId as null
    if (nfcTypeFilter === 'temporary') {
      where.auctionId = { not: null }
    } else if (nfcTypeFilter === 'permanent') {
      where.auctionId = null
    }

    const [total, nfcCardsRaw] = await Promise.all([
      prisma.nfcCard.count({ where }),
      prisma.nfcCard.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
          auction: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ])

    const nfcCards = nfcCardsRaw.map((card) => ({
      id: card.id,
      nfc_uid: card.nfcUid,
      user_id: card.userId,
      auction_id: card.auctionId,
      is_active: card.isActive,
      label: card.label,
      nfc_type: card.auctionId ? 'temporary' : 'permanent',
      created_at: card.createdAt.toISOString(),
      updated_at: card.updatedAt.toISOString(),
      users: card.user ? {
        id: card.user.id,
        email: card.user.email,
        display_name: card.user.displayName,
      } : null,
      created_by_user: null,
      auction: card.auction ? {
        id: card.auction.id,
        name: card.auction.name,
      } : null,
    }))

    return NextResponse.json({
      nfcCards,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (error: any) {
    console.error('Error fetching admin NFC cards:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    try {
      await requirePermission(PERMISSIONS.MANAGE_DEVICES)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { nfc_uid, user_id, label, nfc_type, auction_id } = body

    if (!nfc_uid || !user_id) {
      return NextResponse.json(
        { error: 'NFC UID and User ID are required' },
        { status: 400 },
      )
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: user_id },
      select: { id: true, email: true, displayName: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // NFC UID must be unique
    const existing = await prisma.nfcCard.findFirst({
      where: {
        nfcUid: {
          equals: nfc_uid.trim(),
          mode: 'insensitive',
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'This NFC card is already registered' },
        { status: 409 },
      )
    }

    const assignedAuctionId = (nfc_type === 'temporary' && auction_id) ? auction_id : null

    const newCard = await prisma.nfcCard.create({
      data: {
        nfcUid: nfc_uid.trim(),
        userId: user_id,
        label: label?.trim() || null,
        auctionId: assignedAuctionId,
        isActive: true,
      },
      include: {
        user: {
          select: { id: true, email: true, displayName: true },
        },
        auction: {
          select: { id: true, name: true, description: true, auctionStart: true },
        },
      },
    })

    // Auto-register for auction if temporary card
    if (assignedAuctionId && nfc_type === 'temporary') {
      const token = randomUUID()

      const existingReg = await prisma.auctionRegistration.findFirst({
        where: {
          auctionId: assignedAuctionId,
          userId: user_id,
        },
      })

      if (!existingReg) {
        await prisma.auctionRegistration.create({
          data: {
            auctionId: assignedAuctionId,
            userId: user_id,
            accessToken: token,
            approvalStatus: 'approved',
            approvedAt: new Date(),
            isActive: true,
          },
        })

        if (targetUser.email && newCard.auction) {
          try {
            const auctionDate = new Date(newCard.auction.auctionStart).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            await sendAuctionAccessEmail({
              to: targetUser.email,
              auctionName: newCard.auction.name,
              auctionDate,
              auctionDescription: newCard.auction.description || '',
              accessToken: token,
            })
          } catch (emailErr) {
            console.error('Failed to send confirm email:', emailErr)
          }
        }
      }
    }

    return NextResponse.json({
      nfcCard: {
        id: newCard.id,
        nfc_uid: newCard.nfcUid,
        user_id: newCard.userId,
        auction_id: newCard.auctionId,
        is_active: newCard.isActive,
        label: newCard.label,
        nfc_type: newCard.auctionId ? 'temporary' : 'permanent',
        created_at: newCard.createdAt.toISOString(),
        updated_at: newCard.updatedAt.toISOString(),
        users: {
          id: targetUser.id,
          email: targetUser.email,
          display_name: targetUser.displayName,
        },
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating NFC card:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
