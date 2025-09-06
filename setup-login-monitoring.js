const ProductScraper = require('./src/scrapers/productScraper');
const config = require('./src/config/config');
require('dotenv').config();

async function setupLoginAndMonitoring() {
    console.log('🚀 Setting up login and monitoring for two products\n');
    
    // Configure login credentials (ensure these are in your .env file)
    const scraperConfig = {
        loginUrl: process.env.LOGIN_URL,
        username: process.env.USERNAME,
        password: process.env.PASSWORD,
        usernameSelector: '#j_username, input[name="username"], input[type="email"]',
        passwordSelector: '#j_password, input[name="password"], input[type="password"]',
        loginButtonSelector: 'button[type="submit"], .login-button, input[type="submit"]',
        loginSuccessSelector: '.main-content, .dashboard, nav, .user-info'
    };
    
    // Add two products to monitor
    const product1 = {
        name: 'Health Product 1',
        url: process.env.PRODUCT1_URL || 'https://example.com/product1',
        stockSelector: '.stock-status, .availability, .in-stock',
        maxPrice: 100,
        enabled: true
    };
    
    const product2 = {
        name: 'Health Product 2', 
        url: process.env.PRODUCT2_URL || 'https://example.com/product2',
        stockSelector: '.stock-status, .availability, .in-stock',
        maxPrice: 150,
        enabled: true
    };
    
    try {
        // Add products to config
        config.addProduct(product1);
        config.addProduct(product2);
        
        console.log('✅ Products added to configuration:');
        console.log(`   - ${product1.name}`);
        console.log(`   - ${product2.name}\n`);
        
        // Test login
        console.log('🔐 Testing login...');
        const scraper = new ProductScraper(scraperConfig);
        
        const initialized = await scraper.initialize();
        if (!initialized) {
            throw new Error('Failed to initialize scraper');
        }
        
        const loginSuccess = await scraper.login();
        if (loginSuccess) {
            console.log('✅ Login successful!\n');
            
            // Configure order settings
            console.log('⚙️  Configuring order settings...');
            config.updateConfig({
                orders: {
                    autoOrderEnabled: false, // Set to true to enable auto-ordering
                    maxOrderAmount: 500,
                    quantityPerOrder: 1,
                    maxDailyOrders: 5,
                    confirmBeforeOrder: true,
                    autoCheckout: false,
                    conditions: {
                        keywords: ['available', 'in stock'],
                        minStock: 1,
                        maxPrice: 200
                    }
                },
                monitoring: {
                    activeStartHour: 8,
                    activeEndHour: 18,
                    timezone: 'America/New_York',
                    checkInterval: 5, // Check every 5 minutes
                    passiveInterval: 30 // Check every 30 minutes outside active hours
                }
            });
            
            console.log('✅ Order settings configured:');
            console.log('   - Auto-order: DISABLED (safety first)');
            console.log('   - Max order amount: $500');
            console.log('   - Check interval: 5 minutes (active hours 8AM-6PM)');
            console.log('   - Confirmation required before orders\n');
            
            // Test product monitoring
            console.log('🔍 Testing product monitoring...');
            const products = config.getTrackedProducts();
            
            if (products.length > 0) {
                // Test first product
                const result = await scraper.checkProductAvailability(
                    products[0].url, 
                    products[0].stockSelector
                );
                
                console.log('📊 Product check result:');
                console.log(`   Product: ${result.title}`);
                console.log(`   Status: ${result.isInStock ? '✅ IN STOCK' : '❌ OUT OF STOCK'}`);
                console.log(`   Price: ${result.price}\n`);
            }
            
        } else {
            console.log('❌ Login failed. Please check your credentials in .env file\n');
        }
        
        await scraper.close();
        
        // Display configuration summary
        console.log('📋 Setup Summary:');
        console.log('==================');
        console.log(`Login URL: ${scraperConfig.loginUrl}`);
        console.log(`Username: ${scraperConfig.username}`);
        console.log(`Products tracked: ${config.getTrackedProducts().length}`);
        console.log(`Auto-order enabled: ${config.getOrderConfig().autoOrderEnabled ? 'YES' : 'NO'}`);
        console.log(`Active monitoring: ${config.getMonitoringConfig().activeStartHour}:00 - ${config.getMonitoringConfig().activeEndHour}:00`);
        
        console.log('\n✅ Setup completed successfully!');
        console.log('\n🔧 To start monitoring, run: npm start');
        console.log('🔧 To enable auto-ordering, update the config and set autoOrderEnabled: true');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    }
}

// Run setup
setupLoginAndMonitoring();