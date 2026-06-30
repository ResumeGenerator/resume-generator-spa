import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RESUME_REPHRASE_PROMPT } from './resume-ai-prompts';
import { ResumeApi, ResumePreviewResponse } from './resume-api';

describe('ResumeApi', () => {
  let resumeApi: ResumeApi;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    window.__RESUME_GENERATOR_CONFIG__ = {
      parserApiUrl: 'https://parser.example.test',
      templateApiUrl: 'https://template.example.test',
    };

    TestBed.configureTestingModule({
      providers: [ResumeApi, provideHttpClient(), provideHttpClientTesting()],
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
        request.url === 'https://template.example.test/api/Resumes/resume-1/html' &&
        request.params.get('templateId') === 'modern-minimal' &&
        Boolean(request.params.get('_')),
    );
    expect(modernRequest.request.responseType).toBe('text');

    const darkRequest = httpTesting.expectOne(
      (request) =>
        request.method === 'GET' &&
        request.url === 'https://template.example.test/api/Resumes/resume-1/html' &&
        request.params.get('templateId') === 'professional-dark-blue' &&
        Boolean(request.params.get('_')),
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
        request.url === 'https://template.example.test/api/Resumes/resume-1/html' &&
        request.params.get('templateId') === 'modern-minimal' &&
        Boolean(request.params.get('_')),
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
        request.url === 'https://template.example.test/api/Resumes/resume-1/html' &&
        request.params.get('templateId') === 'modern-minimal' &&
        request.headers.get('Cache-Control') === 'no-cache',
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

  it('loads structured resume data from the parser API', () => {
    resumeApi.getTemplateResume('resume-1').subscribe((response) => {
      expect(response.id).toBe('resume-1');
    });

    const request = httpTesting.expectOne('https://parser.example.test/api/resumes/resume-1');
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

    const request = httpTesting.expectOne('https://parser.example.test/api/resumes/resume-1/edits');

    expect(request.request.method).toBe('POST');

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

    const request = httpTesting.expectOne('https://template.example.test/api/Resumes/edited/resume-1');

    expect(request.request.method).toBe('POST');
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

  it('sends resume text to the parser rephrase endpoint with scoped resume prompt context', () => {
    let rephrasedText = '';

    resumeApi.rephraseResumeText('Built and maintained APIs.').subscribe((response) => {
      rephrasedText = response;
    });

    const request = httpTesting.expectOne('https://parser.example.test/api/resumes/rephrase');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      text: 'Built and maintained APIs.',
      prompt: RESUME_REPHRASE_PROMPT,
    });

    request.flush({
      data: {
        rephrasedText: 'Built and maintained production APIs for resume workflows.',
      },
    });

    expect(rephrasedText).toBe('Built and maintained production APIs for resume workflows.');
  });
});
