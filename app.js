const express = require('express');
const MonitoringService = require('./src/services/monitoringService');
const config = require('./src/config/config');
const logger = require('./src/utils/logger');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Global monitoring service instance
let monitoringService = null;

// Routes
app.get('/', (req, res) => {
  res.json({
    name: 'Oriola4Care Health Product Monitor',
    status: 'running',
    version: '1.0.0',
    monitoring: monitoringService ? monitoringService.getStatus() : null
  });
});

app.get('/status', (req, res) => {
  if (!monitoringService) {
    return res.status(503).json({ error: 'Monitoring service not initialized' });
  }
  
  res.json(monitoringService.getStatus());
});

app.get('/products', (req, res) => {
  const products = config.getTrackedProducts();
  res.json({
    count: products.length,
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      url: p.url,
      enabled: p.enabled,
      maxPrice: p.maxPrice,
      autoOrder: p.orderConditions?.autoOrder || false
    }))
  });
});

app.post('/check-now', async (req, res) => {
  if (!monitoringService) {
    return res.status(503).json({ error: 'Monitoring service not initialized' });
  }
  
  try {
    logger.info('Manual product check requested');
    const results = await monitoringService.checkProducts('manual');
    res.json({
      success: true,
      results: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Manual check failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/start-monitoring', async (req, res) => {
  try {
    if (!monitoringService) {
      monitoringService = new MonitoringService();
      const initialized = await monitoringService.initialize();
      
      if (!initialized) {
        return res.status(500).json({ error: 'Failed to initialize monitoring service' });
      }
    }
    
    await monitoringService.startMonitoring();
    res.json({ success: true, message: 'Monitoring started' });
  } catch (error) {
    logger.error('Failed to start monitoring:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/stop-monitoring', async (req, res) => {
  try {
    if (monitoringService) {
      await monitoringService.stopMonitoring();
    }
    res.json({ success: true, message: 'Monitoring stopped' });
  } catch (error) {
    logger.error('Failed to stop monitoring:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/logs', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const today = new Date().toISOString().split('T')[0];
    const filename = `logs/monitoring-results-${today}.json`;
    
    try {
      const data = await fs.readFile(filename, 'utf8');
      const results = JSON.parse(data);
      res.json(results);
    } catch (error) {
      res.json({ message: 'No logs found for today', date: today });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/orders', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const filename = 'logs/orders.json';
    
    try {
      const data = await fs.readFile(filename, 'utf8');
      const orders = JSON.parse(data);
      res.json(orders);
    } catch (error) {
      res.json({ message: 'No orders found', orders: [] });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint for Heroku
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  if (monitoringService) {
    await monitoringService.stopMonitoring();
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  if (monitoringService) {
    await monitoringService.stopMonitoring();
  }
  
  process.exit(0);
});

// Start the application
async function startApp() {
  try {
    logger.info('Starting Oriola4Care Health Product Monitor');
    
    // Validate configuration
    const validation = config.validateConfiguration();
    if (!validation.valid) {
      logger.error('Configuration validation failed:', validation.errors);
      process.exit(1);
    }
    
    // Initialize monitoring service
    monitoringService = new MonitoringService();
    const initialized = await monitoringService.initialize();
    
    if (!initialized) {
      logger.error('Failed to initialize monitoring service');
      process.exit(1);
    }
    
    // Start monitoring automatically
    await monitoringService.startMonitoring();
    
    // Start web server
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      logger.info('Monitoring service is active');
      logger.info(`Active hours: 7 AM - 7 PM (${config.getMonitoringConfig().timezone})`);
      logger.info(`Tracking ${config.getTrackedProducts().length} products`);
    });
    
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Start the app
startApp();