# MEPIFORM Automated Ordering System

## 🎯 Overview

This system automatically monitors and orders **MEPIFORM 10X18CM 5ST** from Oriola4Care pharmacy when it becomes available in stock. It handles the complete process from stock monitoring to order placement.

## 📦 Product Details

- **Product**: MEPIFORM 10X18CM 5ST
- **Supplier**: MÖLNLYCKE HEALTH CARE  
- **Product Code**: 282186-888
- **URL**: https://oriola4care.oriola-kd.com/Varum%C3%A4rken/M%C3%96LNLYCKE-HEALTH-CARE/MEPIFORM-10X18CM-5ST/p/282186-888
- **Order Quantities**: 350 or 700 units
- **Expected Price**: ~250 SEK per unit

## 🚀 Quick Start

### 1. Start Monitoring
```bash
npm start
# or
node start-mepiform.js
```

### 2. Test Login
```bash
npm run test-login
```

### 3. Manual Monitoring (without auto-order)
```bash
npm run test-mepiform
```

## ⚙️ Configuration

### Required Environment Variables (.env)
```bash
# Login credentials
LOGIN_URL=https://oriola4care.oriola-kd.com/login
USERNAME=your-email@example.com
PASSWORD=your-password

# Order settings
AUTO_ORDER_ENABLED=true          # Set to false for notifications only
MAX_ORDER_AMOUNT=250000          # Maximum order value in SEK
QUANTITY_PER_ORDER=350           # Default quantity
ALTERNATE_QUANTITY=700           # Alternative quantity
```

### Delivery Address (hardcoded)
```
NYA TINGSTADSGATAN 1
42244 HISINGS BACKA
```

## 🔄 How It Works

1. **Monitoring**: Checks MEPIFORM stock status every 5 minutes
2. **Detection**: Analyzes Swedish stock status text for availability
3. **Order Trigger**: When status changes from "out of stock" to "available"
4. **Automatic Ordering**:
   - Navigates to product page
   - Sets quantity (350 or 700 units based on price)
   - Adds to cart
   - Proceeds to checkout
   - Fills delivery date (next working day)
   - Sets reference numbers (YYYYMMDD001 format)
   - Confirms and places order

## 📊 Order Logic

### Intelligent Order Strategy
**🎯 Priority 1: Single 700-unit order**
- If `(price × 700) ≤ MAX_ORDER_AMOUNT`: Place single order for 700 units

**🔄 Priority 2: Split orders to reach 700 total**
- `[350, 350]` - 2 orders totaling 700 units
- `[350, 200, 150]` - 3 orders totaling 700 units  
- `[350, 140, 110, 100]` - 4 orders totaling 700 units
- `[300, 200, 200]` - 3 orders totaling 700 units
- `[250, 250, 200]` - 3 orders totaling 700 units

**📦 Priority 3: Maximum possible single order**
- If splits don't fit budget: Order largest quantity possible (up to 700)

**⚠️ Fallback: Minimum viable order**
- Last resort: Order 50 units minimum

### Reference Numbers
- **Format**: YYYYMMDD001 (date + sequence)
- **Er referens**: 20250906001
- **Ert beställningsnummer**: 20250906001
- Auto-increments: 001, 002, 003, etc.

### Delivery Date
- Automatically set to next working day
- Skips weekends
- Format: YYYY-MM-DD

## 🛡️ Safety Features

### Built-in Protections
- ✅ Price validation before ordering
- ✅ Maximum order amount limits
- ✅ Confirmation checkbox handling
- ✅ Error logging and screenshots
- ✅ Graceful shutdown handling

### Manual Override
- Set `AUTO_ORDER_ENABLED=false` for monitoring only
- System will send alerts without placing orders
- Allows manual review before purchasing

## 📋 Status Indicators

### Swedish Stock Status Keywords

**Available** (Will trigger order):
- "tillgänglig" (available)
- "i lager" (in stock)
- "leverans" (delivery)
- "beställ" (order)

**Unavailable** (No action):
- "slut" (out)
- "tillfälligt slut" (temporarily out)
- "ej i lager" (not in stock)
- "restorder" (backorder)

## 📁 File Structure

```
├── start-mepiform.js              # Main launcher
├── complete-order-automation.js   # Core automation logic
├── start-mepiform-monitoring.js   # Simple monitoring version
├── oriola-login-test.js           # Login testing
├── .env                          # Configuration (update this!)
├── logs/                         # Monitoring logs
└── MEPIFORM-README.md            # This file
```

## 🔧 Troubleshooting

### Login Issues
1. Verify credentials in `.env`
2. Check if account is locked
3. Test manual login at website
4. Run: `npm run test-login`

### Order Issues  
1. Check payment method setup in Oriola4Care
2. Verify delivery address is correct
3. Ensure sufficient account balance
4. Check error screenshots in project folder

### Network Issues
1. Test internet connectivity
2. Check if VPN is needed
3. Verify Oriola4Care website is accessible
4. Consider rate limiting or blocking

## 📊 Monitoring & Logs

### Log Files
- `logs/combined.log` - All activity
- `logs/error.log` - Errors only
- Console output shows real-time status

### What Gets Logged
- Stock status checks
- Price changes
- Order attempts
- Errors and exceptions
- Order confirmations

## ⚠️ Important Notes

### Before Running
- ✅ Verify your Oriola4Care account has payment method
- ✅ Confirm delivery address is correct
- ✅ Ensure you can handle large orders (350-700 units)
- ✅ Check account has sufficient balance
- ✅ Test login manually first

### During Operation
- Monitor console output for status
- Check logs for detailed information
- Watch for order confirmation emails
- Be prepared to handle deliveries

### Legal & Compliance
- Respect Oriola4Care terms of service
- Use reasonable monitoring intervals
- Don't abuse automated access
- Pharmacy regulations may apply

## 🚨 Emergency Stop

To stop monitoring immediately:
- Press `Ctrl+C` in terminal
- Or kill the Node.js process
- System handles graceful shutdown

## 📞 Support

If you encounter issues:
1. Check the logs in `logs/` directory
2. Review error screenshots
3. Verify configuration in `.env`
4. Test individual components with npm scripts

---

**Status**: ✅ Ready for Production
**Last Updated**: September 2025
**Target**: MEPIFORM 10X18CM 5ST availability monitoring and ordering