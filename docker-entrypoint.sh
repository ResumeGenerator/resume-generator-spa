#!/bin/sh
set -eu

: "${PORT:=80}"
: "${API_GATEWAY_URL:=}"
: "${PARSER_API_URL:=http://localhost:8000}"
: "${TEMPLATE_API_URL:=http://localhost:8080}"
: "${AUTH_API_URL:=https://resume-generator-auth-api-staging.up.railway.app}"
: "${FRONTEND_POPUP_COMPLETE_URL:=https://resume-generator-spa-staging.up.railway.app/auth/auth-callback}"

normalize_url() {
  case "$1" in
    http://*|https://*) printf '%s' "$1" ;;
    *) printf 'https://%s' "$1" ;;
  esac
}

normalize_optional_url() {
  if [ -n "$1" ]; then
    normalize_url "$1"
  fi
}

API_GATEWAY_URL="$(normalize_optional_url "$API_GATEWAY_URL")"
PARSER_API_URL="$(normalize_url "$PARSER_API_URL")"
TEMPLATE_API_URL="$(normalize_url "$TEMPLATE_API_URL")"
AUTH_API_URL="$(normalize_url "$AUTH_API_URL")"

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__RESUME_GENERATOR_CONFIG__ = {
  apiGatewayUrl: '${API_GATEWAY_URL}',
  parserApiUrl: '${PARSER_API_URL}',
  templateApiUrl: '${TEMPLATE_API_URL}',
  authApiUrl: '${AUTH_API_URL}',
  authRedirectUri: '${FRONTEND_POPUP_COMPLETE_URL}',
};
EOF

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
  listen ${PORT};
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location = /runtime-config.js {
    add_header Cache-Control "no-store";
    try_files \$uri =404;
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }

  location ~* \.(?:js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files \$uri =404;
  }
}
EOF

exec nginx -g "daemon off;"
