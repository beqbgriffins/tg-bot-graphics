import { ParsedData } from '../types';

/**
 * Parses a message string in various formats:
 * 1. "key1" - value1, "key2" - value2, ...
 * 2. key1 - value1
 *    key2 - value2
 *    ...
 * 3. key1 value1
 *    key2 value2
 *    ...
 * 
 * Values can be integers or decimals.
 * 
 * If a date is provided in the format "DATE: YYYY-MM-DD" at the beginning of the message,
 * all data points will be assigned that timestamp.
 * 
 * @param message The message to parse
 * @returns An array of {key, value, timestamp?} objects
 */
export function parseMessage(message: string): ParsedData[] {
  // Clean up any extra whitespace
  let cleaned = message.trim();
  
  // Check for a date specification at the beginning of the message
  // Format: "DATE: YYYY-MM-DD" or "DATE: DD.MM.YYYY" or similar
  let messageDate: Date | undefined;
  
  // Check for common date formats
  const datePatterns = [
    // Match DATE: YYYY-MM-DD or DATE:YYYY-MM-DD
    /^\s*DATE\s*:\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*/i,
    // Match DATE: DD.MM.YYYY or DATE:DD.MM.YYYY
    /^\s*DATE\s*:\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\s*/i,
    // Match YYYY-MM-DD at the beginning
    /^\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*/,
    // Match DD.MM.YYYY at the beginning
    /^\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\s*/
  ];
  
  for (const pattern of datePatterns) {
    const dateMatch = cleaned.match(pattern);
    if (dateMatch && dateMatch[1]) {
      const dateStr = dateMatch[1];
      
      // Try to parse the date
      try {
        // Handle various date formats
        if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(dateStr)) {
          // YYYY-MM-DD format
          messageDate = new Date(dateStr);
        } else if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(dateStr)) {
          // DD.MM.YYYY format - need to convert to YYYY-MM-DD
          const parts = dateStr.split(/[-/.]/);
          if (parts.length === 3) {
            messageDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          }
        }
        
        // If date is valid, remove the date part from the cleaned message
        if (messageDate && !isNaN(messageDate.getTime())) {
          cleaned = cleaned.replace(pattern, '').trim();
          break;
        }
      } catch (e) {
        // Invalid date format, continue without a date
        console.warn('Invalid date format:', dateStr);
      }
    }
  }
  
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
    
    // Pattern 3: key value (with space but no dash)
    if (!matches || matches.length < 3) {
      // This pattern assumes the last word in the line is the numeric value
      // and everything before it is the key
      matches = pair.match(/(.+)\s+(\d+(\.\d+)?)$/);
    }
    
    if (!matches || matches.length < 3) {
      throw new Error(`Invalid format in pair: ${pair}`);
    }
    
    const key = matches[1].trim();
    const value = parseFloat(matches[2]);
    
    // Return object with timestamp if date was specified
    return messageDate 
      ? { key, value, timestamp: new Date(messageDate) } 
      : { key, value };
  });
}
