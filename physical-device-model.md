# ESP32 Physical Device - Protocol & Display Schema

## Architecture

```
ESP32 Device ──MQTT/TLS──▶ AWS IoT Core ──IoT Rules──▶ Lambda Functions ──HTTP──▶ Supabase
                                │                                │
                                ◀──MQTT publish──────────────────┘
                                │
                                ◀──MQTT publish── Auction Updater Lambda ◀── API Gateway ◀── Supabase Webhooks
```

### AWS Resources (CDK Stack: `GemAuctionIotStack`)

| Resource | Name | Purpose |
|----------|------|---------|
| IoT ThingType | `GemAuctionDevice` | Type definition for ESP32 devices |
| IoT Policy | `GemAuctionDevicePolicy` | Per-device topic access control |
| IoT TopicRule | `gem_auction_nfc_scan` | Routes NFC scan to Lambda |
| IoT TopicRule | `gem_auction_bid_submit` | Routes bid submit to Lambda |
| IoT TopicRule | `gem_auction_heartbeat` | Routes heartbeat to Lambda |
| Lambda | `gem-auction-nfc-scan-handler` | Processes NFC scans |
| Lambda | `gem-auction-bid-handler` | Processes bid submissions |
| Lambda | `gem-auction-heartbeat-handler` | Processes heartbeats |
| Lambda | `gem-auction-auction-updater` | Pushes real-time updates to devices |
| API Gateway | `gem-auction-webhook-api` | Receives Supabase webhooks |
| Secrets Manager | `gem-auction/supabase` | Stores Supabase credentials |

---

## Authorization Model

### Layer 1: Device-level (Transport)

ESP32 authenticates to AWS IoT Core using X.509 client certificates provisioned per-device. The IoT Policy restricts each device to only publish/subscribe on its own `gem-auction/{device_id}/*` topics using the `${iot:Connection.Thing.ThingName}` policy variable.

### Layer 2: User-level (Application)

NFC card UID is looked up in the `nfc_cards` table by the Lambda function:

1. Card must exist and `is_active = true`
2. Card must have a `user_id` and `auction_id` assigned
3. The user must have an approved `auction_registrations` entry for that auction
4. The auction must be in `live` status

### Layer 3: Admin-level (Dashboard)

The existing RBAC system gates the NFC management pages. Permission `manage_devices` is required, accessible to `moderator`, `admin`, and `super_admin` roles.

Lambda functions use the Supabase **service role key** stored in AWS Secrets Manager.

---

## MQTT Topic Design

### Topics

| Direction | Topic Pattern | Purpose |
|-----------|--------------|---------|
| Device → Cloud | `gem-auction/{device_id}/nfc/scan` | NFC card scanned |
| Device → Cloud | `gem-auction/{device_id}/bid/submit` | Place a bid |
| Device → Cloud | `gem-auction/{device_id}/heartbeat` | Periodic status |
| Cloud → Device | `gem-auction/{device_id}/state` | Full display state response |
| Cloud → Device | `gem-auction/{device_id}/auction/update` | Real-time auction push |

### IoT Rule SQL

```sql
-- NFC scan rule
SELECT *, topic(2) AS device_id FROM 'gem-auction/+/nfc/scan'

-- Bid submit rule
SELECT *, topic(2) AS device_id FROM 'gem-auction/+/bid/submit'

-- Heartbeat rule
SELECT *, topic(2) AS device_id FROM 'gem-auction/+/heartbeat'
```

---

## Request/Response Payloads

### NFC Scan Request

**Topic:** `gem-auction/{device_id}/nfc/scan`

```json
{
  "action": "nfc_scan",
  "device_id": "DEV_001",
  "nfc_uid": "04A3B21C7F8890",
  "timestamp": "2026-03-08T10:00:00Z",
  "firmware_version": "1.0.0"
}
```

**Processing flow:**

1. Verify device exists and is `active`
2. Look up NFC card mapping → `user_id` + `auction_id`
3. Verify user exists
4. Verify auction is `live`
5. Verify auction registration is `approved`
6. Load auction items from `gems` table
7. End existing device sessions, create new one
8. Map to UnifiedDisplaySchema and publish to `gem-auction/{device_id}/state`

### Bid Submit Request

**Topic:** `gem-auction/{device_id}/bid/submit`

```json
{
  "action": "submit_bid",
  "device_id": "DEV_001",
  "nfc_uid": "04A3B21C7F8890",
  "item_id": "uuid-of-gem",
  "amount": 550.00,
  "timestamp": "2026-03-08T10:05:00Z"
}
```

