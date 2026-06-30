import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ResumeApi } from '../services/resume-api';
import { ResumeBuilder } from './resume-builder';

type TestableResumeBuilder = {
  handleRenderedSaveResponse: (response: unknown, fallbackResumeId: string) => void;
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
});
