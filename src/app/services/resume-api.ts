import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface ParsedResumeResponse {
  id?: string;
  resumeId?: string;
  fileName?: string;
  message?: string;
  profile?: ResumeProfile;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CandidateProfile {
  fullName?: string;
  email?: string;
  currentTitle?: string;
  professionalHeadline?: string;
  [key: string]: unknown;
}

export interface ResumeProfile {
  candidateProfile?: CandidateProfile;
  [key: string]: unknown;
}

export interface ResumeDocumentResponse {
  id: string;
  profile: ResumeProfile;
  metadata: Record<string, unknown>;
  source: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeEditRequest {
  profile: ResumeProfile;
  metadata: Record<string, unknown>;
  source: Record<string, unknown>;
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
  private readonly pdfResumeUrl = 'http://localhost:8080/api/Resumes/pdf';
  private readonly wordResumeUrl = 'http://localhost:8080/api/Resumes/word';

  constructor(private readonly http: HttpClient) {}

  getSavedResumes(limit = 100, skip = 0): Observable<SavedResumesResponse> {
    return this.http.get<SavedResumesResponse>(this.resumesUrl, {
      params: {
        limit,
        skip,
      },
    });
  }

  getResume(resumeId: string): Observable<ResumeDocumentResponse> {
    return this.http.get<ResumeDocumentResponse>(`${this.resumesUrl}/${resumeId}`);
  }

  saveEditedResume(resumeId: string, request: ResumeEditRequest): Observable<ResumeDocumentResponse> {
    return this.http.post<ResumeDocumentResponse>(`${this.resumesUrl}/${resumeId}/edits`, request);
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

  downloadResumePdf(resumeId: string, templateId: string): Observable<Blob> {
    return this.http.post(
      this.pdfResumeUrl,
      {
        resumeId,
        templateId,
      },
      {
        responseType: 'blob',
      },
    );
  }

  downloadResumeWord(resumeId: string, templateId: string): Observable<Blob> {
    return this.http.post(
      this.wordResumeUrl,
      {
        resumeId,
        templateId,
      },
      {
        responseType: 'blob',
      },
    );
  }
}
