const ProductScraper = require('../scrapers/productScraper');
const config = require('../config/config');
const logger = require('../utils/logger');
const cron = require('node-cron');

class MonitoringService {
  constructor() {
    this.scraper = null;
    this.isRunning = false;
    this.currentTask = null;
    this.dailyOrderCount = 0;
    this.lastOrderDate = null;
  }

  async initialize() {
    try {
      logger.info('Initializing monitoring service');
      
      // Create scraper instance
      this.scraper = new ProductScraper(config.getWebsiteConfig());
      
      // Test login
      const loginSuccess = await this.scraper.login();
      if (!loginSuccess) {
        throw new Error('Failed to login to website');
      }
      
      logger.info('Monitoring service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize monitoring service:', error);
      return false;
    }
  }

  async startMonitoring() {
    if (this.isRunning) {
      logger.warn('Monitoring service is already running');
      return;
    }

    logger.info('Starting product monitoring service');
    this.isRunning = true;

    // Schedule monitoring based on active hours
    const monitoringConfig = config.getMonitoringConfig();
    
    // Create cron expression for active hours (7 AM - 7 PM, weekdays only)
    // Run every 5 minutes during active hours
    const activeHoursCron = `*/5 7-18 * * 1-5`; // Every 5 minutes, 7-18 hours, weekdays
    
    // Run every hour during passive hours
    const passiveHoursCron = `0 19-6 * * 1-5`; // Every hour during off-hours, weekdays
    
    logger.info(`Scheduling active monitoring: ${activeHoursCron}`);
    logger.info(`Scheduling passive monitoring: ${passiveHoursCron}`);

    // Active hours monitoring
    this.currentTask = cron.schedule(activeHoursCron, async () => {
      if (config.isWithinActiveHours()) {
        await this.checkProducts('active');
      }
    }, {
      scheduled: true,
      timezone: monitoringConfig.timezone
    });

    // Passive hours monitoring  
    cron.schedule(passiveHoursCron, async () => {
      if (!config.isWithinActiveHours()) {
        await this.checkProducts('passive');
      }
    }, {
      scheduled: true,
      timezone: monitoringConfig.timezone
    });

    // Reset daily order count at midnight
    cron.schedule('0 0 * * *', () => {
      this.dailyOrderCount = 0;
      this.lastOrderDate = new Date().toDateString();
      logger.info('Daily order count reset');
    }, {
      scheduled: true,
      timezone: monitoringConfig.timezone
    });

    logger.info('Monitoring service started successfully');
  }

