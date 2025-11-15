const express = require('express');
const { body, validationResult } = require('express-validator');
const { PythonShell } = require('python-shell');
const path = require('path');
const router = express.Router();

const { authenticateToken } = require('./auth');

router.get('/interfaces', authenticateToken, async (req, res) => {
  try {
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['list_interfaces']
    };

    PythonShell.run('network_utils.py', options, function (err, results) {
      if (err) {
        console.error('Python script error:', err);
        return res.status(500).json({ error: 'Failed to get network interfaces' });
      }
      
      try {
        const interfaces = JSON.parse(results[0]);
        res.json(interfaces);
      } catch (parseError) {
        console.error('Parse error:', parseError);
        res.status(500).json({ error: 'Failed to parse network interfaces' });
      }
    });
  } catch (error) {
    console.error('Network interfaces error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['network_status']
    };

    PythonShell.run('network_utils.py', options, function (err, results) {
      if (err) {
        console.error('Python script error:', err);
        return res.status(500).json({ error: 'Failed to get network status' });
      }
      
      try {
        const status = JSON.parse(results[0]);
        res.json(status);
      } catch (parseError) {
        console.error('Parse error:', parseError);
        res.status(500).json({ error: 'Failed to parse network status' });
      }
    });
  } catch (error) {
    console.error('Network status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/configure-interface', authenticateToken, [
  body('interface').isLength({ min: 1 }).trim(),
  body('config').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { interface: iface, config } = req.body;
    
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['configure_interface', iface, JSON.stringify(config)]
    };

    PythonShell.run('network_utils.py', options, function (err, results) {
      if (err) {
        console.error('Python script error:', err);
        return res.status(500).json({ error: 'Failed to configure interface' });
      }
      
      try {
        const result = JSON.parse(results[0]);
        if (result.success) {
          res.json({ message: 'Interface configured successfully' });
        } else {
          res.status(400).json({ error: result.error || 'Failed to configure interface' });
        }
      } catch (parseError) {
        console.error('Parse error:', parseError);
        res.status(500).json({ error: 'Failed to parse configuration result' });
      }
    });
  } catch (error) {
    console.error('Interface configuration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/dhcp-leases', authenticateToken, async (req, res) => {
  try {
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['dhcp_leases']
    };

    PythonShell.run('dhcp_utils.py', options, function (err, results) {
      if (err) {
        console.error('Python script error:', err);
        return res.status(500).json({ error: 'Failed to get DHCP leases' });
      }
      
      try {
        const leases = JSON.parse(results[0]);
        res.json(leases);
      } catch (parseError) {
        console.error('Parse error:', parseError);
        res.status(500).json({ error: 'Failed to parse DHCP leases' });
      }
    });
  } catch (error) {
    console.error('DHCP leases error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/firewall-rules', authenticateToken, async (req, res) => {
  try {
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['firewall_rules']
    };

    PythonShell.run('firewall_utils.py', options, function (err, results) {
      if (err) {
        console.error('Python script error:', err);
        return res.status(500).json({ error: 'Failed to get firewall rules' });
      }
      
      try {
        const rules = JSON.parse(results[0]);
        res.json(rules);
      } catch (parseError) {
        console.error('Parse error:', parseError);
        res.status(500).json({ error: 'Failed to parse firewall rules' });
      }
    });
  } catch (error) {
    console.error('Firewall rules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/firewall-rules', authenticateToken, [
  body('chain').isIn(['INPUT', 'FORWARD', 'OUTPUT']),
  body('action').isIn(['ACCEPT', 'DROP', 'REJECT']),
  body('protocol').optional().isIn(['tcp', 'udp', 'icmp', 'all']),
  body('source_ip').optional().isIP(),
  body('dest_ip').optional().isIP(),
  body('source_port').optional().isInt({ min: 1, max: 65535 }),
  body('dest_port').optional().isInt({ min: 1, max: 65535 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const rule = req.body;
    
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['add_firewall_rule', JSON.stringify(rule)]
    };

    PythonShell.run('firewall_utils.py', options, function (err, results) {
      if (err) {
        console.error('Python script error:', err);
        return res.status(500).json({ error: 'Failed to add firewall rule' });
      }
      
      try {
        const result = JSON.parse(results[0]);
        if (result.success) {
          res.json({ message: 'Firewall rule added successfully' });
        } else {
          res.status(400).json({ error: result.error || 'Failed to add firewall rule' });
        }
      } catch (parseError) {
        console.error('Parse error:', parseError);
        res.status(500).json({ error: 'Failed to parse result' });
      }
    });
  } catch (error) {
    console.error('Add firewall rule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/nat/enable', authenticateToken, [
  body('method').isIn(['nftables', 'iptables']),
  body('wan').isLength({ min: 1 }),
  body('lan').isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { method, wan, lan } = req.body;
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['enable_nat', method, wan, lan]
    };
    PythonShell.run('firewall_utils.py', options, function (err, results) {
      if (err) {
        return res.status(500).json({ error: 'Failed to enable NAT' });
      }
      try {
        const result = JSON.parse(results[0]);
        if (result.success) {
          res.json({ message: 'NAT enabled' });
        } else {
          res.status(400).json({ error: result.error || 'Failed to enable NAT' });
        }
      } catch {
        res.status(500).json({ error: 'Failed to parse result' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/nat/disable', authenticateToken, [
  body('method').isIn(['nftables', 'iptables'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { method } = req.body;
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['disable_nat', method]
    };
    PythonShell.run('firewall_utils.py', options, function (err, results) {
      if (err) {
        return res.status(500).json({ error: 'Failed to disable NAT' });
      }
      try {
        const result = JSON.parse(results[0]);
        if (result.success) {
          res.json({ message: 'NAT disabled' });
        } else {
          res.status(400).json({ error: result.error || 'Failed to disable NAT' });
        }
      } catch {
        res.status(500).json({ error: 'Failed to parse result' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/nat/status', authenticateToken, async (req, res) => {
  try {
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['nat_status']
    };
    PythonShell.run('firewall_utils.py', options, function (err, results) {
      if (err) {
        return res.status(500).json({ error: 'Failed to get NAT status' });
      }
      try {
        const status = JSON.parse(results[0]);
        res.json(status);
      } catch {
        res.status(500).json({ error: 'Failed to parse NAT status' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;