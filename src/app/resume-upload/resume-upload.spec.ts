import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ResumeApi } from '../services/resume-api';
import { ResumeUpload } from './resume-upload';

describe('ResumeUpload', () => {
  let fixture: ComponentFixture<ResumeUpload>;

  const resumeApi = {
    getSavedResumes: () =>
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

  it('does not show an edit action for saved resumes', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const actions = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.resume-actions button')).map((button) =>
      button.textContent?.trim(),
    );

    expect(actions).toEqual(['Preview', 'Regenerate']);
  });

  it('shows user-focused upload guidance and visual progress', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const dropZone = compiled.querySelector<HTMLElement>('.drop-zone');

    expect(compiled.textContent).toContain('Step 1 of 3: Upload');
    expect(compiled.textContent).toContain('Supports PDF, DOC, or DOCX (Max 5MB).');
    expect(compiled.textContent).not.toContain('multipart/form-data');
    expect(dropZone?.querySelector('svg')).toBeTruthy();
  });
});
