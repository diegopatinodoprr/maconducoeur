export type AppEventType =
  | 'connection.created'
  | 'tool.created'
  | 'tool.updated'
  | 'borrowing.requested'
  | 'borrowing.status_changed';

export type AppEvent = {
  type: AppEventType;
  at: string;
  actor_user_id: string | null;
  entity_id: string | null;
  payload?: Record<string, unknown>;
};

type BroadcastFn = (event: AppEvent) => void;

let broadcastFn: BroadcastFn | null = null;

export function setEventBroadcaster(fn: BroadcastFn): void {
  broadcastFn = fn;
}

export function emitAppEvent(event: Omit<AppEvent, 'at'>): void {
  if (!broadcastFn) {
    return;
  }

  broadcastFn({
    ...event,
    at: new Date().toISOString()
  });
}
