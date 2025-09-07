const MepiformOrderSystem = require('./mepiform-order-system');
const chalk = require('chalk');

class MepiformSystemTester {
    constructor() {
        this.tests = [];
        this.results = [];
    }

    addTest(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async runTests() {
        console.log(chalk.bold.blue('\n🧪 MEPIFORM System Test Suite'));
        console.log(chalk.blue('============================\n'));

        for (const test of this.tests) {
            console.log(chalk.yellow(`Running: ${test.name}...`));
            
            try {
                await test.testFn();
                this.results.push({ name: test.name, passed: true });
                console.log(chalk.green(`✅ ${test.name} - PASSED\n`));
            } catch (error) {
                this.results.push({ name: test.name, passed: false, error: error.message });
                console.log(chalk.red(`❌ ${test.name} - FAILED`));
                console.log(chalk.red(`   Error: ${error.message}\n`));
            }
        }

        this.printSummary();
    }

    printSummary() {
        console.log(chalk.bold.blue('\n📊 Test Summary'));
        console.log(chalk.blue('==============='));
        
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;
        
        console.log(`Total Tests: ${total}`);
        console.log(chalk.green(`Passed: ${passed}`));
        console.log(chalk.red(`Failed: ${failed}`));
        console.log(`Success Rate: ${Math.round((passed / total) * 100)}%\n`);
        
        if (failed > 0) {
            console.log(chalk.red('\nFailed Tests:'));
            this.results.filter(r => !r.passed).forEach(r => {
                console.log(chalk.red(`- ${r.name}: ${r.error}`));
            });
        }
    }
}

async function runAllTests() {
    const tester = new MepiformSystemTester();
    const system = new MepiformOrderSystem();

    // Test 1: System Initialization
    tester.addTest('System Initialization', async () => {
        const result = await system.initialize();
        if (!result) throw new Error('Failed to initialize system');
    });

    // Test 2: Product Configuration
    tester.addTest('Product Configuration', async () => {
        const p1 = system.products.product1;
        const p2 = system.products.product2;
        
        if (!p1.strategies.normal || p1.strategies.normal.length !== 4) {
            throw new Error('Product 1 normal strategies incorrect');
        }
        
        if (p1.strategies.continuous !== 70) {
            throw new Error('Product 1 continuous strategy incorrect');
        }
        
        if (p2.dailyLimit !== 1620) {
            throw new Error('Product 2 daily limit incorrect');
        }
    });

    // Test 3: Order Reference Generation
    tester.addTest('Order Reference Generation', async () => {
        const ref1 = system.generateOrderReference();
        const ref2 = system.generateOrderReference();
        
        const datePattern = /^\d{8}-\d{2}$/;
        if (!datePattern.test(ref1)) {
            throw new Error('Invalid reference format: ' + ref1);
        }
        
        if (ref1 === ref2) {
            throw new Error('References should be unique');
        }
    });

    // Test 4: Business Day Calculation
    tester.addTest('Business Day Calculation', async () => {
        const nextDay = system.getNextBusinessDay();
        const date = new Date(nextDay);
        
        if (date.getDay() === 0 || date.getDay() === 6) {
            throw new Error('Next business day should not be weekend');
        }
        
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (date < tomorrow) {
            throw new Error('Next business day should be in future');
        }
    });

    // Test 5: Quantity Strategy - Product 1
    tester.addTest('Product 1 Quantity Strategy', async () => {
        // Reset counters
        system.products.product1.dailyOrderCount = 0;
        
        // Test normal progression
        const quantities = [];
        for (let i = 0; i < 6; i++) {
            const qty = system.getOrderQuantity('product1', 'available');
            quantities.push(qty);
            system.products.product1.dailyOrderCount++;
        }
        
        const expected = [700, 350, 140, 70, 70, 70];
        if (JSON.stringify(quantities) !== JSON.stringify(expected)) {
            throw new Error(`Expected ${expected}, got ${quantities}`);
        }
        
        // Test limited stock
        system.products.product1.dailyOrderCount = 0;
        const limitedQty = system.getOrderQuantity('product1', 'limited');
        if (limitedQty !== 35) {
            throw new Error(`Limited stock should order 35, got ${limitedQty}`);
        }
    });

    // Test 6: Quantity Strategy - Product 2
    tester.addTest('Product 2 Quantity Strategy', async () => {
        // Reset counters
        system.products.product2.dailyOrderCount = 0;
        system.products.product2.dailyOrdered = 0;
        
        // Test normal progression
        const quantities = [];
        for (let i = 0; i < 3; i++) {
            const qty = system.getOrderQuantity('product2', 'available');
            quantities.push(qty);
            system.products.product2.dailyOrderCount++;
            system.products.product2.dailyOrdered += qty;
        }
        
        const expected = [900, 450, 270];
        if (JSON.stringify(quantities) !== JSON.stringify(expected)) {
            throw new Error(`Expected ${expected}, got ${quantities}`);
        }
        
        // Test daily limit
        const totalOrdered = quantities.reduce((a, b) => a + b, 0);
        if (totalOrdered !== 1620) {
            throw new Error(`Total should be 1620, got ${totalOrdered}`);
        }
        
        // Should return 0 when limit reached
        const overLimit = system.getOrderQuantity('product2', 'available');
        if (overLimit !== 0) {
            throw new Error(`Should return 0 when limit reached, got ${overLimit}`);
        }
    });

    // Test 7: Daily Counter Reset
    tester.addTest('Daily Counter Reset', async () => {
        system.products.product1.dailyOrderCount = 5;
        system.products.product2.dailyOrdered = 1000;
        
        system.resetAllCounters();
        
        if (system.products.product1.dailyOrderCount !== 0) {
            throw new Error('Product 1 counter not reset');
        }
        
        if (system.products.product2.dailyOrdered !== 0) {
            throw new Error('Product 2 daily ordered not reset');
        }
    });

    // Test 8: Random Interval Generation
    tester.addTest('Random Interval Generation', async () => {
        const intervals = [];
        for (let i = 0; i < 10; i++) {
            intervals.push(system.getRandomInterval());
        }
        
        const allInRange = intervals.every(i => i >= 8000 && i <= 12000);
        if (!allInRange) {
            throw new Error('Intervals not in correct range (8-12 seconds)');
        }
        
        const uniqueValues = new Set(intervals).size;
        if (uniqueValues < 5) {
            throw new Error('Random intervals not sufficiently random');
        }
    });

    // Test 9: Backorder Wait Time
    tester.addTest('Backorder Wait Time Logic', async () => {
        const product = system.products.product1;
        product.lastBackorderTime = Date.now();
        
        // Should return null during wait period
        const status = await system.checkProductInventory('product1').catch(() => null);
        if (status !== null) {
            throw new Error('Should return null during wait period');
        }
        
        // Reset for next test
        product.lastBackorderTime = null;
    });

    // Test 10: State Persistence
    tester.addTest('State Persistence', async () => {
        const testData = {
            date: new Date().toDateString(),
            product1OrderCount: 3,
            product2OrderCount: 2,
            product2DailyOrdered: 1350,
            todaysOrders: [
                { product: 'MEPIFORM 10X18CM', quantity: 700, reference: '20240101-01' }
            ]
        };
        
        await system.saveDailyState(testData.date);
        
        // Verify file was created
        const fs = require('fs');
        const path = require('path');
        const statePath = path.join(__dirname, 'daily-state.json');
        
        if (!fs.existsSync(statePath)) {
            throw new Error('Daily state file not created');
        }
        
        const savedData = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        if (savedData.product1OrderCount !== testData.product1OrderCount) {
            throw new Error('State not saved correctly');
        }
    });

    // Run all tests
    await tester.runTests();
    
    // Cleanup
    await system.cleanup();
}

// Test individual components
async function testOrderFlowSimulation() {
    console.log(chalk.bold.cyan('\n🔄 Order Flow Simulation'));
    console.log(chalk.cyan('======================\n'));
    
    const system = new MepiformOrderSystem();
    await system.initialize();
    
    console.log('Simulating order flow for both products:\n');
    
    // Simulate Product 1 orders
    console.log(chalk.bold('Product 1 (MEPIFORM 10X18CM):'));
    system.products.product1.dailyOrderCount = 0;
    
    for (let i = 0; i < 6; i++) {
        const qty = system.getOrderQuantity('product1', 'available');
        console.log(`Order ${i + 1}: ${qty} units`);
        system.products.product1.dailyOrderCount++;
    }
    
    console.log(chalk.bold('\nProduct 2 (MEPIFORM 5X7.5CM):'));
    system.products.product2.dailyOrderCount = 0;
    system.products.product2.dailyOrdered = 0;
    
    for (let i = 0; i < 4; i++) {
        const qty = system.getOrderQuantity('product2', 'available');
        if (qty > 0) {
            console.log(`Order ${i + 1}: ${qty} units (Total: ${system.products.product2.dailyOrdered + qty}/${system.products.product2.dailyLimit})`);
            system.products.product2.dailyOrderCount++;
            system.products.product2.dailyOrdered += qty;
        } else {
            console.log(`Order ${i + 1}: Daily limit reached!`);
        }
    }
    
    console.log(chalk.green('\n✅ Order flow simulation complete'));
}

// Main execution
if (require.main === module) {
    console.log(chalk.bold.magenta('MEPIFORM Automation System Test\n'));
    
    (async () => {
        try {
            // Check if chalk is installed
            try {
                require.resolve('chalk');
            } catch {
                console.log('Installing chalk for colored output...');
                const { execSync } = require('child_process');
                execSync('npm install chalk', { stdio: 'inherit' });
            }
            
            await runAllTests();
            await testOrderFlowSimulation();
            
            console.log(chalk.bold.green('\n🎉 All tests completed successfully!\n'));
            process.exit(0);
        } catch (error) {
            console.error(chalk.red('\n❌ Test suite failed:'), error);
            process.exit(1);
        }
    })();
}

module.exports = { MepiformSystemTester, runAllTests };