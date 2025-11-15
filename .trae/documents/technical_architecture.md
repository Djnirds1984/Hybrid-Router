# Hybrid Router Technical Architecture Document

## System Architecture Overview

The hybrid router system is designed as a modular, layered architecture that separates networking functionality, management interfaces, and system services. The architecture prioritizes reliability, security, and performance on resource-constrained hardware like the Raspberry Pi 3B+.

## Architecture Layers

### 1. Hardware Abstraction Layer
- **Network Interface Management**: Abstracts physical network interfaces (eth0, wlan0, usb interfaces)
- **Hardware Detection**: Automatic detection of network adapters and capabilities
- **Thermal Management**: CPU temperature monitoring and throttling
- **Power Management**: Efficient power usage optimization
- **Storage Management**: SD card wear leveling and optimization

### 2. Network Kernel Layer
- **Linux Network Stack**: Optimized kernel networking subsystem
- **iptables/nftables**: Firewall and NAT implementation
- **Traffic Control**: QoS and bandwidth management using tc
- **Bridge Utilities**: Network bridging for VLAN and wireless integration
- **Wireless Stack**: HostAP daemon for access point functionality

### 3. Network Services Layer
- **DHCP Server**: ISC DHCP or dnsmasq for address assignment
- **DNS Server**: Local DNS resolution with caching (dnsmasq/unbound)
- **Routing Daemon**: Quagga/FRR for dynamic routing protocols
- **VPN Services**: OpenVPN and WireGuard implementations
- **Network Monitoring**: Connection health monitoring and failover

### 4. Application Services Layer
- **Web Server**: Nginx for management interface
- **API Gateway**: RESTful API for configuration and monitoring
- **Database**: SQLite for configuration storage
- **Message Queue**: Redis for inter-service communication
- **Container Runtime**: Docker for optional services

### 5. Management Interface Layer
- **Web Dashboard**: React-based responsive management interface
- **CLI Tools**: Command-line utilities for advanced users
- **Configuration Management**: YAML-based configuration system
- **Backup/Restore**: Automated configuration backup system
- **Update System**: Secure software update mechanism

## Core Components

### Network Manager (Python Service)
```python
# Primary network management service
class NetworkManager:
    - Interface configuration and monitoring
    - Route table management
    - Firewall rule management
    - Connection failover logic
    - Bandwidth monitoring
```

### DHCP Service (Systemd Service)
```python
# DHCP server management
class DHCPService:
    - Lease management
    - Reservation handling
    - Pool configuration
    - Client monitoring
```

### DNS Service (Systemd Service)
```python
# DNS resolution and caching
class DNSService:
    - Local zone configuration
    - Forwarding rules
    - Cache management
    - DNS-over-HTTPS support
```

### Wireless Manager (Python Service)
```python
# Wireless access point management
class WirelessManager:
    - SSID configuration
    - Security settings
    - Client management
    - Channel optimization
```

### VPN Manager (Python Service)
```python
# VPN server management
class VPNManager:
    - OpenVPN configuration
    - WireGuard configuration
    - Certificate management
    - Client authentication
```

### Web Interface (Node.js/React)
```javascript
// React-based management interface
const WebInterface = {
    - Dashboard component
    - Network configuration
    - Device management
    - System monitoring
    - Real-time updates
}
```

## Data Flow Architecture

### Configuration Flow
1. **Web Interface** → **API Gateway** → **Configuration Manager**
2. **Configuration Manager** → **Database** (SQLite)
3. **Configuration Manager** → **Service Controllers**
4. **Service Controllers** → **System Services**
5. **System Services** → **Network Configuration**

### Monitoring Flow
1. **System Services** → **Monitoring Agent**
2. **Monitoring Agent** → **Message Queue** (Redis)
3. **Message Queue** → **Web Interface** (WebSocket)
4. **Web Interface** → **User Dashboard**

### Network Traffic Flow
1. **Incoming Packets** → **Firewall** (iptables/nftables)
2. **Firewall** → **Routing Decision**
3. **Routing Decision** → **NAT Processing**
4. **NAT Processing** → **Outgoing Interface**
5. **Traffic Monitoring** → **Statistics Collection**

## Database Schema

### Configuration Tables
```sql
-- Network interfaces
CREATE TABLE interfaces (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE,
    type TEXT, -- 'ethernet', 'wireless', 'vlan'
    enabled BOOLEAN,
    configuration TEXT -- JSON configuration
);

-- DHCP configuration
CREATE TABLE dhcp_config (
    id INTEGER PRIMARY KEY,
    interface_id INTEGER,
    start_ip TEXT,
    end_ip TEXT,
    subnet_mask TEXT,
    lease_time INTEGER,
    gateway TEXT,
    dns_servers TEXT
);

-- Firewall rules
CREATE TABLE firewall_rules (
    id INTEGER PRIMARY KEY,
    chain TEXT, -- 'INPUT', 'FORWARD', 'OUTPUT'
    action TEXT, -- 'ACCEPT', 'DROP', 'REJECT'
    protocol TEXT,
    source_ip TEXT,
    dest_ip TEXT,
    source_port INTEGER,
    dest_port INTEGER,
    enabled BOOLEAN,
    priority INTEGER
);

-- Port forwarding
CREATE TABLE port_forwarding (
    id INTEGER PRIMARY KEY,
    name TEXT,
    external_port INTEGER,
    internal_ip TEXT,
    internal_port INTEGER,
    protocol TEXT,
    enabled BOOLEAN
);

-- VPN configuration
CREATE TABLE vpn_config (
    id INTEGER PRIMARY KEY,
    type TEXT, -- 'openvpn', 'wireguard'
    name TEXT,
    enabled BOOLEAN,
    configuration TEXT -- JSON configuration
);

-- System settings
CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT
);
```

