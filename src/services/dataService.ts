import { ChartGroup, DataPoint, DataSet, ParsedData, UserDataStore, UserPreferences } from '../types';
import crypto from 'crypto';

import fs from 'fs';
import path from 'path';

class DataService {
  private userDataStore: UserDataStore = {};
  private userPreferences: Map<number, UserPreferences> = new Map();
  private persistenceDir: string = path.join(process.cwd(), 'data');
  private dataFilePath: string;
  private preferencesFilePath: string;
  
  constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(this.persistenceDir)) {
      fs.mkdirSync(this.persistenceDir, { recursive: true });
    }
    
    this.dataFilePath = path.join(this.persistenceDir, 'user_data.json');
    this.preferencesFilePath = path.join(this.persistenceDir, 'user_preferences.json');
    
    // Load saved data if available
    this.loadData();
  }
  
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
      // Convert key to lowercase to make it case insensitive
      const normalizedKey = item.key.toLowerCase();
      
      // Find if there's a matching key (case insensitive)
      let existingKey = Object.keys(dataStore).find(k => k.toLowerCase() === normalizedKey);
      
      // Use the existing key if found, otherwise use the original key
      const key = existingKey || item.key;
      
      // Initialize the key if it doesn't exist
      if (!dataStore[key]) {
        dataStore[key] = {
          values: [],
          timestamps: [],
          userIds: []
        };
      }
      
      // Use provided timestamp if available, otherwise use default
      const timestamp = item.timestamp || defaultTimestamp;
      
      // Add the new data point
      dataStore[key].values.push(item.value);
      dataStore[key].timestamps.push(timestamp);
      dataStore[key].userIds.push(userId);
    });
    
    // Update user's favorite metrics
    this.updateFavoriteMetrics(userId, data.map(item => item.key));
    
    // Save changes to disk
    this.saveData();
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
    return result.sort((a, b) => {
      // Ensure timestamps are Date objects
      const getTime = (timestamp: any): number => {
        if (timestamp instanceof Date) {
          return timestamp.getTime();
        } else if (typeof timestamp === 'string') {
          return new Date(timestamp).getTime();
        } else {
          return 0; // Fallback for invalid timestamps
        }
      };
      
      return getTime(a.timestamp) - getTime(b.timestamp);
    });
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
      this.saveData();
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
    this.saveData();
  }
  
  /**
   * Saves all user data and preferences to disk
   */
  public saveData(): void {
    try {
      // Save user data store
      fs.writeFileSync(
        this.dataFilePath, 
        JSON.stringify(this.userDataStore, (key, value) => {
          // Handle Date objects during serialization
          if (value instanceof Date) {
            return { __type: 'Date', value: value.toISOString() };
          }
          return value;
        }),
        'utf8'
      );
      
      // Convert Map to Object for serialization
      const preferencesObj: Record<string, UserPreferences> = {};
      this.userPreferences.forEach((prefs, userId) => {
        preferencesObj[userId.toString()] = prefs;
      });
      
      // Save user preferences
      fs.writeFileSync(
        this.preferencesFilePath,
        JSON.stringify(preferencesObj),
        'utf8'
      );
      
      console.log('Data saved to disk successfully');
    } catch (error) {
      console.error('Error saving data to disk:', error);
    }
  }
  
  /**
   * Loads user data and preferences from disk
   */
  private loadData(): void {
    try {
      // Handle Date objects during deserialization
      if (fs.existsSync(this.dataFilePath)) {
        const dataJson = fs.readFileSync(this.dataFilePath, 'utf8');
        this.userDataStore = JSON.parse(dataJson, (key, value) => {
          // Handle Date objects during deserialization
          if (value && typeof value === 'object' && value.__type === 'Date') {
            return new Date(value.value);
          }
          return value;
        });
        
        // Additional pass to ensure all timestamps are Date objects
        this.migrateTimestamps();
        
        console.log('Loaded user data from disk');
      }
      
      // Load user preferences if file exists
      if (fs.existsSync(this.preferencesFilePath)) {
        const prefsJson = fs.readFileSync(this.preferencesFilePath, 'utf8');
        const prefsObj: Record<string, UserPreferences> = JSON.parse(prefsJson);
        
        // Convert Object back to Map
        Object.entries(prefsObj).forEach(([userIdStr, prefs]) => {
          const userId = parseInt(userIdStr, 10);
          // Migrate any 'combined' views to 'individual'
          if ((prefs.defaultView as any) === 'combined') {
            prefs.defaultView = 'individual';
          }
          this.userPreferences.set(userId, prefs);
        });
        
        console.log('Loaded user preferences from disk');
      }
    } catch (error) {
      console.error('Error loading data from disk:', error);
      
      // Reset to empty objects in case of error
      this.userDataStore = {};
      this.userPreferences = new Map();
    }
  }
  
  /**
   * Gets or initializes user preferences
   * @param userId The Telegram user ID
   */
  public getUserPreferences(userId: number): UserPreferences {
    if (!this.userPreferences.has(userId)) {
      // Initialize new user preferences
      this.userPreferences.set(userId, {
        chartGroups: [],
        defaultView: 'individual',
        favoriteMetrics: []
      });
    } else {
      // Migrate existing users with 'combined' view to 'individual'
      const prefs = this.userPreferences.get(userId)!;
      if ((prefs.defaultView as any) === 'combined') {
        prefs.defaultView = 'individual';
      }
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
    
    // Save changes to disk
    this.saveData();
    
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
    
    // Save changes to disk
    this.saveData();
    
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
    
    // Save changes to disk
    this.saveData();
    
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
   * Migrates any string timestamps to proper Date objects
   * Called during data loading to ensure all timestamps are Date objects
   */
  private migrateTimestamps(): void {
    try {
      // Iterate through all user data
      for (const userId in this.userDataStore) {
        const userDataSet = this.userDataStore[userId];
        
        // Iterate through each metric
        for (const key in userDataSet) {
          const dataSet = userDataSet[key];
          
          // Convert each timestamp to a Date object if it's not already
          for (let i = 0; i < dataSet.timestamps.length; i++) {
            const timestamp = dataSet.timestamps[i];
            
            if (!(timestamp instanceof Date)) {
              // Try to convert string to Date
              try {
                dataSet.timestamps[i] = new Date(timestamp);
              } catch (e) {
                // If conversion fails, use current date as fallback
                console.error(`Failed to convert timestamp for user ${userId}, metric ${key} at index ${i}. Using current date as fallback.`);
                dataSet.timestamps[i] = new Date();
              }
            }
          }
        }
      }
      console.log('Timestamp migration complete');
    } catch (error) {
      console.error('Error during timestamp migration:', error);
    }
  }
  
  /**
   * Deletes a specific data point
   * @param userId The Telegram user ID
   * @param key The metric key
   * @param timestampStr The timestamp as string or Date object
   * @returns True if deleted, false if not found
   */
  public deleteDataPoint(userId: number, key: string, timestampStr: string | Date): boolean {
    // Check if user has data
    if (!this.userDataStore[userId]) {
      return false;
    }
    
    // Find the normalized key (case insensitive)
    const normalizedKey = key.toLowerCase();
    const existingKey = Object.keys(this.userDataStore[userId])
      .find(k => k.toLowerCase() === normalizedKey);
    
    // If key not found, return false
    if (!existingKey) {
      return false;
    }
    
    const dataSet = this.userDataStore[userId][existingKey];
    let timestamp: Date;
    
    if (timestampStr instanceof Date) {
      timestamp = timestampStr;
    } else {
      timestamp = new Date(timestampStr);
    }
    
    // Find the index of the data point
    let found = false;
    for (let i = 0; i < dataSet.timestamps.length; i++) {
      const currentTimestamp = dataSet.timestamps[i];
      
      if (currentTimestamp instanceof Date && 
          currentTimestamp.getTime() === timestamp.getTime()) {
        // Remove the data point
        dataSet.values.splice(i, 1);
        dataSet.timestamps.splice(i, 1);
        dataSet.userIds.splice(i, 1);
        found = true;
        break;
      }
    }
    
    // If data set is now empty, remove it
    if (found && dataSet.values.length === 0) {
      delete this.userDataStore[userId][existingKey];
    }
    
    // If user's data store is now empty, remove it
    if (found && Object.keys(this.userDataStore[userId]).length === 0) {
      delete this.userDataStore[userId];
    }
    
    // Save changes to disk if found
    if (found) {
      this.saveData();
    }
    
    return found;
  }
  
  /**
   * Get the latest data points for each key for a specific user
   * @param userId The Telegram user ID
   * @returns Array of DataPoint objects with the latest value for each key
   */
  public getUserLatestDataPoints(userId: number): DataPoint[] {
    const result: DataPoint[] = [];
    
    // If user doesn't have data, return empty array
    if (!this.userDataStore[userId]) {
      return result;
    }
    
    const dataStore = this.userDataStore[userId];
    
    Object.keys(dataStore).forEach(key => {
      const dataSet = dataStore[key];
      if (dataSet.values.length > 0) {
        // Get the last entry
        const lastIndex = dataSet.values.length - 1;
        result.push({
          key,
          value: dataSet.values[lastIndex],
          timestamp: dataSet.timestamps[lastIndex],
          userId: dataSet.userIds[lastIndex]
        });
      }
    });
    
    return result;
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
    
    // No need to call saveData() here as this is only called from addData()
    // which already calls saveData()
  }
}

// Singleton instance
export const dataService = new DataService();
