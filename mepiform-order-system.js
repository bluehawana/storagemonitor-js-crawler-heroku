const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

class MepiformOrderSystem {
    constructor() {
        this.credentials = {
            username: process.env.MEPIFORM_USERNAME || 'tipsboden@hotmail.com',
            password: process.env.MEPIFORM_PASSWORD || null
        };
        
        this.products = {
            product1: {
                url: 'https://oriola4care.oriola-kd.com/Varumärken/MÖLNLYCKE-HEALTH-CARE/MEPIFORM-10X18CM-5ST/p/282186-888',
                name: 'MEPIFORM 10X18CM',
                orderHistory: [],
                dailyOrderCount: 0,
                lastBackorderTime: null,
                strategies: {
                    normal: [700, 350, 140, 70],
                    continuous: 70,
                    minimum: 35,
                    limited: 35
                }
            },
            product2: {
                url: 'https://oriola4care.oriola-kd.com/Varumärken/MÖLNLYCKE-HEALTH-CARE/MEPIFORM-5X7,5CM-2ST/p/820809-888',
                name: 'MEPIFORM 5X7,5CM',
                orderHistory: [],
                dailyOrderCount: 0,
                dailyLimit: 1620,
                dailyOrdered: 0,
                lastBackorderTime: null,
                strategies: {
                    normal: [900, 450, 270],
                    minimum: 45,
                    limited: 45
                }
            }
        };
        
        this.state = {
            browser: null,
            page: null,
            isLoggedIn: false,
            todaysOrders: [],
            successAlertShown: false,
            lastCheckTime: null
        };
    }

    async initialize() {
        console.log('🚀 Initializing MEPIFORM Order System...');
        await this.loadState();
        await this.resetDailyCounters();
        return true;
    }

    async loadState() {
        try {
            const configPath = path.join(__dirname, 'mepiform-config.json');
            const config = await fs.readFile(configPath, 'utf8');
            const data = JSON.parse(config);
            this.credentials.password = data.password;
            console.log('✅ Configuration loaded');
        } catch {
            console.log('📋 No saved configuration found');
        }
    }

    async saveState() {
        const configPath = path.join(__dirname, 'mepiform-config.json');
        await fs.writeFile(configPath, JSON.stringify({
            password: this.credentials.password
        }, null, 2));
    }

    async resetDailyCounters() {
        const today = new Date().toDateString();
        const statePath = path.join(__dirname, 'daily-state.json');
        
        try {
            const stateData = await fs.readFile(statePath, 'utf8');
            const state = JSON.parse(stateData);
            
            if (state.date !== today) {
                this.resetAllCounters();
                await this.saveDailyState(today);
            } else {
                this.products.product1.dailyOrderCount = state.product1OrderCount || 0;
                this.products.product2.dailyOrderCount = state.product2OrderCount || 0;
                this.products.product2.dailyOrdered = state.product2DailyOrdered || 0;
                this.state.todaysOrders = state.todaysOrders || [];
            }
        } catch {
            this.resetAllCounters();
            await this.saveDailyState(today);
        }
    }

    resetAllCounters() {
        this.products.product1.dailyOrderCount = 0;
        this.products.product2.dailyOrderCount = 0;
        this.products.product2.dailyOrdered = 0;
        this.state.todaysOrders = [];
        this.state.successAlertShown = false;
        console.log('📅 Daily counters reset for new day');
    }

    async saveDailyState(date) {
        const statePath = path.join(__dirname, 'daily-state.json');
        await fs.writeFile(statePath, JSON.stringify({
            date,
            product1OrderCount: this.products.product1.dailyOrderCount,
            product2OrderCount: this.products.product2.dailyOrderCount,
            product2DailyOrdered: this.products.product2.dailyOrdered,
            todaysOrders: this.state.todaysOrders
        }, null, 2));
    }

