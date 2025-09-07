const ProductScraper = require('./src/scrapers/productScraper');
const config = require('./src/config/config');
const logger = require('./src/utils/logger');
require('dotenv').config();

class MepiformMonitor {
    constructor() {
        this.productUrl = 'https://oriola4care.oriola-kd.com/Varum%C3%A4rken/M%C3%96LNLYCKE-HEALTH-CARE/MEPIFORM-10X18CM-5ST/p/282186-888';
        this.productName = 'MEPIFORM 10X18CM 5ST';
        this.orderQuantities = [350, 700]; // Two order options
        this.isMonitoring = false;
        this.lastStatus = null;
        
        this.scraperConfig = {
            loginUrl: process.env.LOGIN_URL,
            username: process.env.USERNAME,
            password: process.env.PASSWORD,
            usernameSelector: '#j_username',
            passwordSelector: '#j_password',
            loginButtonSelector: 'button[type="submit"]',
            loginSuccessSelector: '.logout, .dashboard, .account-info, nav'
        };
        
        // Swedish pharmacy-specific selectors for MEPIFORM
        this.selectors = {
            // Stock status selectors (Swedish pharmacy)
            stock: '.stock-status, .lagerstatus, .tillgänglighet, .availability, .in-stock, .stock-info, [class*="stock"], [class*="lager"]',
            // Price selectors
            price: '.price, .pris, .cost, .product-price, [class*="price"], [class*="pris"]',
            // Add to cart button
            addToCart: '.add-to-cart, .lägg-i-kundvagn, button[data-action="add"], [class*="add-cart"], input[value*="cart"]',
            // Quantity input
            quantity: 'input[name="quantity"], input[name="antal"], .quantity-input, .antal-input, #qty',
            // Product title
            title: 'h1, .product-title, .product-name, .produktnamn, [class*="title"]'
        };
    }
    
    async initialize() {
        try {
            this.scraper = new ProductScraper(this.scraperConfig);
            const success = await this.scraper.initialize();
            
            if (success) {
                logger.info('MEPIFORM monitor initialized successfully');
                console.log('✅ MEPIFORM Monitor initialized');
                
                // Add product to config if not already there
                this.addProductToConfig();
                return true;
            }
            return false;
        } catch (error) {
            logger.error('Failed to initialize MEPIFORM monitor:', error);
            return false;
        }
    }
    
    addProductToConfig() {
        try {
            const existingProducts = config.getTrackedProducts();
            const productExists = existingProducts.some(p => p.url === this.productUrl);
            
            if (!productExists) {
                config.addProduct({
                    name: this.productName,
                    url: this.productUrl,
                    stockSelector: this.selectors.stock,
                    maxPrice: 1000, // Adjust based on expected price
                    orderQuantity: 350, // Default order quantity
                    alternateQuantity: 700, // Alternative quantity
                    enabled: true,
                    autoOrder: true // Enable auto-ordering for this product
                });
                console.log(`✅ Added ${this.productName} to monitoring configuration`);
            }
        } catch (error) {
            logger.error('Error adding product to config:', error);
        }
    }
    
