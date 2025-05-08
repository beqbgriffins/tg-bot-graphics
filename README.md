# Telegram Data Graph Bot

A Telegram bot that processes messages containing key-value pairs and visualizes the data as a timeline graph.

## Features

- Parses messages in the format: `"key1" - value1, "key2" - value2, ...`
- Stores values with timestamps for each key
- Generates timeline visualizations of the data
- Provides a web view of the chart that auto-refreshes
- Supports multiple data series in a single chart

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
   - The HOST should be the publicly accessible URL of your server, or use ngrok for local development

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

## Usage

1. Start a chat with your bot on Telegram
2. Send a message in the format: `"key1" - value1, "key2" - value2, ...`
   - Example: `"temperature" - 25, "humidity" - 60`
3. The bot will respond with a URL to view the timeline chart
4. Use `/chart` command to get the chart URL at any time
5. Use `/clear` command to clear all stored data
6. Use `/help` to see usage instructions

## Technical Details

- Built with TypeScript, Express, Chart.js, and node-canvas
- Uses Telegraf framework for Telegram bot functionality
- In-memory data storage (data is lost when the bot restarts)
- Server-side chart rendering using Canvas

## License

MIT
