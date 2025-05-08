import { DataPoint, DataSet, ParsedData } from '../types';

class DataService {
  private dataStore: DataSet = {};
  
  /**
   * Adds data points to the store
   * @param data Array of parsed data points
   */
  public addData(data: ParsedData[]): void {
    // Default timestamp is current time
    const defaultTimestamp = new Date();
    
    data.forEach(item => {
      // Initialize the key if it doesn't exist
      if (!this.dataStore[item.key]) {
        this.dataStore[item.key] = {
          values: [],
          timestamps: []
        };
      }
      
      // Use provided timestamp if available, otherwise use default
      const timestamp = item.timestamp || defaultTimestamp;
      
      // Add the new data point
      this.dataStore[item.key].values.push(item.value);
      this.dataStore[item.key].timestamps.push(timestamp);
    });
  }
  
  /**
   * Gets all data points for timeline visualization
   */
  public getAllData(): DataPoint[] {
    const result: DataPoint[] = [];
    
    // Convert the data store to an array of data points
    Object.keys(this.dataStore).forEach(key => {
      const dataSet = this.dataStore[key];
      
      for (let i = 0; i < dataSet.values.length; i++) {
        result.push({
          key,
          value: dataSet.values[i],
          timestamp: dataSet.timestamps[i]
        });
      }
    });
    
    // Sort by timestamp (oldest first)
    return result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  /**
   * Gets the latest data for each key
   */
  public getLatestData(): Record<string, number> {
    const result: Record<string, number> = {};
    
    Object.keys(this.dataStore).forEach(key => {
      const dataSet = this.dataStore[key];
      if (dataSet.values.length > 0) {
        // Get the last value
        result[key] = dataSet.values[dataSet.values.length - 1];
      }
    });
    
    return result;
  }
  
  /**
   * Clears all data from the store
   */
  public clearData(): void {
    this.dataStore = {};
  }
}

// Singleton instance
export const dataService = new DataService();
