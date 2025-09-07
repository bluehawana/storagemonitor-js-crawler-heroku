# MEPIFORM Heroku Deployment Guide

## Prerequisites ✅
- Heroku CLI installed (you have this)
- Git repository initialized  
- Oriola4Care password ready

## Quick Deployment Steps

### 1. Login to Heroku
```bash
heroku auth:login
```

### 2. Run Automated Deployment
```bash
./deploy-mepiform-heroku.sh
```

The script will:
- Create a new Heroku app (or use existing one)
- Set up Playwright buildpack for browser automation
- Configure environment variables
- Deploy the application
- Set Swedish timezone (Europe/Stockholm)

### 3. Manual Deployment (Alternative)

If the script doesn't work, deploy manually:

```bash
# Create app
heroku apps:create your-mepiform-app --region eu

# Add buildpacks
heroku buildpacks:add https://github.com/microsoft/playwright-heroku-buildpack
heroku buildpacks:add heroku/nodejs

# Set environment variables
heroku config:set \
  NODE_ENV=production \
  TZ=Europe/Stockholm \
  MEPIFORM_USERNAME=tipsboden@hotmail.com \
  MEPIFORM_PASSWORD="your-password-here" \
  HEROKU_MODE=true \
  HEADLESS_MODE=true

# Deploy
cp Procfile.mepiform Procfile
cp app-mepiform.json app.json
git add .
git commit -m "Deploy MEPIFORM to Heroku"
heroku git:remote -a your-mepiform-app
git push heroku main
```

## After Deployment

### Monitor the App
```bash
# View logs
heroku logs --tail -a your-app-name

# Check app status  
heroku ps -a your-app-name

# Open dashboard
heroku open -a your-app-name
```

### App URLs
- **Dashboard**: `https://your-app-name.herokuapp.com`
- **Health Check**: `https://your-app-name.herokuapp.com/health`
- **Start Automation**: `https://your-app-name.herokuapp.com/start-automation`

## Automation Schedule

The system automatically:
- ✅ Starts at **07:00 Swedish time** (Mon-Fri)  
- ✅ Stops at **18:00 Swedish time** (Mon-Fri)
- ✅ Skips weekends and Swedish holidays
- ✅ Restarts if crashes during work hours

## Expected Timeline

**If deployed today:**
- System will be idle until tomorrow 07:00 
- First automation run: **Next business day at 07:00**
- Products will be monitored and ordered according to strategy

## Monitoring

Check the dashboard at your Heroku app URL to see:
- System status (Active/Idle)
- Product availability 
- Today's orders
- Success notifications
- Real-time logs

## Troubleshooting

### App won't start:
```bash
heroku logs --tail -a your-app-name
```

### Password issues:
```bash
heroku config:set MEPIFORM_PASSWORD="new-password" -a your-app-name
heroku restart -a your-app-name
```

### Memory issues:
```bash
heroku ps:scale web=1:standard-1x -a your-app-name
```

## Cost Estimate

- **Basic Dyno**: $7/month
- **Standard-1x** (recommended): $25/month
- **Data transfer**: ~$0 (minimal)

## Security Notes

- Password stored securely in Heroku environment variables
- All automation runs in secure Heroku environment  
- Browser runs in headless mode for security
- No sensitive data logged or exposed

---

**Ready to deploy?** Run `./deploy-mepiform-heroku.sh` and follow the prompts!