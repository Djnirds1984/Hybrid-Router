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
  - `sudo apt install -y git nodejs npm python3 python3-pip dnsmasq hostapd iptables nftables net-tools bridge-utils sqlite3`
- Python libs: `pip3 install psutil netifaces`
- Enable IP forwarding:
  - `echo 'net.ipv4.ip_forward=1' | sudo tee /etc/sysctl.d/99-router.conf`
  - `sudo sysctl -p /etc/sysctl.d/99-router.conf`

## Clone and Build
- Clone repo: `git clone https://github.com/<your-org>/Hybrid-Router.git && cd Hybrid-Router`
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
- Install dependencies under `/opt/hybrid-router`:
  - `cd /opt/hybrid-router && sudo npm ci && cd web && sudo npm ci && sudo npm run build && cd ..`

## Systemd Service (API)
- Create unit `/etc/systemd/system/hybrid-router.service`:
```
[Unit]
Description=Hybrid Router API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/hybrid-router
ExecStart=/usr/bin/node /opt/hybrid-router/api/server.js
Restart=always
User=root
Environment=PORT=8080
Environment=JWT_SECRET=change_me

[Install]
WantedBy=multi-user.target
```
- Enable and start:
  - `sudo systemctl daemon-reload`
  - `sudo systemctl enable hybrid-router`
  - `sudo systemctl start hybrid-router`
- Check status: `systemctl status hybrid-router`

## NAT Router (Ethernet WAN, Wi-Fi LAN)
- Replace interface names as needed (`eth0` WAN, `wlan0` LAN).
- iptables (legacy):
  - `sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE`
  - `sudo iptables -A FORWARD -i eth0 -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT`
  - `sudo iptables -A FORWARD -i wlan0 -o eth0 -j ACCEPT`
  - Persist: `sudo sh -c 'iptables-save > /etc/iptables/rules.v4'`
- nftables (preferred on Ubuntu):
  - `sudo nft add table ip nat`
  - `sudo nft add chain ip nat postrouting '{ type nat hook postrouting priority 100; }'`
  - `sudo nft add rule ip nat postrouting oifname "eth0" masquerade`
  - Forwarding example:
    - `sudo nft add table ip filter`
    - `sudo nft add chain ip filter forward '{ type filter hook forward priority 0; policy drop; }'`
    - `sudo nft add rule ip filter forward ct state established,related accept`
    - `sudo nft add rule ip filter forward iifname "wlan0" oifname "eth0" accept`
  - Persist: create `/etc/nftables.conf` and run `sudo systemctl enable --now nftables`

## DHCP Server (dnsmasq)
- The API’s Python script can generate per-interface configs under `/etc/dnsmasq.d/`.
- Manual config example `/etc/dnsmasq.d/dhcp-wlan0.conf`:
```
interface=wlan0
dhcp-range=192.168.50.10,192.168.50.200,255.255.255.0,24h
dhcp-option=3,192.168.50.1
dhcp-option=6,1.1.1.1,8.8.8.8
```
- Restart service: `sudo systemctl restart dnsmasq`

## Wireless AP (hostapd)
- Create `/etc/hostapd/hostapd.conf`:
```
interface=wlan0
driver=nl80211
ssid=HybridRouter
hw_mode=g
channel=6
wpa=2
wpa_passphrase=ChangeMeStrong!
wpa_key_mgmt=WPA-PSK
wpa_pairwise=CCMP
ieee80211n=1
```
- Enable hostapd: `sudo systemctl enable --now hostapd`

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
