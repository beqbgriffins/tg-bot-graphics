import { ChartGroup, DataPoint, DataSet, ParsedData, UserDataStore, UserPreferences } from '../types';
import crypto from 'crypto';

class DataService {
  private userDataStore: UserDataStore = {};
  private userPreferences: Map<number, UserPreferences> = new Map();
  
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
    
    // Update user's favorite metrics
    this.updateFavoriteMetrics(userId, data.map(item => item.key));
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
   * Gets all unique keys for a user's data
   * @param userId The Telegram user ID
   * @returns Array of keys
   */
  public getUserKeys(userId: number): string[] {
    if (!this.userDataStore[userId]) {
      return [];
    }
    
    return Object.keys(this.userDataStore[userId]).sort();
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
  
  /**
   * Gets or initializes user preferences
   * @param userId The Telegram user ID
   */
  public getUserPreferences(userId: number): UserPreferences {
    if (!this.userPreferences.has(userId)) {
      this.userPreferences.set(userId, {
        chartGroups: [],
        defaultView: 'individual',
        favoriteMetrics: []
      });
    }
    
    return this.userPreferences.get(userId)!;
  }
  
  /**
   * Creates a new chart group for a user
   * @param userId The Telegram user ID
   * @param name The name of the group
   * @param keys The keys to include in the group
   * @returns The created chart group
   */
  public createChartGroup(userId: number, name: string, keys: string[]): ChartGroup {
    const preferences = this.getUserPreferences(userId);
    
    // Create a new chart group
    const newGroup: ChartGroup = {
      id: crypto.randomBytes(8).toString('hex'),
      name,
      keys,
      createdAt: new Date()
    };
    
    // Add to user's preferences
    preferences.chartGroups.push(newGroup);
    
    return newGroup;
  }
  
  /**
   * Updates an existing chart group
   * @param userId The Telegram user ID
   * @param groupId The ID of the group to update
   * @param updates Partial updates to apply
   * @returns The updated chart group or undefined if not found
   */
  public updateChartGroup(
    userId: number, 
    groupId: string, 
    updates: Partial<Omit<ChartGroup, 'id' | 'createdAt'>>
  ): ChartGroup | undefined {
    const preferences = this.getUserPreferences(userId);
    
    // Find the group
    const groupIndex = preferences.chartGroups.findIndex(g => g.id === groupId);
    if (groupIndex === -1) {
      return undefined;
    }
    
    // Update the group
    const updatedGroup = {
      ...preferences.chartGroups[groupIndex],
      ...updates
    };
    
    preferences.chartGroups[groupIndex] = updatedGroup;
    return updatedGroup;
  }
  
  /**
   * Deletes a chart group
   * @param userId The Telegram user ID
   * @param groupId The ID of the group to delete
   * @returns True if deleted, false if not found
   */
  public deleteChartGroup(userId: number, groupId: string): boolean {
    const preferences = this.getUserPreferences(userId);
    
    // Find the group
    const groupIndex = preferences.chartGroups.findIndex(g => g.id === groupId);
    if (groupIndex === -1) {
      return false;
    }
    
    // Remove the group
    preferences.chartGroups.splice(groupIndex, 1);
    return true;
  }
  
  /**
   * Gets all chart groups for a user
   * @param userId The Telegram user ID
   * @returns Array of chart groups
   */
  public getUserChartGroups(userId: number): ChartGroup[] {
    return this.getUserPreferences(userId).chartGroups;
  }
  
  /**
   * Gets a specific chart group
   * @param userId The Telegram user ID
   * @param groupId The ID of the group
   * @returns The chart group or undefined if not found
   */
  public getChartGroup(userId: number, groupId: string): ChartGroup | undefined {
    const preferences = this.getUserPreferences(userId);
    return preferences.chartGroups.find(g => g.id === groupId);
  }
  
  /**
   * Updates user's favorite metrics based on usage
   * @param userId The Telegram user ID
   * @param keys The keys the user just used
   */
  private updateFavoriteMetrics(userId: number, keys: string[]): void {
    const preferences = this.getUserPreferences(userId);
    
    // Count occurrences of each key
    const keyCount = new Map<string, number>();
    
    // Initialize with current favorites
    preferences.favoriteMetrics.forEach(key => {
      keyCount.set(key, (keyCount.get(key) || 0) + 1);
    });
    
    // Add the new keys
    keys.forEach(key => {
      keyCount.set(key, (keyCount.get(key) || 0) + 1);
    });
    
    // Sort by count and take top 5
    const sortedKeys = Array.from(keyCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])
      .slice(0, 5);
    
    preferences.favoriteMetrics = sortedKeys;
  }
}

// Singleton instance
export const dataService = new DataService();
