#!/usr/bin/env python3
"""
DHCP utilities for Hybrid Router
Provides DHCP server management and lease tracking
"""

import json
import sys
import subprocess
import re
from datetime import datetime

def get_dhcp_leases():
    """Get current DHCP leases"""
    leases = []
    
    try:
        # Try to read dnsmasq leases file first
        with open('/var/lib/dhcp/dhcpd.leases', 'r') as f:
            content = f.read()
            
        # Parse ISC DHCP leases format
        lease_blocks = re.findall(r'lease\s+([\d\.]+)\s*\{([^}]+)\}', content, re.DOTALL)
        
        for ip, block in lease_blocks:
            lease = {
                'ip_address': ip,
                'mac_address': None,
                'hostname': None,
                'start_time': None,
                'end_time': None,
                'state': 'active'
            }
            
            # Extract MAC address
            mac_match = re.search(r'hardware\s+ethernet\s+([\da-fA-F:]{17})', block)
            if mac_match:
                lease['mac_address'] = mac_match.group(1)
            
            # Extract hostname
            hostname_match = re.search(r'client-hostname\s+"([^"]+)"', block)
            if hostname_match:
                lease['hostname'] = hostname_match.group(1)
            
            # Extract start time
            start_match = re.search(r'starts?\s+(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2})', block)
            if start_match:
                lease['start_time'] = start_match.group(1)
            
            # Extract end time
            end_match = re.search(r'ends?\s+(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2})', block)
            if end_match:
                lease['end_time'] = end_match.group(1)
            
            # Check if lease is still active
            if end_match and end_match.group(1):
                try:
                    end_time = datetime.strptime(end_match.group(1), '%Y/%m/%d %H:%M:%S')
                    if end_time < datetime.now():
                        lease['state'] = 'expired'
                except:
                    pass
            
            leases.append(lease)
    
    except FileNotFoundError:
        # Fallback to dnsmasq leases file
        try:
            with open('/var/lib/misc/dnsmasq.leases', 'r') as f:
                for line in f:
                    parts = line.strip().split()
                    if len(parts) >= 3:
                        lease = {
                            'mac_address': parts[1],
                            'ip_address': parts[2],
                            'hostname': parts[3] if len(parts) > 3 else None,
                            'lease_time': parts[0],
                            'state': 'active'
                        }
                        leases.append(lease)
        
        except FileNotFoundError:
            print("No DHCP leases file found", file=sys.stderr)
    
    except Exception as e:
        print(f"Error reading DHCP leases: {e}", file=sys.stderr)
    
    return leases

def configure_dhcp_server(interface, config):
    """Configure DHCP server for an interface"""
    try:
        # Generate dnsmasq configuration
        dnsmasq_config = f"""
# DHCP Configuration for {interface}
interface={interface}
dhcp-range={config['start_ip']},{config['end_ip']},{config['subnet_mask']},{config.get('lease_time', 86400)}s
"""
        
        if config.get('gateway'):
            dnsmasq_config += f"dhcp-option=3,{config['gateway']}\n"
        
        if config.get('dns_servers'):
            dns_servers = config['dns_servers'].split(',')
            for dns in dns_servers:
                dnsmasq_config += f"dhcp-option=6,{dns.strip()}\n"
        
        # Write configuration file
        config_file = f"/etc/dnsmasq.d/dhcp-{interface}.conf"
        with open(config_file, 'w') as f:
            f.write(dnsmasq_config)
        
        # Restart dnsmasq service
        subprocess.run(['systemctl', 'restart', 'dnsmasq'], check=True)
        
        return {'success': True, 'message': f'DHCP server configured for {interface}'}
    
    except subprocess.CalledProcessError as e:
        return {'success': False, 'error': f'Failed to restart DHCP service: {e}'}
    except Exception as e:
        return {'success': False, 'error': f'Configuration error: {e}'}

def start_dhcp_server():
    """Start the DHCP server"""
    try:
        subprocess.run(['systemctl', 'start', 'dnsmasq'], check=True)
        subprocess.run(['systemctl', 'enable', 'dnsmasq'], check=True)
        return {'success': True, 'message': 'DHCP server started successfully'}
    except subprocess.CalledProcessError as e:
        return {'success': False, 'error': f'Failed to start DHCP server: {e}'}

def stop_dhcp_server():
    """Stop the DHCP server"""
    try:
        subprocess.run(['systemctl', 'stop', 'dnsmasq'], check=True)
        return {'success': True, 'message': 'DHCP server stopped successfully'}
    except subprocess.CalledProcessError as e:
        return {'success': False, 'error': f'Failed to stop DHCP server: {e}'}

def get_dhcp_status():
    """Get DHCP server status"""
    try:
        result = subprocess.run(['systemctl', 'is-active', 'dnsmasq'], 
                              capture_output=True, text=True)
        
        status = {
            'active': result.returncode == 0,
            'status': result.stdout.strip(),
            'service': 'dnsmasq'
        }
        
        if result.returncode != 0:
            status['error'] = result.stderr.strip()
        
        return status
    
    except Exception as e:
        return {'active': False, 'error': str(e)}

def main():
    if len(sys.argv) < 2:
        print("Usage: dhcp_utils.py <command> [args...]", file=sys.stderr)
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == 'dhcp_leases':
            result = get_dhcp_leases()
            print(json.dumps(result))
        
        elif command == 'configure_dhcp':
            if len(sys.argv) < 4:
                print("Usage: dhcp_utils.py configure_dhcp <interface> <config_json>", file=sys.stderr)
                sys.exit(1)
            
            interface = sys.argv[2]
            config = json.loads(sys.argv[3])
            result = configure_dhcp_server(interface, config)
            print(json.dumps(result))
        
        elif command == 'start_dhcp':
            result = start_dhcp_server()
            print(json.dumps(result))
        
        elif command == 'stop_dhcp':
            result = stop_dhcp_server()
            print(json.dumps(result))
        
        elif command == 'dhcp_status':
            result = get_dhcp_status()
            print(json.dumps(result))
        
        else:
            print(f"Unknown command: {command}", file=sys.stderr)
            sys.exit(1)
    
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()