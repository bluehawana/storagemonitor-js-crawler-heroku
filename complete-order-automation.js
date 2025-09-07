const ProductScraper = require('./src/scrapers/productScraper');
const config = require('./src/config/config');
const logger = require('./src/utils/logger');
require('dotenv').config();

class CompleteOrderAutomation {
    constructor() {
        this.MEPIFORM = {
            name: 'MEPIFORM 10X18CM 5ST',
            url: 'https://oriola4care.oriola-kd.com/Varum%C3%A4rken/M%C3%96LNLYCKE-HEALTH-CARE/MEPIFORM-10X18CM-5ST/p/282186-888',
            orderQuantities: [350, 700],
            maxPrice: 300 // SEK per unit
        };
        
        this.deliveryAddress = {
            street: 'NYA TINGSTADSGATAN 1',
            postalCode: '42244',
            city: 'HISINGS BACKA'
        };
        
        this.scraper = null;
        this.isMonitoring = false;
        this.lastStatus = null;
        this.orderCounter = 1; // For generating unique order references
    }
    
    async initialize() {
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
            this.scraper = new ProductScraper(scraperConfig);
            const initialized = await this.scraper.initialize();
            
            if (initialized) {
                console.log('✅ Complete order automation initialized');
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Initialization failed:', error.message);
            return false;
        }
    }
    
    generateOrderReference() {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
        const orderNum = this.orderCounter.toString().padStart(3, '0'); // 001, 002, etc.
        this.orderCounter++;
        
        return `${dateStr}${orderNum}`;
    }
    
    getNextWorkingDay() {
        const today = new Date();
        let nextDay = new Date(today);
        nextDay.setDate(today.getDate() + 1);
        
        // Skip weekends - find next Monday if it's Friday/Saturday
        while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
            nextDay.setDate(nextDay.getDate() + 1);
        }
        
