import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  AtsScoreResponse,
  ParsedResumeResponse,
  ResumeApi,
  ResumeDocumentResponse,
  ResumePreviewResponse,
  SavedResume,
} from '../services/resume-api';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';
type PreviewState = 'idle' | 'loading' | 'success' | 'error';
type SavedResumesState = 'idle' | 'loading' | 'success' | 'error';
type EditState = 'idle' | 'loading' | 'saving' | 'success' | 'error';
type AtsScoreState = 'idle' | 'loading' | 'success' | 'error';

interface WorkExperienceEditItem {
  companyOrOrganization: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  responsibilities: string;
  achievements: string;
}

interface EducationEditItem {
  degree: string;
  majorOrFieldOfStudy: string;
  institution: string;
  location: string;
  endDate: string;
}

interface CertificationEditItem {
  name: string;
  issuer: string;
  year: string;
}

@Component({
  selector: 'app-resume-upload',
  imports: [CommonModule, FormsModule],
  templateUrl: './resume-upload.html',
  styleUrl: './resume-upload.css',
})
export class ResumeUpload implements OnInit, OnDestroy {
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
  protected readonly uploadLoaderMessage = signal('AI is analyzing your resume...');
  protected readonly selectedSavedResumeId = signal<string | null>(null);
  protected readonly isPreviewModalOpen = signal(false);
  protected readonly isEditModalOpen = signal(false);
  protected readonly editState = signal<EditState>('idle');
  protected readonly editingResume = signal<ResumeDocumentResponse | null>(null);
  protected readonly editErrorMessage = signal<string | null>(null);
  protected readonly editSuccessMessage = signal<string | null>(null);
  protected readonly latestEditedResumeIds = signal<Record<string, string>>({});
  protected readonly atsScores = signal<Record<string, AtsScoreResponse>>({});
  protected readonly atsScoreStates = signal<Record<string, AtsScoreState>>({});
  protected readonly atsScoreErrors = signal<Record<string, string | null>>({});
  protected readonly activeTemplateIndex = signal(0);
  protected readonly displayedSavedResumes = computed(() => {
    const parsedResume = this.parsedResumeListItem();
    const savedResumes = this.savedResumes();

    if (!parsedResume) {
      return savedResumes;
    }

    const matchingSavedResumeIndex = savedResumes.findIndex((resume) => resume.id === parsedResume.id);

    if (matchingSavedResumeIndex === -1) {
      return [parsedResume, ...savedResumes];
    }

    return savedResumes.map((resume, index) =>
      index === matchingSavedResumeIndex
        ? {
            ...resume,
            ...parsedResume,
            filename: parsedResume.filename || resume.filename,
            createdAt: parsedResume.createdAt || resume.createdAt,
            updatedAt: parsedResume.updatedAt || resume.updatedAt,
          }
        : resume,
    );
  });
  private readonly defaultTemplateIds = [
    'modern-minimal',
    'professional-dark-blue',
    'classic-sidebar-gray',
    'clean-blue-header',
  ];
  private uploadLoaderTimer: ReturnType<typeof setTimeout> | null = null;
  protected jobDescription = '';
  protected resumeId = '';
  protected editCandidateName = '';
  protected editCandidateEmail = '';
  protected editCandidatePhone = '';
  protected editCandidateLocation = '';
  protected editCurrentTitle = '';
  protected editProfessionalHeadline = '';
  protected editTotalExperienceYears = '';
  protected editCareerLevel = '';
  protected editIndustry = '';
  protected editSpecialization = '';
  protected editIndustryFocus = '';
  protected editPrimarySpecialization = '';
  protected editSecondarySpecialization = '';
  protected editJobDescription = '';
  protected editProfessionalSummary = '';
  protected editTechnicalHighlights = '';
  protected editLeadershipHighlights = '';
  protected editProjectHighlights = '';
  protected editIndustryHighlights = '';
  protected editHardSkills = '';
  protected editToolsAndSoftware = '';
  protected editMethodologies = '';
  protected editSoftSkills = '';
  protected editLanguages = '';
  protected editWorkExperience: WorkExperienceEditItem[] = [];
  protected editEducation: EducationEditItem[] = [];
  protected editCertifications: CertificationEditItem[] = [];

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

