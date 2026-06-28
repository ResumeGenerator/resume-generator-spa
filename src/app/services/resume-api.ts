import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

declare global {
  interface Window {
    __RESUME_GENERATOR_CONFIG__?: {
      parserApiUrl?: string;
      templateApiUrl?: string;
      authApiUrl?: string;
      authRedirectUri?: string;
    };
  }
}

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
  data?: unknown;
}

export interface ResumePreviewResponse {
  resumeId: string;
  templates: ResumePreviewTemplate[];
  templateId?: string;
  html?: string;
  data?: unknown;
}

export interface RenderedResumeSaveRequest {
  template: string;
  format: 'html' | 'pdf' | 'word' | string;
  data: Record<string, unknown>;
  font?: string;
  color?: string;
  withPhoto?: boolean;
  avatar?: string;
  contactsTitle?: string;
  detailsTitle?: string;
}

export interface RenderedResumeSaveResponse {
  id: string;
  createdAt?: string;
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
  private readonly parserApiUrl = this.resolveBaseUrl(window.__RESUME_GENERATOR_CONFIG__?.parserApiUrl, 'http://localhost:8000');
  private readonly templateApiUrl = this.resolveBaseUrl(
    window.__RESUME_GENERATOR_CONFIG__?.templateApiUrl,
    'http://localhost:8080',
  );
  private readonly parserResumesUrl = `${this.parserApiUrl}/api/resumes`;
  private readonly templateResumesUrl = `${this.templateApiUrl}/api/Resumes`;
  private readonly parseResumeUrl = `${this.parserApiUrl}/api/resumes/parse`;
  private readonly previewResumeUrl = `${this.templateApiUrl}/api/Resumes/preview`;
  private readonly pdfResumeUrl = `${this.templateApiUrl}/api/Resumes/pdf`;
  private readonly wordResumeUrl = `${this.templateApiUrl}/api/Resumes/word`;

  constructor(private readonly http: HttpClient) {}

  getSavedResumes(limit = 100, skip = 0): Observable<SavedResumesResponse> {
    return this.getTemplateSavedResumes(limit, skip);
  }

  getTemplateSavedResumes(limit = 100, skip = 0): Observable<SavedResumesResponse> {
    return this.http
      .get<unknown>(this.templateResumesUrl, {
        params: {
          limit,
          skip,
        },
      })
      .pipe(map((response) => this.normalizeSavedResumesResponse(response, limit, skip)));
  }

  getResume(resumeId: string): Observable<ResumeDocumentResponse> {
    return this.http.get<ResumeDocumentResponse>(`${this.parserResumesUrl}/${resumeId}`);
  }

  getTemplateResume(resumeId: string): Observable<ResumeDocumentResponse> {
    return this.http
      .get<unknown>(`${this.templateResumesUrl}/${resumeId}`)
      .pipe(map((response) => this.normalizeResumeDocument(response, resumeId)));
  }

  saveEditedResume(resumeId: string, request: ResumeEditRequest): Observable<ResumeDocumentResponse> {
    return this.http.post<ResumeDocumentResponse>(`${this.parserResumesUrl}/${resumeId}/edits`, request);
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
    return this.http
      .post<ResumePreviewResponse>(this.previewResumeUrl, request)
      .pipe(map((response) => this.normalizePreviewResponse(response, request)));
  }

