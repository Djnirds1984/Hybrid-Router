#!/usr/bin/env python3
import json
import sys
import subprocess
import psutil
import os
from datetime import datetime

def system_status():
    return {
        'timestamp': datetime.now().isoformat(),
        'hostname': os.uname().nodename if hasattr(os, 'uname') else os.getenv('COMPUTERNAME', ''),
        'uptime_seconds': float(get_uptime()),
        'kernel': get_kernel_version(),
        'services': get_service_summary()
    }

def get_uptime():
    try:
        return float(psutil.boot_time() and (datetime.now().timestamp() - psutil.boot_time()))
    except Exception:
        return 0.0

def get_kernel_version():
    try:
        result = subprocess.run(['uname', '-r'], capture_output=True, text=True)
        return result.stdout.strip()
    except Exception:
        return ''

def resource_usage():
    try:
        cpu = psutil.cpu_percent(interval=0.5)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage('/') if os.path.exists('/') else None
        nets = psutil.net_io_counters()
        return {
            'cpu_percent': cpu,
            'memory': {
                'total': mem.total,
                'available': mem.available,
                'used': mem.used,
                'percent': mem.percent
            },
            'disk': {
                'total': disk.total if disk else 0,
                'used': disk.used if disk else 0,
                'percent': disk.percent if disk else 0
            },
            'network': {
                'bytes_sent': nets.bytes_sent,
                'bytes_recv': nets.bytes_recv
            }
        }
    except Exception as e:
        return {'error': str(e)}

def system_reboot():
    try:
        subprocess.run(['systemctl', 'reboot'], check=True)
        return {'success': True}
    except subprocess.CalledProcessError as e:
        return {'success': False, 'error': str(e)}

def get_logs(service, lines):
    try:
        if service == 'all':
            service = '-u'
            unit = 'hybrid-router*'
            cmd = ['journalctl', service, unit, '-n', str(lines), '--no-pager']
        else:
            cmd = ['journalctl', '-u', service, '-n', str(lines), '--no-pager']
        result = subprocess.run(cmd, capture_output=True, text=True)
        return {'service': service, 'lines': result.stdout.splitlines()}
    except Exception as e:
        return {'error': str(e)}

def service_status():
    try:
        units = ['dnsmasq', 'NetworkManager', 'hostapd', 'iptables', 'nftables']
        status = {}
        for u in units:
            r = subprocess.run(['systemctl', 'is-active', u], capture_output=True, text=True)
            status[u] = (r.returncode == 0)
        return status
    except Exception as e:
        return {'error': str(e)}

def get_service_summary():
    s = service_status()
    if isinstance(s, dict):
        return s
    return {}

def service_control(service, action):
    try:
        if action not in ['start', 'stop', 'restart', 'enable', 'disable']:
            return {'success': False, 'error': 'invalid_action'}
        subprocess.run(['systemctl', action, service], check=True)
        return {'success': True}
    except subprocess.CalledProcessError as e:
        return {'success': False, 'error': str(e)}

def main():
    if len(sys.argv) < 2:
        print('Usage: system_utils.py <command> [args...]', file=sys.stderr)
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == 'system_status':
        print(json.dumps(system_status()))
    elif cmd == 'resource_usage':
        print(json.dumps(resource_usage()))
    elif cmd == 'system_reboot':
        print(json.dumps(system_reboot()))
    elif cmd == 'get_logs':
        service = sys.argv[2] if len(sys.argv) > 2 else 'all'
        lines = int(sys.argv[3]) if len(sys.argv) > 3 else 100
        print(json.dumps(get_logs(service, lines)))
    elif cmd == 'service_status':
        print(json.dumps(service_status()))
    elif cmd == 'service_control':
        service = sys.argv[2]
        action = sys.argv[3]
        print(json.dumps(service_control(service, action)))
    else:
        print('Unknown command', file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()