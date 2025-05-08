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
    'Send me data in one of these formats:\n\n' +
    '1. With dash:\n' +
    'key1 - value1\n' + 
    'key2 - value2\n\n' +
    '2. Just space:\n' +
    'key1 value1\n' + 
    'key2 value2\n\n' +
    'Numbers can use either dot (75.3) or comma (75,3) as decimal separator.\n\n' +
    'For historical data, include a date at the beginning:\n' +
    'DATE: YYYY-MM-DD\n' +
    'key1 value1\n' +
    'key2 value2\n\n' +
    'I will create a timeline graph for your data.'
  );
});

// Help command
bot.help((ctx) => {
  ctx.reply(
    'How to use the Data Graph Bot:\n\n' +
    '1. Send data in one of these formats:\n\n' +
    'Format 1 (with dash):\n' +
    'key1 - value1\n' +
    'key2 - value2\n\n' +
    'Format 2 (just space):\n' +
    'key1 value1\n' +
    'key2 value2\n\n' +
    'You can use either dot or comma as decimal separator:\n' +
    'Вес 75.3 or Вес 75,3\n\n' +
    '2. For historical data, add a date at the beginning:\n' +
    'DATE: YYYY-MM-DD\n' +
    'key1 value1\n' +
    'key2 value2\n\n' +
    'Or with DD.MM.YYYY format:\n' +
    'DATE: DD.MM.YYYY\n' +
    'key1 value1\n\n' +
    '3. I will store your data and plot it on a timeline.\n\n' +
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
    
    // Check if this was historical data
    const hasHistoricalData = parsedData.some(item => item.timestamp !== undefined);
    let message = `✅ Received data for ${keys}.\n\n`;
    
    if (hasHistoricalData) {
      // Get the date of the first item with a timestamp
      const historyDate = parsedData.find(item => item.timestamp !== undefined)?.timestamp;
      if (historyDate) {
        const dateStr = historyDate.toISOString().split('T')[0];
        message += `Data recorded for date: ${dateStr}\n\n`;
      }
    }
    
    message += `View the updated chart: ${server.getChartUrl()}`;
    
    ctx.reply(message);
  } catch (error: any) {
    console.error('Error processing message:', error);
    ctx.reply(
      'Error processing your message. Please ensure it follows one of these formats:\n\n' +
      'Format 1 (with dash):\n' +
      'key1 - 75.3\n' +
      'key2 - 117,8\n\n' +
      'Format 2 (just space):\n' +
      'key1 75.3\n' +
      'key2 117,8\n\n' +
      'Both dot (75.3) and comma (75,3) decimal separators are supported.\n\n' +
      'For historical data, add a date:\n' +
      'DATE: YYYY-MM-DD\n' +
      'key1 value1\n\n' +
      'Error details: ' + (error.message || 'Unknown error')
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
