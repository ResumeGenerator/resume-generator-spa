# AGENTS.md

Guidance for Codex or other coding agents working on this repository.

## Project Overview

This repository is an Angular 21 single-page application for uploading, parsing, editing, previewing, and downloading resumes.

The SPA talks to two backend services:

- Parser API: stores resumes, parses uploaded PDF/DOC/DOCX files, returns saved resume records, and accepts edited resume copies.
- Template API: renders saved resumes into HTML previews and downloadable PDF/Word documents.

The main user flow is:

1. Upload a resume file with an optional target job description.
2. Send the file to the parser API as `multipart/form-data`.
3. List saved resumes from the parser API.
4. Preview a saved resume through the template API.
5. Edit structured resume fields and save an edited copy.
6. Download generated PDF or Word output for a selected template.

## Tech Stack

- Angular `^21.0.0`
- TypeScript `~5.9.2`
- Angular standalone components
- Angular signals for component state
- Angular forms with `FormsModule` and `ngModel`
- Angular `HttpClient`
- RxJS `finalize`
- Vitest through Angular test tooling
- Docker multi-stage build with nginx runtime serving static files

## Important Files

- `src/app/resume-upload/resume-upload.ts`: main feature component and most UI state/business logic.
- `src/app/resume-upload/resume-upload.html`: upload, saved resume list, edit modal, and preview modal template.
- `src/app/resume-upload/resume-upload.css`: feature styling and responsive layout.
- `src/app/services/resume-api.ts`: API contracts, endpoint URLs, and HTTP methods.
- `src/app/app.routes.ts`: routes root path to `ResumeUpload` and redirects unknown paths.
- `src/app/app.config.ts`: app providers for router and HTTP client.
- `public/runtime-config.js`: local runtime API URL defaults.
- `docker-entrypoint.sh`: generates runtime config from environment variables in Docker/Railway.
- `Dockerfile`: builds Angular app and serves it with nginx.
- `RAILWAY_DEPLOYMENT.md`: deployment notes and required environment variables.

## Commands

Use npm scripts from `package.json`:

```bash
npm install
npm start
npm run build
npm test
```

Useful details:

- `npm start` runs `ng serve`.
- `npm run build` runs the production Angular build.
- `npm test` runs Angular tests using the configured test runner.
- Build output is under `dist/resume-generator-spa/browser`.

## Runtime Configuration

Do not hardcode deployed API URLs in TypeScript.

Runtime URLs are read from:

```ts
window.__RESUME_GENERATOR_CONFIG__
```

The shape is declared in `src/app/services/resume-api.ts`:

```ts
{
  apiGatewayUrl?: string;
  parserApiUrl?: string;
  templateApiUrl?: string;
  authApiUrl?: string;
  authRedirectUri?: string;
}
```

Local defaults:

- API Gateway: unset
- Parser API: `http://localhost:8000`
- Template API: `http://localhost:8080`

Docker/Railway values are injected by `docker-entrypoint.sh` from:

- `API_GATEWAY_URL`
- `PARSER_API_URL`
- `TEMPLATE_API_URL`
- `AUTH_API_URL`
- `PORT`

When `apiGatewayUrl` / `API_GATEWAY_URL` is set, parser, template, and auth service calls use that base URL. The gateway must route the current frontend paths (`/api/resumes/*`, `/api/Resumes/*`, and `/api/auth/*`) to the appropriate backend services. The split service URLs remain as fallbacks for local development and non-gateway deployments.

The `ResumeApi.resolveBaseUrl` helper normalizes missing protocols to `https://` and trims trailing slashes.

## API Surface

Centralize backend calls in `src/app/services/resume-api.ts`.

Parser API endpoints currently used:

- `GET /api/resumes?limit=100&skip=0`
- `GET /api/resumes/{resumeId}`
- `POST /api/resumes/parse`
- `POST /api/resumes/{resumeId}/edits`

Template API endpoints currently used:

- `POST /api/Resumes/preview`
- `POST /api/Resumes/pdf`
- `POST /api/Resumes/word`

Current template IDs:

- `modern-minimal`
- `professional-dark-blue`

When adding API calls, add or update TypeScript interfaces in `resume-api.ts` and keep the component using typed service methods instead of inline `HttpClient` calls.

## Angular Conventions

Follow the existing Angular style:

