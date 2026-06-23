# Project Overview

- Angular single-page application for uploading resumes, sending them to a parser API, editing structured resume data, previewing rendered templates, and downloading generated PDF/Word output.
- This repo owns only the browser SPA and static Docker/nginx runtime. Resume parsing, persistence, template rendering, and document generation are owned by backend services.

# Tech Stack

| Area | Details |
| --- | --- |
| Framework | Angular 21 standalone components |
| Language | TypeScript 5.9 with strict compiler settings |
| Runtime/package manager | Node 22 in Docker build, npm 11.6.1 lockfile |
| UI/state | Angular signals, Angular template control flow, template-driven forms with `FormsModule`/`ngModel` |
| HTTP | Angular `HttpClient`, RxJS `finalize` |
| Tests | Angular unit test builder with Vitest/jsdom |
| Hosting/deployment | Docker multi-stage build, nginx static runtime, Railway notes |
| Database | None in this repo; parser API owns resume storage |
| Important libraries | `@angular/*`, `rxjs`, `html2pdf.js`, `html-docx-js-typescript` (verify usage before changing) |

# Important Folders and Files

| Path | Purpose |
| --- | --- |
| `src/main.ts` | Browser bootstrap entrypoint. |
| `src/app/app.ts`, `app.html`, `app.css` | Root app shell, header/menu/theme UI, router outlet. |
| `src/app/app.routes.ts` | Routes `/` to `/upload`, renders resume upload page, redirects unknown paths. |
| `src/app/app.config.ts` | App providers for router, HTTP client, and global error listeners. |
| `src/app/resume-upload/` | Main feature component, template, styles, and tests for upload/list/edit/preview workflow. |
| `src/app/services/resume-api.ts` | Central API contracts, runtime URL resolution, and all parser/template API calls. |
| `src/styles.css` | Global styles. |
| `public/runtime-config.js` | Local runtime API URL defaults loaded by the browser. No secrets. |
| `Dockerfile` | Builds Angular app and serves `dist/resume-generator-spa/browser` with nginx. |
| `docker-entrypoint.sh` | Generates runtime config and nginx listen port from environment variables. |
| `nginx.conf` | Static SPA fallback config; entrypoint currently writes the active runtime config. Verify before changing. |
| `RAILWAY_DEPLOYMENT.md` | Railway deployment and CORS notes. |
| `angular.json`, `tsconfig*.json`, `package.json` | Angular build/test/project configuration and npm scripts. |

# Application Flow

1. User opens `/upload`; `ResumeUpload.ngOnInit()` loads saved resumes with `GET /api/resumes?limit=100&skip=0`.
2. User selects a PDF/DOC/DOCX and optional job description.
3. `ResumeApi.parseResume()` sends `multipart/form-data` to parser API `POST /api/resumes/parse`.
4. Successful parse stores the returned resume id, refreshes saved resumes, and shows parser response details.
5. Selecting a saved resume calls template API `POST /api/Resumes/preview` with template ids:
   - `modern-minimal`
   - `professional-dark-blue`
6. Preview HTML is wrapped and rendered in a sandboxed iframe via `[srcdoc]`.
7. Download buttons call template API `POST /api/Resumes/pdf` or `POST /api/Resumes/word` and save the returned Blob.
8. Regenerate/edit flow loads full resume data from parser API `GET /api/resumes/{resumeId}`, maps nested profile fields into form fields, and saves an edited copy with `POST /api/resumes/{resumeId}/edits`.
9. `Save & regenerate` previews the new edited resume id after saving.

# Key Domain Models

| Model/interface | Location | Represents |
| --- | --- | --- |
| `ParsedResumeResponse` | `src/app/services/resume-api.ts` | Parser response after upload; may include `id`, `resumeId`, `fileName`, `profile`, and metadata. |
| `CandidateProfile` | `src/app/services/resume-api.ts` | Candidate identity and headline fields such as name, email, title, headline. |
| `ResumeProfile` | `src/app/services/resume-api.ts` | Flexible parsed profile object; nested data may be incomplete. |
| `ResumeDocumentResponse` | `src/app/services/resume-api.ts` | Full saved resume document with `id`, `profile`, `metadata`, `source`, timestamps. |
| `ResumeEditRequest` | `src/app/services/resume-api.ts` | Payload for saving an edited copy. |
| `SavedResume`/`SavedResumesResponse` | `src/app/services/resume-api.ts` | Saved resume list item and paged list response. |
| `ResumePreviewRequest`/`ResumePreviewResponse` | `src/app/services/resume-api.ts` | Template preview request and returned rendered HTML by template id. |
| `WorkExperienceEditItem`, `EducationEditItem`, `CertificationEditItem` | `src/app/resume-upload/resume-upload.ts` | Local edit-form view models. |

Important nested profile sections used by the editor:

- `candidateProfile`
- `careerClassification`
- `careerProgression`
- `resumeBlocks`
- `coreSkills`
- `workExperience`
- `education`
- `certificationsAndLicenses`
- `professionalSummaryPoints`

