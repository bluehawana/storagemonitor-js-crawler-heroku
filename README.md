# Health Product Automator

An automated system for monitoring health product availability and placing orders when products come back in stock. Built with ethical scraping practices and compliance features.

## Features

- **24/7 Product Monitoring**: Continuously monitors product availability
- **Smart Scheduling**: Active monitoring during business hours (7AM-7PM weekdays)
- **Automated Ordering**: Places orders when conditions are met
- **Real-time Dashboard**: Web interface with live updates
- **Email Notifications**: Alerts for successful orders and stock changes
- **Rate Limiting**: Respectful scraping with delays and limits
- **Configuration Management**: Easy setup and customization

## Quick Start

### Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd health-product-automator
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start the application:**
   ```bash
   npm run dev
   ```

4. **Access the dashboard:**
   Open http://localhost:3000 in your browser

### Heroku Deployment

1. **Deploy to Heroku:**
   ```bash
   heroku create your-app-name
   heroku addons:create heroku-postgresql:essential-0
   git push heroku main
   ```

2. **Configure environment variables:**
   ```bash
   heroku config:set TARGET_WEBSITE_URL=https://example.com
   heroku config:set LOGIN_URL=https://example.com/login
   heroku config:set USERNAME=your-username
   heroku config:set PASSWORD=your-password
   # ... add other variables as needed
   ```

## Configuration

### Required Environment Variables

- `TARGET_WEBSITE_URL`: Main website to monitor
- `LOGIN_URL`: Login page URL
- `USERNAME`: Your account username
- `PASSWORD`: Your account password
- `NOTIFICATION_EMAIL`: Email for notifications

### CSS Selectors (customize based on target website)

- `USERNAME_SELECTOR`: CSS selector for username field
- `PASSWORD_SELECTOR`: CSS selector for password field
- `LOGIN_BUTTON_SELECTOR`: CSS selector for login button
- `STOCK_SELECTOR`: CSS selector for stock status

### Order Configuration

- `AUTO_ORDER_ENABLED`: Enable/disable automatic ordering
- `MAX_ORDER_AMOUNT`: Maximum price per order
- `QUANTITY_PER_ORDER`: Items to order per product
- `ACTIVE_START_HOUR`: Start of active monitoring (0-23)
- `ACTIVE_END_HOUR`: End of active monitoring (0-23)

## Usage

### Adding Products to Monitor

1. Access the web dashboard
2. Click "Add Product"
3. Fill in:
   - Product name
   - Product URL
   - Stock status CSS selector
   - Maximum price (optional)

### Monitoring Schedule

- **Active Hours**: 7AM-7PM weekdays - checks every 5 minutes
- **Passive Hours**: All other times - checks every 30 minutes
- **Manual Checks**: Available via dashboard button

### Order Automation

Orders are placed automatically when:
- Product comes in stock
- Price is within configured limits
- Daily order limits not exceeded
- Rate limits respected (30 minutes between same product orders)

## Safety Features

- **Rate Limiting**: Prevents excessive requests
- **Daily Limits**: Configurable daily order limits
- **Price Controls**: Maximum price thresholds
- **Manual Confirmation**: Optional manual order approval
- **Error Handling**: Comprehensive logging and recovery

## Email Notifications

Configure SMTP settings for notifications:
- Order confirmations
- Stock alerts
- Error notifications
- Daily reports

For Gmail, use an App Password:
1. Enable 2FA on your Google account
2. Generate an App Password
3. Use the App Password as `SMTP_PASS`

## Legal and Ethical Use

This tool is designed for legitimate wholesale/retail purchasing and must be used in compliance with:
- Website Terms of Service
- Rate limiting and respectful scraping practices
- Local and international laws regarding automated purchasing
- No resale of restricted or regulated products

**Important**: Always verify that your use case complies with the target website's terms of service and applicable laws.

## Project Structure

```
health-product-automator/
├── src/
│   ├── app.js              # Main application server
│   ├── config/             # Configuration management
│   ├── scrapers/           # Web scraping logic
│   ├── orders/             # Order automation
│   ├── scheduler/          # Job scheduling
│   ├── notifications/      # Email/SMS alerts
│   └── utils/              # Logging and utilities
├── public/                 # Web dashboard assets
├── tests/                  # Test files
└── deploy/                 # Deployment configuration
```

## API Endpoints

- `GET /api/status` - System status and statistics
- `POST /api/config` - Update configuration
- `POST /api/products` - Add new product to monitor
- `GET /api/logs` - Recent log entries
- `POST /api/manual-check` - Trigger manual check

## Troubleshooting

### Common Issues

1. **Login Failures**: Verify selectors match the website structure
2. **Product Not Found**: Check product URL and stock selector
3. **Order Failures**: Verify checkout flow selectors
4. **Email Issues**: Confirm SMTP settings and App Password

### Debug Mode

Run with debug logging:
```bash
NODE_ENV=development npm start
```

### Heroku Logs

View application logs:
```bash
heroku logs --tail -a your-app-name
```

## Support

For issues and feature requests, please create an issue in the GitHub repository.

## License

This project is licensed under the MIT License - see the LICENSE file for details.