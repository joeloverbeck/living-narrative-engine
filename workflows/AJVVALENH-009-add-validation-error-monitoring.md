# AJVVALENH-009: Add Validation Error Monitoring

## Priority: 5 - Low

## Problem Statement
Currently, there's no systematic way to track validation errors that occur in production or development. This makes it difficult to identify common validation issues, understand which operation types cause the most problems, and prioritize improvements to schemas or documentation. A monitoring system would provide insights into validation patterns and help improve the overall system.

## Current State
- Validation errors are logged but not aggregated
- No metrics on validation success/failure rates
- No tracking of which schemas cause most errors
- No way to identify patterns in validation failures
- No alerting for validation error spikes

## Technical Requirements

### 1. Validation Metrics Collector

```javascript
// src/monitoring/ValidationMetricsCollector.js
export class ValidationMetricsCollector {
  constructor({ storage, logger, config = {} }) {
    this.#storage = storage;
    this.#logger = logger;
    this.#config = {
      enabled: true,
      sampleRate: 1.0,  // Sample 100% by default
      bufferSize: 1000,
      flushInterval: 60000,  // Flush every minute
      ...config
    };
    
    this.#buffer = [];
    this.#metrics = this.#initializeMetrics();
    this.#startFlushTimer();
  }
  
  #initializeMetrics() {
    return {
      total: 0,
      valid: 0,
      invalid: 0,
      byOperationType: new Map(),
      byErrorType: new Map(),
      byFilePath: new Map(),
      timeSeries: [],
      percentiles: {
        p50: 0,
        p95: 0,
        p99: 0
      }
    };
  }
  
  /**
   * Record a validation event
   */
  recordValidation(event) {
    if (!this.#config.enabled) return;
    
    // Sample rate check
    if (Math.random() > this.#config.sampleRate) return;
    
    const metric = {
      timestamp: Date.now(),
      operationType: event.data?.type || 'unknown',
      schemaId: event.schemaId,
      valid: event.result.valid,
      errorCount: event.result.errors?.length || 0,
      errors: this.#sanitizeErrors(event.result.errors),
      duration: event.duration,
      filePath: event.filePath,
      sessionId: event.sessionId,
      metadata: event.metadata || {}
    };
    
    // Add to buffer
    this.#buffer.push(metric);
    
    // Update real-time metrics
    this.#updateMetrics(metric);
    
    // Check if buffer needs flushing
    if (this.#buffer.length >= this.#config.bufferSize) {
      this.flush();
    }
  }
  
  #updateMetrics(metric) {
    // Update totals
    this.#metrics.total++;
    if (metric.valid) {
      this.#metrics.valid++;
    } else {
      this.#metrics.invalid++;
    }
    
    // Update by operation type
    const opStats = this.#metrics.byOperationType.get(metric.operationType) || {
      total: 0,
      valid: 0,
      invalid: 0,
      errors: []
    };
    
    opStats.total++;
    if (metric.valid) {
      opStats.valid++;
    } else {
      opStats.invalid++;
      opStats.errors.push(...metric.errors);
    }
    
    this.#metrics.byOperationType.set(metric.operationType, opStats);
    
    // Update error type tracking
    metric.errors.forEach(error => {
      const errorType = this.#classifyError(error);
      const count = this.#metrics.byErrorType.get(errorType) || 0;
      this.#metrics.byErrorType.set(errorType, count + 1);
    });
    
    // Update time series
    this.#updateTimeSeries(metric);
  }
  
  #classifyError(error) {
    if (error.message.includes('required')) return 'missing_required';
    if (error.message.includes('type')) return 'type_mismatch';
    if (error.message.includes('additional')) return 'additional_properties';
    if (error.message.includes('enum')) return 'invalid_enum';
    if (error.message.includes('pattern')) return 'pattern_mismatch';
    if (error.path.includes('parameters')) return 'parameter_error';
    return 'other';
  }
  
  async flush() {
    if (this.#buffer.length === 0) return;
    
    try {
      await this.#storage.saveBatch(this.#buffer);
      this.#buffer = [];
    } catch (error) {
      this.#logger.error('Failed to flush validation metrics', error);
    }
  }
  
  getMetrics() {
    return {
      ...this.#metrics,
      successRate: (this.#metrics.valid / this.#metrics.total * 100).toFixed(2),
      errorRate: (this.#metrics.invalid / this.#metrics.total * 100).toFixed(2),
      topErrors: this.#getTopErrors(),
      problemOperations: this.#getProblematicOperations()
    };
  }
  
  #getTopErrors() {
    return Array.from(this.#metrics.byErrorType.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));
  }
  
  #getProblematicOperations() {
    return Array.from(this.#metrics.byOperationType.entries())
      .filter(([_, stats]) => stats.invalid > 0)
      .sort((a, b) => b[1].invalid - a[1].invalid)
      .slice(0, 10)
      .map(([type, stats]) => ({
        type,
        errorRate: (stats.invalid / stats.total * 100).toFixed(2),
        totalErrors: stats.invalid,
        commonErrors: this.#getMostCommonErrors(stats.errors)
      }));
  }
}
```

