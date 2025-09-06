const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class ProductScraper {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
  }

  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: process.env.NODE_ENV === 'production',
        args: process.env.NODE_ENV === 'production' ? [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ] : []
      });
      
      this.page = await this.browser.newPage();
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      logger.info('Product scraper initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize scraper:', error);
      return false;
    }
  }

  async login() {
    if (!this.page) {
      throw new Error('Scraper not initialized');
    }

    try {
      logger.info('Attempting to log in to target website');
      
      await this.page.goto(this.config.loginUrl, { waitUntil: 'networkidle2' });
      
      await this.page.type(this.config.usernameSelector, this.config.username);
      await this.page.type(this.config.passwordSelector, this.config.password);
      
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
        this.page.click(this.config.loginButtonSelector)
      ]);

      const isLoginSuccessful = await this.page.evaluate((successIndicator) => {
        return document.querySelector(successIndicator) !== null;
      }, this.config.loginSuccessSelector);

      if (isLoginSuccessful) {
        this.isLoggedIn = true;
        logger.info('Successfully logged in to website');
        return true;
      } else {
        logger.error('Login failed - success indicator not found');
        return false;
      }
    } catch (error) {
      logger.error('Login error:', error);
      return false;
    }
  }

  async checkProductAvailability(productUrl, stockSelector) {
    if (!this.isLoggedIn) {
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        throw new Error('Login required but failed');
      }
    }

    try {
      logger.info(`Checking availability for product: ${productUrl}`);
      
      await this.page.goto(productUrl, { waitUntil: 'networkidle2' });
      
      await this.page.waitForSelector(stockSelector, { timeout: 10000 });
      
      const stockInfo = await this.page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        
        return {
          text: element.textContent.trim(),
          isInStock: !element.textContent.toLowerCase().includes('out of stock') &&
                     !element.textContent.toLowerCase().includes('unavailable') &&
                     !element.textContent.toLowerCase().includes('sold out')
        };
      }, stockSelector);

      const productInfo = await this.page.evaluate(() => {
        const titleElement = document.querySelector('h1, .product-title, [data-testid="product-title"]');
        const priceElement = document.querySelector('.price, .product-price, [data-testid="price"]');
        
        return {
          title: titleElement ? titleElement.textContent.trim() : 'Unknown Product',
          price: priceElement ? priceElement.textContent.trim() : 'Price not found'
        };
      });

      const result = {
        url: productUrl,
        title: productInfo.title,
        price: productInfo.price,
        stockStatus: stockInfo ? stockInfo.text : 'Stock info not found',
        isInStock: stockInfo ? stockInfo.isInStock : false,
        timestamp: new Date().toISOString()
      };

      logger.info(`Product check result: ${result.title} - ${result.isInStock ? 'IN STOCK' : 'OUT OF STOCK'}`);
      
      return result;
    } catch (error) {
      logger.error(`Error checking product availability: ${error.message}`);
      return {
        url: productUrl,
        title: 'Error',
        price: 'N/A',
        stockStatus: 'Error checking stock',
        isInStock: false,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  async checkMultipleProducts(products) {
    const results = [];
    
    for (const product of products) {
      try {
        const result = await this.checkProductAvailability(product.url, product.stockSelector);
        results.push(result);
        
        await this.page.waitForTimeout(2000);
      } catch (error) {
        logger.error(`Error checking product ${product.url}:`, error);
        results.push({
          url: product.url,
          title: product.name || 'Unknown',
          price: 'N/A',
          stockStatus: 'Error',
          isInStock: false,
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    }
    
    return results;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isLoggedIn = false;
      logger.info('Scraper closed');
    }
  }
}

module.exports = ProductScraper;