
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { User } from '../models';
import { ApiService } from './api.service';
import { AuthTokenService } from './auth-token.service';

const USER_KEY = 'bot-ia-user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private apiService = inject(ApiService);
  private authTokenService = inject(AuthTokenService);

  currentUser = signal<User | null>(this.getStoredUser());

  constructor() {
    // If a token exists on page load, try to fetch the user associated with it.
    if (this.authTokenService.token() && !this.currentUser()) {
      this.fetchCurrentUser().catch(() => this.logout());
    }
  }

  private async fetchCurrentUser() {
    try {
      const user = await firstValueFrom(this.http.get<User>(`${this.apiService.baseUrl}/users/me/`));
      this.setSession(user, this.authTokenService.token()!);
    } catch (error) {
      console.error("Failed to fetch current user with stored token, logging out.", error);
      this.logout();
    }
  }

  private getStoredUser(): User | null {
    const userJson = localStorage.getItem(USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  }

  private setSession(user: User, token: string) {
    this.currentUser.set(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.authTokenService.setToken(token);
  }

  private handleAuthError(err: HttpErrorResponse): never {
    if (err.status === 401 || err.status === 400) {
      throw new Error('ERROR_INVALID_CREDENTIALS');
    }
    if (err.status === 0) {
      throw new Error('ERROR_NETWORK_OR_CORS');
    }
    throw new Error('ERROR_UNKNOWN');
  }

  async login(email: string, password: string): Promise<User> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });
    const body = new HttpParams().set('username', email).set('password', password);

    try {
      const tokenResponse = await firstValueFrom(
        this.http.post<{ access_token: string }>(`${this.apiService.baseUrl}/auth/login`, body.toString(), { headers })
      );
      
      const token = tokenResponse.access_token;
      this.authTokenService.setToken(token);
      
      const user = await firstValueFrom(this.http.get<User>(`${this.apiService.baseUrl}/users/me/`));
      this.setSession(user, token);
      return user;
    } catch (err) {
      this.handleAuthError(err as HttpErrorResponse);
    }
  }

  logout() {
    this.currentUser.set(null);
    this.authTokenService.setToken(null);
    localStorage.removeItem(USER_KEY);
  }

  async register(email: string, password: string): Promise<User> {
    const url = `${this.apiService.baseUrl}/users/`;
    try {
      await firstValueFrom(this.http.post<User>(url, { email, password }));
      // After successful registration, automatically log the user in to get a token
      return await this.login(email, password);
    } catch (err: any) {
      if (err instanceof HttpErrorResponse && err.status === 400) {
        throw new Error('ERROR_EMAIL_EXISTS');
      }
      this.handleAuthError(err);
    }
  }
  
  async resetPasswordForEmail(email: string): Promise<void> {
    const url = `${this.apiService.baseUrl}/users/request-password-recovery/${email}`;
    try {
      await firstValueFrom(this.http.post(url, {}));
    } catch (err: any) {
      if (err instanceof HttpErrorResponse && err.status === 404) {
        // Don't reveal if user exists, but handle for specific error mapping
        throw new Error('ERROR_USER_NOT_FOUND');
      }
      this.handleAuthError(err);
    }
  }

  async signInWithGoogle(): Promise<User> {
    // This requires a more complex OAuth2 flow and is not implemented.
    throw new Error('Google Sign-In not implemented.');
  }


  // Admin method
  async getUsers(): Promise<User[]> {
    const url = `${this.apiService.baseUrl}/admin/users`;
    return firstValueFrom(this.http.get<User[]>(url).pipe(
      catchError(() => of([]))
    ));
  }

  // Admin method
  async updateUserBotAccess(userId: string, botId: string, hasAccess: boolean): Promise<void> {
    const url = `${this.apiService.baseUrl}/admin/users/${userId}/bots`;
    const body = { bot_id: botId, has_access: hasAccess };
    // Reverting to POST as the server returned a 405 Method Not Allowed for PUT.
    return firstValueFrom(this.http.post<void>(url, body));
  }
}