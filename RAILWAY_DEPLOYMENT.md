# Railway deployment

Deploy this SPA as a Dockerfile-based Railway service.

Set these Railway variables on the SPA service:

```text
API_GATEWAY_URL=https://your-api-gateway.up.railway.app
```

Include the `https://` prefix. The container also normalizes bare Railway domains, but using the full URL keeps the generated config clear.

When `API_GATEWAY_URL` is set, the SPA sends parser, template, and auth service requests through the gateway. The gateway must route the existing frontend paths:

```text
/api/resumes/*
/api/Resumes/*
/api/auth/*
```

`PARSER_API_URL`, `TEMPLATE_API_URL`, and `AUTH_API_URL` are still supported as fallbacks for local development or older deployments that do not use the gateway.

Railway provides `PORT` automatically. The container uses it at startup.

The API gateway must allow the SPA Railway domain in its CORS settings. If your gateway forwards browser CORS headers from downstream services instead of handling CORS itself, the downstream services must allow the SPA Railway domain too.
For example:

```text
CORS_ORIGINS=https://your-spa.up.railway.app
Cors__AllowedOrigins__0=https://your-spa.up.railway.app
```

Local Docker defaults still point to:

```text
API_GATEWAY_URL=
PARSER_API_URL=http://localhost:8000
TEMPLATE_API_URL=http://localhost:8080
```
