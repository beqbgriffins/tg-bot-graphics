import express, { Request, Response } from 'express';
import { dataService } from './services/dataService';
import { chartService } from './services/chartService';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

class Server {
  private app = express();
  private port: number;
  private host: string;
  private userTokens: Map<number, string> = new Map(); // Map user IDs to secure tokens
  // We'll keep this for backward compatibility, but migrate to dataService storage
  private userGroups: Map<number, Map<string, string[]>> = new Map(); // Store user-defined chart groups
  private persistenceDir: string = path.join(process.cwd(), 'data');
  private tokensFilePath: string;
  private groupsFilePath: string;
  
  constructor(port: number, host: string) {
    this.port = port;
    this.host = host;
    
    // Set up persistence paths
    if (!fs.existsSync(this.persistenceDir)) {
      fs.mkdirSync(this.persistenceDir, { recursive: true });
    }
    
    this.tokensFilePath = path.join(this.persistenceDir, 'user_tokens.json');
    this.groupsFilePath = path.join(this.persistenceDir, 'legacy_groups.json');
    
    // Load saved data
    this.loadTokens();
    this.loadGroups();
    
    this.setup();
  }
  
  private setup(): void {
    // Configure middleware
    this.app.use(express.json());
    
    // Route for serving combined chart images
    this.app.get('/chart/:token', this.handleChartRequest.bind(this));
    
    // Route for serving single metric charts
    this.app.get('/chart/:token/metric/:metric', this.handleSingleMetricChartRequest.bind(this));
    
    // Route for serving grouped charts
    this.app.get('/chart/:token/group/:groupId', this.handleGroupChartRequest.bind(this));
    
    // API for creating and managing groups
    this.app.post('/api/:token/groups', express.json(), this.handleCreateGroup.bind(this));
    this.app.get('/api/:token/groups', this.handleListGroups.bind(this));
    this.app.delete('/api/:token/groups/:groupId', this.handleDeleteGroup.bind(this));
    
    // Route for serving chart page with some basic styling
    this.app.get('/view/:token', this.handleViewRequest.bind(this));
    
    // Route for providing JSON data
    this.app.get('/data/:token', this.handleDataRequest.bind(this));
    
    // Route for getting all metrics for a user
    this.app.get('/api/:token/metrics', this.handleGetMetrics.bind(this));
    
    // Routes for deleting data
    this.app.delete('/api/:token/data/all', this.handleDeleteAllData.bind(this));
    this.app.delete('/api/:token/data/:key/:timestamp', this.handleDeleteDataPoint.bind(this));
  }
  
  /**
   * Gets or creates a token for a user
   * @param userId The Telegram user ID
   * @returns A secure token for the user
   */
  public getUserToken(userId: number): string {
    // Return existing token if user already has one
    if (this.userTokens.has(userId)) {
      return this.userTokens.get(userId)!;
    }
    
    // Generate a new token
    const token = crypto.randomBytes(16).toString('hex');
    this.userTokens.set(userId, token);
    
    // Save tokens to disk
    this.saveTokens();
    
    return token;
  }
  
  /**
   * Save user tokens to disk
   */
  private saveTokens(): void {
    try {
      // Keep only the most recent 3 tokens per user
      this.limitTokenStorage();
      
      // Convert Map to Object for serialization
      const tokensObj: Record<string, string> = {};
      this.userTokens.forEach((token, userId) => {
        tokensObj[userId.toString()] = token;
      });
      
      fs.writeFileSync(
        this.tokensFilePath,
        JSON.stringify(tokensObj),
        'utf8'
      );
      
      console.log('User tokens saved to disk');
    } catch (error) {
      console.error('Error saving tokens to disk:', error);
    }
  }
  
  /**
   * Limit token storage to keep only the last 3 tokens
   */
  private limitTokenStorage(): void {
    // Group user IDs
    const userCounts = new Map<number, number>();
    
    // Count tokens per user
    this.userTokens.forEach((_, userId) => {
      userCounts.set(userId, (userCounts.get(userId) || 0) + 1);
    });
    
    // Process users with more than 3 tokens
    userCounts.forEach((count, userId) => {
      if (count <= 3) {
        return; // Skip users with 3 or fewer tokens
      }
      
      // Get all tokens for this user
      const userTokens = new Map<string, number>();
      this.userTokens.forEach((token, uid) => {
        if (uid === userId) {
          userTokens.set(token, uid);
        }
      });
      
      // Sort tokens (we'll remove oldest ones, which are likely first in insertion order)
      const tokens = Array.from(userTokens.keys());
      const tokensToRemove = tokens.slice(0, count - 3);
      
      // Remove excess tokens
      tokensToRemove.forEach(token => {
        const uid = userTokens.get(token);
        if (uid !== undefined) {
          this.userTokens.delete(uid);
        }
      });
    });
  }
  
