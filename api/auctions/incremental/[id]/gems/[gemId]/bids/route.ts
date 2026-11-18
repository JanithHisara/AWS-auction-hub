import { type Request, type Response } from 'express'
import { handleGemBids } from '../../../../../../admin/auctions/_handlers'
import { getAuctionType, jsonError } from '../../../../../../admin/_auth'

export async function GET(request: Request, response: Response) {
  const auctionType = getAuctionType('incremental')
  if (!auctionType) {
    jsonError(response, 404, 'Auction type not found.')
    return
  }
  await handleGemBids(request, response, auctionType)
}

export async function POST(request: Request, response: Response) {
  const auctionType = getAuctionType('incremental')
  if (!auctionType) {
    jsonError(response, 404, 'Auction type not found.')
    return
  }
  await handleGemBids(request, response, auctionType)
}

export async function PATCH(request: Request, response: Response) {
  const auctionType = getAuctionType('incremental')
  if (!auctionType) {
    jsonError(response, 404, 'Auction type not found.')
    return
  }
  await handleGemBids(request, response, auctionType)
}
