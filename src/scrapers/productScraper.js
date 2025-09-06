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
    try {
      logger.info('Attempting to log in using session-based approach');
      
      const axios = require('axios');
      const cheerio = require('cheerio');
      const tough = require('tough-cookie');
      const { wrapper } = require('axios-cookiejar-support');
      const fs = require('fs');
      
      // Try to load existing session first
      if (fs.existsSync('oriola-session.json')) {
        logger.info('Attempting to use saved session');
        try {
          const cookieData = JSON.parse(fs.readFileSync('oriola-session.json', 'utf8'));
          // Session validation would go here
          logger.info('Using existing session');
          this.isLoggedIn = true;
          return true;
        } catch (error) {
          logger.warn('Saved session invalid, attempting fresh login');
        }
      }
      
      // Create axios client with cookie support
      const jar = new tough.CookieJar();
      const client = wrapper(axios.create({ jar }));
      
      // Set realistic headers
      client.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      
      // Get login page and extract CSRF token
      const loginPageResponse = await client.get(this.config.loginUrl);
      const $ = cheerio.load(loginPageResponse.data);
      const csrfToken = $('input[name="CSRFToken"]').attr('value');
      
      if (!csrfToken) {
        throw new Error('CSRF token not found');
      }
      
      // Submit login with correct endpoint and CSRF token
      const loginData = new URLSearchParams({
        j_username: this.config.username,
        j_password: this.config.password,
        CSRFToken: csrfToken
      });
      
      const loginUrl = this.config.loginUrl.replace('/login', '/j_spring_security_check');
      const loginResponse = await client.post(loginUrl, loginData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': this.config.loginUrl
        },
        maxRedirects: 5
      });
      
      const finalUrl = loginResponse.request.res.responseUrl || loginResponse.config.url;
      
      if (!finalUrl.includes('/login') && !finalUrl.includes('j_spring_security_check')) {
        // Save session cookies
        const cookies = jar.getCookiesSync('https://oriola4care.oriola-kd.com');
        const cookieData = cookies.map(c => c.toJSON());
        fs.writeFileSync('oriola-session.json', JSON.stringify(cookieData, null, 2));
        
        this.isLoggedIn = true;
        this.sessionClient = client; // Store for future requests
        logger.info('Successfully logged in to website');
        return true;
      } else {
        logger.error('Login failed - still on login page');
        return false;
      }
      
    } catch (error) {
      logger.error('Login error:', error.message);
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