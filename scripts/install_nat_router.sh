#!/usr/bin/env bash
set -euo pipefail

WAN_IF=${WAN_IF:-eth0}
LAN_IF=${LAN_IF:-wlan0}
LAN_SUBNET=${LAN_SUBNET:-192.168.50.0/24}
LAN_START=${LAN_START:-192.168.50.10}
LAN_END=${LAN_END:-192.168.50.200}
LAN_GW=${LAN_GW:-192.168.50.1}
SSID=${SSID:-HybridRouter}
PSK=${PSK:-ChangeMeStrong!}
CHANNEL=${CHANNEL:-6}
COUNTRY_CODE=${COUNTRY_CODE:-US}
FIREWALL=${FIREWALL:-nftables}
INSTALL_DIR=${INSTALL_DIR:-/opt/hybrid-router}
JWT_SECRET=${JWT_SECRET:-change_me}
DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD:-admin}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wan) WAN_IF="$2"; shift 2;;
    --lan) LAN_IF="$2"; shift 2;;
    --lan-subnet) LAN_SUBNET="$2"; shift 2;;
    --lan-start) LAN_START="$2"; shift 2;;
    --lan-end) LAN_END="$2"; shift 2;;
    --lan-gw) LAN_GW="$2"; shift 2;;
    --ssid) SSID="$2"; shift 2;;
    --psk) PSK="$2"; shift 2;;
    --channel) CHANNEL="$2"; shift 2;;
    --firewall) FIREWALL="$2"; shift 2;;
    --install-dir) INSTALL_DIR="$2"; shift 2;;
    --jwt-secret) JWT_SECRET="$2"; shift 2;;
    --default-admin) DEFAULT_ADMIN_PASSWORD="$2"; shift 2;;
    *) shift;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi

PREFIX=${LAN_SUBNET#*/}
case "$PREFIX" in
  8) NETMASK=255.0.0.0 ;;
  12) NETMASK=255.240.0.0 ;;
  16) NETMASK=255.255.0.0 ;;
  20) NETMASK=255.255.240.0 ;;
  24) NETMASK=255.255.255.0 ;;
  28) NETMASK=255.255.255.240 ;;
  30) NETMASK=255.255.255.252 ;;
  32) NETMASK=255.255.255.255 ;;
  *) NETMASK=255.255.255.0 ;;
esac

apt-get update -y
apt-get install -y dnsmasq hostapd nftables iptables iptables-persistent net-tools bridge-utils sqlite3 python3 python3-psutil python3-netifaces rfkill

echo net.ipv4.ip_forward=1 > /etc/sysctl.d/99-router.conf
sysctl -p /etc/sysctl.d/99-router.conf

ip link set "$LAN_IF" up || true
ip addr flush dev "$LAN_IF" || true
ip addr add "$LAN_GW/$PREFIX" dev "$LAN_IF"
rfkill unblock wifi || true

mkdir -p /etc/dnsmasq.d
cat > /etc/dnsmasq.conf <<EOF
port=0
conf-dir=/etc/dnsmasq.d,*.conf
bind-interfaces
except-interface=lo
EOF
cat > /etc/default/dnsmasq <<EOF
ENABLED=1
DNSMASQ_OPTS="--conf-file=/etc/dnsmasq.conf --port=0"
EOF
cat > "/etc/dnsmasq.d/dhcp-${LAN_IF}.conf" <<EOF
interface=${LAN_IF}
dhcp-range=${LAN_START},${LAN_END},${NETMASK},24h
dhcp-option=3,${LAN_GW}
dhcp-option=6,1.1.1.1,8.8.8.8
EOF

# Validate dnsmasq config; if it fails on netmask format, fallback to interface-implied netmask
if ! dnsmasq --test >/dev/null 2>&1; then
  sed -i "s/^dhcp-range=.*/dhcp-range=${LAN_START},${LAN_END},24h/" "/etc/dnsmasq.d/dhcp-${LAN_IF}.conf"
fi

systemctl restart dnsmasq
systemctl enable dnsmasq

cat > /etc/hostapd/hostapd.conf <<EOF
interface=${LAN_IF}
driver=nl80211
ssid=${SSID}
hw_mode=g
channel=${CHANNEL}
wpa=2
wpa_passphrase=${PSK}
wpa_key_mgmt=WPA-PSK
wpa_pairwise=CCMP
ieee80211n=1
country_code=${COUNTRY_CODE}
ieee80211d=1
EOF

if [ -f /etc/default/hostapd ]; then
  sed -i 's|^#\?DAEMON_CONF=.*$|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd || true
fi

systemctl restart hostapd
systemctl enable hostapd

if [[ "$FIREWALL" == "nftables" ]]; then
  cat > /etc/nftables.conf <<EOF
flush ruleset
table ip nat {
  chain postrouting { type nat hook postrouting priority 100; }
}
table ip filter {
  chain forward { type filter hook forward priority 0; policy drop; ct state established,related accept; iifname "${LAN_IF}" oifname "${WAN_IF}" accept }
}
add rule ip nat postrouting oifname "${WAN_IF}" masquerade
EOF
  systemctl enable --now nftables
else
  iptables -t nat -A POSTROUTING -o "$WAN_IF" -j MASQUERADE || true
  iptables -A FORWARD -i "$WAN_IF" -o "$LAN_IF" -m state --state RELATED,ESTABLISHED -j ACCEPT || true
  iptables -A FORWARD -i "$LAN_IF" -o "$WAN_IF" -j ACCEPT || true
  mkdir -p /etc/iptables
  iptables-save > /etc/iptables/rules.v4
  systemctl enable netfilter-persistent || true
  systemctl restart netfilter-persistent || true
fi

mkdir -p /etc/netplan
cat > /etc/netplan/99-hybrid-router.yaml <<EOF
network:
  version: 2
  renderer: networkd
  ethernets:
    ${WAN_IF}:
      dhcp4: true
  wifis:
    ${LAN_IF}:
      dhcp4: false
      access-points:
        ${SSID}:
          password: ${PSK}
      addresses:
        - ${LAN_GW}/${PREFIX}
EOF
netplan apply || true

echo "NAT router configured"

# Deploy application and systemd service
mkdir -p "$INSTALL_DIR"
rsync -a --exclude='.git' --exclude='node_modules' ./ "$INSTALL_DIR"/
cd "$INSTALL_DIR"
if command -v npm >/dev/null 2>&1; then
  npm ci || npm install
  cd web && npm ci || npm install
  npm run build
  cd ..
fi

cat > /etc/systemd/system/hybrid-router.service <<EOF
[Unit]
Description=Hybrid Router API
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/node ${INSTALL_DIR}/api/server.js
Restart=always
User=root
Environment=PORT=8080
Environment=JWT_SECRET=${JWT_SECRET}
Environment=DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable hybrid-router
systemctl restart hybrid-router

echo "Hybrid Router service installed and started"