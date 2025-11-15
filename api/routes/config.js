const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const { authenticateToken } = require('./auth');

const dbPath = path.join(__dirname, '../data/router.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS interfaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    configuration TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS dhcp_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interface_id INTEGER,
    start_ip TEXT NOT NULL,
    end_ip TEXT NOT NULL,
    subnet_mask TEXT NOT NULL,
    lease_time INTEGER DEFAULT 86400,
    gateway TEXT,
    dns_servers TEXT,
    enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (interface_id) REFERENCES interfaces (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS firewall_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain TEXT NOT NULL,
    action TEXT NOT NULL,
    protocol TEXT,
    source_ip TEXT,
    dest_ip TEXT,
    source_port INTEGER,
    dest_port INTEGER,
    enabled BOOLEAN DEFAULT 1,
    priority INTEGER DEFAULT 100,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS port_forwarding (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    external_port INTEGER NOT NULL,
    internal_ip TEXT NOT NULL,
    internal_port INTEGER NOT NULL,
    protocol TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`INSERT OR IGNORE INTO system_settings (key, value, description) VALUES 
    ('router_name', 'HybridRouter', 'Router hostname'),
    ('timezone', 'UTC', 'System timezone'),
    ('language', 'en', 'Interface language'),
    ('theme', 'light', 'Interface theme')
  `);
});

router.get('/interfaces', authenticateToken, (req, res) => {
  db.all('SELECT * FROM interfaces ORDER BY name', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to get interfaces' });
    }
    res.json(rows);
  });
});

router.post('/interfaces', authenticateToken, [
  body('name').isLength({ min: 1 }).trim(),
  body('type').isIn(['ethernet', 'wireless', 'vlan']),
  body('enabled').optional().isBoolean(),
  body('configuration').optional().isObject()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, type, enabled = true, configuration = {} } = req.body;
  
  db.run(
    'INSERT INTO interfaces (name, type, enabled, configuration) VALUES (?, ?, ?, ?)',
    [name, type, enabled, JSON.stringify(configuration)],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(409).json({ error: 'Interface name already exists' });
        }
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to create interface' });
      }
      res.json({ id: this.lastID, message: 'Interface created successfully' });
    }
  );
});

router.put('/interfaces/:id', authenticateToken, [
  body('enabled').optional().isBoolean(),
  body('configuration').optional().isObject()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { enabled, configuration } = req.body;
  
  let query = 'UPDATE interfaces SET updated_at = CURRENT_TIMESTAMP';
  const params = [];
  
  if (enabled !== undefined) {
    query += ', enabled = ?';
    params.push(enabled);
  }
  
  if (configuration !== undefined) {
    query += ', configuration = ?';
    params.push(JSON.stringify(configuration));
  }
  
  query += ' WHERE id = ?';
  params.push(id);
  
  db.run(query, params, function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to update interface' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Interface not found' });
    }
    
    res.json({ message: 'Interface updated successfully' });
  });
});

router.get('/dhcp-config', authenticateToken, (req, res) => {
  db.all('SELECT * FROM dhcp_config', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to get DHCP configuration' });
    }
    res.json(rows);
  });
});

