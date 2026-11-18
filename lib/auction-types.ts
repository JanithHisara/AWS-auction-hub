import type { AuctionType } from '@/types/database'

/** Display labels for auction types */
export const AUCTION_TYPE_LABELS: Record<AuctionType, string> = {
  progressive_elimination_auction: 'English Auction',
  tender_base_fixed_bid: 'Closed Bid Auction',
  incremental_approval_auction: 'Progressive Elimination Auction',
}

/** Short labels for compact UI (e.g. badges, monitor) */
export const AUCTION_TYPE_SHORT_LABELS: Record<AuctionType, string> = {
  progressive_elimination_auction: 'English',
  tender_base_fixed_bid: 'Closed Bid',
  incremental_approval_auction: 'Progressive Elimination',
}

export function getAuctionTypeLabel(type: AuctionType, short = false): string {
  return short ? AUCTION_TYPE_SHORT_LABELS[type] : AUCTION_TYPE_LABELS[type]
}
