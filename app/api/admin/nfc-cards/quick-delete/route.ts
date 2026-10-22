import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  try {
    try {
      await requirePermission(PERMISSIONS.MANAGE_DEVICES)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { nfc_uid } = body

    if (!nfc_uid) {
      return NextResponse.json({ error: 'NFC UID is required' }, { status: 400 })
    }

    const card = await prisma.nfcCard.findFirst({
      where: {
        nfcUid: {
          equals: nfc_uid.trim(),
          mode: 'insensitive',
        },
      },
    })

    if (!card) {
      return NextResponse.json({ error: 'NFC Card not found' }, { status: 404 })
    }

    // Only cards associated with an auction (temporary cards) can be deleted via quick delete
    if (!card.auctionId) {
      return NextResponse.json({ error: 'Only temporary NFC cards can be deleted using this method' }, { status: 403 })
    }

    await prisma.nfcCard.delete({
      where: { id: card.id },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Error in quick delete NFC card:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