    async launchBrowser() {
        console.log('🌐 Launching browser...');
        const isHeroku = process.env.HEROKU_MODE === 'true' || process.env.NODE_ENV === 'production';
        
        const launchOptions = {
            headless: isHeroku ? true : (process.env.HEADLESS_MODE === 'true'),
            args: isHeroku ? [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ] : []
        };

        // On Heroku, use the system Chrome installed by Puppeteer buildpack
        if (isHeroku) {
            launchOptions.executablePath = process.env.GOOGLE_CHROME_BIN || '/usr/bin/google-chrome-stable';
        }

        this.state.browser = await puppeteer.launch(launchOptions);
        this.state.page = await this.state.browser.newPage();
        
        await this.state.page.setViewport({ width: 1280, height: 800 });
        await this.state.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        console.log('✅ Browser ready - Puppeteer version');
    }

    async login() {
        console.log('🔐 Logging in to Oriola4Care...');
        
        await this.state.page.goto('https://oriola4care.oriola-kd.com/login', { 
            waitUntil: 'networkidle' 
        });
        
        if (!this.credentials.password) {
            this.credentials.password = await this.promptForPassword();
        }

        await this.state.page.fill('#UserName', this.credentials.username);
        await this.state.page.fill('#Password', this.credentials.password);
        await this.state.page.click('#login-submit');
        
        try {
            await this.state.page.waitForNavigation({ timeout: 5000 });
            
            const url = this.state.page.url();
            if (url.includes('login')) {
                const error = await this.state.page.textContent('.validation-summary-errors').catch(() => '');
                if (error.includes('expired') || error.includes('password')) {
                    console.log('❌ Password expired or incorrect');
                    this.credentials.password = await this.promptForPassword();
                    await this.saveState();
                    return await this.login();
                }
                throw new Error('Login failed: ' + error);
            }
            
            this.state.isLoggedIn = true;
            console.log('✅ Login successful');
            await this.saveState();
            return true;
        } catch (error) {
            console.error('❌ Login error:', error.message);
            return false;
        }
    }