  /**
   * Load user tokens from disk
   */
  private loadTokens(): void {
    try {
      if (fs.existsSync(this.tokensFilePath)) {
        const tokensJson = fs.readFileSync(this.tokensFilePath, 'utf8');
        const tokensObj: Record<string, string> = JSON.parse(tokensJson);
        
        // Convert Object to Map
        Object.entries(tokensObj).forEach(([userIdStr, token]) => {
          const userId = parseInt(userIdStr, 10);
          this.userTokens.set(userId, token);
        });
        
        console.log('Loaded user tokens from disk');
      }
    } catch (error) {
      console.error('Error loading tokens from disk:', error);
      // Reset to empty Map in case of error
      this.userTokens = new Map();
    }
  }
  
  /**
   * Save legacy user groups to disk
   */
  private saveGroups(): void {
    try {
      // Convert nested Maps to Objects for serialization
      const groupsObj: Record<string, Record<string, string[]>> = {};
      
      this.userGroups.forEach((groupMap, userId) => {
        const userGroups: Record<string, string[]> = {};
        
        groupMap.forEach((metrics, groupId) => {
          userGroups[groupId] = metrics;
        });
        
        groupsObj[userId.toString()] = userGroups;
      });
      
      fs.writeFileSync(
        this.groupsFilePath,
        JSON.stringify(groupsObj),
        'utf8'
      );
      
      console.log('Legacy groups saved to disk');
    } catch (error) {
      console.error('Error saving legacy groups to disk:', error);
    }
  }
  
  /**
   * Load legacy user groups from disk
   */
  private loadGroups(): void {
    try {
      if (fs.existsSync(this.groupsFilePath)) {
        const groupsJson = fs.readFileSync(this.groupsFilePath, 'utf8');
        const groupsObj: Record<string, Record<string, string[]>> = JSON.parse(groupsJson);
        
        // Convert Objects to Maps
        Object.entries(groupsObj).forEach(([userIdStr, userGroups]) => {
          const userId = parseInt(userIdStr, 10);
          const groupMap = new Map<string, string[]>();
          
          Object.entries(userGroups).forEach(([groupId, groupInfo]) => {
            // Convert old format to new if needed
            if (Array.isArray(groupInfo)) {
              groupMap.set(groupId, {
                name: groupId,
                metrics: groupInfo
              });
            } else {
              groupMap.set(groupId, groupInfo);
            }
          });
          
          this.userGroups.set(userId, groupMap);
          
          // Migrate legacy groups to dataService
          this.migrateUserGroups(userId);
        });
        
        console.log('Loaded legacy groups from disk');
      }
    } catch (error) {
      console.error('Error loading legacy groups from disk:', error);
      // Reset to empty Map in case of error
      this.userGroups = new Map();
    }
  }
  
  /**
   * Migrate legacy groups to dataService
   * @param userId The user ID to migrate groups for
   */
  private migrateUserGroups(userId: number): void {
    try {
      const userGroups = this.userGroups.get(userId);
      if (!userGroups || userGroups.size === 0) {
        return;
      }
      
      // Get existing groups from dataService
      const existingGroups = dataService.getUserChartGroups(userId);
      const existingGroupIds = existingGroups.map(g => g.id);
      
      // Migrate each group
      userGroups.forEach((groupData, groupId) => {
        // Skip if group already exists in dataService
        if (existingGroupIds.includes(groupId)) {
          return;
        }
        
        // Support both old and new format
        const metrics = groupData.metrics || groupData;
        const name = groupData.name || groupId;
        
        // Create group in dataService
        dataService.createChartGroup(userId, name, Array.isArray(metrics) ? metrics : []);
      });
      
      console.log(`Migrated legacy groups for user ${userId}`);
    } catch (error) {
      console.error(`Error migrating legacy groups for user ${userId}:`, error);
    }
  }
  
  /**
   * Get user ID from token
   * @param token The user token
   * @returns The user ID or undefined if not found
   */
  private getUserIdFromToken(token: string): number | undefined {
    for (const [userId, userToken] of this.userTokens.entries()) {
      if (userToken === token) {
        return userId;
      }
    }
    return undefined;
  }
  public createGroup(userId: number, groupName: string, metrics: string[]): string {
    // Initialize user's groups if needed
    if (!this.userGroups.has(userId)) {
      this.userGroups.set(userId, new Map());
    }
    
    // Generate a unique group ID
    const groupId = crypto.randomBytes(8).toString('hex');
    
    // Store the group with both name and metrics
    this.userGroups.get(userId)!.set(groupId, {
      name: groupName,
      metrics: metrics
    });
    
    // Save changes to disk
    this.saveGroups();
    
    return groupId;
  }
  
  /**
   * Get all groups for a user
   * @param userId User ID
   * @returns Map of group IDs to group objects
   */
  public getUserGroups(userId: number): Map<string, any> {
    return this.userGroups.get(userId) || new Map();
  }
  
  /**
   * Delete a group for a user
   * @param userId User ID
   * @param groupId Group ID
   * @returns True if successful
   */
  public deleteGroup(userId: number, groupId: string): boolean {
    if (!this.userGroups.has(userId)) {
      return false;
    }
    
    const deleted = this.userGroups.get(userId)!.delete(groupId);
    
    if (deleted) {
      // Save changes to disk
      this.saveGroups();
    }
    
    return deleted;
  }
  
