import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface ParsedResumeResponse {
  id?: string;
  resumeId?: string;
  fileName?: string;
  message?: string;
  [key: string]: unknown;
}

export interface ResumePreviewRequest {
  resumeId: string;
  templateId?: string;
  templateIds: string[];
}

export interface ResumePreviewTemplate {
  templateId: string;
  html: string;
}

export interface ResumePreviewResponse {
  resumeId: string;
  templates: ResumePreviewTemplate[];
}

export interface SavedResume {
  id: string;
  filename: string;
  candidateName?: string;
  candidateEmail?: string;
  currentTitle?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SavedResumesResponse {
  items: SavedResume[];
  total?: number;
  limit?: number;
  skip?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ResumeApi {
  private readonly resumesUrl = 'http://localhost:8000/api/resumes';
  private readonly parseResumeUrl = 'http://localhost:8000/api/resumes/parse';
  private readonly previewResumeUrl = 'http://localhost:8080/api/Resumes/preview';

  constructor(private readonly http: HttpClient) {}

  getSavedResumes(limit = 100, skip = 0): Observable<SavedResumesResponse> {
    return this.http.get<SavedResumesResponse>(this.resumesUrl, {
      params: {
        limit,
        skip,
      },
    });
  }

  parseResume(file: File, jobDescription?: string): Observable<ParsedResumeResponse> {
    const formData = new FormData();
    formData.append('file', file);

    if (jobDescription?.trim()) {
      formData.append('jobDescription', jobDescription.trim());
    }

    return this.http.post<ParsedResumeResponse>(this.parseResumeUrl, formData);
  }

  previewResume(request: ResumePreviewRequest): Observable<ResumePreviewResponse> {
    return this.http.post<ResumePreviewResponse>(this.previewResumeUrl, request);
  }
}
