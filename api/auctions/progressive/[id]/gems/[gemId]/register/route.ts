import { type Request, type Response } from 'express'
import { handleGemRegister } from '../../../../../../admin/auctions/_handlers'
import { getAuctionType, jsonError } from '../../../../../../admin/_auth'

export async function GET(request: Request, response: Response) {
  const auctionType = getAuctionType('progressive')
  if (!auctionType) {
    jsonError(response, 404, 'Auction type not found.')
    return
  }
  await handleGemRegister(request, response, auctionType)
}

export async function POST(request: Request, response: Response) {
  const auctionType = getAuctionType('progressive')
  if (!auctionType) {
    jsonError(response, 404, 'Auction type not found.')
    return
  }
  await handleGemRegister(request, response, auctionType)
}
