import { parseMessage } from './utils/parser';

// Test cases
const testCases = [
  {
    name: "Line separated with dash and dot (standard)",
    input: `Вес - 75.3
Грудь - 117.8
Бицуха - 41.9`
  },
  {
    name: "Line separated with dash and comma",
    input: `Вес - 75,3
Грудь - 117,8
Бицуха - 41,9`
  },
  {
    name: "Line separated without dash (just space) and dot",
    input: `Вес 75.3
Грудь 117.8
Бицуха 41.9`
  },
  {
    name: "Line separated without dash (just space) and comma",
    input: `Вес 75,3
Грудь 117,8
Бицуха 41,9`
  },
  {
    name: "With date (dot separator)",
    input: `DATE: 2023-05-15
Вес 75.3
Грудь 117.8
Бицуха 41.9`
  },
  {
    name: "With date (comma separator)",
    input: `DATE: 2023-05-15
Вес 75,3
Грудь 117,8
Бицуха 41,9`
  },
  {
    name: "With European date format",
    input: `DATE: 15.05.2023
Вес 75,3
Грудь 117,8
Бицуха 41,9`
  },
  {
    name: "Integer values (no decimal)",
    input: `Вес 75
Грудь 117
Бицуха 42`
  },
  {
    name: "Mixed formats and separators",
    input: `Вес - 75.3
Грудь 117,8
Бицуха - 42`
  }
];

// Run all tests
console.log("Testing parser with all supported formats\n");

testCases.forEach(test => {
  try {
    console.log(`\n[ ${test.name} ]`);
    console.log("Input:");
    console.log(test.input);
    
    const result = parseMessage(test.input);
    
    console.log("\nParsed Result:");
    console.log(JSON.stringify(result, null, 2));
    console.log("✅ Successfully parsed!");
  } catch (error: any) {
    console.error(`❌ ERROR: ${error.message}`);
  }
  
  console.log("\n" + "-".repeat(50));
});