### 2. Storage Backend

```javascript
// src/monitoring/storage/ValidationMetricsStorage.js
export class ValidationMetricsStorage {
  constructor(config) {
    this.backend = this.#createBackend(config.type);
  }
  
  #createBackend(type) {
    switch (type) {
      case 'memory':
        return new InMemoryStorage();
      case 'file':
        return new FileStorage();
      case 'database':
        return new DatabaseStorage();
      case 'remote':
        return new RemoteStorage();
      default:
        return new InMemoryStorage();
    }
  }
  
  async saveBatch(metrics) {
    return this.backend.saveBatch(metrics);
  }
  
  async query(options) {
    return this.backend.query(options);
  }
}

// File-based storage for development
class FileStorage {
  constructor(config = {}) {
    this.basePath = config.basePath || './validation-metrics';
    this.rotationSize = config.rotationSize || 10 * 1024 * 1024; // 10MB
    this.currentFile = null;
  }
  
  async saveBatch(metrics) {
    const date = new Date().toISOString().split('T')[0];
    const filePath = path.join(this.basePath, `metrics-${date}.jsonl`);
    
    // Ensure directory exists
    await fs.mkdir(this.basePath, { recursive: true });
    
    // Append metrics as JSON lines
    const lines = metrics.map(m => JSON.stringify(m)).join('\n') + '\n';
    await fs.appendFile(filePath, lines);
    
    // Check rotation
    await this.#checkRotation(filePath);
  }
  
  async query(options) {
    const files = await this.#getMetricFiles(options.startDate, options.endDate);
    const metrics = [];
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      
      for (const line of lines) {
        const metric = JSON.parse(line);
        
        // Apply filters
        if (this.#matchesFilters(metric, options)) {
          metrics.push(metric);
        }
      }
    }
    
    return metrics;
  }
}
```

### 3. Analytics Dashboard

