#!/bin/bash

echo "🚀 Deploying Oriola4Care Health Monitor to Heroku..."

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Please install it first:"
    echo "   https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Check if logged in to Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "🔐 Please login to Heroku first:"
    heroku login
fi

# Get app name from user
read -p "Enter your Heroku app name (or press Enter for auto-generated): " APP_NAME

# Create Heroku app
if [ -z "$APP_NAME" ]; then
    echo "📱 Creating Heroku app with auto-generated name..."
    heroku create
else
    echo "📱 Creating Heroku app: $APP_NAME"
    heroku create $APP_NAME
fi

# Get the actual app name (in case it was auto-generated)
ACTUAL_APP_NAME=$(heroku apps:info --json | grep -o '"name":"[^"]*' | cut -d'"' -f4)
echo "✅ App created: $ACTUAL_APP_NAME"

# Set environment variables
echo "⚙️  Setting environment variables..."

# Load from .env file if it exists
if [ -f .env ]; then
    echo "📄 Loading variables from .env file..."
    
    # Read .env and set Heroku config vars
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        if [[ $key =~ ^[[:space:]]*# ]] || [[ -z $key ]]; then
            continue
        fi
        
        # Remove quotes from value if present
        value=$(echo $value | sed 's/^"//;s/"$//')
        
        echo "   Setting $key..."
        heroku config:set "$key=$value" --app $ACTUAL_APP_NAME
    done < .env
else
    echo "⚠️  No .env file found. You'll need to set environment variables manually:"
    echo "   heroku config:set USERNAME=your-email@example.com"
    echo "   heroku config:set PASSWORD=your-password"
    echo "   (see heroku-setup.md for complete list)"
fi

# Initialize git if not already done
if [ ! -d .git ]; then
    echo "📦 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit for Heroku deployment"
fi

# Add Heroku remote
echo "🔗 Adding Heroku remote..."
heroku git:remote -a $ACTUAL_APP_NAME

# Deploy to Heroku
echo "🚀 Deploying to Heroku..."
git add .
git commit -m "Deploy to Heroku" || echo "No changes to commit"
git push heroku main

# Scale the application
echo "📈 Scaling application..."
heroku ps:scale web=1 --app $ACTUAL_APP_NAME

# Show app info
echo ""
echo "🎉 Deployment complete!"
echo "📱 App Name: $ACTUAL_APP_NAME"
echo "🌐 URL: https://$ACTUAL_APP_NAME.herokuapp.com"
echo ""
echo "📊 Check status:"
echo "   heroku logs --tail --app $ACTUAL_APP_NAME"
echo "   heroku ps --app $ACTUAL_APP_NAME"
echo ""
echo "🔧 Useful commands:"
echo "   heroku config --app $ACTUAL_APP_NAME  # View environment variables"
echo "   heroku restart --app $ACTUAL_APP_NAME  # Restart application"
echo "   heroku open --app $ACTUAL_APP_NAME     # Open in browser"

# Open the app
read -p "Open the app in browser? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    heroku open --app $ACTUAL_APP_NAME
fi

echo "✅ Deployment script completed!"
echo "📖 See heroku-setup.md for detailed configuration instructions"