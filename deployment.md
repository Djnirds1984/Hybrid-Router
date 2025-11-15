# Hybrid Router Deployment Guide

## Overview
- Installs and runs Hybrid Router on Ubuntu Linux and Raspberry Pi 3B+.
- Covers prerequisites, build, system services, and network configuration (NAT/AP).

## Supported Boards
- Ubuntu Server x86_64 (Intel Xeon-class servers)
- Ubuntu Server ARM64 (general ARM boards)
- Raspberry Pi 3B+ (Ubuntu Server 22.04/24.04 ARM64 or Raspberry Pi OS)

## Prerequisites
- Update system: `sudo apt update && sudo apt upgrade -y`
- Install packages:
  - `sudo apt install -y git nodejs npm python3 python3-psutil python3-netifaces dnsmasq hostapd iptables nftables net-tools bridge-utils sqlite3`
- Enable IP forwarding:
  - `echo 'net.ipv4.ip_forward=1' | sudo tee /etc/sysctl.d/99-router.conf`
  - `sudo sysctl -p /etc/sysctl.d/99-router.conf`

## Clone and Build
- Clone repo: `git clone https://github.com/Djnirds1984/Hybrid-Router.git && cd Hybrid-Router`
- Install API deps: `npm ci`
- Build Web UI:
  - `cd web && npm ci && npm run build && cd ..`
  - Built files land in `public/`

## Run (Development)
- Start API: `npm run dev:api` (port `8080`)
- Start UI: `npm run dev:web` (port `3000`, proxies `/api` and `/ws`)
- Open UI: `http://localhost:3000`

## Production Layout
- Copy project to `/opt/hybrid-router`:
  - `sudo mkdir -p /opt/hybrid-router && sudo rsync -a --exclude='.git' ./ /opt/hybrid-router/`
- Alternatively, clone directly from GitHub to `/opt/hybrid-router`:
  - `sudo git clone https://github.com/Djnirds1984/Hybrid-Router.git /opt/hybrid-router`
- Install dependencies under `/opt/hybrid-router`:
  - `cd /opt/hybrid-router && sudo npm ci && cd web && sudo npm ci && sudo npm run build && cd ..`

## Systemd Service (API)
- Run: `sudo bash scripts/install_api_service.sh`
- Optional flags:
  - `--install-dir /opt/hybrid-router`
  - `--port 8080`
  - `--jwt-secret <secret>`
  - `--default-admin <password>`
  - `--node /usr/bin/node`
-
- After installation, the service runs automatically; status: `systemctl status hybrid-router`

## Reverse Proxy
For larger deployments, use a reverse proxy to serve the UI and forward API and WebSocket traffic.

### Nginx
- Run: `sudo bash scripts/install_nginx_proxy.sh`
- Optional flags:
  - `--install-dir /opt/hybrid-router`
  - `--api-port 8080`
  - `--server-name your.domain`
  - `--enable-tls true` `--email admin@your.domain`

### Apache
- Run: `sudo bash scripts/install_apache_proxy.sh`
- Optional flags:
  - `--install-dir /opt/hybrid-router`
  - `--api-port 8080`
  - `--server-name your.domain`
  - `--enable-tls true` `--email admin@your.domain`

## NAT Router (Ethernet WAN, Wi-Fi LAN)
All configuration is handled by the installation script. No manual CLI steps are required beyond initial system updates and cloning.

### Installation Script
- Run: `sudo bash scripts/install_nat_router.sh`
- Optional flags:
  - `--wan eth0` `--lan wlan0` `--lan-subnet 192.168.50.0/24`
  - `--lan-start 192.168.50.10` `--lan-end 192.168.50.200` `--lan-gw 192.168.50.1`
  - `--ssid HybridRouter` `--psk ChangeMeStrong!` `--channel 6`
  - `--firewall nftables|iptables`
  - `--install-dir /opt/hybrid-router` `--jwt-secret <secret>` `--default-admin <password>`

## DHCP Server (dnsmasq)
Configured automatically by the installation script; no manual steps required.

## Wireless AP (hostapd)
Configured automatically by the installation script; no manual steps required.

## Raspberry Pi 3B+ Notes
- OS: Ubuntu Server ARM64 or Raspberry Pi OS Lite.
- Interface names typically `eth0` (wired), `wlan0` (built-in Wi‑Fi).
- Performance tips:
  - Heatsinks/fan recommended.
  - Prefer USB gigabit adapter for extra LAN/WAN ports.
  - Use quality microSD (A2/U1 or better).

## Security Hardening
- Change `JWT_SECRET` and UI admin password immediately.
- Restrict management UI to LAN via firewall rules.
- Keep system updated: `sudo apt update && sudo apt upgrade -y`
- Consider fail2ban for SSH and UI endpoints.

## Troubleshooting
- API logs: `/opt/hybrid-router/logs/*.log`
- Service status: `systemctl status hybrid-router`
- DNS/DHCP: `journalctl -u dnsmasq -f`
- AP: `journalctl -u hostapd -f`
- Firewall: `sudo nft list ruleset` or `sudo iptables -L -n -v`

## Update
- Pull changes: `cd /opt/hybrid-router && sudo git pull`
- Rebuild UI: `cd web && sudo npm run build`
- Restart API: `sudo systemctl restart hybrid-router`

## Uninstall
- Disable services: `sudo systemctl disable --now hybrid-router dnsmasq hostapd`
- Remove files: `sudo rm -rf /opt/hybrid-router`