  ngOnDestroy(): void {
    this.clearUploadLoaderTimer();
  }

  protected loadSavedResumes(): void {
    if (this.savedResumesState() === 'loading') {
      return;
    }

    this.savedResumesState.set('loading');
    this.savedResumesErrorMessage.set(null);

    this.resumeApi
      .getTemplateSavedResumes(100, 0)
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
    this.startUploadLoader();
    this.errorMessage.set(null);
    this.previewErrorMessage.set(null);
    this.parsedResume.set(null);
    this.previewResponse.set(null);
    this.previewState.set('idle');

    this.resumeApi
      .parseResume(file, this.jobDescription)
      .pipe(
        finalize(() => {
          this.clearUploadLoaderTimer();
          this.uploadState.update((state) => (state === 'uploading' ? 'idle' : state));
        }),
      )
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
    this.selectedSavedResumeId.set(resume.id);
    this.parsedResume.set(null);
    this.previewResponse.set(null);
    this.previewErrorMessage.set(null);
    this.previewState.set('idle');
    this.previewResumeById(resume.id);
  }

  protected editSavedResume(resume: SavedResume): void {
    if (this.editState() === 'loading' || this.editState() === 'saving') {
      return;
    }

    this.selectedSavedResumeId.set(resume.id);
    this.editState.set('loading');
    this.editErrorMessage.set(null);
    this.editSuccessMessage.set(null);
    this.editingResume.set(null);
    this.isEditModalOpen.set(true);

    this.resumeApi
      .getResume(resume.id)
      .pipe(finalize(() => this.editState.update((state) => (state === 'loading' ? 'idle' : state))))
      .subscribe({
        next: (response) => {
          this.editingResume.set(response);
          this.populateEditForm(response);
          this.editState.set('idle');
        },
        error: (error) => {
          this.editErrorMessage.set(this.resolveErrorMessage(error, 'edit'));
          this.editState.set('error');
        },
      });
  }

  protected saveEditedResume(regenerate = false): void {
    const resume = this.editingResume();

    if (!resume || this.editState() === 'saving') {
      return;
    }

    const profile = this.buildEditedProfile(resume);

    const metadata = {
      ...resume.metadata,
      filename: this.asString(resume.metadata['filename']) || `${this.editCandidateName.trim() || 'edited-resume'}.json`,
    };
    const source = {
      ...resume.source,
      jobDescription: this.editJobDescription.trim() || null,
    };

    this.editState.set('saving');
    this.editErrorMessage.set(null);
    this.editSuccessMessage.set(null);

    this.resumeApi
      .saveEditedResume(resume.id, {
        profile,
        metadata,
        source,
      })
      .pipe(finalize(() => this.editState.update((state) => (state === 'saving' ? 'idle' : state))))
      .subscribe({
        next: (response) => {
          this.latestEditedResumeIds.update((ids) => ({
            ...ids,
            [resume.id]: response.id,
          }));
          this.editState.set('success');

          if (regenerate) {
            this.closeEditModal();
            this.previewResumeById(response.id);
          }
        },
        error: (error) => {
          this.editErrorMessage.set(this.resolveErrorMessage(error, 'edit'));
          this.editState.set('error');
        },
      });
  }

  protected regenerateSavedResume(resume: SavedResume): void {
    const editedResumeId = this.latestEditedResumeIds()[resume.id];

    if (editedResumeId) {
      this.selectedSavedResumeId.set(resume.id);
      this.previewResumeById(editedResumeId);
      return;
    }

    this.editSavedResume(resume);
  }

  protected resumeBuilderUrl(resumeId: string): string {
    return `/resume-builder/${encodeURIComponent(resumeId)}`;
  }

