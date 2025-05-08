import { parseMessage } from './utils/parser';

// Test with various date formats
const testMessages = [
  // YYYY-MM-DD format
  `DATE: 2023-05-15
Вес - 130.3
Грудь - 117.8
Бицуха - 41.9`,

  // DD.MM.YYYY format
  `DATE: 10.06.2023
Вес - 132.1
Грудь - 118.2
Бицуха - 42.5`,

  // With date but no "DATE:" prefix
  `2023-07-20
Вес - 129.8
Грудь - 116.5
Бицуха - 43.0`,

  // Compact format
  `DATE:01.08.2023
Вес - 128.5
Грудь - 116.0`,

  // Original format with date
  `DATE: 2023-09-01
"Вес" - 127.2, "Грудь" - 115.5, "Бицуха" - 43.5`
];

// Test each message format
testMessages.forEach((message, index) => {
  console.log(`\nTest #${index + 1}:`);
  console.log(`Message: ${message.split('\n')[0]}...`);
  
  try {
    const result = parseMessage(message);
    console.log('Parsed successfully!');
    
    // Check if timestamp was extracted correctly
    const hasTimestamp = result.length > 0 && result[0].timestamp !== undefined;
    if (hasTimestamp) {
      console.log(`Extracted date: ${result[0].timestamp?.toISOString().split('T')[0]}`);
    } else {
      console.log('No date extracted.');
    }
    
    console.log('Parsed data:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('Parser error:', error.message);
  }
});
