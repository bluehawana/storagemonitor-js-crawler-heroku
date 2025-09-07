# Manual Heroku Deployment Steps

Since the automated script had issues, let's deploy manually:

## Step 1: Login to Heroku
```bash
heroku login
```
This will open your browser to login.

## Step 2: Create the App
```bash
heroku apps:create mepiform-auto-$(date +%s) --region eu
```

## Step 3: Set Up Buildpacks
```bash
heroku buildpacks:add https://github.com/microsoft/playwright-heroku-buildpack
heroku buildpacks:add heroku/nodejs
```

## Step 4: Set Environment Variables
Replace `your-password-here` with your actual Oriola4Care password:

```bash
heroku config:set \
  NODE_ENV=production \
  TZ=Europe/Stockholm \
  MEPIFORM_USERNAME=tipsboden@hotmail.com \
  MEPIFORM_PASSWORD="your-password-here" \
  HEROKU_MODE=true \
  HEADLESS_MODE=true \
  AUTO_START=true
```

## Step 5: Prepare Deployment Files
```bash
cp Procfile.mepiform Procfile
cp app-mepiform.json app.json
```

## Step 6: Deploy
```bash
git add .
git commit -m "Deploy MEPIFORM to Heroku"
git push heroku main
```

## Step 7: Open Your App
```bash
heroku open
```

Your app will be running and will automatically start the automation at 07:00 Swedish time on weekdays!