- Use standalone components with `imports` in the `@Component` metadata.
- Use signals for local UI state.
- Keep template-driven form fields using `FormsModule` and named `ngModel` controls unless refactoring is explicitly requested.
- Use Angular control-flow syntax already present in templates: `@if`, `@else`, and `@for`.
- Keep route changes in `src/app/app.routes.ts`.
- Keep HTTP setup in `src/app/app.config.ts`.
- Prefer typed helper methods for unknown backend payloads. Existing examples include `asRecord`, `asRecordArray`, `asStringArray`, and `asString`.

## Resume Data Shape Notes

The parser returns nested resume profile data that may be incomplete, so UI code should tolerate missing fields.

Important profile sections used by the editor:

- `candidateProfile`
- `careerClassification`
- `careerProgression`
- `resumeBlocks`
- `coreSkills`
- `workExperience`
- `education`
- `certificationsAndLicenses`
- `professionalSummaryPoints`

When editing resume data:

- Preserve unknown fields by cloning and spreading existing records.
- Convert textarea line lists to arrays with trimming and de-duplication.
- Keep empty optional date fields as `null` where the current code does so.
- Keep edited resumes as new saved copies through `/api/resumes/{resumeId}/edits`; do not overwrite the original record unless the backend contract changes.

## UI Guidelines For This App

This is a work-focused resume tool, not a marketing landing page.

When changing UI:

- Keep the first screen as the working resume workspace.
- Preserve responsive behavior for desktop and mobile.
- Keep cards/panels compact with `8px` border radius, matching the current style.
- Avoid adding decorative-only sections or unrelated landing-page content.
- Make controls practical for repeated use: upload, refresh, preview, edit, regenerate, download.
- Ensure long names, emails, filenames, and generated text can wrap without breaking layout.
- Preview HTML is rendered inside a sandboxed iframe via `[srcdoc]`.

## Error Handling

User-facing error messages are resolved in `ResumeUpload.resolveErrorMessage`.

When adding backend interactions:

- Surface meaningful API `detail` or `message` payloads when available.
- Provide fallback messages that mention which service is likely involved.
- Avoid leaking raw stack traces into the UI.

## Security And Safety

- Uploaded files are sent directly to the parser API as form data.
- Preview HTML comes from the template API and is wrapped for iframe display.
- `trustedPreviewHtml` uses Angular `DomSanitizer.bypassSecurityTrustHtml`; treat template API output as trusted only because it is rendered in a sandboxed iframe.
- Keep the preview iframe sandbox restrictive unless a feature explicitly requires more capability.
- Do not add secrets to `public/runtime-config.js`, source files, or Docker image layers.

## Testing And Verification

For most code changes, run:

```bash
npm run build
```

For behavior or component changes, also run:

```bash
npm test
```

If a change depends on live backend services, note which services were unavailable or untested locally.

Manual checks that matter for this app:

- Upload form accepts PDF, DOC, and DOCX.
- Saved resume list loads and refreshes.
- Preview modal opens and template navigation works.
- PDF and Word downloads trigger for the active template.
- Edit modal loads, saves an edited copy, and save/regenerate previews the edited resume.
- Mobile layout does not overlap controls or modal content.

## Deployment Notes

The Docker image builds the Angular app, then serves static output with nginx.

At container startup, `docker-entrypoint.sh` writes `/usr/share/nginx/html/runtime-config.js` using environment variables. Keep this runtime injection pattern so the same built image can be promoted between environments.

For Railway:

- Set `API_GATEWAY_URL` when routing service calls through a gateway.
- Keep `PARSER_API_URL`, `TEMPLATE_API_URL`, and `AUTH_API_URL` only as fallback values for non-gateway deployments.
- Railway provides `PORT`.
- The API gateway must allow the SPA origin in CORS; downstream services may also need the SPA origin if they own CORS headers.

## Agent Workflow

Before making changes:

1. Read the relevant files instead of guessing.
2. Check `git status --short`.
3. Preserve unrelated user changes.

When implementing:

- Keep changes scoped to the requested feature or fix.
- Reuse existing helpers and patterns before adding abstractions.
- Add interfaces near the API/service layer when backend shapes change.
- Prefer small, focused component helpers over large template expressions.
- Do not introduce new state management libraries unless explicitly requested.

Before finishing:

- Run the appropriate build/test command when feasible.
- Report any commands that could not be run.
- Mention backend-dependent behavior that was not verified locally.
