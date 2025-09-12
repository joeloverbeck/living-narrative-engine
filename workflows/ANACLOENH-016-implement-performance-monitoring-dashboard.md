# ANACLOENH-016: Implement Performance Monitoring Dashboard

## Overview
Create a comprehensive performance monitoring dashboard that provides real-time visibility into clothing and anatomy system performance, cache effectiveness, and optimization results.

## Current State
- **No Real-time Monitoring**: Performance data collected but not visualized
- **Limited Visibility**: Difficult to track optimization impact
- **Manual Analysis**: Performance analysis requires manual data examination
- **No Alerts**: No proactive notification of performance degradation

## Objectives
1. Create real-time performance dashboard
2. Visualize key performance metrics and trends
3. Add performance regression detection
4. Implement automated alerting system
5. Provide optimization impact analysis
6. Enable performance troubleshooting capabilities

## Technical Requirements

### Performance Dashboard UI
```javascript
// Location: src/domUI/dashboards/PerformanceDashboard.js
class PerformanceDashboard {
  #metricsCollector;
  #container;
  #charts;
  #updateInterval;
  
  constructor({ metricsCollector, container, updateInterval = 5000 }) {
    this.#metricsCollector = metricsCollector;
    this.#container = container;
    this.#charts = new Map();
    this.#updateInterval = updateInterval;
  }
  
  initialize() {
    this.#createDashboardLayout();
    this.#initializeCharts();
    this.#startRealTimeUpdates();
    this.#setupEventHandlers();
  }
  
  #createDashboardLayout() {
    this.#container.innerHTML = `
      <div class="performance-dashboard">
        <div class="dashboard-header">
          <h2>Performance Monitoring</h2>
          <div class="dashboard-controls">
            <select id="timeRange">
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
            </select>
            <button id="exportReport">Export Report</button>
          </div>
        </div>
        
        <div class="dashboard-grid">
          <div class="metric-card" id="clothing-metrics">
            <h3>Clothing System</h3>
            <div class="metric-summary">
              <div class="metric">
                <span class="value" id="clothing-avg-time">-</span>
                <span class="label">Avg Query Time</span>
              </div>
              <div class="metric">
                <span class="value" id="clothing-cache-hit">-</span>
                <span class="label">Cache Hit Rate</span>
              </div>
              <div class="metric">
                <span class="value" id="clothing-ops-sec">-</span>
                <span class="label">Operations/sec</span>
              </div>
            </div>
            <div class="chart-container">
              <canvas id="clothingPerformanceChart"></canvas>
            </div>
          </div>
          
          <div class="metric-card" id="anatomy-metrics">
            <h3>Anatomy System</h3>
            <div class="metric-summary">
              <div class="metric">
                <span class="value" id="anatomy-graph-time">-</span>
                <span class="label">Graph Build Time</span>
              </div>
              <div class="metric">
                <span class="value" id="anatomy-validation-time">-</span>
                <span class="label">Validation Time</span>
              </div>
              <div class="metric">
                <span class="value" id="anatomy-desc-sec">-</span>
                <span class="label">Descriptions/sec</span>
              </div>
            </div>
            <div class="chart-container">
              <canvas id="anatomyPerformanceChart"></canvas>
            </div>
          </div>
          
          <div class="metric-card full-width" id="optimization-impact">
            <h3>Optimization Impact</h3>
            <div class="optimization-comparison">
              <div class="before-after">
                <div class="before">
                  <h4>Before Optimization</h4>
                  <div class="baseline-metrics" id="baseline-metrics"></div>
                </div>
                <div class="improvement">
                  <div class="improvement-arrow">→</div>
                  <div class="improvement-stats" id="improvement-stats"></div>
                </div>
                <div class="after">
                  <h4>After Optimization</h4>
                  <div class="current-metrics" id="current-metrics"></div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="metric-card full-width" id="alerts-panel">
            <h3>Performance Alerts</h3>
            <div class="alerts-list" id="alerts-list"></div>
          </div>
        </div>
      </div>
    `;
  }
  
  #initializeCharts() {
    // Clothing performance chart
    this.#charts.set('clothing', new PerformanceChart({
      canvas: document.getElementById('clothingPerformanceChart'),
      type: 'line',
      metrics: ['avgTime', 'cacheHitRate', 'operationsPerSecond'],
      colors: ['#3498db', '#2ecc71', '#f39c12']
    }));
    
    // Anatomy performance chart
    this.#charts.set('anatomy', new PerformanceChart({
      canvas: document.getElementById('anatomyPerformanceChart'),
      type: 'line',
      metrics: ['graphBuildTime', 'validationTime', 'descriptionsPerSecond'],
      colors: ['#e74c3c', '#9b59b6', '#1abc9c']
    }));
  }
  
  #startRealTimeUpdates() {
    setInterval(async () => {
      await this.#updateDashboard();
    }, this.#updateInterval);
  }
  
  async #updateDashboard() {
    const clothingMetrics = await this.#metricsCollector.getClothingMetrics();
    const anatomyMetrics = await this.#metricsCollector.getAnatomyMetrics();
    const optimizationImpact = await this.#metricsCollector.getOptimizationImpact();
    
    this.#updateClothingMetrics(clothingMetrics);
    this.#updateAnatomyMetrics(anatomyMetrics);
    this.#updateOptimizationImpact(optimizationImpact);
    this.#updateAlerts();
  }
  
  #updateClothingMetrics(metrics) {
    document.getElementById('clothing-avg-time').textContent = 
      `${metrics.avgQueryTime.toFixed(1)}ms`;
    document.getElementById('clothing-cache-hit').textContent = 
      `${(metrics.cacheHitRate * 100).toFixed(1)}%`;
    document.getElementById('clothing-ops-sec').textContent = 
      `${metrics.operationsPerSecond.toFixed(0)}`;
    
    this.#charts.get('clothing').addDataPoint({
      timestamp: Date.now(),
      avgTime: metrics.avgQueryTime,
      cacheHitRate: metrics.cacheHitRate * 100,
      operationsPerSecond: metrics.operationsPerSecond
    });
  }
  
  #updateOptimizationImpact(impact) {
    const improvementStats = document.getElementById('improvement-stats');
    
    const improvements = [
      { 
        label: 'Query Performance', 
        value: `+${(impact.queryPerformanceImprovement * 100).toFixed(1)}%` 
      },
      { 
        label: 'Cache Hit Rate', 
        value: `+${(impact.cacheHitRateImprovement * 100).toFixed(1)}%` 
      },
      { 
        label: 'Memory Efficiency', 
        value: `+${(impact.memoryEfficiencyImprovement * 100).toFixed(1)}%` 
      }
    ];
    
    improvementStats.innerHTML = improvements.map(imp => `
      <div class="improvement-metric ${imp.value.startsWith('+') ? 'positive' : 'negative'}">
        <span class="improvement-value">${imp.value}</span>
        <span class="improvement-label">${imp.label}</span>
      </div>
    `).join('');
  }
}
```

