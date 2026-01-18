import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { ImageUploadComponent } from '../components/image-upload/image-upload.component';
import { StyleControlsComponent } from '../components/style-controls/style-controls.component';
import { ResultDisplayComponent } from '../components/result-display/result-display.component';
import { AuthModalComponent } from '../components/auth-modal/auth-modal.component';

import { ImageFile, StyleTransferParams, StyleTransferJob } from '../models/style-transfer.model';
import { StyleTransferService } from '../services/style-transfer.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-style-transfer-page',
  standalone: true,
  imports: [
    CommonModule,
    ImageUploadComponent,
    StyleControlsComponent,
    ResultDisplayComponent,
    AuthModalComponent
  ],
  template: `
    <div class="min-h-screen bg-gradient-to-b from-purple-50 to-purple-100 py-10 px-4">
      <div class="container mx-auto max-w-6xl">
        <header class="text-center mb-10">
          <h1 class="text-4xl font-bold text-purple-900 mb-2">Neural Style Transfer</h1>
          <p class="text-lg text-purple-700">Transform your photos with the style of famous artworks</p>
        </header>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <app-image-upload 
            label="Content Image" 
            [image]="contentImage" 
            (imageSelected)="onContentImageSelected($event)">
          </app-image-upload>
          
          <app-image-upload 
            label="Style Image" 
            [image]="styleImage" 
            (imageSelected)="onStyleImageSelected($event)">
          </app-image-upload>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <app-style-controls 
            [canApply]="canApplyStyle" 
            [processing]="isProcessing"
            (apply)="onApplyStyle($event)">
          </app-style-controls>
          
          <app-result-display 
            [job]="currentJob">
          </app-result-display>
        </div>
      </div>
      
      <app-auth-modal
        *ngIf="showAuthModal"
        (closeModal)="showAuthModal = false"
        (loginSuccess)="onLoginSuccess()">
      </app-auth-modal>
    </div>
  `,
  styles: []
})
export class StyleTransferPageComponent implements OnInit, OnDestroy {
  contentImage: ImageFile | null = null;
  styleImage: ImageFile | null = null;
  currentJob: StyleTransferJob | null = null;
  isProcessing: boolean = false;
  showAuthModal: boolean = false;
  
  private subscription = new Subscription();
  
  constructor(
    private styleTransferService: StyleTransferService,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    // Could check API health here
  }
  
  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
  
  get canApplyStyle(): boolean {
    return !!this.contentImage?.file && !!this.styleImage?.file && !this.isProcessing;
  }
  
  onContentImageSelected(image: ImageFile): void {
    this.contentImage = image;
  }
  
  onStyleImageSelected(image: ImageFile): void {
    this.styleImage = image;
  }
  
  onApplyStyle(params: StyleTransferParams): void {
    if (!this.contentImage?.file || !this.styleImage?.file) {
      return;
    }
    
    // Check authentication before proceeding
    if (!this.authService.isAuthenticated()) {
      this.showAuthModal = true;
      return;
    }
    
    this.isProcessing = true;
    
    // Start the style transfer job
    this.styleTransferService.transferStyle(
      this.contentImage.file,
      this.styleImage.file,
      params
    ).subscribe({
      next: (job) => {
        this.currentJob = job;
        
        // Start polling for status updates
        const statusSub = this.styleTransferService.pollJobStatus(job.jobId).subscribe({
          next: (updatedJob) => {
            this.currentJob = updatedJob;
            
            if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
              this.isProcessing = false;
            }
          },
          error: (error) => {
            console.error('Error polling job status:', error);
            this.isProcessing = false;
            this.currentJob = {
              ...this.currentJob!,
              status: 'failed',
              error: 'Failed to get job status updates'
            };
          }
        });
        
        this.subscription.add(statusSub);
      },
      error: (error) => {
        console.error('Error starting style transfer:', error);
        this.isProcessing = false;
        this.currentJob = {
          jobId: 'error',
          status: 'failed',
          error: 'Failed to start style transfer'
        };
      }
    });
  }

  onLoginSuccess(): void {
    // User logged in successfully, modal will close automatically
    // They can try again to apply style transfer
  }
} 