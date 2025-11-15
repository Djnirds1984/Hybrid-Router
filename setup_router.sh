#!/usr/bin/env bash
set -euo pipefail

# Minimal one-shot setup for a working hybrid router on Ubuntu
# Features: NAT (nftables), DHCP (dnsmasq), Wi‑Fi AP (hostapd)
# Defaults: WAN=eth0, LAN=wlan0, SSID=HybridRouter, PSK=ChangeMeStrong!, LAN_SUBNET=192.168.50.0/24
# Usage examples:
#   sudo bash setup_router.sh
#   sudo bash setup_router.sh --wan eth0 --lan wlan0 --ssid MyRouter --psk MyPass123! --lan-subnet 192.168.60.0/24 --country US

WAN=${WAN:-eth0}
LAN=${LAN:-wlan0}
SSID=${SSID:-HybridRouter}
PSK=${PSK:-ChangeMeStrong!}
CHANNEL=${CHANNEL:-6}
COUNTRY=${COUNTRY:-US}
LAN_SUBNET=${LAN_SUBNET:-192.168.50.0/24}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wan) WAN="$2"; shift 2;;
    --lan) LAN="$2"; shift 2;;
    --ssid) SSID="$2"; shift 2;;
    --psk) PSK="$2"; shift 2;;
    --channel) CHANNEL="$2"; shift 2;;
    --country) COUNTRY="$2"; shift 2;;
    --lan-subnet) LAN_SUBNET="$2"; shift 2;;
    *) shift;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "Run as root"; exit 1
fi

# Parse subnet and compute netmask + gateway
CIDR=${LAN_SUBNET#*/}
NETWORK=${LAN_SUBNET%/*}
case "$CIDR" in
  8) NETMASK=255.0.0.0 ;;
  12) NETMASK=255.240.0.0 ;;
  16) NETMASK=255.255.0.0 ;;
  20) NETMASK=255.255.240.0 ;;
  24) NETMASK=255.255.255.0 ;;
  28) NETMASK=255.255.255.240 ;;
  30) NETMASK=255.255.255.252 ;;
  32) NETMASK=255.255.255.255 ;;
  *) NETMASK=255.255.255.0 ; CIDR=24 ;;
esac

# Gateway = network with last octet .1 (works for typical /24)
IFS='.' read -r a b c d <<<"$NETWORK"
LAN_GW="$a.$b.$c.1"
RANGE_START="$a.$b.$c.10"
RANGE_END="$a.$b.$c.200"

echo "[+] Installing packages"
apt-get update -y
apt-get install -y nftables dnsmasq hostapd rfkill iproute2 net-tools

echo "[+] Enabling IP forwarding"
sysctl -w net.ipv4.ip_forward=1 >/dev/null
echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-router.conf

echo "[+] Configuring LAN IP on $LAN"
ip link set "$LAN" up || true
ip addr flush dev "$LAN" || true
ip addr add "$LAN_GW/$CIDR" dev "$LAN"
rfkill unblock wifi || true

echo "[+] Configuring nftables NAT"
cat > /etc/nftables.conf <<EOF
flush ruleset
table ip nat { chain postrouting { type nat hook postrouting priority 100; oifname "$WAN" masquerade } }
table ip filter { chain forward { type filter hook forward priority 0; policy drop; ct state established,related accept; iifname "$LAN" oifname "$WAN" accept } }
EOF
systemctl enable --now nftables

echo "[+] Configuring hostapd"
cat > /etc/hostapd/hostapd.conf <<EOF
interface=$LAN
driver=nl80211
ssid=$SSID
country_code=$COUNTRY
ieee80211d=1
hw_mode=g
channel=$CHANNEL
ieee80211n=1
wpa=2
wpa_passphrase=$PSK
wpa_key_mgmt=WPA-PSK
wpa_pairwise=CCMP
EOF
if [ -f /etc/default/hostapd ]; then
  sed -i 's|^#\?DAEMON_CONF=.*$|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd || true
else
  echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' > /etc/default/hostapd
fi
systemctl enable --now hostapd

echo "[+] Configuring dnsmasq (DHCP only)"
cat > /etc/dnsmasq.conf <<EOF
port=0
bind-interfaces
conf-dir=/etc/dnsmasq.d,*.conf
except-interface=lo
EOF
mkdir -p /etc/dnsmasq.d
cat > /etc/dnsmasq.d/dhcp-$LAN.conf <<EOF
interface=$LAN
dhcp-range=$RANGE_START,$RANGE_END,$NETMASK,24h
dhcp-option=3,$LAN_GW
dhcp-option=6,1.1.1.1,8.8.8.8
EOF
dnsmasq --test || sed -i "s/^dhcp-range=.*/dhcp-range=$RANGE_START,$RANGE_END,24h/" /etc/dnsmasq.d/dhcp-$LAN.conf
systemctl enable --now dnsmasq

echo "[+] Attempting to bring up WAN ($WAN) via DHCP"
dhclient "$WAN" || true

echo "[+] Summary"
echo "  LAN iface:     $LAN"
echo "  LAN gateway:   $LAN_GW/$CIDR"
echo "  DHCP range:    $RANGE_START - $RANGE_END ($NETMASK)"
echo "  WAN iface:     $WAN"
echo "  AP SSID:       $SSID"
echo "  Internet test: (router) ping -c2 8.8.8.8"
echo "  Clients:       connect to SSID $SSID with password \"$PSK\""
echo "[+] Done"