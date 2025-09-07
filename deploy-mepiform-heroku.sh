#!/bin/bash

# MEPIFORM Heroku Deployment Script
echo "🚀 MEPIFORM Heroku Deployment Starting..."

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Please install it first:"
    echo "   https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Check if logged in to Heroku
heroku auth:whoami &> /dev/null
if [ $? -ne 0 ]; then
    echo "🔐 Please log in to Heroku first:"
    heroku auth:login
fi

# Get app name
read -p "Enter Heroku app name (or press Enter for 'mepiform-automation'): " APP_NAME
APP_NAME=${APP_NAME:-mepiform-automation}

# Check if app exists
if heroku apps:info $APP_NAME &> /dev/null; then
    echo "📱 App '$APP_NAME' exists. Using existing app."
else
    echo "🏗️  Creating new Heroku app: $APP_NAME"
    heroku apps:create $APP_NAME --region eu
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create app. Trying with random name..."
        heroku apps:create --region eu
        APP_NAME=$(heroku apps:info --json | jq -r '.name')
        echo "✅ Created app: $APP_NAME"
    fi
fi

echo "📦 Setting up buildpacks..."
heroku buildpacks:clear --app $APP_NAME
heroku buildpacks:add https://github.com/microsoft/playwright-heroku-buildpack --app $APP_NAME
heroku buildpacks:add heroku/nodejs --app $APP_NAME

# Get password securely
echo "🔑 Setting up credentials..."
read -s -p "Enter Oriola4Care password: " MEPIFORM_PASSWORD
echo ""

# Set environment variables
echo "⚙️  Configuring environment variables..."
heroku config:set \
  NODE_ENV=production \
  TZ=Europe/Stockholm \
  MEPIFORM_USERNAME=tipsboden@hotmail.com \
  MEPIFORM_PASSWORD="$MEPIFORM_PASSWORD" \
  AUTO_START=true \
  HEADLESS_MODE=true \
  HEROKU_MODE=true \
  MAX_MEMORY=512 \
  --app $APP_NAME

# Copy correct files for deployment
echo "📁 Preparing deployment files..."
cp Procfile.mepiform Procfile
cp app-mepiform.json app.json

# Add and commit files
echo "📤 Preparing Git repository..."
git add .
git commit -m "Deploy MEPIFORM automation to Heroku - $(date)" || echo "No changes to commit"

# Check if heroku remote exists
if ! git remote | grep -q heroku; then
    heroku git:remote --app $APP_NAME
fi

# Deploy to Heroku
echo "🚀 Deploying to Heroku..."
git push heroku main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    echo "=========================="
    echo "🌐 App URL: https://$APP_NAME.herokuapp.com"
    echo "📊 Dashboard: https://$APP_NAME.herokuapp.com"
    echo "🔧 Health Check: https://$APP_NAME.herokuapp.com/health"
    echo ""
    echo "📋 Management Commands:"
    echo "heroku logs --tail --app $APP_NAME          # View logs"
    echo "heroku ps --app $APP_NAME                   # Check processes"
    echo "heroku restart --app $APP_NAME              # Restart app"
    echo ""
    echo "🤖 Automation will start automatically during Swedish business hours (07:00-18:00 Mon-Fri)"
    echo "⏰ Next start time will be tomorrow at 07:00 if deployed after hours"
    echo ""
    echo "🔗 Opening app in browser..."
    heroku open --app $APP_NAME
else
    echo "❌ Deployment failed! Check the logs:"
    heroku logs --tail --app $APP_NAME
fi

# Cleanup
rm -f Procfile app.json