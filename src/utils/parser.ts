import { ParsedData } from '../types';

/**
 * Parses a message string in various formats:
 * 1. key1 - value1
 *    key2 - value2
 *    ...
 * 2. key1 value1
 *    key2 value2
 *    ...
 * 
 * Values can be integers or decimals with either dots (75.3) or commas (75,3).
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
  
  // Split by newlines
  const lines = cleaned.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Process each line
  return lines.map(line => {
    let key: string;
    let valueStr: string;
    
    // Check for format: key - value
    if (line.includes(' - ')) {
      const parts = line.split(' - ').map(part => part.trim());
      if (parts.length !== 2) {
        throw new Error(`Invalid format in line: ${line}`);
      }
      
      key = parts[0];
      valueStr = parts[1];
    }
    // Check for format: key value
    else {
      // Find the last occurrence of a space followed by a number
      const match = line.match(/^(.+)\s+(\d+(?:[.,]\d+)?)$/);
      if (!match || match.length < 3) {
        throw new Error(`Invalid format in line: ${line}`);
      }
      
      key = match[1].trim();
      valueStr = match[2];
    }
    
    // Convert comma to dot for decimal values before parsing
    const normalizedValue = valueStr.replace(',', '.');
    const value = parseFloat(normalizedValue);
    
    if (isNaN(value)) {
      throw new Error(`Invalid numeric value in line: ${line}`);
    }
    
    // Return object with timestamp if date was specified
    return messageDate 
      ? { key, value, timestamp: new Date(messageDate) } 
      : { key, value };
  });
}
