import { ParsedData } from '../types';

/**
 * Parses a message string in the format "key1" - int, "key2" - int, ...
 * @param message The message to parse
 * @returns An array of {key, value} objects
 */
export function parseMessage(message: string): ParsedData[] {
  // Clean up any extra whitespace
  const cleaned = message.trim();
  
  // Split by commas to get individual key-value pairs
  const pairs = cleaned.split(',').map(pair => pair.trim()).filter(pair => pair.length > 0);
  
  // Parse each pair into key and value
  return pairs.map(pair => {
    // Use regex to extract key and value
    const matches = pair.match(/"([^"]+)"\s*-\s*(\d+)/);
    
    if (!matches || matches.length < 3) {
      throw new Error(`Invalid format in pair: ${pair}`);
    }
    
    const key = matches[1];
    const value = parseInt(matches[2], 10);
    
    return { key, value };
  });
}
