import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { ParsedResumeResponse, ResumeApi, ResumePreviewResponse, SavedResume } from '../services/resume-api';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';
type PreviewState = 'idle' | 'loading' | 'success' | 'error';
type SavedResumesState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-resume-upload',
  imports: [CommonModule, FormsModule],
  templateUrl: './resume-upload.html',
  styleUrl: './resume-upload.css',
})
export class ResumeUpload implements OnInit {
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly uploadState = signal<UploadState>('idle');
  protected readonly previewState = signal<PreviewState>('idle');
  protected readonly savedResumesState = signal<SavedResumesState>('idle');
  protected readonly parsedResume = signal<ParsedResumeResponse | null>(null);
  protected readonly previewResponse = signal<ResumePreviewResponse | null>(null);
  protected readonly savedResumes = signal<SavedResume[]>([]);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly previewErrorMessage = signal<string | null>(null);
  protected readonly savedResumesErrorMessage = signal<string | null>(null);
  protected readonly selectedSavedResumeId = signal<string | null>(null);
  protected readonly isPreviewModalOpen = signal(false);
  protected readonly activeTemplateIndex = signal(0);
  private readonly defaultTemplateIds = ['modern-minimal', 'professional-dark-blue'];
  protected jobDescription = '';
  protected resumeId = '';

  protected readonly fileMeta = computed(() => {
    const file = this.selectedFile();

    if (!file) {
      return null;
    }

    return {
      name: file.name,
      size: this.formatFileSize(file.size),
      type: file.type || this.resolveFileType(file.name),
    };
  });

  constructor(
    private readonly resumeApi: ResumeApi,
    private readonly sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.loadSavedResumes();
  }

  protected loadSavedResumes(): void {
    if (this.savedResumesState() === 'loading') {
      return;
    }

    this.savedResumesState.set('loading');
    this.savedResumesErrorMessage.set(null);

    this.resumeApi
      .getSavedResumes(100, 0)
      .pipe(finalize(() => this.savedResumesState.update((state) => (state === 'loading' ? 'idle' : state))))
      .subscribe({
        next: (response) => {
          this.savedResumes.set(response.items ?? []);
          this.savedResumesState.set('success');
        },
        error: (error) => {
          this.savedResumesErrorMessage.set(this.resolveErrorMessage(error, 'saved'));
          this.savedResumesState.set('error');
        },
      });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;

    this.selectedFile.set(file);
    this.parsedResume.set(null);
    this.previewResponse.set(null);
    this.errorMessage.set(null);
    this.previewErrorMessage.set(null);
    this.uploadState.set('idle');
    this.previewState.set('idle');
  }

