# SRCBASLOG-009: Implement Monitoring and Metrics

## Overview

Implement comprehensive monitoring and metrics collection for the source-based logging categorization system. This includes real-time dashboards, alerting, and performance tracking for the 40+ log categories.

## Objectives

- Create monitoring dashboard for categorization accuracy
- Track file system impact and resource usage
- Monitor performance overhead and throughput
- Implement alerting for critical issues
- Provide migration progress tracking

## Dependencies

- SRCBASLOG-007: Performance optimizations
- SRCBASLOG-006: Migration utilities

## Implementation Details

### Monitoring Components

1. **Metrics Collector** - Gather system metrics
2. **Dashboard Server** - Real-time visualization
3. **Alert Manager** - Threshold-based alerting
4. **Report Generator** - Periodic reports
5. **Health Monitor** - System health checks

### Location

- Monitoring core: `src/logging/monitoring/` (new directory)
- Dashboard: `tools/logging-dashboard/` (new directory)
- Metrics storage: `logs/metrics/`
- Configuration: `config/monitoring-config.json`

### 1. Metrics Collector

```javascript
// src/logging/monitoring/metricsCollector.js
class LoggingMetricsCollector {
  constructor(config = {}) {
    this.#metrics = {
      categorization: new Map(),
      performance: {
        extractionTime: [],
        categorizationTime: [],
        writeTime: [],
        throughput: 0
      },
      fileSystem: {
        openHandles: 0,
        fileCount: 0,
        totalSize: 0,
        writeErrors: 0
      },
      accuracy: {
        correctCategorizations: 0,
        totalCategorizations: 0,
        byCategory: new Map()
      },
      system: {
        memoryUsage: 0,
        cpuUsage: 0,
        cacheHitRate: 0
      }
    };
    
    this.#interval = config.interval || 5000; // 5 seconds
    this.#retention = config.retention || 3600000; // 1 hour
    this.#startCollection();
  }
  
  recordCategorization(sourceCategory, detectedCategory, extractionTime) {
    // Track categorization metrics
    if (!this.#metrics.categorization.has(sourceCategory)) {
      this.#metrics.categorization.set(sourceCategory, {
        count: 0,
        errors: 0,
        avgTime: 0
      });
    }
    
    const stats = this.#metrics.categorization.get(sourceCategory);
    stats.count++;
    stats.avgTime = this.#updateMovingAverage(stats.avgTime, extractionTime, stats.count);
    
    // Track accuracy
    if (sourceCategory === detectedCategory) {
      this.#metrics.accuracy.correctCategorizations++;
    } else {
      stats.errors++;
    }
    this.#metrics.accuracy.totalCategorizations++;
    
    // Track performance
    this.#metrics.performance.extractionTime.push({
      time: extractionTime,
      timestamp: Date.now()
    });
    
    this.#pruneOldMetrics();
  }
  
  recordFileWrite(filePath, size, duration, success) {
    // Track file system metrics
    if (!success) {
      this.#metrics.fileSystem.writeErrors++;
    }
    
    this.#metrics.performance.writeTime.push({
      duration,
      size,
      timestamp: Date.now()
    });
    
    // Update throughput
    this.#updateThroughput();
  }
  
  recordSystemMetrics() {
    // Collect system metrics
    this.#metrics.system.memoryUsage = process.memoryUsage().heapUsed;
    this.#metrics.system.cpuUsage = process.cpuUsage().user;
    
    // Get cache stats from various components
    this.#metrics.system.cacheHitRate = this.#collectCacheStats();
    
    // Count open file handles
    this.#metrics.fileSystem.openHandles = this.#countOpenHandles();
  }
  
  getMetricsSummary() {
    const accuracy = this.#metrics.accuracy.totalCategorizations > 0
      ? (this.#metrics.accuracy.correctCategorizations / this.#metrics.accuracy.totalCategorizations) * 100
      : 0;
    
    const avgExtractionTime = this.#calculateAverage(
      this.#metrics.performance.extractionTime.map(m => m.time)
    );
    
    const avgWriteTime = this.#calculateAverage(
      this.#metrics.performance.writeTime.map(m => m.duration)
    );
    
    return {
      categorization: {
        totalProcessed: this.#getTotalProcessed(),
        accuracy: accuracy.toFixed(2) + '%',
        categoriesActive: this.#metrics.categorization.size,
        topCategories: this.#getTopCategories(5)
      },
      performance: {
        avgExtractionTime: avgExtractionTime.toFixed(2) + 'ms',
        avgWriteTime: avgWriteTime.toFixed(2) + 'ms',
        throughput: this.#metrics.performance.throughput.toFixed(0) + ' logs/sec',
        cacheHitRate: this.#metrics.system.cacheHitRate.toFixed(2) + '%'
      },
      fileSystem: {
        openHandles: this.#metrics.fileSystem.openHandles,
        activeFiles: this.#metrics.fileSystem.fileCount,
        totalSize: this.#formatBytes(this.#metrics.fileSystem.totalSize),
        writeErrors: this.#metrics.fileSystem.writeErrors
      },
      system: {
        memoryUsage: this.#formatBytes(this.#metrics.system.memoryUsage),
        cpuUsage: this.#metrics.system.cpuUsage.toFixed(2) + '%'
      },
      health: this.#calculateHealthScore()
    };
  }
  
  #calculateHealthScore() {
    let score = 100;
    
    // Deduct for errors
    score -= Math.min(20, this.#metrics.fileSystem.writeErrors * 2);
    
    // Deduct for low accuracy
    const accuracy = this.#metrics.accuracy.totalCategorizations > 0
      ? (this.#metrics.accuracy.correctCategorizations / this.#metrics.accuracy.totalCategorizations)
      : 1;
    score -= Math.max(0, (1 - accuracy) * 30);
    
    // Deduct for high memory usage
    const memoryMB = this.#metrics.system.memoryUsage / 1024 / 1024;
    if (memoryMB > 100) score -= Math.min(20, (memoryMB - 100) / 10);
    
    // Deduct for too many open handles
    if (this.#metrics.fileSystem.openHandles > 40) {
      score -= Math.min(15, (this.#metrics.fileSystem.openHandles - 40));
    }
    
    return Math.max(0, Math.min(100, score));
  }
}
```

