const express = require('express');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const MepiformMonitorDashboard = require('./mepiform-monitor-dashboard');

class MepiformHerokuServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.dashboard = null;
        this.httpServer = null;
        this.automationProcess = null;
        this.isAutomationRunning = false;
    }

    async initialize() {
        console.log('🚀 Initializing MEPIFORM Heroku Server...');
        
        // Set up basic health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                automation: this.isAutomationRunning ? 'running' : 'stopped',
                environment: process.env.NODE_ENV || 'development'
            });
        });

        this.app.get('/start-automation', async (req, res) => {
            if (this.isAutomationRunning) {
                res.json({ status: 'already_running', message: 'Automation is already running' });
                return;
            }

            try {
                await this.startAutomation();
                res.json({ status: 'started', message: 'Automation started successfully' });
            } catch (error) {
                res.status(500).json({ status: 'error', message: error.message });
            }
        });

        this.app.get('/stop-automation', async (req, res) => {
            if (!this.isAutomationRunning) {
                res.json({ status: 'not_running', message: 'Automation is not running' });
                return;
            }

            try {
                await this.stopAutomation();
                res.json({ status: 'stopped', message: 'Automation stopped successfully' });
            } catch (error) {
                res.status(500).json({ status: 'error', message: error.message });
            }
        });

        this.app.get('/automation-status', (req, res) => {
            const now = new Date();
            const hour = now.getHours();
            const day = now.getDay();
            const isWorkHours = day >= 1 && day <= 5 && hour >= 7 && hour < 18;

            res.json({
                isRunning: this.isAutomationRunning,
                isWorkHours,
                currentTime: now.toISOString(),
                nextWorkStart: this.getNextWorkStart().toISOString()
            });
        });

        // Basic root route: server-side redirect to dashboard
        this.app.get('/', (req, res) => {
            res.redirect(302, '/dashboard');
        });
        
        // Start automation if within work hours
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        
        if (day >= 1 && day <= 5 && hour >= 7 && hour < 18) {
            console.log('📍 Within work hours - starting automation');
            setTimeout(() => this.startAutomation(), 5000); // Give server time to fully start
        } else {
            console.log('⏰ Outside work hours - automation will start at 07:00');
        }

        // Schedule daily automation start/stop
        this.scheduleWorkHours();
    }

    async startAutomation() {
        if (this.isAutomationRunning) {
            console.log('⚠️  Automation already running');
            return;
        }

        console.log('🤖 Starting MEPIFORM automation...');
        
        const scriptPath = path.join(__dirname, 'mepiform-order-system.js');
        this.automationProcess = spawn('node', [scriptPath], {
            stdio: 'pipe',
            env: {
                ...process.env,
                HEROKU_MODE: 'true'
            }
        });

        this.isAutomationRunning = true;

        this.automationProcess.stdout.on('data', (data) => {
            console.log(`[Automation] ${data.toString().trim()}`);
            
            // Parse automation events for dashboard
            const output = data.toString();
            if (output.includes('Order successful')) {
                // Extract order info and update dashboard
                this.dashboard.addOrder({
                    product: output.includes('10X18CM') ? 'MEPIFORM 10X18CM' : 'MEPIFORM 5X7.5CM',
                    quantity: parseInt(output.match(/(\d+) units/)?.[1] || '0'),
                    reference: output.match(/Reference: ([A-Z0-9-]+)/)?.[1] || 'Unknown'
                });
            }
        });

        this.automationProcess.stderr.on('data', (data) => {
            console.error(`[Automation Error] ${data.toString().trim()}`);
        });

        this.automationProcess.on('exit', (code) => {
            console.log(`Automation process exited with code ${code}`);
            this.isAutomationRunning = false;
            
            // Restart if it's still work hours and exit was unexpected
            if (code !== 0 && this.isWithinWorkHours()) {
                console.log('🔄 Restarting automation in 2 minutes...');
                setTimeout(() => this.startAutomation(), 120000);
            }
        });

        this.dashboard.updateSystemStatus('active');
        console.log('✅ Automation started successfully');
    }

    async stopAutomation() {
        if (!this.isAutomationRunning || !this.automationProcess) {
            console.log('⚠️  Automation not running');
            return;
        }

        console.log('🛑 Stopping automation...');
        this.automationProcess.kill('SIGTERM');
        
        // Give it time to cleanup
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        if (this.isAutomationRunning) {
            this.automationProcess.kill('SIGKILL');
        }

        this.isAutomationRunning = false;
        this.dashboard.updateSystemStatus('idle');
        console.log('✅ Automation stopped');
    }

    scheduleWorkHours() {
        const schedule = require('node-schedule');
        
        // Start at 7:00 AM Monday-Friday (Swedish time)
        schedule.scheduleJob('0 7 * * 1-5', async () => {
            console.log('🌅 Work day started - starting automation');
            if (!this.isHoliday(new Date())) {
                await this.startAutomation();
            } else {
                console.log('🎄 Holiday detected - skipping automation');
            }
        });

        // Stop at 6:00 PM Monday-Friday (Swedish time)  
        schedule.scheduleJob('0 18 * * 1-5', async () => {
            console.log('🌙 Work day ended - stopping automation');
            await this.stopAutomation();
        });

        // Health check every hour
        schedule.scheduleJob('0 * * * *', () => {
            console.log(`💓 Health check: ${this.isAutomationRunning ? 'Running' : 'Idle'} at ${new Date().toLocaleTimeString()}`);
        });
    }

    isWithinWorkHours() {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        
        return day >= 1 && day <= 5 && hour >= 7 && hour < 18 && !this.isHoliday(now);
    }

    isHoliday(date) {
        const holidays = [
            '2024-01-01', '2024-01-06', '2024-03-29', '2024-04-01',
            '2024-05-01', '2024-05-09', '2024-06-06', '2024-06-21', 
            '2024-12-24', '2024-12-25', '2024-12-26', '2024-12-31'
        ];
        
        const dateStr = date.toISOString().split('T')[0];
        return holidays.includes(dateStr);
    }

    getNextWorkStart() {
        const now = new Date();
        const next = new Date();
        
        next.setHours(7, 0, 0, 0);
        
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }
        
        // Skip weekends
        while (next.getDay() === 0 || next.getDay() === 6 || this.isHoliday(next)) {
            next.setDate(next.getDate() + 1);
        }
        
        return next;
    }

    async start() {
        // Create a single HTTP server and mount dashboard on it
        this.httpServer = http.createServer(this.app);
        this.dashboard = new MepiformMonitorDashboard(this.app, this.httpServer, this.port);
        await this.dashboard.initialize();

        await this.initialize();

        this.httpServer.listen(this.port, () => {
            console.log(`🌐 MEPIFORM Heroku server running on port ${this.port}`);
            console.log(`📊 Dashboard: http://localhost:${this.port}/dashboard`);
            console.log(`🔧 API: http://localhost:${this.port}/health`);
        });

        // Keep the process alive
        process.stdin.resume();
    }

    async cleanup() {
        await this.stopAutomation();
        if (this.dashboard) {
            await this.dashboard.stop();
        }
    }
}

const server = new MepiformHerokuServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received - shutting down gracefully...');
    await server.cleanup();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received - shutting down gracefully...');  
    await server.cleanup();
    process.exit(0);
});

// Heroku specific shutdown
process.on('SIGUSR2', async () => {
    console.log('🛑 SIGUSR2 received - Heroku dyno restart...');
    await server.cleanup();
    process.kill(process.pid, 'SIGUSR2');
});

if (require.main === module) {
    server.start().catch(error => {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    });
}

module.exports = MepiformHerokuServer;
