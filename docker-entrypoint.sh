#!/bin/sh
set -eu

: "${PORT:=80}"
: "${PARSER_API_URL:=http://localhost:8000}"
: "${TEMPLATE_API_URL:=http://localhost:8080}"

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__RESUME_GENERATOR_CONFIG__ = {
  parserApiUrl: '${PARSER_API_URL}',
  templateApiUrl: '${TEMPLATE_API_URL}',
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
