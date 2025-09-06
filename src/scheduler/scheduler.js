const cron = require('node-cron');
const moment = require('moment-timezone');
const ProductScraper = require('../scrapers/productScraper');
const OrderAutomator = require('../orders/orderAutomator');
const config = require('../config/config');
const logger = require('../utils/logger');

class Scheduler {
  constructor() {
    this.productScraper = null;
    this.orderAutomator = null;
    this.activeTask = null;
    this.passiveTask = null;
    this.isRunning = false;
    this.lastCheckTime = null;
    this.io = null;
    this.stats = {
      totalChecks: 0,
      successfulOrders: 0,
      errors: 0,
      productsTracked: 0
    };
  }

  async initialize(socketIo) {
    try {
      this.io = socketIo;
      
      this.productScraper = new ProductScraper(config.getWebsiteConfig());
      this.orderAutomator = new OrderAutomator(config.getOrderConfig());
      
      await this.productScraper.initialize();
      await this.orderAutomator.initialize();
      
      this.setupSchedules();
      this.isRunning = true;
      
      logger.info('Scheduler initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize scheduler:', error);
      return false;
    }
  }

  setupSchedules() {
    const monitoringConfig = config.getMonitoringConfig();
    
    // Active monitoring: Every 5 minutes during business hours on weekdays
    this.activeTask = cron.schedule('*/5 7-19 * * 1-5', async () => {
      if (config.isWithinActiveHours()) {
        await this.performCheck('active');
      }
    }, {
      scheduled: false,
      timezone: monitoringConfig.timezone
    });

    // Passive monitoring: Every 30 minutes during off-hours
    this.passiveTask = cron.schedule('*/30 * * * *', async () => {
      if (!config.isWithinActiveHours()) {
        await this.performCheck('passive');
      }
    }, {
      scheduled: false,
      timezone: monitoringConfig.timezone
    });

    // Start the tasks
    this.activeTask.start();
    this.passiveTask.start();
    
    logger.info('Monitoring schedules configured and started');
  }

  async performCheck(mode = 'active') {
    try {
      logger.info(`Starting ${mode} product check`);
      
      const products = config.getTrackedProducts().filter(p => p.enabled);
      
      if (products.length === 0) {
        logger.warn('No products configured for monitoring');
        return;
      }

      this.stats.productsTracked = products.length;
      this.lastCheckTime = new Date().toISOString();
      
      // Emit status update to connected clients
      if (this.io) {
        this.io.emit('check-started', {
          mode,
          timestamp: this.lastCheckTime,
          productCount: products.length
        });
      }

      const results = [];
      
      // Process products with rate limiting
      for (const product of products) {
        try {
          // Add delay between requests to be respectful
          if (results.length > 0) {
            const delay = config.getComplianceSettings().minRequestDelay || 2000;
            await this.sleep(delay);
          }
          
          const result = await this.productScraper.checkProductAvailability(
            product.url, 
            product.stockSelector
          );
          
          result.productId = product.id;
          result.productName = product.name;
          results.push(result);
          
          // Emit individual product update
          if (this.io) {
            this.io.emit('product-update', result);
          }
          
          // Attempt to place order if product is in stock
          if (result.isInStock && config.getOrderConfig().autoOrderEnabled) {
            await this.attemptOrder(result);
          }
          
        } catch (error) {
          logger.error(`Error checking product ${product.name}:`, error);
          this.stats.errors++;
          
          results.push({
            productId: product.id,
            productName: product.name,
            url: product.url,
            isInStock: false,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      this.stats.totalChecks++;
      
      // Emit completion status
      if (this.io) {
        this.io.emit('check-completed', {
          mode,
          results,
          stats: this.getStats(),
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info(`${mode} check completed. Found ${results.filter(r => r.isInStock).length} products in stock`);
      
      return results;
      
    } catch (error) {
      logger.error(`Error during ${mode} check:`, error);
      this.stats.errors++;
      
      if (this.io) {
        this.io.emit('check-error', {
          mode,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async attemptOrder(productResult) {
    try {
      logger.info(`Attempting to place order for ${productResult.productName}`);
      
      const orderResult = await this.orderAutomator.placeOrder(productResult);
      
      if (orderResult.success) {
        this.stats.successfulOrders++;
        logger.info(`Order placed successfully: ${orderResult.message}`);
        
        // Emit order success
        if (this.io) {
          this.io.emit('order-success', {
            product: productResult.productName,
            orderId: orderResult.orderId,
            timestamp: new Date().toISOString()
          });
        }
        
        // Send notification
        await this.sendOrderNotification(productResult, orderResult);
        
      } else {
        logger.info(`Order not placed: ${orderResult.reason}`);
        
        if (this.io) {
          this.io.emit('order-skipped', {
            product: productResult.productName,
            reason: orderResult.reason,
            timestamp: new Date().toISOString()
          });
        }
      }
      
    } catch (error) {
      logger.error(`Order attempt failed for ${productResult.productName}:`, error);
      this.stats.errors++;
    }
  }

  async sendOrderNotification(productResult, orderResult) {
    // This will be implemented when notification system is added
    logger.info(`Notification: Order placed for ${productResult.productName}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async manualCheck() {
    logger.info('Manual check triggered');
    return await this.performCheck('manual');
  }

  isActive() {
    return this.isRunning && (this.activeTask || this.passiveTask);
  }

  getLastCheckTime() {
    return this.lastCheckTime;
  }

  getStats() {
    return {
      ...this.stats,
      isActive: this.isActive(),
      lastCheck: this.lastCheckTime,
      currentMode: config.isWithinActiveHours() ? 'active' : 'passive',
      orderStats: this.orderAutomator ? this.orderAutomator.getStats() : null
    };
  }

  getCurrentStatus() {
    const now = moment().tz(config.getMonitoringConfig().timezone);
    const isActiveTime = config.isWithinActiveHours();
    
    return {
      isRunning: this.isRunning,
      currentTime: now.format('YYYY-MM-DD HH:mm:ss z'),
      isActiveHours: isActiveTime,
      nextCheckInterval: isActiveTime ? '5 minutes' : '30 minutes',
      stats: this.getStats()
    };
  }

  stop() {
    if (this.activeTask) {
      this.activeTask.stop();
    }
    if (this.passiveTask) {
      this.passiveTask.stop();
    }
    
    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  async restart() {
    this.stop();
    await this.sleep(1000);
    
    if (this.productScraper) {
      await this.productScraper.close();
    }
    if (this.orderAutomator) {
      await this.orderAutomator.close();
    }
    
    return await this.initialize(this.io);
  }
}

const scheduler = new Scheduler();
module.exports = scheduler;