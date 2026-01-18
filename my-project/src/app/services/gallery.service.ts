import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { GalleryItem } from '../models/gallery.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GalleryService {
  private apiUrl = `${environment.apiUrl}/gallery`;
  private baseUrl = environment.apiUrl.substring(0, environment.apiUrl.lastIndexOf('/api'));

  constructor(private http: HttpClient) {}

  getGalleryItems(): Observable<GalleryItem[]> {
    return this.http.get<GalleryItem[]>(this.apiUrl).pipe(
      map(items => {
        if (!items || !Array.isArray(items)) {
          console.warn('Invalid gallery data received:', items);
          return [];
        }
        return items.map(item => this.mapGalleryItem(item));
      }),
      catchError(this.handleError)
    );
  }

  getGalleryItem(id: string): Observable<GalleryItem> {
    return this.http.get<GalleryItem>(`${this.apiUrl}/${id}`).pipe(
      map(item => this.mapGalleryItem(item)),
      catchError(this.handleError)
    );
  }

  deleteGalleryItem(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => {
        if (error.status === 401) {
          return throwError(() => new Error('Authentication required. Please sign in.'));
        }
        return this.handleError(error);
      })
    );
  }

  getFullUrl(relativeUrl: string): string {
    if (!relativeUrl) return '';
    
    // Handle both relative and absolute URLs
    if (relativeUrl.startsWith('http')) {
      return relativeUrl;
    }
    
    // Handle relative URLs
    const fullUrl = `${this.baseUrl}${relativeUrl}`;
    console.log(`Transformed URL: ${relativeUrl} → ${fullUrl}`);
    return fullUrl;
  }

  private mapGalleryItem(item: any): GalleryItem {
    if (!item) return {} as GalleryItem;
    
    // Ensure all required properties exist with defaults
    return {
      id: item.id || '',
      timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
      contentImageUrl: item.contentImageUrl || '',
      styleImageUrl: item.styleImageUrl || '',
      resultImageUrl: item.resultImageUrl || '',
      bestLoss: this.ensureNumber(item.bestLoss),
      styleLoss: this.ensureNumber(item.styleLoss),
      contentLoss: this.ensureNumber(item.contentLoss),
      processingTime: this.ensureNumber(item.processingTime),
      parameters: {
        styleWeight: this.ensureNumber(item.parameters?.styleWeight),
        contentWeight: this.ensureNumber(item.parameters?.contentWeight),
        numSteps: item.parameters?.numSteps || 300,
        layerWeights: item.parameters?.layerWeights || {}
      }
    };
  }

  private ensureNumber(value: any): number {
    if (value === null || value === undefined || isNaN(Number(value))) {
      return 0;
    }
    return Number(value);
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
} 