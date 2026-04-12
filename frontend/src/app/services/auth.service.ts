import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';

interface LoginResponse {
  accessToken: string;
  tokenType: string;
  etudiantId: number;
  email: string;
  nom: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private readonly apiBaseUrl = 'http://localhost:8080/auth';
  private readonly tokenKey = 'openstudy.accessToken';
  private readonly userIdKey = 'openstudy.etudiantId';

  public isLoading = false;

  constructor(private http: HttpClient) {}

  public login(email: string, password: string): Observable<boolean> {
    this.isLoading = true;

    return this.http.post<LoginResponse>(`${this.apiBaseUrl}/login`, { email, password }).pipe(
      tap((response) => {
        localStorage.setItem(this.tokenKey, response.accessToken);
        localStorage.setItem(this.userIdKey, String(response.etudiantId));
      }),
      map(() => true),
      catchError(() => of(false)),
      finalize(() => {
        this.isLoading = false;
      })
    );
  }

  public register(fullName: string, email: string, password: string): Observable<boolean> {
    this.isLoading = true;

    return this.http.post(`${this.apiBaseUrl}/register`, {
      nom: fullName,
      email,
      password,
    }).pipe(
      map(() => true),
      catchError(() => of(false)),
      finalize(() => {
        this.isLoading = false;
      })
    );
  }

  public logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userIdKey);
  }

  public getToken(): string | null {
    const token = localStorage.getItem(this.tokenKey);
    if (!token) {
      return null;
    }

    const payload = this.getJwtPayload(token);
    const exp = Number(payload?.['exp']);
    if (Number.isFinite(exp) && Date.now() >= exp * 1000) {
      this.logout();
      return null;
    }

    return token;
  }

  public getCurrentUserId(): number | null {
    const value = localStorage.getItem(this.userIdKey);
    if (!value) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  public getUserIdFromToken(): number | null {
    const token = this.getToken();
    if (!token) {
      return null;
    }

    const payload = this.getJwtPayload(token) as { etudiantId?: number | string } | null;
    const id = Number(payload?.etudiantId);
    return Number.isFinite(id) ? id : null;
  }

  public isAuthenticated(): boolean {
    return !!this.getToken();
  }

  public getUserDisplayName(): string | null {
    const token = this.getToken();
    if (!token) {
      return null;
    }

    const payload = this.getJwtPayload(token);
    const name = this.readClaimString(payload, ['nom', 'name', 'preferred_username']);
    if (name) {
      return name;
    }

    return this.readClaimString(payload, ['email', 'sub']);
  }

  public getUserEmail(): string | null {
    const token = this.getToken();
    if (!token) {
      return null;
    }

    const payload = this.getJwtPayload(token);
    return this.readClaimString(payload, ['email']);
  }

  private readClaimString(payload: Record<string, unknown> | null, keys: string[]): string | null {
    if (!payload) {
      return null;
    }

    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim() !== '') {
        return value;
      }
    }

    return null;
  }

  private getJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    try {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payloadBase64 + '='.repeat((4 - (payloadBase64.length % 4)) % 4);
      const decoded = atob(padded);
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
