# Hybrid Router

A modular, Ubuntu-focused router platform optimized for Raspberry Pi 3B+. It combines traditional routing (NAT, DHCP, DNS, firewall) with modern management via a web UI and REST APIs.

## Features
- Routing and NAT with iptables/nftables
- DHCP server management (dnsmasq)
- DNS forwarding and caching
- Firewall rules management
- Wireless AP integration (hostapd)
- Configuration storage in SQLite
- Web management UI (React + Vite + Tailwind)
- Real-time system stats via WebSocket
- System service control and logs

## Architecture
- API: `Express` server (`api/server.js`) with `helmet`, `cors`, rate limiting, and `winston` logging
- System calls: Python scripts in `api/scripts/*` for network, DHCP, firewall, and system operations
- Storage: `SQLite` DB (`api/data/router.db`) via routes in `api/routes/config.js`
- UI: React app built with Vite, served from `public/` by the API or via dev server
- Live updates: WebSocket broadcast for system metrics

## Project Structure
- `api/server.js` — API server
- `api/routes/` — REST endpoints (`auth.js`, `network.js`, `system.js`, `config.js`)
- `api/scripts/` — Python utilities (`network_utils.py`, `dhcp_utils.py`, `firewall_utils.py`, `system_utils.py`)
- `api/data/` — SQLite database
- `public/` — Built web assets served by API
- `web/` — React UI source (Vite + Tailwind)
- `deployment.md` — Board installation and service setup guide

## Requirements
- Ubuntu Server 22.04/24.04 (x86_64 or ARM64) or Raspberry Pi 3B+
- Node.js 18+ and npm
- Python 3 with `psutil`, `netifaces`
- `dnsmasq`, `hostapd`, `iptables`/`nftables`, `sqlite3`

## Quick Start (Development)
- `npm install`
- `cd web && npm install && npm run dev`
- Run API: `npm run dev:api`
- Open UI: `http://localhost:3000` (proxies `/api` → `http://localhost:8080`)

## Build UI (Production)
- `cd web && npm ci && npm run build`
- Built files output to `public/`

## Environment Variables
- `PORT` — API port (default `8080`)
- `JWT_SECRET` — token secret for admin auth

## Key Endpoints
- `GET /api/health` — API health status
- `POST /api/auth/login` — JWT login
- `GET /api/network/interfaces` — list interfaces
- `POST /api/network/configure-interface` — configure interface
- `GET /api/network/dhcp-leases` — DHCP leases
- `GET /api/network/firewall-rules` — firewall rules
- `POST /api/network/firewall-rules` — add firewall rule
- `GET /api/system/status` — system status
- `GET /api/system/resources` — CPU/mem/disk/net usage
- `POST /api/system/reboot` — reboot
- `GET /api/config/*` — configuration and backup

## Deployment
- See `deployment.md` for step-by-step installation, systemd service setup, NAT/AP configuration, and troubleshooting.

## Raspberry Pi 3B+
- Use Ubuntu Server ARM64 or Raspberry Pi OS Lite
- Typical interfaces: `eth0` (WAN) and `wlan0` (LAN/AP)
- Prefer nftables for persistent NAT and forwarding rules
- Heatsink/fan and quality microSD recommended

## Security
- Change `JWT_SECRET` and admin credentials
- Restrict UI to LAN via firewall rules
- Keep system packages updated

## License
- MIT