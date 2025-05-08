import { createCanvas } from 'canvas';
import { DataPoint } from '../types';

// Import and register all required Chart.js components
import {
  Chart,
  ChartConfiguration,
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register all necessary components
Chart.register(
  LineController,   // This was missing - needed for 'line' chart type
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

class ChartService {
  /**
   * Generate a timeline chart image as a Buffer
   * @param data The data points to visualize
   * @param hiddenKeys Optional array of keys to hide from the chart
   * @returns Buffer containing the chart image
   */
  public async generateTimelineChart(data: DataPoint[], hiddenKeys: string[] = []): Promise<Buffer> {
    // Filter out hidden keys
    const filteredData = hiddenKeys.length > 0 
      ? data.filter(point => !hiddenKeys.includes(point.key))
      : data;
    
    // If all data is filtered out, return an error message
    if (filteredData.length === 0) {
      return this.generateErrorChart("No visible data - all metrics are hidden");
    }
    
    // Group data by key
    const dataByKey: Record<string, { 
      values: number[],
      timestamps: Date[]
    }> = {};
    
    filteredData.forEach(point => {
      if (!dataByKey[point.key]) {
        dataByKey[point.key] = {
          values: [],
          timestamps: []
        };
      }
      
      dataByKey[point.key].values.push(point.value);
      dataByKey[point.key].timestamps.push(point.timestamp);
    });
    
    // Get unique timestamps sorted by time
    const allTimestamps = [...new Set(filteredData.map(p => p.timestamp.getTime()))]
      .sort((a, b) => a - b)
      .map(t => new Date(t));
    
    // Format timestamps for x-axis
    const labels = allTimestamps.map(t => {
      // Include date in label if there's more than one day in the data
      const hasMultipleDays = allTimestamps.some(date => 
        date.getDate() !== allTimestamps[0].getDate() ||
        date.getMonth() !== allTimestamps[0].getMonth() ||
        date.getFullYear() !== allTimestamps[0].getFullYear()
      );
      
      if (hasMultipleDays) {
        // Show date and time for multi-day datasets
        return t.toLocaleDateString() + ' ' + 
               t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        // Show only time for same-day data
        return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    });
    
    // Get all keys (even hidden ones for consistent coloring)
    const allKeys = [...new Set(data.map(point => point.key))].sort();
    
    // Create datasets for Chart.js
    const datasets = Object.keys(dataByKey).map(key => {
      // Find the index based on the full set of keys for consistent coloring
      const index = allKeys.indexOf(key);
      
      // Generate a color based on the index
      const hue = (index * 137) % 360; // Golden angle approximation for good distribution
      const color = `hsl(${hue}, 70%, 60%)`;
      
      // Match data points to timestamps
      const values = new Array(allTimestamps.length).fill(null);
      
      dataByKey[key].timestamps.forEach((timestamp, i) => {
        const timestampIndex = allTimestamps.findIndex(t => t.getTime() === timestamp.getTime());
        if (timestampIndex !== -1) {
          values[timestampIndex] = dataByKey[key].values[i];
        }
      });
      
      return {
        label: key,
        data: values,
        borderColor: color,
        backgroundColor: `${color}33`, // Add 33 for 20% opacity
        tension: 0.2,
        fill: false
      };
    });
    
    // Create canvas and chart
    const width = 1000;   // Increased width for better visualization
    const height = 600;   // Increased height for better visualization
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    const chartConfig: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: false,
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Time'
            },
            ticks: {
              maxRotation: 45,  // Rotate labels for better readability
              minRotation: 45
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Value'
            },
            beginAtZero: true
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Data Timeline',
            font: {
              size: 18
            }
          },
          legend: {
            display: true,
            position: 'top'
          }
        }
      }
    };
    
    // Create the chart
    // @ts-ignore - Type mismatch between canvas and chart.js
    new Chart(ctx, chartConfig);
    
    // Convert to buffer
    return canvas.toBuffer('image/png');
  }
  
  /**
   * Generate an error chart with a message
   * @param message Error message to display
   * @returns Buffer containing the error chart image
   */
  private generateErrorChart(message: string): Promise<Buffer> {
    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, width, height);
    
    // Draw border
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    
    // Draw error message
    ctx.fillStyle = '#d32f2f';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, width / 2, height / 2);
    
    // Draw instruction
    ctx.fillStyle = '#555';
    ctx.font = '16px Arial';
    ctx.fillText('Click on a disabled legend item to show it', width / 2, height / 2 + 40);
    
    return Promise.resolve(canvas.toBuffer('image/png'));
  }
}

// Singleton instance
export const chartService = new ChartService();
