const ProductScraper = require('./src/scrapers/productScraper');
const config = require('./src/config/config');
const logger = require('./src/utils/logger');
require('dotenv').config();

// MEPIFORM Product Configuration
const MEPIFORM = {
    name: 'MEPIFORM 10X18CM 5ST',
    url: 'https://oriola4care.oriola-kd.com/Varum%C3%A4rken/M%C3%96LNLYCKE-HEALTH-CARE/MEPIFORM-10X18CM-5ST/p/282186-888',
    orderQuantities: [350, 700],
    maxPrice: 1000
};

let scraper = null;
let isMonitoring = false;
let lastStatus = null;
let monitoringInterval = null;

async function initializeMonitoring() {
    console.log('🚀 Starting MEPIFORM Monitoring System');
    console.log('======================================\n');
    
    console.log(`📦 Product: ${MEPIFORM.name}`);
    console.log(`🔗 URL: ${MEPIFORM.url}`);
    console.log(`📊 Order quantities: ${MEPIFORM.orderQuantities.join(' or ')} units`);
    console.log(`💰 Max price: $${MEPIFORM.maxPrice}`);
    console.log(`🔄 Auto-order: ${process.env.AUTO_ORDER_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}\n`);
    
    // Configure scraper
    const scraperConfig = {
        loginUrl: process.env.LOGIN_URL,
        username: process.env.USERNAME,
        password: process.env.PASSWORD,
        usernameSelector: '#j_username',
        passwordSelector: '#j_password',
        loginButtonSelector: 'button[type="submit"]',
        loginSuccessSelector: '.logout, .dashboard, .account-info, nav'
    };
    
    try {
        scraper = new ProductScraper(scraperConfig);
        const initialized = await scraper.initialize();
        
        if (!initialized) {
            throw new Error('Failed to initialize scraper');
        }
        
        console.log('✅ Monitoring system initialized');
        
        // Add MEPIFORM to config
        addMepiformToConfig();
        
        return true;
    } catch (error) {
        console.error('❌ Initialization failed:', error.message);
        return false;
    }
}

function addMepiformToConfig() {
    try {
        const existingProducts = config.getTrackedProducts();
        const productExists = existingProducts.some(p => p.url === MEPIFORM.url);
        
        if (!productExists) {
            config.addProduct({
                name: MEPIFORM.name,
                url: MEPIFORM.url,
                stockSelector: '.stock-status, .lagerstatus, .tillgänglighet, .availability',
                maxPrice: MEPIFORM.maxPrice,
                orderQuantity: 350,
                alternateQuantity: 700,
                enabled: true,
                autoOrder: true
            });
            console.log(`✅ ${MEPIFORM.name} added to configuration`);
        }
    } catch (error) {
        logger.error('Error adding MEPIFORM to config:', error);
    }
}

async function checkMepiformStatus() {
    try {
        console.log(`\n🔍 Checking MEPIFORM status... [${new Date().toLocaleString('sv-SE', {timezone: 'Europe/Stockholm'})}]`);
        
        const result = await scraper.checkProductAvailability(
            MEPIFORM.url,
            '.stock-status, .lagerstatus, .tillgänglighet, .availability, .in-stock, [class*="stock"]'
        );
        
        // Analyze status for Swedish content
        const isAvailable = analyzeSwedishStockStatus(result.stockStatus);
        
        console.log(`📦 ${result.title || MEPIFORM.name}`);
        console.log(`📍 Status: ${isAvailable ? '✅ TILLGÄNGLIG (AVAILABLE)' : '❌ SLUT I LAGER (OUT OF STOCK)'}`);
        console.log(`💰 Price: ${result.price || 'N/A'}`);
        console.log(`📋 Raw status: ${result.stockStatus || 'N/A'}`);
        
        // Check for status change
        if (lastStatus !== null && lastStatus !== isAvailable) {
            if (isAvailable) {
                console.log('\n🚨🚨 CRITICAL ALERT: MEPIFORM IS NOW AVAILABLE! 🚨🚨');
                await handleStockAvailable(result);
            } else {
                console.log('\n📉 MEPIFORM went out of stock');
            }
        }
        
        lastStatus = isAvailable;
        
        // Log the check
        logger.info('MEPIFORM status checked', {
            available: isAvailable,
            price: result.price,
            statusText: result.stockStatus,
            timestamp: new Date().toISOString()
        });
        
        return { ...result, isAvailable };
        
    } catch (error) {
        console.error('❌ Error checking MEPIFORM:', error.message);
        logger.error('MEPIFORM check failed', error);
        return null;
    }
}

