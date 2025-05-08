import express, { Request, Response } from 'express';
import { dataService } from './services/dataService';
import { chartService } from './services/chartService';

class Server {
  private app = express();
  private port: number;
  private host: string;
  
  constructor(port: number, host: string) {
    this.port = port;
    this.host = host;
    this.setup();
  }
  
  private setup(): void {
    // Configure middleware
    this.app.use(express.json());
    
    // Route for serving chart images
    this.app.get('/chart', this.handleChartRequest.bind(this));
    
    // Route for serving chart page with some basic styling
    this.app.get('/view', this.handleViewRequest.bind(this));
    
    // Route for providing JSON data for debugging
    this.app.get('/data', this.handleDataRequest.bind(this));
  }
  
  private async handleChartRequest(req: Request, res: Response): Promise<void> {
    try {
      const data = dataService.getAllData();
      
      if (data.length === 0) {
        res.status(404).send('No data available');
        return;
      }
      
      const chartBuffer = await chartService.generateTimelineChart(data);
      
      res.set('Content-Type', 'image/png');
      res.send(chartBuffer);
    } catch (error) {
      console.error('Error generating chart:', error);
      res.status(500).send('Error generating chart');
    }
  }
  
  private handleDataRequest(req: Request, res: Response): void {
    try {
      const data = dataService.getAllData();
      
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
    const data = dataService.getAllData();
    
    // Get unique dates for the data filter
    const uniqueDates = new Set<string>();
    const allKeys = new Set<string>();
    
    data.forEach(point => {
      uniqueDates.add(point.timestamp.toISOString().split('T')[0]);
      allKeys.add(point.key);
    });
    
    // Sort dates in reverse chronological order
    const sortedDates = Array.from(uniqueDates).sort().reverse();
    
    // Create options for the date filter
    const dateOptions = sortedDates.map(date => {
      const [year, month, day] = date.split('-');
      return `<option value="${date}">${day}.${month}.${year}</option>`;
    }).join('');
    
    // Create options for the metric filter
    const metricOptions = Array.from(allKeys).map(key => {
      return `<option value="${key}">${key}</option>`;
    }).join('');
    
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Data Timeline</title>
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
            }
            img {
              max-width: 100%;
              height: auto;
            }
            .controls {
              display: flex;
              flex-wrap: wrap;
              gap: 15px;
              margin-bottom: 20px;
              width: 100%;
              justify-content: center;
            }
            .control-group {
              display: flex;
              flex-direction: column;
              min-width: 200px;
            }
            label {
              margin-bottom: 5px;
              font-weight: bold;
              color: #333;
            }
            select, button {
              padding: 8px 12px;
              border-radius: 4px;
              border: 1px solid #ccc;
              background-color: white;
              font-size: 14px;
            }
            select {
              min-width: 150px;
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
          </style>
        </head>
        <body>
          <h1>Data Timeline Visualization</h1>
          <p class="subheader">Showing ${data.length} data points across ${uniqueDates.size} dates</p>
          
          <div class="controls">
            <div class="control-group">
              <label for="date-filter">Filter by Date:</label>
              <select id="date-filter">
                <option value="all">All Dates</option>
                ${dateOptions}
              </select>
            </div>
            
            <div class="control-group">
              <label for="metric-filter">Filter by Metric:</label>
              <select id="metric-filter">
                <option value="all">All Metrics</option>
                ${metricOptions}
              </select>
            </div>
          </div>
          
          <div class="chart-container">
            <img src="/chart" alt="Data Timeline Chart" id="chart-image">
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
            // Load data on page load
            window.addEventListener('DOMContentLoaded', loadData);
            
            function loadData() {
              fetch('/data')
                .then(response => response.json())
                .then(data => {
                  populateTable(data);
                })
                .catch(error => {
                  console.error('Error loading data:', error);
                });
            }
            
            function populateTable(data) {
              const tableBody = document.getElementById('data-table-body');
              tableBody.innerHTML = '';
              
              // Get selected filters
              const dateFilter = document.getElementById('date-filter').value;
              const metricFilter = document.getElementById('metric-filter').value;
              
              // Group data by date
              const dataByDate = {};
              
              data.forEach(point => {
                const dateStr = point.timestamp.split('T')[0];
                const matchesDateFilter = dateFilter === 'all' || dateFilter === dateStr;
                const matchesMetricFilter = metricFilter === 'all' || metricFilter === point.key;
                
                if (matchesDateFilter && matchesMetricFilter) {
                  if (!dataByDate[dateStr]) {
                    dataByDate[dateStr] = [];
                  }
                  dataByDate[dateStr].push(point);
                }
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
              const img = document.getElementById('chart-image');
              img.src = '/chart?' + new Date().getTime();
              
              // Also refresh the data table
              loadData();
            }
            
            // Handle filter changes
            document.getElementById('date-filter').addEventListener('change', function() {
              loadData();
            });
            
            document.getElementById('metric-filter').addEventListener('change', function() {
              loadData();
            });
            
            // Auto-refresh every minute
            setInterval(refreshChart, 60000);
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
   * Gets the chart URL
   */
  public getChartUrl(): string {
    return `${this.host}/view`;
  }
}

export { Server };
