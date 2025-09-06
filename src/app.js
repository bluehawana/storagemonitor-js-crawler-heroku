require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const logger = require('./utils/logger');
const scheduler = require('./scheduler/scheduler');
const config = require('./config/config');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    uptime: process.uptime(),
    monitoring: scheduler.isActive(),
    lastCheck: scheduler.getLastCheckTime(),
    productsTracked: config.getTrackedProducts().length
  });
});

app.post('/api/config', (req, res) => {
  try {
    config.updateConfig(req.body);
    res.json({ success: true, message: 'Configuration updated' });
  } catch (error) {
    logger.error('Config update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/logs', (req, res) => {
  const logs = logger.getRecentLogs();
  res.json(logs);
});

io.on('connection', (socket) => {
  logger.info('Client connected to dashboard');
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected from dashboard');
  });
});

scheduler.initialize(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Health Product Automator running on port ${PORT}`);
  logger.info('Monitoring system initialized');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  scheduler.stop();
  server.close(() => {
    process.exit(0);
  });
});

module.exports = { app, io };