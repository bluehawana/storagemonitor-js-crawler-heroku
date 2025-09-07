# MEPIFORM Automated Order System - Setup Guide

## System Overview
This system automatically monitors and orders MEPIFORM products from Oriola4Care during Swedish business hours (Mon-Fri, 07:00-18:00).

## Quick Start

### 1. Install Dependencies
```bash
npm install playwright node-schedule express ws chalk
npx playwright install chromium
```

### 2. Start the System
```bash
node start-mepiform-automation.js
```

Select option 1 to start full automation with dashboard and scheduler.

### 3. Enter Password
On first run, you'll be prompted to enter your password. It will be securely saved for future sessions.

## System Components

### Main Files:
- **mepiform-order-system.js** - Core ordering logic
- **mepiform-scheduler.js** - Handles work hour scheduling  
- **mepiform-monitor-dashboard.js** - Web dashboard for monitoring
- **start-mepiform-automation.js** - Main startup script

### Order Logic:

#### Product 1 (MEPIFORM 10X18CM):
- Normal stock orders: 700 → 350 → 140 → 70 → 70 (continuous)
- Limited stock: Always 35 units
- Minimum order: 35 units

#### Product 2 (MEPIFORM 5X7.5CM):  
- Normal stock orders: 900 → 450 → 270
- Limited stock: Always 45 units
- Daily limit: 1620 units
- Minimum order: 45 units

### Features:
- ✅ Automatic login with password management
- ✅ Inventory checking every 8-12 seconds
- ✅ Smart order quantity strategies
- ✅ Backorder detection and deletion
- ✅ 3-minute wait after backorders
- ✅ Daily counter reset
- ✅ Web dashboard at http://localhost:3000
- ✅ Automatic restart on failures
- ✅ Weekend and holiday detection

## Testing

Run the test suite:
```bash
node test-mepiform-system.js
```

## Monitoring

Access the web dashboard at http://localhost:3000 to see:
- Current system status
- Product availability
- Today's orders
- Real-time alerts
- Order statistics

## Troubleshooting

### Password Issues
Delete `mepiform-config.json` and restart - you'll be prompted for a new password.

### Order Failures
Check the dashboard for error messages. Common issues:
- Credit limit reached (system will retry with smaller quantities)
- Network errors (system will retry)
- Login session expired (system will re-login)

### Schedule Issues
The system only runs Mon-Fri 07:00-18:00 Swedish time. Check your system clock.

## Security Notes
- Password is stored locally in `mepiform-config.json`
- No sensitive data is transmitted externally
- All automation runs on your local machine

## Support
For issues or questions about this MEPIFORM order automation system, please contact your system administrator.