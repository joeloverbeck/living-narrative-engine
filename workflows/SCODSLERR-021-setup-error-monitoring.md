# SCODSLERR-021: Set Up Error Monitoring Dashboards

## Overview

Create monitoring dashboards and visualization tools for tracking error patterns, system health, and debugging support in real-time.

## Objectives

- Create error monitoring dashboard
- Implement real-time error tracking
- Visualize error patterns
- Set up alerting mechanisms
- Provide debugging tools

## Implementation Details

### Dashboard Location

`src/scopeDsl/monitoring/errorDashboard.html`
`src/scopeDsl/monitoring/dashboard.js`

### Dashboard Components

#### 1. Real-Time Error Monitor

```javascript
class ErrorMonitor {
  constructor({ errorHandler, updateInterval = 1000 }) {
    this.#errorHandler = errorHandler;
    this.#updateInterval = updateInterval;
    this.#subscribers = [];
  }

  start() {
    this.#intervalId = setInterval(() => {
      const data = this.#collectData();
      this.#notify(data);
    }, this.#updateInterval);
  }

  #collectData() {
    const buffer = this.#errorHandler.getErrorBuffer();
    const stats = this.#calculateStats(buffer);

    return {
      timestamp: Date.now(),
      totalErrors: buffer.length,
      errorRate: this.#calculateRate(buffer),
      recentErrors: buffer.slice(-10),
      statistics: stats,
    };
  }

  subscribe(callback) {
    this.#subscribers.push(callback);
  }
}
```

#### 2. Dashboard HTML Template

```html
<!DOCTYPE html>
<html>
  <head>
    <title>ScopeDSL Error Monitor</title>
    <style>
      .dashboard {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        padding: 20px;
      }

      .metric-card {
        background: #f5f5f5;
        border-radius: 8px;
        padding: 15px;
      }

      .error-rate {
        font-size: 2em;
        font-weight: bold;
      }

      .chart-container {
        height: 300px;
      }
    </style>
  </head>
  <body>
    <div class="dashboard">
      <!-- Summary Metrics -->
      <div class="metric-card">
        <h3>Error Rate</h3>
        <div class="error-rate" id="errorRate">0/min</div>
      </div>

      <!-- Error Categories Chart -->
      <div class="metric-card">
        <h3>Error Categories</h3>
        <canvas id="categoryChart"></canvas>
      </div>

      <!-- Timeline Chart -->
      <div class="metric-card">
        <h3>Error Timeline</h3>
        <canvas id="timelineChart"></canvas>
      </div>

      <!-- Recent Errors List -->
      <div class="metric-card">
        <h3>Recent Errors</h3>
        <div id="recentErrors"></div>
      </div>
    </div>

    <script src="dashboard.js"></script>
  </body>
</html>
```

#### 3. Visualization Components

```javascript
class DashboardVisualizer {
  constructor() {
    this.#charts = {};
    this.#initializeCharts();
  }

  #initializeCharts() {
    // Category pie chart
    this.#charts.category = new Chart('categoryChart', {
      type: 'doughnut',
      data: {
        labels: Object.values(ErrorCategories),
        datasets: [
          {
            data: [],
            backgroundColor: [
              '#FF6384',
              '#36A2EB',
              '#FFCE56',
              '#4BC0C0',
              '#9966FF',
              '#FF9F40',
            ],
          },
        ],
      },
    });

    // Timeline chart
    this.#charts.timeline = new Chart('timelineChart', {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Errors per minute',
            data: [],
            borderColor: '#FF6384',
            tension: 0.1,
          },
        ],
      },
      options: {
        scales: {
          x: { type: 'time' },
          y: { beginAtZero: true },
        },
      },
    });
  }

  updateCharts(data) {
    this.#updateCategoryChart(data.statistics.byCategory);
    this.#updateTimelineChart(data.errorRate);
    this.#updateRecentErrors(data.recentErrors);
  }
}
```

#### 4. Alert System

