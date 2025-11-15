#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR=${INSTALL_DIR:-/opt/hybrid-router}
PORT=${PORT:-8080}
JWT_SECRET=${JWT_SECRET:-change_me}
DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD:-admin}
NODE_BIN=${NODE_BIN:-/usr/bin/node}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir) INSTALL_DIR="$2"; shift 2;;
    --port) PORT="$2"; shift 2;;
    --jwt-secret) JWT_SECRET="$2"; shift 2;;
    --default-admin) DEFAULT_ADMIN_PASSWORD="$2"; shift 2;;
    --node) NODE_BIN="$2"; shift 2;;
    *) shift;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi

if command -v apt-get >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y build-essential python3-dev pkg-config
fi

mkdir -p "$INSTALL_DIR"
rsync -a --exclude='.git' --exclude='node_modules' ./ "$INSTALL_DIR"/
cd "$INSTALL_DIR"

if command -v npm >/dev/null 2>&1; then
  npm ci || npm install
  cd web && npm ci || npm install
  npm run build
  cd ..
fi

mkdir -p ${INSTALL_DIR}/logs ${INSTALL_DIR}/api/data

cat > /etc/systemd/system/hybrid-router.service <<EOF
[Unit]
Description=Hybrid Router API
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=${NODE_BIN} ${INSTALL_DIR}/api/server.js
Restart=always
User=root
Environment=PORT=${PORT}
Environment=JWT_SECRET=${JWT_SECRET}
Environment=DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable hybrid-router
systemctl restart hybrid-router

echo "Hybrid Router API service installed and started on port ${PORT}"