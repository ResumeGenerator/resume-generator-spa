import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { ResumeApi, ResumePreviewResponse } from './resume-api';

describe('ResumeApi', () => {
  let resumeApi: ResumeApi;
  let httpTesting: HttpTestingController;
  let authService: {
    getCurrentUserId: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authService = {
      getCurrentUserId: vi.fn(() => 'user-1'),
    };
    window.__RESUME_GENERATOR_CONFIG__ = {
      apiGatewayUrl: 'https://gateway.example.test',
      parserApiUrl: 'https://parser.example.test',
      templateApiUrl: 'https://template.example.test',
    };

    TestBed.configureTestingModule({
      providers: [
        ResumeApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
      ],
    });

    resumeApi = TestBed.inject(ResumeApi);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    delete window.__RESUME_GENERATOR_CONFIG__;
  });

  it('loads preview HTML from the template html endpoint for each unique template', () => {
    let response: ResumePreviewResponse | undefined;

    resumeApi
      .previewResume({
        resumeId: 'resume-1',
        templateId: 'modern-minimal',
        templateIds: ['modern-minimal', 'professional-dark-blue'],
      })
      .subscribe((value) => {
        response = value;
      });

    const modernRequest = httpTesting.expectOne(
      (request) =>
        request.method === 'GET' &&
        request.url === 'https://gateway.example.test/api/resumes/resume-1/html' &&
        request.params.get('userId') === 'user-1' &&
        request.params.get('templateId') === 'modern-minimal' &&
        !request.params.has('_'),
    );
    expect(modernRequest.request.responseType).toBe('text');

    const darkRequest = httpTesting.expectOne(
      (request) =>
        request.method === 'GET' &&
        request.url === 'https://gateway.example.test/api/resumes/resume-1/html' &&
        request.params.get('userId') === 'user-1' &&
        request.params.get('templateId') === 'professional-dark-blue' &&
        !request.params.has('_'),
    );
    expect(darkRequest.request.responseType).toBe('text');

    modernRequest.flush('<html>modern</html>');
    darkRequest.flush('<html>dark</html>');

    expect(response).toEqual({
      resumeId: 'resume-1',
      templateId: 'modern-minimal',
      html: '<html>modern</html>',
      templates: [
        {
          templateId: 'modern-minimal',
          html: '<html>modern</html>',
        },
        {
          templateId: 'professional-dark-blue',
          html: '<html>dark</html>',
        },
      ],
    });
  });

  it('unwraps html and data from json preview responses', () => {
    let response: ResumePreviewResponse | undefined;
    const renderedData = {
      name: 'BIJU MANAYAGATH',
      title: 'Strategic Senior Software Engineer',
      email: 'bijumanayagath@gmail.com',
    };

    resumeApi
      .previewResume({
        resumeId: 'resume-1',
        templateId: 'modern-minimal',
        templateIds: ['modern-minimal'],
      })
      .subscribe((value) => {
        response = value;
      });

    const request = httpTesting.expectOne(
      (request) =>
        request.method === 'GET' &&
        request.url === 'https://gateway.example.test/api/resumes/resume-1/html' &&
        request.params.get('userId') === 'user-1' &&
        request.params.get('templateId') === 'modern-minimal' &&
        !request.params.has('_'),
    );

    request.flush(
      JSON.stringify({
        resumeId: 'resume-1',
        templateId: 'modern-minimal',
        html: '<article>Rendered resume</article>',
        data: renderedData,
      }),
    );

    expect(response).toEqual({
      resumeId: 'resume-1',
      templateId: 'modern-minimal',
      html: '<article>Rendered resume</article>',
      data: renderedData,
      templates: [
        {
          templateId: 'modern-minimal',
          html: '<article>Rendered resume</article>',
          data: renderedData,
        },
      ],
    });
  });

  it('unwraps nested rendered html from json preview responses', () => {
    let response: ResumePreviewResponse | undefined;
    const renderedData = {
      name: 'Latest Candidate',
    };

    resumeApi
      .previewResume({
        resumeId: 'resume-1',
        templateId: 'modern-minimal',
        templateIds: ['modern-minimal'],
      })
      .subscribe((value) => {
        response = value;
      });

    const request = httpTesting.expectOne(
      (request) =>
        request.method === 'GET' &&
        request.url === 'https://gateway.example.test/api/resumes/resume-1/html' &&
        request.params.get('userId') === 'user-1' &&
        request.params.get('templateId') === 'modern-minimal' &&
        !request.headers.has('Cache-Control') &&
        !request.headers.has('Pragma'),
    );

    request.flush(
      JSON.stringify({
        data: {
          templateId: 'modern-minimal',
          renderedHtml: '<article>Latest rendered resume</article>',
          data: renderedData,
        },
      }),
    );

    expect(response?.html).toBe('<article>Latest rendered resume</article>');
    expect(response?.data).toEqual(renderedData);
    expect(response?.templates[0]).toEqual({
      templateId: 'modern-minimal',
      html: '<article>Latest rendered resume</article>',
      data: renderedData,
    });
  });

  it('preserves avatar from nested rendered preview wrappers', () => {
    let response: ResumePreviewResponse | undefined;
    const renderedData = {
      name: 'Candidate With Photo',
      title: 'Senior Engineer',
    };

    resumeApi
      .previewResume({
        resumeId: 'resume-1',
        templateId: 'modern-minimal',
        templateIds: ['modern-minimal'],
      })
      .subscribe((value) => {
        response = value;
      });

    const request = httpTesting.expectOne(
      (request) =>
        request.method === 'GET' &&
        request.url === 'https://gateway.example.test/api/resumes/resume-1/html' &&
        request.params.get('userId') === 'user-1' &&
        request.params.get('templateId') === 'modern-minimal',
    );

    request.flush(
      JSON.stringify({
        data: {
          templateId: 'modern-minimal',
          renderedHtml: '<article>Rendered resume with photo</article>',
          avatar: 'https://cdn.example.test/avatar.png',
          data: renderedData,
        },
      }),
    );

    expect(response?.data).toEqual({
      ...renderedData,
      avatar: 'https://cdn.example.test/avatar.png',
    });
    expect(response?.templates[0].data).toEqual({
      ...renderedData,
      avatar: 'https://cdn.example.test/avatar.png',
    });
  });

  it('loads structured resume data from the parser API', () => {
    resumeApi.getTemplateResume('resume-1').subscribe((response) => {
      expect(response.id).toBe('resume-1');
    });

    const request = httpTesting.expectOne(
      (request) =>
        request.method === 'GET' &&
        request.url === 'https://gateway.example.test/api/resumes/resume-1' &&
        request.params.get('userId') === 'user-1',
    );
    expect(request.request.method).toBe('GET');

    request.flush({
      id: 'resume-1',
      profile: {},
      metadata: {},
      source: {},
      createdAt: '',
      updatedAt: '',
    });
  });

  it('generates ATS score from the parser API for edited resumes', () => {
    let responseScore = 0;
    let responseBreakdown: Record<string, number> = {};

    resumeApi.getAtsScore('resume-1', 'parsed').subscribe((response) => {
      responseScore = response.atsScore;
      responseBreakdown = response.scoreBreakdown;
    });

    const request = httpTesting.expectOne(
      (request) =>
        request.method === 'GET' &&
        request.url === 'https://gateway.example.test/api/resumes/resume-1/ats-score' &&
        request.params.get('source') === 'parsed' &&
        request.params.get('userId') === 'user-1',
    );

    request.flush({
      resumeId: 'resume-1',
      source: 'parsed',
      atsScore: 84,
      scoreLevel: 'Good',
      summary: 'Resume is ATS-friendly.',
      scoreBreakdown: {
        contactInfo: 10,
        keywords: '13',
      },
      strengths: ['Clear contact details'],
      weakAreas: [],
      missingSections: [],
      keywordGaps: [],
      formattingRisks: [],
      improvementSuggestions: ['Add measurable achievements'],
    });

    expect(responseScore).toBe(84);
    expect(responseBreakdown).toEqual({
      contactInfo: 10,
      keywords: 13,
    });
  });

  it('normalizes flat saved resume rows from a paged resumes response', () => {
    let responseItems: unknown[] = [];

    resumeApi.getTemplateSavedResumes().subscribe((response) => {
      responseItems = response.items;
    });

    const request = httpTesting.expectOne(
      (request) =>
        request.method === 'GET' &&
        request.url === 'https://gateway.example.test/api/resumes' &&
        request.params.get('userId') === 'user-1' &&
        request.params.get('limit') === '100' &&
        request.params.get('skip') === '0',
    );

    request.flush({
      limit: 100,
      skip: 0,
      total: 1,
      resumes: [
        {
          id: '6a4400995be074552b90f4ba',
          filename: 'Biju_Manayagath_CV.docx',
          candidateName: 'BIJU MANAYAGATH',
          candidateEmail: 'bijumanayagath@gmail.com',
          currentTitle: 'Strategic Senior Software Engineer',
          createdAt: '2026-06-30T17:44:57.726000Z',
          updatedAt: '2026-06-30T17:44:57.726000Z',
          atsCalculation: {
            atsScore: 86,
            scoreLevel: 'Excellent',
            summary: 'Resume is highly ATS-ready.',
            scoreBreakdown: { skills: 11 },
            strengths: ['Strong structure'],
            weakAreas: ['Skills need clearer grouping'],
            missingSections: [],
            keywordGaps: [],
            formattingRisks: [],
            improvementSuggestions: ['Group core skills into categories'],
          },
        },
      ],
    });

    expect(responseItems).toEqual([
      {
        id: '6a4400995be074552b90f4ba',
        filename: 'Biju_Manayagath_CV.docx',
        candidateName: 'BIJU MANAYAGATH',
        candidateEmail: 'bijumanayagath@gmail.com',
        currentTitle: 'Strategic Senior Software Engineer',
        createdAt: '2026-06-30T17:44:57.726000Z',
        updatedAt: '2026-06-30T17:44:57.726000Z',
        atsAnalysis: expect.objectContaining({
          atsScore: 86,
          scoreLevel: 'Excellent',
          improvementSuggestions: ['Group core skills into categories'],
        }),
      },
    ]);
  });

  it('normalizes edited resume save responses so the new id can be previewed', () => {
    let savedId = '';

    resumeApi
      .saveEditedResume('resume-1', {
        profile: {
          candidateProfile: {
            fullName: 'Jane Candidate',
          },
        },
        metadata: {},
        source: {},
      })
      .subscribe((response) => {
        savedId = response.id;
      });

    const request = httpTesting.expectOne(
      (request) =>
        request.method === 'POST' &&
        request.url === 'https://gateway.example.test/api/resumes/resume-1/edits' &&
        request.params.get('userId') === 'user-1',
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      candidateProfile: {
        fullName: 'Jane Candidate',
      },
    });

    request.flush({
      data: {
        _id: {
          $oid: 'edited-1',
        },
        profile: {
          candidateProfile: {
            fullName: 'Jane Candidate',
          },
        },
        metadata: {},
        source: {},
      },
    });

    expect(savedId).toBe('edited-1');
  });

  it('uploads resume images to the parser image endpoint as form data', () => {
    let uploadedAvatar = '';
    const imageFile = new File(['image-bytes'], 'avatar.png', { type: 'image/png' });

    resumeApi.uploadResumeImage('resume-1', imageFile).subscribe((response) => {
      uploadedAvatar = String(response.profile['data'] && (response.profile['data'] as Record<string, unknown>)['avatar']);
    });

    const request = httpTesting.expectOne(
      (request) =>
        request.method === 'POST' &&
        request.url === 'https://gateway.example.test/api/resumes/resume-1/image' &&
        request.params.get('userId') === 'user-1',
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBe(true);
    expect(request.request.body.get('file')).toBe(imageFile);

    request.flush({
      id: 'resume-1',
      avatar: 'https://cdn.example.test/avatar.png',
    });

    expect(uploadedAvatar).toBe('https://cdn.example.test/avatar.png');
  });

  it('parses resumes with the current user id in form data', () => {
    const resumeFile = new File(['resume-bytes'], 'resume.pdf', { type: 'application/pdf' });

    resumeApi.parseResume(resumeFile, ' Build APIs ').subscribe();

    const request = httpTesting.expectOne(
      (request) =>
        request.method === 'POST' &&
        request.url === 'https://gateway.example.test/api/resumes/parse' &&
        request.params.get('userId') === 'user-1',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBe(true);
    expect(request.request.body.get('file')).toBe(resumeFile);
    expect(request.request.body.get('userId')).toBe('user-1');
    expect(request.request.body.get('jobDescription')).toBe('Build APIs');

    request.flush({
      resumeId: 'resume-1',
    });
  });

  it('saves rendered edits through the template edited document endpoint', () => {
    let savedId = '';

    resumeApi
      .saveRenderedResume('resume-1', {
        resumeId: 'resume-1',
        template: 'modern-minimal',
        templateId: 'modern-minimal',
        format: 'html',
        data: {
          name: 'Jane Candidate',
        },
        profile: {
          data: {
            name: 'Jane Candidate',
          },
        },
      })
      .subscribe((response) => {
        savedId = response.id || '';
      });

    const request = httpTesting.expectOne(
      (request) =>
        request.method === 'POST' &&
        request.url === 'https://gateway.example.test/api/resumes/edited/resume-1' &&
        request.params.get('userId') === 'user-1',
    );

    expect(request.request.body).toEqual({
      resumeId: 'resume-1',
      template: 'modern-minimal',
      templateId: 'modern-minimal',
      format: 'html',
      data: {
        name: 'Jane Candidate',
      },
      profile: {
        data: {
          name: 'Jane Candidate',
        },
      },
    });

    request.flush({
      id: 'edited-1',
    });

    expect(savedId).toBe('edited-1');
  });

  it('downloads rendered PDF and Word documents with the current user id', () => {
    resumeApi.downloadResumePdf('resume-1', 'modern-minimal').subscribe();
    resumeApi.downloadResumeWord('resume-1', 'modern-minimal').subscribe();

    const pdfRequest = httpTesting.expectOne('https://gateway.example.test/api/resumes/pdf');
    expect(pdfRequest.request.method).toBe('POST');
    expect(pdfRequest.request.responseType).toBe('blob');
    expect(pdfRequest.request.body).toEqual({
      resumeId: 'resume-1',
      userId: 'user-1',
      templateId: 'modern-minimal',
    });
    pdfRequest.flush(new Blob());

    const wordRequest = httpTesting.expectOne('https://gateway.example.test/api/resumes/word');
    expect(wordRequest.request.method).toBe('POST');
    expect(wordRequest.request.responseType).toBe('blob');
    expect(wordRequest.request.body).toEqual({
      resumeId: 'resume-1',
      userId: 'user-1',
      templateId: 'modern-minimal',
    });
    wordRequest.flush(new Blob());
  });

  it('sends only resume text to the parser rephrase endpoint', () => {
    let rephrasedText = '';

    resumeApi.rephraseResumeText('Built and maintained APIs.').subscribe((response) => {
      rephrasedText = response;
    });

    const request = httpTesting.expectOne('https://gateway.example.test/api/resumes/rephrase');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      text: 'Built and maintained APIs.',
    });

    request.flush({
      data: {
        rephrasedText: 'Built and maintained production APIs for resume workflows.',
      },
    });

    expect(rephrasedText).toBe('Built and maintained production APIs for resume workflows.');
  });
});