    async promptForPassword() {
        // In Heroku/production mode, don't prompt - use environment variable
        if (process.env.HEROKU_MODE === 'true' || process.env.NODE_ENV === 'production') {
            if (process.env.MEPIFORM_PASSWORD) {
                return process.env.MEPIFORM_PASSWORD;
            }
            throw new Error('MEPIFORM_PASSWORD environment variable is required in production mode');
        }

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question('Enter password: ', (password) => {
                rl.close();
                resolve(password);
            });
        });
    }

    async checkProductInventory(productKey) {
        const product = this.products[productKey];
        
        const now = Date.now();
        if (product.lastBackorderTime && (now - product.lastBackorderTime) < 180000) {
            const remaining = Math.ceil((180000 - (now - product.lastBackorderTime)) / 1000);
            console.log(`⏳ ${product.name}: Waiting ${remaining}s after backorder`);
            return null;
        }

        console.log(`🔍 Checking ${product.name} inventory...`);
        await this.state.page.goto(product.url, { waitUntil: 'networkidle' });
        
        const stockStatus = await this.state.page.textContent('.product-availability, .stock-status, .availability')
            .catch(() => '');
        
        console.log(`📦 ${product.name} status: "${stockStatus}"`);
        
        if (stockStatus.includes('Finns i lager, begränsat antal')) {
            return 'limited';
        } else if (stockStatus === 'Finns i lager') {
            return 'available';
        } else if (stockStatus.includes('Tillfälligt slut i lager')) {
            return 'unavailable';
        }
        
        return 'unavailable';
    }

    getOrderQuantity(productKey, stockStatus) {
        const product = this.products[productKey];
        
        if (stockStatus === 'limited') {
            console.log(`📦 Limited stock - ordering ${product.strategies.limited} units`);
            return product.strategies.limited;
        }
        
        if (productKey === 'product1') {
            const orderCount = product.dailyOrderCount;
            if (orderCount < product.strategies.normal.length) {
                const quantity = product.strategies.normal[orderCount];
                console.log(`📊 Order #${orderCount + 1} - ${quantity} units`);
                return quantity;
            }
            console.log(`📊 Continuous order - ${product.strategies.continuous} units`);
            return product.strategies.continuous;
        } else {
            if (product.dailyOrdered >= product.dailyLimit) {
                console.log(`🚫 Daily limit reached (${product.dailyLimit})`);
                return 0;
            }
            
            const orderCount = product.dailyOrderCount;
            if (orderCount < product.strategies.normal.length) {
                const quantity = product.strategies.normal[orderCount];
                const remaining = product.dailyLimit - product.dailyOrdered;
                const actualQuantity = Math.min(quantity, remaining);
                console.log(`📊 Order #${orderCount + 1} - ${actualQuantity} units (${remaining} remaining today)`);
                return actualQuantity;
            }
            
            return 0;
        }
    }

    async placeOrder(productKey, quantity) {
        const product = this.products[productKey];
        console.log(`\n🛒 Starting order: ${product.name} x ${quantity}`);
        
        try {
            await this.state.page.fill('input[name="quantity"], #quantity', quantity.toString());
            await this.state.page.click('button.add-to-cart, button[value="KÖP"], .add-to-cart-button');
            
            await this.state.page.waitForTimeout(2000);
            
            await this.state.page.click('a[href*="cart"], .cart-link, button:has-text("GÅ TILL VARUKORG")');
            await this.state.page.waitForNavigation();
            
            await this.state.page.click('button:has-text("TILL ORDERLÄGGNING"), .checkout-button');
            await this.state.page.waitForNavigation();
            
            const deliveryDate = this.getNextBusinessDay();
            await this.state.page.fill('input[name="deliveryDate"], #deliveryDate', deliveryDate);
            
            const orderRef = this.generateOrderReference();
            await this.state.page.fill('input[name="reference"], #reference', orderRef);
            
            await this.state.page.check('input[name="acceptTerms"], #acceptTerms');
            await this.state.page.click('button[type="submit"]:has-text("SKICKA ORDER"), .submit-order');
            
            await this.state.page.waitForSelector('text=TACK FÖR DIN ORDER', { timeout: 10000 });
            
            console.log(`✅ Order successful! Reference: ${orderRef}`);
            
            product.dailyOrderCount++;
            product.orderHistory.push({
                quantity,
                reference: orderRef,
                time: new Date().toISOString()
            });
            
            if (productKey === 'product2') {
                product.dailyOrdered += quantity;
            }
            
            this.state.todaysOrders.push({
                product: product.name,
                quantity,
                reference: orderRef,
                time: new Date().toLocaleTimeString()
            });
            
            await this.saveDailyState(new Date().toDateString());
            
            if (!this.state.successAlertShown) {
                await this.showSuccessAlert();
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Order failed: ${error.message}`);
            
            const errorText = await this.state.page.textContent('.error, .alert').catch(() => '');
            if (errorText.includes('credit') || errorText.includes('limit')) {
                return await this.retryWithReducedQuantity(productKey, quantity);
            }
            
            return false;
        }
    }

    async retryWithReducedQuantity(productKey, currentQuantity) {
        const product = this.products[productKey];
        const divisor = productKey === 'product1' ? 7 : 9;
        
        let newQuantity = currentQuantity;
        while (newQuantity > product.strategies.minimum) {
            newQuantity = Math.floor(newQuantity / 2);
            if (newQuantity % divisor !== 0) {
                newQuantity = Math.floor(newQuantity / divisor) * divisor;
            }
            
            if (newQuantity < product.strategies.minimum) {
                newQuantity = product.strategies.minimum;
            }
            
            console.log(`🔄 Retrying with ${newQuantity} units...`);
            
            await this.state.page.fill('.cart-quantity input', newQuantity.toString());
            await this.state.page.click('button.update-cart');
            await this.state.page.waitForTimeout(2000);
            
            try {
                await this.state.page.click('button[type="submit"]:has-text("SKICKA ORDER")');
                await this.state.page.waitForSelector('text=TACK FÖR DIN ORDER', { timeout: 10000 });
                
                product.dailyOrderCount++;
                if (productKey === 'product2') {
                    product.dailyOrdered += newQuantity;
                }
                
                console.log(`✅ Order successful with reduced quantity: ${newQuantity}`);
                return true;
            } catch {
                if (newQuantity === product.strategies.minimum) {
                    console.log(`❌ Cannot order minimum quantity. Stopping ${product.name} for today.`);
                    return false;
                }
            }
        }
        
        return false;
    }

    async checkAndDeleteBackorders() {
        console.log('\n📋 Checking backorders...');
        await this.state.page.goto('https://oriola4care.oriola-kd.com/my-account/backorders', {
            waitUntil: 'networkidle'
        });
        
        const backorders = await this.state.page.$$('.backorder-item, tr[data-product]');
        
        for (const backorder of backorders) {
            const productName = await backorder.textContent('.product-name, td.name').catch(() => '');
            const orderedQty = await backorder.textContent('.ordered-qty, td:nth-child(3)').catch(() => '');
            const backorderQty = await backorder.textContent('.backorder-qty, td:nth-child(4)').catch(() => '');
            
            if (orderedQty === backorderQty && orderedQty !== '') {
                console.log(`🗑️  Deleting backorder: ${productName}`);
                
                await backorder.click('.delete-button, button.delete');
                await this.state.page.waitForSelector('.confirm-delete, .modal-confirm');
                await this.state.page.click('button:has-text("TA BORT"), button.confirm-delete');
                await this.state.page.waitForTimeout(2000);
                
                if (productName.includes('10X18CM')) {
                    this.products.product1.lastBackorderTime = Date.now();
                } else if (productName.includes('5X7,5CM')) {
                    this.products.product2.lastBackorderTime = Date.now();
                }
            }
        }
    }

    generateOrderReference() {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const orderNum = this.state.todaysOrders.length + 1;
        return `${dateStr}-${String(orderNum).padStart(2, '0')}`;
    }

    getNextBusinessDay() {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        
        while (date.getDay() === 0 || date.getDay() === 6) {
            date.setDate(date.getDate() + 1);
        }
        
        return date.toISOString().slice(0, 10);
    }

    async showSuccessAlert() {
        this.state.successAlertShown = true;
        console.log('\n🎉 ========================================');
        console.log('🎉 TODAY HAS SUCCESSFUL ORDERS!');
        console.log('🎉 ========================================\n');
    }

    getRandomInterval() {
        return Math.floor(Math.random() * 4000) + 8000;
    }

    async runAutomation() {
        console.log('🤖 Starting MEPIFORM automation cycle...\n');
        
        while (true) {
            const now = new Date();
            const hour = now.getHours();
            const day = now.getDay();
            
            if (day === 0 || day === 6 || hour < 7 || hour >= 18) {
                console.log('😴 Outside working hours. Waiting...');
                await new Promise(resolve => setTimeout(resolve, 300000));
                continue;
            }
            
            const tasks = [];
            
            const product1Status = await this.checkProductInventory('product1');
            if (product1Status === 'available' || product1Status === 'limited') {
                const quantity = this.getOrderQuantity('product1', product1Status);
                if (quantity > 0) {
                    await this.placeOrder('product1', quantity);
                }
            }
            
            const product2Status = await this.checkProductInventory('product2');
            if (product2Status === 'available' || product2Status === 'limited') {
                const quantity = this.getOrderQuantity('product2', product2Status);
                if (quantity > 0) {
                    await this.placeOrder('product2', quantity);
                }
            }
            
            await this.checkAndDeleteBackorders();
            
            const interval = this.getRandomInterval();
            console.log(`\n⏳ Next check in ${Math.round(interval / 1000)}s...`);
            console.log('─'.repeat(50));
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }

    async start() {
        try {
            await this.initialize();
            await this.launchBrowser();
            await this.login();
            await this.runAutomation();
        } catch (error) {
            console.error('❌ Fatal error:', error);
            await this.cleanup();
            process.exit(1);
        }
    }

    async cleanup() {
        if (this.state.browser) {
            await this.state.browser.close();
        }
    }
}

const orderSystem = new MepiformOrderSystem();

process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await orderSystem.cleanup();
    process.exit(0);
});

if (require.main === module) {
    orderSystem.start();
}

module.exports = MepiformOrderSystem;