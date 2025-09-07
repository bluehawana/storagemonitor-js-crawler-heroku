const MepiformMonitor = require('./mepiform-monitor');
require('dotenv').config();

async function testMepiformMonitoring() {
    console.log('🧪 Testing MEPIFORM Monitoring System');
    console.log('=====================================\n');
    
    console.log('📋 Configuration Check:');
    console.log(`   Login URL: ${process.env.LOGIN_URL}`);
    console.log(`   Username: ${process.env.USERNAME}`);
    console.log(`   MEPIFORM URL: ${process.env.MEPIFORM_URL}`);
    console.log(`   Order Quantities: ${process.env.QUANTITY_PER_ORDER} or ${process.env.ALTERNATE_QUANTITY}`);
    console.log(`   Max Order Amount: $${process.env.MAX_ORDER_AMOUNT}`);
    console.log(`   Auto-Order Enabled: ${process.env.AUTO_ORDER_ENABLED}\n`);
    
    try {
        // Initialize monitor
        console.log('🔧 Initializing MEPIFORM monitor...');
        const monitor = new MepiformMonitor();
        
        const initialized = await monitor.initialize();
        if (!initialized) {
            console.log('❌ Failed to initialize monitor');
            return;
        }
        
        console.log('✅ Monitor initialized successfully\n');
        
        // Perform single status check
        console.log('🔍 Performing test status check...');
        const result = await monitor.checkMepiformStatus();
        
        if (result) {
            console.log('\n📊 Test Results:');
            console.log(`   Product Found: ${result.title ? '✅' : '❌'}`);
            console.log(`   Status Available: ${result.isAvailable ? '✅' : '❌'}`);
            console.log(`   Confidence Level: ${result.confidence}%`);
            console.log(`   Price Retrieved: ${result.price ? '✅' : '❌'}`);
            
            if (result.isAvailable) {
                console.log('\n🚨 MEPIFORM IS AVAILABLE!');
                console.log('   The monitoring system would trigger an order now');
                console.log(`   Quantity: ${monitor.determineOrderQuantity(result)} units`);
            } else {
                console.log('\n⏳ MEPIFORM is currently out of stock');
                console.log('   Monitoring will continue until it becomes available');
            }
        } else {
            console.log('❌ Unable to check product status (likely login issue)');
        }
        
        // Clean up
        await monitor.stopMonitoring();
        
        console.log('\n🎯 Next Steps:');
        console.log('==============');
        console.log('1. To start continuous monitoring: node mepiform-monitor.js');
        console.log('2. Monitor will check every 5 minutes during active hours (7AM-7PM)');
        console.log('3. When MEPIFORM becomes available, it will automatically order 350 or 700 units');
        console.log('4. Check logs/ directory for detailed monitoring history');
        
        if (process.env.AUTO_ORDER_ENABLED === 'true') {
            console.log('\n⚠️  IMPORTANT: Auto-ordering is ENABLED');
            console.log('   - Orders will be placed automatically when stock is detected');
            console.log('   - Make sure your payment method and shipping info are set up');
            console.log('   - Monitor the logs closely for order confirmations');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Verify your credentials in .env file');
        console.log('2. Check if Oriola4Care website is accessible');
        console.log('3. Ensure you can login manually to the website');
        console.log('4. Try running: node oriola-login-test.js');
    }
}

// Run the test
testMepiformMonitoring();