  protected openResumeBuilder(resumeId: string): void {
    window.location.href = this.resumeBuilderUrl(resumeId);
  }

  protected generateResumeAtsScore(resume: SavedResume, event?: Event): void {
    event?.stopPropagation();

    if (this.resumeAtsState(resume) === 'loading') {
      return;
    }

    this.atsScoreStates.update((states) => ({
      ...states,
      [resume.id]: 'loading',
    }));
    this.atsScoreErrors.update((errors) => ({
      ...errors,
      [resume.id]: null,
    }));

    this.resumeApi
      .getAtsScore(resume.id, 'edited')
      .pipe(finalize(() => this.setResumeAtsStateIfLoading(resume.id, 'idle')))
      .subscribe({
        next: (response) => {
          this.atsScores.update((scores) => ({
            ...scores,
            [resume.id]: response,
          }));
          this.atsScoreStates.update((states) => ({
            ...states,
            [resume.id]: 'success',
          }));
        },
        error: (error) => {
          this.atsScoreErrors.update((errors) => ({
            ...errors,
            [resume.id]: this.resolveErrorMessage(error, 'ats'),
          }));
          this.atsScoreStates.update((states) => ({
            ...states,
            [resume.id]: 'error',
          }));
        },
      });
  }

  protected addWorkExperience(): void {
    this.editWorkExperience.push({
      companyOrOrganization: '',
      role: '',
      location: '',
      startDate: '',
      endDate: '',
      responsibilities: '',
      achievements: '',
    });
  }

  protected removeWorkExperience(index: number): void {
    this.editWorkExperience.splice(index, 1);
  }

  protected addEducation(): void {
    this.editEducation.push({
      degree: '',
      majorOrFieldOfStudy: '',
      institution: '',
      location: '',
      endDate: '',
    });
  }

  protected removeEducation(index: number): void {
    this.editEducation.splice(index, 1);
  }

  protected addCertification(): void {
    this.editCertifications.push({
      name: '',
      issuer: '',
      year: '',
    });
  }

  protected removeCertification(index: number): void {
    this.editCertifications.splice(index, 1);
  }

