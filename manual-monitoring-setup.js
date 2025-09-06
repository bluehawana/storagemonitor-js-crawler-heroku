const config = require('./src/config/config');
require('dotenv').config();

console.log('🛡️  Manual Monitoring Setup for Oriola4Care');
console.log('============================================\n');

console.log('Since automated login is being blocked, here\'s how to set up monitoring:\n');

// Configure products for manual monitoring
const products = [
    {
        name: 'Product 1 - Oriola4Care',
        url: 'https://oriola4care.oriola-kd.com/product-url-1', // You'll need to update these
        stockSelector: '.lagerstatus, .stock-status, .tillgänglig',
        maxPrice: 200,
        enabled: true
    },
    {
        name: 'Product 2 - Oriola4Care', 
        url: 'https://oriola4care.oriola-kd.com/product-url-2', // You'll need to update these
        stockSelector: '.lagerstatus, .stock-status, .tillgänglig',
        maxPrice: 300,
        enabled: true
    }
];

try {
    // Add products to config
    products.forEach(product => {
        config.addProduct(product);
    });
    
    // Set safe monitoring defaults
    config.updateConfig({
        orders: {
            autoOrderEnabled: false, // Disabled due to login issues
            maxOrderAmount: 500,
            quantityPerOrder: 1,
            maxDailyOrders: 5,
            confirmBeforeOrder: true,
            autoCheckout: false,
            conditions: {
                keywords: ['tillgänglig', 'i lager', 'available'], // Swedish keywords
                minStock: 1,
                maxPrice: 500
            }
        },
        monitoring: {
            activeStartHour: 8,
            activeEndHour: 18,
            timezone: 'Europe/Stockholm', // Swedish timezone
            checkInterval: 15, // Longer intervals to avoid detection
            passiveInterval: 60
        }
    });
    
    console.log('✅ Configuration completed with Swedish/Oriola4Care settings');
    console.log('✅ Products added to monitoring list');
    console.log('✅ Swedish timezone and keywords configured');
    
    console.log('\n📋 Current Configuration:');
    console.log('=========================');
    console.log(`Login URL: ${process.env.LOGIN_URL}`);
    console.log(`Username: ${process.env.USERNAME}`);
    console.log(`Products tracked: ${config.getTrackedProducts().length}`);
    console.log(`Timezone: Europe/Stockholm`);
    console.log(`Active hours: 8:00 - 18:00`);
    console.log(`Check interval: 15 minutes (to avoid detection)`);
    console.log(`Auto-ordering: DISABLED (manual login required)`);
    
    console.log('\n🔧 Manual Monitoring Options:');
    console.log('==============================');
    
    console.log('\n1. 📱 Manual Browser Monitoring:');
    console.log('   - Keep Oriola4Care logged in manually in your browser');
    console.log('   - Use browser bookmarks for quick product checks');
    console.log('   - Set browser notifications for stock changes');
    
    console.log('\n2. 🔄 Semi-Automated with Session:');
    console.log('   - Login manually to Oriola4Care');
    console.log('   - Extract session cookies');
    console.log('   - Use cookies for automated monitoring (advanced)');
    
    console.log('\n3. ⚡ Alternative Approaches:');
    console.log('   - Use different user agents and request timing');
    console.log('   - Implement CAPTCHA solving (if required)');
    console.log('   - Consider using mobile app APIs (if available)');
    
    console.log('\n📝 Next Steps to Try:');
    console.log('=====================');
    console.log('1. Update PRODUCT1_URL and PRODUCT2_URL in .env with actual product URLs');
    console.log('2. Try different user agents and browser settings');
    console.log('3. Consider using VPN or different IP addresses');
    console.log('4. Check if Oriola4Care has changed their login system');
    console.log('5. Contact Oriola4Care support about API access');
    
    console.log('\n🛡️  Security Notes:');
    console.log('==================');
    console.log('- Pharmacy websites often have strict anti-bot measures');
    console.log('- Respect rate limits and terms of service');
    console.log('- Consider manual monitoring for compliance');
    console.log('- Some features may require human verification');
    
    // Save current config
    const configSummary = config.exportConfig();
    console.log('\n💾 Configuration saved to memory');
    
} catch (error) {
    console.error('❌ Setup failed:', error.message);
}

console.log('\n🔍 To investigate the login issue further:');
console.log('==========================================');
console.log('1. Try logging in manually at: https://oriola4care.oriola-kd.com/login');
console.log('2. Check if two-factor authentication is required');
console.log('3. Verify your account is not locked or suspended');
console.log('4. Check for any recent changes to the login system');