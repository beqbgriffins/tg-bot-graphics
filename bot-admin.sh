#!/bin/bash

# Bot Administration Script
# Make this executable with: chmod +x bot-admin.sh

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PM2_APP_NAME="telegram-data-graph-bot"

# Function to display help
function show_help {
  echo -e "${BLUE}Telegram Bot Administration Script${NC}"
  echo -e "${YELLOW}Usage:${NC}"
  echo -e "  ./bot-admin.sh [command]"
  echo -e ""
  echo -e "${YELLOW}Available commands:${NC}"
  echo -e "  ${GREEN}status${NC}    - Show bot status"
  echo -e "  ${GREEN}logs${NC}      - Show bot logs (press Ctrl+C to exit)"
  echo -e "  ${GREEN}restart${NC}   - Restart the bot"
  echo -e "  ${GREEN}stop${NC}      - Stop the bot"
  echo -e "  ${GREEN}start${NC}     - Start the bot if it's stopped"
  echo -e "  ${GREEN}env${NC}       - Edit the .env configuration file"
  echo -e "  ${GREEN}update${NC}    - Pull latest changes from GitHub and restart"
  echo -e "  ${GREEN}monitor${NC}   - Show PM2 monitoring dashboard"
  echo -e "  ${GREEN}help${NC}      - Show this help message"
}

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}PM2 is not installed. Please run the deploy script first.${NC}"
    exit 1
fi

# Handle commands
case "$1" in
  status)
    echo -e "${YELLOW}Bot Status:${NC}"
    pm2 info "$PM2_APP_NAME"
    ;;
    
  logs)
    echo -e "${YELLOW}Bot Logs (Ctrl+C to exit):${NC}"
    pm2 logs "$PM2_APP_NAME"
    ;;
    
  restart)
    echo -e "${YELLOW}Restarting Bot...${NC}"
    pm2 restart "$PM2_APP_NAME"
    ;;
    
  stop)
    echo -e "${YELLOW}Stopping Bot...${NC}"
    pm2 stop "$PM2_APP_NAME"
    ;;
    
  start)
    echo -e "${YELLOW}Starting Bot...${NC}"
    pm2 start "$PM2_APP_NAME"
    ;;
    
  env)
    echo -e "${YELLOW}Opening .env file for editing...${NC}"
    if command -v nano &> /dev/null; then
      nano ".env"
    else
      vi ".env"
    fi
    echo -e "${GREEN}Don't forget to restart the bot to apply changes:${NC} ./bot-admin.sh restart"
    ;;
    
  update)
    echo -e "${YELLOW}Updating Bot from GitHub...${NC}"
    git pull
    npm install
    npm run build
    pm2 restart "$PM2_APP_NAME"
    echo -e "${GREEN}Bot updated and restarted!${NC}"
    ;;
    
  monitor)
    echo -e "${YELLOW}Opening PM2 Monitoring Dashboard (Ctrl+C to exit):${NC}"
    pm2 monit
    ;;
    
  help|*)
    show_help
    ;;
esac