  async checkProducts(mode = 'active') {
    try {
      logger.info(`Starting product check (${mode} mode)`);
      
      const products = config.getTrackedProducts().filter(p => p.enabled);
      
      if (products.length === 0) {
        logger.warn('No products configured for monitoring');
        return;
      }

      const results = [];
      
      for (const product of products) {
        try {
          logger.info(`Checking product: ${product.name}`);
          
          const result = await this.scraper.checkProductAvailability(
            product.url, 
            product.stockSelector
          );
          
          result.productId = product.id;
          result.productName = product.name;
          results.push(result);
          
          // Check if product meets ordering conditions
          if (this.shouldOrder(product, result)) {
            await this.processOrder(product, result);
          }
          
          // Add delay between product checks
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          logger.error(`Error checking product ${product.name}:`, error);
          results.push({
            productId: product.id,
            productName: product.name,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Log summary
      const inStockCount = results.filter(r => r.isInStock).length;
      logger.info(`Product check complete: ${inStockCount}/${results.length} products in stock`);
      
      // Save results for reporting
      await this.saveResults(results);
      
      return results;
      
    } catch (error) {
      logger.error('Error during product check:', error);
    }
  }

  shouldOrder(product, result) {
    const orderConfig = config.getOrderConfig();
    
    // Check if auto ordering is enabled
    if (!orderConfig.autoOrderEnabled || !product.orderConditions?.autoOrder) {
      return false;
    }
    
    // Check if product is in stock
    if (!result.isInStock) {
      return false;
    }
    
    // Check daily order limits
    const today = new Date().toDateString();
    if (this.lastOrderDate !== today) {
      this.dailyOrderCount = 0;
      this.lastOrderDate = today;
    }
    
    if (this.dailyOrderCount >= orderConfig.maxDailyOrders) {
      logger.warn('Daily order limit reached');
      return false;
    }
    
    // Check product-specific order limits
    if (product.orderConditions.maxDailyOrders && 
        this.dailyOrderCount >= product.orderConditions.maxDailyOrders) {
      logger.warn(`Product daily order limit reached for ${product.name}`);
      return false;
    }
    
    // Check price limits
    if (product.maxPrice && result.price) {
      const priceMatch = result.price.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        const price = parseFloat(priceMatch[0].replace(',', ''));
        if (price > product.maxPrice) {
          logger.warn(`Price ${price} exceeds limit ${product.maxPrice} for ${product.name}`);
          return false;
        }
      }
    }
    
    // Check stock keywords
    const keywords = product.orderConditions.keywords || orderConfig.conditions.keywords;
    if (keywords && keywords.length > 0) {
      const stockText = result.stockStatus.toLowerCase();
      const hasKeyword = keywords.some(keyword => 
        stockText.includes(keyword.toLowerCase())
      );
      
      if (!hasKeyword) {
        logger.info(`Stock status "${result.stockStatus}" doesn't match required keywords`);
        return false;
      }
    }
    
    return true;
  }

  async processOrder(product, result) {
    try {
      logger.info(`Processing order for ${product.name}`);
      
      // This is where you'd implement the actual ordering logic
      // For now, we'll just log the order attempt
      
      const orderData = {
        productId: product.id,
        productName: product.name,
        productUrl: product.url,
        quantity: product.orderConditions.quantity || 1,
        price: result.price,
        timestamp: new Date().toISOString(),
        orderNumber: `ORD-${Date.now()}`
      };
      
      logger.info('Order placed:', orderData);
      
      // Increment daily order count
      this.dailyOrderCount++;
      
      // Send notification if configured
      await this.sendOrderNotification(orderData);
      
      // Save order record
      await this.saveOrderRecord(orderData);
      
      return orderData;
      
    } catch (error) {
      logger.error(`Failed to process order for ${product.name}:`, error);
      throw error;
    }
  }

  async sendOrderNotification(orderData) {
    try {
      // Implement email notification here
      logger.info(`Order notification sent for ${orderData.productName}`);
    } catch (error) {
      logger.error('Failed to send order notification:', error);
    }
  }

  async saveResults(results) {
    try {
      const fs = require('fs').promises;
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `logs/monitoring-results-${timestamp}.json`;
      
      let existingResults = [];
      try {
        const existing = await fs.readFile(filename, 'utf8');
        existingResults = JSON.parse(existing);
      } catch (error) {
        // File doesn't exist, start fresh
      }
      
      existingResults.push({
        timestamp: new Date().toISOString(),
        results: results
      });
      
      await fs.writeFile(filename, JSON.stringify(existingResults, null, 2));
      
    } catch (error) {
      logger.error('Failed to save results:', error);
    }
  }

  async saveOrderRecord(orderData) {
    try {
      const fs = require('fs').promises;
      const filename = 'logs/orders.json';
      
      let orders = [];
      try {
        const existing = await fs.readFile(filename, 'utf8');
        orders = JSON.parse(existing);
      } catch (error) {
        // File doesn't exist, start fresh
      }
      
      orders.push(orderData);
      await fs.writeFile(filename, JSON.stringify(orders, null, 2));
      
    } catch (error) {
      logger.error('Failed to save order record:', error);
    }
  }

  async stopMonitoring() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping monitoring service');
    
    if (this.currentTask) {
      this.currentTask.stop();
    }
    
    if (this.scraper) {
      await this.scraper.close();
    }
    
    this.isRunning = false;
    logger.info('Monitoring service stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      dailyOrderCount: this.dailyOrderCount,
      lastOrderDate: this.lastOrderDate,
      trackedProducts: config.getTrackedProducts().length,
      isWithinActiveHours: config.isWithinActiveHours()
    };
  }
}

module.exports = MonitoringService;