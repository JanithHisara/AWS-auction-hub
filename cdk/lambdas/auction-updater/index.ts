import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getSupabaseClient } from '../shared/supabase-client';
import { publishToDevice } from '../shared/mqtt-publisher';
import { buildAuctionUpdateSchema, buildWinnerAnnouncementSchema } from '../shared/display-schema-mapper';
import type {
  SupabaseWebhookPayload,
  DeviceRow,
  DeviceSessionRow,
  AuctionRow,
  GemRow,
} from '../shared/types';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = JSON.parse(event.body || '{}') as SupabaseWebhookPayload;
    console.log(`Webhook: type=${body.type}, table=${body.table}`);

    const supabase = await getSupabaseClient();

    // Determine auction_id from the changed record
    let auctionId: string | null = null;
    const record = body.record || body.old_record;

    if (!record) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No record data' }) };
    }

    const isWinnerAnnouncement = body.table === 'auction_winners' && body.type === 'INSERT';

    if (body.table === 'auctions') {
      auctionId = record.id as string;
    } else if (body.table === 'gems') {
      auctionId = record.auction_id as string;
    } else if (body.table === 'bids') {
      const gemId = record.gem_id as string;
      const { data: gem } = await supabase
        .from('gems')
        .select('auction_id')
        .eq('id', gemId)
        .single();
      auctionId = gem?.auction_id ?? null;
    } else if (body.table === 'auction_winners') {
      const gemId = record.gem_id as string;
      const { data: gem } = await supabase
        .from('gems')
        .select('auction_id')
        .eq('id', gemId)
        .single();
      auctionId = gem?.auction_id ?? null;
    }

    if (!auctionId) {
      return { statusCode: 200, body: JSON.stringify({ message: 'Could not determine auction' }) };
    }

    // Find all active device sessions for this auction
    const { data: sessions } = await supabase
      .from('device_sessions')
      .select('*')
      .eq('auction_id', auctionId)
      .eq('status', 'active');

    if (!sessions || sessions.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No active device sessions' }) };
    }

    // Get auction details
    const { data: auction } = await supabase
      .from('auctions')
      .select('id, name, status, auction_type, auction_start, auction_end')
      .eq('id', auctionId)
      .single();

    if (!auction) {
      return { statusCode: 200, body: JSON.stringify({ message: 'Auction not found' }) };
    }

    const auctionRow = auction as AuctionRow;

    // Option B: fetch only the active item
    const { data: activeGem } = await supabase
      .from('gems')
      .select('id, name, description, starting_price, current_price, min_bid_increment, status, end_time, round_end_time, auction_id')
      .eq('auction_id', auctionId)
      .eq('status', 'active')
      .limit(1)
      .single();

    const { count: itemsCount } = await supabase
      .from('gems')
      .select('*', { count: 'exact', head: true })
      .eq('auction_id', auctionId);

    // Get unique device_ids from sessions
    const deviceIds = [...new Set((sessions as DeviceSessionRow[]).map(s => s.device_id))];

    // Get device info for all devices
    const { data: devices } = await supabase
      .from('devices')
      .select('*')
      .in('device_id', deviceIds);

    const deviceMap = new Map((devices || []).map((d: DeviceRow) => [d.device_id, d]));

    // For winner announcements, fetch winner info and send a special message
    let winnerInfo: { gemName: string; winnerName: string; amount: number } | null = null;
    if (isWinnerAnnouncement) {
      const winnerRecord = body.record;
      const { data: winBid } = await supabase
        .from('bids')
        .select('bid_amount')
        .eq('id', winnerRecord.winning_bid_id as string)
        .single();

      const { data: winUser } = await supabase
        .from('users')
        .select('display_name, anonymous_name, email')
        .eq('id', winnerRecord.user_id as string)
        .single();

      const { data: winGem } = await supabase
        .from('gems')
        .select('name')
        .eq('id', winnerRecord.gem_id as string)
        .single();

      winnerInfo = {
        gemName: winGem?.name || 'Unknown Item',
        winnerName: winUser?.display_name || winUser?.anonymous_name || winUser?.email || 'Anonymous',
        amount: winBid?.bid_amount || 0,
      };
    }

    // Publish update to each device with only the active item
    const publishPromises = deviceIds.map(async (deviceId) => {
      const device = deviceMap.get(deviceId);
      if (!device) return;

      let updateSchema;
      if (isWinnerAnnouncement && winnerInfo) {
        updateSchema = buildWinnerAnnouncementSchema(
          device,
          auctionRow,
          winnerInfo.gemName,
          winnerInfo.winnerName,
          winnerInfo.amount,
          (activeGem as GemRow) || null,
        );
      } else {
        updateSchema = buildAuctionUpdateSchema(
          device,
          auctionRow,
          (activeGem as GemRow) || null,
          itemsCount || 0,
        );
      }

      await publishToDevice(deviceId, 'auction/update', updateSchema);
    });

    await Promise.all(publishPromises);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Updated ${deviceIds.length} device(s)`,
        auction_id: auctionId,
      }),
    };
  } catch (error) {
    console.error('Auction updater error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
