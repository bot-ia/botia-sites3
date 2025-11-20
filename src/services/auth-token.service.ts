import { Injectable, signal } from '@angular/core';

const AUTH_TOKEN_KEY = 'bot-ia-auth-token';

@Injectable({
  providedIn: 'root',
})
export class AuthTokenService {
  readonly token = signal<string | null>(this.getStoredToken());

  setToken(token: string | null) {
    this.token.set(token);
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }

  private getStoredToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }
}