# Configuration and Environment Variables

| Name/path | Purpose |
| --- | --- |
| `window.__RESUME_GENERATOR_CONFIG__` | Runtime browser config object with optional `parserApiUrl` and `templateApiUrl`. |
| `public/runtime-config.js` | Local defaults: parser `http://localhost:8000`, template `http://localhost:8080`. |
| `PARSER_API_URL` | Docker/Railway parser API base URL. Do not hardcode deployed URLs in TypeScript. |
| `TEMPLATE_API_URL` | Docker/Railway template API base URL. Do not hardcode deployed URLs in TypeScript. |
| `PORT` | nginx listen port generated at container startup; Railway provides it. |
| `docker-entrypoint.sh` | Normalizes bare domains to `https://`, trims only through app helper, and writes runtime config. |

No secrets should be added to source files, `public/runtime-config.js`, Docker layers, or docs.

# Build, Run, and Test Commands

| Task | Command |
| --- | --- |
| Install dependencies | `npm install` |
| Run local dev server | `npm start` or `npm run ng -- serve` |
| Build production app | `npm run build` |
| Watch development build | `npm run watch` |
| Run unit tests | `npm test` |
| Lint | No lint script is currently defined; verify before adding one. |

Build output is `dist/resume-generator-spa/browser`.

# Coding Rules for Codex

- Make small focused changes only.
- Do not refactor unrelated code.
- Do not rename public APIs, route paths, environment variables, or backend DTO fields unless the issue explicitly asks.
- Do not introduce new packages without explaining why.
- Prefer modifying existing Angular patterns instead of creating new architecture.
- Keep generated PRs small and reviewable.
- Update tests only where relevant to the changed behavior.
- Do not modify authentication, deployment, Docker, nginx, or environment files unless required by the issue.
- Centralize backend calls and DTO/interface changes in `src/app/services/resume-api.ts`.
- Preserve unknown backend fields when editing nested resume data.
- Keep optional empty date fields as `null` where existing code does so.
- Keep preview iframe sandbox restrictive unless a requested feature requires more capability.
- Surface API `detail` or `message` errors through `ResumeUpload.resolveErrorMessage`; do not leak stack traces.

# Areas to Avoid Unless Requested

| Path/area | Why |
| --- | --- |
| `Dockerfile` | Affects deployment image and static hosting. |
| `docker-entrypoint.sh` | Controls runtime URL injection and nginx port config. |
| `public/runtime-config.js` | Runtime API defaults; do not add secrets or deployed hardcoded values. |
| `RAILWAY_DEPLOYMENT.md` | Deployment guidance; update only for deployment changes. |
| `angular.json`, `tsconfig*.json`, `package-lock.json` | Build/test/tooling behavior; change only when necessary. |
| `src/app/services/resume-api.ts` runtime URL handling | Must preserve runtime configuration pattern. |
| Preview iframe sandbox and sanitizer usage | Security-sensitive; verify requirements before changing. |

# Common Change Locations

| Task | Likely files |
| --- | --- |
| Upload UI, saved resume list, preview/edit modal behavior | `src/app/resume-upload/resume-upload.ts`, `.html`, `.css`, `.spec.ts` |
| Parser/template API endpoint or DTO change | `src/app/services/resume-api.ts`, then consuming component/tests |
| Route/navigation change | `src/app/app.routes.ts`, `src/app/app.ts`, `src/app/app.html`, `src/app/app.spec.ts` |
| Header/menu/theme UI change | `src/app/app.*` |
| Resume editor field mapping | `src/app/resume-upload/resume-upload.ts` helpers such as `populateEditForm()` and `buildEditedProfile()` |
| Error message behavior | `ResumeUpload.resolveErrorMessage()` |
| Template id list | `ResumeUpload.defaultTemplateIds` and any template API expectations |
| Runtime API URL change | `public/runtime-config.js`, `docker-entrypoint.sh`, `RAILWAY_DEPLOYMENT.md`; verify before changing |
| Docker/Railway deployment behavior | `Dockerfile`, `docker-entrypoint.sh`, `RAILWAY_DEPLOYMENT.md` |
| Unit test updates | `src/app/**/*.spec.ts` |

# Multi-Repo Notes

This SPA depends on backend services that are not present in this repository:

| Related service/repo | Owns | Codex guidance |
| --- | --- | --- |
| Parser API | Resume storage, upload parsing, saved resume retrieval, edited resume copies. Endpoints under `/api/resumes`. | Do not change this SPA to compensate for unknown backend changes without verifying the parser contract. |
| Template API | HTML previews and PDF/Word rendering. Endpoints under `/api/Resumes`. | Template rendering bugs may belong in the template service; verify before changing SPA download/preview code. |

Exact related repository names are not documented here; verify before changing cross-service contracts.

# How to use this file in future Codex issues

- Read this file first to understand the repo boundaries and likely change locations.
- Then inspect only the files relevant to the requested issue.
- Prefer existing patterns in the mapped files and run `npm run build`; run `npm test` for behavior or component changes.
