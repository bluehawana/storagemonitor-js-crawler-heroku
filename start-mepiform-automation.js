#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const readline = require('readline');

class MepiformAutomationStarter {
    constructor() {
        this.processes = {
            dashboard: null,
            scheduler: null
        };
        this.isRunning = false;
    }

    async checkDependencies() {
        console.log('🔍 Checking dependencies...');
        
        const requiredPackages = [
            'playwright',
            'node-schedule',
            'express',
            'ws'
        ];
        
        const packageJsonPath = path.join(__dirname, 'package.json');
        try {
            const packageJson = await fs.readFile(packageJsonPath, 'utf8');
            const pkg = JSON.parse(packageJson);
            const installedPackages = Object.keys(pkg.dependencies || {});
            
            const missing = requiredPackages.filter(p => !installedPackages.includes(p));
            
            if (missing.length > 0) {
                console.log('⚠️  Missing packages:', missing.join(', '));
                console.log('📦 Installing missing packages...');
                await this.installPackages(missing);
            } else {
                console.log('✅ All dependencies installed');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error checking dependencies:', error.message);
            return false;
        }
    }

    async installPackages(packages) {
        return new Promise((resolve, reject) => {
            const npm = spawn('npm', ['install', ...packages], {
                stdio: 'inherit'
            });
            
            npm.on('exit', (code) => {
                if (code === 0) {
                    console.log('✅ Packages installed successfully');
                    resolve();
                } else {
                    reject(new Error('Failed to install packages'));
                }
            });
        });
    }

    async checkConfiguration() {
        console.log('\n🔧 Checking configuration...');
        
        const configPath = path.join(__dirname, 'mepiform-config.json');
        try {
            await fs.access(configPath);
            console.log('✅ Configuration file found');
            return true;
        } catch {
            console.log('📝 Configuration file not found - will be created on first run');
            return true;
        }
    }

    startDashboard() {
        console.log('\n📊 Starting monitoring dashboard...');
        
        const dashboardPath = path.join(__dirname, 'mepiform-monitor-dashboard.js');
        this.processes.dashboard = spawn('node', [dashboardPath], {
            stdio: 'pipe'
        });
        
        this.processes.dashboard.stdout.on('data', (data) => {
            console.log(`[Dashboard] ${data.toString().trim()}`);
        });
        
        this.processes.dashboard.stderr.on('data', (data) => {
            console.error(`[Dashboard Error] ${data.toString().trim()}`);
        });
        
        this.processes.dashboard.on('exit', (code) => {
            console.log(`Dashboard process exited with code ${code}`);
            if (this.isRunning && code !== 0) {
                console.log('🔄 Restarting dashboard...');
                setTimeout(() => this.startDashboard(), 5000);
            }
        });
    }

    startScheduler() {
        console.log('\n🗓️  Starting automation scheduler...');
        
        const schedulerPath = path.join(__dirname, 'mepiform-scheduler.js');
        this.processes.scheduler = spawn('node', [schedulerPath], {
            stdio: 'inherit'
        });
        
        this.processes.scheduler.on('exit', (code) => {
            console.log(`Scheduler process exited with code ${code}`);
            if (this.isRunning && code !== 0) {
                console.log('🔄 Restarting scheduler...');
                setTimeout(() => this.startScheduler(), 5000);
            }
        });
    }

    async start() {
        console.log('🚀 MEPIFORM Automated Order System');
        console.log('==================================');
        console.log('Version: 1.0.0');
        console.log('Products: MEPIFORM 10X18CM & 5X7.5CM');
        console.log('Work Hours: Mon-Fri 07:00-18:00');
        console.log('==================================\n');
        
        // Check dependencies
        const depsOk = await this.checkDependencies();
        if (!depsOk) {
            console.error('❌ Failed to verify dependencies');
            process.exit(1);
        }
        
        // Check configuration
        await this.checkConfiguration();
        
        this.isRunning = true;
        
        // Start dashboard
        this.startDashboard();
        
        // Wait a moment for dashboard to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Start scheduler
        this.startScheduler();
        
        console.log('\n✅ All systems started successfully!');
        console.log('\n📊 Dashboard: http://localhost:3000');
        console.log('🔄 Automation: Running according to schedule');
        console.log('\n🛑 Press Ctrl+C to stop all processes\n');
    }

    async stop() {
        console.log('\n🛑 Stopping all processes...');
        this.isRunning = false;
        
        if (this.processes.dashboard) {
            this.processes.dashboard.kill('SIGTERM');
        }
        
        if (this.processes.scheduler) {
            this.processes.scheduler.kill('SIGTERM');
        }
        
        // Give processes time to clean up
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('✅ All processes stopped');
    }

    async showMenu() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log('\n📋 MEPIFORM Automation Menu');
        console.log('==========================');
        console.log('1. Start Full Automation (Dashboard + Scheduler)');
        console.log('2. Start Dashboard Only');
        console.log('3. Start Direct Automation (No Schedule)');
        console.log('4. Test Configuration');
        console.log('5. Exit');
        console.log('');
        
        return new Promise((resolve) => {
            rl.question('Select option (1-5): ', (answer) => {
                rl.close();
                resolve(answer);
            });
        });
    }