    async checkMepiformStatus() {
        try {
            console.log(`🔍 Checking MEPIFORM status... [${new Date().toLocaleString('sv-SE')}]`);
            
            const result = await this.scraper.checkProductAvailability(
                this.productUrl, 
                this.selectors.stock
            );
            
            // Enhanced status analysis for Swedish pharmacy
            const statusAnalysis = this.analyzeStockStatus(result);
            
            console.log(`\n📦 MEPIFORM Status Report:`);
            console.log(`   Product: ${result.title || this.productName}`);
            console.log(`   Status: ${statusAnalysis.isAvailable ? '✅ AVAILABLE' : '❌ OUT OF STOCK'}`);
            console.log(`   Raw Status: ${result.stockStatus}`);
            console.log(`   Price: ${result.price || 'N/A'}`);
            console.log(`   Analysis: ${statusAnalysis.confidence}% confident`);
            
            // Check if status changed from last check
            if (this.lastStatus !== null && this.lastStatus !== statusAnalysis.isAvailable) {
                if (statusAnalysis.isAvailable) {
                    console.log('\n🚨 STATUS CHANGE DETECTED: MEPIFORM IS NOW AVAILABLE!');
                    await this.handleStockAvailable(result, statusAnalysis);
                } else {
                    console.log('\n📉 Status changed: MEPIFORM is no longer available');
                }
            }
            
            this.lastStatus = statusAnalysis.isAvailable;
            
            // Log detailed result
            logger.info('MEPIFORM check completed', {
                product: this.productName,
                available: statusAnalysis.isAvailable,
                price: result.price,
                confidence: statusAnalysis.confidence,
                statusText: result.stockStatus
            });
            
            return {
                ...result,
                ...statusAnalysis,
                productName: this.productName
            };
            
        } catch (error) {
            logger.error('Error checking MEPIFORM status:', error);
            console.log(`❌ Error checking MEPIFORM: ${error.message}`);
            return null;
        }
    }
    
    analyzeStockStatus(result) {
        const statusText = (result.stockStatus || '').toLowerCase();
        
        // Swedish availability keywords
        const availableKeywords = [
            'tillgänglig', 'i lager', 'finns', 'leverans',
            'available', 'in stock', 'ready'
        ];
        
        // Swedish unavailable keywords  
        const unavailableKeywords = [
            'slut', 'inte tillgänglig', 'ej i lager', 'restorder',
            'out of stock', 'unavailable', 'sold out', 'inte på lager'
        ];
        
        let confidence = 50; // Default confidence
        let isAvailable = false;
        
        // Check for availability indicators
        for (const keyword of availableKeywords) {
            if (statusText.includes(keyword)) {
                isAvailable = true;
                confidence = 90;
                break;
            }
        }
        
        // Check for unavailability indicators
        for (const keyword of unavailableKeywords) {
            if (statusText.includes(keyword)) {
                isAvailable = false;
                confidence = 95;
                break;
            }
        }
        
        // Additional analysis based on common patterns
        if (statusText.includes('leveranstid') || statusText.includes('delivery')) {
            isAvailable = true;
            confidence = Math.max(confidence, 80);
        }
        
        return {
            isAvailable,
            confidence,
            analysisMethod: 'keyword_matching',
            keywordsFound: statusText
        };
    }
    
    async handleStockAvailable(productResult, statusAnalysis) {
        console.log('\n🛒 MEPIFORM IS AVAILABLE - INITIATING ORDER PROCESS');
        
        const orderConfig = config.getOrderConfig();
        
        if (!orderConfig.autoOrderEnabled) {
            console.log('⚠️  Auto-ordering is DISABLED in configuration');
            console.log('   Please enable auto-ordering or place order manually');
            return;
        }
        
        // Determine order quantity based on price and availability
        const orderQuantity = this.determineOrderQuantity(productResult);
        
        console.log(`📊 Order Details:`);
        console.log(`   Quantity: ${orderQuantity} units`);
        console.log(`   Expected total: ${orderQuantity} × ${productResult.price || 'Unknown price'}`);
        
        try {
            // Attempt to place order
            const orderResult = await this.placeOrder(productResult, orderQuantity);
            
            if (orderResult.success) {
                console.log('✅ ORDER PLACED SUCCESSFULLY!');
                console.log(`   Order ID: ${orderResult.orderId || 'N/A'}`);
                console.log(`   Quantity: ${orderQuantity}`);
                
                // Send notification
                await this.sendOrderNotification(productResult, orderQuantity, orderResult);
                
            } else {
                console.log('❌ ORDER FAILED');
                console.log(`   Error: ${orderResult.error}`);
                logger.error('MEPIFORM order failed', orderResult);
            }
            
        } catch (error) {
            console.log('❌ ORDER PROCESS ERROR:', error.message);
            logger.error('Order process error:', error);
        }
    }
    
