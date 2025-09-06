const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class OrderAutomator {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
    this.dailyOrderCount = 0;
    this.lastOrderTime = null;
    this.rateLimiter = new Map();
  }

  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: process.env.NODE_ENV === 'production',
        args: process.env.NODE_ENV === 'production' ? [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ] : []
      });
      
      this.page = await this.browser.newPage();
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      logger.info('Order automator initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize order automator:', error);
      return false;
    }
  }

  isRateLimited(productUrl) {
    const now = Date.now();
    const lastOrder = this.rateLimiter.get(productUrl);
    const minInterval = 30 * 60 * 1000; // 30 minutes between orders for same product
    
    if (lastOrder && (now - lastOrder) < minInterval) {
      return true;
    }
    return false;
  }

  checkDailyLimits() {
    const today = new Date().toDateString();
    const lastOrderDate = this.lastOrderTime ? new Date(this.lastOrderTime).toDateString() : null;
    
    if (lastOrderDate !== today) {
      this.dailyOrderCount = 0;
    }
    
    const maxDailyOrders = this.config.maxDailyOrders || 10;
    return this.dailyOrderCount < maxDailyOrders;
  }

  async shouldPlaceOrder(productInfo) {
    if (!this.config.autoOrderEnabled) {
      logger.info('Auto ordering is disabled');
      return { allowed: false, reason: 'Auto ordering disabled' };
    }

    if (!productInfo.isInStock) {
      return { allowed: false, reason: 'Product not in stock' };
    }

    if (this.isRateLimited(productInfo.url)) {
      return { allowed: false, reason: 'Rate limited for this product' };
    }

    if (!this.checkDailyLimits()) {
      return { allowed: false, reason: 'Daily order limit reached' };
    }

    const price = this.parsePrice(productInfo.price);
    if (price && price > (this.config.maxOrderAmount || 500)) {
      return { allowed: false, reason: `Price ${price} exceeds maximum ${this.config.maxOrderAmount}` };
    }

    const conditions = this.config.orderConditions || {};
    
    if (conditions.keywords && conditions.keywords.length > 0) {
      const hasKeyword = conditions.keywords.some(keyword => 
        productInfo.title.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        return { allowed: false, reason: 'Product does not match keyword criteria' };
      }
    }

    if (conditions.minStock && productInfo.stockCount < conditions.minStock) {
      return { allowed: false, reason: 'Stock count below minimum threshold' };
    }

    return { allowed: true, reason: 'All conditions met' };
  }

  parsePrice(priceString) {
    if (!priceString) return null;
    const match = priceString.match(/[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : null;
  }

  async placeOrder(productInfo) {
    try {
      const orderCheck = await this.shouldPlaceOrder(productInfo);
      if (!orderCheck.allowed) {
        logger.info(`Order not placed: ${orderCheck.reason}`);
        return { success: false, reason: orderCheck.reason };
      }

      logger.info(`Attempting to place order for: ${productInfo.title}`);

      await this.page.goto(productInfo.url, { waitUntil: 'networkidle2' });

      await this.page.waitForTimeout(2000);

      const addToCartSelector = this.config.addToCartSelector || '.add-to-cart, [data-testid="add-to-cart"], button[name="add"]';
      await this.page.waitForSelector(addToCartSelector, { timeout: 10000 });

      if (this.config.quantitySelector) {
        await this.page.click(this.config.quantitySelector);
        await this.page.keyboard.press('Backspace');
        await this.page.type(this.config.quantitySelector, (this.config.quantityPerOrder || 1).toString());
      }

      await this.page.click(addToCartSelector);
      await this.page.waitForTimeout(3000);

      const cartSuccess = await this.page.evaluate(() => {
        const successMessages = [
          '.cart-success', '.added-to-cart', '.success-message',
          '[data-testid="cart-success"]', '.notification.success'
        ];
        
        return successMessages.some(selector => document.querySelector(selector));
      });

      if (!cartSuccess) {
        throw new Error('Failed to add product to cart');
      }

      if (this.config.autoCheckout) {
        const checkoutResult = await this.processCheckout();
        if (checkoutResult.success) {
          this.recordSuccessfulOrder(productInfo);
          return {
            success: true,
            message: `Order placed successfully for ${productInfo.title}`,
            orderId: checkoutResult.orderId
          };
        } else {
          return {
            success: false,
            reason: `Added to cart but checkout failed: ${checkoutResult.reason}`
          };
        }
      } else {
        logger.info(`Product ${productInfo.title} added to cart (auto-checkout disabled)`);
        return {
          success: true,
          message: `Product added to cart: ${productInfo.title}`,
          cartOnly: true
        };
      }

    } catch (error) {
      logger.error(`Order placement failed for ${productInfo.title}:`, error);
      return {
        success: false,
        reason: `Order failed: ${error.message}`
      };
    }
  }

  async processCheckout() {
    try {
      const cartSelector = this.config.cartSelector || '.cart, [data-testid="cart"], .shopping-cart';
      await this.page.click(cartSelector);
      await this.page.waitForTimeout(2000);

      const checkoutSelector = this.config.checkoutSelector || '.checkout, [data-testid="checkout"], .proceed-to-checkout';
      await this.page.waitForSelector(checkoutSelector, { timeout: 10000 });
      await this.page.click(checkoutSelector);

      await this.page.waitForNavigation({ waitUntil: 'networkidle2' });

      if (this.config.shippingSelector) {
        await this.page.click(this.config.shippingSelector);
        await this.page.waitForTimeout(1000);
      }

      if (this.config.paymentSelector) {
        await this.page.click(this.config.paymentSelector);
        await this.page.waitForTimeout(1000);
      }

      const placeOrderSelector = this.config.placeOrderSelector || '.place-order, [data-testid="place-order"], .complete-order';
      
      if (this.config.confirmBeforeOrder) {
        logger.info('Order ready for confirmation - manual confirmation required');
        return { success: false, reason: 'Manual confirmation required' };
      }

      await this.page.click(placeOrderSelector);
      await this.page.waitForTimeout(5000);

      const orderId = await this.page.evaluate(() => {
        const orderElements = [
          '.order-number', '.order-id', '[data-testid="order-id"]',
          '.confirmation-number', '.order-confirmation'
        ];
        
        for (const selector of orderElements) {
          const element = document.querySelector(selector);
          if (element) {
            const text = element.textContent;
            const match = text.match(/\d+/);
            return match ? match[0] : null;
          }
        }
        return null;
      });

      return {
        success: true,
        orderId: orderId || 'Unknown'
      };

    } catch (error) {
      logger.error('Checkout process failed:', error);
      return {
        success: false,
        reason: error.message
      };
    }
  }

  recordSuccessfulOrder(productInfo) {
    this.dailyOrderCount++;
    this.lastOrderTime = new Date().toISOString();
    this.rateLimiter.set(productInfo.url, Date.now());
    
    logger.info(`Order recorded: ${productInfo.title} - Daily count: ${this.dailyOrderCount}`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info('Order automator closed');
    }
  }

  getStats() {
    return {
      dailyOrderCount: this.dailyOrderCount,
      lastOrderTime: this.lastOrderTime,
      rateLimitedProducts: this.rateLimiter.size
    };
  }
}

module.exports = OrderAutomator;