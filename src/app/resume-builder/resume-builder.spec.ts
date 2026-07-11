import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';

import { ResumeApi } from '../services/resume-api';
import { ResumeBuilder } from './resume-builder';

interface RuntimeConfigWindow extends Window {
  __RESUME_GENERATOR_CONFIG__?: {
    apiGatewayUrl?: string;
    parserApiUrl?: string;
    templateApiUrl?: string;
  };
}

type TestableResumeBuilder = {
  handleRenderedSaveResponse: (response: unknown, fallbackResumeId: string) => void;
  activeTemplateIndex: { set: (index: number) => void; (): number };
  activeEditorStep: { set: (step: string) => void; (): string };
  aiEnhanceErrorMessage: () => string | null;
  aiEnhanceState: () => string;
  editAvatar: string;
  editHardSkills: string;
  editLanguages: string;
  editEducation: {
    degree: string;
    institution: string;
    location: string;
    startDate: string;
    endDate: string;
  }[];
  editProfessionalSummary: string;
  editWorkExperience: { responsibilities: string }[];
  nextEditorStep: () => void;
  onPhotoSelected: (event: Event) => void;
  pendingAiWorkSummaryIndex: () => number | null;
  photoUploadState: () => string;
  previewResume: (templateIds?: string[]) => void;
  loadSavedResumes: () => void;
  previewResponse: {
    (): {
      resumeId: string;
      html?: string;
      templates: { templateId: string; html: string; data?: unknown }[];
    } | null;
    set: (value: unknown) => void;
  };
  previewState: () => string;
  resumeId: string;
  saveRenderedResume: () => void;
};

