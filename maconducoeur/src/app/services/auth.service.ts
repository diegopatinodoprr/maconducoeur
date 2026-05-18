import { HttpClient } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type Role = 'admin' | 'user';

interface LoginResponse {
  token: string;
  user: { id: string; email: string; role: Role };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  readonly token = signal<string | null>(this.normalizeStoredValue(localStorage.getItem('token')));
  readonly role = signal<Role | null>((localStorage.getItem('role') as Role | null) ?? null);
  readonly userId = signal<string | null>(localStorage.getItem('user_id'));
  readonly email = signal<string | null>(localStorage.getItem('email'));
  readonly isAuthenticated = computed(() => !!this.token());

  constructor(private readonly http: HttpClient) {}

  private normalizeStoredValue(value: string | null): string | null {
    if (!value) {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'null' || normalized === 'undefined') {
      return null;
    }
    return value;
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('role', res.user.role);
        localStorage.setItem('user_id', res.user.id);
        localStorage.setItem('email', res.user.email);
        this.token.set(res.token);
        this.role.set(res.user.role);
        this.userId.set(res.user.id);
        this.email.set(res.user.email);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user_id');
    localStorage.removeItem('email');
    this.token.set(null);
    this.role.set(null);
    this.userId.set(null);
    this.email.set(null);
  }
}
