import {
  UnifiedDisplaySchema,
  FeedbackStatus,
  AuctionSummary,
  BidDetail,
  AuctionRow,
  GemRow,
  UserRow,
  DeviceRow,
} from './types';

const AUCTION_TYPE_LABELS: Record<string, string> = {
  progressive_elimination_auction: 'English Auction',
  tender_base_fixed_bid: 'Closed Bid Auction',
  incremental_approval_auction: 'Progressive Elimination Auction',
};

const AUCTION_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  upcoming: 'Upcoming',
  registration_open: 'Registration Open',
  registration_closed: 'Registration Closed',
  live: 'Live',
  ended: 'Ended',
  completed: 'Completed',
};

const CURRENCY = 'LKR';

function createEmptySchema(): UnifiedDisplaySchema {
  return {
    screen: { name: 'startup', state: 'idle', title: null, subtitle: null, message: null },
    device: {
      device_id: null, status: null, firmware_version: null,
      hardware_version: null, heartbeat_interval: null, last_seen_at: null,
    },
    session: { timestamp: new Date().toISOString(), protocol_version: '1.0', connection_status: 'online' },
    user: null,
    context: { active_auction_id: null, active_item_id: null },
    detail: { auction: null, item: null, bid: null },
    feedback: { status: 'success', code: null, label: null, message: null },
    actions: { primary: null, secondary: null, back: false },
  };
}

function mapDeviceInfo(schema: UnifiedDisplaySchema, device: DeviceRow): UnifiedDisplaySchema {
  return {
    ...schema,
    device: {
      device_id: device.device_id,
      status: device.status,
      firmware_version: device.firmware_version,
      hardware_version: device.hardware_version,
      heartbeat_interval: 30,
      last_seen_at: device.last_seen_at,
    },
  };
}

function mapUserInfo(
  schema: UnifiedDisplaySchema,
  user: UserRow,
  nfcUid: string,
  accessGranted: boolean,
  reasonCode?: number,
  reasonLabel?: string,
): UnifiedDisplaySchema {
  return {
    ...schema,
    user: {
      nfc_uid: nfcUid,
      user_id: user.id,
      display_name: user.display_name,
      role: user.role,
      access_granted: accessGranted,
      access_status: accessGranted ? 'success' : 'error',
      access_reason_code: reasonCode ?? null,
      access_reason_label: reasonLabel ?? null,
    },
  };
}

export function mapAuctionToSummary(auction: AuctionRow, itemsCount?: number, registeredCount?: number): AuctionSummary {
  return {
    auction_id: auction.id,
    name: auction.name,
    mode: auction.auction_type,
    mode_label: AUCTION_TYPE_LABELS[auction.auction_type] || auction.auction_type,
    status: auction.status,
    status_label: AUCTION_STATUS_LABELS[auction.status] || auction.status,
    start_datetime: auction.auction_start,
    end_datetime: auction.auction_end,    items_count: itemsCount ?? null,
    registered_count: registeredCount ?? null,
  };
}

export function mapGemToItem(gem: GemRow, userBidSubmitted?: boolean) {
  const currentPrice = gem.current_price ?? gem.starting_price;
  const nextMinBid = currentPrice + gem.min_bid_increment;
  const endTime = gem.round_end_time || gem.end_time;
  const remainingSeconds = endTime
    ? Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000))
    : null;

  return {
    item_id: gem.id,
    name: gem.name,
    status: gem.status,
    current_price: currentPrice,
    currency: CURRENCY,
    next_min_bid: nextMinBid,
    end_datetime: endTime,
    remaining_seconds: remainingSeconds,
    your_bid_submitted: userBidSubmitted ?? null,
  };
}

/**
 * Option B: NFC scan success - sends only the current active item
 */
export function buildNfcSuccessSchema(
  device: DeviceRow,
  user: UserRow,
  nfcUid: string,
  auction: AuctionRow,
  activeGem: GemRow | null,
  itemsCount: number,
  registeredCount: number,
): UnifiedDisplaySchema {
  let schema = createEmptySchema();
  schema = mapDeviceInfo(schema, device);
  schema = mapUserInfo(schema, user, nfcUid, true);

  const auctionSummary = mapAuctionToSummary(auction, itemsCount, registeredCount);

  return {
    ...schema,
    screen: {
      name: 'active_item',
      state: 'success',
      title: auction.name,
      subtitle: auctionSummary.mode_label,
      message: activeGem ? activeGem.name : 'No active item',
    },
    context: {
      active_auction_id: auction.id,
      active_item_id: activeGem?.id ?? null,
    },
    detail: {
      auction: auctionSummary,
      item: activeGem ? mapGemToItem(activeGem) : null,
      bid: null,
    },
    feedback: {
      status: 'success',
      code: null,
      label: null,
      message: `Welcome, ${user.display_name || user.email}`,
    },
    actions: {
      primary: activeGem ? 'submit_bid' : 'refresh',
      secondary: 'refresh',
      back: false,
    },
  };
}

