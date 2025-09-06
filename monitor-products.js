const ProductScraper = require('./src/scrapers/productScraper');
const config = require('./src/config/config');
const logger = require('./src/utils/logger');
require('dotenv').config();

class ProductMonitor {
    constructor() {
        this.scraper = null;
        this.isRunning = false;
        this.monitoringInterval = null;
        
        this.scraperConfig = {
            loginUrl: process.env.LOGIN_URL,
            username: process.env.USERNAME,
            password: process.env.PASSWORD,
            usernameSelector: process.env.USERNAME_SELECTOR || '#j_username',
            passwordSelector: process.env.PASSWORD_SELECTOR || '#j_password',
            loginButtonSelector: process.env.LOGIN_BUTTON_SELECTOR || 'button[type="submit"]',
            loginSuccessSelector: process.env.LOGIN_SUCCESS_SELECTOR || '.main-content'
        };
    }
    
    async initialize() {
        try {
            this.scraper = new ProductScraper(this.scraperConfig);
            const success = await this.scraper.initialize();
            
            if (success) {
                logger.info('Product monitor initialized successfully');
                console.log('✅ Monitor initialized');
                return true;
            }
            return false;
        } catch (error) {
            logger.error('Failed to initialize monitor:', error);
            return false;
        }
    }
    
    async startMonitoring() {
        if (this.isRunning) {
            console.log('⚠️  Monitor is already running');
            return;
        }
        
        console.log('🚀 Starting product monitoring...\n');
        this.isRunning = true;
        
        // Initial check
        await this.checkProducts();
        
        // Set up interval checking
        const intervalMinutes = config.getCheckInterval();
        console.log(`⏰ Monitoring interval: ${intervalMinutes} minutes`);
        console.log(`🕐 Active hours: ${config.getMonitoringConfig().activeStartHour}:00 - ${config.getMonitoringConfig().activeEndHour}:00\n`);
        
        this.monitoringInterval = setInterval(async () => {
            await this.checkProducts();
        }, intervalMinutes * 60 * 1000);
    }
    
    async checkProducts() {
        const products = config.getTrackedProducts();
        
        if (products.length === 0) {
            console.log('⚠️  No products configured for monitoring');
            return;
        }
        
        console.log(`🔍 Checking ${products.length} products... [${new Date().toLocaleString()}]`);
        
        try {
            const results = await this.scraper.checkMultipleProducts(products);
            
            for (const result of results) {
                console.log(`\n📦 ${result.title || 'Unknown Product'}`);
                console.log(`   URL: ${result.url}`);
                console.log(`   Status: ${result.isInStock ? '✅ IN STOCK' : '❌ OUT OF STOCK'}`);
                console.log(`   Price: ${result.price || 'N/A'}`);
                console.log(`   Stock Info: ${result.stockStatus}`);
                
                // Check if we should trigger an order
                if (result.isInStock && this.shouldTriggerOrder(result)) {
                    await this.handleStockAlert(result);
                }
            }
            
            // Update check interval based on time
            const newInterval = config.getCheckInterval();
            if (this.monitoringInterval && newInterval !== this.currentInterval) {
                this.updateInterval(newInterval);
            }
            
        } catch (error) {
            logger.error('Error checking products:', error);
            console.log('❌ Error checking products:', error.message);
        }
        
        console.log('─'.repeat(60));
    }
    
    shouldTriggerOrder(productResult) {
        const orderConfig = config.getOrderConfig();
        
        if (!orderConfig.autoOrderEnabled) {
            return false;
        }
        
        // Check price limit
        const price = parseFloat(productResult.price.replace(/[^0-9.]/g, ''));
        if (price > orderConfig.conditions.maxPrice) {
            console.log(`   💰 Price ${productResult.price} exceeds limit $${orderConfig.conditions.maxPrice}`);
            return false;
        }
        
        // Check keywords
        const stockText = productResult.stockStatus.toLowerCase();
        const hasKeywords = orderConfig.conditions.keywords.some(keyword => 
            stockText.includes(keyword.toLowerCase())
        );
        
        if (!hasKeywords) {
            console.log(`   🔍 Stock status doesn't match required keywords`);
            return false;
        }
        
        return true;
    }
    
    async handleStockAlert(productResult) {
        const orderConfig = config.getOrderConfig();
        
        console.log(`\n🚨 STOCK ALERT: ${productResult.title} is available!`);
        console.log(`   Price: ${productResult.price}`);
        
        if (orderConfig.autoOrderEnabled) {
            if (orderConfig.confirmBeforeOrder) {
                console.log('⚠️  Auto-order is enabled but confirmation is required');
                console.log('   Manual action needed to place order');
            } else {
                console.log('🛒 Attempting to place automatic order...');
                // Here you would integrate with the order automator
                // await this.placeOrder(productResult);
            }
        } else {
            console.log('📧 Sending notification (auto-order disabled)');
        }
        
        // Log the alert
        logger.info(`Stock alert triggered for ${productResult.title}`, {
            product: productResult.title,
            url: productResult.url,
            price: productResult.price,
            autoOrderEnabled: orderConfig.autoOrderEnabled
        });
    }
    
    updateInterval(newIntervalMinutes) {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        this.currentInterval = newIntervalMinutes;
        console.log(`⏰ Updated monitoring interval to ${newIntervalMinutes} minutes`);
        
        this.monitoringInterval = setInterval(async () => {
            await this.checkProducts();
        }, newIntervalMinutes * 60 * 1000);
    }
    
    async stopMonitoring() {
        if (!this.isRunning) {
            console.log('⚠️  Monitor is not running');
            return;
        }
        
        console.log('🛑 Stopping product monitoring...');
        this.isRunning = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        if (this.scraper) {
            await this.scraper.close();
        }
        
        console.log('✅ Monitor stopped');
    }
    
    getStatus() {
        return {
            running: this.isRunning,
            productsCount: config.getTrackedProducts().length,
            interval: config.getCheckInterval(),
            activeHours: `${config.getMonitoringConfig().activeStartHour}:00 - ${config.getMonitoringConfig().activeEndHour}:00`,
            autoOrderEnabled: config.getOrderConfig().autoOrderEnabled
        };
    }
}

// Create and export monitor instance
const monitor = new ProductMonitor();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received shutdown signal');
    await monitor.stopMonitoring();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received termination signal');
    await monitor.stopMonitoring();
    process.exit(0);
});

// Auto-start if this file is run directly
if (require.main === module) {
    (async () => {
        const initialized = await monitor.initialize();
        if (initialized) {
            await monitor.startMonitoring();
        } else {
            console.log('❌ Failed to initialize monitor');
            process.exit(1);
        }
    })();
}

module.exports = monitor;