    async runDirectAutomation() {
        console.log('\n🤖 Starting direct automation (no schedule)...');
        const automationPath = path.join(__dirname, 'mepiform-order-system.js');
        
        const automation = spawn('node', [automationPath], {
            stdio: 'inherit'
        });
        
        automation.on('exit', (code) => {
            console.log(`Automation exited with code ${code}`);
            process.exit(code);
        });
    }

    async testConfiguration() {
        console.log('\n🧪 Testing configuration...');
        
        const testPath = path.join(__dirname, 'test-mepiform-config.js');
        await fs.writeFile(testPath, `
const MepiformOrderSystem = require('./mepiform-order-system');

async function test() {
    const system = new MepiformOrderSystem();
    console.log('Initializing system...');
    await system.initialize();
    
    console.log('\\nProduct 1 Configuration:');
    console.log('- Normal orders:', system.products.product1.strategies.normal);
    console.log('- Continuous:', system.products.product1.strategies.continuous);
    console.log('- Minimum:', system.products.product1.strategies.minimum);
    
    console.log('\\nProduct 2 Configuration:');
    console.log('- Normal orders:', system.products.product2.strategies.normal);
    console.log('- Daily limit:', system.products.product2.dailyLimit);
    console.log('- Minimum:', system.products.product2.strategies.minimum);
    
    console.log('\\n✅ Configuration test passed');
}

test().catch(console.error);
        `);
        
        const test = spawn('node', [testPath], {
            stdio: 'inherit'
        });
        
        test.on('exit', async () => {
            await fs.unlink(testPath).catch(() => {});
        });
    }
}

const starter = new MepiformAutomationStarter();

// Handle shutdown gracefully
process.on('SIGINT', async () => {
    await starter.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await starter.stop();
    process.exit(0);
});

// Main execution
if (require.main === module) {
    (async () => {
        const args = process.argv.slice(2);
        
        if (args.includes('--help') || args.includes('-h')) {
            console.log('Usage: node start-mepiform-automation.js [options]');
            console.log('Options:');
            console.log('  --auto    Start full automation without menu');
            console.log('  --direct  Start direct automation (no schedule)');
            console.log('  --help    Show this help message');
            process.exit(0);
        }
        
        if (args.includes('--auto')) {
            await starter.start();
        } else if (args.includes('--direct')) {
            await starter.runDirectAutomation();
        } else {
            const choice = await starter.showMenu();
            
            switch (choice) {
                case '1':
                    await starter.start();
                    break;
                case '2':
                    starter.startDashboard();
                    console.log('Dashboard started. Press Ctrl+C to stop.');
                    break;
                case '3':
                    await starter.runDirectAutomation();
                    break;
                case '4':
                    await starter.testConfiguration();
                    setTimeout(() => process.exit(0), 5000);
                    break;
                case '5':
                    console.log('Goodbye!');
                    process.exit(0);
                    break;
                default:
                    console.log('Invalid option');
                    process.exit(1);
            }
        }
    })();
}

module.exports = MepiformAutomationStarter;