### Performance Chart Component
```javascript
// Location: src/domUI/charts/PerformanceChart.js
class PerformanceChart {
  #canvas;
  #ctx;
  #data;
  #options;
  #animationFrame;
  
  constructor({ canvas, type, metrics, colors }) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
    this.#data = { datasets: [] };
    this.#options = {
      type,
      metrics,
      colors,
      maxDataPoints: 100,
      timeWindow: 3600000 // 1 hour
    };
    
    this.#initializeDatasets();
    this.#setupCanvas();
  }
  
  addDataPoint(dataPoint) {
    const now = dataPoint.timestamp || Date.now();
    
    // Add point to each metric dataset
    for (let i = 0; i < this.#options.metrics.length; i++) {
      const metric = this.#options.metrics[i];
      const dataset = this.#data.datasets[i];
      
      dataset.data.push({
        x: now,
        y: dataPoint[metric] || 0
      });
      
      // Keep only recent data points
      const cutoffTime = now - this.#options.timeWindow;
      dataset.data = dataset.data.filter(point => point.x > cutoffTime);
      
      // Limit number of points
      if (dataset.data.length > this.#options.maxDataPoints) {
        dataset.data.shift();
      }
    }
    
    this.#scheduleRedraw();
  }
  
  #initializeDatasets() {
    this.#data.datasets = this.#options.metrics.map((metric, index) => ({
      label: this.#formatMetricLabel(metric),
      data: [],
      borderColor: this.#options.colors[index],
      backgroundColor: this.#addAlpha(this.#options.colors[index], 0.1),
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4
    }));
  }
  
  #scheduleRedraw() {
    if (this.#animationFrame) return;
    
    this.#animationFrame = requestAnimationFrame(() => {
      this.#draw();
      this.#animationFrame = null;
    });
  }
  
  #draw() {
    const { width, height } = this.#canvas;
    this.#ctx.clearRect(0, 0, width, height);
    
    if (this.#data.datasets[0].data.length < 2) return;
    
    // Draw grid
    this.#drawGrid();
    
    // Draw datasets
    this.#data.datasets.forEach((dataset, index) => {
      if (dataset.data.length > 1) {
        this.#drawDataset(dataset);
      }
    });
    
    // Draw legend
    this.#drawLegend();
  }
  
  #drawGrid() {
    const { width, height } = this.#canvas;
    this.#ctx.strokeStyle = '#e0e0e0';
    this.#ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 1; i < 5; i++) {
      const y = (height * i) / 5;
      this.#ctx.beginPath();
      this.#ctx.moveTo(0, y);
      this.#ctx.lineTo(width, y);
      this.#ctx.stroke();
    }
    
    // Vertical grid lines
    for (let i = 1; i < 10; i++) {
      const x = (width * i) / 10;
      this.#ctx.beginPath();
      this.#ctx.moveTo(x, 0);
      this.#ctx.lineTo(x, height);
      this.#ctx.stroke();
    }
  }
}
```