```javascript
// src/monitoring/ValidationAnalyticsDashboard.js
export class ValidationAnalyticsDashboard {
  constructor({ metricsCollector, storage }) {
    this.#metricsCollector = metricsCollector;
    this.#storage = storage;
  }
  
  async generateReport(options = {}) {
    const timeRange = options.timeRange || 'last_24_hours';
    const metrics = await this.#fetchMetrics(timeRange);
    
    return {
      summary: this.#generateSummary(metrics),
      trends: this.#analyzeTrends(metrics),
      errorAnalysis: this.#analyzeErrors(metrics),
      recommendations: this.#generateRecommendations(metrics),
      visualizations: this.#prepareVisualizations(metrics)
    };
  }
  
  #generateSummary(metrics) {
    const total = metrics.length;
    const valid = metrics.filter(m => m.valid).length;
    const invalid = total - valid;
    
    return {
      totalValidations: total,
      successCount: valid,
      failureCount: invalid,
      successRate: (valid / total * 100).toFixed(2) + '%',
      averageDuration: this.#calculateAverage(metrics.map(m => m.duration)),
      uniqueOperationTypes: new Set(metrics.map(m => m.operationType)).size,
      uniqueFiles: new Set(metrics.map(m => m.filePath).filter(Boolean)).size
    };
  }
  
  #analyzeTrends(metrics) {
    // Group by hour
    const hourly = this.#groupByHour(metrics);
    
    return {
      hourlySuccessRate: hourly.map(h => ({
        hour: h.hour,
        successRate: (h.valid / h.total * 100).toFixed(2)
      })),
      peakErrorHours: this.#findPeakErrorHours(hourly),
      trendsDirection: this.#calculateTrendDirection(hourly)
    };
  }
  
  #analyzeErrors(metrics) {
    const errors = metrics
      .filter(m => !m.valid)
      .flatMap(m => m.errors);
    
    return {
      totalErrors: errors.length,
      uniqueErrorTypes: this.#categorizeErrors(errors),
      mostCommonErrors: this.#findMostCommonErrors(errors),
      errorsByOperation: this.#groupErrorsByOperation(metrics),
      errorPatterns: this.#detectErrorPatterns(errors)
    };
  }
  
  #generateRecommendations(metrics) {
    const recommendations = [];
    const errorAnalysis = this.#analyzeErrors(metrics);
    
    // Check for high error rate operations
    const problematicOps = errorAnalysis.errorsByOperation
      .filter(op => op.errorRate > 50);
    
    if (problematicOps.length > 0) {
      recommendations.push({
        priority: 'high',
        type: 'schema_improvement',
        message: `Operations ${problematicOps.map(op => op.type).join(', ')} have >50% error rate`,
        action: 'Review and improve schema validation for these operations'
      });
    }
    
    // Check for common structural errors
    const structuralErrors = errorAnalysis.uniqueErrorTypes
      .filter(e => e.type === 'missing_required' || e.type === 'additional_properties');
    
    if (structuralErrors.length > 0) {
      recommendations.push({
        priority: 'medium',
        type: 'documentation',
        message: 'Many structural errors detected',
        action: 'Improve documentation and examples for operation structure'
      });
    }
    
    // Check for performance issues
    const slowValidations = metrics.filter(m => m.duration > 100);
    if (slowValidations.length > metrics.length * 0.1) {
      recommendations.push({
        priority: 'low',
        type: 'performance',
        message: 'More than 10% of validations are slow (>100ms)',
        action: 'Consider implementing discriminated union schemas'
      });
    }
    
    return recommendations;
  }
  
  #prepareVisualizations(metrics) {
    return {
      successRateChart: {
        type: 'line',
        data: this.#prepareTimeSeriesData(metrics, 'successRate'),
        options: {
          title: 'Validation Success Rate Over Time',
          yAxis: { min: 0, max: 100, suffix: '%' }
        }
      },
      errorDistribution: {
        type: 'pie',
        data: this.#prepareErrorDistributionData(metrics),
        options: {
          title: 'Error Type Distribution'
        }
      },
      operationHeatmap: {
        type: 'heatmap',
        data: this.#prepareOperationHeatmapData(metrics),
        options: {
          title: 'Operation Validation Heatmap',
          colorScale: ['green', 'yellow', 'red']
        }
      },
      performanceHistogram: {
        type: 'histogram',
        data: metrics.map(m => m.duration),
        options: {
          title: 'Validation Duration Distribution',
          xAxis: { label: 'Duration (ms)' },
          yAxis: { label: 'Count' }
        }
      }
    };
  }
}
```

### 4. Alerting System

