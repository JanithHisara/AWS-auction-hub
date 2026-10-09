# AuxtionHub - ESP32 Device API Reference

**Version:** 2.0 (Option B)  
**Date:** March 2026  
**Protocol:** MQTT 3.1.1 over TLS (port 8883)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Connection Configuration](#2-connection-configuration)
3. [Authentication (Certificates)](#3-authentication-certificates)
4. [Topic Reference](#4-topic-reference)
5. [API: NFC Scan](#5-api-nfc-scan)
6. [API: Bid Submit](#6-api-bid-submit)
7. [API: Heartbeat](#7-api-heartbeat)
8. [API: State Response (Inbound)](#8-api-state-response-inbound)
9. [API: Auction Update (Inbound)](#9-api-auction-update-inbound)
10. [Display Schema Reference](#10-display-schema-reference)
11. [Error Codes](#11-error-codes)
12. [Device Lifecycle](#12-device-lifecycle)
13. [Firmware Architecture Recommendation](#13-firmware-architecture-recommendation)

---

## 1. Architecture Overview

### How it works

1. **At the entrance:** An admin scans the attendee's NFC card using a USB reader on their laptop. The admin dashboard auto-registers the user for the auction. If the attendee doesn't have an NFC card, the admin creates a user and card on the spot.
2. **Inside the auction room:** Each ESP32 device is pre-assigned to a specific auction. When the attendee scans their NFC card on the device, it shows only the **current active item** and lets them place bids.
3. **Real-time updates:** The device automatically receives push updates when item prices change or items rotate. No polling needed.

### Key design decisions (Option B)

- **Device owns the auction context.** Each device is assigned to one auction via `devices.auction_id`. The NFC card is a pure user identifier with no auction context.
- **Single active item only.** The device only receives `detail.item` (the current active item). No item lists. This keeps payloads under **~2 KB** for reliable ESP32 operation.
- **Registration happens at the entrance**, not on the device. The device checks that the user is already registered.

---

## 2. Connection Configuration

| Parameter        | Value                                                        |
|------------------|--------------------------------------------------------------|
| MQTT Broker      | `a1m322vfibs32e-ats.iot.ap-southeast-1.amazonaws.com`        |
| Port             | `8883` (MQTT over TLS, mutual authentication)                |
| Protocol         | MQTT 3.1.1                                                   |
| Client ID        | Must match the Thing Name exactly (e.g. `AuxtionDevice`)     |
| Keep Alive       | 30 seconds recommended                                       |
| Clean Session    | `true`                                                       |
| QoS              | `1` for all publish and subscribe operations                  |

---

## 3. Authentication (Certificates)

The device authenticates using mutual TLS with X.509 certificates. Three files are required:

| File                   | Description                        |
|------------------------|------------------------------------|
| `AmazonRootCA1.pem`   | AWS Root Certificate Authority     |
| `certificate.pem.crt` | Device-specific client certificate |
| `private.pem.key`     | Device-specific private key        |

These files are provided separately per device and must be stored securely on the ESP32 (e.g. in SPIFFS or hardcoded in firmware).

> **Security note:** The private key must never be transmitted over an unencrypted channel. Each physical device receives its own unique certificate.

---

## 4. Topic Reference

All topics follow the pattern: `gem-auction/{device_id}/...`

Where `{device_id}` is the Thing Name (e.g. `AuxtionDevice`). The device can **only** access topics under its own `device_id`.

### Outbound (Device publishes)

| Topic                                         | Purpose             |
|-----------------------------------------------|---------------------|
| `gem-auction/{device_id}/nfc/scan`            | NFC card scanned    |
| `gem-auction/{device_id}/bid/submit`          | Place a bid         |
| `gem-auction/{device_id}/heartbeat`           | Periodic status     |

### Inbound (Device subscribes)

| Topic                                         | Purpose                          |
|-----------------------------------------------|----------------------------------|
| `gem-auction/{device_id}/state`               | Response to NFC scan and bids    |
| `gem-auction/{device_id}/auction/update`      | Real-time auction data push      |

### On connect, subscribe to both inbound topics:

```
gem-auction/{device_id}/state
gem-auction/{device_id}/auction/update
```

---

## 5. API: NFC Scan

Triggered when a user taps their NFC card on the device reader.

### Publish

**Topic:** `gem-auction/{device_id}/nfc/scan`

```json
{
  "action": "nfc_scan",
  "device_id": "AuxtionDevice",
  "nfc_uid": "04A3B21C7F8890",
  "timestamp": "2026-03-08T10:00:00Z",
  "firmware_version": "1.0.0"
}
```

| Field              | Type   | Required | Description                              |
|--------------------|--------|----------|------------------------------------------|
| `action`           | string | Yes      | Always `"nfc_scan"`                      |
| `device_id`        | string | Yes      | This device's Thing Name                 |
| `nfc_uid`          | string | Yes      | NFC card hardware UID (hex string)       |
| `timestamp`        | string | Yes      | ISO 8601 UTC timestamp                   |
| `firmware_version` | string | No       | Current firmware version                 |

### Response

Published to `gem-auction/{device_id}/state`.

**On success:** `screen.name = "active_item"`, `detail.item` contains the current active item.

**On error:** `screen.name = "nfc_access"`, `screen.state = "error"` with error code in `feedback`.

### Success Response Example (~1.5 KB)

```json
{
  "screen": {
    "name": "active_item",
    "state": "success",
    "title": "Dehiwala Auction",
    "subtitle": "Progressive Elimination",
    "message": "Blue Sapphire 3.2ct"
  },
  "device": {
    "device_id": "AuxtionDevice",
    "status": "active",
    "firmware_version": "1.0.0",
    "hardware_version": "1.0",
    "heartbeat_interval": 30,
    "last_seen_at": "2026-03-08T10:00:00Z"
  },
  "session": {
    "timestamp": "2026-03-08T10:00:01Z",
    "protocol_version": "1.0",
    "connection_status": "online"
  },
  "user": {
    "nfc_uid": "04A3B21C7F8890",
    "user_id": "5e7dc73c-7e6b-464c-8cc0-3c9a5b8b0d6a",
    "display_name": "John Doe",
    "role": "user",
    "access_granted": true,
    "access_status": "success",
    "access_reason_code": null,
    "access_reason_label": null
  },
  "context": {
    "active_auction_id": "2140b05d-38e8-42b1-ba8d-128181ea4796",
    "active_item_id": "d1b501ea-1298-45a0-a2c9-2a3af70ec192"
  },
  "detail": {
    "auction": {
      "auction_id": "2140b05d-38e8-42b1-ba8d-128181ea4796",
      "name": "Dehiwala Auction",
      "mode": "progressive_elimination_auction",
      "mode_label": "Progressive Elimination",
      "status": "live",
      "status_label": "Live",
      "start_datetime": "2026-02-25T18:30:00Z",
      "end_datetime": "2026-04-30T18:30:00Z",
      "items_count": 5,
      "registered_count": 15
    },
    "item": {
      "item_id": "d1b501ea-1298-45a0-a2c9-2a3af70ec192",
      "name": "Blue Sapphire 3.2ct",
      "status": "active",
      "current_price": 50000.00,
      "currency": "LKR",
      "next_min_bid": 52500.00,
      "end_datetime": "2026-03-08T12:00:00Z",
      "remaining_seconds": 7200,
      "your_bid_submitted": null
    },
    "bid": null
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

### Error Response Example

```json
{
  "screen": {
    "name": "nfc_access",
    "state": "error",
    "title": "Access Denied",
    "subtitle": null,
    "message": "You are not registered for this auction. Please register at the entrance."
  },
  "device": {
    "device_id": "AuxtionDevice",
    "status": "active",
    "firmware_version": null,
    "hardware_version": null,
    "heartbeat_interval": 30,
    "last_seen_at": null
  },
  "session": {
    "timestamp": "2026-03-08T10:00:01Z",
    "protocol_version": "1.0",
    "connection_status": "online"
  },
  "user": {
    "nfc_uid": "AABBCCDD112233",
    "user_id": null,
    "display_name": null,
    "role": null,
    "access_granted": false,
    "access_status": "error",
    "access_reason_code": 8,
    "access_reason_label": "Not Registered"
  },
  "context": {
    "active_auction_id": null,
    "active_item_id": null
  },
  "detail": {
    "auction": null,
    "item": null,
    "bid": null
  },
  "feedback": {
    "status": "error",
    "code": 8,
    "label": "Not Registered",
    "message": "You are not registered for this auction. Please register at the entrance."
  },
  "actions": {
    "primary": "scan_nfc",
    "secondary": null,
    "back": false
  }
}
```

---

## 6. API: Bid Submit

Triggered when the user presses a bid button on the device.

> **Prerequisite:** A successful NFC scan must have been performed first. The backend tracks an active session.

### Publish

**Topic:** `gem-auction/{device_id}/bid/submit`

```json
{
  "action": "submit_bid",
  "device_id": "AuxtionDevice",
  "nfc_uid": "04A3B21C7F8890",
  "item_id": "d1b501ea-1298-45a0-a2c9-2a3af70ec192",
  "amount": 52500.00,
  "timestamp": "2026-03-08T10:05:00Z"
}
```

| Field       | Type   | Required | Description                                    |
|-------------|--------|----------|------------------------------------------------|
| `action`    | string | Yes      | Always `"submit_bid"`                          |
| `device_id` | string | Yes      | This device's Thing Name                       |
| `nfc_uid`   | string | Yes      | NFC UID from the currently scanned card        |
| `item_id`   | string | Yes      | UUID of the item to bid on (from `detail.item.item_id`) |
| `amount`    | number | Yes      | Bid amount (must be >= `detail.item.next_min_bid`) |
| `timestamp` | string | Yes      | ISO 8601 UTC timestamp                         |

### Response

Published to `gem-auction/{device_id}/state`.

### Accepted Response Example

```json
{
  "screen": {
    "name": "bid_result",
    "state": "success",
    "title": "Bid Accepted",
    "subtitle": "Blue Sapphire 3.2ct",
    "message": "Your bid of LKR 52,500 was accepted"
  },
  "detail": {
    "auction": { "...": "auction summary" },
    "item": {
      "item_id": "d1b501ea-1298-45a0-a2c9-2a3af70ec192",
      "name": "Blue Sapphire 3.2ct",
      "status": "active",
      "current_price": 52500.00,
      "currency": "LKR",
      "next_min_bid": 55000.00,
      "end_datetime": "2026-03-08T12:00:00Z",
      "remaining_seconds": 6900,
      "your_bid_submitted": null
    },
    "bid": {
      "item_id": "d1b501ea-1298-45a0-a2c9-2a3af70ec192",
      "amount": 52500.00,
      "currency": "LKR",
      "bid_status": "ACCEPTED",
      "current_highest_bid": 52500.00,
      "next_min_bid": 55000.00,
      "reason_code": null,
      "reason_label": null
    }
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

### Rejected Response Example

```json
{
  "screen": {
    "name": "bid_result",
    "state": "success",
    "title": "Bid Rejected",
    "subtitle": "Blue Sapphire 3.2ct",
    "message": "Minimum bid is 52500"
  },
  "detail": {
    "auction": { "...": "auction summary" },
    "item": { "...": "item summary" },
    "bid": {
      "item_id": "d1b501ea-1298-45a0-a2c9-2a3af70ec192",
      "amount": 40000.00,
      "currency": "LKR",
      "bid_status": "REJECTED",
      "current_highest_bid": 50000.00,
      "next_min_bid": 52500.00,
      "reason_code": 13,
      "reason_label": "Minimum bid is 52500"
    }
  },
  "feedback": {
    "status": "error",
    "code": 13,
    "label": "Minimum bid is 52500",
    "message": "Minimum bid is 52500"
  }
}
```

---

## 7. API: Heartbeat

Sent periodically to report device health. **No response is returned.**

### Publish

**Topic:** `gem-auction/{device_id}/heartbeat`

```json
{
  "action": "heartbeat",
  "device_id": "AuxtionDevice",
  "firmware_version": "1.0.0",
  "uptime_seconds": 3600,
  "free_heap": 150000,
  "wifi_rssi": -42,
  "timestamp": "2026-03-08T10:30:00Z"
}
```

| Field              | Type   | Required | Description                              |
|--------------------|--------|----------|------------------------------------------|
| `action`           | string | Yes      | Always `"heartbeat"`                     |
| `device_id`        | string | Yes      | This device's Thing Name                 |
| `firmware_version` | string | No       | Current firmware version                 |
| `uptime_seconds`   | number | No       | Seconds since last boot                  |
| `free_heap`        | number | No       | Free heap memory in bytes                |
| `wifi_rssi`        | number | No       | WiFi signal strength in dBm              |
| `timestamp`        | string | Yes      | ISO 8601 UTC timestamp                   |

### Recommended interval

Send a heartbeat every **30 seconds**. Sessions older than 4 hours are auto-expired.

---

## 8. API: State Response (Inbound)

**Topic:** `gem-auction/{device_id}/state`

This is the primary response channel. The device receives messages here after publishing an NFC scan or bid submit.

### How to determine what happened

Check `screen.name` to decide which screen to render:

| `screen.name`    | Trigger                      | What to display                  |
|------------------|------------------------------|----------------------------------|
| `active_item`    | Successful NFC scan          | Auction info + current item      |
| `nfc_access`     | Failed NFC scan              | Error message                    |
| `bid_result`     | Bid response                 | Bid accepted/rejected            |
| `startup`        | Initial state                | Device info                      |

Check `screen.state` for the overall result:

| `screen.state` | Meaning                   |
|-----------------|--------------------------|
| `success`       | Operation succeeded      |
| `error`         | Operation failed         |
| `loading`       | Processing (optional)    |
| `idle`          | No active operation      |

---

## 9. API: Auction Update (Inbound)

**Topic:** `gem-auction/{device_id}/auction/update`

Server-initiated push messages when the auction state changes. These arrive automatically while a session is active.

The payload follows the same schema with:
- `screen.name = "active_item"`
- Updated `detail.item` with the current active item's latest price
- `user` is `null` (device retains user context from the original NFC scan)

### When updates are sent

- A new bid is placed (from any user, web or device)
- The active item changes (e.g. item rotates from one to the next)
- An item status changes (e.g. `active` to `ended`)
- The auction status changes

### Recommended handling

Update the display with the new item data. Do **not** clear the user context -- retain it from the original NFC scan.

---

## 10. Display Schema Reference

Every response follows this flat structure (~1.5-2 KB per message):

```
{
  screen          -- Which screen to render and its state
  device          -- Device metadata
  session         -- Transport session info
  user            -- Authenticated user info (null if no scan / push update)
  context         -- Active auction/item IDs
  detail
    .auction      -- Auction summary
    .item         -- Current active item (the ONLY item sent)
    .bid          -- Bid result (only in bid_result responses)
  feedback        -- User-facing status message
  actions         -- Button hints
}
```

### `screen`

| Field      | Type   | Description                                    |
|------------|--------|------------------------------------------------|
| `name`     | string | `"active_item"`, `"nfc_access"`, `"bid_result"`, `"startup"` |
| `state`    | string | `"success"`, `"error"`, `"loading"`, `"idle"`  |
| `title`    | string | Primary heading (nullable)                     |
| `subtitle` | string | Secondary heading (nullable)                   |
| `message`  | string | Descriptive message (nullable)                 |

### `device`

| Field               | Type   | Description                  |
|---------------------|--------|------------------------------|
| `device_id`         | string | This device's Thing Name     |
| `status`            | string | `"active"`, `"inactive"`    |
| `firmware_version`  | string | Nullable                     |
| `hardware_version`  | string | Nullable                     |
| `heartbeat_interval`| number | Recommended interval (30s)   |
| `last_seen_at`      | string | Last heartbeat timestamp     |

### `user`

| Field                | Type    | Description                           |
|----------------------|---------|---------------------------------------|
| `nfc_uid`            | string  | NFC card UID that was scanned         |
| `user_id`            | string  | User UUID (null on error)             |
| `display_name`       | string  | User's display name (nullable)        |
| `role`               | string  | User role (null on error)             |
| `access_granted`     | boolean | Whether access was granted            |
| `access_status`      | string  | `"success"` or `"error"`              |
| `access_reason_code` | number  | Error code (null on success)          |
| `access_reason_label`| string  | Error label (null on success)         |

### `context`

| Field               | Type   | Description                              |
|---------------------|--------|------------------------------------------|
| `active_auction_id` | string | UUID of the current auction (nullable)   |
| `active_item_id`    | string | UUID of the active item (nullable)       |

### `detail.item`

The single current active item. This is the **only item** sent to the device.

| Field              | Type    | Description                                |
|--------------------|---------|--------------------------------------------|
| `item_id`          | string  | Item UUID                                  |
| `name`             | string  | Item display name                          |
| `status`           | string  | `"active"`, `"ended"`, etc.                |
| `current_price`    | number  | Current highest price (LKR)                |
| `currency`         | string  | Always `"LKR"`                             |
| `next_min_bid`     | number  | Minimum accepted bid amount                |
| `end_datetime`     | string  | Round/item end time ISO 8601 (nullable)    |
| `remaining_seconds`| number  | Seconds until end (nullable)               |
| `your_bid_submitted`| boolean| Whether this user already bid (nullable)  |

### `detail.bid`

Present only in bid result responses:

| Field               | Type   | Description                              |
|---------------------|--------|------------------------------------------|
| `item_id`           | string | Item the bid was placed on               |
| `amount`            | number | Bid amount submitted                     |
| `currency`          | string | Always `"LKR"`                           |
| `bid_status`        | string | `"ACCEPTED"` or `"REJECTED"`            |
| `current_highest_bid`| number| Current highest bid                      |
| `next_min_bid`      | number | New minimum bid amount                   |
| `reason_code`       | number | Rejection reason (null if accepted)      |
| `reason_label`      | string | Rejection reason text (null if accepted) |

### `feedback`

| Field     | Type   | Description                              |
|-----------|--------|------------------------------------------|
| `status`  | string | `"success"`, `"error"`, `"warning"`, `"info"` |
| `code`    | number | Error/status code (nullable)             |
| `label`   | string | Short label (nullable)                   |
| `message` | string | Human-readable message (nullable)        |

### `actions`

| Field       | Type    | Description                             |
|-------------|---------|-----------------------------------------|
| `primary`   | string  | Primary action hint (nullable)          |
| `secondary` | string  | Secondary action hint (nullable)        |
| `back`      | boolean | Whether back action is available        |

Possible action values: `"submit_bid"`, `"refresh"`, `"scan_nfc"`

---

## 11. Error Codes

| Code | Label                       | Description                                        | User Action              |
|------|-----------------------------|----------------------------------------------------|--------------------------|
| 1    | Device Not Registered       | This device ID is not in the system                | Contact administrator    |
| 2    | Device Inactive             | Device exists but is disabled                      | Contact administrator    |
| 3    | Card Not Recognized         | NFC card UID not found in the database             | Use a registered card    |
| 5    | User Not Found              | User account was deleted                           | Contact administrator    |
| 6    | Auction Not Found           | The assigned auction no longer exists               | Contact administrator    |
| 7    | Auction Not Live            | Auction exists but is not currently live            | Wait for auction to start|
| 8    | Not Registered              | User is not registered for this auction            | Register at entrance     |
| 9    | Registration Pending        | Registration not yet approved                      | Wait for approval        |
| 10   | No Active Session           | Bid attempted without a prior NFC scan             | Scan NFC card first      |
| 11   | Item Not Found              | The item_id in the bid does not exist              | Refresh item             |
| 12   | Item Not Active             | Item exists but bidding is not open                | Wait for item to go live |
| 13   | Bid Too Low                 | Amount is below the minimum required bid           | Increase bid amount      |
| 14   | Bidder On Hold              | Admin has placed a hold on this user               | Contact administrator    |
| 15   | Bid Failed                  | Server error while inserting the bid               | Retry                    |
| 16   | No Auction Assigned         | Device is not assigned to any auction              | Contact administrator    |

---

## 12. Device Lifecycle

### Boot Sequence

```
1. Connect to WiFi
2. Configure TLS with certificates
3. Connect to MQTT broker (Client ID = Thing Name)
4. Subscribe to:
   - gem-auction/{device_id}/state
   - gem-auction/{device_id}/auction/update
5. Display startup/idle screen
6. Begin heartbeat timer (every 30 seconds)
7. Wait for NFC card scan
```

### Active Session Flow

```
1. User taps NFC card
2. Publish to gem-auction/{device_id}/nfc/scan
3. Wait for response on .../state (timeout: 10s)
4. If success: display active item screen
5. User presses bid button
6. Publish to gem-auction/{device_id}/bid/submit
7. Wait for response on .../state (timeout: 10s)
8. Display bid result
9. Listen for push updates on .../auction/update
10. When update arrives, refresh item display
11. Repeat from step 5 for additional bids
```

### Reconnection

1. Attempt reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
2. After reconnect, resubscribe to both inbound topics
3. If a user session was active, re-publish the NFC scan to refresh state

---

## 13. Firmware Architecture Recommendation

```
┌─────────────────────────────┐
│       Display Renderer      │  Renders based on screen.name
├─────────────────────────────┤
│     Schema Parser           │  Parses JSON, extracts detail.item
├─────────────────────────────┤
│     Transport Handler       │  MQTT connection, TLS, topics
└─────────────────────────────┘
```

### Key libraries (Arduino/PlatformIO)

| Library            | Purpose                    |
|--------------------|----------------------------|
| `WiFiClientSecure` | TLS connection             |
| `PubSubClient`     | MQTT 3.1.1 client          |
| `ArduinoJson`      | JSON parsing               |
| `TFT_eSPI` or `LVGL` | Display rendering       |

### PubSubClient buffer size

```cpp
PubSubClient client(espClient);
client.setBufferSize(4096);  // 4 KB is sufficient for Option B payloads
```

---

## Payload Size Estimates

| Scenario              | Approximate Size |
|-----------------------|------------------|
| NFC scan success      | ~1.5 KB          |
| NFC scan error        | ~0.8 KB          |
| Bid accepted          | ~1.5 KB          |
| Bid rejected          | ~1.3 KB          |
| Auction update (push) | ~1.2 KB          |

All payloads are well within ESP32 memory constraints.

---

## Testing

Before connecting the physical device, test via the **AWS IoT Core MQTT Test Client**:

1. Open: https://ap-southeast-1.console.aws.amazon.com/iot/home?region=ap-southeast-1#/test
2. Subscribe to `gem-auction/AuxtionDevice/#`
3. Publish test payloads to the outbound topics
4. Observe responses in the subscription panel
