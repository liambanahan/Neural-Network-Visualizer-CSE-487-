import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GalleryService } from '../services/gallery.service';
import { GalleryItem } from '../models/gallery.model';
import { ImageUrlPipe } from '../pipes/image-url.pipe';
import { WeightPresetService } from '../services/weight-preset.service';
import { AuthService } from '../services/auth.service';
import { AuthModalComponent } from '../components/auth-modal/auth-modal.component';

@Component({
  selector: 'app-gallery-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageUrlPipe, AuthModalComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-b from-purple-50 to-purple-100 py-10 px-4">
      <div class="container mx-auto max-w-6xl">
        <header class="text-center mb-10">
          <h1 class="text-4xl font-bold text-purple-900 mb-2">Previous Generations</h1>
          <p class="text-lg text-purple-700">Browse through your style transfer history</p>
        </header>

        <div class="bg-white rounded-lg shadow-md p-4 mb-6">
          <div class="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div class="w-full sm:w-auto">
              <label for="sortBy" class="block text-sm font-medium text-gray-700 mb-1">Sort by</label>
              <select 
                id="sortBy" 
                [(ngModel)]="sortOption" 
                (change)="applySorting()"
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="lossAsc">Total Loss (Low to High)</option>
                <option value="lossDesc">Total Loss (High to Low)</option>
                <option value="processingTime">Processing Time</option>
                <option value="steps">Number of Steps</option>
              </select>
            </div>
            
            <div class="w-full sm:w-auto">
              <label class="block text-sm font-medium text-gray-700 mb-1">Filter by preset</label>
              <div class="flex flex-wrap gap-2">
                <button 
                  (click)="filterByPreset('all')" 
                  [class.bg-purple-600]="activePresetFilter === 'all'"
                  [class.bg-gray-200]="activePresetFilter !== 'all'"
                  class="px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
                  [class.text-white]="activePresetFilter === 'all'"
                  [class.text-gray-700]="activePresetFilter !== 'all'"
                >
                  All
                </button>
                <button 
                  *ngFor="let preset of presets"
                  (click)="filterByPreset(preset.label)" 
                  [class.bg-purple-600]="activePresetFilter === preset.label"
                  [class.bg-gray-200]="activePresetFilter !== preset.label"
                  class="px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
                  [class.text-white]="activePresetFilter === preset.label"
                  [class.text-gray-700]="activePresetFilter !== preset.label"
                >
                  {{ preset.label }}
                </button>
              </div>
            </div>
            
            <div class="w-full sm:w-auto">
              <button
                (click)="clearFilters()"
                class="bg-gray-100 hover:bg-gray-200 text-gray-800 py-1 px-4 rounded transition-colors duration-200 text-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div *ngFor="let item of filteredItems" 
               class="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
            <div class="relative aspect-square">
              <img [src]="item.resultImageUrl | imageUrl" 
                   [alt]="'Generated image from ' + (item.timestamp | date)"
                   class="w-full h-full object-cover">
              
              <div class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-60 transition-opacity duration-300 flex items-center justify-center opacity-0 hover:opacity-100">
                <div class="text-white text-center p-4">
                  <p class="font-semibold mb-2">{{ item.timestamp | date:'medium' }}</p>
                  <p class="text-sm">Total Loss: {{ calculateTotalLoss(item) }}</p>
                  <p class="text-sm">Style Loss: {{ formatValue(item.styleLoss) }}</p>
                  <p class="text-sm">Content Loss: {{ formatValue(item.contentLoss) }}</p>
                  <p class="text-sm">Time: {{ formatValue(item.processingTime) }}s</p>
                </div>
              </div>
            </div>

            <div class="p-4 border-t border-gray-200">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <p class="text-sm text-gray-600 mb-1">Content Image</p>
                  <img [src]="item.contentImageUrl | imageUrl" 
                       alt="Content image"
                       class="w-full h-24 object-cover rounded">
                </div>
                <div>
                  <p class="text-sm text-gray-600 mb-1">Style Image</p>
                  <img [src]="item.styleImageUrl | imageUrl" 
                       alt="Style image"
                       class="w-full h-24 object-cover rounded">
                </div>
              </div>

              <div class="mt-4 text-sm text-gray-600">
                <p class="font-medium">{{ getBalanceLabel(item.parameters.styleWeight, item.parameters.contentWeight) }}</p>
                <p>Steps: {{ item.parameters.numSteps }}</p>
              </div>

              <button (click)="deleteItem(item.id)"
                      class="mt-4 w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition-colors duration-200">
                Delete
              </button>
            </div>
          </div>
        </div>

        <div *ngIf="filteredItems.length === 0" 
             class="text-center py-20 bg-white rounded-lg shadow-md">
          <p class="text-xl text-gray-600">
            {{ allGalleryItems.length === 0 ? 'No generations yet' : 'No items match your current filters' }}
          </p>
          <p class="text-gray-500 mt-2">
            {{ allGalleryItems.length === 0 ? 'Start creating some amazing style transfers!' : 'Try adjusting your filters' }}
          </p>
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
export class GalleryPageComponent implements OnInit {
  allGalleryItems: GalleryItem[] = [];
  filteredItems: GalleryItem[] = [];
  sortOption: string = 'newest';
  activePresetFilter: string = 'all';
  presets: { label: string; styleWeight: number; contentWeight: number }[] = [];
  showAuthModal = false;

  constructor(
    private galleryService: GalleryService,
    private weightPresetService: WeightPresetService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadGalleryItems();
    this.loadPresets();
  }

  loadPresets(): void {
    this.presets = this.weightPresetService.getAllPresets();
  }

  loadGalleryItems(): void {
    this.galleryService.getGalleryItems().subscribe({
      next: (items) => {
        this.allGalleryItems = items;
        console.log('Gallery items loaded:', this.allGalleryItems);
        this.applySortingAndFilters();
      },
      error: (error) => {
        console.error('Error loading gallery items:', error);
      }
    });
  }

  deleteItem(id: string): void {
    // Check authentication first
    if (!this.authService.isAuthenticated()) {
      this.showAuthModal = true;
      return;
    }
    
    if (confirm('Are you sure you want to delete this generation?')) {
      this.galleryService.deleteGalleryItem(id).subscribe({
        next: () => {
          this.allGalleryItems = this.allGalleryItems.filter(item => item.id !== id);
          this.applySortingAndFilters();
        },
        error: (error) => {
          console.error('Error deleting gallery item:', error);
          if (error.message?.includes('Authentication required')) {
            this.showAuthModal = true;
          } else {
            alert('Failed to delete item: ' + (error.message || 'Unknown error'));
          }
        }
      });
    }
  }

  onLoginSuccess(): void {
    // User logged in successfully, modal will close automatically
  }

  getBalanceLabel(styleWeight: number, contentWeight: number): string {
    return this.weightPresetService.getPresetLabel(styleWeight, contentWeight);
  }

  calculateTotalLoss(item: GalleryItem): string {
    if (!item || typeof item.styleLoss !== 'number' || typeof item.contentLoss !== 'number') {
      return '--';
    }
    
    // Calculate the actual total loss as the sum of style and content loss
    const totalLoss = item.styleLoss + item.contentLoss;
    return this.formatValue(totalLoss);
  }

  formatValue(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '--';
    }
    if (typeof value !== 'number') {
      return String(value);
    }
    if (!Number.isFinite(value)) {
      if (Number.isNaN(value)) {
        return 'N/A';
      }
      return value > 0 ? '∞' : '-∞';
    }
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toFixed(2);
  }

  applySorting(): void {
    this.applySortingAndFilters();
  }

  filterByPreset(preset: string): void {
    this.activePresetFilter = preset;
    this.applySortingAndFilters();
  }

  clearFilters(): void {
    this.sortOption = 'newest';
    this.activePresetFilter = 'all';
    this.applySortingAndFilters();
  }

  applySortingAndFilters(): void {
    // First apply filtering
    if (this.activePresetFilter === 'all') {
      this.filteredItems = [...this.allGalleryItems];
    } else {
      this.filteredItems = this.allGalleryItems.filter(item => {
        const itemPresetLabel = this.getBalanceLabel(
          item.parameters.styleWeight, 
          item.parameters.contentWeight
        );
        return itemPresetLabel === this.activePresetFilter;
      });
    }

    // Then apply sorting
    switch (this.sortOption) {
      case 'newest':
        this.filteredItems.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        break;
      case 'oldest':
        this.filteredItems.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        break;
      case 'lossAsc':
        this.filteredItems.sort((a, b) => {
          const totalLossA = a.styleLoss + a.contentLoss;
          const totalLossB = b.styleLoss + b.contentLoss;
          return totalLossA - totalLossB;
        });
        break;
      case 'lossDesc':
        this.filteredItems.sort((a, b) => {
          const totalLossA = a.styleLoss + a.contentLoss;
          const totalLossB = b.styleLoss + b.contentLoss;
          return totalLossB - totalLossA;
        });
        break;
      case 'processingTime':
        this.filteredItems.sort((a, b) => b.processingTime - a.processingTime);
        break;
      case 'steps':
        this.filteredItems.sort((a, b) => 
          b.parameters.numSteps - a.parameters.numSteps
        );
        break;
      default:
        this.filteredItems.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }
  }
} 