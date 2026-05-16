import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly items = signal<ToastItem[]>([]);

  show(message: string, type: ToastType = 'info', durationMs = 3500): void {
    const item: ToastItem = { id: Date.now() + Math.floor(Math.random() * 1000), message, type };
    this.items.update((list) => [...list, item]);

    setTimeout(() => {
      this.dismiss(item.id);
    }, durationMs);
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error', 4500);
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }
}
