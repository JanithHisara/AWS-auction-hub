import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import GemForm from '@/components/gems/GemForm'
import Link from 'next/link'
import prisma from '@/lib/prisma'

async function getAuctions(user: { id: string; role?: string }) {
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

  return auctionRecords.map(a => ({
    id: a.id,
    name: a.name,
    status: a.status,
    auction_start: a.auctionStart,
    auction_end: a.auctionEnd,
    auction_type: a.auctionType,
  }))
}

export default async function NewGemPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ auction_id?: string }> 
}) {
  const user = await requirePermission(PERMISSIONS.CREATE_ITEMS)
  const { auction_id } = await searchParams
  const auctions = await getAuctions(user)

  return (
    <div className="max-w-3xl mx-auto">
      <Link 
        href={auction_id ? `/admin/auctions` : `/admin/auctions`}
        className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-white mb-6 transition-colors"
      >
        Back to Items
      </Link>

      <div className="card-glass rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Add New Item</h1>
        <p className="text-[var(--text-secondary)] mb-8">Create a new auction item</p>
        
        <GemForm auctions={auctions as any} defaultAuctionId={auction_id} />
      </div>
    </div>
  )
}
