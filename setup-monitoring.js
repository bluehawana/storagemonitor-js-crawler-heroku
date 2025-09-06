const fs = require('fs');
require('dotenv').config();

console.log('🔧 Setting up product monitoring system...\n');

// Product monitoring configuration
const monitoringConfig = {
    website: {
        name: "Oriola4Care",
        baseUrl: "https://oriola4care.oriola-kd.com",
        loginUrl: "https://oriola4care.oriola-kd.com/login",
        credentials: {
            username: process.env.USERNAME,
            password: process.env.PASSWORD
        },
        selectors: {
            username: "#j_username",
            password: "#j_password", 
            loginButton: "button[type=\"submit\"]",
            loginSuccess: ".main-content, .user-info, nav, .dashboard, .account-info"
        }
    },
    products: [
        {
            id: "product_1",
            name: "Product 1 (Please specify)",
            url: "https://oriola4care.oriola-kd.com/product/[PRODUCT_ID_1]",
            stockSelector: ".stock-status, .availability, .in-stock, .lagerstatus",
            priceSelector: ".price, .product-price",
            titleSelector: "h1, .product-title",
            monitorStock: true,
            monitorPrice: false,
            autoOrder: {
                enabled: true,
                quantity: 1,
                maxPrice: 500,
                stockThreshold: "in-stock"
            }
        },
        {
            id: "product_2", 
            name: "Product 2 (Please specify)",
            url: "https://oriola4care.oriola-kd.com/product/[PRODUCT_ID_2]",
            stockSelector: ".stock-status, .availability, .in-stock, .lagerstatus",
            priceSelector: ".price, .product-price",
            titleSelector: "h1, .product-title",
            monitorStock: true,
            monitorPrice: false,
            autoOrder: {
                enabled: true,
                quantity: 1,
                maxPrice: 500,
                stockThreshold: "in-stock"
            }
        }
    ],
    monitoring: {
        enabled: true,
        interval: 30, // minutes
        activeHours: {
            start: process.env.ACTIVE_START_HOUR || 7,
            end: process.env.ACTIVE_END_HOUR || 19
        },
        timezone: process.env.TIMEZONE || "Europe/Stockholm",
        notifications: {
            email: {
                enabled: false, // Set to true when email is configured
                recipients: [process.env.NOTIFICATION_EMAIL]
            },
            console: true
        }
    },
    ordering: {
        enabled: process.env.AUTO_ORDER_ENABLED === "true",
        maxOrderAmount: parseFloat(process.env.MAX_ORDER_AMOUNT) || 500,
        defaultQuantity: parseInt(process.env.QUANTITY_PER_ORDER) || 1,
        confirmationRequired: true, // Require manual confirmation before ordering
        testMode: true // Start in test mode
    }
};

// Save configuration
const configPath = './monitoring-config.json';
fs.writeFileSync(configPath, JSON.stringify(monitoringConfig, null, 2));

console.log('✅ Monitoring configuration created!');
console.log(`📄 Configuration saved to: ${configPath}\n`);

console.log('📋 Configuration Summary:');
console.log(`🌐 Website: ${monitoringConfig.website.name}`);
console.log(`👤 Username: ${monitoringConfig.website.credentials.username}`);
console.log(`📦 Products to monitor: ${monitoringConfig.products.length}`);
console.log(`⏱️  Check interval: ${monitoringConfig.monitoring.interval} minutes`);
console.log(`🕐 Active hours: ${monitoringConfig.monitoring.activeHours.start}:00 - ${monitoringConfig.monitoring.activeHours.end}:00`);
console.log(`🛒 Auto-ordering: ${monitoringConfig.ordering.enabled ? 'Enabled' : 'Disabled'} (Test Mode: ${monitoringConfig.ordering.testMode})`);

console.log('\n🔧 Next Steps:');
console.log('1. Update the product URLs in monitoring-config.json with actual product pages');
console.log('2. Test the monitoring system with: node test-monitoring.js');
console.log('3. Start the monitoring service with: npm start');

console.log('\n💡 Product Configuration Template:');
console.log('Replace [PRODUCT_ID_1] and [PRODUCT_ID_2] with actual product URLs from Oriola4Care');
console.log('Example: https://oriola4care.oriola-kd.com/product/12345');

// Create a test monitoring script
const testScript = `const ProductScraper = require('./src/scrapers/productScraper');
const config = require('./src/config/config');
const monitoringConfig = require('./monitoring-config.json');

async function testMonitoring() {
    console.log('🧪 Testing product monitoring system...\\n');
    
    try {
        const websiteConfig = config.getWebsiteConfig();
        const scraper = new ProductScraper(websiteConfig);
        
        console.log('🚀 Initializing browser...');
        const initialized = await scraper.initialize();
        
        if (!initialized) {
            console.error('❌ Failed to initialize browser');
            return;
        }
        
        console.log('🔐 Testing login...');
        const loginSuccess = await scraper.login();
        
        if (!loginSuccess) {
            console.error('❌ Login failed');
            await scraper.close();
            return;
        }
        
        console.log('✅ Login successful!\\n');
        
        console.log('📦 Testing product monitoring...');
        
        for (const product of monitoringConfig.products) {
            if (product.url.includes('[PRODUCT_ID')) {
                console.log(\`⚠️  Skipping \${product.name} - URL not configured\`);
                continue;
            }
            
            console.log(\`\\n🔍 Checking: \${product.name}\`);
            console.log(\`📍 URL: \${product.url}\`);
            
            try {
                const result = await scraper.checkProductAvailability(
                    product.url, 
                    product.stockSelector
                );
                
                console.log(\`📊 Result:\`);
                console.log(\`   Title: \${result.title}\`);
                console.log(\`   Price: \${result.price}\`);
                console.log(\`   Stock: \${result.stockStatus}\`);
                console.log(\`   Available: \${result.isInStock ? '✅ YES' : '❌ NO'}\`);
                
                if (result.isInStock && product.autoOrder.enabled) {
                    console.log(\`🛒 Auto-order would be triggered (TEST MODE)\`);
                }
                
            } catch (error) {
                console.error(\`❌ Error checking \${product.name}:\`, error.message);
            }
        }
        
        await scraper.close();
        console.log('\\n✅ Monitoring test completed');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testMonitoring();`;

fs.writeFileSync('./test-monitoring.js', testScript);
console.log('📝 Created test-monitoring.js for testing the setup');

console.log('\n🎯 Ready to configure your specific products!');
console.log('Please provide the URLs of the two products you want to monitor.');