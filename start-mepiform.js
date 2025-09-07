#!/usr/bin/env node

const CompleteOrderAutomation = require('./complete-order-automation');
require('dotenv').config();

console.log('🏥 ORIOLA4CARE MEPIFORM AUTOMATION SYSTEM');
console.log('=========================================');
console.log('Product: MEPIFORM 10X18CM 5ST');
console.log('Supplier: MÖLNLYCKE HEALTH CARE');
console.log('Order Quantities: 350 or 700 units');
console.log('Max Price: 300 SEK per unit');
console.log('=========================================\n');

// Configuration validation
function validateConfig() {
    const required = ['LOGIN_URL', 'USERNAME', 'PASSWORD'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.log('❌ Missing required configuration:');
        missing.forEach(key => console.log(`   - ${key}`));
        console.log('\nPlease update your .env file with the missing values.');
        return false;
    }
    
    return true;
}

// Display current configuration
function showConfiguration() {
    console.log('📋 Current Configuration:');
    console.log('=========================');
    console.log(`Login URL: ${process.env.LOGIN_URL}`);
    console.log(`Username: ${process.env.USERNAME}`);
    console.log(`Auto-Order: ${process.env.AUTO_ORDER_ENABLED === 'true' ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`Max Order Amount: ${process.env.MAX_ORDER_AMOUNT || '50000'} SEK`);
    console.log(`Default Quantity: ${process.env.QUANTITY_PER_ORDER || '350'} units`);
    console.log(`Alternative Quantity: ${process.env.ALTERNATE_QUANTITY || '700'} units`);
    
    if (process.env.AUTO_ORDER_ENABLED === 'true') {
        console.log('\n⚠️  AUTOMATIC ORDERING IS ENABLED ⚠️');
        console.log('The system will automatically:');
        console.log('1. Monitor MEPIFORM stock status every 5 minutes');
        console.log('2. When available, add 350 or 700 units to cart');
        console.log('3. Fill delivery date (next working day)');
        console.log('4. Set reference number (YYYYMMDD001 format)'); 
        console.log('5. Complete checkout and place the order');
        console.log('6. Send confirmation notification');
        
        console.log('\n🏠 Delivery Address:');
        console.log('NYA TINGSTADSGATAN 1');
        console.log('42244 HISINGS BACKA');
    } else {
        console.log('\n📧 Notification Mode:');
        console.log('Auto-ordering is disabled. You will receive alerts when MEPIFORM becomes available.');
    }
    
    console.log('\n⏰ Monitoring Schedule:');
    console.log('Active 24/7 - checks every 5 minutes');
    console.log('Logs stored in logs/ directory');
    console.log('=========================\n');
}

async function main() {
    // Validate configuration
    if (!validateConfig()) {
        process.exit(1);
    }
    
    // Show current settings
    showConfiguration();
    
    // Ask for confirmation if auto-ordering is enabled
    if (process.env.AUTO_ORDER_ENABLED === 'true') {
        console.log('🚨 FINAL CONFIRMATION REQUIRED 🚨');
        console.log('Auto-ordering is ENABLED. Orders will be placed automatically.');
        console.log('Make sure:');
        console.log('✓ Your payment method is set up in Oriola4Care');
        console.log('✓ Delivery address is correct'); 
        console.log('✓ You have sufficient funds for large orders (up to 250,000 SEK)');
        console.log('✓ You are prepared to receive and handle the products');
        
        // In a production system, you might want to add a confirmation prompt
        console.log('\n⏳ Starting in 10 seconds... Press Ctrl+C to cancel');
        await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    // Initialize and start the automation
    console.log('🚀 Initializing MEPIFORM automation...');
    
    const automation = new CompleteOrderAutomation();
    
    try {
        const initialized = await automation.initialize();
        
        if (initialized) {
            console.log('✅ System initialized successfully');
            console.log('🔄 Starting monitoring...\n');
            
            await automation.startMonitoring();
            
            // Keep the process running
            console.log('💡 Press Ctrl+C to stop monitoring');
            
        } else {
            console.log('❌ Failed to initialize the system');
            console.log('\n🔧 Troubleshooting Steps:');
            console.log('1. Check your internet connection');
            console.log('2. Verify login credentials in .env file');
            console.log('3. Test manual login at https://oriola4care.oriola-kd.com/login');
            console.log('4. Check if Oriola4Care is blocking automated access');
            console.log('5. Try running: node oriola-login-test.js');
            
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Startup error:', error.message);
        process.exit(1);
    }
}

// Handle process signals
process.on('SIGINT', () => {
    console.log('\n\n🛑 Received shutdown signal (Ctrl+C)');
    console.log('Stopping MEPIFORM monitoring...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n🛑 Received termination signal');
    console.log('Stopping MEPIFORM monitoring...');
    process.exit(0);
});

// Start the application
main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
});