        return nextDay.toISOString().slice(0, 10); // YYYY-MM-DD format
    }
    
    async checkMepiformAvailability() {
        try {
            console.log(`🔍 Checking MEPIFORM availability... [${new Date().toLocaleString('sv-SE')}]`);
            
            const result = await this.scraper.checkProductAvailability(
                this.MEPIFORM.url,
                '.stock-status, .lagerstatus, .tillgänglighet, .availability, .lager'
            );
            
            // Analyze Swedish stock status
            const statusText = (result.stockStatus || '').toLowerCase();
            let isAvailable = false;
            
            // Check for availability indicators
            if (statusText.includes('tillgänglig') || 
                statusText.includes('i lager') || 
                statusText.includes('leverans') ||
                statusText.includes('beställ') ||
                !statusText.includes('slut') &&
                !statusText.includes('tillfälligt slut')) {
                isAvailable = true;
            }
            
            console.log(`📦 ${result.title || this.MEPIFORM.name}`);
            console.log(`📍 Status: ${isAvailable ? '✅ AVAILABLE' : '❌ OUT OF STOCK'}`);
            console.log(`📋 Raw status: "${result.stockStatus}"`);
            console.log(`💰 Price: ${result.price || 'N/A'}`);
            
            // Check for status change from out-of-stock to available
            if (this.lastStatus === false && isAvailable === true) {
                console.log('\n🚨 STOCK ALERT: MEPIFORM IS NOW AVAILABLE!');
                await this.handleStockAvailable(result);
            }
            
            this.lastStatus = isAvailable;
            
            return { ...result, isAvailable };
            
        } catch (error) {
            console.error('❌ Error checking MEPIFORM:', error.message);
            return null;
        }
    }
    
    async handleStockAvailable(productResult) {
        console.log('\n🛒 INITIATING COMPLETE ORDER PROCESS');
        console.log('====================================');
        
        if (process.env.AUTO_ORDER_ENABLED !== 'true') {
            console.log('⚠️  Auto-ordering disabled - sending notification only');
            this.sendNotification(productResult);
            return;
        }
        
        // Determine order strategy (700 units or split orders)
        const orderStrategy = this.determineOrderStrategy(productResult);
        
        console.log(`📊 Order Strategy: ${orderStrategy.strategy.toUpperCase()}`);
        console.log(`📦 Total Target: ${orderStrategy.totalUnits} units`);
        console.log(`💰 Estimated Cost: ${orderStrategy.estimatedCost} SEK`);
        
        if (orderStrategy.strategy === 'split') {
            console.log(`🔄 Split into ${orderStrategy.orderCount} orders: [${orderStrategy.orders.join(', ')}]`);
        }
        
        try {
            const allOrderResults = [];
            
            if (orderStrategy.strategy === 'single') {
                // Single order
                const orderResult = await this.placeCompleteOrder(orderStrategy.orders[0]);
                allOrderResults.push(orderResult);
                
            } else {
                // Multiple split orders
                console.log('\n🔄 Executing split order strategy...');
                
                for (let i = 0; i < orderStrategy.orders.length; i++) {
                    const quantity = orderStrategy.orders[i];
                    console.log(`\n📦 Order ${i + 1}/${orderStrategy.orders.length}: ${quantity} units`);
                    
                    const orderResult = await this.placeCompleteOrder(quantity);
                    allOrderResults.push(orderResult);
                    
                    if (!orderResult.success) {
                        console.log(`❌ Order ${i + 1} failed: ${orderResult.error}`);
                        break; // Stop if any order fails
                    }
                    
                    // Wait between orders to avoid being blocked
                    if (i < orderStrategy.orders.length - 1) {
                        console.log('⏳ Waiting 30 seconds before next order...');
                        await new Promise(resolve => setTimeout(resolve, 30000));
                    }
                }
            }
            
            // Analyze results
            const successfulOrders = allOrderResults.filter(r => r.success);
            const totalOrderedUnits = successfulOrders.reduce((sum, r) => sum + r.quantity, 0);
            
            if (successfulOrders.length > 0) {
                console.log('\n✅ ORDER SEQUENCE COMPLETED!');
                console.log(`🎯 Successful Orders: ${successfulOrders.length}/${allOrderResults.length}`);
                console.log(`📦 Total Units Ordered: ${totalOrderedUnits} units`);
                console.log(`🎯 Target Achievement: ${Math.round((totalOrderedUnits / orderStrategy.totalUnits) * 100)}%`);
                
                this.sendMultiOrderConfirmation(productResult, orderStrategy, allOrderResults);
            } else {
                console.log('\n❌ ALL ORDERS FAILED');
                logger.error('All orders failed', { orderStrategy, results: allOrderResults });
            }
            
        } catch (error) {
            console.error('❌ Order sequence error:', error.message);
            logger.error('Order sequence exception', error);
        }
    }
    
    determineOrderStrategy(productResult) {
        const priceText = productResult.price || '';
        // Handle Swedish price format (250,00 SEK)
        let price = parseFloat(priceText.replace(/[^0-9,]/g, '').replace(',', '.'));
        const maxAmount = parseInt(process.env.MAX_ORDER_AMOUNT) || 250000;
        
        if (price <= 0) {
            return { strategy: 'single', orders: [350] }; // Default fallback
        }
        
        // Strategy 1: Try 700 units first (priority target)
        if ((price * 700) <= maxAmount) {
            return { 
                strategy: 'single', 
                orders: [700],
                totalUnits: 700,
                estimatedCost: price * 700
            };
        }
        
        // Strategy 2: Split into multiple orders to reach 700 total
        const possibleSplits = [
            [350, 350],      // 700 total in 2 orders
            [350, 200, 150], // 700 total in 3 orders  
            [350, 100, 100, 100, 50], // 700 total in 5 orders
            [300, 200, 200], // 700 total in 3 orders
            [250, 250, 200], // 700 total in 3 orders
            [350, 140, 110, 100], // 700 total in 4 orders
        ];
        
        // Find the best split strategy that fits within budget
        for (const split of possibleSplits) {
            const totalCost = split.reduce((sum, qty) => sum + (price * qty), 0);
            const maxSingleOrderCost = Math.max(...split.map(qty => price * qty));
            
            if (totalCost <= maxAmount && maxSingleOrderCost <= maxAmount) {
                return {
                    strategy: 'split',
                    orders: split,
                    totalUnits: split.reduce((sum, qty) => sum + qty, 0),
                    estimatedCost: totalCost,
                    orderCount: split.length
                };
            }
        }
        
        // Strategy 3: Single largest possible order (up to 700)
        const maxPossibleUnits = Math.floor(maxAmount / price);
        if (maxPossibleUnits >= 100) {
            const orderAmount = Math.min(maxPossibleUnits, 700); // Cap at 700 max
            return {
                strategy: 'single',
                orders: [orderAmount],
                totalUnits: orderAmount,
                estimatedCost: price * orderAmount
            };
        }
        
        // Strategy 4: Minimum viable order (last resort)
        return {
            strategy: 'single',
            orders: [50],
            totalUnits: 50,
            estimatedCost: price * 50
        };
    }
    
    async placeCompleteOrder(quantity) {
        console.log(`🔄 Starting complete order process for ${quantity} units...`);
        
        const orderReference = this.generateOrderReference();
        const deliveryDate = this.getNextWorkingDay();
        
        try {
            // Step 1: Navigate to product page
            console.log('📍 Step 1: Navigating to MEPIFORM product page...');
            await this.scraper.page.goto(this.MEPIFORM.url, { waitUntil: 'networkidle2' });
            await this.scraper.page.waitForTimeout(2000);
            
            // Step 2: Set quantity
            console.log(`📦 Step 2: Setting quantity to ${quantity}...`);
            const quantitySet = await this.setProductQuantity(quantity);
            if (!quantitySet) {
                throw new Error('Failed to set product quantity');
            }
            
            // Step 3: Add to cart
            console.log('🛒 Step 3: Adding to cart...');
            const addedToCart = await this.addToCart();
            if (!addedToCart) {
                throw new Error('Failed to add product to cart');
            }
            
            // Step 4: Proceed to checkout
            console.log('💳 Step 4: Proceeding to checkout...');
            await this.proceedToCheckout();
            
            // Step 5: Fill checkout form
            console.log('📝 Step 5: Filling checkout form...');
            await this.fillCheckoutForm(orderReference, deliveryDate);
            
            // Step 6: Review and confirm order
            console.log('✅ Step 6: Confirming order...');
            const confirmed = await this.confirmOrder();
            
            if (confirmed) {
                // Extract order details from confirmation page
                const orderDetails = await this.extractOrderConfirmation();
                
                return {
                    success: true,
                    orderReference: orderReference,
                    deliveryDate: deliveryDate,
                    quantity: quantity,
                    totalCost: orderDetails.totalCost || 'N/A',
                    orderId: orderDetails.orderId || orderReference,
                    timestamp: new Date().toISOString()
                };
            } else {
                throw new Error('Order confirmation failed');
            }
            
        } catch (error) {
            console.error('❌ Order process failed:', error.message);
            
            // Take screenshot for debugging
            try {
                await this.scraper.page.screenshot({ 
                    path: `order-error-${Date.now()}.png`, 
                    fullPage: true 
                });
                console.log('📸 Error screenshot saved');
            } catch (screenshotError) {
                console.log('Could not save screenshot');
            }
            
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async setProductQuantity(quantity) {
        const quantitySelectors = [
            'input[name="quantity"]',
            'input[name="antal"]',
            '.quantity-input',
            '#qty',
            'input[type="number"]',
            '.qty-input'
        ];
        
        for (const selector of quantitySelectors) {
            try {
                await this.scraper.page.waitForSelector(selector, { timeout: 3000 });
                
                // Clear existing value
                await this.scraper.page.click(selector, { clickCount: 3 });
                await this.scraper.page.type(selector, quantity.toString());
                
                console.log(`✅ Quantity set using: ${selector}`);
                return true;
            } catch (error) {
                continue;
            }
        }
        
        return false;
    }
    
    async addToCart() {
        const addToCartSelectors = [
            '.add-to-cart',
            '.lägg-i-kundvagn',
            'button[data-action="add"]',
            'input[value*="cart"]',
            'button[type="submit"]',
            '[class*="add-cart"]'
        ];
        
        for (const selector of addToCartSelectors) {
            try {
                await this.scraper.page.waitForSelector(selector, { timeout: 3000 });
                await this.scraper.page.click(selector);
                
                // Wait for cart update
                await this.scraper.page.waitForTimeout(3000);
                
                console.log(`✅ Added to cart using: ${selector}`);
                return true;
            } catch (error) {
                continue;
            }
        }
        
        return false;
    }
    
    async proceedToCheckout() {
        // Look for checkout/cart page navigation
        const checkoutSelectors = [
            '.checkout',
            '.till-kassan',
            '.cart',
            '.kundvagn',
            'a[href*="checkout"]',
            'a[href*="cart"]'
        ];
        
        for (const selector of checkoutSelectors) {
            try {
                await this.scraper.page.waitForSelector(selector, { timeout: 3000 });
                await this.scraper.page.click(selector);
                await this.scraper.page.waitForTimeout(3000);
                console.log(`✅ Navigated to checkout using: ${selector}`);
                return true;
            } catch (error) {
                continue;
            }
        }
        
        // If no explicit checkout button, look for checkout page directly
        const currentUrl = this.scraper.page.url();
        if (currentUrl.includes('checkout') || currentUrl.includes('cart')) {
            console.log('✅ Already on checkout page');
            return true;
        }
        
        return false;
    }
    
    async fillCheckoutForm(orderReference, deliveryDate) {
        console.log(`📋 Filling checkout form with reference: ${orderReference}`);
        
        try {
            // Fill delivery date (Önskat leveransdatum)
            const deliveryDateSelectors = [
                'input[name*="delivery"]',
                'input[name*="leverans"]',
                'input[type="date"]',
                '#deliveryDate',
                '#leveransdatum'
            ];
            
            for (const selector of deliveryDateSelectors) {
                try {
                    await this.scraper.page.waitForSelector(selector, { timeout: 3000 });
                    await this.scraper.page.click(selector, { clickCount: 3 });
                    await this.scraper.page.type(selector, deliveryDate);
                    console.log(`✅ Delivery date set: ${deliveryDate}`);
                    break;
                } catch (error) {
                    continue;
                }
            }
            
            // Fill "Er referens" (Your reference)
            const referenceSelectors = [
                'input[name*="reference"]',
                'input[name*="referens"]',
                '#customerReference',
                '#erReferens'
            ];
            
            for (const selector of referenceSelectors) {
                try {
                    await this.scraper.page.waitForSelector(selector, { timeout: 3000 });
                    await this.scraper.page.click(selector, { clickCount: 3 });
                    await this.scraper.page.type(selector, orderReference);
                    console.log(`✅ Customer reference set: ${orderReference}`);
                    break;
                } catch (error) {
                    continue;
                }
            }
            
            // Fill "Ert beställningsnummer" (Your order number)
            const orderNumberSelectors = [
                'input[name*="orderNumber"]',
                'input[name*="beställningsnummer"]',
                '#orderNumber',
                '#ertBeställningsnummer'
            ];
            
            for (const selector of orderNumberSelectors) {
                try {
                    await this.scraper.page.waitForSelector(selector, { timeout: 3000 });
                    await this.scraper.page.click(selector, { clickCount: 3 });
                    await this.scraper.page.type(selector, orderReference);
                    console.log(`✅ Order number set: ${orderReference}`);
                    break;
                } catch (error) {
                    continue;
                }
            }
            
            console.log('✅ Checkout form filled successfully');
            
        } catch (error) {
            console.log('⚠️  Could not fill all checkout fields:', error.message);
        }
    }
    
    async confirmOrder() {
        console.log('🔄 Looking for order confirmation checkbox and submit button...');
        
        try {
            // First, look for and check the "Godkänn order" checkbox
            const checkboxSelectors = [
                'input[type="checkbox"]',
                'input[name*="approve"]',
                'input[name*="godkänn"]',
                '.approve-order',
                '.godkann-order'
            ];
            
            let checkboxFound = false;
            for (const selector of checkboxSelectors) {
                try {
                    await this.scraper.page.waitForSelector(selector, { timeout: 3000 });
                    await this.scraper.page.click(selector);
                    console.log(`✅ Order approval checkbox checked: ${selector}`);
                    checkboxFound = true;
                    break;
                } catch (error) {
                    continue;
                }
            }
            
            if (!checkboxFound) {
                console.log('⚠️  Could not find approval checkbox');
            }
            
            // Wait a moment for any form validation
            await this.scraper.page.waitForTimeout(2000);
            
            // Now find and click the submit button
            const submitSelectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                '.submit-order',
                '.place-order',
                '.confirm-order',
                '.godkänn-order',
                'button:contains("Godkänn")',
                '[value*="Godkänn"]'
            ];
            
            for (const selector of submitSelectors) {
                try {
                    await this.scraper.page.waitForSelector(selector, { timeout: 3000 });
                    
                    // Check if button is enabled
                    const isDisabled = await this.scraper.page.$eval(selector, el => el.disabled);
                    if (isDisabled) {
                        console.log(`⚠️  Submit button is disabled: ${selector}`);
                        continue;
                    }
                    
                    // Click the submit button
                    await Promise.all([
                        this.scraper.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
                        this.scraper.page.click(selector)
                    ]);
                    
                    console.log(`✅ Order confirmed using: ${selector}`);
                    return true;
                    
                } catch (error) {
                    console.log(`⚠️  Could not use submit selector ${selector}:`, error.message);
                    continue;
                }
            }
            
            return false;
            
        } catch (error) {
            console.error('❌ Order confirmation failed:', error.message);
            return false;
        }
    }
    
    async extractOrderConfirmation() {
        try {
            // Wait for confirmation page to load
            await this.scraper.page.waitForTimeout(3000);
            
            const confirmationDetails = await this.scraper.page.evaluate(() => {
                // Look for order confirmation details
                const orderIdElement = document.querySelector('[class*="order-id"], [class*="ordernummer"]');
                const totalElement = document.querySelector('[class*="total"], [class*="summa"]');
                
                return {
                    orderId: orderIdElement ? orderIdElement.textContent.trim() : null,
                    totalCost: totalElement ? totalElement.textContent.trim() : null,
                    confirmationText: document.title || ''
                };
            });
            
            console.log('📄 Order confirmation extracted');
            return confirmationDetails;
            
        } catch (error) {
            console.log('⚠️  Could not extract confirmation details:', error.message);
            return {};
        }
    }
    
    sendOrderConfirmation(productResult, quantity, orderResult) {
        const message = `
🎉 MEPIFORM ORDER CONFIRMATION 🎉

Product: ${this.MEPIFORM.name}
Quantity: ${quantity} units
Order Reference: ${orderResult.orderReference}
Delivery Date: ${orderResult.deliveryDate}
Total Cost: ${orderResult.totalCost}
Order ID: ${orderResult.orderId}

Delivery Address:
${this.deliveryAddress.street}
${this.deliveryAddress.postalCode} ${this.deliveryAddress.city}

Timestamp: ${new Date().toLocaleString('sv-SE')}
Status: ✅ ORDER CONFIRMED
        `;
        
        console.log('\n📧 ORDER CONFIRMATION:');
        console.log(message);
        
        logger.info('MEPIFORM order confirmed', {
            product: this.MEPIFORM.name,
            quantity,
            orderReference: orderResult.orderReference,
            totalCost: orderResult.totalCost,
            success: true
        });
    }
    
    sendMultiOrderConfirmation(productResult, orderStrategy, allOrderResults) {
        const successfulOrders = allOrderResults.filter(r => r.success);
        const totalUnits = successfulOrders.reduce((sum, r) => sum + r.quantity, 0);
        const totalCost = successfulOrders.reduce((sum, r) => {
            const cost = parseFloat(r.totalCost?.toString().replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
            return sum + cost;
        }, 0);
        
        const message = `
🎉 MEPIFORM MULTI-ORDER CONFIRMATION 🎉

Product: ${this.MEPIFORM.name}
Strategy: ${orderStrategy.strategy.toUpperCase()} ORDERS
Target: ${orderStrategy.totalUnits} units
Achievement: ${totalUnits}/${orderStrategy.totalUnits} units (${Math.round((totalUnits/orderStrategy.totalUnits)*100)}%)

ORDER BREAKDOWN:
${successfulOrders.map((order, i) => 
    `Order ${i+1}: ${order.quantity} units - ${order.orderReference} - ${order.totalCost || 'N/A'}`
).join('\n')}

SUMMARY:
✅ Successful Orders: ${successfulOrders.length}/${allOrderResults.length}
📦 Total Units: ${totalUnits}
💰 Total Cost: ~${totalCost} SEK
📅 Delivery Date: ${successfulOrders[0]?.deliveryDate || 'N/A'}

Delivery Address:
${this.deliveryAddress.street}
${this.deliveryAddress.postalCode} ${this.deliveryAddress.city}

Timestamp: ${new Date().toLocaleString('sv-SE')}
Status: ✅ MULTI-ORDER SEQUENCE COMPLETED
        `;
        
        console.log('\n📧 MULTI-ORDER CONFIRMATION:');
        console.log(message);
        
        logger.info('MEPIFORM multi-order confirmed', {
            product: this.MEPIFORM.name,
            strategy: orderStrategy.strategy,
            targetUnits: orderStrategy.totalUnits,
            achievedUnits: totalUnits,
            successfulOrders: successfulOrders.length,
            totalOrders: allOrderResults.length,
            orderDetails: successfulOrders.map(o => ({
                quantity: o.quantity,
                reference: o.orderReference,
                cost: o.totalCost
            }))
        });
    }
    
    sendNotification(productResult) {
        const message = `
🚨 MEPIFORM STOCK ALERT 🚨

Product: ${this.MEPIFORM.name}
Status: ✅ AVAILABLE
Price: ${productResult.price}
URL: ${this.MEPIFORM.url}

Time: ${new Date().toLocaleString('sv-SE')}

Auto-ordering is disabled. Please place order manually.
        `;
        
        console.log('\n📧 STOCK ALERT:');
        console.log(message);
        
        logger.info('MEPIFORM stock alert', {
            product: this.MEPIFORM.name,
            available: true,
            price: productResult.price
        });
    }
    
    async startMonitoring() {
        if (this.isMonitoring) {
            console.log('⚠️  Monitoring already running');
            return;
        }
        
        console.log('🚀 Starting Complete MEPIFORM Order Automation');
        console.log('==============================================');
        console.log(`📦 Product: ${this.MEPIFORM.name}`);
        console.log(`🔗 URL: ${this.MEPIFORM.url}`);
        console.log(`📊 Quantities: ${this.MEPIFORM.orderQuantities.join(' or ')} units`);
        console.log(`🏠 Delivery: ${this.deliveryAddress.street}, ${this.deliveryAddress.city}`);
        console.log(`🔄 Auto-order: ${process.env.AUTO_ORDER_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}`);
        console.log('==============================================\n');
        
        this.isMonitoring = true;
        
        // Initial check
        await this.checkMepiformAvailability();
        
        // Set monitoring interval
        const intervalMinutes = 5; // Check every 5 minutes
        console.log(`⏰ Monitoring every ${intervalMinutes} minutes`);
        console.log('─'.repeat(50));
        
        this.monitoringInterval = setInterval(async () => {
            await this.checkMepiformAvailability();
        }, intervalMinutes * 60 * 1000);
        
        console.log('✅ Complete order automation started');
    }
    
    async stopMonitoring() {
        if (!this.isMonitoring) return;
        
        console.log('\n🛑 Stopping complete order automation...');
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        if (this.scraper) {
            await this.scraper.close();
        }
        
        console.log('✅ Monitoring stopped');
    }
}

// Handle graceful shutdown
const automation = new CompleteOrderAutomation();

process.on('SIGINT', async () => {
    console.log('\n🛑 Shutdown signal received');
    await automation.stopMonitoring();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Termination signal received');
    await automation.stopMonitoring();
    process.exit(0);
});

// Auto-start if this file is run directly
if (require.main === module) {
    (async () => {
        const initialized = await automation.initialize();
        
        if (initialized) {
            await automation.startMonitoring();
        } else {
            console.log('❌ Failed to initialize complete order automation');
            console.log('\n🔧 Troubleshooting:');
            console.log('1. Check internet connection');
            console.log('2. Verify login credentials in .env');
            console.log('3. Test manual login at Oriola4Care');
            process.exit(1);
        }
    })();
}

module.exports = CompleteOrderAutomation;