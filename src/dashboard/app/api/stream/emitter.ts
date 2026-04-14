// In-memory SSE broadcaster — works for single-instance deployments and demos

type SSEClient = {
  id:       string;
  send:     (data: string) => void;
  close:    () => void;
};

const clients = new Map<string, SSEClient>();

export function addClient(client: SSEClient): void {
  clients.set(client.id, client);
}

export function removeClient(id: string): void {
  clients.delete(id);
}

export function broadcastEvent(event: { type: string; payload: Record<string, unknown> }): void {
  const message = JSON.stringify({ ...event, id: crypto.randomUUID() });
  for (const client of clients.values()) {
    try {
      client.send(message);
    } catch {
      clients.delete(client.id);
    }
  }
}
