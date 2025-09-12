# ANACLOENH-006: Set Up Performance Baseline Metrics

## Overview
Establish comprehensive performance baseline metrics for the clothing and anatomy systems before implementing optimizations. This will enable accurate measurement of improvement impacts and provide ongoing performance monitoring capabilities.

## Current State
- **Clothing System**: Some performance tests exist but no continuous monitoring
- **Anatomy System**: Performance tests available but no baseline tracking
- **Issues**: No historical performance data, difficult to measure improvements, no performance regression detection

## Objectives
1. Define key performance indicators (KPIs) for both systems
2. Implement automated performance benchmarking
3. Create baseline measurements for all critical operations
4. Set up continuous performance monitoring
5. Establish performance regression detection
6. Create performance dashboards and reporting

## Technical Requirements

### Performance Metrics Collector
```javascript
// Location: src/common/metrics/PerformanceMetricsCollector.js
class PerformanceMetricsCollector {
  #metrics;
  #benchmarks;
  #thresholds;
  #history;
  
  constructor({
    historyRetention = 7 * 24 * 60 * 60 * 1000, // 7 days
    aggregationInterval = 60000, // 1 minute
    eventBus
  }) {
    this.#metrics = new Map();
    this.#benchmarks = new Map();
    this.#thresholds = new Map();
    this.#history = new CircularBuffer(10000);
  }
  
  // Measurement methods
  startOperation(operationId, metadata = {})
  endOperation(operationId, metadata = {})
  measureAsync(operationId, operation, metadata = {})
  
  // Metrics calculation
  calculatePercentiles(operationName, percentiles = [50, 95, 99])
  getAverageLatency(operationName, timeWindow)
  getThroughput(operationName, timeWindow)
  
  // Baseline management
  setBaseline(operationName, metrics)
  compareToBaseline(operationName, currentMetrics)
  detectRegression(operationName, threshold = 0.1)
  
  // Reporting
  generateReport(timeRange)
  exportMetrics(format = 'json')
}
```

### Performance Benchmark Suite
```javascript
// Location: src/common/metrics/PerformanceBenchmarkSuite.js
class PerformanceBenchmarkSuite {
  #suites;
  #collector;
  #config;
  
  constructor({ collector, config }) {
    this.#suites = new Map();
    this.#collector = collector;
    this.#config = config;
  }
  
  // Benchmark registration
  registerBenchmark(name, benchmark) {
    this.#suites.set(name, {
      setup: benchmark.setup,
      teardown: benchmark.teardown,
      operations: benchmark.operations,
      iterations: benchmark.iterations || 100,
      warmup: benchmark.warmup || 10
    });
  }
  
  // Execution
  async runBenchmark(name, options = {})
  async runAllBenchmarks()
  async runContinuousBenchmarks(interval)
  
  // Analysis
  analyzeResults(results)
  compareRuns(run1, run2)
  detectAnomalies(results)
}
```

### Key Performance Indicators
```javascript
// Location: src/common/metrics/KPIDefinitions.js
export const ClothingSystemKPIs = {
  // Query operations
  'clothing.query.accessible.all': {
    baseline: { p50: 1, p95: 5, p99: 10 }, // milliseconds
    threshold: { regression: 0.2, critical: 0.5 },
    priority: 'high'
  },
  'clothing.query.accessible.topmost': {
    baseline: { p50: 5, p95: 15, p99: 30 },
    threshold: { regression: 0.25, critical: 0.5 },
    priority: 'high'
  },
  'clothing.equip.single': {
    baseline: { p50: 10, p95: 20, p99: 50 },
    threshold: { regression: 0.2, critical: 0.4 },
    priority: 'medium'
  },
  
  // Cache operations
  'clothing.cache.hit': {
    baseline: { rate: 0.8 }, // 80% hit rate
    threshold: { regression: -0.1, critical: -0.2 },
    priority: 'high'
  }
};

export const AnatomySystemKPIs = {
  // Graph operations
  'anatomy.graph.build': {
    baseline: { p50: 100, p95: 500, p99: 1000 },
    threshold: { regression: 0.3, critical: 0.6 },
    priority: 'medium'
  },
  'anatomy.graph.validate': {
    baseline: { p50: 50, p95: 200, p99: 500 },
    threshold: { regression: 0.25, critical: 0.5 },
    priority: 'high'
  },
  'anatomy.part.attach': {
    baseline: { p50: 20, p95: 50, p99: 100 },
    threshold: { regression: 0.2, critical: 0.4 },
    priority: 'high'
  },
  
  // Description generation
  'anatomy.description.generate': {
    baseline: { p50: 50, p95: 150, p99: 300 },
    threshold: { regression: 0.3, critical: 0.5 },
    priority: 'medium'
  }
};
```

### Performance Monitor
```javascript
// Location: src/common/monitoring/PerformanceMonitor.js
class PerformanceMonitor {
  #collector;
  #analyzer;
  #alertManager;
  #dashboard;
  
  constructor({ collector, eventBus, logger }) {
    this.#collector = collector;
    this.#analyzer = new PerformanceAnalyzer();
    this.#alertManager = new AlertManager({ eventBus });
    this.#dashboard = null;
  }
  
  // Monitoring
  startMonitoring(config)
  stopMonitoring()
  
  // Real-time analysis
  analyzeInRealTime()
  detectAnomalies()
  predictPerformanceIssues()
  
  // Alerting
  checkThresholds()
  sendPerformanceAlert(issue)
  
  // Reporting
  generateDailyReport()
  generateWeeklyTrends()
  exportToPrometheus()
}
```

