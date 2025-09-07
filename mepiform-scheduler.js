const { spawn } = require('child_process');
const schedule = require('node-schedule');
const path = require('path');

class MepiformScheduler {
    constructor() {
        this.automationProcess = null;
        this.isRunning = false;
        this.startTime = { hour: 7, minute: 0 };
        this.endTime = { hour: 18, minute: 0 };
    }

    startAutomation() {
        if (this.isRunning) {
            console.log('⚠️  Automation already running');
            return;
        }

        console.log('🚀 Starting MEPIFORM automation...');
        
        const scriptPath = path.join(__dirname, 'mepiform-order-system.js');
        this.automationProcess = spawn('node', [scriptPath], {
            stdio: 'inherit'
        });

        this.isRunning = true;

        this.automationProcess.on('exit', (code) => {
            console.log(`Automation process exited with code ${code}`);
            this.isRunning = false;
            
            if (code !== 0 && this.isWithinWorkHours()) {
                console.log('🔄 Restarting automation in 5 minutes...');
                setTimeout(() => this.startAutomation(), 300000);
            }
        });

        this.automationProcess.on('error', (err) => {
            console.error('❌ Failed to start automation:', err);
            this.isRunning = false;
        });
    }

    stopAutomation() {
        if (!this.isRunning || !this.automationProcess) {
            console.log('⚠️  Automation not running');
            return;
        }

        console.log('🛑 Stopping MEPIFORM automation...');
        this.automationProcess.kill('SIGINT');
        this.isRunning = false;
    }

    isWithinWorkHours() {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        
        return day >= 1 && day <= 5 && hour >= 7 && hour < 18;
    }

    isHoliday(date) {
        const holidays = [
            '2024-01-01', // New Year's Day
            '2024-01-06', // Epiphany
            '2024-03-29', // Good Friday
            '2024-04-01', // Easter Monday
            '2024-05-01', // Labor Day
            '2024-05-09', // Ascension Day
            '2024-06-06', // National Day
            '2024-06-21', // Midsummer Eve
            '2024-12-24', // Christmas Eve
            '2024-12-25', // Christmas Day
            '2024-12-26', // Boxing Day
            '2024-12-31'  // New Year's Eve
        ];
        
        const dateStr = date.toISOString().split('T')[0];
        return holidays.includes(dateStr);
    }

    scheduleAutomation() {
        console.log('📅 MEPIFORM Scheduler Active');
        console.log(`⏰ Work hours: ${this.startTime.hour}:00 - ${this.endTime.hour}:00 (Mon-Fri)`);
        console.log('─'.repeat(50));

        // Start job - every weekday at 7:00
        const startJob = schedule.scheduleJob(
            { hour: this.startTime.hour, minute: this.startTime.minute, dayOfWeek: [1, 2, 3, 4, 5] },
            () => {
                const today = new Date();
                if (!this.isHoliday(today)) {
                    console.log(`\n📅 ${today.toDateString()}`);
                    console.log('🌅 Starting daily automation...');
                    this.startAutomation();
                } else {
                    console.log(`🎄 Holiday detected - skipping automation`);
                }
            }
        );

        // Stop job - every weekday at 18:00
        const stopJob = schedule.scheduleJob(
            { hour: this.endTime.hour, minute: this.endTime.minute, dayOfWeek: [1, 2, 3, 4, 5] },
            () => {
                console.log('🌙 End of work day - stopping automation...');
                this.stopAutomation();
            }
        );

        // Check if we should be running right now
        if (this.isWithinWorkHours() && !this.isHoliday(new Date())) {
            console.log('📍 Within work hours - starting automation immediately');
            this.startAutomation();
        } else {
            const nextStart = this.getNextStartTime();
            console.log(`⏳ Next automation start: ${nextStart.toLocaleString()}`);
        }

        // Status check every hour
        const statusJob = schedule.scheduleJob('0 * * * *', () => {
            if (this.isRunning) {
                console.log(`📊 Status: Automation running | Time: ${new Date().toLocaleTimeString()}`);
            }
        });

        console.log('✅ Scheduler initialized successfully');
    }

    getNextStartTime() {
        const now = new Date();
        const next = new Date();
        
        next.setHours(this.startTime.hour, this.startTime.minute, 0, 0);
        
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }
        
        while (next.getDay() === 0 || next.getDay() === 6 || this.isHoliday(next)) {
            next.setDate(next.getDate() + 1);
        }
        
        return next;
    }

    start() {
        this.scheduleAutomation();
        
        // Keep the process running
        process.stdin.resume();
    }
}

const scheduler = new MepiformScheduler();

// Handle shutdown gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Scheduler shutdown requested...');
    scheduler.stopAutomation();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Scheduler termination requested...');
    scheduler.stopAutomation();
    process.exit(0);
});

if (require.main === module) {
    scheduler.start();
}

module.exports = MepiformScheduler;