```javascript
class ErrorAlertSystem {
  constructor({ thresholds }) {
    this.#thresholds = thresholds;
    this.#activeAlerts = new Set();
  }

  checkThresholds(data) {
    const alerts = [];

    // Error rate threshold
    if (data.errorRate > this.#thresholds.errorRate) {
      alerts.push({
        type: 'critical',
        message: `Error rate ${data.errorRate}/min exceeds threshold`,
        timestamp: Date.now(),
      });
    }

    // Category threshold
    Object.entries(data.statistics.byCategory).forEach(([category, count]) => {
      if (count > this.#thresholds.categoryLimit) {
        alerts.push({
          type: 'warning',
          message: `${category} errors: ${count}`,
          timestamp: Date.now(),
        });
      }
    });

    return alerts;
  }

  sendAlert(alert) {
    // Console alert
    console.warn(`[ALERT] ${alert.message}`);

    // Browser notification
    if (Notification.permission === 'granted') {
      new Notification('Error Alert', {
        body: alert.message,
        icon: '/error-icon.png',
      });
    }

    // Could also send to external service
  }
}
```

#### 5. Debug Tools Panel

```javascript
class DebugPanel {
  render() {
    return `
      <div class="debug-panel">
        <h3>Debug Tools</h3>
        
        <button onclick="dashboard.clearBuffer()">
          Clear Error Buffer
        </button>
        
        <button onclick="dashboard.exportErrors()">
          Export Errors
        </button>
        
        <button onclick="dashboard.simulateError()">
          Simulate Error
        </button>
        
        <div class="filter-controls">
          <label>Filter by Category:</label>
          <select id="categoryFilter">
            <option value="">All</option>
            ${Object.values(ErrorCategories)
              .map((cat) => `<option value="${cat}">${cat}</option>`)
              .join('')}
          </select>
        </div>
        
        <div class="search-box">
          <input type="text" id="errorSearch" 
                 placeholder="Search errors...">
        </div>
      </div>
    `;
  }

  clearBuffer() {
    if (confirm('Clear all errors?')) {
      errorHandler.clearErrorBuffer();
      this.refresh();
    }
  }

  exportErrors() {
    const data = analyticsService.exportJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `errors-${Date.now()}.json`;
    a.click();
  }
}
```

### Configuration

```javascript
// dashboard-config.js
export const dashboardConfig = {
  updateInterval: 1000, // 1 second
  maxRecentErrors: 20,
  chartHistorySize: 60, // 1 minute of data

  thresholds: {
    errorRate: 10, // errors per minute
    categoryLimit: 50,
    totalErrors: 500,
  },

  colors: {
    critical: '#FF4444',
    warning: '#FFA500',
    info: '#4444FF',
    success: '#44FF44',
  },
};
```

## Acceptance Criteria

- [ ] Dashboard displays real-time data
- [ ] Charts update automatically
- [ ] Recent errors list functional
- [ ] Alert system triggers correctly
- [ ] Debug tools working
- [ ] Export functionality works
- [ ] Search and filter operational
- [ ] Performance acceptable

## Testing Requirements

- Test with various error loads
- Verify chart accuracy
- Test alert thresholds
- Validate export formats
- Performance test updates
- Browser compatibility testing

## Dependencies

- SCODSLERR-019: Analytics service
- Chart.js or similar library
- WebSocket support (optional)

## Estimated Effort

- Dashboard HTML/CSS: 3 hours
- Visualization components: 4 hours
- Alert system: 2 hours
- Debug tools: 2 hours
- Testing: 2 hours
- Total: 13 hours

## Risk Assessment

- **Medium Risk**: Browser compatibility
- **Mitigation**: Use standard APIs, test browsers

## Related Spec Sections

- Section 7: Validation Criteria
- Section 9: Future Enhancements
- Monitoring requirements

## Deployment Notes

- Can be served as static files
- Consider WebSocket for real-time updates
- May need CORS configuration
- Consider authentication for production