### 2. Real-Time Dashboard

```javascript
// tools/logging-dashboard/server.js
const express = require('express');
const WebSocket = require('ws');
const { MetricsCollector } = require('../../src/logging/monitoring/metricsCollector');

class LoggingDashboardServer {
  constructor(port = 3002) {
    this.app = express();
    this.port = port;
    this.metricsCollector = new MetricsCollector();
    this.setupRoutes();
    this.setupWebSocket();
  }
  
  setupRoutes() {
    // Serve dashboard HTML
    this.app.use(express.static(__dirname + '/public'));
    
    // API endpoints
    this.app.get('/api/metrics/summary', (req, res) => {
      res.json(this.metricsCollector.getMetricsSummary());
    });
    
    this.app.get('/api/metrics/history', (req, res) => {
      const period = req.query.period || '1h';
      res.json(this.metricsCollector.getHistoricalMetrics(period));
    });
    
    this.app.get('/api/categories', (req, res) => {
      res.json(this.metricsCollector.getCategoryBreakdown());
    });
    
    this.app.get('/api/alerts', (req, res) => {
      res.json(this.alertManager.getActiveAlerts());
    });
  }
  
  setupWebSocket() {
    const wss = new WebSocket.Server({ port: this.port + 1 });
    
    wss.on('connection', (ws) => {
      // Send initial data
      ws.send(JSON.stringify({
        type: 'initial',
        data: this.metricsCollector.getMetricsSummary()
      }));
      
      // Send updates every 5 seconds
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'update',
            data: this.metricsCollector.getMetricsSummary()
          }));
        }
      }, 5000);
      
      ws.on('close', () => {
        clearInterval(interval);
      });
    });
  }
  
  start() {
    this.server = this.app.listen(this.port, () => {
      console.log(`Dashboard running at http://localhost:${this.port}`);
    });
  }
}
```

### 3. Dashboard HTML

```html
<!-- tools/logging-dashboard/public/index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Logging System Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    .dashboard {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      padding: 20px;
    }
    .metric-card {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .metric-value {
      font-size: 2em;
      font-weight: bold;
      color: #333;
    }
    .metric-label {
      color: #666;
      margin-bottom: 10px;
    }
    .health-score {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .health-bar {
      width: 200px;
      height: 20px;
      background: #e0e0e0;
      border-radius: 10px;
      overflow: hidden;
    }
    .health-fill {
      height: 100%;
      transition: width 0.3s, background-color 0.3s;
    }
    .health-good { background: #4caf50; }
    .health-warning { background: #ff9800; }
    .health-critical { background: #f44336; }
    .category-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-top: 20px;
    }
    .category-item {
      background: white;
      padding: 10px;
      border-radius: 4px;
      text-align: center;
      border: 1px solid #ddd;
    }
    .category-name {
      font-size: 0.9em;
      color: #666;
    }
    .category-count {
      font-size: 1.2em;
      font-weight: bold;
      color: #333;
    }
  </style>
</head>
<body>
  <h1>Source-Based Logging System Dashboard</h1>
  
  <div class="dashboard">
    <!-- Health Score -->
    <div class="metric-card">
      <div class="metric-label">System Health</div>
      <div class="health-score">
        <span class="metric-value" id="health-score">-</span>
        <div class="health-bar">
          <div class="health-fill" id="health-bar"></div>
        </div>
      </div>
    </div>
    
    <!-- Accuracy -->
    <div class="metric-card">
      <div class="metric-label">Categorization Accuracy</div>
      <div class="metric-value" id="accuracy">-</div>
    </div>
    
    <!-- Throughput -->
    <div class="metric-card">
      <div class="metric-label">Throughput</div>
      <div class="metric-value" id="throughput">-</div>
    </div>
    
    <!-- Cache Hit Rate -->
    <div class="metric-card">
      <div class="metric-label">Cache Hit Rate</div>
      <div class="metric-value" id="cache-hit-rate">-</div>
    </div>
    
    <!-- Memory Usage -->
    <div class="metric-card">
      <div class="metric-label">Memory Usage</div>
      <div class="metric-value" id="memory-usage">-</div>
    </div>
    
    <!-- File Handles -->
    <div class="metric-card">
      <div class="metric-label">Open File Handles</div>
      <div class="metric-value" id="file-handles">-</div>
    </div>
  </div>
  
  <!-- Category Distribution -->
  <div class="metric-card">
    <div class="metric-label">Category Distribution (40+ categories)</div>
    <div class="category-grid" id="category-grid"></div>
  </div>
  
  <!-- Performance Chart -->
  <div class="metric-card">
    <canvas id="performance-chart"></canvas>
  </div>
  
  <!-- Alerts -->
  <div class="metric-card">
    <div class="metric-label">Active Alerts</div>
    <div id="alerts"></div>
  </div>
  
  <script>
    const ws = new WebSocket('ws://localhost:3003');
    
    const charts = {};
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      updateDashboard(message.data);
    };
    
    function updateDashboard(data) {
      // Update health score
      const healthScore = data.health;
      document.getElementById('health-score').textContent = healthScore + '%';
      const healthBar = document.getElementById('health-bar');
      healthBar.style.width = healthScore + '%';
      healthBar.className = 'health-fill ' + 
        (healthScore >= 80 ? 'health-good' : 
         healthScore >= 60 ? 'health-warning' : 'health-critical');
      
      // Update metrics
      document.getElementById('accuracy').textContent = data.categorization.accuracy;
      document.getElementById('throughput').textContent = data.performance.throughput;
      document.getElementById('cache-hit-rate').textContent = data.performance.cacheHitRate;
      document.getElementById('memory-usage').textContent = data.system.memoryUsage;
      document.getElementById('file-handles').textContent = data.fileSystem.openHandles;
      
      // Update category grid
      updateCategoryGrid(data.categorization.byCategory);
      
      // Update performance chart
      updatePerformanceChart(data.performance);
    }
    
    function updateCategoryGrid(categories) {
      const grid = document.getElementById('category-grid');
      grid.innerHTML = '';
      
      // All 40+ categories
      const allCategories = [
        'actions', 'logic', 'entities', 'ai', 'domUI', 'engine', 'events',
        'loaders', 'scopeDsl', 'initializers', 'dependencyInjection', 'logging',
        'config', 'utils', 'services', 'constants', 'storage', 'types',
        'alerting', 'context', 'turns', 'adapters', 'query', 'characterBuilder',
        'prompting', 'anatomy', 'scheduling', 'errors', 'interfaces', 'clothing',
        'input', 'testing', 'configuration', 'modding', 'persistence', 'data',
        'shared', 'bootstrapper', 'commands', 'thematicDirection', 'models',
        'llms', 'validation', 'pathing', 'formatting', 'ports', 'shutdown',
        'common', 'tests', 'llm-proxy', 'general'
      ];
      
      allCategories.forEach(category => {
        const item = document.createElement('div');
        item.className = 'category-item';
        
        const name = document.createElement('div');
        name.className = 'category-name';
        name.textContent = category;
        
        const count = document.createElement('div');
        count.className = 'category-count';
        count.textContent = categories[category] || 0;
        
        item.appendChild(name);
        item.appendChild(count);
        grid.appendChild(item);
      });
    }
  </script>
</body>
</html>
```

### 4. Alert Manager

```javascript
// src/logging/monitoring/alertManager.js
class AlertManager {
  constructor(config = {}) {
    this.#alerts = [];
    this.#thresholds = {
      errorRate: config.errorRate || 0.01,
      accuracy: config.accuracy || 0.95,
      memoryUsage: config.memoryUsage || 100 * 1024 * 1024, // 100MB
      fileHandles: config.fileHandles || 45,
      throughput: config.throughput || 1000,
      responseTime: config.responseTime || 10
    };
    this.#notifiers = [];
  }
  
  checkThresholds(metrics) {
    const alerts = [];
    
    // Check error rate
    if (metrics.fileSystem.writeErrors / metrics.categorization.totalProcessed > this.#thresholds.errorRate) {
      alerts.push({
        level: 'critical',
        type: 'error-rate',
        message: `Error rate exceeds ${this.#thresholds.errorRate * 100}%`,
        value: metrics.fileSystem.writeErrors,
        threshold: this.#thresholds.errorRate
      });
    }
    
    // Check accuracy
    const accuracy = metrics.categorization.accuracy.replace('%', '') / 100;
    if (accuracy < this.#thresholds.accuracy) {
      alerts.push({
        level: 'warning',
        type: 'accuracy',
        message: `Categorization accuracy below ${this.#thresholds.accuracy * 100}%`,
        value: accuracy,
        threshold: this.#thresholds.accuracy
      });
    }
    
    // Check memory usage
    if (metrics.system.memoryUsage > this.#thresholds.memoryUsage) {
      alerts.push({
        level: 'warning',
        type: 'memory',
        message: 'Memory usage exceeds threshold',
        value: metrics.system.memoryUsage,
        threshold: this.#thresholds.memoryUsage
      });
    }
    
    // Check file handles
    if (metrics.fileSystem.openHandles > this.#thresholds.fileHandles) {
      alerts.push({
        level: 'critical',
        type: 'file-handles',
        message: 'Approaching file handle limit',
        value: metrics.fileSystem.openHandles,
        threshold: this.#thresholds.fileHandles
      });
    }
    
    // Process alerts
    alerts.forEach(alert => this.#processAlert(alert));
    
    return alerts;
  }
  
  #processAlert(alert) {
    // Check if alert is already active
    const existing = this.#alerts.find(a => 
      a.type === alert.type && a.level === alert.level
    );
    
    if (!existing) {
      alert.id = Date.now().toString();
      alert.timestamp = new Date().toISOString();
      alert.acknowledged = false;
      
      this.#alerts.push(alert);
      this.#notifyAlert(alert);
    }
  }
  
  #notifyAlert(alert) {
    // Send notifications
    this.#notifiers.forEach(notifier => {
      notifier.notify(alert);
    });
    
    // Log critical alerts
    if (alert.level === 'critical') {
      console.error(`CRITICAL ALERT: ${alert.message}`);
    }
  }
}
```

### 5. Migration Progress Monitor

```javascript
// src/logging/monitoring/migrationProgressMonitor.js
class MigrationProgressMonitor {
  constructor() {
    this.#checkpoints = [];
    this.#phases = {
      'off': { order: 0, status: 'complete' },
      'shadow': { order: 1, status: 'pending' },
      'dual': { order: 2, status: 'pending' },
      'primary': { order: 3, status: 'pending' },
      'complete': { order: 4, status: 'pending' }
    };
    this.#currentPhase = 'off';
  }
  
  recordPhaseTransition(fromPhase, toPhase, success, metrics) {
    this.#checkpoints.push({
      timestamp: new Date().toISOString(),
      from: fromPhase,
      to: toPhase,
      success,
      metrics: {
        accuracy: metrics.accuracy,
        errorRate: metrics.errorRate,
        performance: metrics.performanceImpact
      }
    });
    
    if (success) {
      this.#phases[toPhase].status = 'active';
      this.#phases[fromPhase].status = 'complete';
      this.#currentPhase = toPhase;
    }
  }
  
  getMigrationStatus() {
    const totalPhases = Object.keys(this.#phases).length;
    const completedPhases = Object.values(this.#phases)
      .filter(p => p.status === 'complete').length;
    
    const progress = (completedPhases / totalPhases) * 100;
    
    return {
      currentPhase: this.#currentPhase,
      progress: progress.toFixed(1) + '%',
      phases: this.#phases,
      checkpoints: this.#checkpoints,
      estimatedCompletion: this.#estimateCompletion(),
      readinessScore: this.#calculateReadiness()
    };
  }
  
  #estimateCompletion() {
    if (this.#checkpoints.length < 2) return 'Unknown';
    
    const avgPhaseDuration = this.#calculateAveragePhaseDuration();
    const remainingPhases = Object.values(this.#phases)
      .filter(p => p.status === 'pending').length;
    
    const estimatedMs = avgPhaseDuration * remainingPhases;
    const estimatedDate = new Date(Date.now() + estimatedMs);
    
    return estimatedDate.toISOString();
  }
  
  #calculateReadiness() {
    // Get latest metrics
    const latest = this.#checkpoints[this.#checkpoints.length - 1];
    if (!latest) return 0;
    
    let score = 100;
    
    // Deduct for poor accuracy
    score -= Math.max(0, (1 - latest.metrics.accuracy) * 50);
    
    // Deduct for high error rate
    score -= Math.max(0, latest.metrics.errorRate * 200);
    
    // Deduct for performance impact
    score -= Math.max(0, latest.metrics.performance - 5);
    
    return Math.max(0, Math.min(100, score));
  }
}
```

## Success Criteria

- [ ] Real-time metrics collection working
- [ ] Dashboard displays all 40+ categories
- [ ] Alert thresholds configured and functional
- [ ] Migration progress tracking accurate
- [ ] Performance metrics within targets
- [ ] Health score calculation accurate
- [ ] WebSocket updates working
- [ ] Historical data retention working

## Risk Assessment

### Risks

1. **Monitoring Overhead**
   - Mitigation: Efficient metric collection
   - Sampling for high-volume metrics
   - Async metric processing

2. **Dashboard Performance**
   - Mitigation: Data aggregation
   - Pagination for large datasets
   - Client-side caching

3. **Alert Fatigue**
   - Mitigation: Smart thresholds
   - Alert deduplication
   - Severity-based routing

## Estimated Effort

- Implementation: 8-10 hours
- Dashboard development: 4-5 hours
- Testing: 3-4 hours
- Documentation: 2 hours
- Total: 17-21 hours

## Follow-up Tasks

- SRCBASLOG-010: Create operational documentation
- Setup production monitoring infrastructure