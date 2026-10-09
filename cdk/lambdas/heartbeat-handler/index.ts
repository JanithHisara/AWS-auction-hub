import { getSupabaseClient } from '../shared/supabase-client';
import type { HeartbeatPayload } from '../shared/types';

export async function handler(event: HeartbeatPayload): Promise<void> {
  const { device_id, firmware_version, timestamp } = event;
  console.log(`Heartbeat: device=${device_id}, fw=${firmware_version}`);

  const supabase = await getSupabaseClient();

  const updateData: Record<string, unknown> = {
    last_seen_at: timestamp || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (firmware_version) {
    updateData.firmware_version = firmware_version;
  }

  const { error } = await supabase
    .from('devices')
    .update(updateData)
    .eq('device_id', device_id);

  if (error) {
    console.error('Heartbeat update failed:', error);

    // Device might not exist yet - attempt upsert via insert if update matched nothing
    if (error.code === 'PGRST116') {
      console.log(`Device ${device_id} not found, skipping heartbeat`);
    }
  }

  // Expire stale device sessions (older than 4 hours without activity)
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  await supabase
    .from('device_sessions')
    .update({ status: 'expired', ended_at: new Date().toISOString() })
    .eq('device_id', device_id)
    .eq('status', 'active')
    .lt('started_at', fourHoursAgo);
}
