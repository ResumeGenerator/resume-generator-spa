# Railway deployment

Deploy this SPA as a Dockerfile-based Railway service.

Set these Railway variables on the SPA service:

```text
PARSER_API_URL=https://your-parser-api.up.railway.app
TEMPLATE_API_URL=https://your-template-api.up.railway.app
```

Include the `https://` prefix. The container also normalizes bare Railway domains, but using the full URL keeps the generated config clear.

Railway provides `PORT` automatically. The container uses it at startup.

The parser API and template API must allow the SPA Railway domain in their CORS settings.
For example:

```text
CORS_ORIGINS=https://your-spa.up.railway.app
Cors__AllowedOrigins__0=https://your-spa.up.railway.app
```

Local Docker defaults still point to:

```text
PARSER_API_URL=http://localhost:8000
TEMPLATE_API_URL=http://localhost:8080
```