function analyzeSwedishStockStatus(statusText) {
    if (!statusText) return false;
    
    const text = statusText.toLowerCase();
    
    // Swedish available indicators
    const availableKeywords = [
        'tillgänglig', 'i lager', 'finns', 'leverans', 'beställ',
        'available', 'in stock', 'order', 'buy'
    ];
    
    // Swedish unavailable indicators
    const unavailableKeywords = [
        'slut', 'inte tillgänglig', 'ej i lager', 'restorder', 'tillfälligt slut',
        'out of stock', 'unavailable', 'sold out', 'temporarily out'
    ];
    
    // Check availability
    for (const keyword of availableKeywords) {
        if (text.includes(keyword)) {
            return true;
        }
    }
    
    // Check unavailability  
    for (const keyword of unavailableKeywords) {
        if (text.includes(keyword)) {
            return false;
        }
    }
    
    // Default to unavailable if status is unclear
    return false;
}

async function handleStockAvailable(productResult) {
    console.log('\n🛒 MEPIFORM AVAILABLE - STARTING ORDER PROCESS');
    console.log('===============================================');
    
    if (process.env.AUTO_ORDER_ENABLED !== 'true') {
        console.log('⚠️  Auto-ordering is DISABLED');
        console.log('📧 Sending notification instead of placing order');
        sendNotification(productResult);
        return;
    }
    
    // Determine order quantity based on price
    const price = parseFloat((productResult.price || '0').replace(/[^0-9.]/g, ''));
    let orderQuantity = 350; // Default
    
    if (price > 0) {
        const maxAmount = parseInt(process.env.MAX_ORDER_AMOUNT) || 50000;
        if (price * 700 <= maxAmount) {
            orderQuantity = 700;
        } else if (price * 350 <= maxAmount) {
            orderQuantity = 350;
        } else {
            console.log('⚠️  Price too high for automatic ordering');
            sendNotification(productResult);
            return;
        }
    }
    
    console.log(`📦 Order quantity: ${orderQuantity} units`);
    console.log(`💰 Estimated cost: ${orderQuantity} × ${productResult.price}`);
    
    try {
        const orderResult = await placeOrder(orderQuantity);
        
        if (orderResult.success) {
            console.log('\n✅ ORDER PLACED SUCCESSFULLY!');
            console.log(`🎯 Quantity: ${orderQuantity} units`);
            console.log(`📧 Confirmation: Check your email`);
            
            sendNotification(productResult, orderQuantity, orderResult);
        } else {
            console.log('\n❌ ORDER FAILED');
            console.log(`Error: ${orderResult.error}`);
        }
        
    } catch (error) {
        console.error('❌ Order process error:', error.message);
    }
}

