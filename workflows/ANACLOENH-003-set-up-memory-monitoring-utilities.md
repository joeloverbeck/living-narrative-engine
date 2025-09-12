# ANACLOENH-003: Set Up Memory Monitoring Utilities

## Overview
Implement comprehensive memory monitoring utilities to track memory usage patterns, detect leaks, and enable proactive memory management across the clothing and anatomy systems.

## Current State
- **Clothing System**: Memory growth <10MB for 1000 operations, but no active monitoring
- **Anatomy System**: Memory growth <200MB for 100K operations, potential for optimization
- **Issues**: No real-time memory monitoring, difficult to detect gradual leaks, no memory pressure alerts

## Objectives
1. Create real-time memory usage monitoring
2. Implement memory leak detection algorithms
3. Add memory pressure alerts and thresholds
4. Create memory profiling utilities for development
5. Build memory usage dashboards and reporting

## Technical Requirements

### Memory Monitor Core
```javascript
// Location: src/common/monitoring/MemoryMonitor.js
class MemoryMonitor {
  #thresholds;
  #samplingInterval;
  #history;
  #alertHandlers;
  
  constructor({
    heapThreshold = 0.8,        // 80% of heap
    rssThreshold = 1024 * 1024 * 1024, // 1GB RSS
    samplingInterval = 5000,    // 5 seconds
    historySize = 1000,
    eventBus
  }) {
    // Implementation
  }
  
  // Core monitoring methods
  start()
  stop()
  getCurrentUsage()
  getHistory(duration)
  
  // Alert methods
  onThresholdExceeded(handler)
  onMemoryLeak(handler)
  
  // Analysis methods
  detectMemoryLeak(sensitivity = 'medium')
  analyzeGrowthPattern()
  predictOutOfMemory()
}
```

### Memory Profiler
```javascript
// Location: src/common/monitoring/MemoryProfiler.js
class MemoryProfiler {
  #snapshots;
  #operations;
  
  constructor({ logger }) {
    this.#snapshots = new Map();
    this.#operations = new Map();
  }
  
  // Profiling methods
  startProfiling(operationId)
  endProfiling(operationId)
  takeSnapshot(snapshotId)
  compareSnapshots(snapshotId1, snapshotId2)
  
  // Analysis methods
  findMemoryHotspots()
  analyzeRetainedObjects()
  generateReport()
  
  // Utility methods
  measureOperation(operation, label)
  trackObjectAllocation(className)
}
```

### Memory Pressure Manager
```javascript
// Location: src/common/monitoring/MemoryPressureManager.js
class MemoryPressureManager {
  #monitor;
  #strategies;
  #currentPressureLevel;
  
  constructor({ monitor, cache, logger }) {
    this.#monitor = monitor;
    this.#strategies = new Map();
    this.#currentPressureLevel = 'normal';
  }
  
  // Pressure management
  registerStrategy(level, strategy)
  getCurrentPressureLevel()
  
  // Automatic responses
  enableAutomaticManagement()
  setAggressiveGC(enabled)
  triggerCachePruning(level)
  
  // Manual controls
  forceGarbageCollection()
  releaseUnusedMemory()
  compactHeap()
}
```

## Implementation Steps

1. **Create Memory Monitor Core** (Day 1-2)
   - Implement basic memory sampling
   - Add threshold detection
   - Create history tracking

2. **Implement Leak Detection** (Day 3)
   - Add growth pattern analysis
   - Implement statistical leak detection
   - Create leak reporting

3. **Build Memory Profiler** (Day 4-5)
   - Implement snapshot functionality
   - Add operation tracking
   - Create comparison utilities

4. **Develop Pressure Management** (Day 6)
   - Create pressure level detection
   - Implement automatic responses
   - Add manual control methods

5. **Create Monitoring Dashboard** (Day 7-8)
   - Build real-time memory charts
   - Add alert visualization
   - Create historical analysis views

## File Changes

