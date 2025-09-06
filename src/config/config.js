const logger = require('../utils/logger');
require('dotenv').config();

class Config {
  constructor() {
    this.settings = {
      website: {
        loginUrl: process.env.LOGIN_URL || '',
        username: process.env.USERNAME || '',
        password: process.env.PASSWORD || '',
        selectors: {
          username: process.env.USERNAME_SELECTOR || '#j_username',
          password: process.env.PASSWORD_SELECTOR || '#j_password',
          loginButton: process.env.LOGIN_BUTTON_SELECTOR || 'button[type="submit"]',
          loginSuccess: process.env.LOGIN_SUCCESS_SELECTOR || '.logout, .dashboard, .account-info',
          stock: process.env.STOCK_SELECTOR || '.stock-status, .availability, .in-stock, .lagerstatus',
          addToCart: '.add-to-cart, [data-testid="add-to-cart"]',
          quantity: '.quantity-input, [name="quantity"]',
          cart: '.cart, [data-testid="cart"]',
          checkout: '.checkout, [data-testid="checkout"]',
          placeOrder: '.place-order, [data-testid="place-order"]'
        }
      },
      monitoring: {
        activeStartHour: parseInt(process.env.ACTIVE_START_HOUR) || 7,
        activeEndHour: parseInt(process.env.ACTIVE_END_HOUR) || 19,
        timezone: process.env.TIMEZONE || 'America/New_York',
        checkInterval: 5, // minutes
        passiveInterval: 30 // minutes during inactive hours
      },
      orders: {
        autoOrderEnabled: process.env.AUTO_ORDER_ENABLED === 'true',
        maxOrderAmount: parseFloat(process.env.MAX_ORDER_AMOUNT) || 500,
        quantityPerOrder: parseInt(process.env.QUANTITY_PER_ORDER) || 1,
        maxDailyOrders: 10,
        confirmBeforeOrder: true,
        autoCheckout: false,
        conditions: {
          keywords: [],
          minStock: 1,
          maxPrice: 500
        }
      },
      products: [
        // Will be populated from database or config file
      ],
      notifications: {
        email: process.env.NOTIFICATION_EMAIL || '',
        smtp: {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT) || 587,
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || ''
        }
      },
      compliance: {
        respectRobotsTxt: true,
        minRequestDelay: 2000, // 2 seconds between requests
        maxConcurrentRequests: 1,
        userAgent: 'Health Product Monitor 1.0',
        honorRateLimit: true
      }
    };
  }

  updateConfig(newConfig) {
    try {
      this.settings = { ...this.settings, ...newConfig };
      logger.info('Configuration updated successfully');
      return true;
    } catch (error) {
      logger.error('Failed to update configuration:', error);
      throw error;
    }
  }

  getWebsiteConfig() {
    return this.settings.website;
  }

  getMonitoringConfig() {
    return this.settings.monitoring;
  }

  getOrderConfig() {
    return this.settings.orders;
  }

  getTrackedProducts() {
    return this.settings.products;
  }

  addProduct(product) {
    const requiredFields = ['name', 'url', 'stockSelector'];
    for (const field of requiredFields) {
      if (!product[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const newProduct = {
      id: Date.now().toString(),
      name: product.name,
      url: product.url,
      stockSelector: product.stockSelector,
      maxPrice: product.maxPrice || this.settings.orders.maxPrice,
      enabled: product.enabled !== false,
      addedAt: new Date().toISOString(),
      ...product
    };

    this.settings.products.push(newProduct);
    logger.info(`Added new product: ${newProduct.name}`);
    return newProduct;
  }

  removeProduct(productId) {
    const index = this.settings.products.findIndex(p => p.id === productId);
    if (index > -1) {
      const removed = this.settings.products.splice(index, 1)[0];
      logger.info(`Removed product: ${removed.name}`);
      return removed;
    }
    throw new Error('Product not found');
  }

  updateProduct(productId, updates) {
    const product = this.settings.products.find(p => p.id === productId);
    if (!product) {
      throw new Error('Product not found');
    }

    Object.assign(product, updates, { updatedAt: new Date().toISOString() });
    logger.info(`Updated product: ${product.name}`);
    return product;
  }

  getComplianceSettings() {
    return this.settings.compliance;
  }

  isWithinActiveHours() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Only active on weekdays (Monday = 1 to Friday = 5)
    if (day === 0 || day === 6) {
      return false;
    }
    
    return hour >= this.settings.monitoring.activeStartHour && 
           hour < this.settings.monitoring.activeEndHour;
  }

  getCheckInterval() {
    return this.isWithinActiveHours() 
      ? this.settings.monitoring.checkInterval 
      : this.settings.monitoring.passiveInterval;
  }

  validateConfiguration() {
    const errors = [];
    
    if (!this.settings.website.loginUrl) {
      errors.push('Login URL is required');
    }
    
    if (!this.settings.website.username || !this.settings.website.password) {
      errors.push('Username and password are required');
    }
    
    if (this.settings.products.length === 0) {
      errors.push('At least one product must be configured');
    }
    
    if (errors.length > 0) {
      logger.warn('Configuration validation failed:', errors);
      return { valid: false, errors };
    }
    
    return { valid: true, errors: [] };
  }

  exportConfig() {
    const exportData = {
      ...this.settings,
      website: {
        ...this.settings.website,
        password: '***HIDDEN***' // Don't export password
      }
    };
    return exportData;
  }
}

const config = new Config();
module.exports = config;