  protected closeEditModal(): void {
    if (this.editState() === 'saving') {
      return;
    }

    this.isEditModalOpen.set(false);
    this.editingResume.set(null);
    this.editErrorMessage.set(null);
    this.editSuccessMessage.set(null);
    this.editState.set('idle');
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

  private previewResumeById(resumeId: string): void {
    this.resumeId = resumeId;
    this.parsedResume.set(null);
    this.previewResponse.set(null);
    this.previewErrorMessage.set(null);
    this.previewState.set('idle');
    this.previewResume();
  }

  protected downloadWordTemplate(templateId: string): void {
    const resumeId = this.resumeId.trim();

    if (!resumeId || !templateId) {
      this.previewErrorMessage.set('Unable to download Word document. Select a saved resume and template first.');
      return;
    }

    this.resumeApi.downloadResumeWord(resumeId, templateId).subscribe({
      next: (blob) => this.saveBlob(blob, `${this.slugify(templateId || 'resume-template')}.docx`),
      error: (error) => {
        this.previewErrorMessage.set(this.resolveErrorMessage(error, 'preview'));
      },
    });
  }

  protected downloadPdfTemplate(templateId: string): void {
    const resumeId = this.resumeId.trim();

    if (!resumeId || !templateId) {
      this.previewErrorMessage.set('Unable to download PDF. Select a saved resume and template first.');
      return;
    }

    this.resumeApi.downloadResumePdf(resumeId, templateId).subscribe({
      next: (blob) => this.saveBlob(blob, `${this.slugify(templateId || 'resume-template')}.pdf`),
      error: (error) => {
        this.previewErrorMessage.set(this.resolveErrorMessage(error, 'preview'));
      },
    });
  }

  protected trustedPreviewHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.asPreviewDocument(html));
  }

  protected resizePreviewFrame(event: Event): void {
    const frame = event.target instanceof HTMLIFrameElement ? event.target : null;

    if (!frame) {
      return;
    }

    this.updatePreviewFrameHeight(frame);
    this.schedulePreviewFrameResize(frame);
    window.setTimeout(() => this.updatePreviewFrameHeight(frame), 250);
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
    this.editErrorMessage.set(null);
    this.editSuccessMessage.set(null);
    this.selectedSavedResumeId.set(null);
    this.atsScores.set({});
    this.atsScoreStates.set({});
    this.atsScoreErrors.set({});
    this.isPreviewModalOpen.set(false);
    this.isEditModalOpen.set(false);
    this.activeTemplateIndex.set(0);
    this.uploadState.set('idle');
    this.clearUploadLoaderTimer();
    this.previewState.set('idle');
    this.editState.set('idle');
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

  protected resumeCardTitle(resume: SavedResume): string {
    return resume.currentTitle || resume.candidateName || resume.filename;
  }

  protected resumeCardFilename(resume: SavedResume): string {
    return resume.filename;
  }

  protected resumeCardUploadedAt(resume: SavedResume): string {
    return this.formatDate(resume.createdAt || resume.updatedAt);
  }

  protected resumeAtsScore(resume: SavedResume): AtsScoreResponse | null {
    return this.atsScores()[resume.id] ?? null;
  }

  protected resumeAtsState(resume: SavedResume): AtsScoreState {
    return this.atsScoreStates()[resume.id] ?? 'idle';
  }

  protected resumeAtsError(resume: SavedResume): string {
    return this.atsScoreErrors()[resume.id] ?? '';
  }

  protected resumeAtsScoreValue(resume: SavedResume): number | null {
    return this.resumeAtsScore(resume)?.atsScore ?? null;
  }

  protected resumeAtsScoreText(resume: SavedResume): string {
    const score = this.resumeAtsScoreValue(resume);
    return score === null ? '--' : String(Math.round(score));
  }

  protected resumeAtsLevel(resume: SavedResume): string {
    const score = this.resumeAtsScore(resume);

    if (score?.scoreLevel) {
      return score.scoreLevel;
    }

    if (this.resumeAtsState(resume) === 'loading') {
      return 'Generating';
    }

    return 'Generate';
  }

  protected resumeAtsTone(resume: SavedResume): string {
    const score = this.resumeAtsScoreValue(resume);

    if (score === null) {
      return 'neutral';
    }

    return score >= 75 ? 'good' : score >= 55 ? 'moderate' : 'low';
  }

  protected resumeAtsRingBackground(resume: SavedResume): string {
    const score = this.clampScore(this.resumeAtsScoreValue(resume) ?? 0);
    const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f97316' : '#ef4444';

    return `conic-gradient(${color} ${score * 3.6}deg, #e5e7eb 0deg)`;
  }

  protected resumeJdMatchText(resume: SavedResume): string {
    const matchScore = this.resumeJdMatchScore(resume);
    return matchScore === null ? '--' : `${Math.round(matchScore)}%`;
  }

  protected resumeJdMatchLevel(resume: SavedResume): string {
    const matchScore = this.resumeJdMatchScore(resume);

    if (matchScore === null) {
      return 'Pending';
    }

    return matchScore >= 75 ? 'Good' : matchScore >= 55 ? 'Moderate' : 'Low';
  }

  protected resumeJdMatchTone(resume: SavedResume): string {
    const matchScore = this.resumeJdMatchScore(resume);

    if (matchScore === null) {
      return 'neutral';
    }

    return matchScore >= 75 ? 'good' : matchScore >= 55 ? 'moderate' : 'low';
  }

  private extractResumeId(response: ParsedResumeResponse): string {
    const directResumeId = this.asString(response['resumeId']);
    const directId = this.asString(response['id']);
    const nestedResume = response['resume'];
    const dataRecord = this.asRecord(response['data']);

    if (directResumeId) {
      return directResumeId;
    }

    if (directId) {
      return directId;
    }

    if (typeof nestedResume === 'object' && nestedResume !== null) {
      const nestedId = this.asString((nestedResume as Record<string, unknown>)['id']);

      if (nestedId) {
        return nestedId;
      }
    }

    return this.asString(dataRecord['resumeId']) || this.asString(dataRecord['id']);
  }

  private parsedResumeListItem(): SavedResume | null {
    const response = this.parsedResume();

    if (!response) {
      return null;
    }

    const id = this.extractResumeId(response);

    if (!id) {
      return null;
    }

    const responseRecord = response as Record<string, unknown>;
    const dataRecord = this.asRecord(responseRecord['data']);
    const resumeRecord = this.asRecord(responseRecord['resume']);
    const profile = this.firstRecord(responseRecord['profile'], dataRecord['profile'], resumeRecord['profile']);
    const candidateProfile = this.asRecord(profile['candidateProfile']);
    const renderedData = this.asRecord(profile['data']);
    const metadata = this.firstRecord(responseRecord['metadata'], dataRecord['metadata'], resumeRecord['metadata']);
    const source = this.firstRecord(responseRecord['source'], dataRecord['source'], resumeRecord['source']);
    const filename =
      this.asString(metadata['filename']) ||
      this.asString(metadata['fileName']) ||
      this.asString(responseRecord['fileName']) ||
      this.asString(dataRecord['fileName']) ||
      this.asString(source['filename']) ||
      this.asString(source['fileName']) ||
      this.selectedFile()?.name ||
      `${id}.html`;

    return {
      id,
      filename,
      candidateName: this.asString(renderedData['name']) || this.asString(candidateProfile['fullName']),
      candidateEmail: this.asString(renderedData['email']) || this.asString(candidateProfile['email']),
      currentTitle:
        this.asString(renderedData['title']) ||
        this.asString(candidateProfile['currentTitle']) ||
        this.asString(candidateProfile['title']) ||
        this.asString(candidateProfile['professionalHeadline']) ||
        this.asString(profile['title']),
      createdAt: this.resolveUploadedAt(responseRecord, dataRecord, resumeRecord, metadata),
      updatedAt:
        this.asString(responseRecord['updatedAt']) ||
        this.asString(dataRecord['updatedAt']) ||
        this.asString(resumeRecord['updatedAt']),
    };
  }

  private firstRecord(...values: unknown[]): Record<string, unknown> {
    for (const value of values) {
      const record = this.asRecord(value);

      if (Object.keys(record).length > 0) {
        return record;
      }
    }

    return {};
  }

  private resolveUploadedAt(
    responseRecord: Record<string, unknown>,
    dataRecord: Record<string, unknown>,
    resumeRecord: Record<string, unknown>,
    metadata: Record<string, unknown>,
  ): string {
    return (
      this.asString(metadata['uploadedAt']) ||
      this.asString(metadata['uploadDate']) ||
      this.asString(metadata['createdAt']) ||
      this.asString(responseRecord['uploadedAt']) ||
      this.asString(responseRecord['createdAt']) ||
      this.asString(dataRecord['uploadedAt']) ||
      this.asString(dataRecord['createdAt']) ||
      this.asString(resumeRecord['uploadedAt']) ||
      this.asString(resumeRecord['createdAt'])
    );
  }

  private startUploadLoader(): void {
    this.clearUploadLoaderTimer();
    this.uploadLoaderMessage.set('AI is analyzing your resume...');
    this.uploadLoaderTimer = setTimeout(() => {
      if (this.uploadState() === 'uploading') {
        this.uploadLoaderMessage.set('Still working. Extracting experience, skills, and profile details...');
      }
    }, 5000);
  }

  private clearUploadLoaderTimer(): void {
    if (this.uploadLoaderTimer) {
      clearTimeout(this.uploadLoaderTimer);
      this.uploadLoaderTimer = null;
    }
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private asOptionalNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private clampScore(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private resumeJdMatchScore(resume: SavedResume): number | null {
    const score = this.resumeAtsScore(resume);

    if (!score) {
      return null;
    }

    return (
      this.asOptionalNumber(score['jdMatch']) ??
      this.asOptionalNumber(score['jobDescriptionMatch']) ??
      this.asOptionalNumber(score['jobDescriptionMatchScore']) ??
      this.asOptionalNumber(score['matchScore'])
    );
  }

  private setResumeAtsStateIfLoading(resumeId: string, state: AtsScoreState): void {
    this.atsScoreStates.update((states) =>
      states[resumeId] === 'loading'
        ? {
            ...states,
            [resumeId]: state,
          }
        : states,
    );
  }

  private populateEditForm(resume: ResumeDocumentResponse): void {
    const candidateProfile = this.asRecord(resume.profile['candidateProfile']);
    const careerClassification = this.asRecord(resume.profile['careerClassification']);
    const careerProgression = this.asRecord(resume.profile['careerProgression']);
    const resumeBlocks = this.asRecord(resume.profile['resumeBlocks']);
    const coreSkills = this.asRecord(resume.profile['coreSkills']);
    const source = this.asRecord(resume.source);

    this.editCandidateName = this.asString(candidateProfile['fullName']);
    this.editCandidateEmail = this.asString(candidateProfile['email']);
    this.editCandidatePhone = this.asString(candidateProfile['phone']);
    this.editCandidateLocation = this.asString(candidateProfile['location']);
    this.editCurrentTitle = this.asString(candidateProfile['currentTitle']);
    this.editProfessionalHeadline = this.asString(candidateProfile['professionalHeadline']);
    this.editTotalExperienceYears = this.asEditableNumber(candidateProfile['totalExperienceYears']);
    this.editCareerLevel = this.asString(careerProgression['careerLevel']) || this.asString(careerClassification['seniorityLevel']);
    this.editIndustry = this.asString(careerClassification['industry']);
    this.editSpecialization = this.asString(careerClassification['subSpecialization']);
    this.editIndustryFocus = this.asEditableLines(careerProgression['industryFocus']);
    this.editPrimarySpecialization = this.asEditableLines(careerProgression['primarySpecialization']);
    this.editSecondarySpecialization = this.asEditableLines(careerProgression['secondarySpecialization']);
    this.editJobDescription = this.asString(source['jobDescription']);
    this.editProfessionalSummary = this.asEditableLines(this.uniqueLines([
      ...this.asStringArray(resumeBlocks['executiveSummary']),
      ...this.asStringArray(resume.profile['professionalSummaryPoints']),
    ]));
    this.editTechnicalHighlights = this.asEditableLines(resumeBlocks['technicalHighlights']);
    this.editLeadershipHighlights = this.asEditableLines(resumeBlocks['leadershipHighlights']);
    this.editProjectHighlights = this.asEditableLines(resumeBlocks['projectHighlights']);
    this.editIndustryHighlights = this.asEditableLines(resumeBlocks['industryHighlights']);
    this.editHardSkills = this.asEditableLines(coreSkills['hardSkills']);
    this.editToolsAndSoftware = this.asEditableLines(coreSkills['toolsAndSoftware']);
    this.editMethodologies = this.asEditableLines(coreSkills['methodologiesAndFrameworks']);
    this.editSoftSkills = this.asEditableLines(coreSkills['softSkills']);
    this.editLanguages = this.asEditableLines(coreSkills['languages']);
    this.editWorkExperience = this.asRecordArray(resume.profile['workExperience']).map((item) => ({
      companyOrOrganization: this.asString(item['companyOrOrganization']),
      role: this.asString(item['role']),
      location: this.asString(item['location']),
      startDate: this.asString(item['startDate']),
      endDate: this.asString(item['endDate']),
      responsibilities: this.asEditableLines(item['responsibilities']),
      achievements: this.asEditableLines(item['achievements']),
    }));
    this.editEducation = this.asRecordArray(resume.profile['education']).map((item) => ({
      degree: this.asString(item['degree']),
      majorOrFieldOfStudy: this.asString(item['majorOrFieldOfStudy']),
      institution: this.asString(item['institution']),
      location: this.asString(item['location']),
      endDate: this.asString(item['endDate']),
    }));
    this.editCertifications = this.asRecordArray(resume.profile['certificationsAndLicenses']).map((item) => ({
      name: this.asString(item['name']),
      issuer: this.asString(item['issuer']),
      year: this.asEditableNumber(item['year']),
    }));
  }

  private buildEditedProfile(resume: ResumeDocumentResponse): Record<string, unknown> {
    const profile = structuredClone(resume.profile) as Record<string, unknown>;
    const summaryPoints = this.toLines(this.editProfessionalSummary);

    profile['candidateProfile'] = {
      ...this.asRecord(profile['candidateProfile']),
      fullName: this.editCandidateName.trim(),
      email: this.editCandidateEmail.trim(),
      phone: this.editCandidatePhone.trim(),
      location: this.editCandidateLocation.trim(),
      currentTitle: this.editCurrentTitle.trim(),
      professionalHeadline: this.editProfessionalHeadline.trim(),
      totalExperienceYears: this.toOptionalNumber(this.editTotalExperienceYears),
    };
    profile['professionalSummaryPoints'] = summaryPoints;
    profile['careerClassification'] = {
      ...this.asRecord(profile['careerClassification']),
      industry: this.editIndustry.trim(),
      subSpecialization: this.editSpecialization.trim(),
      seniorityLevel: this.editCareerLevel.trim(),
    };
    profile['careerProgression'] = {
      ...this.asRecord(profile['careerProgression']),
      careerLevel: this.editCareerLevel.trim(),
      industryFocus: this.toLines(this.editIndustryFocus),
      primarySpecialization: this.toLines(this.editPrimarySpecialization),
      secondarySpecialization: this.toLines(this.editSecondarySpecialization),
    };
    profile['resumeBlocks'] = {
      ...this.asRecord(profile['resumeBlocks']),
      executiveSummary: summaryPoints,
      technicalHighlights: this.toLines(this.editTechnicalHighlights),
      leadershipHighlights: this.toLines(this.editLeadershipHighlights),
      projectHighlights: this.toLines(this.editProjectHighlights),
      industryHighlights: this.toLines(this.editIndustryHighlights),
    };
    profile['coreSkills'] = {
      ...this.asRecord(profile['coreSkills']),
      hardSkills: this.toLines(this.editHardSkills),
      toolsAndSoftware: this.toLines(this.editToolsAndSoftware),
      methodologiesAndFrameworks: this.toLines(this.editMethodologies),
      softSkills: this.toLines(this.editSoftSkills),
      languages: this.toLines(this.editLanguages),
    };
    profile['workExperience'] = this.mergeRecordArray(profile['workExperience'], this.editWorkExperience, (original, edited) => ({
      ...original,
      companyOrOrganization: edited.companyOrOrganization.trim(),
      role: edited.role.trim(),
      location: edited.location.trim(),
      startDate: edited.startDate.trim() || null,
      endDate: edited.endDate.trim() || null,
      isCurrent: !edited.endDate.trim(),
      responsibilities: this.toLines(edited.responsibilities),
      achievements: this.toLines(edited.achievements),
    }));
    profile['education'] = this.mergeRecordArray(profile['education'], this.editEducation, (original, edited) => ({
      ...original,
      degree: edited.degree.trim(),
      majorOrFieldOfStudy: edited.majorOrFieldOfStudy.trim(),
      institution: edited.institution.trim(),
      location: edited.location.trim(),
      endDate: edited.endDate.trim() || null,
    }));
    profile['certificationsAndLicenses'] = this.mergeRecordArray(
      profile['certificationsAndLicenses'],
      this.editCertifications,
      (original, edited) => ({
        ...original,
        name: edited.name.trim(),
        issuer: edited.issuer.trim() || null,
        year: this.toOptionalNumber(edited.year),
      }),
    );

    return profile;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private asRecordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value) ? value.map((item) => this.asRecord(item)) : [];
  }

  private asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private asEditableLines(value: unknown): string {
    return this.asStringArray(value).join('\n');
  }

  private asEditableNumber(value: unknown): string {
    return typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  }

  private toLines(value: string): string[] {
    return this.uniqueLines(value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean));
  }

  private uniqueLines(lines: string[]): string[] {
    const seen = new Set<string>();

    return lines.filter((line) => {
      const normalized = line.trim().replace(/\s+/g, ' ').toLowerCase();

      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
  }

  private toOptionalNumber(value: string): number | null {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private mergeRecordArray<T>(
    originalValue: unknown,
    editedItems: T[],
    mapItem: (original: Record<string, unknown>, edited: T) => Record<string, unknown>,
  ): Record<string, unknown>[] {
    const originalItems = this.asRecordArray(originalValue);
    return editedItems.map((edited, index) => mapItem(originalItems[index] ?? {}, edited));
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
    const previewFrameStyle = `
      <style>
        html,
        body {
          margin: 0 !important;
          min-height: 0 !important;
          overflow: hidden !important;
          background: #ffffff;
        }
      </style>
    `;

    if (!/<html[\s>]/i.test(html)) {
      return [
        '<!doctype html><html><head><base target="_blank">',
        previewFrameStyle,
        '</head><body>',
        html,
        '</body></html>',
      ].join('');
    }

    const parser = new DOMParser();
    const documentNode = parser.parseFromString(html, 'text/html');

    if (!documentNode.head.querySelector('base')) {
      const base = documentNode.createElement('base');
      base.target = '_blank';
      documentNode.head.prepend(base);
    }

    documentNode.head.insertAdjacentHTML('beforeend', previewFrameStyle);

    return `<!doctype html>${documentNode.documentElement.outerHTML}`;
  }

  private updatePreviewFrameHeight(frame: HTMLIFrameElement): void {
    const documentNode = frame.contentDocument;
    const body = documentNode?.body;
    const documentElement = documentNode?.documentElement;

    if (!body || !documentElement) {
      return;
    }

    const contentHeight = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      documentElement.clientHeight,
      documentElement.scrollHeight,
      documentElement.offsetHeight,
    );

    frame.style.height = `${Math.max(contentHeight, 640)}px`;
  }

  private schedulePreviewFrameResize(frame: HTMLIFrameElement): void {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => this.updatePreviewFrameHeight(frame));
      return;
    }

    window.setTimeout(() => this.updatePreviewFrameHeight(frame), 16);
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

  private extractBodyHtml(html: string): string {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(html, 'text/html');

    return documentNode.body.innerHTML || html;
  }

  private saveBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  private resolveErrorMessage(
    error: unknown,
    action: 'upload' | 'preview' | 'saved' | 'edit' | 'ats' = 'upload',
  ): string {
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
        return 'Resume or template was not found. Use an existing resume id and one of: modern-minimal, professional-dark-blue, classic-sidebar-gray, clean-blue-header.';
      }
    }

    if (action === 'preview') {
      return 'Unable to preview the resume. Please check the API gateway, template route, resume id, and template ids.';
    }

    if (action === 'saved') {
      return 'Unable to load saved resumes. Please check the API gateway and saved resume route, then try again.';
    }

    if (action === 'edit') {
      return 'Unable to save the edited resume copy. Please check the API gateway and parser route, then try again.';
    }

    if (action === 'ats') {
      return 'Unable to generate the ATS score. Please check the API gateway and parser route, then try again.';
    }

    return 'Unable to upload the resume. Please check the API gateway and parser route, then try again.';
  }
}
