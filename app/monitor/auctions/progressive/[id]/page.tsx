import AuctionMonitorClient from '@/components/auctions/progressive/ProgressiveMonitor'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AuctionMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const auction = await prisma.auction.findUnique({
    where: { id },
    include: {
      gems: {
        include: {
          images: { orderBy: { displayOrder: 'asc' } },
          bids: {
            include: {
              user: { select: { id: true, displayName: true, anonymousName: true, email: true } },
            },
            orderBy: [{ bidAmount: 'desc' }, { createdAt: 'desc' }],
          },
          winner: {
            include: {
              user: { select: { id: true, displayName: true, anonymousName: true, email: true } },
            },
          },
          eliminations: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      registrations: {
        where: { approvalStatus: 'approved', isActive: true },
      },
    },
  })

  if (!auction) notFound()
  if (auction.auctionType !== 'progressive_elimination_auction') notFound()

  const formattedItems = auction.gems.map(g => {
    const highestBid = g.bids[0] ? Number(g.bids[0].bidAmount) : Number(g.currentPrice ?? g.startingPrice)
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      starting_price: Number(g.startingPrice),
      current_price: Number(g.currentPrice ?? g.startingPrice),
      min_bid_increment: Number(g.minBidIncrement),
      status: g.status,
      carat_weight: g.caratWeight ? Number(g.caratWeight) : null,
      color: g.color,
      provenance: g.provenance,
      start_time: g.startTime ? g.startTime.toISOString() : null,
      end_time: g.endTime ? g.endTime.toISOString() : null,
      round_end_time: g.roundEndTime ? g.roundEndTime.toISOString() : null,
      gem_images: g.images.map(img => ({
        image_url: img.imageUrl,
        media_type: img.mediaType,
        display_order: img.displayOrder,
      })),
      bids: g.bids.slice(0, 15).map(b => ({
        id: b.id,
        bid_amount: Number(b.bidAmount),
        created_at: b.createdAt.toISOString(),
        user: {
          display_name: b.user?.displayName || null,
          anonymous_name: b.user?.anonymousName || null,
        },
      })),
      bidCount: g.bids.length,
      bidderCount: new Set(g.bids.map(b => b.userId)).size,
      eliminatedCount: g.eliminations.length,
      highestBid,
      winner: g.winner ? {
        winning_amount: Number(g.winner.winningAmount),
        user: {
          display_name: g.winner.user?.displayName || null,
          anonymous_name: g.winner.user?.anonymousName || null,
        },
      } : null,
    }
  })

  return (
    <AuctionMonitorClient
      auction={{
        id: auction.id,
        name: auction.name,
        description: auction.description,
        status: auction.status,
        auction_type: auction.auctionType,
        auction_start: auction.auctionStart ? auction.auctionStart.toISOString() : '',
        auction_end: auction.auctionEnd ? auction.auctionEnd.toISOString() : '',
        banner_image_url: auction.bannerImageUrl,
        registeredCount: auction.registrations.length,
        items: formattedItems,
      } as any}
    />
  )
}
