import { ParsedData } from '../types';

/**
 * Parses a message string in various formats:
 * 1. "key1" - value1, "key2" - value2, ...
 * 2. key1 - value1
 *    key2 - value2
 *    ...
 * 
 * Values can be integers or decimals.
 * 
 * @param message The message to parse
 * @returns An array of {key, value} objects
 */
export function parseMessage(message: string): ParsedData[] {
  // Clean up any extra whitespace
  const cleaned = message.trim();
  
  // Check if the message format is comma-separated or line-separated
  const isCommaSeparated = cleaned.includes(',');
  
  // Split by appropriate delimiter (commas or newlines)
  const pairs = isCommaSeparated 
    ? cleaned.split(',').map(pair => pair.trim()).filter(pair => pair.length > 0)
    : cleaned.split('\n').map(pair => pair.trim()).filter(pair => pair.length > 0);
  
  // Parse each pair into key and value
  return pairs.map(pair => {
    // Try different regex patterns to extract key and value
    
    // Pattern 1: "key" - value
    let matches = pair.match(/"([^"]+)"\s*-\s*(\d+(\.\d+)?)/);
    
    // Pattern 2: key - value 
    if (!matches || matches.length < 3) {
      matches = pair.match(/([^-]+)\s*-\s*(\d+(\.\d+)?)/);
    }
    
    if (!matches || matches.length < 3) {
      throw new Error(`Invalid format in pair: ${pair}`);
    }
    
    const key = matches[1].trim();
    const value = parseFloat(matches[2]);
    
    return { key, value };
  });
}