## Implementation Steps

1. **Define KPIs and Baselines** (Day 1)
   - Identify critical operations
   - Set performance targets
   - Document KPI definitions

2. **Implement Metrics Collector** (Day 2-3)
   - Build measurement infrastructure
   - Add aggregation logic
   - Create storage mechanism

3. **Create Benchmark Suite** (Day 4-5)
   - Implement benchmark framework
   - Write benchmarks for all KPIs
   - Add automated execution

4. **Establish Baselines** (Day 6)
   - Run comprehensive benchmarks
   - Calculate baseline metrics
   - Document baseline values

5. **Build Monitoring System** (Day 7-8)
   - Implement real-time monitoring
   - Add regression detection
   - Create alerting system

6. **Create Dashboards** (Day 9-10)
   - Build performance dashboard
   - Add trend visualization
   - Implement drill-down capabilities

## File Changes

### New Files
- `src/common/metrics/PerformanceMetricsCollector.js`
- `src/common/metrics/PerformanceBenchmarkSuite.js`
- `src/common/metrics/KPIDefinitions.js`
- `src/common/metrics/PerformanceAnalyzer.js`
- `src/common/monitoring/PerformanceMonitor.js`
- `src/common/monitoring/AlertManager.js`
- `benchmarks/clothing/clothingBenchmarks.js`
- `benchmarks/anatomy/anatomyBenchmarks.js`
- `src/domUI/dashboards/PerformanceDashboard.js`

### Modified Files
- `package.json` - Add benchmark scripts
- `src/dependencyInjection/registrations/monitoringRegistrations.js` - Register metrics services
- All service files - Add performance instrumentation

### Test Files
- `tests/unit/common/metrics/PerformanceMetricsCollector.test.js`
- `tests/unit/common/metrics/PerformanceBenchmarkSuite.test.js`
- `tests/integration/metrics/performanceMonitoring.test.js`
- `tests/performance/baseline/baselineVerification.test.js`

## Dependencies
- **Prerequisites**: ANACLOENH-003 (Memory Monitoring)
- **External**: perf_hooks (Node.js), performance API (Browser)
- **Internal**: EventBus, Logger

## Acceptance Criteria
1. ✅ All KPIs have defined baselines
2. ✅ Benchmarks run automatically on schedule
3. ✅ Performance regressions detected within 5 minutes
4. ✅ Dashboard shows real-time metrics
5. ✅ Historical data retained for 7 days minimum
6. ✅ Alerts fire for threshold violations
7. ✅ Reports generated daily
8. ✅ Baseline measurements reproducible

## Testing Requirements

### Unit Tests
- Test metrics calculation accuracy
- Verify percentile calculations
- Test regression detection logic
- Validate threshold checking

### Integration Tests
- Test end-to-end metric collection
- Verify benchmark execution
- Test alert propagation

### Performance Tests
- Measure monitoring overhead (<1% impact)
- Test metric storage efficiency
- Benchmark dashboard rendering

## Risk Assessment

### Risks
1. **Measurement overhead**: Monitoring impacts performance
2. **Baseline drift**: Natural performance variations
3. **False positives**: Incorrect regression detection

### Mitigation
1. Use sampling for high-frequency operations
2. Implement statistical significance testing
3. Adjust thresholds based on variance analysis

## Estimated Effort
- **Development**: 8-10 days
- **Benchmarking**: 2 days
- **Dashboard**: 2 days
- **Total**: 12-14 days

## Success Metrics
- 100% of critical operations have baselines
- <1% performance overhead from monitoring
- 95% accuracy in regression detection
- Zero undetected performance regressions

## Benchmark Configuration Example
```javascript
// benchmarks/config/benchmark.config.js
export const benchmarkConfig = {
  clothing: {
    iterations: 1000,
    warmup: 100,
    scenarios: {
      small: { items: 10, slots: 5 },
      medium: { items: 50, slots: 10 },
      large: { items: 200, slots: 20 }
    }
  },
  anatomy: {
    iterations: 500,
    warmup: 50,
    scenarios: {
      simple: { parts: 10, depth: 3 },
      complex: { parts: 50, depth: 5 },
      extreme: { parts: 200, depth: 7 }
    }
  },
  continuous: {
    enabled: true,
    interval: 3600000, // 1 hour
    retention: 7 * 24, // 7 days of hourly data
    alerting: {
      enabled: true,
      channels: ['console', 'eventBus']
    }
  }
};
```

## Dashboard Mockup
```
Performance Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Clothing System                    Status: ✅ Healthy
├─ Query Performance (p95)         4.2ms (↓ 5%)
├─ Cache Hit Rate                  82% (↑ 2%)
├─ Equip Operations/sec            145 
└─ Memory Usage                    45MB

Anatomy System                     Status: ⚠️ Warning
├─ Graph Build (p95)               520ms (↑ 15%)
├─ Validation Time                 180ms
├─ Description Gen/sec             23
└─ Memory Usage                    128MB

Recent Regressions
• anatomy.graph.build - 15% slower (2h ago)
• clothing.cache.miss - 10% increase (4h ago)

[View Details] [Export Report] [Configure Alerts]
```

## Notes
- Consider integrating with APM tools (New Relic, DataDog)
- Add support for custom metrics via plugins
- Implement A/B testing framework for optimizations
- Create performance budget enforcement in CI/CD
- Add client-side performance monitoring for browser