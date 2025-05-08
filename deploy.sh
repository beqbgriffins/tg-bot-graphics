#!/bin/bash

# Telegram Bot Deployment Script for DigitalOcean VPS
# Make this file executable with: chmod +x deploy.sh

# Configuration
APP_DIR="/home/botuser/apps/tg-bot-graphics"
PM2_APP_NAME="telegram-data-graph-bot"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting deployment...${NC}"

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}Application directory does not exist.${NC}"
    echo -e "${YELLOW}Creating directory and cloning repository...${NC}"
    mkdir -p "$APP_DIR"
    git clone https://github.com/beqbgriffins/tg-bot-graphics.git "$APP_DIR"
else
    # Update the existing repo
    echo -e "${YELLOW}Updating repository...${NC}"
    cd "$APP_DIR" || { echo -e "${RED}Failed to change directory to $APP_DIR${NC}"; exit 1; }
    git pull
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$APP_DIR" || { echo -e "${RED}Failed to change directory to $APP_DIR${NC}"; exit 1; }
npm install

# Build the project
echo -e "${YELLOW}Building project...${NC}"
npm run build

# Check if .env file exists
if [ ! -f "$APP_DIR/.env" ]; then
    echo -e "${RED}.env file not found. Creating template...${NC}"
    echo "TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here" > "$APP_DIR/.env"
    echo "PORT=3000" >> "$APP_DIR/.env"
    echo "HOST=http://your_server_ip:3000" >> "$APP_DIR/.env"
    
    echo -e "${RED}Please edit the .env file with your actual values and then restart the bot.${NC}"
    echo -e "${YELLOW}You can edit it with: nano $APP_DIR/.env${NC}"
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 not found. Installing globally...${NC}"
    npm install -g pm2
fi

# Start or restart the app with PM2
if pm2 list | grep -q "$PM2_APP_NAME"; then
    echo -e "${YELLOW}Restarting application with PM2...${NC}"
    pm2 restart "$PM2_APP_NAME"
else
    echo -e "${YELLOW}Starting application with PM2 for the first time...${NC}"
    pm2 start dist/index.js --name "$PM2_APP_NAME"
    
    # Save PM2 configuration
    echo -e "${YELLOW}Saving PM2 configuration...${NC}"
    pm2 save
    
    # Setup PM2 to start on system boot (displays command to run)
    echo -e "${YELLOW}To setup PM2 for startup, run the following command:${NC}"
    echo -e "${GREEN}$(pm2 startup | tail -1)${NC}"
fi

echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}Your bot should now be running.${NC}"
