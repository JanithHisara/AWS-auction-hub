import AuctionMonitorClient from '@/components/auctions/tender/TenderMonitor'
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
        },
        orderBy: { createdAt: 'asc' },
      },
      registrations: {
        where: { approvalStatus: 'approved', isActive: true },
      },
    },
  })

  if (!auction) notFound()
  if (auction.auctionType !== 'tender_base_fixed_bid') notFound()

  const isBiddingEnded = ['registration_closed', 'ended', 'completed'].includes(auction.status) || 
    Boolean(auction.auctionEnd && new Date() >= new Date(auction.auctionEnd))

  const formattedItems = auction.gems.map(g => {
    const hasOfficialWinner = Boolean(g.winner)
    const officialWinner = g.winner ? {
      id: g.winner.id,
      winning_amount: Number(g.winner.winningAmount),
      selected_at: g.winner.selectedAt ? g.winner.selectedAt.toISOString() : undefined,
      user: {
        id: g.winner.user?.id,
        display_name: g.winner.user?.displayName || null,
        anonymous_name: g.winner.user?.anonymousName || null,
        email: g.winner.user?.email || null,
      },
    } : null

    // ONLY official winners (selected and announced by the admin) are considered winners.
    // Before announcement, the winner MUST NOT be revealed in the monitor.
    const resolvedWinner = officialWinner

    // Before winner announcement, highest secret bid must remain confidential
    const highestBid = officialWinner ? Number(officialWinner.winning_amount) : Number(g.currentPrice ?? g.startingPrice)

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
      gem_images: g.images.map(img => ({
        image_url: img.imageUrl,
        media_type: img.mediaType,
        display_order: img.displayOrder,
      })),
      // Bids are only revealed on monitor after the official winner has been selected
      bids: hasOfficialWinner ? g.bids.slice(0, 15).map(b => ({
        id: b.id,
        bid_amount: Number(b.bidAmount),
        created_at: b.createdAt.toISOString(),
        user: {
          display_name: b.user?.displayName || null,
          anonymous_name: b.user?.anonymousName || null,
        },
      })) : [],
      bidCount: g.bids.length,
      bidderCount: new Set(g.bids.map(b => b.userId)).size,
      highestBid,
      hasOfficialWinner,
      winner: resolvedWinner,
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
