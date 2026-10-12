import { EventEmitter } from 'events';

// Global singleton EventEmitter across Next.js development and serverless invocations
const globalForEvents = globalThis as unknown as {
  realtimeEmitter: EventEmitter | undefined;
};

export const realtimeEmitter =
  globalForEvents.realtimeEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForEvents.realtimeEmitter = realtimeEmitter;
}

realtimeEmitter.setMaxListeners(500);

export interface RealtimePayload {
  channel: string;
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: any;
  old?: any;
}

export function broadcastEvent(event: RealtimePayload) {
  try {
    realtimeEmitter.emit('change', event);
    realtimeEmitter.emit(`channel:${event.channel}`, event);
    // Also emit by table name so subscriptions by table work
    realtimeEmitter.emit(`table:${event.table}`, event);
  } catch (err) {
    console.error('Failed to broadcast realtime event:', err);
  }
}
