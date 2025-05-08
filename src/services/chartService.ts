import { createCanvas } from 'canvas';
import { Chart, ChartConfiguration } from 'chart.js';
import { DataPoint } from '../types';

// Register required Chart.js components
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

class ChartService {
  /**
   * Generate a timeline chart image as a Buffer
   * @param data The data points to visualize
   * @returns Buffer containing the chart image
   */
  public async generateTimelineChart(data: DataPoint[]): Promise<Buffer> {
    // Group data by key
    const dataByKey: Record<string, { 
      values: number[],
      timestamps: Date[]
    }> = {};
    
    data.forEach(point => {
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
    const allTimestamps = [...new Set(data.map(p => p.timestamp.getTime()))]
      .sort((a, b) => a - b)
      .map(t => new Date(t));
    
    // Format timestamps for x-axis (simple format: HH:MM:SS)
    const labels = allTimestamps.map(t => {
      return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
    
    // Create datasets for Chart.js
    const datasets = Object.keys(dataByKey).map((key, index) => {
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
    const width = 800;
    const height = 500;
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
    
    // @ts-ignore - There's a type mismatch between node-canvas and chart.js
    new Chart(ctx, chartConfig);
    
    // Convert to buffer
    return canvas.toBuffer('image/png');
  }
}

// Singleton instance
export const chartService = new ChartService();
