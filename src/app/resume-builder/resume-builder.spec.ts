import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ResumeApi } from '../services/resume-api';
import { ResumeBuilder } from './resume-builder';

type TestableResumeBuilder = {
  handleRenderedSaveResponse: (response: unknown, fallbackResumeId: string) => void;
  activeEditorStep: { set: (step: string) => void; (): string };
  aiEnhanceErrorMessage: () => string | null;
  aiEnhanceState: () => string;
  editHardSkills: string;
  editProfessionalSummary: string;
  editWorkExperience: { responsibilities: string }[];
  nextEditorStep: () => void;
  pendingAiWorkSummaryIndex: () => number | null;
  previewResponse: () => {
    resumeId: string;
    html?: string;
    templates: { templateId: string; html: string; data?: unknown }[];
  } | null;
  previewState: () => string;
  resumeId: string;
};

describe('ResumeBuilder', () => {
  let fixture: ComponentFixture<ResumeBuilder>;
  let component: TestableResumeBuilder;
  let resumeApi: {
    getTemplateSavedResumes: ReturnType<typeof vi.fn>;
    previewResume: ReturnType<typeof vi.fn>;
    rephraseResumeText: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    resumeApi = {
      getTemplateSavedResumes: vi.fn(() => of({ items: [] })),
      previewResume: vi.fn(() =>
        of({
          resumeId: 'resume-1',
          templateId: 'modern-minimal',
          html: '<article>Old preview</article>',
          templates: [
            {
              templateId: 'modern-minimal',
              html: '<article>Old preview</article>',
            },
          ],
        }),
      ),
      rephraseResumeText: vi.fn(() => of('Improved production API ownership for resume workflows.')),
    };

    await TestBed.configureTestingModule({
      imports: [ResumeBuilder],
      providers: [
        provideRouter([]),
        { provide: ResumeApi, useValue: resumeApi },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResumeBuilder);
    component = fixture.componentInstance as unknown as TestableResumeBuilder;
    fixture.detectChanges();
  });

  it('uses rendered HTML returned from save instead of refetching stale preview HTML', () => {
    component.handleRenderedSaveResponse(
      {
        id: 'edited-1',
        templateId: 'modern-minimal',
        html: '<article>Updated preview</article>',
        data: {
          name: 'Updated Candidate',
        },
      },
      'resume-1',
    );

    expect(component.resumeId).toBe('edited-1');
    expect(component.previewState()).toBe('success');
    expect(component.previewResponse()?.html).toBe('<article>Updated preview</article>');
    expect(component.previewResponse()?.templates[0]).toEqual({
      templateId: 'modern-minimal',
      html: '<article>Updated preview</article>',
      data: {
        name: 'Updated Candidate',
      },
    });
    expect(resumeApi.previewResume).not.toHaveBeenCalled();
  });

  it('uses short section labels in the compact editor stepper', () => {
    const stepLabels = Array.from(
      fixture.nativeElement.querySelectorAll('.step-rail .step-item:not(.muted)'),
      (step: Element) => step.textContent?.trim().replace(/\s+/g, ' ') ?? '',
    );

    expect(stepLabels).toEqual([
      '1 Personal',
      '2 Contact',
      '3 Experience',
      '4 Skills',
      '5 Education',
      '6 Summary',
    ]);
  });

  it('renders only skills provided by the resume data in the skills step', () => {
    component.activeEditorStep.set('skills');
    component.editHardSkills = 'Angular\nTypeScript';

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const skillChips = Array.from(compiled.querySelectorAll('.skill-chip'), (chip) => chip.textContent?.trim() ?? '');

    expect(compiled.textContent).toContain('Skills from resume');
    expect(skillChips).toEqual(['Angular', 'TypeScript']);
    expect(compiled.textContent).not.toContain('System design');
    expect(compiled.textContent).not.toContain('Project management');
    expect(compiled.textContent).not.toContain('Technical leadership');
  });

  it('uses nested rendered HTML returned from save instead of refetching stale preview HTML', () => {
    component.handleRenderedSaveResponse(
      {
        data: {
          id: 'edited-2',
          templateId: 'modern-minimal',
          renderedHtml: '<article>Latest nested preview</article>',
          data: {
            name: 'Nested Candidate',
          },
        },
      },
      'resume-1',
    );

    expect(component.resumeId).toBe('edited-2');
    expect(component.previewState()).toBe('success');
    expect(component.previewResponse()?.html).toBe('<article>Latest nested preview</article>');
    expect(component.previewResponse()?.templates[0]).toEqual({
      templateId: 'modern-minimal',
      html: '<article>Latest nested preview</article>',
      data: {
        name: 'Nested Candidate',
      },
    });
    expect(resumeApi.previewResume).not.toHaveBeenCalled();
  });

  it('shows the improved work summary as a suggestion before applying it', () => {
    component.activeEditorStep.set('experience');
    component.editWorkExperience = [
      {
        responsibilities: 'Built APIs and fixed production defects.',
      },
    ];

    fixture.detectChanges();

    const improveButton = fixture.nativeElement.querySelector('.ai-button') as HTMLButtonElement | null;
    expect(improveButton).not.toBeNull();

    improveButton?.click();
    fixture.detectChanges();

    expect(resumeApi.rephraseResumeText).toHaveBeenCalledWith('Built APIs and fixed production defects.');
    expect(component.editWorkExperience[0].responsibilities).toBe('Built APIs and fixed production defects.');
    expect(component.pendingAiWorkSummaryIndex()).toBe(0);

    const suggestionCard = fixture.nativeElement.querySelector('.ai-suggestion-card') as HTMLElement | null;
    expect(suggestionCard?.textContent).toContain('Improved production API ownership for resume workflows.');

    const applyButton = fixture.nativeElement.querySelector('.ai-suggestion-apply') as HTMLButtonElement | null;
    expect(applyButton).not.toBeNull();

    applyButton?.click();
    fixture.detectChanges();

    expect(component.editWorkExperience[0].responsibilities).toBe(
      'Improved production API ownership for resume workflows.',
    );
    expect(fixture.nativeElement.querySelector('.ai-suggestion-card')).toBeNull();

    const updatedTextarea = fixture.nativeElement.querySelector(
      'textarea[aria-label="Work summary"]',
    ) as HTMLTextAreaElement | null;
    expect(updatedTextarea?.value).toBe('Improved production API ownership for resume workflows.');
    expect(component.pendingAiWorkSummaryIndex()).toBeNull();
    expect(component.activeEditorStep()).toBe('experience');
  });

  it('shows the improved professional summary as a suggestion before applying it', () => {
    resumeApi.rephraseResumeText.mockReturnValueOnce(
      of('Improved professional summary for senior engineering leadership.'),
    );
    component.activeEditorStep.set('summary');
    component.editProfessionalSummary = 'Original professional summary.';

    fixture.detectChanges();

    const improveButton = fixture.nativeElement.querySelector('.summary-notes .ai-button') as HTMLButtonElement | null;
    expect(improveButton).not.toBeNull();

    improveButton?.click();
    fixture.detectChanges();

    expect(resumeApi.rephraseResumeText).toHaveBeenCalledWith('Original professional summary.');
    expect(component.editProfessionalSummary).toBe('Original professional summary.');

    const suggestionCard = fixture.nativeElement.querySelector('.summary-notes .ai-suggestion-card') as HTMLElement | null;
    expect(suggestionCard?.textContent).toContain('Improved professional summary for senior engineering leadership.');

    const applyButton = fixture.nativeElement.querySelector('.ai-summary-suggestion-apply') as HTMLButtonElement | null;
    expect(applyButton).not.toBeNull();

    applyButton?.click();
    fixture.detectChanges();

    expect(component.editProfessionalSummary).toBe('Improved professional summary for senior engineering leadership.');
    expect(fixture.nativeElement.querySelector('.summary-notes .ai-suggestion-card')).toBeNull();

    const updatedTextarea = fixture.nativeElement.querySelector(
      'textarea[aria-label="Professional summary"]',
    ) as HTMLTextAreaElement | null;
    expect(updatedTextarea?.value).toBe('Improved professional summary for senior engineering leadership.');
    expect(component.activeEditorStep()).toBe('summary');
  });
});
