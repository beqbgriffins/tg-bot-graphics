# Deploying the Telegram Data Graph Bot to DigitalOcean

This guide provides detailed steps for deploying your Telegram bot to a DigitalOcean Droplet.

## Prerequisites

1. A DigitalOcean account
2. A Telegram bot token from [@BotFather](https://t.me/BotFather)
3. Basic knowledge of Linux command line

## Step 1: Create a DigitalOcean Droplet

1. Log in to your DigitalOcean account
2. Click "Create" → "Droplets"
3. Choose an image: **Ubuntu 22.04 LTS**
4. Select a plan: The **Basic Plan** ($5/month) is sufficient for this bot
5. Choose a datacenter region close to your target users
6. Add your SSH key or set a root password
7. Name your droplet (e.g., `telegram-bot-server`)
8. Click "Create Droplet"

## Step 2: Connect to Your Droplet

Connect using SSH:

```bash
ssh root@your_droplet_ip
```

## Step 3: Basic Server Setup

Update your system and install essential packages:

```bash
# Update package lists
apt update

# Upgrade installed packages
apt upgrade -y

# Install essential dependencies
apt install -y git build-essential libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev librsvg2-dev
```

## Step 4: Install Node.js

```bash
# Install Node.js version management
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js LTS
nvm install --lts

# Set as default
nvm use --lts

# Verify installation
node -v
npm -v

# Install PM2 globally
npm install -g pm2
```

## Step 5: Create a Non-Root User (Recommended)

```bash
# Create a new user
adduser botuser

# Add user to sudo group
usermod -aG sudo botuser

# Switch to the new user
su - botuser
```

## Step 6: Clone and Deploy the Bot

1. Create a directory for your application:

```bash
mkdir -p ~/apps
cd ~/apps
```

2. Clone the repository:

```bash
git clone https://github.com/beqbgriffins/tg-bot-graphics.git
cd tg-bot-graphics
```

3. Make the deployment script executable:

```bash
chmod +x deploy.sh
```

4. Run the deployment script:

```bash
./deploy.sh
```

5. The script will:
   - Install dependencies
   - Build the project
   - Create a template `.env` file if one doesn't exist
   - Start the bot with PM2

6. Edit the `.env` file with your Telegram bot token:

```bash
nano .env
```

Update the following values:
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
PORT=3000
HOST=http://your_droplet_ip:3000
```

7. Restart the bot to apply the changes:

```bash
pm2 restart telegram-data-graph-bot
```

## Step 7: Ensure PM2 Starts on Boot

Follow the instructions printed by the deployment script to set up PM2 to start on system boot. It will be a command like:

```bash
sudo env PATH=$PATH:/home/botuser/.nvm/versions/node/v16.x.x/bin pm2 startup systemd -u botuser --hp /home/botuser
```

After running that command, save the PM2 process list:

```bash
pm2 save
```

## Step 8: Configure Firewall (Optional but Recommended)

```bash
# Allow SSH and HTTP
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow 3000

# Enable firewall
sudo ufw enable
```

## Step 9: Bot Administration

Make the admin script executable:

```bash
chmod +x bot-admin.sh
```

Use the script to manage your bot:

```bash
# Show status
./bot-admin.sh status

# View logs
./bot-admin.sh logs

# Restart the bot
./bot-admin.sh restart

# Update from GitHub
./bot-admin.sh update

# Edit environment variables
./bot-admin.sh env

# Show monitoring dashboard
./bot-admin.sh monitor
```

## Step 10: Set Up Nginx (Optional but Recommended)

If you want to use HTTPS or hide the port number:

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/telegram-bot
```

Add this configuration (replace with your droplet's IP or domain):

```nginx
server {
    listen 80;
    server_name your_droplet_ip_or_domain;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the configuration:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/telegram-bot /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

If you have a domain name, set up HTTPS with Let's Encrypt:

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Set up SSL
sudo certbot --nginx -d your_domain.com
```

## Troubleshooting

If your bot isn't working:

1. Check logs: `./bot-admin.sh logs`
2. Verify environment variables: `./bot-admin.sh env`
3. Make sure port 3000 is accessible: `curl http://localhost:3000/view`
4. Check if the process is running: `./bot-admin.sh status`
5. Make sure your Telegram bot token is correct

## Updating the Bot

To update when you push new changes to GitHub:

```bash
./bot-admin.sh update
```

This will pull the latest code, install any new dependencies, rebuild the project, and restart the bot.
