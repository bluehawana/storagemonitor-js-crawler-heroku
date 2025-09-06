const config = require('./src/config/config');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

async function configureOrderSettings() {
    console.log('⚙️  Order Settings Configuration\n');
    console.log('This will help you configure automatic ordering rules for your products.\n');
    
    try {
        // Auto-order enabled
        const autoOrderEnabled = await askQuestion('Enable automatic ordering? (y/n): ');
        const enableAutoOrder = autoOrderEnabled.toLowerCase() === 'y';
        
        // Max order amount
        const maxAmountInput = await askQuestion('Maximum order amount per order ($): ');
        const maxOrderAmount = parseFloat(maxAmountInput) || 500;
        
        // Quantity per order
        const quantityInput = await askQuestion('Quantity to order per product: ');
        const quantityPerOrder = parseInt(quantityInput) || 1;
        
        // Max daily orders
        const dailyOrdersInput = await askQuestion('Maximum orders per day: ');
        const maxDailyOrders = parseInt(dailyOrdersInput) || 5;
        
        // Confirmation required
        const confirmationInput = await askQuestion('Require confirmation before placing orders? (y/n): ');
        const confirmBeforeOrder = confirmationInput.toLowerCase() !== 'n';
        
        // Max price per product
        const maxPriceInput = await askQuestion('Maximum price per product ($): ');
        const maxPrice = parseFloat(maxPriceInput) || 200;
        
        // Stock keywords
        console.log('\\nEnter keywords that indicate a product is in stock (comma-separated):');
        const keywordsInput = await askQuestion('Keywords (e.g., "available,in stock,ready"): ');
        const keywords = keywordsInput.split(',').map(k => k.trim()).filter(k => k);
        
        // Monitoring schedule
        const startHourInput = await askQuestion('Active monitoring start hour (0-23): ');
        const activeStartHour = parseInt(startHourInput) || 8;
        
        const endHourInput = await askQuestion('Active monitoring end hour (0-23): ');
        const activeEndHour = parseInt(endHourInput) || 18;
        
        const intervalInput = await askQuestion('Check interval during active hours (minutes): ');
        const checkInterval = parseInt(intervalInput) || 5;
        
        // Update configuration
        const newConfig = {
            orders: {
                autoOrderEnabled: enableAutoOrder,
                maxOrderAmount: maxOrderAmount,
                quantityPerOrder: quantityPerOrder,
                maxDailyOrders: maxDailyOrders,
                confirmBeforeOrder: confirmBeforeOrder,
                autoCheckout: false, // Always require manual checkout for safety
                conditions: {
                    keywords: keywords.length > 0 ? keywords : ['available', 'in stock'],
                    minStock: 1,
                    maxPrice: maxPrice
                }
            },
            monitoring: {
                activeStartHour: activeStartHour,
                activeEndHour: activeEndHour,
                timezone: 'America/New_York',
                checkInterval: checkInterval,
                passiveInterval: 30
            }
        };
        
        config.updateConfig(newConfig);
        
        console.log('\\n✅ Order settings configured successfully!\\n');
        console.log('Configuration Summary:');
        console.log('======================');
        console.log(`Auto-ordering: ${enableAutoOrder ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log(`Max order amount: $${maxOrderAmount}`);
        console.log(`Quantity per order: ${quantityPerOrder}`);
        console.log(`Max daily orders: ${maxDailyOrders}`);
        console.log(`Confirmation required: ${confirmBeforeOrder ? 'YES' : 'NO'}`);
        console.log(`Max price per product: $${maxPrice}`);
        console.log(`Stock keywords: ${keywords.join(', ')}`);
        console.log(`Active hours: ${activeStartHour}:00 - ${activeEndHour}:00`);
        console.log(`Check interval: ${checkInterval} minutes`);
        
        if (enableAutoOrder) {
            console.log('\\n⚠️  IMPORTANT SAFETY NOTES:');
            console.log('- Auto-checkout is DISABLED for safety');
            console.log('- Orders will be added to cart but require manual checkout');
            console.log('- Monitor logs carefully for any issues');
            console.log('- Consider testing with a small max order amount first');
        }
        
        console.log('\\n🚀 To start monitoring with these settings, run:');
        console.log('   node monitor-products.js');
        
        // Validate configuration
        const validation = config.validateConfiguration();
        if (!validation.valid) {
            console.log('\\n⚠️  Configuration warnings:');
            validation.errors.forEach(error => {
                console.log(`   - ${error}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Configuration failed:', error.message);
    } finally {
        rl.close();
    }
}

// Safety configuration for first-time users
async function setSafeDefaults() {
    console.log('🛡️  Setting safe default configuration...');
    
    config.updateConfig({
        orders: {
            autoOrderEnabled: false, // Disabled by default for safety
            maxOrderAmount: 100,     // Conservative amount
            quantityPerOrder: 1,
            maxDailyOrders: 3,       // Limited daily orders
            confirmBeforeOrder: true, // Always confirm
            autoCheckout: false,     // Never auto-checkout
            conditions: {
                keywords: ['available', 'in stock', 'ready'],
                minStock: 1,
                maxPrice: 50         // Conservative price limit
            }
        },
        monitoring: {
            activeStartHour: 9,
            activeEndHour: 17,
            timezone: 'America/New_York',
            checkInterval: 10,       // Check every 10 minutes
            passiveInterval: 60      // Less frequent outside hours
        }
    });
    
    console.log('✅ Safe defaults applied');
    console.log('   - Auto-ordering: DISABLED');
    console.log('   - Max order: $100');
    console.log('   - Max price per product: $50');
    console.log('   - Check interval: 10 minutes');
    console.log('\\n🔧 Run with --configure to customize these settings');
}

// Check command line arguments
if (process.argv.includes('--configure')) {
    configureOrderSettings();
} else if (process.argv.includes('--safe-defaults')) {
    setSafeDefaults();
} else {
    console.log('Order Configuration Tool\\n');
    console.log('Usage:');
    console.log('  node configure-orders.js --configure     Interactive configuration');
    console.log('  node configure-orders.js --safe-defaults Set safe default values');
    console.log('\\nCurrent settings:');
    
    const currentOrders = config.getOrderConfig();
    const currentMonitoring = config.getMonitoringConfig();
    
    console.log(`  Auto-ordering: ${currentOrders.autoOrderEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`  Max order amount: $${currentOrders.maxOrderAmount}`);
    console.log(`  Active hours: ${currentMonitoring.activeStartHour}:00 - ${currentMonitoring.activeEndHour}:00`);
    console.log(`  Products tracked: ${config.getTrackedProducts().length}`);
}