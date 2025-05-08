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
- Individual metric charts with enlargement on click
- Custom metric groups with persistent names
- Data management with selective deletion capabilities
- Timeline charts with automatic date formatting
- Interactive legend to toggle metrics on/off
- Responsive design works on mobile and desktop
- Data table with chronological sorting and data deletion
- Auto-refresh with latest measurements

### Data Management
- Delete individual data points from the data table
- "Delete All Data" button to clear all stored data
- Create and manage custom metric groups
- Persistent storage maintains data between server restarts

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

### Web Interface Features

After accessing your personal chart URL from the `/chart` command, you can:

1. **View Individual Metrics**: 
   - See separate charts for each metric
   - Click on any chart to enlarge it for better visibility
   - Click outside the enlarged chart to return to the overview

2. **Create Metric Groups**:
   - Combine related metrics into named groups
   - Group names persist between sessions
   - View group charts to see related metrics together

3. **Manage Your Data**:
   - View all data points in a chronological table
   - Delete individual data points as needed
   - Use the "Delete All Data" button to clear everything

## Technical Details

- **Backend**: TypeScript, Express, Node.js
- **Bot Framework**: Telegraf
- **Visualization**: Chart.js, node-canvas
- **Security**: Crypto-based token system for user authentication
- **Storage**: Persistent file-based storage with user separation
- **Session Management**: Limited token storage (last 3 per user)

## Deployment

See `DEPLOYMENT.md` for detailed instructions on deploying to a DigitalOcean VPS.

Administration scripts are included:
- `deploy.sh` - Initial setup and deployment
- `bot-admin.sh` - Day-to-day management

## Recent Improvements

- **Chart Enlargement**: Click on any individual metric chart to get an enlarged view
- **Data Management**: Delete individual data points or all data from the web interface
- **Persistent Groups**: Named metric groups that maintain their names between sessions
- **Improved Storage**: Data persistence across server restarts
- **Session Management**: Optimized token storage (keeping only last 3 per user)
- **Better Error Handling**: Improved timestamp and data format handling
- **Enhanced UI**: More intuitive interface with clear user instructions

## License

MIT
