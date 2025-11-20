import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  toasts = signal<Toast[]>([]);
  private lastId = 0;

  show(message: string, type: 'success' | 'error') {
    const id = this.lastId++;
    this.toasts.update(toasts => [...toasts, { id, message, type }]);

    setTimeout(() => this.remove(id), 5000); // Auto-remove after 5 seconds
  }

  showSuccess(message: string) {
    this.show(message, 'success');
  }

  showError(message: string) {
    this.show(message, 'error');
  }

  remove(id: number) {
    this.toasts.update(toasts => toasts.filter(t => t.id !== id));
  }
}