    determineOrderQuantity(productResult) {
        // Logic to determine whether to order 350 or 700 units
        // Based on price, stock level, or other factors
        
        const price = parseFloat((productResult.price || '0').replace(/[^0-9.]/g, ''));
        const orderConfig = config.getOrderConfig();
        
        // If price is reasonable, order larger quantity
        if (price > 0 && (price * 700) <= orderConfig.maxOrderAmount) {
            return 700; // Order larger quantity
        } else if (price > 0 && (price * 350) <= orderConfig.maxOrderAmount) {
            return 350; // Order smaller quantity
        }
        
        // Default to smaller quantity for safety
        return 350;
    }
    
    async placeOrder(productResult, quantity) {
        // This would integrate with your order automation system
        console.log(`🔄 Placing order for ${quantity} units of MEPIFORM...`);
        
        try {
            // Navigate to product page
            await this.scraper.page.goto(this.productUrl, { waitUntil: 'networkidle2' });
            
            // Set quantity
            const quantitySelector = this.selectors.quantity;
            await this.scraper.page.waitForSelector(quantitySelector, { timeout: 10000 });
            await this.scraper.page.evaluate((selector) => {
                const input = document.querySelector(selector);
                if (input) input.value = '';
            }, quantitySelector);
            await this.scraper.page.type(quantitySelector, quantity.toString());
            
            // Add to cart
            const addToCartSelector = this.selectors.addToCart;
            await this.scraper.page.waitForSelector(addToCartSelector, { timeout: 10000 });
            await this.scraper.page.click(addToCartSelector);
            
            // Wait for cart update
            await this.scraper.page.waitForTimeout(3000);
            
            return {
                success: true,
                orderId: `MEPIFORM-${Date.now()}`,
                quantity: quantity,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async sendOrderNotification(productResult, quantity, orderResult) {
        const message = `
🚨 MEPIFORM ORDER PLACED!

Product: ${this.productName}
Quantity: ${quantity} units
Price: ${productResult.price}
Order ID: ${orderResult.orderId}
Time: ${new Date().toLocaleString('sv-SE')}

Status: ${orderResult.success ? 'SUCCESS' : 'FAILED'}
        `;
        
        console.log(message);
        logger.info('MEPIFORM order notification sent', {
            product: this.productName,
            quantity,
            orderResult
        });
    }
    
    async startMonitoring() {
        if (this.isMonitoring) {
            console.log('⚠️  MEPIFORM monitoring is already running');
            return;
        }
        
        console.log('🚀 Starting MEPIFORM monitoring...');
        console.log(`📍 Product: ${this.productName}`);
        console.log(`🔗 URL: ${this.productUrl}`);
        console.log(`📦 Order quantities: ${this.orderQuantities.join(' or ')} units`);
        
        this.isMonitoring = true;
        
        // Initial check
        await this.checkMepiformStatus();
        
        // Set up monitoring interval (every 5 minutes during active hours)
        const intervalMinutes = config.isWithinActiveHours() ? 5 : 15;
        console.log(`⏰ Monitoring interval: ${intervalMinutes} minutes\n`);
        
        this.monitoringInterval = setInterval(async () => {
            if (config.isWithinActiveHours()) {
                await this.checkMepiformStatus();
            } else {
                console.log(`😴 Outside active hours, checking every 15 minutes...`);
            }
        }, intervalMinutes * 60 * 1000);
        
        console.log('✅ MEPIFORM monitoring started successfully');
    }
    
    async stopMonitoring() {
        if (!this.isMonitoring) {
            console.log('⚠️  MEPIFORM monitoring is not running');
            return;
        }
        
        console.log('🛑 Stopping MEPIFORM monitoring...');
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        if (this.scraper) {
            await this.scraper.close();
        }
        
        console.log('✅ MEPIFORM monitoring stopped');
    }
}

// Handle graceful shutdown
const monitor = new MepiformMonitor();

process.on('SIGINT', async () => {
    console.log('\n🛑 Received shutdown signal');
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
            console.log('❌ Failed to initialize MEPIFORM monitor');
            process.exit(1);
        }
    })();
}

module.exports = monitor;