import { requireAuctionManager } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import GemForm from '@/components/gems/GemForm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'

export default async function EditGemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound()
  const user = await requireAuctionManager(undefined, id, PERMISSIONS.MANAGE_ITEMS)

  const gemRecord = await prisma.gem.findUnique({
    where: { id },
    include: {
      auction: { select: { auctionType: true } },
      images: { orderBy: { displayOrder: 'asc' } },
      certificates: true,
    },
  })

  if (!gemRecord) notFound()

  const auctionType = gemRecord.auction?.auctionType
  const auctionTypeSegment = auctionType === 'incremental_approval_auction'
    ? 'incremental'
    : auctionType === 'progressive_elimination_auction'
      ? 'progressive'
      : auctionType === 'tender_base_fixed_bid'
        ? 'tender'
        : null

  const backHref = gemRecord.auctionId && auctionTypeSegment
    ? `/admin/auctions/${auctionTypeSegment}/${gemRecord.auctionId}`
    : '/admin/auctions'

  const auctionRecords = await prisma.auction.findMany({
    where: {
      status: { in: ['draft', 'upcoming', 'registration_open'] },
      ...(user.role === 'moderator'
        ? {
            OR: [
              { moderatorId: user.id },
              { moderators: { some: { userId: user.id } } },
              { createdById: user.id },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      status: true,
      auctionStart: true,
      auctionEnd: true,
      auctionType: true,
    },
    orderBy: { auctionStart: 'asc' },
  })

  const auctions = auctionRecords.map(a => ({
    id: a.id,
    name: a.name,
    status: a.status,
    auction_start: a.auctionStart,
    auction_end: a.auctionEnd,
    auction_type: a.auctionType,
  }))

  const gem = {
    ...gemRecord,
    auction_id: gemRecord.auctionId,
    admin_id: gemRecord.createdById,
    starting_price: Number(gemRecord.startingPrice),
    current_price: gemRecord.currentPrice === null ? null : Number(gemRecord.currentPrice),
    min_bid_increment: Number(gemRecord.minBidIncrement),
    carat_weight: gemRecord.caratWeight === null ? null : Number(gemRecord.caratWeight),
    start_time: gemRecord.startTime,
    end_time: gemRecord.endTime,
    round_end_time: gemRecord.roundEndTime,
    published_at: gemRecord.publishedAt,
    created_at: gemRecord.createdAt,
    updated_at: gemRecord.updatedAt,
    images: gemRecord.images.map(img => ({
      id: img.id,
      gem_id: img.gemId,
      image_url: img.imageUrl,
      media_type: img.mediaType,
      display_order: img.displayOrder,
      created_at: img.createdAt,
    })),
    certificates: gemRecord.certificates.map(cert => ({
      id: cert.id,
      gem_id: cert.gemId,
      certificate_url: cert.certificateUrl,
      certificate_type: cert.certificateType,
      created_at: cert.createdAt,
    })),
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link 
        href={backHref}
        className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-white mb-6 transition-colors"
      >
        Back to Auction
      </Link>

      <div className="card-glass rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Edit Item</h1>
        <p className="text-[var(--text-secondary)] mb-8">Update item details</p>
        
        <GemForm 
          gem={gem as any} 
          auctions={auctions as any}
        />
      </div>
    </div>
  )
}
