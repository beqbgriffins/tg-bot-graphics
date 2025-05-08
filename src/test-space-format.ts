import { parseMessage } from './utils/parser';

// Test the new format: key value (without dash)
const testMessage = `Вес 131.9
Грудь 118.5
Бицуха 41.7
Талия 113
Низ живота 123
Жопа 123
Бедро 73
Икра 47`;

try {
  const result = parseMessage(testMessage);
  console.log('New format parsed successfully!');
  console.log(JSON.stringify(result, null, 2));
} catch (error: any) {
  console.error('Parser error:', error.message);
}

// Also test with a date
const testMessageWithDate = `DATE: 2023-08-15
Вес 131.9
Грудь 118.5
Бицуха 41.7
Талия 113`;

try {
  const result = parseMessage(testMessageWithDate);
  console.log('\nNew format with date parsed successfully!');
  console.log(JSON.stringify(result, null, 2));
} catch (error: any) {
  console.error('Parser error with date:', error.message);
}

// Test that the original formats still work
const testFormatWithDash = `Вес - 130.3
Грудь - 117.8
Бицуха - 41.9`;

try {
  const result = parseMessage(testFormatWithDash);
  console.log('\nOriginal format with dashes still works:');
  console.log(JSON.stringify(result, null, 2));
} catch (error: any) {
  console.error('Parser error with dash format:', error.message);
}
