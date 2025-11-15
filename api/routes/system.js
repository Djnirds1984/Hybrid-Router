const express = require('express');
const { PythonShell } = require('python-shell');
const path = require('path');
const router = express.Router();

const { authenticateToken } = require('./auth');

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['system_status']
    };

    PythonShell.run('system_utils.py', options, function (err, results) {
      if (err) {
        console.error('Python script error:', err);
        return res.status(500).json({ error: 'Failed to get system status' });
      }
      
      try {
        const status = JSON.parse(results[0]);
        res.json(status);
      } catch (parseError) {
        console.error('Parse error:', parseError);
        res.status(500).json({ error: 'Failed to parse system status' });
      }
    });
  } catch (error) {
    console.error('System status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/resources', authenticateToken, async (req, res) => {
  try {
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['resource_usage']
    };

    PythonShell.run('system_utils.py', options, function (err, results) {
      if (err) {
        console.error('Python script error:', err);
        return res.status(500).json({ error: 'Failed to get resource usage' });
      }
      
      try {
        const resources = JSON.parse(results[0]);
        res.json(resources);
      } catch (parseError) {
        console.error('Parse error:', parseError);
        res.status(500).json({ error: 'Failed to parse resource usage' });
      }
    });
  } catch (error) {
    console.error('Resource usage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/storage', authenticateToken, async (req, res) => {
  try {
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['storage_info']
    };
    PythonShell.run('system_utils.py', options, function (err, results) {
      if (err) {
        return res.status(500).json({ error: 'Failed to get storage info' });
      }
      try {
        const info = JSON.parse(results[0]);
        res.json(info);
      } catch {
        res.status(500).json({ error: 'Failed to parse storage info' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/wan', authenticateToken, async (req, res) => {
  try {
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['wan_status']
    };
    PythonShell.run('system_utils.py', options, function (err, results) {
      if (err) {
        return res.status(500).json({ error: 'Failed to get WAN status' });
      }
      try {
        const wan = JSON.parse(results[0]);
        res.json(wan);
      } catch {
        res.status(500).json({ error: 'Failed to parse WAN status' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reboot', authenticateToken, async (req, res) => {
  try {
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['system_reboot']
    };

    PythonShell.run('system_utils.py', options, function (err, results) {
      if (err) {
        console.error('Python script error:', err);
        return res.status(500).json({ error: 'Failed to initiate reboot' });
      }
      
      try {
        const result = JSON.parse(results[0]);
        if (result.success) {
          res.json({ message: 'System reboot initiated' });
        } else {
          res.status(400).json({ error: result.error || 'Failed to reboot system' });
        }
      } catch (parseError) {
        console.error('Parse error:', parseError);
        res.status(500).json({ error: 'Failed to parse reboot result' });
      }
    });
  } catch (error) {
    console.error('System reboot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const { service = 'all', lines = 100 } = req.query;
    
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['get_logs', service, lines.toString()]
    };

    PythonShell.run('system_utils.py', options, function (err, results) {
      if (err) {
        console.error('Python script error:', err);
        return res.status(500).json({ error: 'Failed to get logs' });
      }
      
      try {
        const logs = JSON.parse(results[0]);
        res.json(logs);
      } catch (parseError) {
        console.error('Parse error:', parseError);
        res.status(500).json({ error: 'Failed to parse logs' });
      }
    });
  } catch (error) {
    console.error('System logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/services', authenticateToken, async (req, res) => {
  try {
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['service_status']
    };

    PythonShell.run('system_utils.py', options, function (err, results) {
      if (err) {
        console.error('Python script error:', err);
        return res.status(500).json({ error: 'Failed to get service status' });
      }
      
      try {
        const services = JSON.parse(results[0]);
        res.json(services);
      } catch (parseError) {
        console.error('Parse error:', parseError);
        res.status(500).json({ error: 'Failed to parse service status' });
      }
    });
  } catch (error) {
    console.error('Services status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/services/:service/:action', authenticateToken, async (req, res) => {
  try {
    const { service, action } = req.params;
    
    if (!['start', 'stop', 'restart', 'enable', 'disable'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    const options = {
      mode: 'text',
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../scripts'),
      args: ['service_control', service, action]
    };

    PythonShell.run('system_utils.py', options, function (err, results) {
      if (err) {
        console.error('Python script error:', err);
        return res.status(500).json({ error: 'Failed to control service' });
      }
      
      try {
        const result = JSON.parse(results[0]);
        if (result.success) {
          res.json({ message: `Service ${service} ${action}ed successfully` });
        } else {
          res.status(400).json({ error: result.error || `Failed to ${action} service` });
        }
      } catch (parseError) {
        console.error('Parse error:', parseError);
        res.status(500).json({ error: 'Failed to parse result' });
      }
    });
  } catch (error) {
    console.error('Service control error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;