import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface PermissionRequest {
  id: string;
  name: string;
  email: string;
  reason: string;
  timestamp: string;
  status: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

interface User {
  email: string;
}

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50 py-10 px-4">
      <div class="container mx-auto max-w-6xl">
        <header class="mb-8">
          <h1 class="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
          <p class="text-gray-600">Manage users and permission requests</p>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Permission Requests -->
          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold mb-4">Permission Requests</h2>
            
            <div *ngIf="isLoadingRequests" class="text-center py-4">
              <div class="text-gray-500">Loading requests...</div>
            </div>
            
            <div *ngIf="!isLoadingRequests && requests.length === 0" class="text-center py-4 text-gray-500">
              No pending requests
            </div>
            
            <div *ngFor="let request of requests" class="border-b pb-4 mb-4 last:border-b-0">
              <div class="flex justify-between items-start mb-2">
                <div>
                  <div class="font-semibold">{{ request.name }}</div>
                  <div class="text-sm text-gray-600">{{ request.email }}</div>
                  <div class="text-xs text-gray-500 mt-1">{{ request.timestamp | date:'short' }}</div>
                </div>
                <span [class]="getStatusClass(request.status)" class="px-2 py-1 rounded text-xs font-medium">
                  {{ request.status }}
                </span>
              </div>
              <div class="text-sm text-gray-700 mb-3">{{ request.reason }}</div>
              
              <div *ngIf="request.status === 'pending'" class="flex gap-2">
                <button
                  (click)="approveRequest(request.id)"
                  [disabled]="isProcessing"
                  class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  (click)="showRejectModal(request)"
                  [disabled]="isProcessing"
                  class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  (click)="deleteRequest(request.id)"
                  [disabled]="isProcessing"
                  class="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
              
              <div *ngIf="request.rejection_reason" class="text-sm text-red-600 mt-2">
                Reason: {{ request.rejection_reason }}
              </div>
            </div>
          </div>

          <!-- Users -->
          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold mb-4">Users</h2>
            
            <div class="mb-4">
              <h3 class="text-lg font-medium mb-2">Create New User</h3>
              <div class="space-y-2">
                <input
                  type="email"
                  [(ngModel)]="newUserEmail"
                  placeholder="Email"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  type="password"
                  [(ngModel)]="newUserPassword"
                  placeholder="Password"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <button
                  (click)="createUser()"
                  [disabled]="isProcessing || !newUserEmail || !newUserPassword"
                  class="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  Create User
                </button>
              </div>
            </div>
            
            <div *ngIf="isLoadingUsers" class="text-center py-4">
              <div class="text-gray-500">Loading users...</div>
            </div>
            
            <div *ngIf="!isLoadingUsers && users.length === 0" class="text-center py-4 text-gray-500">
              No users
            </div>
            
            <div *ngFor="let user of users" class="flex justify-between items-center border-b pb-2 mb-2 last:border-b-0">
              <div class="text-gray-700">{{ user.email }}</div>
              <button
                (click)="deleteUser(user.email)"
                [disabled]="isProcessing"
                class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reject Modal -->
    <div *ngIf="showRejectReasonModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 class="text-xl font-bold mb-4">Reject Request</h3>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">Reason (optional)</label>
          <textarea
            [(ngModel)]="rejectReason"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Optional reason for rejection..."
          ></textarea>
        </div>
        <div class="flex gap-2">
          <button
            (click)="confirmReject()"
            [disabled]="isProcessing"
            class="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            (click)="cancelReject()"
            class="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class AdminPageComponent implements OnInit {
  requests: PermissionRequest[] = [];
  users: User[] = [];
  isLoadingRequests = false;
  isLoadingUsers = false;
  isProcessing = false;
  showRejectReasonModal = false;
  currentRejectRequestId: string | null = null;
  rejectReason = '';
  newUserEmail = '';
  newUserPassword = '';

  private apiUrl = environment.apiUrl;

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAdmin()) {
      // Redirect or show error
      return;
    }
    this.loadRequests();
    this.loadUsers();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  loadRequests(): void {
    this.isLoadingRequests = true;
    const headers = this.authService.getAuthHeaders();
    this.http.get<{requests: PermissionRequest[]}>(`${this.apiUrl}/auth/requests`, { headers })
      .subscribe({
        next: (response) => {
          this.requests = response.requests;
          this.isLoadingRequests = false;
        },
        error: (error) => {
          console.error('Error loading requests:', error);
          this.isLoadingRequests = false;
        }
      });
  }

  loadUsers(): void {
    this.isLoadingUsers = true;
    const headers = this.authService.getAuthHeaders();
    this.http.get<{users: User[]}>(`${this.apiUrl}/auth/users`, { headers })
      .subscribe({
        next: (response) => {
          this.users = response.users;
          this.isLoadingUsers = false;
        },
        error: (error) => {
          console.error('Error loading users:', error);
          this.isLoadingUsers = false;
        }
      });
  }

  approveRequest(requestId: string): void {
    this.isProcessing = true;
    const headers = this.authService.getAuthHeaders();
    this.http.post(`${this.apiUrl}/auth/requests/${requestId}/approve`, {}, { headers })
      .subscribe({
        next: () => {
          this.loadRequests();
          this.loadUsers();
          this.isProcessing = false;
        },
        error: (error) => {
          console.error('Error approving request:', error);
          this.isProcessing = false;
        }
      });
  }

  showRejectModal(request: PermissionRequest): void {
    this.currentRejectRequestId = request.id;
    this.rejectReason = '';
    this.showRejectReasonModal = true;
  }

  confirmReject(): void {
    if (!this.currentRejectRequestId) return;
    
    this.isProcessing = true;
    const headers = this.authService.getAuthHeaders();
    this.http.post(
      `${this.apiUrl}/auth/requests/${this.currentRejectRequestId}/reject`,
      { reason: this.rejectReason || undefined },
      { headers }
    ).subscribe({
      next: () => {
        this.loadRequests();
        this.cancelReject();
        this.isProcessing = false;
      },
      error: (error) => {
        console.error('Error rejecting request:', error);
        this.isProcessing = false;
      }
    });
  }

  cancelReject(): void {
    this.showRejectReasonModal = false;
    this.currentRejectRequestId = null;
    this.rejectReason = '';
  }

  deleteRequest(requestId: string): void {
    if (!confirm('Are you sure you want to delete this request?')) return;
    
    this.isProcessing = true;
    const headers = this.authService.getAuthHeaders();
    this.http.delete(`${this.apiUrl}/auth/requests/${requestId}`, { headers })
      .subscribe({
        next: () => {
          this.loadRequests();
          this.isProcessing = false;
        },
        error: (error) => {
          console.error('Error deleting request:', error);
          this.isProcessing = false;
        }
      });
  }

  createUser(): void {
    if (!this.newUserEmail || !this.newUserPassword) return;
    
    this.isProcessing = true;
    const headers = this.authService.getAuthHeaders();
    this.http.post(
      `${this.apiUrl}/auth/users`,
      { email: this.newUserEmail, password: this.newUserPassword },
      { headers }
    ).subscribe({
      next: () => {
        this.loadUsers();
        this.newUserEmail = '';
        this.newUserPassword = '';
        this.isProcessing = false;
      },
      error: (error) => {
        console.error('Error creating user:', error);
        alert(error.error?.detail || 'Failed to create user');
        this.isProcessing = false;
      }
    });
  }

  deleteUser(email: string): void {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) return;
    
    this.isProcessing = true;
    const headers = this.authService.getAuthHeaders();
    this.http.delete(`${this.apiUrl}/auth/users/${encodeURIComponent(email)}`, { headers })
      .subscribe({
        next: () => {
          this.loadUsers();
          this.isProcessing = false;
        },
        error: (error) => {
          console.error('Error deleting user:', error);
          this.isProcessing = false;
        }
      });
  }
}
