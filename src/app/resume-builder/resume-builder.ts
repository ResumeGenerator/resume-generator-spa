import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import {
  ParsedResumeResponse,
  RenderedResumeSaveRequest,
  ResumeApi,
  ResumeDocumentResponse,
  ResumePreviewResponse,
  SavedResume,
} from '../services/resume-api';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';
type PreviewState = 'idle' | 'loading' | 'success' | 'error';
type SavedResumesState = 'idle' | 'loading' | 'success' | 'error';
type EditState = 'idle' | 'loading' | 'saving' | 'success' | 'error';
type RenderedSaveState = 'idle' | 'saving' | 'success' | 'error';
type EditorStepId = 'personal' | 'contact' | 'experience' | 'skills' | 'education' | 'summary';

interface EditorStep {
  id: EditorStepId;
  label: string;
}

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
  selector: 'app-resume-builder',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './resume-builder.html',
  styleUrl: './resume-builder.css',
})
export class ResumeBuilder implements OnInit, OnDestroy {
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
  protected readonly renderedSaveState = signal<RenderedSaveState>('idle');
  protected readonly latestEditedResumeIds = signal<Record<string, string>>({});
  protected readonly activeTemplateIndex = signal(0);
  protected readonly activeEditorStep = signal<EditorStepId>('personal');
  protected readonly savedIndicator = signal(true);
  protected readonly editorSteps: EditorStep[] = [
    { id: 'personal', label: 'Personal details' },
    { id: 'contact', label: 'Contact info' },
    { id: 'experience', label: 'Work experience' },
    { id: 'skills', label: 'Skills' },
    { id: 'education', label: 'Education' },
    { id: 'summary', label: 'Professional summary' },
  ];
  private readonly defaultTemplateIds = [
    'modern-minimal',
    'professional-dark-blue',
    'classic-sidebar-gray',
    'clean-blue-header',
  ];
  private readonly renderedTemplateId = 'sydney';
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

