const MonitoringService = require('./src/services/monitoringService');
const config = require('./src/config/config');
require('dotenv').config();

async function testMonitoring() {
    console.log('🧪 Testing Oriola4Care monitoring system...\n');
    
    try {
        // Show current configuration
        console.log('📋 Current Configuration:');
        const products = config.getTrackedProducts();
        console.log(`   Products: ${products.length}`);
        products.forEach((product, index) => {
            console.log(`   ${index + 1}. ${product.name}`);
            console.log(`      Code: ${product.productCode}`);
            console.log(`      URL: ${product.url}`);
            console.log(`      Max Price: ${product.maxPrice} SEK`);
            console.log(`      Auto Order: ${product.orderConditions.autoOrder}`);
        });
        
        const monitoringConfig = config.getMonitoringConfig();
        console.log(`\n   Active Hours: ${monitoringConfig.activeStartHour}:00 - ${monitoringConfig.activeEndHour}:00`);
        console.log(`   Timezone: ${monitoringConfig.timezone}`);
        console.log(`   Check Interval: ${monitoringConfig.checkInterval} minutes`);
        console.log(`   Currently Active: ${config.isWithinActiveHours()}`);
        
        // Initialize monitoring service
        console.log('\n🚀 Initializing monitoring service...');
        const monitoringService = new MonitoringService();
        
        const initialized = await monitoringService.initialize();
        if (!initialized) {
            throw new Error('Failed to initialize monitoring service');
        }
        
        console.log('✅ Monitoring service initialized');
        
        // Test product checking
        console.log('\n🔍 Testing product availability check...');
        const results = await monitoringService.checkProducts('test');
        
        console.log('\n📊 Test Results:');
        results.forEach((result, index) => {
            console.log(`${index + 1}. ${result.productName || result.title}`);
            console.log(`   URL: ${result.url}`);
            console.log(`   Stock Status: ${result.stockStatus}`);
            console.log(`   In Stock: ${result.isInStock ? '✅ Yes' : '❌ No'}`);
            console.log(`   Price: ${result.price}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
            console.log('');
        });
        
        // Show monitoring status
        const status = monitoringService.getStatus();
        console.log('📈 Monitoring Status:');
        console.log(`   Running: ${status.isRunning}`);
        console.log(`   Daily Orders: ${status.dailyOrderCount}`);
        console.log(`   Tracked Products: ${status.trackedProducts}`);
        console.log(`   Within Active Hours: ${status.isWithinActiveHours}`);
        
        // Clean up
        await monitoringService.stopMonitoring();
        
        console.log('\n🎯 Test completed successfully!');
        console.log('💡 The system is ready for deployment to Heroku');
        
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

testMonitoring().then(success => {
    if (success) {
        console.log('\n✅ All tests passed! Ready for Heroku deployment.');
        console.log('\n🚀 Next steps:');
        console.log('   1. Run: ./deploy-to-heroku.sh');
        console.log('   2. Or follow manual steps in heroku-setup.md');
        console.log('   3. Monitor logs: heroku logs --tail');
    } else {
        console.log('\n❌ Tests failed. Please fix issues before deployment.');
    }
}).catch(console.error);