  /**
   * Handle API request to create a new group
   */
  private handleCreateGroup(req: Request, res: Response): void {
    try {
      const token = req.params.token;
      const userId = this.getUserIdFromToken(token);
      
      if (userId === undefined) {
        res.status(403).json({ error: 'Invalid token' });
        return;
      }
      
      const { groupName, metrics } = req.body;
      
      if (!groupName || !metrics || !Array.isArray(metrics) || metrics.length === 0) {
        res.status(400).json({ error: 'Invalid request. Please provide groupName and metrics array.' });
        return;
      }
      
      // Create the group
      const groupId = this.createGroup(userId, groupName, metrics);
      
      res.json({
        groupId,
        groupName,
        metrics,
        chartUrl: `${this.host}/chart/${token}/group/${groupId}`,
        viewUrl: `${this.host}/view/${token}?group=${groupId}`
      });
    } catch (error) {
      console.error('Error creating group:', error);
      res.status(500).json({ error: 'Error creating group' });
    }
  }
  
  /**
   * Handle API request to list all groups
   */
  private handleListGroups(req: Request, res: Response): void {
    try {
      const token = req.params.token;
      const userId = this.getUserIdFromToken(token);
      
      if (userId === undefined) {
        res.status(403).json({ error: 'Invalid token' });
        return;
      }
      
      // Get user's groups
      const groups = this.getUserGroups(userId);
      
      // Convert to array format for JSON
      const groupsArray = Array.from(groups.entries()).map(([groupId, groupData]) => ({
        groupId,
        groupName: groupData.name || groupId,
        metrics: groupData.metrics || groupData,
        chartUrl: `${this.host}/chart/${token}/group/${groupId}`,
        viewUrl: `${this.host}/view/${token}?group=${groupId}`
      }));
      
      res.json(groupsArray);
    } catch (error) {
      console.error('Error listing groups:', error);
      res.status(500).json({ error: 'Error listing groups' });
    }
  }
  
