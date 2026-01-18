import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, interval } from 'rxjs';
import { catchError, switchMap, takeWhile, map } from 'rxjs/operators';
import { StyleTransferParams, StyleTransferJob, StyleLayerInfo } from '../models/style-transfer.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StyleTransferService {
  // API URL configuration
  private apiUrl = environment.apiUrl;
  
  // Default style layers and descriptions
  private styleLayers: StyleLayerInfo[] = [
    { name: 'conv_1', description: 'Basic shapes and edges', defaultWeight: 1.0 },
    { name: 'conv_2', description: 'Textures and patterns', defaultWeight: 1.0 },
    { name: 'conv_3', description: 'Complex textures', defaultWeight: 1.0 },
    { name: 'conv_4', description: 'Patterns and parts', defaultWeight: 1.0 },
    { name: 'conv_5', description: 'Objects and compositions', defaultWeight: 1.0 }
  ];

  constructor(private http: HttpClient) { }

  /**
   * Gets available style layers and their descriptionss
   */
  getStyleLayers(): StyleLayerInfo[] {
    return this.styleLayers;
  }

  /**
   * Initiates a style transfer job
   */
  transferStyle(
    contentImage: File,
    styleImage: File,
    params: StyleTransferParams
  ): Observable<StyleTransferJob> {
    const formData = new FormData();
    formData.append('content_image', contentImage);
    formData.append('style_image', styleImage);
    formData.append('style_weight', params.styleWeight.toString());
    formData.append('content_weight', params.contentWeight.toString());
    formData.append('num_steps', params.numSteps.toString());
    formData.append('layer_weights', JSON.stringify(params.layerWeights || {}));

    return this.http.post<{job_id: string, status: string}>(
      `${this.apiUrl}/transfer`,
      formData
    ).pipe(
      map(response => ({
        jobId: response.job_id,
        status: response.status as 'pending'
      })),
      catchError(error => {
        console.error('Error in style transfer request:', error);
        if (error.status === 401) {
          return throwError(() => new Error('Authentication required. Please sign in.'));
        }
        return throwError(() => new Error('Failed to start style transfer: ' + (error.error?.detail || error.message)));
      })
    );
  }

  /**
   * Polls the job status until completion or failure
   */
  pollJobStatus(jobId: string, pollInterval = 5000): Observable<StyleTransferJob> {
    return interval(pollInterval).pipe(
      switchMap(() => this.getJobStatus(jobId)),
      takeWhile(job => job.status === 'pending' || job.status === 'processing', true)
    );
  }

  /**
   * Gets the current status of a job
   */
  getJobStatus(jobId: string): Observable<StyleTransferJob> {
    return this.http.get<any>(`${this.apiUrl}/transfer/${jobId}`).pipe(
      map(response => ({
        jobId: response.job_id,
        status: response.status,
        progress: response.progress,
        styleLoss: response.style_loss,
        contentLoss: response.content_loss,
        resultUrl: response.result_url,
        error: response.error
      })),
      catchError(error => {
        console.error('Error getting job status:', error);
        return throwError(() => new Error('Failed to get job status: ' + error.message));
      })
    );
  }

  /**
   * Gets the full URL for a result
   */
  getResultUrl(relativeUrl: string): string {
    // Handle both relative and full URLs
    if (relativeUrl.startsWith('http')) {
      return relativeUrl;
    }
    // Handle relative URLs
    const baseUrl = this.apiUrl.substring(0, this.apiUrl.lastIndexOf('/api'));
    return `${baseUrl}${relativeUrl}`;
  }

  /**
   * Health check for API
   */
  checkHealth(): Observable<{status: string}> {
    return this.http.get<{status: string}>(`${this.apiUrl}/health`);
  }
} 