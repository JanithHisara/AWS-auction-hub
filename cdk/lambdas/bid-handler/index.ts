import { getSupabaseClient } from '../shared/supabase-client';
import { publishToDevice } from '../shared/mqtt-publisher';
import {
  buildBidResultSchema,
  buildNfcErrorSchema,
} from '../shared/display-schema-mapper';
import type {
  BidSubmitPayload,
  DeviceRow,
  DeviceSessionRow,
  UserRow,
  AuctionRow,
  GemRow,
} from '../shared/types';

export async function handler(event: BidSubmitPayload): Promise<void> {
  const { device_id, nfc_uid, item_id, amount } = event;
  console.log(`Bid submit: device=${device_id}, item=${item_id}, amount=${amount}`);

  const supabase = await getSupabaseClient();

  // 1. Validate active device session
  const { data: session } = await supabase
    .from('device_sessions')
    .select('*')
    .eq('device_id', device_id)
    .eq('nfc_uid', nfc_uid)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (!session) {
    await publishToDevice(device_id, 'state', buildNfcErrorSchema(
      null, nfc_uid, 10, 'No Active Session', 'Please scan your NFC card first',
    ));
    return;
  }

  const sessionRow = session as DeviceSessionRow;

  // 2. Get device info
  const { data: device } = await supabase
    .from('devices')
    .select('*')
    .eq('device_id', device_id)
    .single();

  if (!device) {
    await publishToDevice(device_id, 'state', buildNfcErrorSchema(
      null, nfc_uid, 1, 'Device Not Registered', 'Device not found',
    ));
    return;
  }

  const deviceRow = device as DeviceRow;

  // 3. Get user info
  const { data: user } = await supabase
    .from('users')
    .select('id, email, role, display_name, phone')
    .eq('id', sessionRow.user_id)
    .single();

  if (!user) return;
  const userRow = user as UserRow;

  // 4. Get auction info
  const { data: auction } = await supabase
    .from('auctions')
    .select('id, name, status, auction_type, auction_start, auction_end')
    .eq('id', sessionRow.auction_id)
    .single();

  if (!auction || auction.status !== 'live') {
    await publishToDevice(device_id, 'state', buildNfcErrorSchema(
      deviceRow, nfc_uid, 7, 'Auction Not Live', 'This auction is no longer live',
    ));
    return;
  }

  const auctionRow = auction as AuctionRow;

  // 5. Get gem/item details
  const { data: gem } = await supabase
    .from('gems')
    .select('id, name, description, starting_price, current_price, min_bid_increment, status, end_time, round_end_time, auction_id')
    .eq('id', item_id)
    .eq('auction_id', sessionRow.auction_id)
    .single();

  if (!gem) {
    await publishToDevice(device_id, 'state', buildBidResultSchema(
      deviceRow, userRow, nfc_uid, auctionRow,
      { id: item_id, name: 'Unknown', starting_price: 0, current_price: 0, min_bid_increment: 0, status: 'unknown', auction_id: sessionRow.auction_id } as GemRow,
      { accepted: false, amount, currentHighestBid: 0, nextMinBid: 0, reasonCode: 11, reasonLabel: 'Item Not Found' },
    ));
    return;
  }

  const gemRow = gem as GemRow;

  if (gemRow.status !== 'active') {
    await publishToDevice(device_id, 'state', buildBidResultSchema(
      deviceRow, userRow, nfc_uid, auctionRow, gemRow,
      { accepted: false, amount, currentHighestBid: gemRow.current_price ?? gemRow.starting_price, nextMinBid: 0, reasonCode: 12, reasonLabel: 'Item Not Active' },
    ));
    return;
  }

  const currentPrice = gemRow.current_price ?? gemRow.starting_price;

  // 5.5 Validate round timing (all auctions only allow bidding during active round)
  if (!gemRow.round_end_time) {
    await publishToDevice(device_id, 'state', buildBidResultSchema(
      deviceRow, userRow, nfc_uid, auctionRow, gemRow,
      { accepted: false, amount, currentHighestBid: currentPrice, nextMinBid: 0, reasonCode: 16, reasonLabel: 'Bidding Not Started' },
    ));
    return;
  }

  const roundEndTime = new Date(gemRow.round_end_time);
  if (new Date() >= roundEndTime) {
    await publishToDevice(device_id, 'state', buildBidResultSchema(
      deviceRow, userRow, nfc_uid, auctionRow, gemRow,
      { accepted: false, amount, currentHighestBid: currentPrice, nextMinBid: 0, reasonCode: 17, reasonLabel: 'Bidding Round Ended' },
    ));
    return;
  }

  // 6. Validate bid amount
  const nextMinBid = currentPrice + gemRow.min_bid_increment;

  if (amount < nextMinBid) {
    await publishToDevice(device_id, 'state', buildBidResultSchema(
      deviceRow, userRow, nfc_uid, auctionRow, gemRow,
      { accepted: false, amount, currentHighestBid: currentPrice, nextMinBid, reasonCode: 13, reasonLabel: `Minimum bid is ${nextMinBid}` },
    ));
    return;
  }

  // 7. Check bidder hold
  const { data: hold } = await supabase
    .from('bidder_holds')
    .select('id')
    .eq('user_id', sessionRow.user_id)
    .eq('auction_id', sessionRow.auction_id)
    .eq('is_active', true)
    .limit(1);

  if (hold && hold.length > 0) {
    await publishToDevice(device_id, 'state', buildBidResultSchema(
      deviceRow, userRow, nfc_uid, auctionRow, gemRow,
      { accepted: false, amount, currentHighestBid: currentPrice, nextMinBid, reasonCode: 14, reasonLabel: 'Your bidding is currently on hold' },
    ));
    return;
  }

  // 8. Insert bid
  const { error: bidError } = await supabase
    .from('bids')
    .insert({
      gem_id: item_id,
      user_id: sessionRow.user_id,
      bid_amount: amount,
    });

  if (bidError) {
    console.error('Bid insert error:', bidError);
    await publishToDevice(device_id, 'state', buildBidResultSchema(
      deviceRow, userRow, nfc_uid, auctionRow, gemRow,
      { accepted: false, amount, currentHighestBid: currentPrice, nextMinBid, reasonCode: 15, reasonLabel: 'Failed to place bid' },
    ));
    return;
  }

  // 9. Refresh gem to get updated price
  const { data: updatedGem } = await supabase
    .from('gems')
    .select('id, name, description, starting_price, current_price, min_bid_increment, status, end_time, round_end_time, auction_id')
    .eq('id', item_id)
    .single();

  const finalGem = (updatedGem || gemRow) as GemRow;
  const newCurrentPrice = finalGem.current_price ?? finalGem.starting_price;
  const newNextMinBid = newCurrentPrice + finalGem.min_bid_increment;

  await publishToDevice(device_id, 'state', buildBidResultSchema(
    deviceRow, userRow, nfc_uid, auctionRow, finalGem,
    { accepted: true, amount, currentHighestBid: newCurrentPrice, nextMinBid: newNextMinBid },
  ));

  console.log(`Bid accepted: user=${userRow.email}, item=${gemRow.name}, amount=${amount}`);
}
