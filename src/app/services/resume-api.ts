import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';

import { AuthService } from './auth.service';
import { RESUME_REPHRASE_PROMPT } from './resume-ai-prompts';

declare global {
  interface Window {
    __RESUME_GENERATOR_CONFIG__?: {
      apiGatewayUrl?: string;
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
  resumeId?: string;
  template: string;
  templateId?: string;
  format: 'html' | 'pdf' | 'word' | string;
  data: Record<string, unknown>;
  profile?: ResumeProfile;
  metadata?: Record<string, unknown>;
  source?: Record<string, unknown>;
  font?: string;
  color?: string;
  withPhoto?: boolean;
  avatar?: string;
  contactsTitle?: string;
  detailsTitle?: string;
}

export interface RenderedResumeSaveResponse {
  id?: string;
  resumeId?: string;
  templateResumeId?: string;
  templateId?: string;
  html?: string;
  data?: unknown;
  profile?: ResumeProfile;
  metadata?: Record<string, unknown>;
  source?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
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

export interface ResumeRephraseRequest {
  text: string;
  prompt: string;
}

@Injectable({
  providedIn: 'root',
})
export class ResumeApi {
  private readonly runtimeConfig = window.__RESUME_GENERATOR_CONFIG__;
  private readonly apiGatewayUrl = this.resolveOptionalBaseUrl(this.runtimeConfig?.apiGatewayUrl);
  private readonly parserApiUrl =
    this.apiGatewayUrl ?? this.resolveBaseUrl(this.runtimeConfig?.parserApiUrl, 'http://localhost:8000');
  private readonly templateApiUrl = this.resolveBaseUrl(
    this.apiGatewayUrl ?? this.runtimeConfig?.templateApiUrl,
    'http://localhost:8080',
  );
  private readonly parserResumesUrl = `${this.parserApiUrl}/api/resumes`;
  private readonly templateResumesUrl = `${this.templateApiUrl}/api/resumes`;
  private readonly parseResumeUrl = `${this.parserApiUrl}/api/resumes/parse`;
  private readonly rephraseResumeUrl = `${this.parserApiUrl}/api/resumes/rephrase`;
  private readonly pdfResumeUrl = `${this.templateResumesUrl}/pdf`;
  private readonly wordResumeUrl = `${this.templateResumesUrl}/word`;

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
  ) {}

  getSavedResumes(limit = 100, skip = 0): Observable<SavedResumesResponse> {
    return this.getTemplateSavedResumes(limit, skip);
  }

  getTemplateSavedResumes(limit = 100, skip = 0): Observable<SavedResumesResponse> {
    const userId = this.resolveCurrentUserId();

    return this.http
      .get<unknown>(this.templateResumesUrl, {
        params: {
          userId,
          limit,
          skip,
        },
      })
      .pipe(map((response) => this.normalizeSavedResumesResponse(response, limit, skip)));
  }

  getResume(resumeId: string): Observable<ResumeDocumentResponse> {
    const userId = this.resolveCurrentUserId();

    return this.http
      .get<unknown>(`${this.parserResumesUrl}/${encodeURIComponent(resumeId)}`, {
        params: {
          userId,
        },
      })
      .pipe(map((response) => this.normalizeResumeDocument(response, resumeId)));
  }

  getTemplateResume(resumeId: string): Observable<ResumeDocumentResponse> {
    return this.getResume(resumeId);
  }

  saveEditedResume(resumeId: string, request: ResumeEditRequest): Observable<ResumeDocumentResponse> {
    const userId = this.resolveCurrentUserId();

    return this.http
      .post<unknown>(`${this.parserResumesUrl}/${encodeURIComponent(resumeId)}/edits`, request.profile, {
        params: {
          userId,
        },
      })
      .pipe(map((response) => this.normalizeResumeDocument(response, resumeId)));
  }

  uploadResumeImage(resumeId: string, file: File): Observable<ResumeDocumentResponse> {
    const userId = this.resolveCurrentUserId();
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<unknown>(`${this.parserResumesUrl}/${encodeURIComponent(resumeId)}/image`, formData, {
        params: {
          userId,
        },
      })
      .pipe(map((response) => this.normalizeResumeDocument(response, resumeId)));
  }

  parseResume(file: File, jobDescription?: string): Observable<ParsedResumeResponse> {
    const userId = this.resolveCurrentUserId();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);

    if (jobDescription?.trim()) {
      formData.append('jobDescription', jobDescription.trim());
    }

    return this.http.post<ParsedResumeResponse>(this.parseResumeUrl, formData);
  }

  rephraseResumeText(text: string): Observable<string> {
    const request: ResumeRephraseRequest = {
      text,
      prompt: RESUME_REPHRASE_PROMPT,
    };

    return this.http
      .post<unknown>(this.rephraseResumeUrl, request)
      .pipe(map((response) => this.normalizeRephraseResponse(response)));
  }

  previewResume(request: ResumePreviewRequest): Observable<ResumePreviewResponse> {
    const templateIds = this.resolvePreviewTemplateIds(request);
    const userId = this.resolveCurrentUserId();

    if (templateIds.length === 0) {
      return of({
        resumeId: request.resumeId,
        templates: [],
      });
    }

    return forkJoin(
      templateIds.map((templateId) => this.getResumeTemplateHtml(request.resumeId, userId, templateId)),
    ).pipe(
      map((templates) => ({
        resumeId: request.resumeId,
        templateId: templates[0]?.templateId,
        html: templates[0]?.html,
        data: templates[0]?.data,
        templates,
      })),
    );
  }

  saveRenderedResume(resumeId: string, request: RenderedResumeSaveRequest): Observable<RenderedResumeSaveResponse> {
    const userId = this.resolveCurrentUserId();

    return this.http.post<RenderedResumeSaveResponse>(
      `${this.templateResumesUrl}/edited/${encodeURIComponent(resumeId)}`,
      request,
      {
        params: {
          userId,
        },
      },
    );
  }

  downloadResumePdf(resumeId: string, templateId: string): Observable<Blob> {
    const userId = this.resolveCurrentUserId();

    return this.http.post(
      this.pdfResumeUrl,
      {
        resumeId,
        userId,
        templateId,
      },
      {
        responseType: 'blob',
      },
    );
  }

  downloadResumeWord(resumeId: string, templateId: string): Observable<Blob> {
    const userId = this.resolveCurrentUserId();

    return this.http.post(
      this.wordResumeUrl,
      {
        resumeId,
        userId,
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

  private resolveOptionalBaseUrl(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? this.resolveBaseUrl(trimmed, trimmed) : undefined;
  }

  private resolveCurrentUserId(): string {
    return this.authService.getCurrentUserId();
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

  private getResumeTemplateHtml(
    resumeId: string,
    userId: string,
    templateId: string,
  ): Observable<ResumePreviewTemplate> {
    return this.http
      .get(`${this.templateResumesUrl}/${encodeURIComponent(resumeId)}/html`, {
        params: {
          userId,
          templateId,
        },
        responseType: 'text',
      })
      .pipe(
        map((response) => this.normalizeTemplateHtmlResponse(response, templateId)),
      );
  }

  private resolvePreviewTemplateIds(request: ResumePreviewRequest): string[] {
    const seen = new Set<string>();
    const templateIds = [request.templateId, ...request.templateIds]
      .map((templateId) => templateId?.trim() || '')
      .filter(Boolean);

    return templateIds.filter((templateId) => {
      if (seen.has(templateId)) {
        return false;
      }

      seen.add(templateId);
      return true;
    });
  }

  private normalizeTemplateHtmlResponse(response: string, fallbackTemplateId: string): ResumePreviewTemplate {
    const parsedResponse = this.parseJsonResponse(response);

    if (typeof parsedResponse === 'string') {
      return {
        templateId: fallbackTemplateId,
        html: parsedResponse,
      };
    }

    const record = this.asRecord(parsedResponse);
    const dataRecord = this.asRecord(record['data']);
    const html = this.resolveHtml(record) || this.resolveHtml(dataRecord);

    if (!html) {
      return {
        templateId: fallbackTemplateId,
        html: response,
      };
    }

    return {
      templateId: this.asString(record['templateId']) || this.asString(dataRecord['templateId']) || fallbackTemplateId,
      html,
      data: dataRecord['data'] ?? record['data'],
    };
  }

  private resolveHtml(record: Record<string, unknown>): string {
    return (
      this.asString(record['html']) ||
      this.asString(record['renderedHtml']) ||
      this.asString(record['previewHtml']) ||
      this.asString(record['templateHtml']) ||
      this.asString(record['documentHtml']) ||
      this.asString(record['htmlContent']) ||
      this.asString(record['content'])
    );
  }

  private parseJsonResponse(response: string): unknown {
    try {
      return JSON.parse(response);
    } catch {
      return response;
    }
  }

  private normalizeRephraseResponse(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    const record = this.asRecord(value);
    const dataRecord = this.asRecord(record['data']);

    return (
      this.asString(record['text']) ||
      this.asString(record['rephrasedText']) ||
      this.asString(record['improvedText']) ||
      this.asString(record['content']) ||
      this.asString(record['result']) ||
      this.asString(dataRecord['text']) ||
      this.asString(dataRecord['rephrasedText']) ||
      this.asString(dataRecord['improvedText']) ||
      this.asString(dataRecord['content']) ||
      this.asString(dataRecord['result'])
    );
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

    const candidateName =
      this.asString(record['candidateName']) ||
      this.asString(record['name']) ||
      this.asString(renderedData['name']) ||
      this.asString(candidateProfile['fullName']);
    const currentTitle =
      this.asString(record['currentTitle']) ||
      this.asString(record['title']) ||
      this.asString(renderedData['title']) ||
      this.asString(candidateProfile['currentTitle']);

    return {
      id,
      filename:
        this.asString(record['filename']) ||
        this.asString(record['fileName']) ||
        this.asString(metadata['filename']) ||
        this.asString(metadata['fileName']) ||
        `${candidateName || currentTitle || id}.html`,
      candidateName,
      candidateEmail:
        this.asString(record['candidateEmail']) ||
        this.asString(record['email']) ||
        this.asString(renderedData['email']) ||
        this.asString(candidateProfile['email']),
      currentTitle,
      createdAt: this.asDateString(record['createdAt']) || this.asDateString(metadata['createdAt']),
      updatedAt: this.asDateString(record['updatedAt']) || this.asDateString(metadata['updatedAt']),
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
        data['name'] !== undefined ||
        data['avatar'] !== undefined)
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
