import { NextRequest } from 'next/server';
import { addClient, removeClient } from './emitter';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const clientId = crypto.randomUUID();

  let sendFn: ((data: string) => void) | null = null;
  let closeFn: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      sendFn = (data: string) => {
        controller.enqueue(`data: ${data}\n\n`);
      };
      closeFn = () => {
        controller.close();
      };

      addClient({
        id:    clientId,
        send:  sendFn,
        close: closeFn,
      });

      // Send initial ping
      controller.enqueue(`: connected\n\n`);
    },
    cancel() {
      removeClient(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':                'text/event-stream',
      'Cache-Control':               'no-cache',
      'Connection':                  'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
