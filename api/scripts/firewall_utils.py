#!/usr/bin/env python3
"""
Firewall utilities for Hybrid Router
Provides firewall rule management and iptables/nftables integration
"""

import json
import sys
import subprocess
import re
from datetime import datetime

def get_firewall_rules():
    """Get current firewall rules"""
    rules = []
    
    try:
        # Try nftables first (newer systems)
        result = subprocess.run(['nft', 'list', 'ruleset'], 
                              capture_output=True, text=True, check=True)
        
        rules = parse_nftables_rules(result.stdout)
    
    except (subprocess.CalledProcessError, FileNotFoundError):
        # Fallback to iptables
        try:
            rules = get_iptables_rules()
        except Exception as e:
            print(f"Error getting firewall rules: {e}", file=sys.stderr)
            rules = []
    
    return rules

def parse_nftables_rules(nft_output):
    """Parse nftables ruleset"""
    rules = []
    current_table = None
    current_chain = None
    
    for line in nft_output.split('\n'):
        line = line.strip()
        
        # Table definition
        if line.startswith('table'):
            parts = line.split()
            if len(parts) >= 2:
                current_table = parts[1]
        
        # Chain definition
        elif line.startswith('chain'):
            parts = line.split()
            if len(parts) >= 2:
                current_chain = parts[1].rstrip('{')
        
        # Rule definition
        elif line.startswith('ip') or line.startswith('tcp') or line.startswith('udp'):
            rule = parse_nft_rule(line, current_table, current_chain)
            if rule:
                rules.append(rule)
    
    return rules

def parse_nft_rule(rule_line, table, chain):
    """Parse individual nftables rule"""
    rule = {
        'table': table,
        'chain': chain,
        'rule': rule_line,
        'protocol': None,
        'source_ip': None,
        'dest_ip': None,
        'source_port': None,
        'dest_port': None,
        'action': None
    }
    
    # Extract protocol
    if 'tcp' in rule_line:
        rule['protocol'] = 'tcp'
    elif 'udp' in rule_line:
        rule['protocol'] = 'udp'
    elif 'icmp' in rule_line:
        rule['protocol'] = 'icmp'
    
    # Extract IP addresses
    ip_pattern = r'(\d+\.\d+\.\d+\.\d+(/\d+)?)'
    ips = re.findall(ip_pattern, rule_line)
    if len(ips) >= 1:
        rule['source_ip'] = ips[0][0]
    if len(ips) >= 2:
        rule['dest_ip'] = ips[1][0]
    
    # Extract ports
    port_pattern = r'(\d+)'
    ports = re.findall(port_pattern, rule_line)
    if len(ports) >= 1:
        rule['source_port'] = int(ports[0])
    if len(ports) >= 2:
        rule['dest_port'] = int(ports[1])
    
    # Extract action
    if 'accept' in rule_line:
        rule['action'] = 'ACCEPT'
    elif 'drop' in rule_line:
        rule['action'] = 'DROP'
    elif 'reject' in rule_line:
        rule['action'] = 'REJECT'
    
    return rule

def get_iptables_rules():
    """Get iptables rules"""
    rules = []
    chains = ['INPUT', 'FORWARD', 'OUTPUT']
    
    for chain in chains:
        try:
            result = subprocess.run(['iptables', '-L', chain, '-n', '--line-numbers'], 
                                  capture_output=True, text=True, check=True)
            
            chain_rules = parse_iptables_output(result.stdout, chain)
            rules.extend(chain_rules)
        
        except subprocess.CalledProcessError:
            continue
    
    return rules

def parse_iptables_output(output, chain):
    """Parse iptables output"""
    rules = []
    lines = output.split('\n')
    
    for line in lines[1:]:  # Skip header
        if not line.strip() or line.startswith('Chain'):
            continue
        
        parts = line.split()
        if len(parts) < 6:
            continue
        
        rule = {
            'chain': chain,
            'line_number': parts[0],
            'target': parts[1],
            'protocol': parts[2] if parts[2] != 'all' else None,
            'source_ip': parts[7] if parts[7] != '0.0.0.0/0' else None,
            'dest_ip': parts[8] if parts[8] != '0.0.0.0/0' else None,
            'action': parts[1],
            'rule': line
        }
        
        # Extract ports if present
        if 'dpt:' in line:
            port_match = re.search(r'dpt:(\d+)', line)
            if port_match:
                rule['dest_port'] = int(port_match.group(1))
        
        if 'spt:' in line:
            port_match = re.search(r'spt:(\d+)', line)
            if port_match:
                rule['source_port'] = int(port_match.group(1))
        
        rules.append(rule)
    
    return rules

