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
// Location: src/entities/monitoring/PerformanceMetricsCollector.js
class PerformanceMetricsCollector {
  #metrics;
  #benchmarks;
  #thresholds;
  #history;
  #logger;
  #eventBus;

  constructor({
    historyRetention = 7 * 24 * 60 * 60 * 1000, // 7 days
    aggregationInterval = 60000, // 1 minute
    eventBus,
    logger
  }) {
    this.#metrics = new Map();
    this.#benchmarks = new Map();
    this.#thresholds = new Map();
    this.#history = []; // Use array with maxLength instead of CircularBuffer
    this.#logger = logger;
    this.#eventBus = eventBus;
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
// Location: src/entities/monitoring/PerformanceBenchmarkSuite.js
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
// Location: src/entities/monitoring/KPIDefinitions.js
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
// Location: src/entities/monitoring/PerformanceMonitor.js
class PerformanceMonitor {
  #collector;
  #analyzer;
  #alertManager;
  #dashboard;
  
  constructor({ collector, eventBus, logger }) {
    this.#collector = collector;
    this.#analyzer = new PerformanceAnalyzer({ logger });
    this.#alertManager = { eventBus, logger }; // Use existing event dispatch patterns
    this.#dashboard = null;
  }
  
  // Monitoring
  startMonitoring(config)
  stopMonitoring()
  
  // Real-time analysis
  analyzeInRealTime()
  detectAnomalies()
  predictPerformanceIssues()
  
  // Alerting (using existing EventBus patterns)
  checkThresholds()
  dispatchPerformanceAlert(issue) // Use event dispatch instead of direct sending

  // Reporting
  generateDailyReport()
  generateWeeklyTrends()
  exportMetrics(format = 'json') // Align with existing export patterns
}
```

## Implementation Steps

1. **Define KPIs and Baselines** (Day 1)
   - Identify critical operations
   - Set performance targets
   - Document KPI definitions

2. **Extend Metrics Collector** (Day 2-3)
   - Build on existing monitoring infrastructure
   - Add performance-specific aggregation logic
   - Integrate with existing MonitoringCoordinator

3. **Create Benchmark Suite** (Day 4-5)
   - Use existing performance test patterns
   - Write benchmarks leveraging current test infrastructure
   - Integrate with existing `npm run test:performance`

4. **Establish Baselines** (Day 6)
   - Run benchmarks using existing performance test environment
   - Calculate baseline metrics following project conventions
   - Document baseline values using existing documentation patterns

5. **Build Monitoring System** (Day 7-8)
   - Extend existing PerformanceMonitor in monitoring registrations
   - Add regression detection using existing event patterns
   - Integrate alerting with existing EventBus system

6. **Create Performance Dashboard** (Day 9-10)
   - Build dashboard following existing domUI patterns
   - Add trend visualization using existing rendering conventions
   - Implement drill-down capabilities consistent with project UI patterns

## File Changes

### New Files
- `src/entities/monitoring/PerformanceMetricsCollector.js`
- `src/entities/monitoring/PerformanceBenchmarkSuite.js`
- `src/entities/monitoring/KPIDefinitions.js`
- `src/entities/monitoring/PerformanceAnalyzer.js`
- `src/entities/monitoring/PerformanceMonitor.js`
- `benchmarks/clothing/clothingBenchmarks.js`
- `benchmarks/anatomy/anatomyBenchmarks.js`
- `src/domUI/PerformanceDashboard.js`

### Modified Files
- `src/dependencyInjection/registrations/monitoringRegistrations.js` - Extend existing monitoring services
- Key clothing and anatomy service files - Add performance instrumentation
- Existing test configuration files - Integrate new performance baselines

### Test Files
- `tests/unit/entities/monitoring/PerformanceMetricsCollector.test.js`
- `tests/unit/entities/monitoring/PerformanceBenchmarkSuite.test.js`
- `tests/integration/monitoring/performanceMonitoring.test.js`
- `tests/performance/monitoring/baselineVerification.test.js`

## Dependencies
- **Prerequisites**: Existing memory monitoring system (already implemented)
- **External**: perf_hooks (Node.js), performance API (Browser) - already used in existing performance tests
- **Internal**: EventBus, Logger (already registered in DI container)

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

### Unit Tests (using existing Jest infrastructure)
- Test metrics calculation accuracy using established test patterns
- Verify percentile calculations following project conventions
- Test regression detection logic with mocked dependencies
- Validate threshold checking using existing validation patterns

### Integration Tests (extend existing performance test suite)
- Test end-to-end metric collection using existing test patterns
- Verify benchmark execution leveraging current performance test infrastructure
- Test alert propagation using existing EventBus testing patterns

### Performance Tests (use existing `npm run test:performance`)
- Measure monitoring overhead (<1% impact) using existing performance test patterns
- Test metric storage efficiency following established performance benchmarks
- Benchmark dashboard rendering using existing DOM testing patterns

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
// benchmarks/benchmark.config.js
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
- Build on existing memory monitoring system in MonitoringCoordinator
- Leverage existing performance test infrastructure (`tests/performance/`)
- Use existing dependency injection patterns and tokens
- Integrate with existing EventBus for alerts and notifications
- Follow established project coding conventions (camelCase, private fields with #)
- Ensure compatibility with existing Jest test configuration
- Use existing validation patterns from `src/utils/validationCore.js`