export function buildNfcErrorSchema(
  device: DeviceRow | null,
  nfcUid: string,
  errorCode: number,
  errorLabel: string,
  errorMessage: string,
): UnifiedDisplaySchema {
  let schema = createEmptySchema();
  if (device) {
    schema = mapDeviceInfo(schema, device);
  }

  return {
    ...schema,
    screen: {
      name: 'nfc_access',
      state: 'error',
      title: 'Access Denied',
      subtitle: null,
      message: errorMessage,
    },
    user: {
      nfc_uid: nfcUid,
      user_id: null,
      display_name: null,
      role: null,
      access_granted: false,
      access_status: 'error',
      access_reason_code: errorCode,
      access_reason_label: errorLabel,
    },
    feedback: {
      status: 'error',
      code: errorCode,
      label: errorLabel,
      message: errorMessage,
    },
    actions: {
      primary: 'scan_nfc',
      secondary: null,
      back: false,
    },
  };
}

export function buildBidResultSchema(
  device: DeviceRow,
  user: UserRow,
  nfcUid: string,
  auction: AuctionRow,
  gem: GemRow,
  bidResult: {
    accepted: boolean;
    amount: number;
    currentHighestBid: number;
    nextMinBid: number;
    reasonCode?: number;
    reasonLabel?: string;
  },
): UnifiedDisplaySchema {
  let schema = createEmptySchema();
  schema = mapDeviceInfo(schema, device);
  schema = mapUserInfo(schema, user, nfcUid, true);

  const auctionSummary = mapAuctionToSummary(auction);

  const bidDetail: BidDetail = {
    item_id: gem.id,
    amount: bidResult.amount,
    currency: CURRENCY,
    bid_status: bidResult.accepted ? 'ACCEPTED' : 'REJECTED',
    current_highest_bid: bidResult.currentHighestBid,
    next_min_bid: bidResult.nextMinBid,
    reason_code: bidResult.reasonCode ?? null,
    reason_label: bidResult.reasonLabel ?? null,
  };

  return {
    ...schema,
    screen: {
      name: 'bid_result',
      state: 'success',
      title: bidResult.accepted ? 'Bid Accepted' : 'Bid Rejected',
      subtitle: gem.name,
      message: bidResult.accepted
        ? `Your bid of ${CURRENCY} ${bidResult.amount.toLocaleString()} was accepted`
        : bidResult.reasonLabel || 'Bid was not accepted',
    },
    context: {
      active_auction_id: auction.id,
      active_item_id: gem.id,
    },
    detail: {
      auction: auctionSummary,
      item: mapGemToItem(gem),
      bid: bidDetail,
    },
    feedback: {
      status: bidResult.accepted ? 'success' : 'error',
      code: bidResult.reasonCode ?? null,
      label: bidResult.reasonLabel ?? null,
      message: bidResult.accepted ? 'Bid accepted' : (bidResult.reasonLabel || 'Bid rejected'),
    },
    actions: {
      primary: 'submit_bid',
      secondary: 'refresh',
      back: true,
    },
  };
}

/**
 * Winner announcement - notify all devices about the auction winner
 */
export function buildWinnerAnnouncementSchema(
  device: DeviceRow,
  auction: AuctionRow,
  gemName: string,
  winnerDisplayName: string,
  winningAmount: number,
  nextGem: GemRow | null,
): UnifiedDisplaySchema {
  let schema = createEmptySchema();
  schema = mapDeviceInfo(schema, device);

  const auctionSummary = mapAuctionToSummary(auction);

  return {
    ...schema,
    screen: {
      name: 'active_item',
      state: 'success',
      title: 'Winner Announced',
      subtitle: gemName,
      message: `${winnerDisplayName} wins with ${CURRENCY} ${winningAmount.toLocaleString()}`,
    },
    context: {
      active_auction_id: auction.id,
      active_item_id: nextGem?.id ?? null,
    },
    detail: {
      auction: auctionSummary,
      item: nextGem ? mapGemToItem(nextGem) : null,
      bid: {
        item_id: null,
        amount: winningAmount,
        currency: CURRENCY,
        bid_status: 'WINNER',
        current_highest_bid: winningAmount,
        next_min_bid: null,
        reason_code: null,
        reason_label: winnerDisplayName,
      },
    },
    feedback: {
      status: 'success' as FeedbackStatus,
      code: 100,
      label: 'WINNER_ANNOUNCED',
      message: `${winnerDisplayName} won ${gemName} for ${CURRENCY} ${winningAmount.toLocaleString()}`,
    },
    actions: {
      primary: nextGem ? 'submit_bid' : 'refresh',
      secondary: 'refresh',
      back: false,
    },
  };
}

/**
 * Option B: Auction update - sends only the current active item to devices
 */
export function buildAuctionUpdateSchema(
  device: DeviceRow,
  auction: AuctionRow,
  activeGem: GemRow | null,
  itemsCount: number,
): UnifiedDisplaySchema {
  let schema = createEmptySchema();
  schema = mapDeviceInfo(schema, device);

  const auctionSummary = mapAuctionToSummary(auction, itemsCount);

  return {
    ...schema,
    screen: {
      name: 'active_item',
      state: 'success',
      title: auction.name,
      subtitle: auctionSummary.mode_label,
      message: activeGem ? activeGem.name : 'No active item',
    },
    context: {
      active_auction_id: auction.id,
      active_item_id: activeGem?.id ?? null,
    },
    detail: {
      auction: auctionSummary,
      item: activeGem ? mapGemToItem(activeGem) : null,
      bid: null,
    },
    feedback: {
      status: 'success' as FeedbackStatus,
      code: null,
      label: null,
      message: null,
    },
    actions: {
      primary: activeGem ? 'submit_bid' : 'refresh',
      secondary: 'refresh',
      back: false,
    },
  };
}



