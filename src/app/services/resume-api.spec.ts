import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

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
        request.params.get('templateId') === 'modern-minimal',
    );
    expect(modernRequest.request.responseType).toBe('text');

    const darkRequest = httpTesting.expectOne(
      (request) =>
        request.method === 'GET' &&
        request.url === 'https://template.example.test/api/Resumes/resume-1/html' &&
        request.params.get('templateId') === 'professional-dark-blue',
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
        request.params.get('templateId') === 'modern-minimal',
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
});
