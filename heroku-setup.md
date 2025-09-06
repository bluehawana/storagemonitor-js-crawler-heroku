# Heroku Deployment Guide for Oriola4Care Health Monitor

## Prerequisites
1. Heroku CLI installed
2. Git repository initialized
3. Heroku account created

## Deployment Steps

### 1. Create Heroku App
```bash
heroku create your-app-name-here
```

### 2. Set Environment Variables
```bash
# Login credentials
heroku config:set LOGIN_URL=https://oriola4care.oriola-kd.com/login
heroku config:set USERNAME=your-email@example.com
heroku config:set PASSWORD=your-password

# Website configuration
heroku config:set TARGET_WEBSITE_URL=https://oriola4care.oriola-kd.com
heroku config:set USERNAME_SELECTOR=#j_username
heroku config:set PASSWORD_SELECTOR=#j_password
heroku config:set LOGIN_BUTTON_SELECTOR="button[type=\"submit\"]"
heroku config:set LOGIN_SUCCESS_SELECTOR=".logout, .dashboard, .account-info"
heroku config:set STOCK_SELECTOR=".stock-status, .availability, .in-stock, .lagerstatus"

# Monitoring settings
heroku config:set ACTIVE_START_HOUR=7
heroku config:set ACTIVE_END_HOUR=19
heroku config:set TIMEZONE=Europe/Stockholm

# Order configuration
heroku config:set AUTO_ORDER_ENABLED=true
heroku config:set MAX_ORDER_AMOUNT=500
heroku config:set QUANTITY_PER_ORDER=1

# Notifications (optional)
heroku config:set NOTIFICATION_EMAIL=your-email@example.com
heroku config:set SMTP_HOST=smtp.gmail.com
heroku config:set SMTP_PORT=587
heroku config:set SMTP_USER=your-email@example.com
heroku config:set SMTP_PASS=your-app-password

# Security
heroku config:set JWT_SECRET=$(openssl rand -base64 32)
heroku config:set ENCRYPT_KEY=$(openssl rand -base64 32)
```

### 3. Deploy to Heroku
```bash
git add .
git commit -m "Initial deployment"
git push heroku main
```

### 4. Scale the Application
```bash
heroku ps:scale web=1
```

### 5. View Logs
```bash
heroku logs --tail
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `LOGIN_URL` | Oriola4Care login page | `https://oriola4care.oriola-kd.com/login` |
| `USERNAME` | Your account email | `your-email@example.com` |
| `PASSWORD` | Your account password | `your-password` |
| `ACTIVE_START_HOUR` | Start monitoring hour (24h format) | `7` |
| `ACTIVE_END_HOUR` | Stop monitoring hour (24h format) | `19` |
| `TIMEZONE` | Timezone for scheduling | `Europe/Stockholm` |
| `AUTO_ORDER_ENABLED` | Enable automatic ordering | `true` |
| `MAX_ORDER_AMOUNT` | Maximum order amount in SEK | `500` |

## API Endpoints

Once deployed, your app will have these endpoints:

- `GET /` - Application status
- `GET /status` - Monitoring service status
- `GET /products` - List monitored products
- `POST /check-now` - Manual product check
- `GET /logs` - View monitoring logs
- `GET /orders` - View order history
- `GET /health` - Health check for Heroku

## Monitoring Schedule

The system runs automatically:
- **Active Hours**: 7 AM - 7 PM Swedish time
- **Check Frequency**: Every 5 minutes during active hours
- **Days**: Monday - Friday only
- **Passive Hours**: Every hour during off-hours

## How It Works

1. **Product Monitoring**: System checks search pages for your products every 5 minutes
2. **Stock Detection**: When products come back in stock, they appear as proper product pages
3. **Automatic Ordering**: Orders are placed automatically when stock is detected
4. **Notifications**: Email alerts sent for successful orders (if configured)

## Troubleshooting

### Check Application Status
```bash
heroku ps
```

### View Recent Logs
```bash
heroku logs --tail
```

### Restart Application
```bash
heroku restart
```

### Check Environment Variables
```bash
heroku config
```

### Manual Product Check
Visit: `https://your-app-name.herokuapp.com/check-now` (POST request)

## Security Notes

- Never commit credentials to git
- Use Heroku config vars for sensitive data
- Monitor your order limits to avoid unexpected charges
- Test thoroughly before enabling auto-ordering

## Support

If you encounter issues:
1. Check Heroku logs for errors
2. Verify environment variables are set correctly
3. Test login credentials manually
4. Check Oriola4Care website availability