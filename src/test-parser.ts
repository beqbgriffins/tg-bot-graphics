import { parseMessage } from './utils/parser';

// Test with the example format
const testMessage = `Вес - 130.3
Грудь - 117.8
Бицуха - 41.9
Талия - 112.4
Низ живота - 121
Жопа - 124.5
Бедро - 72
Икра - 47`;

try {
  const result = parseMessage(testMessage);
  console.log('Parsed successfully!');
  console.log(JSON.stringify(result, null, 2));
} catch (error: any) {
  console.error('Parser error:', error.message);
}

// Test with the original format
const testMessage2 = `"temperature" - 25, "humidity" - 60`;

try {
  const result2 = parseMessage(testMessage2);
  console.log('\nOriginal format parsed successfully!');
  console.log(JSON.stringify(result2, null, 2));
} catch (error: any) {
  console.error('Parser error for original format:', error.message);
}