def add_firewall_rule(rule):
    """Add a firewall rule"""
    try:
        if rule['chain'] not in ['INPUT', 'FORWARD', 'OUTPUT']:
            return {'success': False, 'error': 'Invalid chain'}
        
        if rule['action'] not in ['ACCEPT', 'DROP', 'REJECT']:
            return {'success': False, 'error': 'Invalid action'}
        
        # Build iptables command
        cmd = ['iptables', '-A', rule['chain']]
        
        if rule.get('protocol') and rule['protocol'] != 'all':
            cmd.extend(['-p', rule['protocol']])
        
        if rule.get('source_ip'):
            cmd.extend(['-s', rule['source_ip']])
        
        if rule.get('dest_ip'):
            cmd.extend(['-d', rule['dest_ip']])
        
        if rule.get('source_port'):
            cmd.extend(['--sport', str(rule['source_port'])])
        
        if rule.get('dest_port'):
            cmd.extend(['--dport', str(rule['dest_port'])])
        
        cmd.extend(['-j', rule['action']])
        
        subprocess.run(cmd, check=True)
        
        return {'success': True, 'message': 'Firewall rule added successfully'}
    
    except subprocess.CalledProcessError as e:
        return {'success': False, 'error': f'Failed to add firewall rule: {e}'}
    except Exception as e:
        return {'success': False, 'error': f'Error adding rule: {e}'}

def delete_firewall_rule(chain, line_number):
    """Delete a firewall rule by line number"""
    try:
        subprocess.run(['iptables', '-D', chain, str(line_number)], check=True)
        return {'success': True, 'message': 'Firewall rule deleted successfully'}
    
    except subprocess.CalledProcessError as e:
        return {'success': False, 'error': f'Failed to delete firewall rule: {e}'}

def save_firewall_rules():
    """Save firewall rules to persistent storage"""
    try:
        # Save iptables rules
        subprocess.run(['iptables-save'], check=True)
        return {'success': True, 'message': 'Firewall rules saved successfully'}
    
    except subprocess.CalledProcessError as e:
        return {'success': False, 'error': f'Failed to save firewall rules: {e}'}

def get_firewall_status():
    """Get firewall service status"""
    try:
        result = subprocess.run(['systemctl', 'is-active', 'iptables'], 
                              capture_output=True, text=True)
        
        status = {
            'active': result.returncode == 0,
            'service': 'iptables'
        }
        
        if result.returncode != 0:
            status['error'] = result.stderr.strip()
        
        return status
    
    except Exception as e:
        return {'active': False, 'error': str(e)}

def main():
    if len(sys.argv) < 2:
        print("Usage: firewall_utils.py <command> [args...]", file=sys.stderr)
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == 'firewall_rules':
            result = get_firewall_rules()
            print(json.dumps(result))
        
        elif command == 'add_firewall_rule':
            if len(sys.argv) < 3:
                print("Usage: firewall_utils.py add_firewall_rule <rule_json>", file=sys.stderr)
                sys.exit(1)
            
            rule = json.loads(sys.argv[2])
            result = add_firewall_rule(rule)
            print(json.dumps(result))
        
        elif command == 'delete_firewall_rule':
            if len(sys.argv) < 4:
                print("Usage: firewall_utils.py delete_firewall_rule <chain> <line_number>", file=sys.stderr)
                sys.exit(1)
            
            chain = sys.argv[2]
            line_number = int(sys.argv[3])
            result = delete_firewall_rule(chain, line_number)
            print(json.dumps(result))
        
        elif command == 'save_firewall_rules':
            result = save_firewall_rules()
            print(json.dumps(result))
        
        elif command == 'firewall_status':
            result = get_firewall_status()
            print(json.dumps(result))
        
        else:
            print(f"Unknown command: {command}", file=sys.stderr)
            sys.exit(1)
    
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()