# Telegram Data Graph Bot

A Telegram bot that processes messages containing measurement data and visualizes it as an interactive timeline graph with user-specific privacy.

## Features

### Multiple Input Formats
- **Format with dash**: `key - value` (e.g., "Weight - 75.3")
- **Format with space**: `key value` (e.g., "Weight 75.3")
- **Number formats**: Supports both dot (75.3) and comma (75,3) decimal separators
- **Multiple measurements**: Process multiple metrics per message

### Historical Data
- Add dates to record historical measurements with format `DATE: YYYY-MM-DD`
- Supports various date formats including European style (DD.MM.YYYY)
- Chart automatically displays historical progression

### User Privacy
- Each user gets their own private data store
- Data sent by one user is never visible to other users
- Secure token-based access to personal dashboards
- Private chart URLs that only display user-specific data

### Interactive Visualization
- Timeline charts with automatic date formatting
- Interactive legend to toggle metrics on/off
- Responsive design works on mobile and desktop
- Data table with chronological sorting
- Auto-refresh with latest measurements

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   PORT=3000
   HOST=http://your_server_hostname:3000
   ```
   - To get a Telegram bot token, talk to [@BotFather](https://t.me/BotFather) on Telegram
   - The HOST should be the publicly accessible URL of your server

4. Build the TypeScript code:
   ```
   npm run build
   ```

5. Run the bot:
   ```
   npm start
   ```

## Development

For development with auto-reload:
```
npm run dev
```

## Usage Examples

### Adding Measurements

Send measurements in any of these formats:

```
# Format with dash
Weight - 75.3
Chest - 117.8
Biceps - 41.9

# Format with space
Weight 75.3
Chest 117.8
Biceps 41.9

# With comma decimal separator
Weight 75,3
Chest 117,8
Biceps 41,9

# Historical data (with date)
DATE: 2023-05-15
Weight 75.3
Chest 117.8
Biceps 41.9

# European date format
DATE: 15.05.2023
Weight 75.3
Chest 117.8
```

### Commands

- `/start` - Get introduction and instructions
- `/help` - Show help information
- `/chart` - Get your personal chart URL
- `/clear` - Clear all your stored data

## Technical Details

- **Backend**: TypeScript, Express, Node.js
- **Bot Framework**: Telegraf
- **Visualization**: Chart.js, node-canvas
- **Security**: Crypto-based token system for user authentication
- **Storage**: In-memory data storage with user separation

## Deployment

See `DEPLOYMENT.md` for detailed instructions on deploying to a DigitalOcean VPS.

Administration scripts are included:
- `deploy.sh` - Initial setup and deployment
- `bot-admin.sh` - Day-to-day management

## License

MIT
