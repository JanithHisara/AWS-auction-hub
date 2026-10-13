import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import MyBidsClient, { BiddingItem } from './MyBidsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MyBidsPage() {
  const user = await requireAuth()

  // 1. Find all gem IDs the user has placed bids on or won
  const userBids = await prisma.bid.findMany({
    where: { userId: user.id },
    select: { gemId: true },
    distinct: ['gemId'],
  })

  const userWins = await prisma.auctionWinner.findMany({
    where: { userId: user.id },
    select: { gemId: true },
  })

  const targetGemIds = Array.from(
    new Set([...userBids.map(b => b.gemId), ...userWins.map(w => w.gemId)])
  )

  if (targetGemIds.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--background)] relative">
        <div className="fixed inset-0 bg-grid-pattern opacity-30" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 py-16">
          <h1 className="text-4xl font-black text-white mb-8">Bidding History</h1>
          <div className="card-glass rounded-3xl p-12 text-center border border-[var(--border)] shadow-2xl">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--gold)]/10 border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] text-3xl font-black">
              🏷️
            </div>
            <h2 className="text-2xl font-black text-white mb-3">No Bids Placed Yet</h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto text-sm leading-relaxed">
              You haven&apos;t placed any bids on items yet. Explore our live auctions and place your bids to track real-time bidding updates and winners here.
            </p>
            <Link href="/" className="btn-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg shadow-[var(--gold)]/20">
              <span>Browse Active Auctions</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 2. Fetch all gems with auction, winner, images, and ALL bids from ALL bidders
  const gems = await prisma.gem.findMany({
    where: {
      id: { in: targetGemIds },
    },
    include: {
      auction: true,
      images: {
        orderBy: { displayOrder: 'asc' },
      },
      winner: {
        include: {
          winningBid: true,
          user: {
            select: {
              id: true,
              displayName: true,
              anonymousName: true,
              email: true,
            },
          },
        },
      },
      bids: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              anonymousName: true,
              email: true,
            },
          },
        },
        orderBy: { bidAmount: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // 3. Serialize to plain objects safe for Client Components
  const serializedItems: BiddingItem[] = gems.map(gem => {
    const allBids = gem.bids.map(b => ({
      id: b.id,
      bidAmount: Number(b.bidAmount),
      pointsEarned: b.pointsEarned,
      createdAt: b.createdAt.toISOString(),
      userId: b.userId,
      bidderName: b.user?.displayName || b.user?.anonymousName || 'Bidder',
      isCurrentUser: b.userId === user.id,
      isWinningBid: gem.winner?.winningBidId === b.id,
    }))

    const userBidsForItem = allBids.filter(b => b.isCurrentUser)
    const userHighestBid = userBidsForItem.length > 0 ? Math.max(...userBidsForItem.map(b => b.bidAmount)) : null
    const highestBidOverall = allBids.length > 0 ? Math.max(...allBids.map(b => b.bidAmount)) : Number(gem.startingPrice)

    const isUserWinner = gem.winner?.userId === user.id
    const isUserLeading = gem.status === 'active' && allBids.length > 0 && allBids[0].isCurrentUser

    const winningPrice = gem.winner?.winningBid
      ? Number(gem.winner.winningBid.bidAmount)
      : (gem.status === 'ended' || gem.status === 'completed' || gem.status === 'sold')
        ? (allBids.length > 0 ? allBids[0].bidAmount : null)
        : null

    const winningTime = gem.winner?.selectedAt
      ? gem.winner.selectedAt.toISOString()
      : gem.winner?.winningBid?.createdAt
        ? gem.winner.winningBid.createdAt.toISOString()
        : null

    const winnerName = gem.winner?.user
      ? (gem.winner.user.displayName || gem.winner.user.anonymousName || 'Winner')
      : null

    return {
      id: gem.id,
      name: gem.name,
      description: gem.description,
      startingPrice: Number(gem.startingPrice),
      currentPrice: gem.currentPrice ? Number(gem.currentPrice) : null,
      status: gem.status,
      startTime: gem.startTime.toISOString(),
      endTime: gem.endTime.toISOString(),
      caratWeight: gem.caratWeight ? Number(gem.caratWeight) : null,
      cut: gem.cut,
      color: gem.color,
      clarity: gem.clarity,
      provenance: gem.provenance,
      auctionId: gem.auctionId,
      auction: gem.auction ? {
        id: gem.auction.id,
        name: gem.auction.name,
        status: gem.auction.status,
        auctionType: gem.auction.auctionType,
        auctionCode: gem.auction.auctionCode,
      } : null,
      images: gem.images.map(img => ({
        imageUrl: img.imageUrl,
        mediaType: img.mediaType,
        displayOrder: img.displayOrder,
      })),
      winningPrice,
      winningTime,
      winnerName,
      isUserWinner,
      isUserLeading,
      userHighestBid,
      highestBidOverall,
      bids: allBids,
    }
  })

  return <MyBidsClient items={serializedItems} currentUserId={user.id} />
}