router.post('/dhcp-config', authenticateToken, [
  body('interface_id').isInt({ min: 1 }),
  body('start_ip').isIP(),
  body('end_ip').isIP(),
  body('subnet_mask').isIP(),
  body('lease_time').optional().isInt({ min: 300, max: 86400 }),
  body('gateway').optional().isIP(),
  body('dns_servers').optional().isString()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { interface_id, start_ip, end_ip, subnet_mask, lease_time, gateway, dns_servers } = req.body;
  
  db.run(
    `INSERT INTO dhcp_config (interface_id, start_ip, end_ip, subnet_mask, lease_time, gateway, dns_servers) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [interface_id, start_ip, end_ip, subnet_mask, lease_time || 86400, gateway, dns_servers],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to create DHCP configuration' });
      }
      res.json({ id: this.lastID, message: 'DHCP configuration created successfully' });
    }
  );
});

router.get('/firewall-rules', authenticateToken, (req, res) => {
  db.all('SELECT * FROM firewall_rules ORDER BY priority, id', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to get firewall rules' });
    }
    res.json(rows);
  });
});

router.post('/firewall-rules', authenticateToken, [
  body('chain').isIn(['INPUT', 'FORWARD', 'OUTPUT']),
  body('action').isIn(['ACCEPT', 'DROP', 'REJECT']),
  body('protocol').optional().isIn(['tcp', 'udp', 'icmp', 'all']),
  body('source_ip').optional().isIP(),
  body('dest_ip').optional().isIP(),
  body('source_port').optional().isInt({ min: 1, max: 65535 }),
  body('dest_port').optional().isInt({ min: 1, max: 65535 }),
  body('priority').optional().isInt({ min: 1, max: 1000 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { chain, action, protocol, source_ip, dest_ip, source_port, dest_port, priority, description } = req.body;
  
  db.run(
    `INSERT INTO firewall_rules (chain, action, protocol, source_ip, dest_ip, source_port, dest_port, priority, description) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [chain, action, protocol, source_ip, dest_ip, source_port, dest_port, priority || 100, description],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to create firewall rule' });
      }
      res.json({ id: this.lastID, message: 'Firewall rule created successfully' });
    }
  );
});

router.get('/port-forwarding', authenticateToken, (req, res) => {
  db.all('SELECT * FROM port_forwarding WHERE enabled = 1 ORDER BY name', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to get port forwarding rules' });
    }
    res.json(rows);
  });
});

router.post('/port-forwarding', authenticateToken, [
  body('name').isLength({ min: 1 }).trim(),
  body('external_port').isInt({ min: 1, max: 65535 }),
  body('internal_ip').isIP(),
  body('internal_port').isInt({ min: 1, max: 65535 }),
  body('protocol').isIn(['tcp', 'udp', 'both'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, external_port, internal_ip, internal_port, protocol, description } = req.body;
  
  db.run(
    `INSERT INTO port_forwarding (name, external_port, internal_ip, internal_port, protocol, description) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, external_port, internal_ip, internal_port, protocol, description],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to create port forwarding rule' });
      }
      res.json({ id: this.lastID, message: 'Port forwarding rule created successfully' });
    }
  );
});

router.get('/settings', authenticateToken, (req, res) => {
  db.all('SELECT key, value, description FROM system_settings', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to get settings' });
    }
    
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = {
        value: row.value,
        description: row.description
      };
    });
    
    res.json(settings);
  });
});

router.put('/settings/:key', authenticateToken, [
  body('value').isLength({ min: 1 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { key } = req.params;
  const { value } = req.body;
  
  db.run(
    'UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
    [value, key],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to update setting' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Setting not found' });
      }
      
      res.json({ message: 'Setting updated successfully' });
    }
  );
});

router.get('/backup', authenticateToken, (req, res) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `router-config-${timestamp}.json`;
  
  const config = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    interfaces: [],
    dhcp_config: [],
    firewall_rules: [],
    port_forwarding: [],
    settings: {}
  };
  
  db.all('SELECT * FROM interfaces', (err, interfaces) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to create backup' });
    }
    
    config.interfaces = interfaces;
    
    db.all('SELECT * FROM dhcp_config', (err, dhcp_config) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to create backup' });
      }
      
      config.dhcp_config = dhcp_config;
      
      db.all('SELECT * FROM firewall_rules', (err, firewall_rules) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to create backup' });
        }
        
        config.firewall_rules = firewall_rules;
        
        db.all('SELECT * FROM port_forwarding', (err, port_forwarding) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to create backup' });
          }
          
          config.port_forwarding = port_forwarding;
          
          db.all('SELECT * FROM system_settings', (err, settings) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to create backup' });
            }
            
            settings.forEach(setting => {
              config.settings[setting.key] = {
                value: setting.value,
                description: setting.description
              };
            });
            
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', 'application/json');
            res.json(config);
          });
        });
      });
    });
  });
});

module.exports = router;