```javascript
// src/monitoring/ValidationAlertManager.js
export class ValidationAlertManager {
  constructor({ thresholds, notifiers }) {
    this.#thresholds = {
      errorRateHigh: 30,  // Alert if error rate > 30%
      errorRateCritical: 50,  // Critical alert if > 50%
      validationSpike: 200,  // Alert if validations/min > 200% normal
      slowValidation: 500,  // Alert if validation takes > 500ms
      ...thresholds
    };
    
    this.#notifiers = notifiers || [new ConsoleNotifier()];
    this.#baseline = null;
    this.#alerts = new Map();
  }
  
  async checkAlerts(metrics) {
    const alerts = [];
    
    // Check error rate
    const errorRate = this.#calculateErrorRate(metrics);
    if (errorRate > this.#thresholds.errorRateCritical) {
      alerts.push({
        level: 'critical',
        type: 'error_rate',
        message: `Critical: Validation error rate at ${errorRate.toFixed(2)}%`,
        value: errorRate,
        threshold: this.#thresholds.errorRateCritical
      });
    } else if (errorRate > this.#thresholds.errorRateHigh) {
      alerts.push({
        level: 'warning',
        type: 'error_rate',
        message: `Warning: Validation error rate at ${errorRate.toFixed(2)}%`,
        value: errorRate,
        threshold: this.#thresholds.errorRateHigh
      });
    }
    
    // Check for validation spikes
    const spikeDetected = this.#detectSpike(metrics);
    if (spikeDetected) {
      alerts.push({
        level: 'info',
        type: 'traffic_spike',
        message: `Validation traffic spike detected: ${spikeDetected.rate}% above normal`,
        value: spikeDetected.current,
        baseline: spikeDetected.baseline
      });
    }
    
    // Check for slow validations
    const slowValidations = metrics.filter(m => m.duration > this.#thresholds.slowValidation);
    if (slowValidations.length > 0) {
      alerts.push({
        level: 'warning',
        type: 'performance',
        message: `${slowValidations.length} slow validations detected (>${this.#thresholds.slowValidation}ms)`,
        operations: this.#groupByOperation(slowValidations)
      });
    }
    
    // Send alerts
    for (const alert of alerts) {
      await this.#sendAlert(alert);
    }
    
    return alerts;
  }
  
  async #sendAlert(alert) {
    // Deduplication
    const alertKey = `${alert.type}-${alert.level}`;
    const lastAlert = this.#alerts.get(alertKey);
    
    if (lastAlert && Date.now() - lastAlert.timestamp < 300000) {
      // Don't send same alert within 5 minutes
      return;
    }
    
    // Send to all notifiers
    for (const notifier of this.#notifiers) {
      try {
        await notifier.send(alert);
      } catch (error) {
        console.error(`Failed to send alert via ${notifier.name}:`, error);
      }
    }
    
    // Record alert
    this.#alerts.set(alertKey, {
      ...alert,
      timestamp: Date.now()
    });
  }
  
  #detectSpike(metrics) {
    if (!this.#baseline) {
      this.#baseline = this.#calculateBaseline(metrics);
      return null;
    }
    
    const current = metrics.length;
    const expected = this.#baseline.averageRate;
    const deviation = ((current - expected) / expected) * 100;
    
    if (deviation > this.#thresholds.validationSpike) {
      return {
        current,
        baseline: expected,
        rate: deviation.toFixed(2)
      };
    }
    
    return null;
  }
}
```

### 5. Integration with Main System

```javascript
// src/validation/ValidationEngineWithMonitoring.js
export class ValidationEngineWithMonitoring extends ValidationEngine {
  constructor(config) {
    super(config);
    
    this.#metricsCollector = new ValidationMetricsCollector({
      storage: new ValidationMetricsStorage(config.monitoring.storage),
      config: config.monitoring
    });
    
    this.#alertManager = new ValidationAlertManager({
      thresholds: config.monitoring.alerts,
      notifiers: config.monitoring.notifiers
    });
    
    // Start monitoring
    this.#startMonitoring();
  }
  
  async validate(data, options = {}) {
    const startTime = performance.now();
    const sessionId = options.sessionId || uuid();
    
    // Perform validation
    const result = await super.validate(data, options);
    
    // Record metrics
    const duration = performance.now() - startTime;
    this.#metricsCollector.recordValidation({
      data,
      schemaId: options.schemaId,
      result,
      duration,
      filePath: options.filePath,
      sessionId,
      metadata: {
        source: options.source || 'unknown',
        environment: process.env.NODE_ENV,
        version: this.version
      }
    });
    
    // Check for alerts
    const recentMetrics = this.#metricsCollector.getRecentMetrics(100);
    await this.#alertManager.checkAlerts(recentMetrics);
    
    return result;
  }
  
  #startMonitoring() {
    // Periodic metrics flush
    setInterval(() => {
      this.#metricsCollector.flush();
    }, 60000);
    
    // Periodic report generation
    setInterval(async () => {
      const dashboard = new ValidationAnalyticsDashboard({
        metricsCollector: this.#metricsCollector,
        storage: this.#metricsCollector.storage
      });
      
      const report = await dashboard.generateReport();
      
      // Log summary
      this.#logger.info('Validation Metrics Report', report.summary);
      
      // Check recommendations
      if (report.recommendations.length > 0) {
        this.#logger.warn('Validation Recommendations:', report.recommendations);
      }
    }, 3600000); // Every hour
  }
}
```

### 6. Monitoring CLI Commands

```javascript
// scripts/validation-monitor.js
#!/usr/bin/env node

