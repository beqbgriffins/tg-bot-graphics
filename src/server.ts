import express, { Request, Response } from 'express';
import { dataService } from './services/dataService';
import { chartService } from './services/chartService';
import crypto from 'crypto';

class Server {
  private app = express();
  private port: number;
  private host: string;
  private userTokens: Map<number, string> = new Map(); // Map user IDs to secure tokens
  
  constructor(port: number, host: string) {
    this.port = port;
    this.host = host;
    this.setup();
  }
  
  private setup(): void {
    // Configure middleware
    this.app.use(express.json());
    
    // Route for serving chart images
    this.app.get('/chart/:token', this.handleChartRequest.bind(this));
    
    // Route for serving chart page with some basic styling
    this.app.get('/view/:token', this.handleViewRequest.bind(this));
    
    // Route for providing JSON data
    this.app.get('/data/:token', this.handleDataRequest.bind(this));
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
    return token;
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
      const formattedData = data.map(point => ({
        ...point,
        timestamp: point.timestamp.toISOString(),
        formattedDate: point.timestamp.toLocaleDateString(),
        formattedTime: point.timestamp.toLocaleTimeString()
      }));
      
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
    
    // Get unique keys for the metric filter
    const allKeys = new Set<string>();
    data.forEach(point => {
      allKeys.add(point.key);
    });
    
    // Sort keys alphabetically
    const sortedKeys = Array.from(allKeys).sort();
    
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
            h1 {
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
            img {
              max-width: 100%;
              height: auto;
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
          </style>
        </head>
        <body>
          <h1>Your Data Timeline</h1>
          <p class="subheader">Showing ${data.length} data points across ${sortedKeys.length} metrics</p>
          
          <div class="private-notice">
            <strong>Private Dashboard</strong>: This visualization shows only your data. No one else can see your measurements.
          </div>
          
          <div class="chart-container">
            <div class="controls-header">Toggle metrics:</div>
            <div class="legend" id="legend">
              <!-- Legend items will be inserted here by JavaScript -->
            </div>
            <div id="loading" class="loading" style="display: none;">Loading...</div>
            <img src="/chart/${token}" alt="Data Timeline Chart" id="chart-image">
          </div>
          
          <button class="refresh-button" onclick="refreshChart()">Refresh Chart</button>
          
          <div class="data-table" id="data-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Metric</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody id="data-table-body">
                <!-- Data will be loaded here -->
              </tbody>
            </table>
          </div>
          
          <script>
            // Store user token
            const userToken = '${token}';
            
            // Color generation function
            function generateColor(index) {
              const hue = (index * 137) % 360; // Golden angle approximation
              return \`hsl(\${hue}, 70%, 60%)\`;
            }
            
            // Store hidden keys
            let hiddenKeys = [];
            let allData = [];
            
            // Load data on page load
            window.addEventListener('DOMContentLoaded', initializePage);
            
            function initializePage() {
              loadData().then(() => {
                createLegend();
                populateTable(allData);
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
            
            function createLegend() {
              const legendContainer = document.getElementById('legend');
              legendContainer.innerHTML = '';
              
              // Get unique keys
              const uniqueKeys = [...new Set(allData.map(item => item.key))].sort();
              
              // Create legend items
              uniqueKeys.forEach((key, index) => {
                const color = generateColor(index);
                
                const legendItem = document.createElement('div');
                legendItem.className = 'legend-item';
                legendItem.dataset.key = key;
                if (hiddenKeys.includes(key)) {
                  legendItem.classList.add('disabled');
                }
                
                const colorBox = document.createElement('div');
                colorBox.className = 'legend-color';
                colorBox.style.backgroundColor = color;
                
                const label = document.createElement('div');
                label.className = 'legend-label';
                label.textContent = key;
                
                legendItem.appendChild(colorBox);
                legendItem.appendChild(label);
                
                // Add click event
                legendItem.addEventListener('click', () => {
                  toggleKey(key, legendItem);
                });
                
                legendContainer.appendChild(legendItem);
              });
            }
            
            function toggleKey(key, element) {
              const index = hiddenKeys.indexOf(key);
              if (index === -1) {
                // Hide this key
                hiddenKeys.push(key);
                element.classList.add('disabled');
              } else {
                // Show this key
                hiddenKeys.splice(index, 1);
                element.classList.remove('disabled');
              }
              
              // Update chart
              updateChart();
              
              // Update table
              populateTable(allData);
            }
            
            function updateChart() {
              const img = document.getElementById('chart-image');
              const loading = document.getElementById('loading');
              
              // Show loading indicator
              loading.style.display = 'flex';
              
              // Generate query params
              const params = hiddenKeys.length > 0 ? \`?hidden=\${hiddenKeys.join(',')}\` : '';
              
              // Create a new image element
              const newImage = new Image();
              newImage.onload = function() {
                // When new image is loaded, replace the old one and hide loading
                img.src = newImage.src;
                loading.style.display = 'none';
              };
              newImage.onerror = function() {
                // Hide loading on error
                loading.style.display = 'none';
                alert('Error loading chart');
              };
              
              // Start loading the new image
              newImage.src = \`/chart/\${userToken}\${params}&t=\${new Date().getTime()}\`;
            }
            
            function populateTable(data) {
              const tableBody = document.getElementById('data-table-body');
              tableBody.innerHTML = '';
              
              // Filter data by visible keys
              const filteredData = data.filter(point => !hiddenKeys.includes(point.key));
              
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
                headerCell.colSpan = 4;
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
                  
                  row.appendChild(dateCell);
                  row.appendChild(timeCell);
                  row.appendChild(metricCell);
                  row.appendChild(valueCell);
                  
                  tableBody.appendChild(row);
                });
              });
            }
            
            function refreshChart() {
              // Show loading indicator
              document.getElementById('loading').style.display = 'flex';
              
              // Reload data from server
              loadData().then(() => {
                // Update legend
                createLegend();
                
                // Update chart
                updateChart();
                
                // Update table
                populateTable(allData);
              });
            }
            
            // Auto-refresh every 5 minutes
            setInterval(refreshChart, 300000);
          </script>
        </body>
      </html>
    `);
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