  protected submitResume(): void {
    const file = this.selectedFile();

    if (!file || this.uploadState() === 'uploading') {
      return;
    }

    this.uploadState.set('uploading');
    this.errorMessage.set(null);
    this.previewErrorMessage.set(null);
    this.parsedResume.set(null);
    this.previewResponse.set(null);
    this.previewState.set('idle');

    this.resumeApi
      .parseResume(file, this.jobDescription)
      .pipe(finalize(() => this.uploadState.update((state) => (state === 'uploading' ? 'idle' : state))))
      .subscribe({
        next: (response) => {
          this.parsedResume.set(response);
          this.resumeId = this.extractResumeId(response);
          this.selectedSavedResumeId.set(this.resumeId || null);
          this.uploadState.set('success');
          this.loadSavedResumes();
        },
        error: (error) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
          this.uploadState.set('error');
        },
      });
  }

  protected previewSavedResume(resume: SavedResume): void {
    this.resumeId = resume.id;
    this.selectedSavedResumeId.set(resume.id);
    this.parsedResume.set(null);
    this.previewResponse.set(null);
    this.previewErrorMessage.set(null);
    this.previewState.set('idle');
    this.previewResume();
  }

  protected previewResume(): void {
    const resumeId = this.resumeId.trim();
    const templateIds = this.defaultTemplateIds;

    if (!resumeId || templateIds.length === 0 || this.previewState() === 'loading') {
      return;
    }

    this.previewState.set('loading');
    this.previewErrorMessage.set(null);
    this.previewResponse.set(null);

    this.resumeApi
      .previewResume({
        resumeId,
        templateId: templateIds[0],
        templateIds,
      })
      .pipe(finalize(() => this.previewState.update((state) => (state === 'loading' ? 'idle' : state))))
      .subscribe({
        next: (response) => {
          this.previewResponse.set(response);
          this.activeTemplateIndex.set(0);
          this.isPreviewModalOpen.set(true);
          this.previewState.set('success');
        },
        error: (error) => {
          this.previewErrorMessage.set(this.resolveErrorMessage(error, 'preview'));
          this.previewState.set('error');
        },
      });
  }

  protected async downloadWordTemplate(templateId: string, html: string): Promise<void> {
    const { asBlob } = await import('html-docx-js-typescript');
    const blob = await asBlob(this.asExportDocument(templateId, html), {
      margins: {
        top: 360,
        right: 360,
        bottom: 360,
        left: 360,
      },
    });
    const fileBlob = blob instanceof Blob ? blob : new Blob([blob]);
    const url = URL.createObjectURL(fileBlob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `${this.slugify(templateId || 'resume-template')}.docx`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  protected async downloadPdfTemplate(templateId: string, html: string): Promise<void> {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = this.createExportElement(html);

    document.body.appendChild(element);

    try {
      const pdfOptions = {
          filename: `${this.slugify(templateId || 'resume-template')}.pdf`,
          margin: 0,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        };

      await (html2pdf as unknown as () => {
        set: (options: Record<string, unknown>) => {
          from: (element: HTMLElement) => {
            save: () => Promise<void>;
          };
        };
      })()
        .set(pdfOptions)
        .from(element)
        .save();
    } finally {
      element.remove();
    }
  }

  protected trustedPreviewHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.asPreviewDocument(html));
  }

  protected closePreviewModal(): void {
    this.isPreviewModalOpen.set(false);
  }

  protected showPreviousTemplate(): void {
    const templates = this.previewResponse()?.templates ?? [];

    if (templates.length < 2) {
      return;
    }

    this.activeTemplateIndex.update((index) => (index === 0 ? templates.length - 1 : index - 1));
  }

  protected showNextTemplate(): void {
    const templates = this.previewResponse()?.templates ?? [];

    if (templates.length < 2) {
      return;
    }

    this.activeTemplateIndex.update((index) => (index + 1) % templates.length);
  }

  protected clearForm(fileInput: HTMLInputElement): void {
    fileInput.value = '';
    this.selectedFile.set(null);
    this.jobDescription = '';
    this.resumeId = '';
    this.parsedResume.set(null);
    this.previewResponse.set(null);
    this.errorMessage.set(null);
    this.previewErrorMessage.set(null);
    this.selectedSavedResumeId.set(null);
    this.isPreviewModalOpen.set(false);
    this.activeTemplateIndex.set(0);
    this.uploadState.set('idle');
    this.previewState.set('idle');
  }

  protected formatDate(value?: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  private extractResumeId(response: ParsedResumeResponse): string {
    const directResumeId = this.asString(response['resumeId']);
    const directId = this.asString(response['id']);
    const nestedResume = response['resume'];

    if (directResumeId) {
      return directResumeId;
    }

    if (directId) {
      return directId;
    }

    if (typeof nestedResume === 'object' && nestedResume !== null) {
      return this.asString((nestedResume as Record<string, unknown>)['id']) || '';
    }

    return '';
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private resolveFileType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toUpperCase();
    return extension ? `${extension} document` : 'Resume document';
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private asPreviewDocument(html: string): string {
    if (/<html[\s>]/i.test(html)) {
      return html;
    }

    return `<!doctype html><html><head><base target="_blank"></head><body style="margin: 0;">${html}</body></html>`;
  }

  private asExportDocument(templateId: string, html: string): string {
    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${templateId}</title>
          <style>
            body { margin: 0; background: #ffffff; }
          </style>
        </head>
        <body>
          ${this.extractBodyHtml(html)}
        </body>
      </html>
    `;
  }

  private createExportElement(html: string): HTMLElement {
    const element = document.createElement('div');
    element.style.position = 'fixed';
    element.style.left = '-10000px';
    element.style.top = '0';
    element.style.width = '816px';
    element.style.background = '#ffffff';
    element.innerHTML = this.extractBodyHtml(html);

    return element;
  }

  private extractBodyHtml(html: string): string {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(html, 'text/html');

    return documentNode.body.innerHTML || html;
  }

  private resolveErrorMessage(error: unknown, action: 'upload' | 'preview' | 'saved' = 'upload'): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const payload = (error as { error?: unknown }).error;
      const status = (error as { status?: unknown }).status;

      if (typeof payload === 'string') {
        return payload;
      }

      if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
        const detail = (payload as { detail?: unknown }).detail;
        return typeof detail === 'string' ? detail : JSON.stringify(detail);
      }

      if (typeof payload === 'object' && payload !== null && 'message' in payload) {
        const message = (payload as { message?: unknown }).message;
        return typeof message === 'string' ? message : JSON.stringify(message);
      }

      if (action === 'preview' && status === 404) {
        return 'Resume or template was not found. Use an existing resume id and one of: modern-minimal, professional-dark-blue.';
      }
    }

    if (action === 'preview') {
      return 'Unable to preview the resume. Please check the preview API server, resume id, and template ids.';
    }

    if (action === 'saved') {
      return 'Unable to load saved resumes. Please check the parser API server and try again.';
    }

    return 'Unable to upload the resume. Please check the API server and try again.';
  }
}
