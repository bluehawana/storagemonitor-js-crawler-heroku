const puppeteer = require('puppeteer');
const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

class MepiformAutomation {
    constructor() {
        this.credentials = {
            username: 'tipsboden@hotmail.com',
            password: null
        };
        
        this.products = {
            product1: {
                url: 'https://oriola4care.oriola-kd.com/Varumärken/MÖLNLYCKE-HEALTH-CARE/MEPIFORM-10X18CM-5ST/p/282186-888',
                name: 'MEPIFORM 10X18CM',
                orderQuantities: [700, 350, 140, 70],
                continuousQuantity: 70,
                minQuantity: 35,
                limitedStockQuantity: 35,
                lastBackorderTime: null
            },
            product2: {
                url: 'https://oriola4care.oriola-kd.com/Varumärken/MÖLNLYCKE-HEALTH-CARE/MEPIFORM-5X7,5CM-2ST/p/820809-888',
                name: 'MEPIFORM 5X7,5CM',
                orderQuantities: [900, 450, 270],
                minQuantity: 45,
                limitedStockQuantity: 45,
                dailyLimit: 1620,
                dailyOrdered: 0,
                lastBackorderTime: null
            }
        };
        
        this.orderCount = {
            product1: 0,
            product2: 0,
            dailyTotal: 0
        };
        
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.lastOrderTime = null;
        this.hasSuccessfulOrders = false;
        this.ordersToday = [];
    }

    async initialize() {
        console.log('🚀 Starting MEPIFORM automation system...');
        await this.loadCredentials();
        await this.resetDailyCounters();
    }