const program = new Command();

program
  .command('report [timeRange]')
  .description('Generate validation metrics report')
  .option('--format <type>', 'Output format (json, html, text)', 'text')
  .action(async (timeRange = 'last_24_hours', options) => {
    const dashboard = new ValidationAnalyticsDashboard(config);
    const report = await dashboard.generateReport({ timeRange });
    
    switch (options.format) {
      case 'json':
        console.log(JSON.stringify(report, null, 2));
        break;
      case 'html':
        await generateHTMLReport(report);
        break;
      default:
        displayTextReport(report);
    }
  });

program
  .command('watch')
  .description('Watch real-time validation metrics')
  .action(async () => {
    const monitor = new RealTimeMonitor(config);
    await monitor.start();
  });

program
  .command('export <startDate> <endDate>')
  .description('Export metrics for analysis')
  .option('--format <type>', 'Export format (csv, json)', 'csv')
  .action(async (startDate, endDate, options) => {
    const exporter = new MetricsExporter(config);
    await exporter.export(startDate, endDate, options.format);
  });
```

## Success Criteria

### Functional Requirements
- [ ] Metrics collection works without performance impact
- [ ] Storage backends handle high volume
- [ ] Analytics provide actionable insights
- [ ] Alerting system detects issues promptly
- [ ] Dashboard visualizations are clear

### Quality Requirements
- [ ] <1% performance overhead
- [ ] Metrics accurate to 99.9%
- [ ] Alerts delivered within 1 minute
- [ ] Reports generated in <5 seconds

## Test Requirements

### Unit Tests
- Test metrics collection logic
- Test error classification
- Test alert thresholds
- Test storage backends

### Integration Tests
- Test end-to-end monitoring flow
- Test alert delivery
- Test report generation
- Test with high volume

### Performance Tests
- Measure monitoring overhead
- Test with 1000+ validations/second
- Test storage performance
- Test memory usage

## Dependencies
- Requires validation engine hooks
- Storage backend (file/database)
- Optional: Time-series database
- Optional: Visualization library

## Estimated Complexity
- **Effort**: 10-12 hours
- **Risk**: Low (additive feature)
- **Testing**: 4-5 hours

## Implementation Notes

### Configuration Example
```javascript
{
  monitoring: {
    enabled: true,
    sampleRate: 1.0,
    storage: {
      type: 'file',
      basePath: './validation-metrics'
    },
    alerts: {
      errorRateHigh: 30,
      errorRateCritical: 50,
      validationSpike: 200
    },
    notifiers: [
      { type: 'console' },
      { type: 'file', path: './alerts.log' },
      { type: 'webhook', url: 'https://...' }
    ]
  }
}
```

## Definition of Done
- [ ] Metrics collector implemented
- [ ] Storage backends functional
- [ ] Analytics dashboard complete
- [ ] Alerting system working
- [ ] CLI commands implemented
- [ ] Tests passing
- [ ] Performance targets met
- [ ] Documentation complete

## Related Tickets
- AJVVALENH-001: Complete ajvAnyOfErrorFormatter Integration
- AJVVALENH-004: Create Validation Testing Suite
- AJVVALENH-007: Build Schema Validation Debugger

## Notes
This monitoring system will provide invaluable insights into how validation is actually used in production. It will help identify pain points, common errors, and areas where schemas or documentation need improvement. The system should be designed to have minimal performance impact while providing maximum insight.