**Processing flow:**

1. Validate active `device_sessions` entry for device + NFC UID
2. Verify auction is still `live`
3. Verify gem is `active`
4. Validate bid amount ≥ `current_price + min_bid_increment`
5. Check bidder is not on hold (`bidder_holds`)
6. Insert into `bids` table
7. Publish bid result to `gem-auction/{device_id}/state`

### Heartbeat Request

**Topic:** `gem-auction/{device_id}/heartbeat`

```json
{
  "action": "heartbeat",
  "device_id": "DEV_001",
  "firmware_version": "1.0.0",
  "uptime_seconds": 3600,
  "free_heap": 120000,
  "wifi_rssi": -45,
  "timestamp": "2026-03-08T10:01:00Z"
}
```

**Processing:** Updates `devices.last_seen_at` and `firmware_version`. Expires stale sessions older than 4 hours.

### Auction Update Push

**Topic:** `gem-auction/{device_id}/auction/update`

Triggered by Supabase database webhooks (on `gems`, `bids`, `auctions` table changes) → API Gateway → `auction-updater` Lambda.

Payload is a full `UnifiedDisplaySchema` with the latest auction/item state.

---

## Error Codes

| Code | Label | Meaning |
|------|-------|---------|
| 1 | Device Not Registered | Device ID not found in `devices` table |
| 2 | Device Inactive | Device status is not `active` |
| 3 | Card Not Recognized | NFC UID not found in `nfc_cards` table |
| 4 | No Auction Assigned | Card exists but has no `auction_id` |
| 5 | User Not Found | User referenced by card not found |
| 6 | Auction Not Found | Assigned auction does not exist |
| 7 | Auction Not Live | Auction status is not `live` |
| 8 | Not Registered | User not registered for the auction |
| 9 | Registration Pending | Registration not yet approved |
| 10 | No Active Session | Bid attempt without NFC scan |
| 11 | Item Not Found | Gem/item ID not found |
| 12 | Item Not Active | Gem status is not `active` |
| 13 | Bid Too Low | Amount below minimum required bid |
| 14 | Bidder On Hold | User's bidding is on hold |
| 15 | Bid Failed | Database insertion error |

---

## Unified Display Schema

This is the canonical contract between the cloud (Lambda response) and the device display. The device firmware should have a single renderer that maps this schema to screen output.

```json
{
  "screen": {},
  "device": {},
  "session": {},
  "user": {},
  "context": {},
  "lists": {
    "auctions": [],
    "items": []
  },
  "detail": {
    "auction": null,
    "item": null,
    "bid": null,
    "update": null
  },
  "feedback": {},
  "actions": {}
}
```

### Field Groups

#### `screen`

UI-only state.

```json
{
  "name": "auction_items",
  "state": "success",
  "title": "Auction Items",
  "subtitle": "Electronics Auction",
  "message": "2 items available"
}
```

Supported `name` values:

* `startup`
* `auction_list`
* `nfc_access`
* `auction_items`
* `bid_result`
* `update`

Supported `state` values:

* `idle`
* `loading`
* `success`
* `error`

#### `device`

Everything about the handheld itself.

```json
{
  "device_id": "Device_001",
  "status": "registered",
  "firmware_version": "1.0.0",
  "hardware_version": "1.0",
  "boot_count": 25,
  "heartbeat_interval": 30,
  "last_seen_at": "2026-02-12T11:00:01Z"
}
```

#### `session`

Transport/session metadata.

```json
{
  "timestamp": "2026-02-12T11:00:01Z",
  "message_id": "MSG_1200",
  "protocol_version": "1.0",
  "connection_status": "online"
}
```

#### `user`

Normalized NFC/access data. `null` when no user is scanned.

```json
{
  "nfc_uid": "04A3B21C7F8890",
  "user_id": "USER_045",
  "role": "Bidder",
  "access_granted": true,
  "access_status": "success",
  "access_reason_code": null,
  "access_reason_label": null
}
```

#### `context`

Active selection context.

```json
{
  "active_auction_id": "AUC123",
  "active_item_id": "ITEM001"
}
```

#### `lists`

Array data for list screens.

```json
{
  "auctions": [],
  "items": [
    {
      "item_id": "ITEM001",
      "name": "Gem1",
      "status": "LIVE",
      "current_price": 500.0,
      "currency": "LKR",
      "next_min_bid": 525.0,
      "end_datetime": "2026-02-12T12:35:01Z",
      "remaining_seconds": 9000,
      "your_bid_submitted": null
    }
  ]
}
```