  saveRenderedResume(resumeId: string, request: RenderedResumeSaveRequest): Observable<RenderedResumeSaveResponse> {
    return this.http.post<RenderedResumeSaveResponse>(`${this.templateResumesUrl}/${resumeId}/templates`, request);
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

  private resolveBaseUrl(value: string | undefined, fallback: string): string {
    const resolved = value?.trim() || fallback;
    const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(resolved) ? resolved : `https://${resolved}`;
    return withProtocol.replace(/\/+$/, '');
  }

  private normalizePreviewResponse(
    response: ResumePreviewResponse,
    request: ResumePreviewRequest,
  ): ResumePreviewResponse {
    if (response.templates?.length) {
      return response;
    }

    const templateId = response.templateId || request.templateId || request.templateIds[0] || 'resume-template';
    const templates = response.html
      ? [
          {
            templateId,
            html: response.html,
            data: response.data,
          },
        ]
      : [];

    return {
      ...response,
      resumeId: response.resumeId || request.resumeId,
      templateId,
      templates,
    };
  }

  private normalizeSavedResumesResponse(value: unknown, limit: number, skip: number): SavedResumesResponse {
    const record = this.asRecord(value);
    const dataRecord = this.asRecord(record['data']);
    const itemsValue = Array.isArray(value)
      ? value
      : Array.isArray(record['items'])
        ? record['items']
        : Array.isArray(record['resumes'])
          ? record['resumes']
          : Array.isArray(record['data'])
            ? record['data']
            : Array.isArray(dataRecord['items'])
              ? dataRecord['items']
              : Array.isArray(dataRecord['resumes'])
                ? dataRecord['resumes']
                : Object.keys(record).length
                  ? [record]
                  : [];
    const items = itemsValue
      .map((item) => this.normalizeSavedResume(item))
      .filter((item): item is SavedResume => item !== null);

    return {
      items,
      total: this.asNumber(record['total']) ?? this.asNumber(dataRecord['total']) ?? items.length,
      limit: this.asNumber(record['limit']) ?? this.asNumber(dataRecord['limit']) ?? limit,
      skip: this.asNumber(record['skip']) ?? this.asNumber(dataRecord['skip']) ?? skip,
    };
  }

  private normalizeSavedResume(value: unknown): SavedResume | null {
    const record = this.unwrapDataDocument(value);
    const profile = this.asRecord(record['profile']);
    const renderedData = this.asRecord(profile['data']);
    const candidateProfile = this.asRecord(profile['candidateProfile']);
    const metadata = this.asRecord(record['metadata']);
    const id = this.resolveDocumentId(record);

    if (!id) {
      return null;
    }

    const candidateName = this.asString(renderedData['name']) || this.asString(candidateProfile['fullName']);
    const currentTitle = this.asString(renderedData['title']) || this.asString(candidateProfile['currentTitle']);

    return {
      id,
      filename: this.asString(metadata['filename']) || `${candidateName || currentTitle || id}.html`,
      candidateName,
      candidateEmail: this.asString(renderedData['email']) || this.asString(candidateProfile['email']),
      currentTitle,
      createdAt: this.asDateString(record['createdAt']),
      updatedAt: this.asDateString(record['updatedAt']),
    };
  }

  private normalizeResumeDocument(value: unknown, fallbackId: string): ResumeDocumentResponse {
    const record = this.unwrapDataDocument(value);
    const profile = this.asRecord(record['profile']);

    return {
      id: this.resolveDocumentId(record) || fallbackId,
      profile: (Object.keys(profile).length ? profile : { data: record }) as ResumeProfile,
      metadata: this.asRecord(record['metadata']),
      source: this.asRecord(record['source']),
      createdAt: this.asDateString(record['createdAt']),
      updatedAt: this.asDateString(record['updatedAt']),
    };
  }

  private unwrapDataDocument(value: unknown): Record<string, unknown> {
    const record = this.asRecord(value);
    const data = this.asRecord(record['data']);

    if (
      Object.keys(data).length &&
      (data['profile'] !== undefined ||
        data['resumeId'] !== undefined ||
        data['_id'] !== undefined ||
        data['sections'] !== undefined ||
        data['name'] !== undefined)
    ) {
      return data;
    }

    return record;
  }

  private resolveDocumentId(record: Record<string, unknown>): string {
    const mongoId = this.asRecord(record['_id']);

    return (
      this.asString(record['id']) ||
      this.asString(record['resumeId']) ||
      this.asString(record['templateResumeId']) ||
      this.asString(mongoId['$oid'])
    );
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private asNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private asDateString(value: unknown): string {
    const record = this.asRecord(value);
    return this.asString(value) || this.asString(record['$date']);
  }
}
