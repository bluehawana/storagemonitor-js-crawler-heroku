const CompleteOrderAutomation = require('./complete-order-automation');

// Test the new order strategy logic
function testOrderStrategies() {
    console.log('🧪 Testing MEPIFORM Order Strategy Logic\n');
    
    const automation = new CompleteOrderAutomation();
    
    // Test scenarios with different prices
    const testScenarios = [
        { price: '250,00 SEK', description: 'Normal price - should order 700 units' },
        { price: '400,00 SEK', description: 'High price - should split into multiple orders' },
        { price: '600,00 SEK', description: 'Very high price - should use smaller quantities' },
        { price: '150,00 SEK', description: 'Low price - should order 700 units directly' },
        { price: '1000,00 SEK', description: 'Extreme price - should order minimum quantity' }
    ];
    
    testScenarios.forEach((scenario, index) => {
        console.log(`📊 Test ${index + 1}: ${scenario.description}`);
        console.log(`💰 Price: ${scenario.price}`);
        
        const mockProductResult = {
            title: 'MEPIFORM 10X18CM 5ST',
            price: scenario.price,
            stockStatus: 'Tillgänglig',
            isInStock: true
        };
        
        // Debug price parsing
        const priceText = mockProductResult.price || '';
        const parsedPrice = parseFloat(priceText.replace(/[^0-9,]/g, '').replace(',', '.'));
        console.log(`🔍 Price parsing: "${priceText}" → ${parsedPrice} SEK`);
        console.log(`💰 700 units cost: ${parsedPrice * 700} SEK (max: 250000)`);
        
        const strategy = automation.determineOrderStrategy(mockProductResult);
        
        console.log(`📋 Strategy: ${strategy.strategy.toUpperCase()}`);
        console.log(`📦 Orders: [${strategy.orders.join(', ')}] units`);
        console.log(`🎯 Total Target: ${strategy.totalUnits} units`);
        console.log(`💰 Estimated Cost: ${strategy.estimatedCost?.toFixed(2) || 'N/A'} SEK`);
        
        if (strategy.strategy === 'split') {
            console.log(`🔄 Split into ${strategy.orderCount} separate orders`);
            console.log(`   Each order will be placed with 30-second intervals`);
        }
        
        console.log('─'.repeat(50));
    });
    
    console.log('\n📋 Order Strategy Summary:');
    console.log('==========================');
    console.log('🎯 Priority 1: Single order of 700 units (if budget allows)');
    console.log('🔄 Priority 2: Split into multiple orders totaling 700 units:');
    console.log('   • 350 + 350 (2 orders)');
    console.log('   • 350 + 200 + 150 (3 orders)');
    console.log('   • 350 + 140 + 110 + 100 (4 orders)');
    console.log('   • 300 + 200 + 200 (3 orders)');
    console.log('   • 250 + 250 + 200 (3 orders)');
    console.log('📦 Priority 3: Single largest possible order (if splits don\'t fit)');
    console.log('⚠️  Minimum: 100 units (emergency fallback)');
    
    console.log('\n⏰ Timing Between Orders:');
    console.log('• 30-second delay between each split order');
    console.log('• Prevents being blocked for multiple requests');
    console.log('• Allows system to process each order fully');
    
    console.log('\n🛡️  Safety Features:');
    console.log('• Stops entire sequence if any order fails');
    console.log('• Validates budget for each individual order');
    console.log('• Tracks total achievement vs target');
    console.log('• Comprehensive logging of all order attempts');
}

// Test reference number generation
function testReferenceGeneration() {
    console.log('\n🔢 Testing Reference Number Generation\n');
    
    const automation = new CompleteOrderAutomation();
    
    console.log('Generated References:');
    for (let i = 0; i < 5; i++) {
        const ref = automation.generateOrderReference();
        console.log(`${i + 1}. ${ref}`);
    }
    
    console.log('\nFormat: YYYYMMDD + 3-digit sequence (001, 002, 003...)');
    console.log('Used for both "Er referens" and "Ert beställningsnummer"');
}

// Test delivery date calculation
function testDeliveryDates() {
    console.log('\n📅 Testing Delivery Date Calculation\n');
    
    const automation = new CompleteOrderAutomation();
    
    console.log('Next working day calculations:');
    for (let i = 0; i < 7; i++) {
        const testDate = new Date();
        testDate.setDate(testDate.getDate() + i);
        
        // Temporarily modify the internal date for testing
        const originalDate = Date;
        global.Date = function(...args) {
            return args.length ? new originalDate(...args) : testDate;
        };
        global.Date.now = originalDate.now;
        global.Date.prototype = originalDate.prototype;
        
        const deliveryDate = automation.getNextWorkingDay();
        global.Date = originalDate;
        
        console.log(`${testDate.toDateString()} → ${deliveryDate} (${new Date(deliveryDate).toDateString()})`);
    }
    
    console.log('\nSkips weekends automatically');
    console.log('Always delivers on next available business day');
}

// Run all tests
console.log('🚀 MEPIFORM Order Strategy Testing Suite');
console.log('========================================\n');

testOrderStrategies();
testReferenceGeneration();
testDeliveryDates();

console.log('\n✅ All tests completed!');
console.log('\n🎯 Key Benefits of New Strategy:');
console.log('• Always aims for 700 total units');
console.log('• Intelligent splitting when budget limited');
console.log('• Multiple fallback strategies');
console.log('• Real-time cost validation');
console.log('• Comprehensive success tracking');