#### `detail`

Single-object detail views.

```json
{
  "auction": { "auction_id": "AUC123", "name": "...", "..." },
  "item": { "item_id": "ITEM001", "..." },
  "bid": {
    "item_id": "ITEM001",
    "amount": 550.0,
    "currency": "LKR",
    "bid_status": "ACCEPTED",
    "current_highest_bid": 550.0,
    "next_min_bid": 575.0,
    "reason_code": null,
    "reason_label": null
  },
  "update": null
}
```

#### `feedback`

Normalized user-facing status message.

```json
{
  "status": "success",
  "code": null,
  "label": null,
  "message": "Bid accepted"
}
```

#### `actions`

Hints for rendering buttons.

```json
{
  "primary": "submit_bid",
  "secondary": "refresh",
  "back": true
}
```

---

## Full Response Examples

### Successful NFC Scan

Published to `gem-auction/DEV_001/state`:

```json
{
  "screen": {
    "name": "auction_items",
    "state": "success",
    "title": "Electronics Auction",
    "subtitle": "Progressive Elimination",
    "message": "3 items available"
  },
  "device": {
    "device_id": "DEV_001",
    "status": "active",
    "firmware_version": "1.0.0",
    "hardware_version": "1.0",
    "boot_count": null,
    "heartbeat_interval": 30,
    "last_seen_at": "2026-03-08T10:00:00Z"
  },
  "session": {
    "timestamp": "2026-03-08T10:00:01Z",
    "message_id": null,
    "protocol_version": "1.0",
    "connection_status": "online"
  },
  "user": {
    "nfc_uid": "04A3B21C7F8890",
    "user_id": "uuid-of-user",
    "role": "user",
    "access_granted": true,
    "access_status": "success",
    "access_reason_code": null,
    "access_reason_label": null
  },
  "context": {
    "active_auction_id": "uuid-of-auction",
    "active_item_id": "uuid-of-active-gem"
  },
  "lists": {
    "auctions": [],
    "items": [
      {
        "item_id": "uuid-of-gem-1",
        "name": "Blue Sapphire 3.2ct",
        "status": "active",
        "current_price": 50000.0,
        "currency": "LKR",
        "next_min_bid": 52500.0,
        "end_datetime": "2026-03-08T12:00:00Z",
        "remaining_seconds": 7200,
        "your_bid_submitted": null
      }
    ]
  },
  "detail": {
    "auction": {
      "auction_id": "uuid-of-auction",
      "name": "Electronics Auction",
      "mode": "progressive_elimination_auction",
      "mode_label": "Progressive Elimination",
      "status": "live",
      "status_label": "Live",
      "start_datetime": "2026-03-08T09:00:00Z",
      "end_datetime": "2026-03-08T18:00:00Z",
      "items_count": 3,
      "registered_count": 15
    },
    "item": {
      "item_id": "uuid-of-active-gem",
      "name": "Blue Sapphire 3.2ct",
      "status": "active",
      "current_price": 50000.0,
      "currency": "LKR",
      "next_min_bid": 52500.0,
      "end_datetime": "2026-03-08T12:00:00Z",
      "remaining_seconds": 7200,
      "your_bid_submitted": null
    },
    "bid": null,
    "update": null
  },
  "feedback": {
    "status": "success",
    "code": null,
    "label": null,
    "message": "Welcome, John Doe"
  },
  "actions": {
    "primary": "submit_bid",
    "secondary": "refresh",
    "back": false
  }
}
```

### NFC Scan Error (Card Not Recognized)

Published to `gem-auction/DEV_001/state`:

```json
{
  "screen": {
    "name": "nfc_access",
    "state": "error",
    "title": "Access Denied",
    "subtitle": null,
    "message": "This NFC card is not registered"
  },
  "device": {
    "device_id": "DEV_001",
    "status": "active",
    "firmware_version": "1.0.0",
    "hardware_version": "1.0",
    "boot_count": null,
    "heartbeat_interval": 30,
    "last_seen_at": "2026-03-08T09:55:00Z"
  },
  "session": {
    "timestamp": "2026-03-08T10:00:01Z",
    "message_id": null,
    "protocol_version": "1.0",
    "connection_status": "online"
  },
  "user": {
    "nfc_uid": "AABBCCDD112233",
    "user_id": null,
    "role": null,
    "access_granted": false,
    "access_status": "error",
    "access_reason_code": 3,
    "access_reason_label": "Card Not Recognized"
  },
  "context": { "active_auction_id": null, "active_item_id": null },
  "lists": { "auctions": [], "items": [] },
  "detail": { "auction": null, "item": null, "bid": null, "update": null },
  "feedback": {
    "status": "error",
    "code": 3,
    "label": "Card Not Recognized",
    "message": "This NFC card is not registered"
  },
  "actions": {
    "primary": "scan_nfc",
    "secondary": null,
    "back": false
  }
}
```

