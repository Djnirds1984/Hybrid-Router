const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const winston = require('winston');
const WebSocket = require('ws');
const http = require('http');

const authRoutes = require('./routes/auth');
const networkRoutes = require('./routes/network');
const systemRoutes = require('./routes/system');
const configRoutes = require('./routes/config');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'hybrid-router-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

app.set('trust proxy', 'loopback');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  keyGenerator: (req) => (req.ip || '' ).replace(/:\d+[^:]*$/, ''),
  validate: { ip: false, trustProxy: false, xForwardedForHeader: false, forwardedHeader: false }
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth', authRoutes.router || authRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/config', configRoutes);

app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const clients = new Set();

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected');
  clients.add(ws);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      logger.info('Received WebSocket message:', data);
      
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (error) {
      logger.error('WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

setInterval(() => {
  const systemStats = {
    type: 'system_stats',
    timestamp: Date.now(),
    data: {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      network: {
        rx: Math.floor(Math.random() * 1000000),
        tx: Math.floor(Math.random() * 1000000)
      }
    }
  };
  broadcast(systemStats);
}, 5000);

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

server.listen(PORT, () => {
  logger.info(`Hybrid Router API server running on port ${PORT}`);
});

module.exports = { app, server, wss, broadcast };