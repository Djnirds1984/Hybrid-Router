#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR=${INSTALL_DIR:-/opt/hybrid-router}
API_PORT=${API_PORT:-8080}
SERVER_NAME=${SERVER_NAME:-_}
ENABLE_TLS=${ENABLE_TLS:-false}
EMAIL=${EMAIL:-}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir) INSTALL_DIR="$2"; shift 2;;
    --api-port) API_PORT="$2"; shift 2;;
    --server-name) SERVER_NAME="$2"; shift 2;;
    --enable-tls) ENABLE_TLS="$2"; shift 2;;
    --email) EMAIL="$2"; shift 2;;
    *) shift;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi

apt-get update -y
apt-get install -y nginx

PUB_DIR="${INSTALL_DIR}/public"
mkdir -p "$PUB_DIR"

cat > /etc/nginx/sites-available/hybrid-router <<EOF
server {
  listen 80 default_server;
  server_name ${SERVER_NAME};
  root ${PUB_DIR};
  index index.html;

  location / {
    try_files \$uri \$uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:${API_PORT}/api/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /ws {
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_pass http://127.0.0.1:${API_PORT}/ws;
  }
}
EOF

ln -sf /etc/nginx/sites-available/hybrid-router /etc/nginx/sites-enabled/hybrid-router
# Disable default site to prevent Nginx welcome page
if [ -e /etc/nginx/sites-enabled/default ]; then rm -f /etc/nginx/sites-enabled/default; fi
nginx -t
systemctl enable nginx
systemctl restart nginx

if [[ "$ENABLE_TLS" == "true" && "$SERVER_NAME" != "_" ]]; then
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$SERVER_NAME" --non-interactive --agree-tos -m "$EMAIL"
fi

echo "Nginx reverse proxy installed"