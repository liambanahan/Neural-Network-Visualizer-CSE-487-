import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface LoginCredentials {
  email?: string;
  password: string;
  masterPassword?: string;
}

export interface PermissionRequest {
  name: string;
  email: string;
  reason: string;
}

export interface User {
  email: string | null;
  isMaster: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private tokenKey = 'auth_token';
  private userKey = 'auth_user';
  
  private currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Login with email/password or master password
   */
  login(credentials: LoginCredentials): Observable<{access_token: string, token_type: string, is_master: boolean, email?: string}> {
    const body: any = {
      password: credentials.password
    };
    
    if (credentials.masterPassword) {
      body.master_password = credentials.masterPassword;
    } else if (credentials.email) {
      body.email = credentials.email;
    }

    return this.http.post<{access_token: string, token_type: string, is_master: boolean, email?: string}>(
      `${this.apiUrl}/auth/login`,
      body
    ).pipe(
      tap(response => {
        this.setToken(response.access_token);
        const user: User = {
          email: response.email || null,
          isMaster: response.is_master
        };
        this.setUser(user);
        this.currentUserSubject.next(user);
      }),
      catchError(error => {
        console.error('Login error:', error);
        return throwError(() => new Error(error.error?.detail || 'Login failed'));
      })
    );
  }

  /**
   * Logout
   */
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.currentUserSubject.next(null);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Check if current user is admin (master)
   */
  isAdmin(): boolean {
    const user = this.getStoredUser();
    return user?.isMaster || false;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Get auth token
   */
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * Set auth token
   */
  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  /**
   * Get stored user
   */
  private getStoredUser(): User | null {
    const userStr = localStorage.getItem(this.userKey);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Set user
   */
  private setUser(user: User): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  /**
   * Submit permission request
   */
  submitPermissionRequest(request: PermissionRequest): Observable<{request_id: string, status: string}> {
    return this.http.post<{request_id: string, status: string}>(
      `${this.apiUrl}/auth/requests`,
      request
    ).pipe(
      catchError(error => {
        console.error('Permission request error:', error);
        return throwError(() => new Error(error.error?.detail || 'Failed to submit request'));
      })
    );
  }

  /**
   * Get auth headers for API requests
   */
  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    if (token) {
      return new HttpHeaders({
        'Authorization': `Bearer ${token}`
      });
    }
    return new HttpHeaders();
  }
}