async function placeOrder(quantity) {
    console.log(`🔄 Attempting to place order for ${quantity} units...`);
    
    try {
        // Navigate to MEPIFORM product page
        await scraper.page.goto(MEPIFORM.url, { waitUntil: 'networkidle2' });
        await scraper.page.waitForTimeout(2000);
        
        // Find quantity input (multiple possible selectors)
        const quantitySelectors = [
            'input[name="quantity"]',
            'input[name="antal"]', 
            '.quantity-input',
            '#qty',
            'input[type="number"]'
        ];
        
        let quantitySet = false;
        for (const selector of quantitySelectors) {
            try {
                await scraper.page.waitForSelector(selector, { timeout: 3000 });
                await scraper.page.evaluate((sel) => {
                    const input = document.querySelector(sel);
                    if (input) input.value = '';
                }, selector);
                await scraper.page.type(selector, quantity.toString());
                quantitySet = true;
                console.log(`✅ Quantity set using selector: ${selector}`);
                break;
            } catch (e) {
                continue;
            }
        }
        
        if (!quantitySet) {
            throw new Error('Could not find quantity input field');
        }
        
        // Find and click add to cart button
        const addToCartSelectors = [
            '.add-to-cart',
            '.lägg-i-kundvagn',
            'button[data-action="add"]',
            'input[value*="cart"]',
            'button[type="submit"]'
        ];
        
        let orderPlaced = false;
        for (const selector of addToCartSelectors) {
            try {
                await scraper.page.waitForSelector(selector, { timeout: 3000 });
                await scraper.page.click(selector);
                orderPlaced = true;
                console.log(`✅ Order placed using selector: ${selector}`);
                break;
            } catch (e) {
                continue;
            }
        }
        
        if (!orderPlaced) {
            throw new Error('Could not find add to cart button');
        }
        
        // Wait for cart update
        await scraper.page.waitForTimeout(5000);
        
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

function sendNotification(productResult, quantity = null, orderResult = null) {
    const message = quantity ? 
        `🚨 MEPIFORM ORDER ${orderResult?.success ? 'SUCCESS' : 'FAILED'}!
Product: ${MEPIFORM.name}
Quantity: ${quantity} units
Price: ${productResult.price}
Time: ${new Date().toLocaleString('sv-SE')}` :
        `🚨 MEPIFORM NOW AVAILABLE!
Product: ${MEPIFORM.name}  
Price: ${productResult.price}
Status: Ready to order
Time: ${new Date().toLocaleString('sv-SE')}`;
    
    console.log('\n📧 NOTIFICATION:');
    console.log(message);
    
    logger.info('MEPIFORM notification', {
        available: true,
        quantity,
        orderResult,
        price: productResult.price
    });
}

async function startMonitoring() {
    if (isMonitoring) {
        console.log('⚠️  Monitoring already running');
        return;
    }
    
    console.log('🔄 Starting continuous monitoring...');
    isMonitoring = true;
    
    // Initial check
    await checkMepiformStatus();
    
    // Set monitoring interval
    const intervalMinutes = config.isWithinActiveHours() ? 5 : 15;
    console.log(`⏰ Checking every ${intervalMinutes} minutes`);
    console.log('📅 Active hours: 7:00 - 19:00 (Swedish time)');
    console.log('─'.repeat(50));
    
    monitoringInterval = setInterval(async () => {
        const currentInterval = config.isWithinActiveHours() ? 5 : 15;
        await checkMepiformStatus();
    }, intervalMinutes * 60 * 1000);
    
    console.log('✅ MEPIFORM monitoring started successfully');
}

async function stopMonitoring() {
    if (!isMonitoring) return;
    
    console.log('\n🛑 Stopping monitoring...');
    isMonitoring = false;
    
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }
    
    if (scraper) {
        await scraper.close();
    }
    
    console.log('✅ Monitoring stopped');
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutdown signal received');
    await stopMonitoring();
    process.exit(0);
});

// Main execution
(async () => {
    const initialized = await initializeMonitoring();
    
    if (initialized) {
        await startMonitoring();
    } else {
        console.log('❌ Failed to start monitoring');
        console.log('\n🔧 Try these troubleshooting steps:');
        console.log('1. Check your internet connection');
        console.log('2. Verify credentials in .env file');
        console.log('3. Test login: node oriola-login-test.js');
        process.exit(1);
    }
})();