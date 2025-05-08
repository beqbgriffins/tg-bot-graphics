import { parseMessage } from './utils/parser';

// Test with dot as decimal separator
const testDot = `Вес 75.3
Грудь 117.8
Бицуха 41.9`;

// Test with comma as decimal separator
const testComma = `Вес 75,3
Грудь 117,8
Бицуха 41,9`;

// Test with mixed separators
const testMixed = `Вес 75.3
Грудь 117,8
Бицуха 41.9`;

// Test with dash and comma
const testDashComma = `Вес - 75,3
Грудь - 117,8
Бицуха - 41,9`;

// Test a different format with dash and comma
const testDashComma2 = `Вес-75,3
Грудь-117,8
Бицуха-41,9`;

// Test with quotes, dash and comma
const testQuotesDashComma = `"Вес" - 75,3
"Грудь" - 117,8
"Бицуха" - 41,9`;

// Test with quotes, dash and comma in one line
const testQuotesDashCommaOneLine = `"Вес" - 75,3, "Грудь" - 117,8, "Бицуха" - 41,9`;

const allTests = [
  { name: 'dot decimal separators', data: testDot },
  { name: 'comma decimal separators', data: testComma },
  { name: 'mixed decimal separators', data: testMixed },
  { name: 'dash with comma decimal separators', data: testDashComma },
  { name: 'dash2 with comma decimal separators', data: testDashComma2 },
  { name: 'quotes, dash with comma (multiline)', data: testQuotesDashComma },
  { name: 'quotes, dash with comma (one line)', data: testQuotesDashCommaOneLine },
];

// Run all tests
allTests.forEach(test => {
  try {
    console.log(`\nTesting ${test.name}:`);
    console.log('Input:', test.data);
    const result = parseMessage(test.data);
    console.log('Output:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error(`Error in test "${test.name}":`, error.message);
  }
});
