import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ResumeApi } from '../services/resume-api';
import { ResumeUpload } from './resume-upload';

describe('ResumeUpload', () => {
  let fixture: ComponentFixture<ResumeUpload>;

  const resumeApi = {
    getTemplateSavedResumes: () =>
      of({
        items: [
          {
            id: 'resume-1',
            filename: 'resume.pdf',
            candidateName: 'Jane Candidate',
            candidateEmail: 'jane@example.com',
            currentTitle: 'Product Manager',
            createdAt: '2026-06-22T00:00:00.000Z',
          },
        ],
      }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResumeUpload],
      providers: [{ provide: ResumeApi, useValue: resumeApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(ResumeUpload);
    fixture.detectChanges();
  });

  it('shows compact saved tailoring actions with an edit action', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const actions = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.resume-actions button')).map((button) =>
      button.textContent?.trim(),
    );

    expect(actions).toEqual(['O Preview', 'E Edit']);
  });

  it('shows user-focused upload guidance and visual progress', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const dropZone = compiled.querySelector<HTMLElement>('.drop-zone');

    expect(compiled.textContent).toContain('Document workspace');
    expect(compiled.textContent).toContain('Step 1: Your Input');
    expect(compiled.textContent).toContain('Saved Tailorings');
    expect(compiled.textContent).toContain('Supports PDF, DOC, or DOCX (Max 5MB).');
    expect(compiled.textContent).not.toContain('multipart/form-data');
    expect(dropZone?.querySelector('svg')).toBeTruthy();
  });

  it('shows parsed resume metadata without exposing the raw parser response', () => {
    const component = fixture.componentInstance as unknown as {
      parsedResume: {
        set: (value: unknown) => void;
      };
      uploadState: {
        set: (value: string) => void;
      };
    };

    component.parsedResume.set({
      resumeId: 'parsed-resume-1',
      metadata: {
        filename: 'Biju_Manayagath_CV.docx',
        uploadedAt: '2026-06-30T20:44:00.000Z',
      },
      profile: {
        candidateProfile: {
          fullName: 'Biju Manayagath',
          currentTitle: 'Senior Software Engineer',
        },
      },
    });
    component.uploadState.set('success');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Resume saved successfully');
    expect(compiled.textContent).not.toContain('Use the parsed resume id below');
    expect(compiled.textContent).not.toContain('Parser response');
    expect(compiled.textContent).toContain('Senior Software Engineer');
    expect(compiled.textContent).toContain('Filename: Biju_Manayagath_CV.docx');
    expect(compiled.textContent).toContain('Uploaded:');
    expect(compiled.textContent).not.toContain('No current title');
  });
});
