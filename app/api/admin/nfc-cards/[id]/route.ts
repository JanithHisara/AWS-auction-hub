import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    try {
      await requirePermission(PERMISSIONS.MANAGE_DEVICES)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { is_active, label } = body

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (is_active !== undefined) {
      updateData.isActive = is_active
    }

    if (label !== undefined) {
      updateData.label = label
    }

    const card = await prisma.nfcCard.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, email: true, displayName: true },
        },
      },
    })

    return NextResponse.json({
      nfcCard: {
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
      },
    })
  } catch (error: any) {
    console.error('Error updating NFC card:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    try {
      await requirePermission(PERMISSIONS.MANAGE_DEVICES)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    await prisma.nfcCard.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting NFC card:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
