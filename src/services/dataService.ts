import { DataPoint, DataSet, ParsedData, UserDataStore } from '../types';

class DataService {
  private userDataStore: UserDataStore = {};
  
  /**
   * Adds data points to the store for a specific user
   * @param data Array of parsed data points
   * @param userId The Telegram user ID
   */
  public addData(data: ParsedData[], userId: number): void {
    // Default timestamp is current time
    const defaultTimestamp = new Date();
    
    // Initialize user's data store if it doesn't exist
    if (!this.userDataStore[userId]) {
      this.userDataStore[userId] = {};
    }
    
    // Get the user's data store
    const dataStore = this.userDataStore[userId];
    
    data.forEach(item => {
      // Initialize the key if it doesn't exist
      if (!dataStore[item.key]) {
        dataStore[item.key] = {
          values: [],
          timestamps: [],
          userIds: []
        };
      }
      
      // Use provided timestamp if available, otherwise use default
      const timestamp = item.timestamp || defaultTimestamp;
      
      // Add the new data point
      dataStore[item.key].values.push(item.value);
      dataStore[item.key].timestamps.push(timestamp);
      dataStore[item.key].userIds.push(userId);
    });
  }
  
  /**
   * Gets all data points for a specific user
   * @param userId The Telegram user ID
   */
  public getUserData(userId: number): DataPoint[] {
    const result: DataPoint[] = [];
    
    // If user doesn't have data, return empty array
    if (!this.userDataStore[userId]) {
      return result;
    }
    
    const dataStore = this.userDataStore[userId];
    
    // Convert the data store to an array of data points
    Object.keys(dataStore).forEach(key => {
      const dataSet = dataStore[key];
      
      for (let i = 0; i < dataSet.values.length; i++) {
        result.push({
          key,
          value: dataSet.values[i],
          timestamp: dataSet.timestamps[i],
          userId: dataSet.userIds[i]
        });
      }
    });
    
    // Sort by timestamp (oldest first)
    return result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  /**
   * Gets the latest data for each key for a specific user
   * @param userId The Telegram user ID
   */
  public getUserLatestData(userId: number): Record<string, number> {
    const result: Record<string, number> = {};
    
    // If user doesn't have data, return empty object
    if (!this.userDataStore[userId]) {
      return result;
    }
    
    const dataStore = this.userDataStore[userId];
    
    Object.keys(dataStore).forEach(key => {
      const dataSet = dataStore[key];
      if (dataSet.values.length > 0) {
        // Get the last value
        result[key] = dataSet.values[dataSet.values.length - 1];
      }
    });
    
    return result;
  }
  
  /**
   * Clears all data for a specific user
   * @param userId The Telegram user ID
   */
  public clearUserData(userId: number): void {
    if (this.userDataStore[userId]) {
      delete this.userDataStore[userId];
    }
  }
  
  /**
   * Gets list of all user IDs that have data
   */
  public getAllUserIds(): number[] {
    return Object.keys(this.userDataStore).map(id => parseInt(id, 10));
  }
  
  /**
   * Clears all data from all users
   * Used primarily for admin or testing purposes
   */
  public clearAllData(): void {
    this.userDataStore = {};
  }
}

// Singleton instance
export const dataService = new DataService();