    async loadCredentials() {
        try {
            const configPath = path.join(__dirname, 'mepiform-config.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);
            this.credentials.password = config.password;
        } catch (error) {
            console.log('⚠️  No saved credentials found. Password will be requested during login.');
        }
    }

    async saveCredentials() {
        const configPath = path.join(__dirname, 'mepiform-config.json');
        await fs.writeFile(configPath, JSON.stringify({
            password: this.credentials.password
        }, null, 2));
    }

    async resetDailyCounters() {
        const today = new Date().toDateString();
        const lastResetPath = path.join(__dirname, 'last-reset.json');
        
        try {
            const lastResetData = await fs.readFile(lastResetPath, 'utf8');
            const lastReset = JSON.parse(lastResetData);
            
            if (lastReset.date !== today) {
                this.resetCounters();
                await fs.writeFile(lastResetPath, JSON.stringify({ date: today }));
            }
        } catch {
            this.resetCounters();
            await fs.writeFile(lastResetPath, JSON.stringify({ date: today }));
        }
    }

    resetCounters() {
        this.orderCount = {
            product1: 0,
            product2: 0,
            dailyTotal: 0
        };
        this.products.product2.dailyOrdered = 0;
        this.ordersToday = [];
        console.log('📅 Daily counters reset');
    }

    async promptForPassword() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question('Please enter your password: ', (password) => {
                rl.close();
                resolve(password);
            });
        });
    }

    async launchBrowser() {
        this.browser = await chromium.launch({
            headless: false,
            args: ['--disable-blink-features=AutomationControlled'],
            defaultViewport: { width: 1280, height: 720 }
        });
        
        const context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
        
        this.page = await context.newPage();
    }

    async login() {
        console.log('🔐 Logging in...');
        await this.page.goto('https://oriola4care.oriola-kd.com/login', { waitUntil: 'networkidle' });
        
        if (!this.credentials.password) {
            console.log('🔑 Password required');
            this.credentials.password = await this.promptForPassword();
        }

        await this.page.fill('#UserName', this.credentials.username);
        await this.page.fill('#Password', this.credentials.password);
        await this.page.click('#login-submit');
        
        try {
            await this.page.waitForNavigation({ timeout: 5000 });
            this.isLoggedIn = true;
            console.log('✅ Login successful');
            await this.saveCredentials();
        } catch (error) {
            const errorMessage = await this.page.textContent('.validation-summary-errors').catch(() => '');
            
            if (errorMessage.includes('expired') || errorMessage.includes('password')) {
                console.log('❌ Password expired or incorrect. Please enter new password.');
                this.credentials.password = await this.promptForPassword();
                await this.login();
            } else {
                throw new Error('Login failed: ' + errorMessage);
            }
        }
    }

    async checkInventory(product, productKey) {
        await this.page.goto(product.url, { waitUntil: 'networkidle' });
        await this.page.waitForTimeout(1000);
        
        const stockText = await this.page.textContent('.product-availability').catch(() => '');
        
        const now = Date.now();
        if (product.lastBackorderTime && (now - product.lastBackorderTime) < 180000) {
            console.log(`⏳ ${product.name}: Waiting period active (${Math.ceil((180000 - (now - product.lastBackorderTime)) / 1000)}s remaining)`);
            return null;
        }
        
        if (stockText.includes('Finns i lager, begränsat antal')) {
            console.log(`📦 ${product.name}: Limited stock available`);
            return 'limited';
        } else if (stockText === 'Finns i lager') {
            console.log(`✅ ${product.name}: In stock`);
            return 'available';
        } else if (stockText.includes('Tillfälligt slut i lager')) {
            console.log(`❌ ${product.name}: Out of stock`);
            return 'unavailable';
        }
        
        return 'unavailable';
    }

    getOrderQuantity(productKey, stockStatus) {
        const product = this.products[productKey];
        const orderCount = this.orderCount[productKey];
        
        if (stockStatus === 'limited') {
            return product.limitedStockQuantity;
        }
        
        if (productKey === 'product1') {
            if (orderCount < product.orderQuantities.length) {
                return product.orderQuantities[orderCount];
            }
            return product.continuousQuantity;
        } else {
            if (product.dailyOrdered >= product.dailyLimit) {
                console.log(`📊 ${product.name}: Daily limit reached (${product.dailyLimit})`);
                return 0;
            }
            
            if (orderCount < product.orderQuantities.length) {
                const quantity = product.orderQuantities[orderCount];
                const remaining = product.dailyLimit - product.dailyOrdered;
                return Math.min(quantity, remaining);
            }
            
            return 0;
        }
    }

    async placeOrder(product, productKey, quantity) {
        if (quantity === 0) return false;
        
        console.log(`🛒 Placing order for ${product.name}: ${quantity} units`);
        
        await this.page.fill('input[name="quantity"]', quantity.toString());
        await this.page.click('.add-to-cart-button');
        
        await this.page.waitForTimeout(2000);
        
        await this.page.click('.cart-link');
        await this.page.waitForNavigation();
        
        const success = await this.confirmOrder(product, productKey, quantity);
        
        if (success) {
            this.orderCount[productKey]++;
            this.orderCount.dailyTotal++;
            if (productKey === 'product2') {
                this.products.product2.dailyOrdered += quantity;
            }
        }
        
        return success;
    }

    async confirmOrder(product, productKey, quantity) {
        await this.page.click('.checkout-button');
        await this.page.waitForNavigation();
        
        const deliveryDate = this.getNextBusinessDay();
        await this.page.fill('input[name="deliveryDate"]', deliveryDate);
        
        const orderRef = `${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(this.orderCount.dailyTotal + 1).padStart(2, '0')}`;
        await this.page.fill('input[name="reference"]', orderRef);
        
        await this.page.check('input[name="acceptTerms"]');
        await this.page.click('.submit-order-button');
        
        try {
            await this.page.waitForSelector('text=TACK FÖR DIN ORDER!', { timeout: 10000 });
            console.log(`✅ Order successful: ${quantity} units of ${product.name}`);
            
            this.ordersToday.push({
                product: product.name,
                quantity: quantity,
                reference: orderRef,
                time: new Date().toLocaleTimeString()
            });
            
            if (!this.hasSuccessfulOrders) {
                this.hasSuccessfulOrders = true;
                await this.showSuccessNotification();
            }
            
            return true;
        } catch (error) {
            const errorText = await this.page.textContent('.error-message').catch(() => '');
            
            if (errorText.includes('credit') || errorText.includes('limit')) {
                console.log(`⚠️  Credit limit reached. Reducing quantity...`);
                return await this.retryWithReducedQuantity(product, productKey, quantity);
            }
            
            console.log(`❌ Order failed: ${errorText}`);
            return false;
        }
    }

    async retryWithReducedQuantity(product, productKey, currentQuantity) {
        const divisor = productKey === 'product1' ? 7 : 9;
        let newQuantity = currentQuantity;
        
        while (newQuantity > product.minQuantity) {
            newQuantity = Math.floor(newQuantity / 2);
            if (newQuantity % divisor !== 0) {
                newQuantity = Math.floor(newQuantity / divisor) * divisor;
            }
            
            if (newQuantity < product.minQuantity) {
                newQuantity = product.minQuantity;
            }
            
            console.log(`🔄 Retrying with ${newQuantity} units...`);
            
            await this.page.fill('.cart-quantity-input', newQuantity.toString());
            await this.page.click('.update-cart-button');
            await this.page.waitForTimeout(2000);
            
            const success = await this.confirmOrder(product, productKey, newQuantity);
            if (success) return true;
            
            if (newQuantity === product.minQuantity) {
                console.log(`❌ Cannot order even minimum quantity (${product.minQuantity}). Stopping for today.`);
                return false;
            }
        }
        
        return false;
    }

    async checkBackorders() {
        console.log('📋 Checking backorders...');
        await this.page.goto('https://oriola4care.oriola-kd.com/my-account/backorders', { waitUntil: 'networkidle' });
        
        const backorders = await this.page.$$('.backorder-item');
        
        for (const backorder of backorders) {
            const productName = await backorder.textContent('.product-name').catch(() => '');
            const orderedQty = await backorder.textContent('.ordered-quantity').catch(() => '');
            const backorderQty = await backorder.textContent('.backorder-quantity').catch(() => '');
            
            if (orderedQty === backorderQty) {
                console.log(`🗑️  Deleting backorder: ${productName}`);
                await backorder.click('.delete-button');
                
                await this.page.waitForSelector('.confirm-dialog');
                await this.page.click('.confirm-delete-button');
                await this.page.waitForTimeout(2000);
                
                if (productName.includes('10X18CM')) {
                    this.products.product1.lastBackorderTime = Date.now();
                } else if (productName.includes('5X7,5CM')) {
                    this.products.product2.lastBackorderTime = Date.now();
                }
            }
        }
    }

    getNextBusinessDay() {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        
        while (date.getDay() === 0 || date.getDay() === 6) {
            date.setDate(date.getDate() + 1);
        }
        
        return date.toISOString().split('T')[0];
    }

    async showSuccessNotification() {
        console.log('🎉 Today has successful orders!');
    }

    getRandomInterval() {
        return Math.floor(Math.random() * 4000) + 8000;
    }

    async runAutomation() {
        if (!this.browser) await this.launchBrowser();
        if (!this.isLoggedIn) await this.login();
        
        while (true) {
            const now = new Date();
            const hour = now.getHours();
            
            if (hour < 7 || hour >= 18) {
                console.log('⏰ Outside working hours. Waiting...');
                await new Promise(resolve => setTimeout(resolve, 300000));
                continue;
            }
            
            const tasks = [];
            
            if (this.orderCount.product1 === 0 || this.orderCount.product1 < 4 || 
                (this.orderCount.product1 >= 4 && this.products.product1.continuousQuantity > 0)) {
                tasks.push(this.processProduct('product1'));
            }
            
            if (this.products.product2.dailyOrdered < this.products.product2.dailyLimit) {
                tasks.push(this.processProduct('product2'));
            }
            
            if (tasks.length === 0) {
                console.log('✅ All daily limits reached. Waiting for next day...');
                await new Promise(resolve => setTimeout(resolve, 600000));
                continue;
            }
            
            await Promise.all(tasks);
            
            await this.checkBackorders();
            
            const interval = this.getRandomInterval();
            console.log(`⏳ Waiting ${interval / 1000}s before next check...`);
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }

    async processProduct(productKey) {
        const product = this.products[productKey];
        const stockStatus = await this.checkInventory(product, productKey);
        
        if (stockStatus && (stockStatus === 'available' || stockStatus === 'limited')) {
            const quantity = this.getOrderQuantity(productKey, stockStatus);
            if (quantity > 0) {
                await this.placeOrder(product, productKey, quantity);
            }
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

async function main() {
    const automation = new MepiformAutomation();
    
    try {
        await automation.initialize();
        await automation.runAutomation();
    } catch (error) {
        console.error('❌ Automation error:', error);
        await automation.cleanup();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = MepiformAutomation;