import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
type AiEnhanceState = 'idle' | 'loading' | 'success' | 'error';
type PhotoUploadState = 'idle' | 'uploading' | 'success' | 'error';
type EditorStepId = 'personal' | 'contact' | 'experience' | 'skills' | 'education' | 'courses' | 'languages' | 'summary';

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

interface AiWorkSummarySuggestion {
  index: number;
  text: string;
}

interface RenderedTextBlock {
  text: string;
  tagName: string;
  isBullet: boolean;
}

interface EducationEditItem {
  degree: string;
  majorOrFieldOfStudy: string;
  institution: string;
  location: string;
  startDate: string;
  endDate: string;
}

interface CertificationEditItem {
  name: string;
  issuer: string;
  year: string;
}

interface CourseEditItem {
  course: string;
  institution: string;
  startDate: string;
  endDate: string;
}

interface PreviewOptions {
  preserveCurrentPreview?: boolean;
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
  protected readonly aiEnhanceState = signal<AiEnhanceState>('idle');
  protected readonly aiEnhanceErrorMessage = signal<string | null>(null);
  protected readonly photoUploadState = signal<PhotoUploadState>('idle');
  protected readonly photoUploadErrorMessage = signal<string | null>(null);
  protected readonly pendingAiWorkSummaryIndex = signal<number | null>(null);
  protected readonly aiWorkSummarySuggestion = signal<AiWorkSummarySuggestion | null>(null);
  protected readonly aiProfessionalSummarySuggestion = signal('');
  protected readonly isProfessionalSummaryAiActive = signal(false);
  protected readonly renderedSaveState = signal<RenderedSaveState>('idle');
  protected readonly hasUnsavedChanges = signal(false);
  protected readonly latestEditedResumeIds = signal<Record<string, string>>({});
  protected readonly activeTemplateIndex = signal(0);
  protected readonly activeEditorStep = signal<EditorStepId>('personal');
  protected readonly savedIndicator = signal(true);
  protected readonly collapsedWorkExperienceIndexes = signal<Set<number>>(new Set());
  protected readonly collapsedEducationIndexes = signal<Set<number>>(new Set());
  protected readonly collapsedCourseIndexes = signal<Set<number>>(new Set());
  protected readonly editorSteps: EditorStep[] = [
    { id: 'personal', label: 'Personal' },
    { id: 'contact', label: 'Contact' },
    { id: 'experience', label: 'Experience' },
    { id: 'skills', label: 'Skills' },
    { id: 'education', label: 'Education' },
    { id: 'courses', label: 'Courses' },
    { id: 'languages', label: 'Languages' },
    { id: 'summary', label: 'Summary' },
  ];
  private readonly defaultTemplateIds = [
    'modern-minimal',
    'professional-dark-blue',
    'classic-sidebar-gray',
    'clean-blue-header',
  ];
  private uploadLoaderTimer: ReturnType<typeof setTimeout> | null = null;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
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
  protected editAvatar = '';
  protected editTechnicalHighlights = '';
  protected editLeadershipHighlights = '';
  protected editProjectHighlights = '';
  protected editIndustryHighlights = '';
  protected editHardSkills = '';
  protected newSkill = '';
  protected editToolsAndSoftware = '';
  protected editMethodologies = '';
  protected editSoftSkills = '';
  protected editLanguages = '';
  protected newLanguage = '';
  protected editWorkExperience: WorkExperienceEditItem[] = [];
  protected editEducation: EducationEditItem[] = [];
  protected editCourses: CourseEditItem[] = [];
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
  protected readonly currentResumePreview = computed(() => {
    const template = this.previewResponse()?.templates[this.activeTemplateIndex()];
    return template?.html ? this.asPreviewDocument(template.html) : this.buildFallbackPreviewHtml();
  });
  protected readonly trustedCurrentResumePreview = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.currentResumePreview()),
  );

  protected readonly savePillText = computed(() => {
    if (this.renderedSaveState() === 'saving') {
      return 'Saving...';
    }

    if (this.renderedSaveState() === 'error') {
      return 'Save failed';
    }

    if (this.hasUnsavedChanges()) {
      return 'Unsaved changes';
    }

    if (this.savedIndicator()) {
      return '✓ Saved';
    }

    return 'Saved';
  });

  protected readonly savePillState = computed(() => {
    if (this.renderedSaveState() === 'saving') {
      return 'saving';
    }

    if (this.renderedSaveState() === 'error') {
      return 'error';
    }

    if (this.hasUnsavedChanges()) {
      return 'dirty';
    }

    return 'saved';
  });

  constructor(
    private readonly resumeApi: ResumeApi,
    private readonly sanitizer: DomSanitizer,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const resumeId = this.route.snapshot.paramMap.get('resumeId')?.trim();

    if (resumeId) {
      this.selectedSavedResumeId.set(resumeId);
      this.resumeId = resumeId;
      this.previewResumeById(resumeId);
    }

    this.loadSavedResumes();
  }

  ngOnDestroy(): void {
    this.clearUploadLoaderTimer();
    this.cancelAutoSave();
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

          const firstResume = response.items?.[0];
          if (firstResume && !this.selectedSavedResumeId()) {
            this.selectedSavedResumeId.set(firstResume.id);
            this.resumeId = firstResume.id;
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

  protected onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    input.value = '';

    if (!file) {
      return;
    }

    if (file.type && !file.type.startsWith('image/')) {
      this.photoUploadErrorMessage.set('Choose an image file for the resume photo.');
      this.photoUploadState.set('error');
      return;
    }

    const resumeId = this.activeResumeId();

    if (!resumeId) {
      this.photoUploadErrorMessage.set('Unable to upload photo. Select or upload a resume first.');
      this.photoUploadState.set('error');
      return;
    }

    this.photoUploadState.set('uploading');
    this.photoUploadErrorMessage.set(null);
    this.previewErrorMessage.set(null);

    this.resumeApi
      .uploadResumeImage(resumeId, file)
      .pipe(finalize(() => this.photoUploadState.update((state) => (state === 'uploading' ? 'idle' : state))))
      .subscribe({
        next: (response) => {
          this.applyUploadedImageResponse(response, resumeId);
          this.photoUploadState.set('success');
        },
        error: (error) => {
          this.photoUploadErrorMessage.set(this.resolveErrorMessage(error, 'image'));
          this.photoUploadState.set('error');
        },
      });
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
    if (this.aiEnhanceState() === 'loading') {
      return;
    }

    this.advanceEditorStep();
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

  protected languageChips(): string[] {
    return this.toChipList(this.editLanguages);
  }

  protected primaryExperience(): WorkExperienceEditItem | undefined {
    return this.editWorkExperience[0];
  }

  protected isWorkExperienceCollapsed(index: number): boolean {
    return this.collapsedWorkExperienceIndexes().has(index);
  }

  protected toggleWorkExperience(index: number): void {
    this.collapsedWorkExperienceIndexes.update((indexes) => {
      const nextIndexes = new Set(indexes);

      if (nextIndexes.has(index)) {
        nextIndexes.delete(index);
      } else {
        nextIndexes.add(index);
      }

      return nextIndexes;
    });
  }

  protected isEducationCollapsed(index: number): boolean {
    return this.collapsedEducationIndexes().has(index);
  }

  protected toggleEducation(index: number): void {
    this.collapsedEducationIndexes.update((indexes) => {
      const nextIndexes = new Set(indexes);

      if (nextIndexes.has(index)) {
        nextIndexes.delete(index);
      } else {
        nextIndexes.add(index);
      }

      return nextIndexes;
    });
  }

  protected isCourseCollapsed(index: number): boolean {
    return this.collapsedCourseIndexes().has(index);
  }

  protected toggleCourse(index: number): void {
    this.collapsedCourseIndexes.update((indexes) => {
      const nextIndexes = new Set(indexes);

      if (nextIndexes.has(index)) {
        nextIndexes.delete(index);
      } else {
        nextIndexes.add(index);
      }

      return nextIndexes;
    });
  }

  protected improveWorkSummary(index: number): void {
    this.improvePendingWorkSummary(index);
  }

  protected aiWorkSummarySuggestionFor(index: number): string {
    const suggestion = this.aiWorkSummarySuggestion();
    return suggestion?.index === index ? suggestion.text : '';
  }

  protected cancelWorkSummarySuggestion(index: number): void {
    if (this.aiWorkSummarySuggestion()?.index === index) {
      this.aiWorkSummarySuggestion.set(null);
    }

    if (this.pendingAiWorkSummaryIndex() === index) {
      this.pendingAiWorkSummaryIndex.set(null);
    }

    this.aiEnhanceErrorMessage.set(null);
    this.aiEnhanceState.set('idle');
  }

  protected applyWorkSummarySuggestion(index: number): void {
    const suggestion = this.aiWorkSummarySuggestion();

    if (!this.editWorkExperience[index] || suggestion?.index !== index) {
      return;
    }

    this.updateWorkExperienceResponsibilities(index, suggestion.text);
    this.aiWorkSummarySuggestion.set(null);
    this.pendingAiWorkSummaryIndex.set(null);
    this.aiEnhanceErrorMessage.set(null);
    this.aiEnhanceState.set('success');
    this.markUnsavedChanges();
  }

  protected updateWorkExperienceResponsibilities(index: number, responsibilities: string): void {
    this.editWorkExperience = this.editWorkExperience.map((item, itemIndex) =>
      itemIndex === index
        ? {
            ...item,
            responsibilities,
          }
        : item,
    );
    this.markUnsavedChanges();
  }

  protected improveProfessionalSummary(): void {
    this.improvePendingProfessionalSummary();
  }

  protected professionalSummaryAiErrorActive(): boolean {
    return this.isProfessionalSummaryAiActive() && Boolean(this.aiEnhanceErrorMessage());
  }

  protected cancelProfessionalSummarySuggestion(): void {
    this.aiProfessionalSummarySuggestion.set('');
    this.isProfessionalSummaryAiActive.set(false);
    this.aiEnhanceErrorMessage.set(null);
    this.aiEnhanceState.set('idle');
  }

  protected applyProfessionalSummarySuggestion(): void {
    const suggestion = this.aiProfessionalSummarySuggestion();

    if (!suggestion) {
      return;
    }

    this.updateProfessionalSummary(suggestion);
    this.aiProfessionalSummarySuggestion.set('');
    this.isProfessionalSummaryAiActive.set(false);
    this.aiEnhanceErrorMessage.set(null);
    this.aiEnhanceState.set('success');
    this.markUnsavedChanges();
  }

  protected updateProfessionalSummary(summary: string): void {
    this.editProfessionalSummary = summary;
    this.markUnsavedChanges();
  }

  protected updateExperienceField(index: number, field: keyof WorkExperienceEditItem, value: string): void {
    this.editWorkExperience = this.editWorkExperience.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item,
    );
    this.markUnsavedChanges();
  }

  protected updateEducationField(index: number, field: keyof EducationEditItem, value: string): void {
    this.editEducation = this.editEducation.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item,
    );
    this.markUnsavedChanges();
  }

  protected updateCourseField(index: number, field: keyof CourseEditItem, value: string): void {
    this.editCourses = this.editCourses.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item,
    );
    this.markUnsavedChanges();
  }

  protected updateCertificationField(index: number, field: keyof CertificationEditItem, value: string): void {
    this.editCertifications = this.editCertifications.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item,
    );
    this.markUnsavedChanges();
  }

  protected removeSuggestedSkill(skill: string): void {
    this.setHardSkills(this.hardSkillChips().filter((item) => item !== skill));
    this.markUnsavedChanges();
  }

  protected addSkillFromInput(): void {
    const skills = this.toChipList(this.newSkill);

    if (skills.length === 0) {
      return;
    }

    this.setHardSkills([...this.hardSkillChips(), ...skills]);
    this.newSkill = '';
    this.markUnsavedChanges();
  }

  protected handleSkillInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ',') {
      return;
    }

    event.preventDefault();
    this.addSkillFromInput();
  }

  private setHardSkills(skills: string[]): void {
    this.editHardSkills = this.uniqueLines(skills).join('\n');
    this.markUnsavedChanges();
  }

  protected removeLanguage(language: string): void {
    this.setLanguages(this.languageChips().filter((item) => item !== language));
  }

  protected addLanguageFromInput(): void {
    const languages = this.toChipList(this.newLanguage);

    if (languages.length === 0) {
      return;
    }

    this.setLanguages([...this.languageChips(), ...languages]);
    this.newLanguage = '';
  }

  protected handleLanguageInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ',') {
      return;
    }

    event.preventDefault();
    this.addLanguageFromInput();
  }

  private setLanguages(languages: string[]): void {
    this.editLanguages = this.uniqueLines(languages).join('\n');
    this.markUnsavedChanges();
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
            this.previewResumeById(response.id, [this.activeTemplateId()]);
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
      this.previewResumeById(editedResumeId, [this.activeTemplateId()]);
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
    this.markUnsavedChanges();
  }

  protected removeWorkExperience(index: number): void {
    this.editWorkExperience.splice(index, 1);
    this.markUnsavedChanges();
    this.aiWorkSummarySuggestion.update((suggestion) => {
      if (!suggestion) {
        return null;
      }

      if (suggestion.index === index) {
        return null;
      }

      return suggestion.index > index ? { ...suggestion, index: suggestion.index - 1 } : suggestion;
    });
    this.pendingAiWorkSummaryIndex.update((pendingIndex) => {
      if (pendingIndex === null) {
        return null;
      }

      if (pendingIndex === index) {
        return null;
      }

      return pendingIndex > index ? pendingIndex - 1 : pendingIndex;
    });
    this.collapsedWorkExperienceIndexes.update((indexes) => {
      const nextIndexes = new Set<number>();

      indexes.forEach((collapsedIndex) => {
        if (collapsedIndex < index) {
          nextIndexes.add(collapsedIndex);
        } else if (collapsedIndex > index) {
          nextIndexes.add(collapsedIndex - 1);
        }
      });

      return nextIndexes;
    });
    this.collapsedCourseIndexes.update((indexes) => {
      const nextIndexes = new Set<number>();

      indexes.forEach((collapsedIndex) => {
        if (collapsedIndex < index) {
          nextIndexes.add(collapsedIndex);
        } else if (collapsedIndex > index) {
          nextIndexes.add(collapsedIndex - 1);
        }
      });

      return nextIndexes;
    });
  }

  protected addEducation(): void {
    this.editEducation.push({
      degree: '',
      majorOrFieldOfStudy: '',
      institution: '',
      location: '',
      startDate: '',
      endDate: '',
    });
    this.markUnsavedChanges();
  }

  protected removeEducation(index: number): void {
    this.editEducation.splice(index, 1);
    this.markUnsavedChanges();
  }

  protected addCourse(): void {
    this.editCourses.push({
      course: '',
      institution: '',
      startDate: '',
      endDate: '',
    });
    this.markUnsavedChanges();
  }

  protected removeCourse(index: number): void {
    this.editCourses.splice(index, 1);
    this.markUnsavedChanges();
  }

  protected addCertification(): void {
    this.editCertifications.push({
      name: '',
      issuer: '',
      year: '',
    });
    this.markUnsavedChanges();
  }

  protected removeCertification(index: number): void {
    this.editCertifications.splice(index, 1);
    this.markUnsavedChanges();
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

  protected previewResume(templateIds = [this.activeTemplateId()], options: PreviewOptions = {}): void {
    const resumeId = this.resumeId.trim();

    if (!resumeId || templateIds.length === 0 || this.previewState() === 'loading') {
      return;
    }

    this.previewState.set('loading');
    this.previewErrorMessage.set(null);

    if (!options.preserveCurrentPreview) {
      this.previewResponse.set(null);
    }

    this.resumeApi
      .previewResume({
        resumeId,
        templateId: templateIds[0],
        templateIds,
      })
      .pipe(finalize(() => this.previewState.update((state) => (state === 'loading' ? 'idle' : state))))
      .subscribe({
        next: (response) => {
          const activeTemplate = response.templates[0];

          this.previewResponse.set(response);
          this.populateEditFormFromPreviewData(
            response.data ?? activeTemplate?.data,
            response.html || activeTemplate?.html || '',
          );
          this.activeTemplateIndex.set(0);
          this.previewState.set('success');
        },
        error: (error) => {
          this.previewErrorMessage.set(this.resolveErrorMessage(error, 'preview'));
          this.previewState.set('error');
        },
      });
  }

  private previewResumeById(
    resumeId: string,
    templateIds = [this.activeTemplateId()],
    options: PreviewOptions = {},
  ): void {
    this.resumeId = resumeId;
    this.parsedResume.set(null);
    this.previewErrorMessage.set(null);
    this.previewState.set('idle');
    this.previewResume(templateIds, options);
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
    this.downloadPdfTemplate(this.activeTemplateId());
  }

  protected downloadActiveWord(): void {
    this.downloadWordTemplate(this.activeTemplateId());
  }

  private activeResumeId(): string {
    return this.resumeId.trim() || this.editingResume()?.id || this.selectedSavedResumeId() || '';
  }

  protected saveRenderedResume(): void {
    if (this.renderedSaveState() === 'saving') {
      return;
    }

    this.cancelAutoSave();

    const resumeId = this.activeResumeId();

    if (!resumeId) {
      this.previewErrorMessage.set('Unable to save template edits. Select or upload a resume first.');
      this.renderedSaveState.set('error');
      return;
    }

    this.renderedSaveState.set('saving');
    this.previewErrorMessage.set(null);

    const templateId = this.activeTemplateId();

    this.resumeApi
      .saveRenderedResume(resumeId, this.buildRenderedResumePayload(templateId))
      .pipe(finalize(() => this.renderedSaveState.update((state) => (state === 'saving' ? 'idle' : state))))
      .subscribe({
        next: (response) => {
          this.renderedSaveState.set('success');
          this.hasUnsavedChanges.set(false);
          this.savedIndicator.set(true);
          this.handleRenderedSaveResponse(response, resumeId, templateId);
        },
        error: (error) => {
          this.previewErrorMessage.set(this.resolveErrorMessage(error, 'edit'));
          this.renderedSaveState.set('error');
          this.hasUnsavedChanges.set(true);
        },
      });
  }

  private handleRenderedSaveResponse(
    response: unknown,
    fallbackResumeId: string,
    templateId = this.activeTemplateId(),
  ): void {
    const savedResumeId = this.extractSavedResumeId(response) || fallbackResumeId;
    const savedResume = this.asResumeDocument(response);
    const savedPreview = this.asRenderedPreviewResponse(response, savedResumeId, templateId);

    this.resumeId = savedResumeId;
    this.selectedSavedResumeId.set(savedResumeId);

    if (savedResume) {
      this.editingResume.set(savedResume);
    }

    this.loadSavedResumes();

    if (savedPreview) {
      const activeTemplate = savedPreview.templates[0];

      this.previewResponse.set(savedPreview);
      this.previewErrorMessage.set(null);
      this.activeTemplateIndex.set(0);
      this.previewState.set('success');
      this.populateEditFormFromPreviewData(
        savedPreview.data ?? activeTemplate?.data,
        savedPreview.html || activeTemplate?.html || '',
      );
      return;
    }

    this.previewResumeById(savedResumeId, [templateId], { preserveCurrentPreview: true });
  }

  private applyUploadedImageResponse(response: ResumeDocumentResponse, fallbackResumeId: string): void {
    const savedResumeId = response.id || fallbackResumeId;
    const avatar = this.extractAvatar(response);
    const mergedResume = this.mergeUploadedImageResponse(response, savedResumeId, avatar);

    this.resumeId = savedResumeId;
    this.selectedSavedResumeId.set(savedResumeId);
    this.editingResume.set(mergedResume);

    if (avatar) {
      this.editAvatar = avatar;
    }

    this.savedIndicator.set(true);
    this.hasUnsavedChanges.set(false);
    this.renderedSaveState.set('success');
    this.loadSavedResumes();
    this.previewResumeById(savedResumeId, [this.activeTemplateId()], { preserveCurrentPreview: true });
  }

  private mergeUploadedImageResponse(
    response: ResumeDocumentResponse,
    resumeId: string,
    avatar: string,
  ): ResumeDocumentResponse {
    const existingResume = this.editingResume();
    const existingProfile = this.asRecord(existingResume?.profile);
    const responseProfile = this.asRecord(response.profile);
    const existingData = this.asRecord(existingProfile['data']);
    const responseData = this.asRecord(responseProfile['data']);
    const existingCandidateProfile = this.asRecord(existingProfile['candidateProfile']);
    const responseCandidateProfile = this.asRecord(responseProfile['candidateProfile']);
    const resolvedAvatar = avatar || this.editAvatar || this.extractAvatar(existingResume);

    return {
      id: resumeId,
      profile: {
        ...existingProfile,
        ...responseProfile,
        data: {
          ...existingData,
          ...responseData,
          ...(resolvedAvatar ? { avatar: resolvedAvatar } : {}),
        },
        candidateProfile: {
          ...existingCandidateProfile,
          ...responseCandidateProfile,
          ...(resolvedAvatar ? { avatar: resolvedAvatar } : {}),
        },
      },
      metadata: {
        ...this.asRecord(existingResume?.metadata),
        ...this.asRecord(response.metadata),
      },
      source: {
        ...this.asRecord(existingResume?.source),
        ...this.asRecord(response.source),
      },
      createdAt: response.createdAt || existingResume?.createdAt || '',
      updatedAt: response.updatedAt || existingResume?.updatedAt || '',
    };
  }

  private extractSavedResumeId(value: unknown): string {
    const record = this.asRecord(value);
    const dataRecord = this.asRecord(record['data']);
    const mongoId = this.asRecord(record['_id']);
    const dataMongoId = this.asRecord(dataRecord['_id']);

    return (
      this.asString(record['id']) ||
      this.asString(record['resumeId']) ||
      this.asString(record['templateResumeId']) ||
      this.asString(mongoId['$oid']) ||
      this.asString(dataRecord['id']) ||
      this.asString(dataRecord['resumeId']) ||
      this.asString(dataRecord['templateResumeId']) ||
      this.asString(dataMongoId['$oid'])
    );
  }

  private extractAvatar(value: unknown): string {
    const record = this.asRecord(value);
    const dataRecord = this.asRecord(record['data']);
    const profile = this.asRecord(record['profile']);
    const profileData = this.asRecord(profile['data']);
    const profileDataData = this.asRecord(profileData['data']);
    const candidateProfile = this.asRecord(profile['candidateProfile']);
    const dataProfile = this.asRecord(dataRecord['profile']);
    const dataProfileData = this.asRecord(dataProfile['data']);
    const dataCandidateProfile = this.asRecord(dataProfile['candidateProfile']);

    return (
      this.asString(record['avatar']) ||
      this.asString(record['photo']) ||
      this.asString(record['imageUrl']) ||
      this.asString(dataRecord['avatar']) ||
      this.asString(dataRecord['photo']) ||
      this.asString(dataRecord['imageUrl']) ||
      this.asString(profile['avatar']) ||
      this.asString(profileData['avatar']) ||
      this.asString(profileDataData['avatar']) ||
      this.asString(candidateProfile['avatar']) ||
      this.asString(dataProfile['avatar']) ||
      this.asString(dataProfileData['avatar']) ||
      this.asString(dataCandidateProfile['avatar'])
    );
  }

  private activeTemplateId(): string {
    const preview = this.previewResponse();

    return (
      preview?.templates[this.activeTemplateIndex()]?.templateId ||
      preview?.templateId ||
      this.defaultTemplateIds[0]
    );
  }

  private asRenderedPreviewResponse(
    value: unknown,
    resumeId: string,
    fallbackTemplateId: string,
  ): ResumePreviewResponse | null {
    const record = this.asRecord(value);
    const dataRecord = this.asRecord(record['data']);
    const rawTemplates = this.asRecordArray(record['templates']).length
      ? this.asRecordArray(record['templates'])
      : this.asRecordArray(dataRecord['templates']);
    const templates = rawTemplates
      .map((template) => ({
        templateId:
          this.asString(template['templateId']) ||
          this.asString(template['template']) ||
          fallbackTemplateId,
        html: this.resolveRenderedHtml(template),
        data: template['data'] ?? dataRecord['data'] ?? record['data'],
      }))
      .filter((template) => template.html);
    const html = this.resolveRenderedHtml(record) || this.resolveRenderedHtml(dataRecord);

    if (!templates.length && html) {
      templates.push({
        templateId:
          this.asString(record['templateId']) ||
          this.asString(record['template']) ||
          this.asString(dataRecord['templateId']) ||
          this.asString(dataRecord['template']) ||
          fallbackTemplateId,
        html,
        data: this.resolveRenderedHtml(dataRecord) ? dataRecord['data'] : record['data'],
      });
    }

    if (!templates.length) {
      return null;
    }

    const activeTemplate = templates[0];

    return {
      resumeId,
      templateId: activeTemplate.templateId,
      html: activeTemplate.html,
      data: activeTemplate.data,
      templates,
    };
  }

  private resolveRenderedHtml(record: Record<string, unknown>): string {
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
    this.aiEnhanceErrorMessage.set(null);
    this.pendingAiWorkSummaryIndex.set(null);
    this.aiWorkSummarySuggestion.set(null);
    this.aiProfessionalSummarySuggestion.set('');
    this.isProfessionalSummaryAiActive.set(false);
    this.selectedSavedResumeId.set(null);
    this.isPreviewModalOpen.set(false);
    this.isEditModalOpen.set(false);
    this.activeTemplateIndex.set(0);
    this.uploadState.set('idle');
    this.clearUploadLoaderTimer();
    this.cancelAutoSave();
    this.previewState.set('idle');
    this.editState.set('idle');
    this.aiEnhanceState.set('idle');
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

  private improvePendingWorkSummary(index: number): void {
    if (this.aiEnhanceState() === 'loading') {
      return;
    }

    this.isProfessionalSummaryAiActive.set(false);
    const experience = this.editWorkExperience[index];
    const workSummary = experience?.responsibilities.trim() ?? '';
    this.pendingAiWorkSummaryIndex.set(index);

    if (!experience || !workSummary) {
      this.clearWorkSummarySuggestion(index);
      this.aiEnhanceState.set('error');
      this.aiEnhanceErrorMessage.set('Add work summary text before using Improve with AI.');
      return;
    }

    if (this.aiWorkSummarySuggestion()?.index !== index) {
      this.aiWorkSummarySuggestion.set(null);
    }

    this.aiEnhanceState.set('loading');
    this.aiEnhanceErrorMessage.set(null);

    this.resumeApi
      .rephraseResumeText(workSummary)
      .pipe(finalize(() => this.aiEnhanceState.update((state) => (state === 'loading' ? 'idle' : state))))
      .subscribe({
        next: (response) => {
          const improvedSummary = response.trim();

          if (!improvedSummary) {
            this.aiEnhanceState.set('error');
            this.aiEnhanceErrorMessage.set('AI could not improve this work summary. Please revise the text and try again.');
            return;
          }

          this.aiWorkSummarySuggestion.set({
            index,
            text: improvedSummary,
          });
          this.aiEnhanceErrorMessage.set(null);
          this.aiEnhanceState.set('success');
        },
        error: (error) => {
          this.aiEnhanceErrorMessage.set(this.resolveErrorMessage(error, 'ai'));
          this.aiEnhanceState.set('error');
        },
      });
  }

  private improvePendingProfessionalSummary(): void {
    if (this.aiEnhanceState() === 'loading') {
      return;
    }

    const professionalSummary = this.editProfessionalSummary.trim();
    this.isProfessionalSummaryAiActive.set(true);
    this.pendingAiWorkSummaryIndex.set(null);

    if (!professionalSummary) {
      this.aiProfessionalSummarySuggestion.set('');
      this.aiEnhanceState.set('error');
      this.aiEnhanceErrorMessage.set('Add professional summary text before using Improve with AI.');
      return;
    }

    this.aiEnhanceState.set('loading');
    this.aiEnhanceErrorMessage.set(null);

    this.resumeApi
      .rephraseResumeText(professionalSummary)
      .pipe(finalize(() => this.aiEnhanceState.update((state) => (state === 'loading' ? 'idle' : state))))
      .subscribe({
        next: (response) => {
          const improvedSummary = response.trim();

          if (!improvedSummary) {
            this.aiEnhanceState.set('error');
            this.aiEnhanceErrorMessage.set('AI could not improve this professional summary. Please revise the text and try again.');
            return;
          }

          this.aiProfessionalSummarySuggestion.set(improvedSummary);
          this.aiEnhanceErrorMessage.set(null);
          this.aiEnhanceState.set('success');
        },
        error: (error) => {
          this.aiEnhanceErrorMessage.set(this.resolveErrorMessage(error, 'ai'));
          this.aiEnhanceState.set('error');
        },
      });
  }

  private clearWorkSummarySuggestion(index?: number): void {
    const suggestion = this.aiWorkSummarySuggestion();

    if (index === undefined || suggestion?.index === index) {
      this.aiWorkSummarySuggestion.set(null);
    }
  }

  private resetAiEnhancementState(): void {
    this.aiEnhanceState.set('idle');
    this.aiEnhanceErrorMessage.set(null);
    this.pendingAiWorkSummaryIndex.set(null);
    this.aiWorkSummarySuggestion.set(null);
    this.aiProfessionalSummarySuggestion.set('');
    this.isProfessionalSummaryAiActive.set(false);
  }

  protected markUnsavedChanges(): void {
    if (this.renderedSaveState() === 'saving') {
      return;
    }

    this.hasUnsavedChanges.set(true);
    this.savedIndicator.set(false);
    this.renderedSaveState.set('idle');

    this.cancelAutoSave();
    this.autoSaveTimer = window.setTimeout(() => {
      this.autoSaveTimer = null;
      this.autoSaveIfNeeded();
    }, 1200);
  }

  private cancelAutoSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private autoSaveIfNeeded(): void {
    if (!this.hasUnsavedChanges() || this.renderedSaveState() === 'saving') {
      return;
    }

    this.saveRenderedResume();
  }

  private advanceEditorStep(): void {
    const nextStep = this.editorSteps[Math.min(this.activeStepIndex() + 1, this.editorSteps.length - 1)];
    this.activeEditorStep.set(nextStep.id);
    this.savedIndicator.set(true);
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
    this.markUnsavedChanges();
  }

  protected updateLastName(value: string): void {
    this.editCandidateName = [this.firstName(), value.trim()].filter(Boolean).join(' ');
    this.markUnsavedChanges();
  }

  private resolveStepHeading(step: EditorStepId): string {
    const headings: Record<EditorStepId, string> = {
      personal: 'Personal details',
      contact: 'Contact information',
      experience: 'Work experience',
      skills: 'Skills',
      education: 'Education',
      courses: 'Courses and training',
      languages: 'Languages',
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
      courses: 'Use this section to capture training, coursework, and professional development that supports your goals.',
      languages: 'Add the languages you can use professionally.',
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

  private buildRenderedResumePayload(templateId: string): RenderedResumeSaveRequest {
    const editingResume = this.editingResume();
    const data = this.buildRenderedResumeData();
    const source = this.asRecord(editingResume?.source);
    const avatar = this.asString(data['avatar']);

    return {
      resumeId: this.resumeId.trim(),
      template: templateId,
      templateId,
      format: 'html',
      data,
      profile: {
        ...this.asRecord(editingResume?.profile),
        data,
      },
      metadata: this.asRecord(editingResume?.metadata),
      source: {
        ...source,
        jobDescription: this.editJobDescription.trim() || source['jobDescription'] || null,
      },
      font: 'Arial',
      color: '#000000',
      withPhoto: Boolean(avatar),
      avatar,
      contactsTitle: 'Contacts',
      detailsTitle: 'Details',
    };
  }

  private buildRenderedResumeData(): Record<string, unknown> {
    const baseData = this.currentRenderedData();
    const summary = this.editProfessionalSummary.trim() || this.editProfessionalHeadline.trim();
    const avatar = this.editAvatar || this.asString(baseData['avatar']);

    return {
      ...baseData,
      name: this.editCandidateName.trim(),
      title: this.editCurrentTitle.trim(),
      location: this.editCandidateLocation.trim(),
      phone: this.editCandidatePhone.trim(),
      email: this.editCandidateEmail.trim(),
      summary,
      dateOfBirth: baseData['dateOfBirth'] ?? '',
      gender: baseData['gender'] ?? '',
      nationality: baseData['nationality'] ?? '',
      documentDate: baseData['documentDate'] ?? '',
      address: this.editIndustry.trim(),
      postalCode: this.editSpecialization.trim(),
      secondaryAddress: baseData['secondaryAddress'] ?? null,
      avatar,
      sections: this.buildRenderedSections(baseData, summary),
    };
  }

  private currentRenderedData(): Record<string, unknown> {
    const preview = this.previewResponse();
    const activeTemplate = preview?.templates[this.activeTemplateIndex()];

    return (
      this.resolveRenderedProfileData(activeTemplate?.data) ||
      this.resolveRenderedProfileData(preview?.data) ||
      this.resolveRenderedProfileData(this.editingResume()) ||
      {}
    );
  }

  private buildRenderedSections(baseData: Record<string, unknown>, summary: string): Record<string, unknown>[] {
    const existingSections = this.asRecordArray(baseData['sections']);
    const existingExperienceItems = this.asRecordArray(
      this.findRenderedSectionIn(existingSections, ...this.renderedExperienceAliases())?.['items'],
    );
    const existingEducationItems = this.asRecordArray(this.findRenderedSectionIn(existingSections, 'education')?.['items']);
    const existingSkillItems = this.asRecordArray(
      this.findRenderedSectionIn(existingSections, 'skill', 'skills')?.['items'],
    );
    const existingCourseItems = this.asRecordArray(
      this.findRenderedSectionIn(existingSections, 'course', 'courses')?.['items'],
    );
    const existingLanguageItems = this.asRecordArray(
      this.findRenderedSectionIn(existingSections, 'language', 'languages')?.['items'],
    );
    const existingCertificationItems = this.asRecordArray(
      this.findRenderedSectionIn(existingSections, 'certification', 'certifications')?.['items'],
    );
    const skillItems = this.uniqueLines([
      ...this.toChipList(this.editHardSkills),
      ...this.toChipList(this.editToolsAndSoftware),
      ...this.toChipList(this.editMethodologies),
      ...this.toChipList(this.editSoftSkills),
    ]).map((skill) => ({
      ...this.findRenderedSkillItem(existingSkillItems, skill),
      name: skill,
      level: this.asString(this.findRenderedSkillItem(existingSkillItems, skill)['level']),
    }));
    const languageItems = this.uniqueLines(this.toChipList(this.editLanguages)).map((language) => ({
      ...this.findRenderedLanguageItem(existingLanguageItems, language),
      language,
      level: this.asString(this.findRenderedLanguageItem(existingLanguageItems, language)['level']),
    }));
    const knownTypes = new Set(
      [
        'summary',
        ...this.renderedExperienceAliases(),
        'education',
        'skill',
        'skills',
        'course',
        'courses',
        'language',
        'languages',
        'certification',
        'certifications',
      ].map((type) => this.normalizeSectionKey(type)),
    );

    return [
      this.mergeRenderedSection(existingSections, ['summary'], {
        title: 'Professional summary',
        type: 'summary',
        items: summary,
      }),
      this.mergeRenderedSection(existingSections, this.renderedExperienceAliases(), {
        title: 'Work experience',
        type: 'experience',
        items: this.editWorkExperience.map((experience, index) => {
          const responsibilities = this.toLines(experience.responsibilities);
          const achievements = this.uniqueLines([
            ...responsibilities,
            ...this.toLines(experience.achievements),
          ]);

          return {
            ...(existingExperienceItems[index] ?? {}),
            position: experience.role.trim(),
            company: experience.companyOrOrganization.trim(),
            location: experience.location.trim(),
            jobType: this.asString(existingExperienceItems[index]?.['jobType']),
            reasonForLeaving: this.asString(existingExperienceItems[index]?.['reasonForLeaving']),
            start: experience.startDate.trim(),
            end: experience.endDate.trim(),
            responsibilities,
            achievements,
          };
        }),
      }),
      this.mergeRenderedSection(existingSections, ['education'], {
        title: 'Education',
        type: 'education',
        items: this.editEducation.map((education, index) => ({
          ...(existingEducationItems[index] ?? {}),
          degree: education.degree.trim(),
          school: education.institution.trim(),
          faculty: this.asString(existingEducationItems[index]?.['faculty']),
          department: education.majorOrFieldOfStudy.trim(),
          location: education.location.trim(),
          years: this.formatEducationYears(education.startDate, education.endDate),
          start: education.startDate.trim(),
          end: education.endDate.trim(),
          highlights: existingEducationItems[index]?.['highlights'] ?? [],
        })),
      }),
      this.mergeRenderedSection(existingSections, ['skill', 'skills'], {
        title: 'Skills',
        type: 'skill',
        items: skillItems,
      }),
      this.mergeRenderedSection(existingSections, ['course', 'courses'], {
        title: 'Courses',
        type: 'course',
        items: this.editCourses.map((course, index) => ({
          ...(existingCourseItems[index] ?? {}),
          course: course.course.trim(),
          institution: course.institution.trim(),
          start: course.startDate.trim(),
          end: course.endDate.trim(),
        })),
      }),
      this.mergeRenderedSection(existingSections, ['language', 'languages'], {
        title: 'Languages',
        type: 'language',
        items: languageItems,
      }),
      this.mergeRenderedSection(existingSections, ['certification', 'certifications'], {
        title: 'Certifications',
        type: 'certification',
        items: this.editCertifications.map((certification, index) => ({
          ...(existingCertificationItems[index] ?? {}),
          name: certification.name.trim(),
          issuer: certification.issuer.trim(),
          year: certification.year.trim(),
        })),
      }),
      ...existingSections.filter((section) => !this.isKnownRenderedSection(section, knownTypes)),
    ];
  }

  private isKnownRenderedSection(section: Record<string, unknown>, knownTypes: Set<string>): boolean {
    return [
      this.asString(section['type']),
      this.asString(section['title']),
      this.asString(section['name']),
      this.asString(section['heading']),
    ].some((value) => knownTypes.has(this.normalizeSectionKey(value)));
  }

  private mergeRenderedSection(
    existingSections: Record<string, unknown>[],
    types: string[],
    section: Record<string, unknown>,
  ): Record<string, unknown> {
    const existing = this.findRenderedSectionIn(existingSections, ...types) ?? {};

    return {
      ...existing,
      title: this.asString(existing['title']) || section['title'],
      type: this.asString(existing['type']) || section['type'],
      items: section['items'],
    };
  }

  private findRenderedSkillItem(items: Record<string, unknown>[], skill: string): Record<string, unknown> {
    const normalizedSkill = skill.trim().toLowerCase();

    return (
      items.find((item) => {
        const itemName = this.asString(item['name']) || this.asString(item['skill']) || this.asString(item['title']);
        return itemName.trim().toLowerCase() === normalizedSkill;
      }) ?? {}
    );
  }

  private findRenderedLanguageItem(items: Record<string, unknown>[], language: string): Record<string, unknown> {
    const normalizedLanguage = language.trim().toLowerCase();

    return (
      items.find((item) => {
        const itemLanguage =
          this.asString(item['language']) ||
          this.asString(item['name']) ||
          this.asString(item['title']);
        return itemLanguage.trim().toLowerCase() === normalizedLanguage;
      }) ?? {}
    );
  }

  private formatEducationYears(startDate: string, endDate: string): string {
    const start = startDate.trim();
    const end = endDate.trim();

    if (start && end) {
      return start === end ? end : `${start} - ${end}`;
    }

    return start || end;
  }

  private extractEducationYearRange(item: Record<string, unknown>): { start: string; end: string } {
    const years = this.asString(item['years']);
    const [start, end] = years.split(/\s*(?:-|to|–|—)\s*/i).map((value) => value?.trim() ?? '');

    return {
      start: start || '',
      end: end || '',
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

  private populateEditFormFromPreviewData(value: unknown, previewHtml = ''): void {
    const resume = this.asResumeDocument(value);

    if (resume) {
      this.editingResume.set(resume);
      this.populateEditForm(resume);
    } else {
      const renderedData = this.resolveRenderedProfileData(value);

      if (renderedData) {
        this.populateRenderedEditForm(renderedData, null);
      }
    }

    this.populateWorkExperienceFromPreviewHtml(previewHtml);
  }

  private asResumeDocument(value: unknown): ResumeDocumentResponse | null {
    const record = this.asRecord(value);
    const profile = this.asRecord(record['profile']);

    if (Object.keys(profile).length === 0) {
      return null;
    }

    return {
      id: this.asString(record['id']) || this.asString(record['resumeId']) || this.resumeId,
      profile: profile as ResumeDocumentResponse['profile'],
      metadata: this.asRecord(record['metadata']),
      source: this.asRecord(record['source']),
      createdAt: this.asString(record['createdAt']),
      updatedAt: this.asString(record['updatedAt']),
    };
  }

  private resolveRenderedProfileData(value: unknown): Record<string, unknown> | null {
    const record = this.asRecord(value);
    const profile = this.asRecord(record['profile']);
    const profileData = this.asRecord(profile['data']);

    if (this.hasRenderedProfileData(profileData)) {
      return profileData;
    }

    const directData = this.asRecord(record['data']);

    if (this.hasRenderedProfileData(directData)) {
      return directData;
    }

    if (this.hasRenderedProfileData(record)) {
      return record;
    }

    return null;
  }

  private hasRenderedProfileData(data: Record<string, unknown>): boolean {
    return Boolean(
      this.asString(data['name']) ||
        this.asString(data['title']) ||
        this.asString(data['email']) ||
        this.asString(data['avatar']) ||
        this.asRecordArray(data['sections']).length,
    );
  }

  private populateEditForm(resume: ResumeDocumentResponse): void {
    this.resetAiEnhancementState();

    const renderedData = this.asRecord(resume.profile['data']);

    if (this.hasRenderedProfileData(renderedData)) {
      this.populateRenderedEditForm(renderedData, resume);
      return;
    }

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
    this.editAvatar = this.extractAvatar(resume);
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
    this.resetWorkExperienceCollapseState();
    this.editEducation = this.asRecordArray(resume.profile['education']).map((item) => ({
      degree: this.asString(item['degree']),
      majorOrFieldOfStudy: this.asString(item['majorOrFieldOfStudy']),
      institution: this.asString(item['institution']),
      location: this.asString(item['location']),
      startDate: this.asString(item['startDate']),
      endDate: this.asString(item['endDate']),
    }));
    this.editCertifications = this.asRecordArray(resume.profile['certificationsAndLicenses']).map((item) => ({
      name: this.asString(item['name']),
      issuer: this.asString(item['issuer']),
      year: this.asEditableNumber(item['year']),
    }));
  }

  private populateRenderedEditForm(data: Record<string, unknown>, resume: ResumeDocumentResponse | null): void {
    this.resetAiEnhancementState();

    const source = this.asRecord(resume?.source);
    const summarySection = this.findRenderedSection(data, 'summary');
    const experienceSection = this.findRenderedSection(data, ...this.renderedExperienceAliases());
    const educationSection = this.findRenderedSection(data, 'education');
    const skillSection = this.findRenderedSection(data, 'skill', 'skills');
    const courseSection = this.findRenderedSection(data, 'course', 'courses');
    const languageSection = this.findRenderedSection(data, 'language', 'languages');
    const certificationSection = this.findRenderedSection(data, 'certification', 'certifications');
    const summary = this.asEditableText(summarySection?.['items']) || this.asString(data['summary']);

    this.editCandidateName = this.asString(data['name']);
    this.editCandidateEmail = this.asString(data['email']);
    this.editCandidatePhone = this.asString(data['phone']);
    this.editCandidateLocation = this.asString(data['location']);
    this.editCurrentTitle = this.asString(data['title']);
    this.editProfessionalHeadline = summary;
    this.editAvatar = this.extractAvatar(data) || this.extractAvatar(resume);
    this.editTotalExperienceYears = '';
    this.editCareerLevel = '';
    this.editIndustry = this.asString(data['address']);
    this.editSpecialization = this.asString(data['postalCode']);
    this.editIndustryFocus = '';
    this.editPrimarySpecialization = '';
    this.editSecondarySpecialization = '';
    this.editJobDescription = this.asString(source['jobDescription']);
    this.editProfessionalSummary = summary;
    this.editTechnicalHighlights = '';
    this.editLeadershipHighlights = '';
    this.editProjectHighlights = '';
    this.editIndustryHighlights = '';
    this.editHardSkills = this.uniqueLines(this.extractRenderedSkillNames(skillSection?.['items'])).join('\n');
    this.editToolsAndSoftware = '';
    this.editMethodologies = '';
    this.editSoftSkills = '';
    this.editLanguages = this.uniqueLines([
      ...this.extractRenderedLanguageNames(languageSection?.['items']),
      ...this.extractRenderedLanguageNames(data['languages']),
      ...this.extractRenderedLanguageNames(data['language']),
    ]).join('\n');
    this.editWorkExperience = this.resolveRenderedExperienceItems(data, experienceSection).map((item) => {
      const responsibilities =
        this.asEditableText(item['responsibilities']) ||
        this.asEditableText(item['responsibility']) ||
        this.asEditableText(item['description']) ||
        this.asEditableText(item['details']) ||
        this.asEditableText(item['bullets']) ||
        this.asEditableText(item['highlights']);
      const achievements =
        this.asEditableText(item['achievements']) ||
        this.asEditableText(item['achievement']) ||
        this.asEditableText(item['accomplishments']) ||
        this.asEditableText(item['accomplishment']);

      return {
        companyOrOrganization:
          this.asString(item['company']) ||
          this.asString(item['companyOrOrganization']) ||
          this.asString(item['employer']) ||
          this.asString(item['organization']) ||
          this.asString(item['organisation']),
        role:
          this.asString(item['position']) ||
          this.asString(item['role']) ||
          this.asString(item['jobTitle']) ||
          this.asString(item['title']) ||
          this.asString(item['designation']),
        location: this.asString(item['location']),
        startDate: this.asString(item['start']) || this.asString(item['startDate']) || this.asString(item['from']),
        endDate: this.asString(item['end']) || this.asString(item['endDate']) || this.asString(item['to']),
        responsibilities: responsibilities || achievements,
        achievements: responsibilities ? achievements : '',
      };
    });
    this.resetWorkExperienceCollapseState();
    this.resetCourseCollapseState();
    this.editEducation = this.asRecordArray(educationSection?.['items']).map((item) => ({
      degree: this.asString(item['degree']) || this.asString(item['title']),
      majorOrFieldOfStudy:
        this.asString(item['department']) ||
        this.asString(item['faculty']) ||
        this.asString(item['major']) ||
        this.asString(item['fieldOfStudy']),
      institution: this.asString(item['school']) || this.asString(item['institution']) || this.asString(item['college']),
      location: this.asString(item['location']),
      startDate: this.asString(item['start']) || this.asString(item['startDate']) || this.extractEducationYearRange(item).start,
      endDate:
        this.asString(item['end']) ||
        this.asString(item['endDate']) ||
        this.extractEducationYearRange(item).end ||
        this.asString(item['years']),
    }));
    this.editCourses = this.asRecordArray(courseSection?.['items']).map((item) => ({
      course: this.asString(item['course']) || this.asString(item['name']) || this.asString(item['title']),
      institution: this.asString(item['institution']) || this.asString(item['issuer']),
      startDate: this.asString(item['start']) || this.asString(item['startDate']) || '',
      endDate: this.asString(item['end']) || this.asString(item['endDate']) || this.asEditableNumber(item['year']),
    }));

    this.editCertifications = this.asRecordArray(certificationSection?.['items']).map((item) => ({
      name: this.asString(item['name']) || this.asString(item['course']),
      issuer: this.asString(item['issuer']) || this.asString(item['institution']),
      year: this.asString(item['year']) || this.asString(item['end']),
    }));
  }

  private populateWorkExperienceFromPreviewHtml(previewHtml: string): void {
    if (this.hasUsableWorkExperience() || !previewHtml.trim()) {
      return;
    }

    const extractedItems = this.extractRenderedExperienceFromHtml(previewHtml);

    if (extractedItems.length) {
      this.editWorkExperience = extractedItems;
      this.resetWorkExperienceCollapseState();
    }
  }

  private resetWorkExperienceCollapseState(): void {
    this.collapsedWorkExperienceIndexes.set(new Set());
  }

  private resetEducationCollapseState(): void {
    this.collapsedEducationIndexes.set(new Set());
  }

  private resetCourseCollapseState(): void {
    this.collapsedCourseIndexes.set(new Set());
  }

  private hasUsableWorkExperience(): boolean {
    return this.editWorkExperience.some((item) =>
      Boolean(
        item.companyOrOrganization.trim() ||
          item.role.trim() ||
          item.location.trim() ||
          item.responsibilities.trim() ||
          item.achievements.trim(),
      ),
    );
  }

  private extractRenderedExperienceFromHtml(html: string): WorkExperienceEditItem[] {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(html, 'text/html');
    const blocks = this.collectRenderedTextBlocks(documentNode.body);
    const startIndex = blocks.findIndex((block) => this.isRenderedExperienceHeading(block.text));

    if (startIndex < 0) {
      return [];
    }

    const sectionBlocks: RenderedTextBlock[] = [];

    for (const block of blocks.slice(startIndex + 1)) {
      if (this.isRenderedSectionBoundary(block)) {
        break;
      }

      if (block.text) {
        sectionBlocks.push(block);
      }
    }

    return this.parseExperienceBlocks(sectionBlocks);
  }

  private collectRenderedTextBlocks(root: Element): RenderedTextBlock[] {
    const blocks: RenderedTextBlock[] = [];
    const visit = (element: Element): void => {
      const tagName = element.tagName.toUpperCase();

      if (tagName === 'SCRIPT' || tagName === 'STYLE') {
        return;
      }

      const text = this.cleanRenderedText(element.textContent || '');
      const isBullet = tagName === 'LI';
      const isHeading = /^H[1-6]$/.test(tagName);
      const hasBlockChildren = Array.from(element.children).some((child) => this.isRenderedBlockElement(child));

      if ((isBullet || isHeading || !hasBlockChildren) && text) {
        blocks.push({
          text,
          tagName,
          isBullet,
        });
        return;
      }

      Array.from(element.children).forEach((child) => visit(child));
    };

    Array.from(root.children).forEach((child) => visit(child));
    return blocks;
  }

  private isRenderedBlockElement(element: Element): boolean {
    return /^(ARTICLE|ASIDE|DD|DIV|DL|DT|FOOTER|H[1-6]|HEADER|LI|MAIN|OL|P|SECTION|TABLE|TBODY|TD|TH|THEAD|TR|UL)$/i.test(
      element.tagName,
    );
  }

  private isRenderedExperienceHeading(value: string): boolean {
    return this.renderedExperienceAliases().some(
      (alias) => this.normalizeSectionKey(value) === this.normalizeSectionKey(alias),
    );
  }

  private isRenderedSectionBoundary(block: RenderedTextBlock): boolean {
    const key = this.normalizeSectionKey(block.text);
    const boundaryKeys = [
      'education',
      'skills',
      'technicalskills',
      'coreskills',
      'summary',
      'professionalsummary',
      'projects',
      'certifications',
      'courses',
      'languages',
      'language',
      'licenses',
      'contact',
      'contacts',
    ];

    return block.tagName.match(/^H[1-6]$/) !== null && boundaryKeys.includes(key);
  }

  private parseExperienceBlocks(blocks: RenderedTextBlock[]): WorkExperienceEditItem[] {
    const items: WorkExperienceEditItem[] = [];
    let current: WorkExperienceEditItem | null = null;

    const pushCurrent = (): void => {
      if (current && this.isUsableWorkExperienceItem(current)) {
        items.push(current);
      }
    };

    blocks.forEach((block) => {
      const parsedLine = this.parseExperienceLine(block.text);
      const line = parsedLine.text;

      if (!line && !parsedLine.startDate && !parsedLine.endDate) {
        return;
      }

      if (!current) {
        current = this.emptyWorkExperienceItem();
      }

      if (parsedLine.startDate || parsedLine.endDate) {
        current.startDate ||= parsedLine.startDate;
        current.endDate ||= parsedLine.endDate;
      }

      if (!line) {
        return;
      }

      if (block.isBullet || this.shouldTreatRenderedLineAsBullet(line, current)) {
        current.responsibilities = this.appendEditableLine(current.responsibilities, line);
        return;
      }

      if (current.role && current.companyOrOrganization && current.responsibilities) {
        pushCurrent();
        current = this.emptyWorkExperienceItem();
      }

      if (!current.role) {
        current.role = line;
        return;
      }

      if (!current.companyOrOrganization) {
        const organization = this.parseRenderedOrganizationLine(line);
        current.companyOrOrganization = organization.company;
        current.location = organization.location;
        return;
      }

      current.responsibilities = this.appendEditableLine(current.responsibilities, line);
    });

    pushCurrent();
    return items;
  }

  private parseExperienceLine(value: string): { text: string; startDate: string; endDate: string } {
    const datePattern =
      /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*'?\d{2,4}|\d{4}|present|current)\s*(?:-|–|—|to)\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*'?\d{2,4}|\d{4}|present|current)?/i;
    const match = value.match(datePattern);

    if (!match) {
      return {
        text: this.cleanRenderedText(value.replace(/^[•*-]\s*/, '')),
        startDate: '',
        endDate: '',
      };
    }

    return {
      text: this.cleanRenderedText(value.replace(match[0], '').replace(/^[•*-]\s*/, '')),
      startDate: this.cleanRenderedText(match[1] || ''),
      endDate: this.cleanRenderedText(match[2] || ''),
    };
  }

  private parseRenderedOrganizationLine(value: string): { company: string; location: string } {
    const [company, ...locationParts] = value.split(/\s+-\s+/);

    return {
      company: this.cleanRenderedText(company || value),
      location: this.cleanRenderedText(locationParts.join(' - ')),
    };
  }

  private shouldTreatRenderedLineAsBullet(line: string, current: WorkExperienceEditItem): boolean {
    return Boolean(current.role && current.companyOrOrganization && (line.length > 60 || current.responsibilities));
  }

  private appendEditableLine(value: string, line: string): string {
    const cleanedLine = this.cleanRenderedText(line);

    if (!cleanedLine) {
      return value;
    }

    return value ? `${value}\n${cleanedLine}` : cleanedLine;
  }

  private emptyWorkExperienceItem(): WorkExperienceEditItem {
    return {
      companyOrOrganization: '',
      role: '',
      location: '',
      startDate: '',
      endDate: '',
      responsibilities: '',
      achievements: '',
    };
  }

  private isUsableWorkExperienceItem(item: WorkExperienceEditItem): boolean {
    return Boolean(
      item.role.trim() ||
        item.companyOrOrganization.trim() ||
        item.location.trim() ||
        item.responsibilities.trim() ||
        item.achievements.trim(),
    );
  }

  private cleanRenderedText(value: string): string {
    return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private findRenderedSection(data: Record<string, unknown>, ...types: string[]): Record<string, unknown> | null {
    return this.findRenderedSectionIn(this.asRecordArray(data['sections']), ...types);
  }

  private findRenderedSectionIn(sections: Record<string, unknown>[], ...types: string[]): Record<string, unknown> | null {
    const normalizedTypes = new Set(types.map((type) => this.normalizeSectionKey(type)));

    return (
      sections.find((section) =>
        [
          this.asString(section['type']),
          this.asString(section['title']),
          this.asString(section['name']),
          this.asString(section['heading']),
        ].some((value) => normalizedTypes.has(this.normalizeSectionKey(value))),
      ) ?? null
    );
  }

  private renderedExperienceAliases(): string[] {
    return [
      'experience',
      'experiences',
      'workExperience',
      'work_experience',
      'work-experience',
      'work experience',
      'professionalExperience',
      'professional_experience',
      'professional-experience',
      'professional experience',
      'professionalExperienceSection',
      'employment',
      'employmentHistory',
      'employment_history',
      'employment-history',
      'employment history',
      'careerHistory',
      'career_history',
      'career-history',
      'career history',
    ];
  }

  private resolveRenderedExperienceItems(
    data: Record<string, unknown>,
    section: Record<string, unknown> | null,
  ): Record<string, unknown>[] {
    const sectionItems = this.resolveRenderedItems(section);

    if (sectionItems.length) {
      return sectionItems;
    }

    for (const key of this.renderedExperienceAliases()) {
      const items = this.resolveRenderedItems(data[key]);

      if (items.length) {
        return items;
      }
    }

    return [];
  }

  private resolveRenderedItems(value: unknown): Record<string, unknown>[] {
    const directItems = this.asRecordArray(value);

    if (directItems.length) {
      return directItems;
    }

    const record = this.asRecord(value);

    return (
      this.asRecordArray(record['items']).length
        ? this.asRecordArray(record['items'])
        : this.asRecordArray(record['entries']).length
          ? this.asRecordArray(record['entries'])
          : this.asRecordArray(record['children']).length
            ? this.asRecordArray(record['children'])
            : this.asRecordArray(record['values']).length
              ? this.asRecordArray(record['values'])
              : this.asRecordArray(record['content']).length
                ? this.asRecordArray(record['content'])
                : this.asRecordArray(record['list'])
    );
  }

  private normalizeSectionKey(value: string): string {
    return value.trim().replace(/[^a-z0-9]+/gi, '').toLowerCase();
  }

  private asEditableText(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (!Array.isArray(value)) {
      return '';
    }

    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        const record = this.asRecord(item);
        return (
          this.asString(record['text']) ||
          this.asString(record['description']) ||
          this.asString(record['name']) ||
          this.asString(record['title'])
        );
      })
      .filter(Boolean)
      .join('\n');
  }

  private extractRenderedSkillNames(value: unknown): string[] {
    if (typeof value === 'string') {
      return this.toChipList(value);
    }

    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        const record = this.asRecord(item);
        return this.asString(record['name']) || this.asString(record['skill']) || this.asString(record['title']);
      })
      .filter(Boolean);
  }

  private extractRenderedLanguageNames(value: unknown): string[] {
    if (typeof value === 'string') {
      return this.toChipList(value);
    }

    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        const record = this.asRecord(item);
        return this.asString(record['language']) || this.asString(record['name']) || this.asString(record['title']);
      })
      .filter(Boolean);
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
      avatar: this.editAvatar || null,
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
      startDate: edited.startDate.trim() || null,
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

    profile['courses'] = this.mergeRecordArray(profile['courses'], this.editCourses, (original, edited) => ({
      ...original,
      course: edited.course.trim(),
      institution: edited.institution.trim() || null,
      startDate: edited.startDate.trim() || null,
      endDate: edited.endDate.trim() || null,
    }));

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
      <style id="careerkit-preview-frame-style">
        html,
        body {
          margin: 0 !important;
          min-height: 0 !important;
          overflow: hidden !important;
          background: #ffffff;
        }
      </style>
    `;

    if (/<html[\s>]/i.test(html)) {
      const parser = new DOMParser();
      const documentNode = parser.parseFromString(html, 'text/html');

      if (!documentNode.head.querySelector('base')) {
        const base = documentNode.createElement('base');
        base.target = '_blank';
        documentNode.head.prepend(base);
      }

      if (!documentNode.head.querySelector('#careerkit-preview-frame-style')) {
        documentNode.head.insertAdjacentHTML('beforeend', previewFrameStyle);
      }

      return `<!doctype html>${documentNode.documentElement.outerHTML}`;
    }

    return [
      '<!doctype html><html><head><base target="_blank">',
      previewFrameStyle,
      '</head><body>',
      html,
      '</body></html>',
    ].join('');
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
    action: 'upload' | 'preview' | 'saved' | 'edit' | 'ai' | 'image' = 'upload',
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

    if (action === 'ai') {
      return 'Unable to improve the resume text. Please check the API gateway and parser route, then try again.';
    }

    if (action === 'image') {
      return 'Unable to upload the resume photo. Please check the API gateway and parser route, then try again.';
    }

    return 'Unable to upload the resume. Please check the API gateway and parser route, then try again.';
  }
}
