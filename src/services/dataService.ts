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
      // Load user data store if file exists
      if (fs.existsSync(this.dataFilePath)) {
        const dataJson = fs.readFileSync(this.dataFilePath, 'utf8');
        this.userDataStore = JSON.parse(dataJson, (key, value) => {
          // Handle Date objects during deserialization
          if (value && typeof value === 'object' && value.__type === 'Date') {
            return new Date(value.value);
          }
          return value;
        });
        
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
