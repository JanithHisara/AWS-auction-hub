import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Optional API Key for security (set this in your .env or leave empty for local development)
const NFC_API_SECRET = process.env.NFC_API_SECRET || ''

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const nfcUid = searchParams.get('uid')

    // Optional API Key validation (only enforced if NFC_API_SECRET is set)
    const authHeader = request.headers.get('x-api-key')
    if (NFC_API_SECRET && authHeader !== NFC_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 })
    }

    if (!nfcUid) {
      return NextResponse.json({ error: 'Missing NFC UID parameter (?uid=...)' }, { status: 400 })
    }

    // Look up card in Prisma
    const card = await prisma.nfcCard.findFirst({
      where: {
        nfcUid: {
          equals: nfcUid.trim(),
          mode: 'insensitive',
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            phone: true,
            role: true,
            anonymousName: true,
          },
        },
        auction: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    })

    if (!card) {
      return NextResponse.json(
        { found: false, message: `No NFC card found with UID: ${nfcUid}` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      found: true,
      card: {
        id: card.id,
        nfc_uid: card.nfcUid,
        label: card.label,
        is_active: card.isActive,
        created_at: card.createdAt,
        updated_at: card.updatedAt,
        user: card.user,
        auction: card.auction || null,
      },
    })
  } catch (error: any) {
    console.error('Error fetching NFC card:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