  /**
   * Handle API request to delete a group
   */
  private handleDeleteGroup(req: Request, res: Response): void {
    try {
      const token = req.params.token;
      const groupId = req.params.groupId;
      const userId = this.getUserIdFromToken(token);
      
      if (userId === undefined) {
        res.status(403).json({ error: 'Invalid token' });
        return;
      }
      
      // Delete the group
      const success = this.deleteGroup(userId, groupId);
      
      if (success) {
        res.json({ success: true, message: 'Group deleted successfully' });
      } else {
        res.status(404).json({ error: 'Group not found' });
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      res.status(500).json({ error: 'Error deleting group' });
    }
  }
  
  /**
   * Handle request for getting all metrics
   */
  private handleGetMetrics(req: Request, res: Response): void {
    try {
      const token = req.params.token;
      const userId = this.getUserIdFromToken(token);
      
      if (userId === undefined) {
        res.status(403).json({ error: 'Invalid token' });
        return;
      }
      
      // Get user's data
      const data = dataService.getUserData(userId);
      
      // Extract unique metrics
      const metrics = [...new Set(data.map(point => point.key))].sort();
      
      res.json(metrics);
    } catch (error) {
      console.error('Error getting metrics:', error);
      res.status(500).json({ error: 'Error getting metrics' });
    }
  }
  
  private async handleChartRequest(req: Request, res: Response): Promise<void> {
    try {
      const token = req.params.token;
      const userId = this.getUserIdFromToken(token);
      
      if (userId === undefined) {
        res.status(403).send('Invalid token');
        return;
      }
      
      const data = dataService.getUserData(userId);
      
      if (data.length === 0) {
        res.status(404).send('No data available');
        return;
      }
      
      // Get filters from query parameters
      const hiddenKeys = (req.query.hidden || '').toString().split(',').filter(Boolean);
      
      const chartBuffer = await chartService.generateTimelineChart(data, hiddenKeys);
      
      res.set('Content-Type', 'image/png');
      res.send(chartBuffer);
    } catch (error) {
      console.error('Error generating chart:', error);
      res.status(500).send('Error generating chart');
    }
  }
  
  private async handleSingleMetricChartRequest(req: Request, res: Response): Promise<void> {
    try {
      const token = req.params.token;
      const metric = req.params.metric;
      const userId = this.getUserIdFromToken(token);
      
      if (userId === undefined) {
        res.status(403).send('Invalid token');
        return;
      }
      
      const data = dataService.getUserData(userId);
      
      if (data.length === 0) {
        res.status(404).send('No data available');
        return;
      }
      
      const chartBuffer = await chartService.generateSingleKeyChart(data, metric);
      
      res.set('Content-Type', 'image/png');
      res.send(chartBuffer);
    } catch (error) {
      console.error('Error generating metric chart:', error);
      res.status(500).send('Error generating chart');
    }
  }
  
  private async handleGroupChartRequest(req: Request, res: Response): Promise<void> {
    try {
      const token = req.params.token;
      const groupId = req.params.groupId;
      const userId = this.getUserIdFromToken(token);
      
      if (userId === undefined) {
        res.status(403).send('Invalid token');
        return;
      }
      
      // Get the group metrics
      const groups = this.getUserGroups(userId);
      const groupData = groups.get(groupId);
      
      if (!groupData) {
        res.status(404).send('Group not found');
        return;
      }
      
      // Support both old and new format
      const metrics = Array.isArray(groupData.metrics) ? 
                      groupData.metrics : 
                      (Array.isArray(groupData) ? groupData : []);
      const groupName = groupData.name || groupId;
      
      const data = dataService.getUserData(userId);
      
      if (data.length === 0) {
        res.status(404).send('No data available');
        return;
      }
      
      // Generate the group chart
      const chartBuffer = await chartService.generateMultiKeyChart(data, metrics, `Group: ${groupName}`);
      
      res.set('Content-Type', 'image/png');
      res.send(chartBuffer);
    } catch (error) {
      console.error('Error generating group chart:', error);
      res.status(500).send('Error generating chart');
    }
  }
  
  private handleDataRequest(req: Request, res: Response): void {
    try {
      const token = req.params.token;
      const userId = this.getUserIdFromToken(token);
      
      if (userId === undefined) {
        res.status(403).json({ error: 'Invalid token' });
        return;
      }
      
      const data = dataService.getUserData(userId);
      
      if (data.length === 0) {
        res.status(404).json({ error: 'No data available' });
        return;
      }
      
      // Convert dates to strings for better JSON serialization
      const formattedData = data.map(point => {
        // Ensure timestamp is a Date object
        let timestamp;
        let formattedDate;
        let formattedTime;
        
        try {
          if (!(point.timestamp instanceof Date)) {
            timestamp = new Date(point.timestamp);
          } else {
            timestamp = point.timestamp;
          }
          
          formattedDate = timestamp.toLocaleDateString();
          formattedTime = timestamp.toLocaleTimeString();
        } catch(e) {
          console.error('Error formatting timestamp:', e);
          timestamp = new Date(); // Fallback to current date
          formattedDate = 'Unknown';
          formattedTime = 'Unknown';
        }
        
        return {
          ...point,
          timestamp: timestamp.toISOString(),
          formattedDate,
          formattedTime
        };
      });
      
      res.json(formattedData);
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ error: 'Error fetching data' });
    }
  }
  
  private handleViewRequest(req: Request, res: Response): void {
    const token = req.params.token;
    const userId = this.getUserIdFromToken(token);
    
    if (userId === undefined) {
      res.status(403).send('Invalid token');
      return;
    }
    
    const data = dataService.getUserData(userId);
    
    // Get unique keys for metrics
    const allKeys = [...new Set(data.map(point => point.key))].sort();
    
    // Get user's groups
    const groups = this.getUserGroups(userId);
    const groupsArray = Array.from(groups.entries()).map(([groupId, groupData]) => {
      // Support both old and new format
      const metrics = groupData.metrics || groupData;
      const groupName = groupData.name || groupId;
      
      return {
        groupId,
        groupName,
        metrics: Array.isArray(metrics) ? metrics : []
      };
    });
    
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Your Data Timeline</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #f5f5f5;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            h1, h2, h3 {
              color: #333;
              margin-bottom: 10px;
            }
            .subheader {
              color: #555;
              margin-top: 0;
              margin-bottom: 20px;
              font-size: 16px;
            }
            .chart-container {
              background-color: white;
              border-radius: 8px;
              padding: 20px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              margin: 20px 0;
              width: 90%;
              max-width: 1100px;
              position: relative;
            }
            .chart-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
              gap: 20px;
              width: 90%;
              max-width: 1100px;
            }
            .chart-item {
              background-color: white;
              border-radius: 8px;
              padding: 15px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .chart-item-title {
              font-weight: bold;
              margin-bottom: 10px;
              font-size: 16px;
            }
            img {
              max-width: 100%;
              height: auto;
              border-radius: 4px;
            }
            button {
              background-color: #4CAF50;
              border: none;
              color: white;
              padding: 10px 20px;
              text-align: center;
              text-decoration: none;
              display: inline-block;
              font-size: 16px;
              margin: 10px 0;
              cursor: pointer;
              border-radius: 4px;
              min-width: 150px;
            }
            button:hover {
              background-color: #45a049;
            }
            button.secondary {
              background-color: #607d8b;
            }
            button.secondary:hover {
              background-color: #546e7a;
            }
            button.danger {
              background-color: #f44336;
            }
            button.danger:hover {
              background-color: #e53935;
            }
            .data-table {
              width: 90%;
              max-width: 1100px;
              margin-top: 30px;
              background-color: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              padding: 12px 15px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            th {
              background-color: #f8f8f8;
              font-weight: bold;
              color: #333;
            }
            tr:nth-child(even) {
              background-color: #f2f2f2;
            }
            tr:hover {
              background-color: #e9e9e9;
            }
            .date-header {
              font-weight: bold;
              background-color: #eee;
              padding: 10px;
              margin-top: 20px;
              margin-bottom: 10px;
              border-radius: 4px;
              text-align: center;
            }
            .delete-btn-sm {
              background-color: #f44336;
              color: white;
              border: none;
              border-radius: 4px;
              padding: 4px 8px;
              cursor: pointer;
              font-size: 12px;
            }
            .delete-btn-sm:hover {
              background-color: #d32f2f;
            }
            .actions-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              padding: 15px;
              background-color: #f5f5f5;
              border-radius: 8px;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            }
            .confirm-dialog {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background-color: rgba(0, 0, 0, 0.5);
              display: flex;
              justify-content: center;
              align-items: center;
              z-index: 1000;
            }
            .confirm-dialog-content {
              background-color: white;
              padding: 20px;
              border-radius: 8px;
              max-width: 400px;
              width: 90%;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            }
            .confirm-dialog-title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #333;
            }
            .confirm-dialog-message {
              margin-bottom: 20px;
              color: #555;
              font-size: 14px;
            }
            .confirm-dialog-buttons {
              display: flex;
              justify-content: flex-end;
              gap: 10px;
            }
            .confirm-btn {
              padding: 8px 15px;
              border-radius: 4px;
              border: none;
              cursor: pointer;
              font-size: 14px;
            }
            .confirm-btn-cancel {
              background-color: #ccc;
              color: #333;
            }
            .confirm-btn-confirm {
              background-color: #f44336;
              color: white;
            }
            .legend {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
              margin-bottom: 15px;
              margin-top: 15px;
            }
            .legend-item {
              display: flex;
              align-items: center;
              padding: 5px 10px;
              border-radius: 4px;
              cursor: pointer;
              user-select: none;
              transition: opacity 0.2s;
            }
            .legend-item.disabled {
              opacity: 0.5;
            }
            .legend-color {
              width: 20px;
              height: 20px;
              border-radius: 3px;
              margin-right: 8px;
            }
            .legend-label {
              font-size: 14px;
            }
            .controls-header {
              width: 100%;
              text-align: left;
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 5px;
              color: #333;
            }
            .loading {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(255, 255, 255, 0.8);
              display: flex;
              justify-content: center;
              align-items: center;
              z-index: 10;
              font-size: 18px;
              font-weight: bold;
            }
            .private-notice {
              background-color: #fafafa;
              border-radius: 4px;
              padding: 10px 15px;
              margin-bottom: 20px;
              font-size: 14px;
              color: #666;
              border-left: 4px solid #4CAF50;
            }
            .tabs {
              display: flex;
              margin-bottom: 20px;
              width: 90%;
              max-width: 1100px;
            }
            .tab {
              padding: 10px 20px;
              background: #e0e0e0;
              border-radius: 4px 4px 0 0;
              cursor: pointer;
              user-select: none;
              border: 1px solid #ccc;
              border-bottom: none;
              margin-right: 5px;
            }
            .tab.active {
              background: white;
              font-weight: bold;
            }
            .tab-content {
              display: none;
              width: 90%;
              max-width: 1100px;
            }
            .tab-content.active {
              display: block;
            }
            .group-creation {
              background-color: white;
              border-radius: 8px;
              padding: 20px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              margin: 20px 0;
              width: 90%;
              max-width: 1100px;
            }
            .form-group {
              margin-bottom: 15px;
            }
            label {
              display: block;
              margin-bottom: 5px;
              font-weight: bold;
            }
            input[type="text"] {
              width: 100%;
              padding: 8px;
              border: 1px solid #ccc;
              border-radius: 4px;
              font-size: 16px;
            }
            .checkbox-list {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
              gap: 10px;
              margin-top: 10px;
            }
            .checkbox-item {
              display: flex;
              align-items: center;
            }
            .group-list {
              margin-top: 20px;
              width: 100%;
            }
            .group-item {
              padding: 15px;
              background-color: #f9f9f9;
              border-radius: 8px;
              margin-bottom: 10px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .group-name {
              font-weight: bold;
            }
            .group-metrics {
              font-size: 14px;
              color: #666;
              margin-top: 5px;
            }
            .group-actions {
              display: flex;
              gap: 10px;
            }
            .action-button {
              padding: 5px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              border: none;
              color: white;
            }
            .view-btn {
              background-color: #2196f3;
            }
            .delete-btn {
              background-color: #f44336;
            }
          </style>
        </head>
        <body>
          <h1>Your Data Timeline</h1>
          <p class="subheader">Analysis of your ${allKeys.length} metrics across ${data.length} data points</p>
          
          <div class="private-notice">
            <strong>Private Dashboard</strong>: This visualization shows only your data. No one else can see your measurements.
          </div>
          
          <div class="tabs">
            <div class="tab active" data-tab="individual">Individual Metrics</div>
            <div class="tab" data-tab="groups">Metric Groups</div>
            <div class="tab" data-tab="data">Data Table</div>
          </div>
          
          <!-- Individual Metrics Tab -->
          <div class="tab-content active" id="individual-tab">
            <h2>Individual Metric Charts</h2>
            <p>Each chart shows the progression of a single metric over time.</p>
            
            <div class="chart-grid" id="metric-charts">
              <!-- Individual metric charts will be inserted here -->
              ${allKeys.map(key => `
                <div class="chart-item">
                  <div class="chart-item-title">${key}</div>
                  <img src="/chart/${token}/metric/${encodeURIComponent(key)}?t=${Date.now()}" alt="${key} Chart">
                </div>
              `).join('')}
            </div>
          </div>
          
          <!-- Groups Tab -->
          <div class="tab-content" id="groups-tab">
            <h2>Metric Groups</h2>
            <p>Create custom groups of metrics to analyze them together.</p>
            
            <div class="group-creation">
              <h3>Create New Group</h3>
              <div class="form-group">
                <label for="group-name">Group Name:</label>
                <input type="text" id="group-name" placeholder="Enter group name">
              </div>
              
              <div class="form-group">
                <label>Select Metrics:</label>
                <div class="checkbox-list" id="metrics-selection">
                  ${allKeys.map(key => `
                    <div class="checkbox-item">
                      <input type="checkbox" id="metric-${key}" value="${key}">
                      <label for="metric-${key}">${key}</label>
                    </div>
                  `).join('')}
                </div>
              </div>
              
              <button onclick="createGroup()">Create Group</button>
            </div>
            
            <div class="group-list" id="group-list">
              <h3>Your Groups</h3>
              
              ${groupsArray.length === 0 ? '<p>No groups created yet.</p>' : ''}
              
              ${groupsArray.map(group => `
                <div class="group-item" data-group-id="${group.groupId}">
                  <div>
                    <div class="group-name">${group.groupName}</div>
                    <div class="group-metrics">${group.metrics.join(', ')}</div>
                  </div>
                  <div class="group-actions">
                    <button class="action-button view-btn" onclick="viewGroup('${group.groupId}')">View</button>
                    <button class="action-button delete-btn" onclick="deleteGroup('${group.groupId}')">Delete</button>
                  </div>
                </div>
              `).join('')}
            </div>
            
            <!-- Group Chart Container (initially hidden) -->
            <div class="chart-container" id="group-chart-container" style="display: none;">
              <h3 id="group-chart-title">Group Chart</h3>
              <img src="" alt="Group Chart" id="group-chart-image">
            </div>
          </div>
          
          <!-- Data Table Tab -->
          <div class="tab-content" id="data-tab">
            <div class="actions-bar">
              <h3>Data Management</h3>
              <button id="delete-all-data" class="button danger" onclick="confirmDeleteAllData()">Delete All Data</button>
            </div>
            
            <div class="data-table" id="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Metric</th>
                    <th>Value</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="data-table-body">
                  <!-- Data will be loaded here -->
                </tbody>
              </table>
            </div>
            
            <!-- Confirmation Dialog -->
            <div id="confirm-dialog" class="confirm-dialog" style="display: none;">
              <div class="confirm-dialog-content">
                <div class="confirm-dialog-title" id="confirm-dialog-title">Confirm Delete</div>
                <div class="confirm-dialog-message" id="confirm-dialog-message">Are you sure you want to delete this item?</div>
                <div class="confirm-dialog-buttons">
                  <button class="confirm-btn confirm-btn-cancel" onclick="closeConfirmDialog()">Cancel</button>
                  <button class="confirm-btn confirm-btn-confirm" id="confirm-dialog-button">Delete</button>
                </div>
              </div>
            </div>
          </div>
          
          <script>
            // Store user token
            const userToken = '${token}';
            
            // Color generation function
            function generateColor(index) {
              const hue = (index * 137) % 360; // Golden angle approximation
              return \`hsl(\${hue}, 70%, 60%)\`;
            }
            
            // Store all data
            let allData = [];
            
            // Load data on page load
            window.addEventListener('DOMContentLoaded', initializePage);
            
            function initializePage() {
              // Set up tabs
              setupTabs();
              
              // Load data for table
              loadData().then(() => {
                populateTable(allData);
              });
            }
            
            function setupTabs() {
              const tabs = document.querySelectorAll('.tab');
              
              tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                  // Remove active class from all tabs
                  tabs.forEach(t => t.classList.remove('active'));
                  
                  // Add active class to clicked tab
                  tab.classList.add('active');
                  
                  // Hide all tab content
                  document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                  });
                  
                  // Show selected tab content
                  const tabId = tab.getAttribute('data-tab');
                  document.getElementById(tabId + '-tab').classList.add('active');
                });
              });
            }
            
            function loadData() {
              return fetch('/data/' + userToken)
                .then(response => response.json())
                .then(data => {
                  allData = data;
                  return data;
                })
                .catch(error => {
                  console.error('Error loading data:', error);
                });
            }
            
            // Functions for combined chart have been removed
            
            function populateTable(data) {
              const tableBody = document.getElementById('data-table-body');
              tableBody.innerHTML = '';
              
              // Use all data
              const filteredData = data;
              
              // Group data by date
              const dataByDate = {};
              
              filteredData.forEach(point => {
                const dateStr = point.timestamp.split('T')[0];
                
                if (!dataByDate[dateStr]) {
                  dataByDate[dateStr] = [];
                }
                dataByDate[dateStr].push(point);
              });
              
              // Sort dates in reverse chronological order
              const sortedDates = Object.keys(dataByDate).sort().reverse();
              
              // Create table rows grouped by date
              sortedDates.forEach(date => {
                const points = dataByDate[date];
                
                // Sort points by time and then by key
                points.sort((a, b) => {
                  const timeA = new Date(a.timestamp).getTime();
                  const timeB = new Date(b.timestamp).getTime();
                  
                  if (timeA === timeB) {
                    return a.key.localeCompare(b.key);
                  }
                  return timeA - timeB;
                });
                
                // Add a date header
                const [year, month, day] = date.split('-');
                const formattedDate = \`\${day}.\${month}.\${year}\`;
                
                const headerRow = document.createElement('tr');
                const headerCell = document.createElement('td');
                headerCell.colSpan = 5; // Updated to include action column
                headerCell.className = 'date-header';
                headerCell.textContent = formattedDate;
                headerRow.appendChild(headerCell);
                tableBody.appendChild(headerRow);
                
                // Add data rows
                points.forEach(point => {
                  const row = document.createElement('tr');
                  
                  const dateCell = document.createElement('td');
                  dateCell.textContent = point.formattedDate;
                  
                  const timeCell = document.createElement('td');
                  timeCell.textContent = point.formattedTime;
                  
                  const metricCell = document.createElement('td');
                  metricCell.textContent = point.key;
                  
                  const valueCell = document.createElement('td');
                  valueCell.textContent = point.value;
                  
                  const actionCell = document.createElement('td');
                  const deleteButton = document.createElement('button');
                  deleteButton.textContent = 'Delete';
                  deleteButton.className = 'delete-btn-sm';
                  deleteButton.onclick = function() {
                    confirmDeleteDataPoint(point.key, point.timestamp);
                  };
                  actionCell.appendChild(deleteButton);
                  
                  row.appendChild(dateCell);
                  row.appendChild(timeCell);
                  row.appendChild(metricCell);
                  row.appendChild(valueCell);
                  row.appendChild(actionCell);
                  
                  tableBody.appendChild(row);
                });
              });
            }
            
            function refreshChart() {
              // Reload data from server
              loadData().then(() => {
                // Update table
                populateTable(allData);
                
                // Refresh individual metric charts
                refreshMetricCharts();
              });
            }
            
            function refreshMetricCharts() {
              // Refresh all individual metric charts
              const metricCharts = document.querySelectorAll('#metric-charts img');
              metricCharts.forEach(img => {
                // Add timestamp to force refresh
                const src = img.src.split('?')[0];
                img.src = src + '?t=' + new Date().getTime();
              });
            }
            
            function createGroup() {
              const groupName = document.getElementById('group-name').value.trim();
              if (!groupName) {
                alert('Please enter a group name');
                return;
              }
              
              // Get selected metrics
              const checkboxes = document.querySelectorAll('#metrics-selection input:checked');
              if (checkboxes.length === 0) {
                alert('Please select at least one metric');
                return;
              }
              
              const metrics = Array.from(checkboxes).map(cb => cb.value);
              
              // Send request to create group
              fetch('/api/' + userToken + '/groups', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  groupName,
                  metrics
                })
              })
              .then(response => response.json())
              .then(data => {
                // Add the new group to the list
                const groupList = document.getElementById('group-list');
                
                // Remove "no groups" message if it exists
                const noGroupsMessage = groupList.querySelector('p');
                if (noGroupsMessage) {
                  noGroupsMessage.remove();
                }
                
                // Create group item
                const groupItem = document.createElement('div');
                groupItem.className = 'group-item';
                groupItem.dataset.groupId = data.groupId;
                
                groupItem.innerHTML = \`
                  <div>
                    <div class="group-name">\${groupName}</div>
                    <div class="group-metrics">\${metrics.join(', ')}</div>
                  </div>
                  <div class="group-actions">
                    <button class="action-button view-btn" onclick="viewGroup('\${data.groupId}')">View</button>
                    <button class="action-button delete-btn" onclick="deleteGroup('\${data.groupId}')">Delete</button>
                  </div>
                \`;
                
                groupList.appendChild(groupItem);
                
                // Clear form
                document.getElementById('group-name').value = '';
                checkboxes.forEach(cb => cb.checked = false);
                
                // View the new group
                viewGroup(data.groupId);
              })
              .catch(error => {
                console.error('Error creating group:', error);
                alert('Error creating group. Please try again.');
              });
            }
            
            function viewGroup(groupId) {
              // Show group chart container
              const chartContainer = document.getElementById('group-chart-container');
              chartContainer.style.display = 'block';
              
              // Update chart title
              const groupItem = document.querySelector(\`.group-item[data-group-id="\${groupId}"]\`);
              const groupName = groupItem ? groupItem.querySelector('.group-name').textContent : 'Group';
              
              document.getElementById('group-chart-title').textContent = groupName;
              
              // Update chart image
              const chartImage = document.getElementById('group-chart-image');
              chartImage.src = \`/chart/\${userToken}/group/\${groupId}?t=\${new Date().getTime()}\`;
              
              // Scroll to chart
              chartContainer.scrollIntoView({ behavior: 'smooth' });
            }
            
            function deleteGroup(groupId) {
              if (!confirm('Are you sure you want to delete this group?')) {
                return;
              }
              
              fetch('/api/' + userToken + '/groups/' + groupId, {
                method: 'DELETE'
              })
              .then(response => response.json())
              .then(data => {
                if (data.success) {
                  // Remove group from list
                  const groupItem = document.querySelector(\`.group-item[data-group-id="\${groupId}"]\`);
                  if (groupItem) {
                    groupItem.remove();
                  }
                  
                  // Hide group chart if it's the one being displayed
                  const chartImage = document.getElementById('group-chart-image');
                  if (chartImage.src.includes(\`/group/\${groupId}\`)) {
                    document.getElementById('group-chart-container').style.display = 'none';
                  }
                  
                  // If no groups left, show message
                  const groupItems = document.querySelectorAll('.group-item');
                  if (groupItems.length === 0) {
                    const groupList = document.getElementById('group-list');
                    groupList.innerHTML = '<h3>Your Groups</h3><p>No groups created yet.</p>';
                  }
                } else {
                  alert('Error deleting group: ' + data.error);
                }
              })
              .catch(error => {
                console.error('Error deleting group:', error);
                alert('Error deleting group. Please try again.');
              });
            }
            
            // Auto-refresh every 5 minutes
            setInterval(refreshChart, 300000);
            
            // Data deletion functions
            function confirmDeleteDataPoint(key, timestamp) {
              const dialog = document.getElementById('confirm-dialog');
              const title = document.getElementById('confirm-dialog-title');
              const message = document.getElementById('confirm-dialog-message');
              const confirmButton = document.getElementById('confirm-dialog-button');
              
              title.textContent = 'Delete Data Point';
              message.textContent = \`Are you sure you want to delete the data point for "\${key}"?\`;
              
              confirmButton.onclick = function() {
                deleteDataPoint(key, timestamp);
                closeConfirmDialog();
              };
              
              dialog.style.display = 'flex';
            }
            
            function confirmDeleteAllData() {
              const dialog = document.getElementById('confirm-dialog');
              const title = document.getElementById('confirm-dialog-title');
              const message = document.getElementById('confirm-dialog-message');
              const confirmButton = document.getElementById('confirm-dialog-button');
              
              title.textContent = 'Delete All Data';
              message.textContent = 'Are you sure you want to delete ALL your data? This action cannot be undone!';
              
              confirmButton.onclick = function() {
                deleteAllData();
                closeConfirmDialog();
              };
              
              dialog.style.display = 'flex';
            }
            
            function closeConfirmDialog() {
              const dialog = document.getElementById('confirm-dialog');
              dialog.style.display = 'none';
            }
            
            function deleteDataPoint(key, timestamp) {
              fetch(\`/api/\${userToken}/data/\${encodeURIComponent(key)}/\${encodeURIComponent(timestamp)}\`, {
                method: 'DELETE'
              })
              .then(response => response.json())
              .then(data => {
                if (data.success) {
                  // Refresh the data
                  refreshChart();
                } else {
                  alert('Error deleting data point: ' + (data.error || 'Unknown error'));
                }
              })
              .catch(error => {
                console.error('Error deleting data point:', error);
                alert('Error deleting data point. Please try again.');
              });
            }
            
            function deleteAllData() {
              fetch(\`/api/\${userToken}/data/all\`, {
                method: 'DELETE'
              })
              .then(response => response.json())
              .then(data => {
                if (data.success) {
                  // Refresh the data
                  refreshChart();
                } else {
                  alert('Error deleting all data: ' + (data.error || 'Unknown error'));
                }
              })
              .catch(error => {
                console.error('Error deleting all data:', error);
                alert('Error deleting all data. Please try again.');
              });
            }
          </script>
        </body>
      </html>
    `);
  }
  
  /**
   * Handle request to delete all data for a user
   */
  private handleDeleteAllData(req: Request, res: Response): void {
    try {
      const token = req.params.token;
      const userId = this.getUserIdFromToken(token);
      
      if (userId === undefined) {
        res.status(403).json({ error: 'Invalid token' });
        return;
      }
      
      // Delete all data
      dataService.clearUserData(userId);
      
      res.json({ success: true, message: 'All data deleted successfully' });
    } catch (error) {
      console.error('Error deleting all data:', error);
      res.status(500).json({ error: 'Error deleting data' });
    }
  }
  
  /**
   * Handle request to delete a specific data point
   */
  private handleDeleteDataPoint(req: Request, res: Response): void {
    try {
      const token = req.params.token;
      const key = req.params.key;
      const timestamp = req.params.timestamp;
      const userId = this.getUserIdFromToken(token);
      
      if (userId === undefined) {
        res.status(403).json({ error: 'Invalid token' });
        return;
      }
      
      // Delete the data point
      const success = dataService.deleteDataPoint(userId, key, timestamp);
      
      if (success) {
        res.json({ success: true, message: 'Data point deleted successfully' });
      } else {
        res.status(404).json({ error: 'Data point not found' });
      }
    } catch (error) {
      console.error('Error deleting data point:', error);
      res.status(500).json({ error: 'Error deleting data point' });
    }
  }
  
  /**
   * Starts the web server
   */
  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`Server running at ${this.host}`);
    });
  }
  
  /**
   * Gets the chart URL for a specific user
   * @param userId The Telegram user ID
   */
  public getUserChartUrl(userId: number): string {
    const token = this.getUserToken(userId);
    return `${this.host}/view/${token}`;
  }
}

export { Server };
