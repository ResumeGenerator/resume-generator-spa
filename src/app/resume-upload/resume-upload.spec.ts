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

  it('shows compact saved tailoring actions without an edit action', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const actions = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.resume-actions button')).map((button) =>
      button.textContent?.trim(),
    );

    expect(actions).toEqual(['O Preview', 'D Export', 'R Regenerate']);
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
});