### Bid Accepted

Published to `gem-auction/DEV_001/state`:

```json
{
  "screen": {
    "name": "bid_result",
    "state": "success",
    "title": "Bid Accepted",
    "subtitle": "Blue Sapphire 3.2ct",
    "message": "Your bid of LKR 55,000 was accepted"
  },
  "user": {
    "nfc_uid": "04A3B21C7F8890",
    "user_id": "uuid-of-user",
    "role": "user",
    "access_granted": true,
    "access_status": "success",
    "access_reason_code": null,
    "access_reason_label": null
  },
  "detail": {
    "auction": { "..." : "..." },
    "item": { "..." : "..." },
    "bid": {
      "item_id": "uuid-of-gem",
      "amount": 55000.0,
      "currency": "LKR",
      "bid_status": "ACCEPTED",
      "current_highest_bid": 55000.0,
      "next_min_bid": 57500.0,
      "reason_code": null,
      "reason_label": null
    },
    "update": null
  },
  "feedback": {
    "status": "success",
    "code": null,
    "label": null,
    "message": "Bid accepted"
  },
  "actions": {
    "primary": "submit_bid",
    "secondary": "refresh",
    "back": true
  }
}
```

---

## TypeScript Types

See `cdk/lambdas/shared/types.ts` for the full TypeScript type definitions including:

* `UnifiedDisplaySchema`
* `AuctionSummary`
* `ItemSummary`
* `BidDetail`
* `UpdateDetail`
* All MQTT payload types (`NfcScanPayload`, `BidSubmitPayload`, `HeartbeatPayload`)
* All DB row types

---

## Database Tables

### `devices`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | Internal ID |
| device_id | TEXT UNIQUE | Physical identifier burned into ESP32 |
| name | TEXT | Friendly name |
| status | TEXT | `active`, `inactive`, `maintenance` |
| firmware_version | TEXT | Current firmware |
| hardware_version | TEXT | Hardware revision |
| last_seen_at | TIMESTAMPTZ | Last heartbeat time |

### `nfc_cards`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | Internal ID |
| nfc_uid | TEXT | NFC card hardware UID |
| user_id | UUID FK→users | Mapped user |
| auction_id | UUID FK→auctions | Mapped auction (nullable) |
| is_active | BOOLEAN | Card active status |
| label | TEXT | Friendly label |
| UNIQUE | (nfc_uid, auction_id) | Same card can map to different auctions |

### `device_sessions`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | Internal ID |
| device_id | TEXT FK→devices | Device identifier |
| nfc_uid | TEXT | Card used |
| user_id | UUID FK→users | User |
| auction_id | UUID FK→auctions | Auction |
| started_at | TIMESTAMPTZ | Session start |
| ended_at | TIMESTAMPTZ | Session end (nullable) |
| status | TEXT | `active`, `ended`, `expired` |

---

## Normalization Rules

### 1) Always translate protocol enums into display labels

```json
{
  "mode": "progressive_elimination_auction",
  "mode_label": "Progressive Elimination"
}
```

### 2) Always include nullable fields instead of changing shape

One item shape for all auction types. Unavailable values are `null`.

### 3) Translate reason codes once

The Lambda mapper translates numeric error codes to human-readable labels in the `feedback` block.

### 4) Keep display schema free of transport concerns

The device UI does not need to know about MQTT topics, request/response pairing, or action-specific payload details. Those are handled by the protocol adapter layer in firmware.

---

## Firmware Architecture

The device firmware should implement four layers:

1. **Transport handler** – MQTT connection, TLS, topic management
2. **Protocol parser** – Parse incoming JSON payloads
3. **Mapper** – Map `UnifiedDisplaySchema` to internal UI state
4. **Renderer** – Draw screens based on `screen.name` and `screen.state`

This separation ensures protocol changes don't cascade into display code.