### New Files
- `src/common/monitoring/MemoryMonitor.js`
- `src/common/monitoring/MemoryProfiler.js`
- `src/common/monitoring/MemoryPressureManager.js`
- `src/common/monitoring/MemoryAnalyzer.js`
- `src/common/monitoring/strategies/LowMemoryStrategy.js`
- `src/common/monitoring/strategies/CriticalMemoryStrategy.js`
- `src/common/monitoring/reporters/MemoryReporter.js`
- `src/domUI/monitoring/MemoryDashboard.js`

### Modified Files
- `src/dependencyInjection/registrations/monitoringRegistrations.js` - Register monitoring services
- `src/dependencyInjection/tokens/tokens-monitoring.js` - Add monitoring tokens
- `src/common/cache/UnifiedCache.js` - Integrate with pressure manager

### Test Files
- `tests/unit/common/monitoring/MemoryMonitor.test.js`
- `tests/unit/common/monitoring/MemoryProfiler.test.js`
- `tests/unit/common/monitoring/MemoryPressureManager.test.js`
- `tests/integration/monitoring/memoryMonitoring.test.js`
- `tests/memory/monitoring/monitoringOverhead.test.js`

## Dependencies
- **Prerequisites**: ANACLOENH-001 (for cache integration)
- **External**: v8 module (for heap snapshots in Node.js)
- **Internal**: EventBus, Logger, Cache services

## Acceptance Criteria
1. ✅ Memory sampling works at configured intervals
2. ✅ Threshold alerts fire correctly
3. ✅ Leak detection identifies gradual memory growth
4. ✅ Profiler accurately measures operation memory
5. ✅ Pressure manager triggers appropriate responses
6. ✅ Dashboard displays real-time memory metrics
7. ✅ Monitoring overhead < 2% CPU and < 5MB memory
8. ✅ All tests pass with >85% coverage

## Testing Requirements

### Unit Tests
- Test threshold detection accuracy
- Verify leak detection algorithms
- Test pressure level calculations
- Validate snapshot comparisons

### Integration Tests
- Test with real clothing/anatomy operations
- Verify automatic pressure responses
- Test alert propagation through event bus

### Performance Tests
- Measure monitoring overhead
- Test sampling performance impact
- Benchmark profiling operations

### Memory Tests
- Ensure monitor doesn't cause leaks
- Test memory usage of history storage
- Verify snapshot memory cleanup

## Risk Assessment

### Risks
1. **Performance impact**: Monitoring could affect application performance
2. **False positives**: Leak detection might trigger incorrectly
3. **Memory overhead**: Monitoring itself uses memory

### Mitigation
1. Make monitoring toggleable and configurable
2. Implement adjustable sensitivity levels
3. Use circular buffers for history, limit snapshot retention

## Estimated Effort
- **Development**: 6-8 days
- **Testing**: 2-3 days
- **Dashboard**: 2 days
- **Total**: 10-13 days

## Success Metrics
- Detect 95% of memory leaks within 5 minutes
- Memory monitoring overhead < 2% CPU
- Zero false positive leak alerts in production
- 50% reduction in memory-related incidents

## Configuration Example
```javascript
// config/monitoring.config.js
export const memoryMonitoringConfig = {
  enabled: process.env.NODE_ENV !== 'production',
  sampling: {
    interval: 5000,
    historySize: 1000
  },
  thresholds: {
    heap: {
      warning: 0.7,
      critical: 0.85
    },
    rss: {
      warning: 800 * 1024 * 1024,  // 800MB
      critical: 1024 * 1024 * 1024  // 1GB
    }
  },
  leakDetection: {
    enabled: true,
    sensitivity: 'medium',
    windowSize: 100,
    growthThreshold: 0.1  // 10% growth
  },
  automaticResponse: {
    enabled: true,
    cachePruning: {
      warning: 'normal',
      critical: 'aggressive'
    },
    gcTrigger: {
      critical: true
    }
  }
};
```

## Notes
- Consider using Chrome DevTools Protocol for advanced profiling
- Implement memory dumps for post-mortem analysis
- Add Prometheus/Grafana integration for production monitoring
- Consider WebAssembly for performance-critical monitoring code