## Service Architecture

### Systemd Services
```ini
# Network Manager Service
[Unit]
Description=Hybrid Router Network Manager
After=network.target

[Service]
Type=simple
ExecStart=/opt/hybrid-router/services/network_manager.py
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

```ini
# Web Interface Service
[Unit]
Description=Hybrid Router Web Interface
After=network.target network_manager.service

[Service]
Type=simple
ExecStart=/opt/hybrid-router/web/server.js
Restart=always
User=www-data
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Service Communication
- **Inter-Process Communication**: Unix sockets and Redis message queue
- **API Communication**: RESTful HTTP APIs with JSON payloads
- **Real-time Updates**: WebSocket connections for live monitoring
- **Configuration Updates**: File-based configuration with inotify monitoring
- **Status Reporting**: Shared memory and status files

## Security Architecture

### Network Security
- **Firewall Zones**: Separate zones for WAN, LAN, and management interfaces
- **Default Deny**: Default deny-all policy with explicit allow rules
- **Connection Tracking**: Stateful packet inspection for all connections
- **Rate Limiting**: Protection against DoS attacks and flooding
- **VPN Isolation**: Separate VPN network with controlled access

### System Security
- **Service Isolation**: Each service runs with minimal privileges
- **File Permissions**: Strict file permissions on configuration files
- **Audit Logging**: Comprehensive audit trail for all changes
- **Certificate Management**: Valid SSL certificates for all services
- **Update Security**: Cryptographically signed software updates

### Access Control
- **Authentication**: Multi-factor authentication for management interface
- **Authorization**: Role-based access control (RBAC)
- **Session Management**: Secure session handling with timeouts
- **API Security**: API key authentication and rate limiting
- **SSH Access**: Key-based authentication only, no password login

## Performance Optimization

### Memory Management
- **Service Memory Limits**: Configurable memory limits for each service
- **Memory Caching**: Intelligent caching for frequently accessed data
- **Garbage Collection**: Optimized garbage collection for Python/Node.js
- **Shared Libraries**: Minimize memory usage through shared libraries

### CPU Optimization
- **Process Affinity**: CPU core affinity for network-intensive processes
- **Interrupt Handling**: Optimized interrupt handling for network interfaces
- **Load Balancing**: Distribute load across available CPU cores
- **Background Tasks**: Schedule background tasks during low-usage periods

### Storage Optimization
- **Log Rotation**: Automated log rotation to prevent disk space issues
- **Database Optimization**: Optimized SQLite queries and indexing
- **Temporary Files**: Proper cleanup of temporary files
- **SD Card Protection**: Minimize writes to extend SD card life

## Monitoring and Logging

### System Monitoring
- **Resource Usage**: CPU, memory, disk, and network usage monitoring
- **Service Health**: Individual service health monitoring
- **Network Performance**: Network throughput and latency monitoring
- **Error Tracking**: Comprehensive error tracking and alerting

### Logging Architecture
- **Centralized Logging**: All logs collected in centralized location
- **Log Levels**: Configurable log levels for different components
- **Log Rotation**: Automated log rotation and archival
- **Remote Logging**: Optional remote logging to external syslog server

### Alerting System
- **Threshold Alerts**: Alerts when system metrics exceed thresholds
- **Service Alerts**: Alerts when services fail or restart
- **Network Alerts**: Alerts for network connectivity issues
- **Security Alerts**: Alerts for security-related events

## Backup and Recovery

### Configuration Backup
- **Automated Backups**: Daily automated configuration backups
- **Backup Encryption**: Encrypted backup files with strong encryption
- **Version Control**: Configuration version history and rollback
- **Remote Backup**: Optional cloud-based backup storage

### System Recovery
- **Recovery Mode**: Safe mode for system troubleshooting
- **Configuration Restore**: Easy configuration restoration
- **Factory Reset**: Complete system reset to factory defaults
- **Emergency Access**: Emergency access for system recovery

## Scalability Considerations

### Horizontal Scaling
- **Multi-Instance**: Support for multiple router instances
- **Load Distribution**: Distribute load across multiple devices
- **Configuration Sync**: Synchronize configuration across instances
- **Failover Clustering**: High availability through clustering

### Vertical Scaling
- **Resource Scaling**: Optimize for different hardware configurations
- **Feature Scaling**: Enable/disable features based on available resources
- **Performance Tuning**: Automatic performance tuning based on hardware
- **Memory Scaling**: Dynamic memory allocation based on usage

## Development Environment

### Development Setup
- **Container Development**: Docker-based development environment
- **Virtual Environment**: Python virtual environment for services
- **Hot Reload**: Development mode with hot reload for web interface
- **Mock Services**: Mock services for development and testing

### Testing Environment
- **Unit Testing**: Comprehensive unit test coverage
- **Integration Testing**: Integration tests for all components
- **Hardware Testing**: Testing on actual Raspberry Pi hardware
- **Performance Testing**: Load testing and performance validation

### Deployment Pipeline
- **Continuous Integration**: Automated testing and building
- **Package Creation**: Automated package creation for deployment
- **Deployment Scripts**: Automated deployment scripts
- **Rollback Mechanism**: Safe rollback mechanism for failed deployments