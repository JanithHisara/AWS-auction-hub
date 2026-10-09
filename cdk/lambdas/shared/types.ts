// ---- MQTT Payload Types (Device -> Cloud) ----

export interface NfcScanPayload {
  action: 'nfc_scan';
  device_id: string;
  nfc_uid: string;
  timestamp: string;
  firmware_version?: string;
}

export interface BidSubmitPayload {
  action: 'submit_bid';
  device_id: string;
  nfc_uid: string;
  item_id: string;
  amount: number;
  timestamp: string;
}

export interface HeartbeatPayload {
  action: 'heartbeat';
  device_id: string;
  firmware_version?: string;
  uptime_seconds?: number;
  free_heap?: number;
  wifi_rssi?: number;
  timestamp: string;
}

// ---- Supabase Webhook Payload ----

export interface SupabaseWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

// ---- Unified Display Schema (Cloud -> Device) ----
// Option B: only sends the current active item, no item lists

export type DisplayScreenName =
  | 'startup'
  | 'nfc_access'
  | 'active_item'
  | 'bid_result';

export type DisplayState = 'idle' | 'loading' | 'success' | 'error';

export type FeedbackStatus = 'success' | 'error' | 'warning' | 'info';

export interface AuctionSummary {
  auction_id: string;
  name: string;
  mode: string;
  mode_label: string;
  status: string;
  status_label: string;
  show_on_device?: boolean;
  start_datetime: string | null;
  end_datetime: string | null;
  items_count: number | null;
  registered_count: number | null;
}

export interface ItemSummary {
  item_id: string;
  name: string;
  status: string | null;
  current_price: number | null;
  currency: string | null;
  next_min_bid: number | null;
  end_datetime: string | null;
  remaining_seconds: number | null;
  your_bid_submitted: boolean | null;
}

export interface BidDetail {
  item_id: string | null;
  amount: number | null;
  currency: string | null;
  bid_status: string | null;
  current_highest_bid: number | null;
  next_min_bid: number | null;
  reason_code: number | null;
  reason_label: string | null;
}

export interface UnifiedDisplaySchema {
  screen: {
    name: DisplayScreenName;
    state: DisplayState;
    title: string | null;
    subtitle: string | null;
    message: string | null;
  };
  device: {
    device_id: string | null;
    status: string | null;
    firmware_version: string | null;
    hardware_version: string | null;
    heartbeat_interval: number | null;
    last_seen_at: string | null;
  };
  session: {
    timestamp: string | null;
    protocol_version: string | null;
    connection_status: string | null;
  };
  user: {
    nfc_uid: string | null;
    user_id: string | null;
    display_name: string | null;
    role: string | null;
    access_granted: boolean | null;
    access_status: string | null;
    access_reason_code: number | null;
    access_reason_label: string | null;
  } | null;
  context: {
    active_auction_id: string | null;
    active_item_id: string | null;
  };
  detail: {
    auction: AuctionSummary | null;
    item: ItemSummary | null;
    bid: BidDetail | null;
  };
  feedback: {
    status: FeedbackStatus;
    code: number | null;
    label: string | null;
    message: string | null;
  };
  actions: {
    primary: string | null;
    secondary: string | null;
    back: boolean;
  };
}

// ---- DB Row Types ----

export interface DeviceRow {
  id: string;
  device_id: string;
  name: string | null;
  status: string;
  auction_id: string | null;
  firmware_version: string | null;
  hardware_version: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NfcCardRow {
  id: string;
  nfc_uid: string;
  user_id: string;
  auction_id: string | null;
  is_active: boolean;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: string;
  email: string;
  role: string;
  display_name: string | null;
  phone: string | null;
}

export interface AuctionRow {
  id: string;
  name: string;
  status: string;
  auction_type: string;
  auction_start: string;
  auction_end: string;
  show_on_device?: boolean;
}

export interface GemRow {
  id: string;
  name: string;
  description: string | null;
  starting_price: number;
  current_price: number | null;
  min_bid_increment: number;
  status: string;
  end_time: string | null;
  round_end_time: string | null;
  auction_id: string;
}

export interface DeviceSessionRow {
  id: string;
  device_id: string;
  nfc_uid: string;
  user_id: string;
  auction_id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
}



