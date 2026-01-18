import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, LoginCredentials, PermissionRequest } from '../../services/auth.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" (click)="onBackdropClick($event)">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-800">Authentication Required</h2>
            <button (click)="close()" class="text-gray-500 hover:text-gray-700">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <!-- Tabs -->
          <div class="flex border-b mb-6">
            <button
              (click)="activeTab = 'login'"
              [class.border-b-2]="activeTab === 'login'"
              [class.border-purple-500]="activeTab === 'login'"
              [class.text-purple-600]="activeTab === 'login'"
              class="px-4 py-2 font-medium text-gray-700 hover:text-purple-600"
            >
              Sign In
            </button>
            <button
              (click)="activeTab = 'request'"
              [class.border-b-2]="activeTab === 'request'"
              [class.border-purple-500]="activeTab === 'request'"
              [class.text-purple-600]="activeTab === 'request'"
              class="px-4 py-2 font-medium text-gray-700 hover:text-purple-600"
            >
              Request Permission
            </button>
          </div>

          <!-- Login Tab -->
          <div *ngIf="activeTab === 'login'" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Email (optional for master password)</label>
              <input
                type="email"
                [(ngModel)]="loginCredentials.email"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                [(ngModel)]="loginCredentials.password"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter password"
              />
            </div>
            <div class="text-center text-sm text-gray-600">OR</div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Master Password</label>
              <input
                type="password"
                [(ngModel)]="loginCredentials.masterPassword"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter master password"
              />
            </div>
            <div *ngIf="loginError" class="text-red-600 text-sm">{{ loginError }}</div>
            <button
              (click)="onLogin()"
              [disabled]="isLoading"
              class="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isLoading ? 'Signing in...' : 'Sign In' }}
            </button>
          </div>

          <!-- Request Permission Tab -->
          <div *ngIf="activeTab === 'request'" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                [(ngModel)]="permissionRequest.name"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                [(ngModel)]="permissionRequest.email"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Reason for Request</label>
              <textarea
                [(ngModel)]="permissionRequest.reason"
                rows="4"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Please explain why you need access to this application..."
              ></textarea>
            </div>
            <div *ngIf="requestError" class="text-red-600 text-sm">{{ requestError }}</div>
            <div *ngIf="requestSuccess" class="text-green-600 text-sm">
              Request submitted successfully! You will receive an email when your request is reviewed.
            </div>
            <button
              (click)="onSubmitRequest()"
              [disabled]="isLoading || requestSuccess"
              class="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isLoading ? 'Submitting...' : 'Submit Request' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class AuthModalComponent implements OnInit {
  @Output() closeModal = new EventEmitter<void>();
  @Output() loginSuccess = new EventEmitter<void>();

  activeTab: 'login' | 'request' = 'login';
  loginCredentials: LoginCredentials = {
    email: '',
    password: '',
    masterPassword: ''
  };
  permissionRequest: PermissionRequest = {
    name: '',
    email: '',
    reason: ''
  };
  isLoading = false;
  loginError = '';
  requestError = '';
  requestSuccess = false;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {}

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('bg-black')) {
      this.close();
    }
  }

  close(): void {
    this.closeModal.emit();
  }

  onLogin(): void {
    this.loginError = '';
    this.isLoading = true;

    const credentials: LoginCredentials = {
      password: this.loginCredentials.password
    };

    if (this.loginCredentials.masterPassword) {
      credentials.masterPassword = this.loginCredentials.masterPassword;
    } else if (this.loginCredentials.email) {
      credentials.email = this.loginCredentials.email;
    } else {
      this.loginError = 'Please provide either email/password or master password';
      this.isLoading = false;
      return;
    }

    this.authService.login(credentials).subscribe({
      next: () => {
        this.isLoading = false;
        this.loginSuccess.emit();
        this.close();
      },
      error: (error) => {
        this.isLoading = false;
        this.loginError = error.message || 'Login failed';
      }
    });
  }

  onSubmitRequest(): void {
    this.requestError = '';
    this.requestSuccess = false;

    if (!this.permissionRequest.name || !this.permissionRequest.email || !this.permissionRequest.reason) {
      this.requestError = 'Please fill in all fields';
      return;
    }

    this.isLoading = true;
    this.authService.submitPermissionRequest(this.permissionRequest).subscribe({
      next: () => {
        this.isLoading = false;
        this.requestSuccess = true;
        // Reset form after success
        setTimeout(() => {
          this.permissionRequest = { name: '', email: '', reason: '' };
          this.requestSuccess = false;
        }, 3000);
      },
      error: (error) => {
        this.isLoading = false;
        this.requestError = error.message || 'Failed to submit request';
      }
    });
  }
}