describe('ResumeBuilder', () => {
  let fixture: ComponentFixture<ResumeBuilder>;
  let component: TestableResumeBuilder;
  let routeParamMapGet: ReturnType<typeof vi.fn>;
  let resumeApi: {
    getTemplateSavedResumes: ReturnType<typeof vi.fn>;
    getTemplateResume: ReturnType<typeof vi.fn>;
    previewResume: ReturnType<typeof vi.fn>;
    rephraseResumeText: ReturnType<typeof vi.fn>;
    saveRenderedResume: ReturnType<typeof vi.fn>;
    uploadResumeImage: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    (window as RuntimeConfigWindow).__RESUME_GENERATOR_CONFIG__ = {
      apiGatewayUrl: 'https://gateway.example.test',
    };
    routeParamMapGet = vi.fn(() => null);
    resumeApi = {
      getTemplateSavedResumes: vi.fn(() => of({ items: [] })),
      getTemplateResume: vi.fn(() =>
        of({
          id: 'resume-1',
          profile: {},
          metadata: {},
          source: {},
          createdAt: '',
          updatedAt: '',
        }),
      ),
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
      saveRenderedResume: vi.fn(() =>
        of({
          id: 'edited-3',
        }),
      ),
      uploadResumeImage: vi.fn(() =>
        of({
          id: 'resume-1',
          profile: {
            data: {
              avatar: 'https://cdn.example.test/avatar.png',
            },
          },
          metadata: {},
          source: {},
          createdAt: '',
          updatedAt: '',
        }),
      ),
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
                get: routeParamMapGet,
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

  afterEach(() => {
    delete (window as RuntimeConfigWindow).__RESUME_GENERATOR_CONFIG__;
  });

  it('links the back button to the resume upload workspace', () => {
    const backButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('.back-button');

    expect(backButton?.getAttribute('href')).toBe('/upload');
    expect(backButton?.getAttribute('aria-label')).toBe('Back to resume upload');
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

  it('previews the first saved resume without loading the parser resume document', () => {
    resumeApi.getTemplateSavedResumes.mockReturnValueOnce(
      of({
        items: [
          {
            id: 'resume-1',
            filename: 'resume.pdf',
          },
        ],
      }),
    );

    component.loadSavedResumes();

    expect(resumeApi.previewResume).toHaveBeenCalledWith({
      resumeId: 'resume-1',
      templateId: 'modern-minimal',
      templateIds: ['modern-minimal'],
    });
    expect(resumeApi.getTemplateResume).not.toHaveBeenCalled();
  });

  it('previews route resume ids without loading the parser resume document', () => {
    routeParamMapGet.mockReturnValue('resume-from-route');
    resumeApi.getTemplateSavedResumes.mockClear();
    resumeApi.getTemplateResume.mockClear();
    resumeApi.previewResume.mockClear();

    fixture.componentInstance.ngOnInit();

    expect(resumeApi.previewResume).toHaveBeenCalledWith({
      resumeId: 'resume-from-route',
      templateId: 'modern-minimal',
      templateIds: ['modern-minimal'],
    });
    expect(resumeApi.getTemplateResume).not.toHaveBeenCalled();
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
      '6 Courses',
      '7 Languages',
      '8 Summary',
    ]);
    expect(fixture.nativeElement.querySelector('.step-rail')?.textContent).not.toContain('Add section');
  });

  it('renders the inline preview iframe without its own scrollbars', () => {
    const previewFrame = fixture.nativeElement.querySelector(
      '.resume-preview-frame iframe',
    ) as HTMLIFrameElement | null;

    expect(previewFrame?.getAttribute('sandbox')).toBe('allow-same-origin');
    expect(previewFrame?.getAttribute('scrolling')).toBe('no');
  });

  it('uploads the personal photo to the parser image endpoint and saves the returned avatar', () => {
    component.resumeId = 'resume-1';
    const imageFile = new File(['image-bytes'], 'avatar.png', { type: 'image/png' });

    component.onPhotoSelected({
      target: {
        files: {
          item: () => imageFile,
        },
        value: 'avatar.png',
      },
    } as unknown as Event);

    expect(resumeApi.uploadResumeImage).toHaveBeenCalledWith('resume-1', imageFile);
    expect(component.photoUploadState()).toBe('success');
    expect(component.editAvatar).toBe('https://cdn.example.test/avatar.png');

    component.saveRenderedResume();

    const request = resumeApi.saveRenderedResume.mock.calls[0][1] as {
      avatar?: string;
      withPhoto?: boolean;
      data: Record<string, unknown>;
      profile?: {
        data?: Record<string, unknown>;
      };
    };

    expect(request.withPhoto).toBe(true);
    expect(request.avatar).toBe('https://cdn.example.test/avatar.png');
    expect(request.data['avatar']).toBe('https://cdn.example.test/avatar.png');
    expect(request.profile?.data?.['avatar']).toBe('https://cdn.example.test/avatar.png');
  });

  it('renders an existing avatar thumbnail and removes it from the next save payload', () => {
    component.resumeId = 'resume-1';
    component.editAvatar = 's/images/avatar.png';
    component.previewResponse.set({
      resumeId: 'resume-1',
      templateId: 'modern-minimal',
      html: '<article>Preview</article>',
      data: {
        avatar: 's/images/avatar.png',
      },
      templates: [
        {
          templateId: 'modern-minimal',
          html: '<article>Preview</article>',
          data: {
            avatar: 's/images/avatar.png',
          },
        },
      ],
    });
    fixture.detectChanges();

    const thumbnail = fixture.nativeElement.querySelector('.photo-thumbnail img') as HTMLImageElement | null;
    expect(thumbnail?.getAttribute('src')).toBe('https://gateway.example.test/s/images/avatar.png');

    const removeButton = fixture.nativeElement.querySelector('.photo-remove-button') as HTMLButtonElement | null;
    removeButton?.click();
    fixture.detectChanges();

    expect(component.editAvatar).toBe('');
    expect(fixture.nativeElement.querySelector('.photo-thumbnail')).toBeNull();

    component.saveRenderedResume();

    const request = resumeApi.saveRenderedResume.mock.calls[0][1] as {
      avatar?: string;
      withPhoto?: boolean;
      data: Record<string, unknown>;
      profile?: {
        data?: Record<string, unknown>;
      };
    };

    expect(request.withPhoto).toBe(false);
    expect(request.avatar).toBe('');
    expect(request.data['avatar']).toBe('');
    expect(request.profile?.data?.['avatar']).toBe('');
  });

  it('hydrates the existing photo thumbnail from preview data avatar', () => {
    component.resumeId = 'resume-1';
    resumeApi.previewResume.mockReturnValueOnce(
      of({
        resumeId: 'resume-1',
        templateId: 'modern-minimal',
        html: '<article>Preview with photo</article>',
        data: {
          name: 'Candidate With Photo',
          avatar: 's/images/avatar.png',
        },
        templates: [
          {
            templateId: 'modern-minimal',
            html: '<article>Preview with photo</article>',
            data: {
              name: 'Candidate With Photo',
              avatar: 's/images/avatar.png',
            },
          },
        ],
      }),
    );

    component.previewResume(['modern-minimal']);
    fixture.detectChanges();

    const thumbnail = fixture.nativeElement.querySelector('.photo-thumbnail img') as HTMLImageElement | null;
    const removeButton = fixture.nativeElement.querySelector('.photo-remove-button') as HTMLButtonElement | null;

    expect(component.editAvatar).toBe('s/images/avatar.png');
    expect(thumbnail?.getAttribute('src')).toBe('https://gateway.example.test/s/images/avatar.png');
    expect(removeButton?.getAttribute('aria-label')).toBe('Remove resume photo');
  });

  it('renders only skills provided by the resume data in the skills step', () => {
    component.activeEditorStep.set('skills');
    component.editHardSkills = 'Angular\nTypeScript';

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const skillChips = Array.from(
      compiled.querySelectorAll('.skill-label'),
      (chip) => chip.textContent?.trim() ?? '',
    );

    expect(compiled.textContent).toContain('Skills from resume');
    expect(skillChips).toEqual(['Angular', 'TypeScript']);
    expect(compiled.querySelector('textarea[name="editorSkills"]')).toBeNull();
    expect(compiled.textContent).not.toContain('System design');
    expect(compiled.textContent).not.toContain('Project management');
    expect(compiled.textContent).not.toContain('Technical leadership');
  });

  it('adds and removes skills directly as chips', () => {
    component.activeEditorStep.set('skills');
    component.editHardSkills = 'Angular\nTypeScript';
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input[name="editorSkillInput"]') as HTMLInputElement | null;
    input?.focus();
    input!.value = 'RxJS';
    input?.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector('.skill-add-button') as HTMLButtonElement | null;
    addButton?.click();
    fixture.detectChanges();

    const skillLabels = (): string[] =>
      Array.from(
        fixture.nativeElement.querySelectorAll('.skill-label'),
        (chip: Element) => chip.textContent?.trim() ?? '',
      );

    expect(skillLabels()).toEqual(['Angular', 'TypeScript', 'RxJS']);

    const removeButton = fixture.nativeElement.querySelector(
      'button[aria-label="Remove Angular"]',
    ) as HTMLButtonElement | null;
    removeButton?.click();
    fixture.detectChanges();

    expect(skillLabels()).toEqual(['TypeScript', 'RxJS']);
  });

  it('adds and removes languages directly as chips', () => {
    component.activeEditorStep.set('languages');
    component.editLanguages = 'English\nArabic';
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input[name="editorLanguageInput"]') as HTMLInputElement | null;
    input?.focus();
    input!.value = 'French';
    input?.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector('.skill-add-button') as HTMLButtonElement | null;
    addButton?.click();
    fixture.detectChanges();

    const languageLabels = (): string[] =>
      Array.from(
        fixture.nativeElement.querySelectorAll('.skill-label'),
        (chip: Element) => chip.textContent?.trim() ?? '',
      );

    expect(languageLabels()).toEqual(['English', 'Arabic', 'French']);

    const removeButton = fixture.nativeElement.querySelector(
      'button[aria-label="Remove language English"]',
    ) as HTMLButtonElement | null;
    removeButton?.click();
    fixture.detectChanges();

    expect(languageLabels()).toEqual(['Arabic', 'French']);
  });

  it('saves languages as a separate rendered section and preserves existing levels', () => {
    component.handleRenderedSaveResponse(
      {
        id: 'edited-language',
        templateId: 'modern-minimal',
        html: '<article>Language preview</article>',
        data: {
          sections: [
            {
              title: 'Skills',
              type: 'skill',
              items: [{ name: 'Angular', level: '' }],
            },
            {
              title: 'Languages',
              type: 'language',
              items: [{ language: 'English', level: 'Native' }],
            },
          ],
        },
      },
      'resume-1',
    );

    component.editHardSkills = 'Angular';
    component.editLanguages = 'English\nFrench';
    component.saveRenderedResume();

    const request = resumeApi.saveRenderedResume.mock.calls[0][1] as {
      data: {
        sections: { type?: string; items?: unknown }[];
      };
    };
    const skillItems = request.data.sections.find((section) => section.type === 'skill')?.items as
      | Record<string, unknown>[]
      | undefined;
    const languageItems = request.data.sections.find((section) => section.type === 'language')?.items as
      | Record<string, unknown>[]
      | undefined;

    expect(skillItems?.map((item) => item['name'])).toEqual(['Angular']);
    expect(languageItems).toEqual([
      expect.objectContaining({ language: 'English', level: 'Native' }),
      expect.objectContaining({ language: 'French', level: '' }),
    ]);
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

  it('refetches only the selected template when save response does not include rendered HTML', () => {
    component.resumeId = 'resume-1';
    component.previewResponse.set({
      resumeId: 'resume-1',
      templateId: 'modern-minimal',
      templates: [
        {
          templateId: 'modern-minimal',
          html: '<article>Modern preview</article>',
          data: {
            name: 'Jane Candidate',
          },
        },
        {
          templateId: 'professional-dark-blue',
          html: '<article>Dark preview</article>',
          data: {
            name: 'Jane Candidate',
          },
        },
      ],
    });
    component.activeTemplateIndex.set(1);

    component.saveRenderedResume();

    expect(resumeApi.saveRenderedResume).toHaveBeenCalledWith(
      'resume-1',
      expect.objectContaining({
        template: 'professional-dark-blue',
        templateId: 'professional-dark-blue',
      }),
    );
    expect(resumeApi.previewResume).toHaveBeenCalledTimes(1);
    expect(resumeApi.previewResume).toHaveBeenCalledWith({
      resumeId: 'edited-3',
      templateId: 'professional-dark-blue',
      templateIds: ['professional-dark-blue'],
    });
  });

  it('keeps the selected preview visible while refreshing saved template HTML', () => {
    const previewRefresh = new Subject<{
      resumeId: string;
      templateId: string;
      html: string;
      templates: { templateId: string; html: string }[];
    }>();
    resumeApi.previewResume.mockReturnValueOnce(previewRefresh.asObservable());
    component.resumeId = 'resume-1';
    component.previewResponse.set({
      resumeId: 'resume-1',
      templateId: 'modern-minimal',
      html: '<article>Current selected preview</article>',
      templates: [
        {
          templateId: 'modern-minimal',
          html: '<article>Modern preview</article>',
        },
        {
          templateId: 'professional-dark-blue',
          html: '<article>Current selected preview</article>',
        },
      ],
    });
    component.activeTemplateIndex.set(1);

    component.handleRenderedSaveResponse(
      {
        id: 'edited-4',
      },
      'resume-1',
    );

    expect(component.previewResponse()?.html).toBe('<article>Current selected preview</article>');
    expect(resumeApi.previewResume).toHaveBeenCalledWith({
      resumeId: 'edited-4',
      templateId: 'professional-dark-blue',
      templateIds: ['professional-dark-blue'],
    });

    previewRefresh.next({
      resumeId: 'edited-4',
      templateId: 'professional-dark-blue',
      html: '<article>Refreshed selected preview</article>',
      templates: [
        {
          templateId: 'professional-dark-blue',
          html: '<article>Refreshed selected preview</article>',
        },
      ],
    });
    previewRefresh.complete();

    expect(component.previewResponse()?.html).toBe('<article>Refreshed selected preview</article>');
  });

  it('captures education start and end dates from rendered data', () => {
    component.handleRenderedSaveResponse(
      {
        id: 'edited-education',
        templateId: 'modern-minimal',
        html: '<article>Education preview</article>',
        data: {
          name: 'Jane Candidate',
          sections: [
            {
              title: 'Education',
              type: 'education',
              items: [
                {
                  degree: 'Master of Computer Application (Computers)',
                  school: 'PSG College',
                  faculty: '',
                  department: '',
                  location: 'Coimbatore, India',
                  years: '01-01-2011',
                  start: '01-01-2011',
                  end: '01-01-2011',
                  highlights: [],
                },
              ],
            },
          ],
        },
      },
      'resume-1',
    );

    expect(component.editEducation[0]).toMatchObject({
      degree: 'Master of Computer Application (Computers)',
      institution: 'PSG College',
      location: 'Coimbatore, India',
      startDate: '01-01-2011',
      endDate: '01-01-2011',
    });
  });

  it('loads only the active template when previewing from the builder', () => {
    component.resumeId = 'resume-1';
    component.previewResponse.set({
      resumeId: 'resume-1',
      templateId: 'modern-minimal',
      templates: [
        {
          templateId: 'modern-minimal',
          html: '<article>Modern preview</article>',
        },
        {
          templateId: 'professional-dark-blue',
          html: '<article>Dark preview</article>',
        },
      ],
    });
    component.activeTemplateIndex.set(1);

    component.previewResume();

    expect(resumeApi.previewResume).toHaveBeenCalledTimes(1);
    expect(resumeApi.previewResume).toHaveBeenCalledWith({
      resumeId: 'resume-1',
      templateId: 'professional-dark-blue',
      templateIds: ['professional-dark-blue'],
    });
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
