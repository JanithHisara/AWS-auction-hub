import { getSupabaseClient } from '../shared/supabase-client';
import { publishToDevice } from '../shared/mqtt-publisher';
import {
  buildNfcSuccessSchema,
  buildNfcErrorSchema,
} from '../shared/display-schema-mapper';
import type {
  NfcScanPayload,
  DeviceRow,
  NfcCardRow,
  UserRow,
  AuctionRow,
  GemRow,
} from '../shared/types';

export async function handler(event: NfcScanPayload): Promise<void> {
  const { device_id, nfc_uid } = event;
  console.log(`NFC scan: device=${device_id}, nfc_uid=${nfc_uid}`);

  const supabase = await getSupabaseClient();

  // 1. Verify device exists and is active
  const { data: device, error: deviceError } = await supabase
    .from('devices')
    .select('*')
    .eq('device_id', device_id)
    .single();

  if (deviceError || !device) {
    console.error('Device not found:', device_id);
    await publishToDevice(device_id, 'state', buildNfcErrorSchema(
      null, nfc_uid, 1, 'Device Not Registered', 'This device is not registered in the system',
    ));
    return;
  }

  const deviceRow = device as DeviceRow;

  if (deviceRow.status !== 'active') {
    await publishToDevice(device_id, 'state', buildNfcErrorSchema(
      deviceRow, nfc_uid, 2, 'Device Inactive', 'This device is currently inactive',
    ));
    return;
  }

  // 2. Resolve auction from device assignment (Option B)
  if (!deviceRow.auction_id) {
    await publishToDevice(device_id, 'state', buildNfcErrorSchema(
      deviceRow, nfc_uid, 16, 'No Auction Assigned', 'This device is not assigned to an auction',
    ));
    return;
  }

  // 3. Look up NFC card  user mapping (card is now user-only, no auction context)
  const { data: nfcCard, error: nfcError } = await supabase
    .from('nfc_cards')
    .select('*')
    .eq('nfc_uid', nfc_uid)
    .eq('is_active', true)
    .single();

  if (nfcError || !nfcCard) {
    await publishToDevice(device_id, 'state', buildNfcErrorSchema(
      deviceRow, nfc_uid, 3, 'Card Not Recognized', 'This NFC card is not registered',
    ));
    return;
  }

  const nfcCardRow = nfcCard as NfcCardRow;

  // 4. Get user details
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, role, display_name, phone')
    .eq('id', nfcCardRow.user_id)
    .single();

  if (userError || !user) {
    await publishToDevice(device_id, 'state', buildNfcErrorSchema(
      deviceRow, nfc_uid, 5, 'User Not Found', 'The user associated with this card was not found',
    ));
    return;
  }

  const userRow = user as UserRow;

  // 5. Get auction details from device's assigned auction
  const { data: auction, error: auctionError } = await supabase
    .from('auctions')
    .select('id, name, status, auction_type, auction_start, auction_end')
    .eq('id', deviceRow.auction_id)
    .single();

  if (auctionError || !auction) {
    await publishToDevice(device_id, 'state', buildNfcErrorSchema(
      deviceRow, nfc_uid, 6, 'Auction Not Found', 'The assigned auction does not exist',
    ));
    return;
  }

  const auctionRow = auction as AuctionRow;

  if (auctionRow.status !== 'live' && auctionRow.status !== 'registration_closed') {
    await publishToDevice(device_id, 'state', buildNfcErrorSchema(
      deviceRow, nfc_uid, 7, 'Auction Not Live',
      `Auction "${auctionRow.name}" is currently ${auctionRow.status}`,
    ));
    return;
  }

  // 6. Verify auction registration
  const { data: registration } = await supabase
    .from('auction_registrations')
    .select('id, approval_status')
    .eq('auction_id', deviceRow.auction_id)
    .eq('user_id', nfcCardRow.user_id)
    .single();

  if (!registration) {
    await publishToDevice(device_id, 'state', buildNfcErrorSchema(
      deviceRow, nfc_uid, 8, 'Not Registered', 'You are not registered for this auction. Please register at the entrance.',
    ));
    return;
  }

  if (registration.approval_status !== 'approved') {
    await publishToDevice(device_id, 'state', buildNfcErrorSchema(
      deviceRow, nfc_uid, 9, 'Registration Pending',
      `Your registration is ${registration.approval_status}`,
    ));
    return;
  }

  // 7. Get only the active item (Option B: single item, not full list)
  const { data: activeGem } = await supabase
    .from('gems')
    .select('id, name, description, starting_price, current_price, min_bid_increment, status, end_time, round_end_time, auction_id')
    .eq('auction_id', deviceRow.auction_id)
    .eq('status', 'active')
    .limit(1)
    .single();

  // 8. Get total items count
  const { count: itemsCount } = await supabase
    .from('gems')
    .select('*', { count: 'exact', head: true })
    .eq('auction_id', deviceRow.auction_id);

  // 9. Get registration count
  const { count: registeredCount } = await supabase
    .from('auction_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('auction_id', deviceRow.auction_id)
    .eq('approval_status', 'approved');

  // 10. Create/update device session
  await supabase
    .from('device_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('device_id', device_id)
    .eq('status', 'active');

  await supabase
    .from('device_sessions')
    .insert({
      device_id,
      nfc_uid,
      user_id: nfcCardRow.user_id,
      auction_id: deviceRow.auction_id,
      status: 'active',
    });

  await supabase
    .from('devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('device_id', device_id);

  // 11. Build and publish success state with only the active item
  const displayState = buildNfcSuccessSchema(
    deviceRow,
    userRow,
    nfc_uid,
    auctionRow,
    (activeGem as GemRow) || null,
    itemsCount || 0,
    registeredCount || 0,
  );

  await publishToDevice(device_id, 'state', displayState);
  console.log(`NFC scan success: user=${userRow.email}, auction=${auctionRow.name}`);
}


