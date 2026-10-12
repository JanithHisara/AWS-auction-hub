import { NextRequest } from 'next/server';
import { realtimeEmitter, RealtimePayload } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetChannel = searchParams.get('channel');
  const targetTable = searchParams.get('table');

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection confirmation
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', channel: targetChannel })}\n\n`)
      );

      const onEvent = (event: RealtimePayload) => {
        try {
          if (targetTable && event.table && event.table !== targetTable) {
            return;
          }

          const message = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Stream might be closed
        }
      };

      realtimeEmitter.on('change', onEvent);

      // Heartbeat every 15 seconds to keep connection alive
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(interval);
        }
      }, 15000);

      // Handle abort / disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        realtimeEmitter.off('change', onEvent);
        try {
          controller.close();
        } catch {
          // Ignored
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
