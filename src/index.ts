import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { parseMessage } from './utils/parser';
import { dataService } from './services/dataService';
import { Server } from './server';

// Load environment variables
dotenv.config();

// Check for required environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || 'http://localhost:3000';

if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN is required in the .env file');
  process.exit(1);
}

// Start the web server
const server = new Server(PORT, HOST);
server.start();

// Create the bot
const bot = new Telegraf(BOT_TOKEN);

// Welcome message
bot.start((ctx) => {
  ctx.reply(
    'Welcome to the Data Graph Bot!\n\n' +
    'Send me data in the format:\n' +
    '"key1" - value1, "key2" - value2, ...\n\n' +
    'Example: "temperature" - 25, "humidity" - 60\n\n' +
    'I will create a timeline graph for your data.'
  );
});

// Help command
bot.help((ctx) => {
  ctx.reply(
    'How to use the Data Graph Bot:\n\n' +
    '1. Send data in the format:\n' +
    '"key1" - value1, "key2" - value2, ...\n\n' +
    'Example: "temperature" - 25, "humidity" - 60\n\n' +
    '2. I will store your data and plot it on a timeline.\n\n' +
    'Commands:\n' +
    '/chart - Get the latest chart URL\n' +
    '/clear - Clear all stored data\n' +
    '/help - Show this help message'
  );
});

// Chart command
bot.command('chart', (ctx) => {
  const data = dataService.getAllData();
  
  if (data.length === 0) {
    ctx.reply('No data available yet. Send me some data first!');
    return;
  }
  
  ctx.reply(`You can view the chart here: ${server.getChartUrl()}`);
});

// Clear command
bot.command('clear', (ctx) => {
  dataService.clearData();
  ctx.reply('All data has been cleared.');
});

// Handle incoming messages
bot.on(message('text'), (ctx) => {
  try {
    const text = ctx.message.text;
    
    // Skip if it's a command
    if (text.startsWith('/')) {
      return;
    }
    
    // Parse the message
    const parsedData = parseMessage(text);
    
    if (parsedData.length === 0) {
      ctx.reply('No valid data found in your message. Please check the format.');
      return;
    }
    
    // Store the data
    dataService.addData(parsedData);
    
    // Generate response
    const keys = parsedData.map(item => `"${item.key}"`).join(', ');
    ctx.reply(
      `✅ Received data for ${keys}.\n\n` +
      `View the updated chart: ${server.getChartUrl()}`
    );
  } catch (error) {
    console.error('Error processing message:', error);
    ctx.reply(
      'Error processing your message. Please ensure it follows the format:\n' +
      '"key1" - value1, "key2" - value2, ...\n\n' +
      'Example: "temperature" - 25, "humidity" - 60'
    );
  }
});

// Launch the bot
bot.launch().then(() => {
  console.log('Bot is running!');
}).catch((err) => {
  console.error('Error starting the bot:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
