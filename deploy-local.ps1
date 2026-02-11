# Local Deployment Script for Telegram Helpdesk Bot
# This script helps deploy the bot on your local Windows machine using PM2

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Telegram Helpdesk Bot - Local Deployment" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js is installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check if .env file exists
Write-Host ""
Write-Host "Checking .env configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✓ .env file found" -ForegroundColor Green
} else {
    Write-Host "✗ .env file not found!" -ForegroundColor Red
    Write-Host "Please create .env file with your configuration" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Check if PM2 is installed
Write-Host ""
Write-Host "Checking PM2 installation..." -ForegroundColor Yellow
try {
    $pm2Version = pm2 --version
    Write-Host "✓ PM2 is installed: $pm2Version" -ForegroundColor Green
} catch {
    Write-Host "PM2 not found. Installing PM2..." -ForegroundColor Yellow
    npm install -g pm2
    npm install -g pm2-windows-startup
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ PM2 installed successfully" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "Configuring PM2 for Windows startup..." -ForegroundColor Yellow
        pm2-startup install
        
        Write-Host "✓ PM2 configured for Windows startup" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to install PM2" -ForegroundColor Red
        exit 1
    }
}

# Create data directory if it doesn't exist
Write-Host ""
Write-Host "Creating data directory..." -ForegroundColor Yellow
if (-not (Test-Path "data")) {
    New-Item -ItemType Directory -Path "data" | Out-Null
    Write-Host "✓ Data directory created" -ForegroundColor Green
} else {
    Write-Host "✓ Data directory already exists" -ForegroundColor Green
}

# Ask user if they want to start with PM2
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Ready to deploy!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Choose deployment option:" -ForegroundColor Yellow
Write-Host "1. Start with PM2 (production - runs in background)" -ForegroundColor White
Write-Host "2. Start normally (development - runs in foreground)" -ForegroundColor White
Write-Host "3. Exit (I'll start it manually later)" -ForegroundColor White
Write-Host ""
$choice = Read-Host "Enter your choice (1-3)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Starting bot with PM2..." -ForegroundColor Yellow
        
        # Stop existing instance if running
        pm2 delete helpdesk-bot 2>$null
        
        # Start with PM2
        pm2 start server.js --name helpdesk-bot
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Bot started successfully with PM2" -ForegroundColor Green
            
            # Save PM2 process list
            pm2 save
            
            Write-Host ""
            Write-Host "================================================" -ForegroundColor Cyan
            Write-Host "Deployment Complete!" -ForegroundColor Green
            Write-Host "================================================" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Useful commands:" -ForegroundColor Yellow
            Write-Host "  pm2 status              - View bot status" -ForegroundColor White
            Write-Host "  pm2 logs helpdesk-bot   - View logs" -ForegroundColor White
            Write-Host "  pm2 restart helpdesk-bot - Restart bot" -ForegroundColor White
            Write-Host "  pm2 stop helpdesk-bot   - Stop bot" -ForegroundColor White
            Write-Host "  pm2 monit               - Real-time monitoring" -ForegroundColor White
            Write-Host ""
            
            # Show current status
            pm2 status
        } else {
            Write-Host "✗ Failed to start bot" -ForegroundColor Red
            exit 1
        }
    }
    "2" {
        Write-Host ""
        Write-Host "Starting bot in foreground..." -ForegroundColor Yellow
        Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
        Write-Host ""
        npm start
    }
    "3" {
        Write-Host ""
        Write-Host "Deployment preparation complete!" -ForegroundColor Green
        Write-Host "To start the bot later, run:" -ForegroundColor Yellow
        Write-Host "  pm2 start server.js --name helpdesk-bot" -ForegroundColor White
        Write-Host "  OR" -ForegroundColor White
        Write-Host "  npm start" -ForegroundColor White
    }
    default {
        Write-Host ""
        Write-Host "Invalid choice. Exiting..." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Don't forget to:" -ForegroundColor Yellow
Write-Host "1. Start ngrok if you don't have a public IP: ngrok http 3000" -ForegroundColor White
Write-Host "2. Update WEBHOOK_URL in .env with your ngrok/public URL" -ForegroundColor White
Write-Host "3. Test the bot by sending a message on Telegram" -ForegroundColor White
Write-Host ""
