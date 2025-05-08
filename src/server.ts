import express from 'express';
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
    this.app.get('/chart', async (req, res) => {
      try {
        const data = dataService.getAllData();
        
        if (data.length === 0) {
          return res.status(404).send('No data available');
        }
        
        const chartBuffer = await chartService.generateTimelineChart(data);
        
        res.set('Content-Type', 'image/png');
        res.send(chartBuffer);
      } catch (error) {
        console.error('Error generating chart:', error);
        res.status(500).send('Error generating chart');
      }
    });
    
    // Route for serving chart page with some basic styling
    this.app.get('/view', (req, res) => {
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
              }
              .chart-container {
                background-color: white;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                margin: 20px 0;
                width: 90%;
                max-width: 1000px;
              }
              img {
                max-width: 100%;
                height: auto;
              }
              .refresh-button {
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
              }
            </style>
          </head>
          <body>
            <h1>Data Timeline Visualization</h1>
            <div class="chart-container">
              <img src="/chart" alt="Data Timeline Chart" id="chart-image">
            </div>
            <button class="refresh-button" onclick="refreshChart()">Refresh Chart</button>
            
            <script>
              function refreshChart() {
                const img = document.getElementById('chart-image');
                img.src = '/chart?' + new Date().getTime();
              }
              
              // Auto-refresh every 30 seconds
              setInterval(refreshChart, 30000);
            </script>
          </body>
        </html>
      `);
    });
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
