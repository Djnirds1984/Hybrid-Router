const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin';
const dbPath = path.join(__dirname, '../data/router.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
    if (err) return;
    if (!row) {
      const hash = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10);
      db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', hash, 'admin']);
    }
  });
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

router.post('/login', [
  body('username').isLength({ min: 3 }).trim().escape(),
  body('password').isLength({ min: 5 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    db.get('SELECT id, username, password, role FROM users WHERE username = ?', [username], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!row) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const ok = await bcrypt.compare(password, row.password);
      if (!ok) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = jwt.sign(
        { id: row.id, username: row.username, role: row.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({
        token,
        user: { id: row.id, username: row.username, role: row.role }
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

router.get('/profile', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', authenticateToken, [
  body('currentPassword').isLength({ min: 5 }),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    db.get('SELECT id, password FROM users WHERE id = ?', [req.user.id], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'User not found' });
      }
      const ok = await bcrypt.compare(currentPassword, row.password);
      if (!ok) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      const hash = await bcrypt.hash(newPassword, 10);
      db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, req.user.id], function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Internal server error' });
        }
        res.json({ message: 'Password changed successfully' });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = { router, authenticateToken };