### Alert System
```javascript
// Location: src/common/monitoring/PerformanceAlertSystem.js
class PerformanceAlertSystem {
  #thresholds;
  #alertHistory;
  #eventBus;
  
  constructor({ eventBus, thresholds }) {
    this.#eventBus = eventBus;
    this.#thresholds = thresholds;
    this.#alertHistory = [];
  }
  
  checkMetrics(metrics) {
    const alerts = [];
    
    // Check clothing system thresholds
    if (metrics.clothing.avgQueryTime > this.#thresholds.clothing.maxQueryTime) {
      alerts.push({
        type: 'performance',
        severity: 'warning',
        system: 'clothing',
        metric: 'avgQueryTime',
        value: metrics.clothing.avgQueryTime,
        threshold: this.#thresholds.clothing.maxQueryTime,
        message: `Clothing query time (${metrics.clothing.avgQueryTime}ms) exceeds threshold`
      });
    }
    
    if (metrics.clothing.cacheHitRate < this.#thresholds.clothing.minCacheHitRate) {
      alerts.push({
        type: 'performance',
        severity: 'warning',
        system: 'clothing',
        metric: 'cacheHitRate',
        value: metrics.clothing.cacheHitRate,
        threshold: this.#thresholds.clothing.minCacheHitRate,
        message: `Clothing cache hit rate (${(metrics.clothing.cacheHitRate * 100).toFixed(1)}%) below threshold`
      });
    }
    
    // Check anatomy system thresholds
    if (metrics.anatomy.graphBuildTime > this.#thresholds.anatomy.maxGraphBuildTime) {
      alerts.push({
        type: 'performance',
        severity: 'critical',
        system: 'anatomy',
        metric: 'graphBuildTime',
        value: metrics.anatomy.graphBuildTime,
        threshold: this.#thresholds.anatomy.maxGraphBuildTime,
        message: `Anatomy graph build time (${metrics.anatomy.graphBuildTime}ms) exceeds threshold`
      });
    }
    
    // Process alerts
    for (const alert of alerts) {
      this.#processAlert(alert);
    }
    
    return alerts;
  }
  
  #processAlert(alert) {
    // Avoid duplicate alerts
    const recentAlert = this.#findRecentAlert(alert);
    if (recentAlert && Date.now() - recentAlert.timestamp < 300000) { // 5 minutes
      return;
    }
    
    // Add to history
    this.#alertHistory.push({
      ...alert,
      timestamp: Date.now(),
      id: this.#generateAlertId()
    });
    
    // Dispatch event
    this.#eventBus.dispatch({
      type: 'PERFORMANCE_ALERT',
      payload: alert
    });
  }
}
```

## Implementation Steps

1. **Dashboard UI Implementation** (Day 1-2)
   - Create dashboard layout and styling
   - Implement real-time metric displays
   - Add interactive controls

2. **Performance Charts** (Day 3)
   - Build chart component
   - Add real-time data visualization
   - Implement smooth animations

3. **Alert System** (Day 4)
   - Create performance alert system
   - Add threshold monitoring
   - Implement alert history

4. **Integration and Data Flow** (Day 5)
   - Connect to metrics collector
   - Add dashboard to main application
   - Test real-time updates

5. **Export and Analysis Features** (Day 6)
   - Add report export functionality
   - Implement trend analysis
   - Create performance insights

## File Changes

### New Files
- `src/domUI/dashboards/PerformanceDashboard.js`
- `src/domUI/charts/PerformanceChart.js`
- `src/common/monitoring/PerformanceAlertSystem.js`
- `styles/performance-dashboard.css`

### Modified Files
- `src/main.js` - Add dashboard initialization
- `src/common/metrics/PerformanceMetricsCollector.js` - Add dashboard integration

### Test Files
- `tests/unit/domUI/dashboards/PerformanceDashboard.test.js`
- `tests/integration/monitoring/dashboardIntegration.test.js`

## Dependencies
- **Prerequisites**: ANACLOENH-006 (Performance Baseline), ANACLOENH-003 (Memory Monitoring)
- **External**: Canvas API for charts
- **Internal**: PerformanceMetricsCollector, EventBus

## Acceptance Criteria
1. ✅ Real-time performance metrics visualization
2. ✅ Interactive time range selection
3. ✅ Performance alert system functional
4. ✅ Optimization impact clearly displayed
5. ✅ Dashboard updates smoothly (<100ms)
6. ✅ Export functionality works correctly
7. ✅ Responsive design for different screen sizes

## Estimated Effort: 6 days
## Success Metrics: Real-time updates <100ms, 99% dashboard uptime, clear optimization visibility