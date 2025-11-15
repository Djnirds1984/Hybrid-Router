#!/usr/bin/env python3
"""
Network utilities for Hybrid Router
Provides network interface management, routing, and configuration
"""

import json
import sys
import subprocess
import psutil
import netifaces
import ipaddress
from datetime import datetime

def get_network_interfaces():
    """Get all network interfaces with their configuration"""
    interfaces = {}
    
    for interface in netifaces.interfaces():
        interface_info = {
            'name': interface,
            'enabled': interface != 'lo',  # Loopback is always enabled
            'type': 'wireless' if 'wl' in interface else 'ethernet',
            'addresses': {},
            'statistics': {},
            'status': 'unknown'
        }
        
        # Get IP addresses
        if netifaces.AF_INET in netifaces.ifaddresses(interface):
            addrs = netifaces.ifaddresses(interface)[netifaces.AF_INET]
            interface_info['addresses']['ipv4'] = [addr['addr'] for addr in addrs]
            interface_info['status'] = 'up'
        
        if netifaces.AF_INET6 in netifaces.ifaddresses(interface):
            addrs = netifaces.ifaddresses(interface)[netifaces.AF_INET6]
            interface_info['addresses']['ipv6'] = [addr['addr'] for addr in addrs]
        
        # Get interface statistics
        try:
            stats = psutil.net_io_counters(pernic=True).get(interface)
            if stats:
                interface_info['statistics'] = {
                    'bytes_sent': stats.bytes_sent,
                    'bytes_recv': stats.bytes_recv,
                    'packets_sent': stats.packets_sent,
                    'packets_recv': stats.packets_recv,
                    'errin': stats.errin,
                    'errout': stats.errout,
                    'dropin': stats.dropin,
                    'dropout': stats.dropout
                }
        except Exception as e:
            print(f"Error getting stats for {interface}: {e}", file=sys.stderr)
        
        interfaces[interface] = interface_info
    
    return interfaces

def get_network_status():
    """Get overall network status"""
    status = {
        'timestamp': datetime.now().isoformat(),
        'interfaces': get_network_interfaces(),
        'routing_table': get_routing_table(),
        'dns_servers': get_dns_servers(),
        'default_gateway': get_default_gateway()
    }
    
    return status

def get_routing_table():
    """Get the routing table"""
    routes = []
    try:
        result = subprocess.run(['ip', 'route', 'show'], 
                              capture_output=True, text=True, check=True)
        
        for line in result.stdout.strip().split('\n'):
            if line.strip():
                parts = line.split()
                route = {
                    'destination': parts[0],
                    'gateway': parts[2] if 'via' in parts else None,
                    'interface': parts[-1],
                    'metric': None
                }
                
                if 'metric' in parts:
                    metric_idx = parts.index('metric')
                    if metric_idx + 1 < len(parts):
                        route['metric'] = int(parts[metric_idx + 1])
                
                routes.append(route)
    
    except subprocess.CalledProcessError as e:
        print(f"Error getting routing table: {e}", file=sys.stderr)
    
    return routes

def get_dns_servers():
    """Get DNS server configuration"""
    dns_servers = []
    try:
        with open('/etc/resolv.conf', 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith('nameserver'):
                    dns_servers.append(line.split()[1])
    except FileNotFoundError:
        print("resolv.conf not found", file=sys.stderr)
    except Exception as e:
        print(f"Error reading resolv.conf: {e}", file=sys.stderr)
    
    return dns_servers

def get_default_gateway():
    """Get the default gateway"""
    try:
        result = subprocess.run(['ip', 'route', 'show', 'default'], 
                              capture_output=True, text=True, check=True)
        
        for line in result.stdout.strip().split('\n'):
            if 'default' in line and 'via' in line:
                parts = line.split()
                gateway_idx = parts.index('via')
                if gateway_idx + 1 < len(parts):
                    return parts[gateway_idx + 1]
    
    except subprocess.CalledProcessError:
        pass
    
    return None

def configure_interface(interface_name, config):
    """Configure a network interface"""
    try:
        # Basic interface configuration
        if 'enabled' in config:
            if config['enabled']:
                subprocess.run(['ip', 'link', 'set', interface_name, 'up'], check=True)
            else:
                subprocess.run(['ip', 'link', 'set', interface_name, 'down'], check=True)
        
        # IP address configuration
        if 'ip_address' in config and 'netmask' in config:
            # Remove existing addresses first
            try:
                subprocess.run(['ip', 'addr', 'flush', 'dev', interface_name], check=True)
            except:
                pass
            
            # Add new address
            ip_with_cidr = f"{config['ip_address']}/{config['netmask']}"
            subprocess.run(['ip', 'addr', 'add', ip_with_cidr, 'dev', interface_name], check=True)
        
        # Gateway configuration
        if 'gateway' in config:
            # Remove existing default gateway
            try:
                subprocess.run(['ip', 'route', 'del', 'default'], check=True, stderr=subprocess.DEVNULL)
            except:
                pass
            
            # Add new default gateway
            subprocess.run(['ip', 'route', 'add', 'default', 'via', config['gateway']], check=True)
        
        return {'success': True, 'message': f'Interface {interface_name} configured successfully'}
    
    except subprocess.CalledProcessError as e:
        return {'success': False, 'error': f'Failed to configure interface: {e}'}
    except Exception as e:
        return {'success': False, 'error': f'Configuration error: {e}'}

def main():
    if len(sys.argv) < 2:
        print("Usage: network_utils.py <command> [args...]", file=sys.stderr)
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == 'list_interfaces':
            result = get_network_interfaces()
            print(json.dumps(result))
        
        elif command == 'network_status':
            result = get_network_status()
            print(json.dumps(result))
        
        elif command == 'configure_interface':
            if len(sys.argv) < 4:
                print("Usage: network_utils.py configure_interface <interface> <config_json>", file=sys.stderr)
                sys.exit(1)
            
            interface_name = sys.argv[2]
            config = json.loads(sys.argv[3])
            result = configure_interface(interface_name, config)
            print(json.dumps(result))
        
        else:
            print(f"Unknown command: {command}", file=sys.stderr)
            sys.exit(1)
    
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()