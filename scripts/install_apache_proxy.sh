#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR=${INSTALL_DIR:-/opt/hybrid-router}
API_PORT=${API_PORT:-8080}
SERVER_NAME=${SERVER_NAME:-_default_}
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
apt-get install -y apache2
a2enmod proxy proxy_http proxy_wstunnel rewrite

PUB_DIR="${INSTALL_DIR}/public"
mkdir -p "$PUB_DIR"

cat > /etc/apache2/sites-available/hybrid-router.conf <<EOF
<VirtualHost *:80>
    ServerName ${SERVER_NAME}
    DocumentRoot ${PUB_DIR}

    <Directory ${PUB_DIR}>
        AllowOverride All
        Require all granted
    </Directory>

    ProxyPass /api http://127.0.0.1:${API_PORT}/api
    ProxyPassReverse /api http://127.0.0.1:${API_PORT}/api

    ProxyPass /ws ws://127.0.0.1:${API_PORT}/ws
    ProxyPassReverse /ws ws://127.0.0.1:${API_PORT}/ws

    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.html [QSA,L]
</VirtualHost>
EOF

a2ensite hybrid-router
systemctl enable apache2
systemctl restart apache2

if [[ "$ENABLE_TLS" == "true" && "$SERVER_NAME" != "_default_" ]]; then
  apt-get install -y certbot python3-certbot-apache
  certbot --apache -d "$SERVER_NAME" --non-interactive --agree-tos -m "$EMAIL"
fi

echo "Apache reverse proxy installed"