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
  LineController,
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
   * Generate a combined timeline chart with all metrics
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
    const labels = this.formatTimestamps(allTimestamps);
    
    // Get all keys (even hidden ones for consistent coloring)
    const allKeys = [...new Set(data.map(point => point.key))].sort();
    
    // Create datasets for Chart.js
    const datasets = Object.keys(dataByKey).map(key => {
      // Find the index based on the full set of keys for consistent coloring
      const index = allKeys.indexOf(key);
      
      // Generate a color based on the index
      const color = this.generateColor(index);
      
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
    
    // Create the chart
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
            beginAtZero: false
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'All Metrics Timeline',
            font: {
              size: 18
            }
          },
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                return `${label}: ${value}`;
              },
              title: function(tooltipItems) {
                return tooltipItems[0].label; // This is the date/time from the x-axis
              }
            }
          }
        }
      }
    };
    
    return this.renderChart(chartConfig, 1000, 600);
  }
  
  /**
   * Generate a chart for a specific key
   * @param data All data points
   * @param key The specific key to chart
   * @returns Buffer containing the chart image
   */
  public async generateSingleKeyChart(data: DataPoint[], key: string): Promise<Buffer> {
    // Filter data for this key
    const keyData = data.filter(point => point.key === key);
    
    if (keyData.length === 0) {
      return this.generateErrorChart(`No data available for: ${key}`);
    }
    
    // Sort by timestamp
    keyData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Extract timestamps and values
    const timestamps = keyData.map(point => point.timestamp);
    const values = keyData.map(point => point.value);
    
    // Format timestamps
    const labels = this.formatTimestamps(timestamps);
    
    // Generate color (consistent across app)
    const allKeys = [...new Set(data.map(point => point.key))].sort();
    const index = allKeys.indexOf(key);
    const color = this.generateColor(index);
    
    // Create chart config
    const chartConfig: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: key,
          data: values,
          borderColor: color,
          backgroundColor: `${color}33`,
          tension: 0.2,
          fill: false,
          pointRadius: 5, // Larger points for single metric
          pointHoverRadius: 8
        }]
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
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Value'
            },
            beginAtZero: false
          }
        },
        plugins: {
          title: {
            display: true,
            text: `${key} Timeline`,
            font: {
              size: 18
            }
          },
          legend: {
            display: false // No need for legend in single metric charts
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.parsed.y;
                return `Value: ${value}`;
              },
              title: function(tooltipItems) {
                return tooltipItems[0].label; // This is the date/time from the x-axis
              }
            }
          }
        }
      }
    };
    
    return this.renderChart(chartConfig, 800, 400);
  }
  
  /**
   * Generate a chart for multiple selected keys
   * @param data All data points
   * @param keys Array of keys to include in the chart
   * @param title Optional title for the chart
   * @returns Buffer containing the chart image
   */
  public async generateMultiKeyChart(
    data: DataPoint[], 
    keys: string[], 
    title?: string
  ): Promise<Buffer> {
    // Filter data for these keys
    const filteredData = data.filter(point => keys.includes(point.key));
    
    if (filteredData.length === 0) {
      return this.generateErrorChart("No data available for selected metrics");
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
    
    // Get unique timestamps
    const allTimestamps = [...new Set(filteredData.map(p => p.timestamp.getTime()))]
      .sort((a, b) => a - b)
      .map(t => new Date(t));
    
    // Format timestamps
    const labels = this.formatTimestamps(allTimestamps);
    
    // Get all possible keys for consistent coloring
    const allKeys = [...new Set(data.map(point => point.key))].sort();
    
    // Create datasets
    const datasets = Object.keys(dataByKey).map(key => {
      // Get consistent color
      const index = allKeys.indexOf(key);
      const color = this.generateColor(index);
      
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
        backgroundColor: `${color}33`,
        tension: 0.2,
        fill: false
      };
    });
    
    // Create chart configuration
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
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Value'
            },
            beginAtZero: false
          }
        },
        plugins: {
          title: {
            display: true,
            text: title || `Custom Group Chart`,
            font: {
              size: 18
            }
          },
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                return `${label}: ${value}`;
              },
              title: function(tooltipItems) {
                return tooltipItems[0].label; // This is the date/time from the x-axis
              }
            }
          }
        }
      }
    };
    
    return this.renderChart(chartConfig, 900, 500);
  }
  
  /**
   * Render a chart to a buffer
   * @param config The chart configuration
   * @param width Canvas width
   * @param height Canvas height
   * @returns Buffer containing the chart image
   */
  private async renderChart(config: ChartConfiguration, width: number, height: number): Promise<Buffer> {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // @ts-ignore - Type mismatch between canvas and chart.js
    new Chart(ctx, config);
    
    return canvas.toBuffer('image/png');
  }
  
  /**
   * Format timestamps for chart labels
   * @param timestamps Array of dates
   * @returns Formatted timestamp strings
   */
  private formatTimestamps(timestamps: Date[]): string[] {
    // Check if the data spans multiple days
    const hasMultipleDays = timestamps.length > 1 && timestamps.some(date => 
      date.getDate() !== timestamps[0].getDate() ||
      date.getMonth() !== timestamps[0].getMonth() ||
      date.getFullYear() !== timestamps[0].getFullYear()
    );
    
    return timestamps.map(t => {
      if (hasMultipleDays) {
        // Show date and time for multi-day datasets
        return t.toLocaleDateString() + ' ' + 
              t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        // Show only time for same-day data
        return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    });
  }
  
  /**
   * Generate a color based on an index
   * @param index The index to generate a color for
   * @returns HSL color string
   */
  private generateColor(index: number): string {
    const hue = (index * 137) % 360; // Golden angle approximation for good distribution
    return `hsl(${hue}, 70%, 60%)`;
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
    ctx.fillText('Select different metrics or groups to view data', width / 2, height / 2 + 40);
    
    return Promise.resolve(canvas.toBuffer('image/png'));
  }
}

// Singleton instance
export const chartService = new ChartService();