  protected readonly activeStepIndex = computed(() =>
    Math.max(
      0,
      this.editorSteps.findIndex((step) => step.id === this.activeEditorStep()),
    ),
  );
  protected readonly activeStepNumber = computed(() => this.activeStepIndex() + 1);
  protected readonly activeStepHeading = computed(() => this.resolveStepHeading(this.activeEditorStep()));
  protected readonly activeStepDescription = computed(() => this.resolveStepDescription(this.activeEditorStep()));
  protected readonly suggestionText = computed(() => this.resolveSuggestionText(this.activeEditorStep()));
  protected readonly primaryExperience = computed(() => this.editWorkExperience[0]);
  protected readonly currentResumePreview = computed(() => {
    const template = this.previewResponse()?.templates[this.activeTemplateIndex()];
    return template?.html ? this.asPreviewDocument(template.html) : this.buildFallbackPreviewHtml();
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
      .getSavedResumes(100, 0)
      .pipe(finalize(() => this.savedResumesState.update((state) => (state === 'loading' ? 'idle' : state))))
      .subscribe({
        next: (response) => {
          this.savedResumes.set(response.items ?? []);
          this.savedResumesState.set('success');

          const firstResume = response.items?.[0];
          if (firstResume && !this.selectedSavedResumeId()) {
            this.selectedSavedResumeId.set(firstResume.id);
            this.resumeId = firstResume.id;
            this.loadResumeIntoEditor(firstResume.id);
            this.previewResumeById(firstResume.id);
          }
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

  protected setEditorStep(step: EditorStepId): void {
    this.activeEditorStep.set(step);
  }

  protected nextEditorStep(): void {
    const nextStep = this.editorSteps[Math.min(this.activeStepIndex() + 1, this.editorSteps.length - 1)];
    this.activeEditorStep.set(nextStep.id);
    this.savedIndicator.set(true);
  }

  protected previousEditorStep(): void {
    const previousStep = this.editorSteps[Math.max(this.activeStepIndex() - 1, 0)];
    this.activeEditorStep.set(previousStep.id);
  }

  protected isStepCompleted(index: number): boolean {
    return index < this.activeStepIndex();
  }

  protected hardSkillChips(): string[] {
    return this.toChipList(this.editHardSkills);
  }

  protected suggestedSkillChips(): string[] {
    const existing = new Set(this.hardSkillChips().map((skill) => skill.toLowerCase()));
    return [
      'System design',
      'Project management',
      'Technical leadership',
      'Code optimization',
      'Risk assessment',
      'Mentoring',
      'Cross-functional collaboration',
      'Automation',
      'Performance tuning',
      'Requirement analysis',
    ].filter((skill) => !existing.has(skill.toLowerCase()));
  }

  protected addSuggestedSkill(skill: string): void {
    const existing = this.hardSkillChips();
    if (existing.some((item) => item.toLowerCase() === skill.toLowerCase())) {
      return;
    }

    this.editHardSkills = [...existing, skill].join('\n');
    this.savedIndicator.set(true);
  }

  protected removeSuggestedSkill(skill: string): void {
    this.editHardSkills = this.hardSkillChips()
      .filter((item) => item !== skill)
      .join('\n');
    this.savedIndicator.set(true);
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
          this.editSuccessMessage.set(`Edited copy saved to edited_resumes with id ${response.id}.`);
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

  private loadResumeIntoEditor(resumeId: string): void {
    this.resumeApi.getResume(resumeId).subscribe({
      next: (response) => {
        this.editingResume.set(response);
        this.populateEditForm(response);
      },
      error: () => undefined,
    });
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

  protected downloadActivePdf(): void {
    const templateId = this.previewResponse()?.templates[this.activeTemplateIndex()]?.templateId || this.defaultTemplateIds[0];
    this.downloadPdfTemplate(templateId);
  }

  protected downloadActiveWord(): void {
    const templateId = this.previewResponse()?.templates[this.activeTemplateIndex()]?.templateId || this.defaultTemplateIds[0];
    this.downloadWordTemplate(templateId);
  }

  protected saveRenderedResume(): void {
    if (this.renderedSaveState() === 'saving') {
      return;
    }

    this.renderedSaveState.set('saving');
    this.previewErrorMessage.set(null);

    this.resumeApi
      .saveRenderedResume(this.buildRenderedResumePayload())
      .pipe(finalize(() => this.renderedSaveState.update((state) => (state === 'saving' ? 'idle' : state))))
      .subscribe({
        next: () => {
          this.renderedSaveState.set('success');
          this.savedIndicator.set(true);
        },
        error: (error) => {
          this.previewErrorMessage.set(this.resolveErrorMessage(error, 'edit'));
          this.renderedSaveState.set('error');
        },
      });
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
    this.editErrorMessage.set(null);
    this.editSuccessMessage.set(null);
    this.selectedSavedResumeId.set(null);
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

  protected firstName(): string {
    return this.editCandidateName.trim().split(/\s+/)[0] || '';
  }

  protected lastName(): string {
    return this.editCandidateName.trim().split(/\s+/).filter(Boolean).slice(1).join(' ');
  }

  protected updateFirstName(value: string): void {
    this.editCandidateName = [value.trim(), this.lastName()].filter(Boolean).join(' ');
    this.savedIndicator.set(true);
  }

  protected updateLastName(value: string): void {
    this.editCandidateName = [this.firstName(), value.trim()].filter(Boolean).join(' ');
    this.savedIndicator.set(true);
  }

  private resolveStepHeading(step: EditorStepId): string {
    const headings: Record<EditorStepId, string> = {
      personal: 'Personal details',
      contact: 'Contact information',
      experience: 'Work experience',
      skills: 'Skills',
      education: 'Education',
      summary: 'Professional summary',
    };

    return headings[step];
  }

  private resolveStepDescription(step: EditorStepId): string {
    const descriptions: Record<EditorStepId, string> = {
      personal: 'Adding your name and desired job title helps recruiters quickly understand who you are and what role you want.',
      contact: 'Help recruiters get back to you. Resumes with complete contact info get more replies.',
      experience: 'Use this section to show what you achieved in each role. Recruiters notice results more than duties.',
      skills: "We've suggested some skills from your experience. Add or edit them to show recruiters what you do best.",
      education: 'Add degrees, institutions, and certifications that strengthen your profile.',
      summary: 'Write a concise summary that connects your experience to the role you want next.',
    };

    return descriptions[step];
  }

  private resolveSuggestionText(step: EditorStepId): string {
    if (step === 'personal') {
      return 'Add contact email +8%';
    }

    if (step === 'contact') {
      return 'Add work experience +16%';
    }

    return 'Add skills +6%';
  }

  private toChipList(value: string): string[] {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private buildRenderedResumePayload(): RenderedResumeSaveRequest {
    const summary = this.editProfessionalSummary.trim() || this.editProfessionalHeadline.trim();
    const skillItems = this.uniqueLines([
      ...this.toChipList(this.editHardSkills),
      ...this.toChipList(this.editToolsAndSoftware),
      ...this.toChipList(this.editMethodologies),
      ...this.toChipList(this.editSoftSkills),
      ...this.toChipList(this.editLanguages),
    ]).map((skill) => ({ name: skill, level: '' }));

    return {
      template: this.renderedTemplateId,
      format: 'html',
      data: {
        name: this.editCandidateName.trim(),
        title: this.editCurrentTitle.trim(),
        location: this.editCandidateLocation.trim(),
        phone: this.editCandidatePhone.trim(),
        email: this.editCandidateEmail.trim(),
        summary,
        dateOfBirth: '',
        gender: '',
        nationality: '',
        documentDate: '',
        address: this.editIndustry.trim(),
        postalCode: this.editSpecialization.trim(),
        secondaryAddress: null,
        sections: [
          {
            title: 'Professional summary',
            type: 'summary',
            items: summary,
          },
          {
            title: 'Work experience',
            type: 'experience',
            items: this.editWorkExperience.map((experience) => ({
              position: experience.role.trim(),
              company: experience.companyOrOrganization.trim(),
              location: experience.location.trim(),
              jobType: '',
              reasonForLeaving: '',
              start: experience.startDate.trim(),
              end: experience.endDate.trim(),
              achievements: this.uniqueLines([
                ...this.toChipList(experience.responsibilities),
                ...this.toChipList(experience.achievements),
              ]),
            })),
          },
          {
            title: 'Education',
            type: 'education',
            items: this.editEducation.map((education) => ({
              degree: education.degree.trim(),
              school: education.institution.trim(),
              faculty: '',
              department: education.majorOrFieldOfStudy.trim(),
              location: education.location.trim(),
              years: education.endDate.trim(),
              start: '',
              end: education.endDate.trim(),
              highlights: [],
            })),
          },
          {
            title: 'Skills',
            type: 'skill',
            items: skillItems,
          },
          {
            title: 'Courses',
            type: 'course',
            items: this.editCertifications.map((certification) => ({
              course: certification.name.trim(),
              institution: certification.issuer.trim(),
              start: '',
              end: certification.year.trim(),
            })),
          },
        ],
      },
      font: 'Arial',
      color: '#000000',
      withPhoto: false,
      avatar: '',
      contactsTitle: 'Contacts',
      detailsTitle: 'Details',
    };
  }

  private buildFallbackPreviewHtml(): string {
    const candidateName = this.editCandidateName.trim() || this.savedResumes()[0]?.candidateName || 'Your Name';
    const title = this.editCurrentTitle.trim() || this.savedResumes()[0]?.currentTitle || 'Professional Title';
    const email = this.editCandidateEmail.trim() || this.savedResumes()[0]?.candidateEmail || 'email@example.com';
    const phone = this.editCandidatePhone.trim() || '+974 74452435';
    const location = this.editCandidateLocation.trim() || 'Doha, Qatar';
    const experience = this.primaryExperience();
    const skills = this.hardSkillChips().slice(0, 8);
    const bullets = this.toChipList(
      experience?.responsibilities ||
        this.editProfessionalSummary ||
        'Designed and implemented scalable systems.\nAnalyzed complex technical issues.\nCollaborated with cross-functional teams.',
    ).slice(0, 5);

    return `
      <!doctype html>
      <html>
        <head>
          <style>
            body { margin: 0; background: #fff; color: #222; font-family: Arial, sans-serif; }
            .page { display: grid; grid-template-columns: 32% 1fr; min-height: 900px; }
            aside { background: #4da9bd; color: #fff; padding: 58px 36px; }
            aside .dark { margin: -58px -36px 40px; padding: 46px 36px; background: #3d3d3d; }
            h1 { margin: 48px 0 8px; color: #47a8bd; font-size: 42px; line-height: 1.05; }
            h2 { margin: 36px 0 18px; padding-bottom: 12px; border-bottom: 2px solid #47a8bd; font-size: 20px; letter-spacing: 1px; }
            main { padding: 54px 48px; }
            p, li { font-size: 14px; line-height: 1.55; }
            .muted { color: #666; font-weight: 700; }
            .contact { display: grid; gap: 14px; font-size: 13px; }
            .skills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; }
            .skills span { padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,.18); }
          </style>
        </head>
        <body>
          <div class="page">
            <aside>
              <div class="dark">
                <h2 style="color:#fff;border:0;margin:0 0 18px;">CONTACTS</h2>
                <div class="contact">
                  <span>${location}</span>
                  <span>${phone}</span>
                  <span>${email}</span>
                </div>
              </div>
              <h2 style="color:#fff;border-color:rgba(255,255,255,.5);">SKILLS</h2>
              <div class="skills">${skills.map((skill) => `<span>${skill}</span>`).join('')}</div>
            </aside>
            <main>
              <h1>${candidateName}</h1>
              <p class="muted">${title}</p>
              <h2>WORK EXPERIENCE</h2>
              <p><strong>${experience?.role || 'Senior Engineer'}</strong>, ${experience?.companyOrOrganization || 'Company'} ${experience?.location || ''}</p>
              <ul>${bullets.map((line) => `<li>${line}</li>`).join('')}</ul>
            </main>
          </div>
        </body>
      </html>
    `;
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

  private resolveErrorMessage(error: unknown, action: 'upload' | 'preview' | 'saved' | 'edit' = 'upload'): string {
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
      return 'Unable to preview the resume. Please check the preview API server, resume id, and template ids.';
    }

    if (action === 'saved') {
      return 'Unable to load saved resumes. Please check the parser API server and try again.';
    }

    if (action === 'edit') {
      return 'Unable to save the edited resume copy. Please check the parser API server and try again.';
    }

    return 'Unable to upload the resume. Please check the API server and try again.';
  }
}
