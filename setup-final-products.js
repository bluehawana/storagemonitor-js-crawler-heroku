const config = require('./src/config/config');
require('dotenv').config();

async function setupFinalProducts() {
    console.log('🏥 Setting up final product monitoring for Oriola4Care...\n');
    
    // Clear existing products
    const existingProducts = config.getTrackedProducts();
    for (const product of existingProducts) {
        try {
            config.removeProduct(product.id);
        } catch (error) {
            // Product might not exist
        }
    }
    
    // Set up the two products with their search URLs
    // When they come back in stock, they'll appear as proper product pages
    const products = [
        {
            name: 'MEPIFORM 10X18CM 5ST (7323190179114)',
            url: 'https://oriola4care.oriola-kd.com/search?q=7323190179114',
            productCode: '7323190179114',
            expectedPrice: '250,00 SEK',
            stockSelector: '.stock-status, .availability, .in-stock, .lagerstatus, .tillgänglig',
            maxPrice: 300, // Allow some price flexibility
            enabled: true,
            orderConditions: {
                autoOrder: true,
                quantity: 1,
                maxDailyOrders: 2,
                keywords: ['in stock', 'available', 'tillgänglig', 'i lager', 'finns'],
                minStock: 1
            }
        },
        {
            name: 'MEPIFORM 5X7,5CM 2ST (7332551949327)',
            url: 'https://oriola4care.oriola-kd.com/search?q=7332551949327',
            productCode: '7332551949327',
            expectedPrice: '42,00 SEK',
            stockSelector: '.stock-status, .availability, .in-stock, .lagerstatus, .tillgänglig',
            maxPrice: 60, // Allow some price flexibility
            enabled: true,
            orderConditions: {
                autoOrder: true,
                quantity: 1,
                maxDailyOrders: 2,
                keywords: ['in stock', 'available', 'tillgänglig', 'i lager', 'finns'],
                minStock: 1
            }
        }
    ];
    
    console.log('📦 Adding products to monitoring system...');
    
    for (const product of products) {
        try {
            const addedProduct = config.addProduct(product);
            console.log(`✅ Added: ${addedProduct.name}`);
            console.log(`   Product Code: ${product.productCode}`);
            console.log(`   Expected Price: ${product.expectedPrice}`);
            console.log(`   Max Price: ${addedProduct.maxPrice} SEK`);
            console.log(`   Auto Order: ${addedProduct.orderConditions.autoOrder ? 'Yes' : 'No'}`);
            console.log('');
        } catch (error) {
            console.error(`❌ Failed to add ${product.name}:`, error.message);
        }
    }
    
    // Update monitoring configuration for Swedish working hours
    config.updateConfig({
        monitoring: {
            activeStartHour: 7,  // 7 AM Swedish time
            activeEndHour: 19,   // 7 PM Swedish time
            timezone: 'Europe/Stockholm',
            checkInterval: 5,    // Check every 5 minutes during active hours
            passiveInterval: 60, // Check every hour during inactive hours
            workdaysOnly: true   // Only run Monday-Friday
        },
        orders: {
            autoOrderEnabled: true,
            maxOrderAmount: 500,
            quantityPerOrder: 1,
            maxDailyOrders: 5,
            confirmBeforeOrder: false, // Fully automated
            autoCheckout: false,       // Stop at cart for safety
            conditions: {
                keywords: ['in stock', 'available', 'tillgänglig', 'i lager', 'finns'],
                minStock: 1,
                maxPrice: 400
            }
        }
    });
    
    console.log('⚙️  Configuration updated:');
    console.log(`   Active hours: 7 AM - 7 PM (Swedish time)`);
    console.log(`   Check interval: Every 5 minutes during business hours`);
    console.log(`   Auto ordering: ${config.getOrderConfig().autoOrderEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`   Max daily orders: ${config.getOrderConfig().maxDailyOrders}`);
    console.log(`   Working days only: Monday-Friday`);
    
    // Validate configuration
    const validation = config.validateConfiguration();
    if (validation.valid) {
        console.log('\n✅ Configuration is valid and ready!');
    } else {
        console.log('\n❌ Configuration issues:');
        validation.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    // Export configuration for Heroku
    const exportedConfig = config.exportConfig();
    const fs = require('fs');
    fs.writeFileSync('heroku-config.json', JSON.stringify(exportedConfig, null, 2));
    console.log('\n💾 Configuration saved to heroku-config.json');
    
    return config.getTrackedProducts();
}

setupFinalProducts().then(products => {
    console.log(`\n🎯 Setup complete! Monitoring ${products.length} products.`);
    console.log('\n💡 How it works:');
    console.log('   1. System monitors search pages every 5 minutes (7 AM - 7 PM, weekdays)');
    console.log('   2. When products come back in stock, they appear as proper product pages');
    console.log('   3. System automatically detects stock availability');
    console.log('   4. Orders are placed automatically when conditions are met');
    console.log('\n🚀 Ready for Heroku deployment!');
}).catch(console.error);