const config = require('./src/config/config');
require('dotenv').config();

async function setupProducts() {
    console.log('🏥 Setting up Oriola4Care product monitoring...\n');
    
    // Example products - you'll need to replace these with actual product URLs
    const products = [
        {
            name: 'Health Product 1',
            url: 'https://oriola4care.oriola-kd.com/product1', // Replace with actual URL
            stockSelector: '.stock-status, .availability, .in-stock',
            maxPrice: 100,
            enabled: true,
            orderConditions: {
                autoOrder: true,
                quantity: 1,
                maxDailyOrders: 2,
                keywords: ['in stock', 'available', 'tillgänglig'], // Swedish for available
                minStock: 1
            }
        },
        {
            name: 'Health Product 2', 
            url: 'https://oriola4care.oriola-kd.com/product2', // Replace with actual URL
            stockSelector: '.stock-status, .availability, .in-stock',
            maxPrice: 150,
            enabled: true,
            orderConditions: {
                autoOrder: true,
                quantity: 1,
                maxDailyOrders: 1,
                keywords: ['in stock', 'available', 'tillgänglig'],
                minStock: 1
            }
        }
    ];
    
    console.log('📦 Adding products to monitoring system...');
    
    for (const product of products) {
        try {
            const addedProduct = config.addProduct(product);
            console.log(`✅ Added: ${addedProduct.name}`);
            console.log(`   URL: ${addedProduct.url}`);
            console.log(`   Max Price: $${addedProduct.maxPrice}`);
            console.log(`   Auto Order: ${addedProduct.orderConditions.autoOrder ? 'Yes' : 'No'}`);
            console.log('');
        } catch (error) {
            console.error(`❌ Failed to add ${product.name}:`, error.message);
        }
    }
    
    // Update monitoring configuration
    config.updateConfig({
        monitoring: {
            activeStartHour: 7,  // 7 AM
            activeEndHour: 19,   // 7 PM
            timezone: 'Europe/Stockholm', // Swedish timezone
            checkInterval: 5,    // Check every 5 minutes during active hours
            passiveInterval: 60, // Check every hour during inactive hours
            workdaysOnly: true   // Only run on weekdays
        },
        orders: {
            autoOrderEnabled: true,
            maxOrderAmount: 500,
            quantityPerOrder: 1,
            maxDailyOrders: 5,
            confirmBeforeOrder: false, // Set to true if you want manual confirmation
            autoCheckout: false,       // Set to true for full automation
            conditions: {
                keywords: ['in stock', 'available', 'tillgänglig'],
                minStock: 1,
                maxPrice: 200
            }
        }
    });
    
    console.log('⚙️  Configuration updated:');
    console.log(`   Active hours: 7 AM - 7 PM (Swedish time)`);
    console.log(`   Check interval: Every 5 minutes`);
    console.log(`   Auto ordering: ${config.getOrderConfig().autoOrderEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`   Max daily orders: ${config.getOrderConfig().maxDailyOrders}`);
    
    // Validate configuration
    const validation = config.validateConfiguration();
    if (validation.valid) {
        console.log('\n✅ Configuration is valid and ready!');
    } else {
        console.log('\n❌ Configuration issues:');
        validation.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    // Export configuration for review
    const exportedConfig = config.exportConfig();
    const fs = require('fs');
    fs.writeFileSync('monitoring-config.json', JSON.stringify(exportedConfig, null, 2));
    console.log('\n💾 Configuration saved to monitoring-config.json');
    
    return config.getTrackedProducts();
}

setupProducts().then(products => {
    console.log(`\n🎯 Setup complete! Monitoring ${products.length} products.`);
    console.log('\n💡 Next steps:');
    console.log('   1. Update product URLs in the configuration');
    console.log('   2. Test product monitoring');
    console.log('   3. Deploy to Heroku');
}).catch(console.error);