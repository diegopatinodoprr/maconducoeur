import { Injectable, effect } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type AppEventType =
  | 'connection.created'
  | 'tool.created'
  | 'tool.updated'
  | 'borrowing.requested'
  | 'borrowing.status_changed';

export interface AppEvent {
  type: AppEventType;
  at: string;
  actor_user_id: string | null;
  entity_id: string | null;
  payload?: Record<string, unknown>;
}

type SocketPayload = {
  kind: 'app.event';
  event: AppEvent;
};

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;
  private readonly eventsSubject = new Subject<AppEvent>();
  readonly events$: Observable<AppEvent> = this.eventsSubject.asObservable();

  constructor(private readonly auth: AuthService) {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  private connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.manualClose = false;
    this.clearReconnectTimer();
    this.socket = new WebSocket(this.wsUrl());

    this.socket.onmessage = (message) => {
      try {
        const payload = JSON.parse(String(message.data)) as SocketPayload;
        if (payload.kind === 'app.event' && payload.event?.type) {
          this.eventsSubject.next(payload.event);
        }
      } catch {
        // ignore malformed payload
      }
    };

    this.socket.onclose = () => {
      this.socket = null;
      if (!this.manualClose && this.auth.isAuthenticated()) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  private disconnect(): void {
    this.manualClose = true;
    this.clearReconnectTimer();
    this.socket?.close();
    this.socket = null;
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => this.connect(), 1500);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private wsUrl(): string {
    if (environment.apiUrl.startsWith('http://') || environment.apiUrl.startsWith('https://')) {
      return environment.apiUrl.replace(/^http/, 'ws').replace(/\/api\/?$/, '/ws');
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
}
