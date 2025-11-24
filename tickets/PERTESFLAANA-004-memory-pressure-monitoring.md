# PERTESFLAANA-004: Add Memory Pressure Monitoring to GOAP System

**Reference**: [Performance Test Flakiness Analysis](../docs/analysis/performance-test-flakiness-analysis.md)

## Summary

Implement memory pressure monitoring for the GOAP system to track cache sizes, detect memory issues early, and trigger automatic cleanup when thresholds are exceeded. This provides observability and self-healing capabilities to prevent memory leaks from affecting production.

## Problem Statement

While tickets PERTESFLAANA-001, 002, and 003 address the root causes of memory leaks, production systems need monitoring to:
- Detect unexpected memory growth early
- Trigger automatic cleanup under memory pressure
- Provide metrics for capacity planning
- Alert operators to potential issues

Currently, there's no visibility into GOAP system memory usage, making it difficult to diagnose issues in production.

## Files Expected to Touch

### New Files
- `src/goap/monitoring/memoryPressureMonitor.js` - New monitoring utility

### Modified Files
- `src/goap/controllers/goapController.js`
  - Integrate memory monitoring
  - Add automatic cleanup triggers
  
- `src/goap/planner/goapPlanner.js`
  - Add cache size reporting
  - Integrate with monitoring

### Test Files
- `tests/unit/goap/monitoring/memoryPressureMonitor.test.js` - New unit tests
- `tests/unit/goap/controllers/goapController.test.js` - Test monitoring integration
- `tests/integration/goap/memoryPressureIntegration.test.js` - Integration tests

## Out of Scope

**DO NOT CHANGE**:
- Bounded cache implementation (PERTESFLAANA-001)
- Failure array pruning (PERTESFLAANA-002)
- Diagnostics cleanup (PERTESFLAANA-003)
- Planning algorithm or heuristics
- Event bus system (beyond event dispatching for alerts)
- Metrics collection backend (use event system only)
- Any performance-critical hot paths
- Test thresholds or timing assertions
- Any files outside `src/goap/` and corresponding tests

## Implementation Details

### MemoryPressureMonitor API

```javascript
class MemoryPressureMonitor {
  /**
   * @param {Object} options
   * @param {Object} options.thresholds - Warning and critical thresholds
   * @param {IEventBus} options.eventBus - For dispatching alerts
   * @param {ILogger} options.logger - For logging
   */
  constructor({ thresholds, eventBus, logger });
  
  /**
   * Record cache size metric
   * @param {string} cacheName - Identifier for cache
   * @param {number} size - Current size
   */
  recordCacheSize(cacheName, size);
  
  /**
   * Check if memory pressure threshold exceeded
   * @returns {{ level: 'none'|'warning'|'critical', caches: Array }}
   */
  checkPressure();
  
  /**
   * Get current metrics snapshot
   * @returns {Object} Current memory metrics
   */
  getMetrics();
  
  /**
   * Reset all metrics
   */
  reset();
}
```

### Default Thresholds

```javascript
const DEFAULT_THRESHOLDS = {
  goalPathNormalizationCache: {
    warning: 80,  // 80% of max (100 entries)
    critical: 95, // 95% of max
  },
  goalPathDiagnostics: {
    warning: 40,  // 80% of max (50 entries)
    critical: 48,
  },
  effectFailureTelemetry: {
    warning: 160, // 80% of max (200 entries)
    critical: 190,
  },
  failedGoalsArraySize: {
    warning: 50,  // Per-actor array size
    critical: 100,
  },
  failedTasksArraySize: {
    warning: 50,
    critical: 100,
  },
};
```

### Integration with GoapController

```javascript
class GoapController {
  #memoryMonitor;
  
  constructor({ memoryMonitor, ...otherDeps }) {
    this.#memoryMonitor = memoryMonitor;
  }
  
  async decideTurn(actor, world, availableGoals = null) {
    try {
      // ... existing logic ...
      
      // Record metrics after turn
      this.#recordMemoryMetrics();
      
      // Check pressure and trigger cleanup if needed
      const pressure = this.#memoryMonitor.checkPressure();
      if (pressure.level === 'critical') {
        this.#handleMemoryPressure(pressure);
      }
      
      return plan;
    } finally {
      // ... existing cleanup ...
    }
  }
  
  #recordMemoryMetrics() {
    this.#memoryMonitor.recordCacheSize(
      'failedGoals',
      Array.from(this.#failedGoals.values())
        .reduce((sum, arr) => sum + arr.length, 0)
    );
    
    this.#memoryMonitor.recordCacheSize(
      'failedTasks',
      Array.from(this.#failedTasks.values())
        .reduce((sum, arr) => sum + arr.length, 0)
    );
    
    // Also record planner cache sizes if accessible
    if (this.#planner?.getCacheSizes) {
      const plannerSizes = this.#planner.getCacheSizes();
      for (const [name, size] of Object.entries(plannerSizes)) {
        this.#memoryMonitor.recordCacheSize(name, size);
      }
    }
  }
  
  #handleMemoryPressure(pressure) {
    this.#logger.warn('Memory pressure detected, triggering aggressive cleanup', {
      level: pressure.level,
      caches: pressure.caches,
    });
    
    // Dispatch event for external monitoring
    this.#eventBus.dispatch({
      type: 'GOAP_MEMORY_PRESSURE_DETECTED',
      payload: {
        level: pressure.level,
        metrics: this.#memoryMonitor.getMetrics(),
        timestamp: Date.now(),
      },
    });
    
    // Trigger aggressive cleanup
    for (const actorId of this.#failedGoals.keys()) {
      this.clearActorDiagnostics(actorId);
    }
    
    // Force pruning with shorter retention
    this.#pruneOldFailures(this.#failedGoals, 600000); // 10 minutes
    this.#pruneOldFailures(this.#failedTasks, 600000);
  }
}
```

### Integration with GoapPlanner

```javascript
class GoapPlanner {
  /**
   * Get current cache sizes for monitoring
   * @returns {Object} Cache name to size mapping
   */
  getCacheSizes() {
    return {
      goalPathNormalizationCache: this.#goalPathNormalizationCache.size,
      goalPathDiagnostics: this.#goalPathDiagnostics.size,
      effectFailureTelemetry: this.#effectFailureTelemetry.size,
      heuristicWarningCache: this.#heuristicWarningCache.size,
    };
  }
}
```

## Acceptance Criteria

### Specific Tests That Must Pass

1. **Unit Tests** (`tests/unit/goap/monitoring/memoryPressureMonitor.test.js`):
   - ✅ Should track cache sizes accurately
   - ✅ Should detect warning threshold exceeded
   - ✅ Should detect critical threshold exceeded
   - ✅ Should dispatch events when thresholds crossed
   - ✅ Should provide accurate metrics snapshot
   - ✅ Should handle reset correctly

2. **Unit Tests** (`tests/unit/goap/controllers/goapController.test.js`):
   - ✅ Should record metrics after each turn
   - ✅ Should trigger cleanup on critical pressure
   - ✅ Should dispatch GOAP_MEMORY_PRESSURE_DETECTED event
   - ✅ Should not affect planning when pressure is normal

3. **Integration Tests** (`tests/integration/goap/memoryPressureIntegration.test.js`):
   - ✅ Should detect pressure in realistic scenarios
   - ✅ Should trigger cleanup and recover from pressure
   - ✅ Should integrate with event bus correctly

4. **Performance Tests**:
   - ✅ Monitoring overhead < 1ms per turn
   - ✅ No degradation in planning performance
   - ✅ All existing performance tests pass

5. **System Tests**:
   - ✅ Full test suite: `npm run test:ci`
   - ✅ Linting: `npx eslint src/goap/monitoring/ src/goap/controllers/goapController.js src/goap/planner/goapPlanner.js`

### Invariants That Must Remain True

1. **Performance**:
   - Monitoring adds < 1ms overhead per turn
   - No impact on planning hot paths
   - Metrics collection is non-blocking

2. **Functional Correctness**:
   - Planning logic unaffected by monitoring
   - Cleanup triggers only on genuine pressure
   - No false positive alerts

3. **API Compatibility**:
   - MemoryPressureMonitor is opt-in via DI
   - No changes to existing public APIs
   - Backward compatible constructor parameters

4. **Observability**:
   - Metrics available for external systems
   - Events dispatched to event bus
   - Logging provides debugging context

## Testing Strategy

### Unit Testing

```javascript
describe('MemoryPressureMonitor', () => {
  it('should detect warning threshold', () => {
    const monitor = new MemoryPressureMonitor({
      thresholds: {
        testCache: { warning: 80, critical: 95 },
      },
      eventBus: mockEventBus,
      logger: mockLogger,
    });
    
    monitor.recordCacheSize('testCache', 85);
    
    const pressure = monitor.checkPressure();
    expect(pressure.level).toBe('warning');
    expect(pressure.caches).toContainEqual({
      name: 'testCache',
      size: 85,
      threshold: 80,
      level: 'warning',
    });
  });
  
  it('should dispatch event on critical pressure', () => {
    const eventBus = mockEventBus;
    const monitor = new MemoryPressureMonitor({
      thresholds: {
        testCache: { warning: 80, critical: 95 },
      },
      eventBus,
      logger: mockLogger,
    });
    
    monitor.recordCacheSize('testCache', 100);
    monitor.checkPressure();
    
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'GOAP_MEMORY_PRESSURE_CRITICAL',
      })
    );
  });
});

describe('GoapController - Memory Monitoring', () => {
  it('should record metrics after turn', async () => {
    const monitor = new MemoryPressureMonitor({
      thresholds: DEFAULT_THRESHOLDS,
      eventBus: mockEventBus,
      logger: mockLogger,
    });
    
    const controller = new GoapController({
      memoryMonitor: monitor,
      // ... other deps
    });
    
    await controller.decideTurn(actor, world);
    
    const metrics = monitor.getMetrics();
    expect(metrics.failedGoals).toBeDefined();
    expect(metrics.failedTasks).toBeDefined();
  });
  
  it('should trigger cleanup on critical pressure', async () => {
    const monitor = new MemoryPressureMonitor({
      thresholds: {
        failedGoals: { warning: 1, critical: 2 }, // Low for testing
      },
      eventBus: mockEventBus,
      logger: mockLogger,
    });
    
    const controller = new GoapController({
      memoryMonitor: monitor,
      // ... other deps
    });
    
    // Create pressure by adding failures
    for (let i = 0; i < 10; i++) {
      controller['#recordGoalFailure'](actor.id, goal, 'test');
    }
    
    await controller.decideTurn(actor, world);
    
    // Verify cleanup triggered
    const failures = controller['#failedGoals'].get(actor.id);
    expect(failures.length).toBeLessThan(10); // Should be pruned
  });
});
```

### Integration Testing

```javascript
describe('GOAP Memory Pressure Integration', () => {
  it('should detect and recover from memory pressure', async () => {
    const setup = await setupGoapIntegrationTest();
    
    // Simulate high memory usage by forcing cache growth
    for (let i = 0; i < 200; i++) {
      await setup.controller.decideTurn(setup.actor, setup.world);
      // Force failures to grow arrays
      setup.controller['#recordGoalFailure'](
        `actor${i}`,
        { type: 'TEST' },
        'test'
      );
    }
    
    // Verify pressure detected and handled
    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'GOAP_MEMORY_PRESSURE_DETECTED',
      })
    );
    
    // Verify recovery after cleanup
    const metrics = setup.monitor.getMetrics();
    expect(metrics.failedGoals).toBeLessThan(100);
  });
});
```

## Implementation Notes

1. **Opt-in Design**: Monitor is optional via dependency injection, doesn't affect systems that don't use it

2. **Low Overhead**: Metrics collection uses simple size checks, no deep traversal

3. **Event-Driven Alerts**: Use existing event bus for notifications, no new infrastructure

4. **Configurable Thresholds**: Allow tuning per deployment based on available resources

5. **Graceful Degradation**: If monitor missing, system works normally without monitoring

6. **Future Extensions**: Can add more metrics (planning time, node count, etc.) without breaking changes

## Dependencies

**Depends on:**
- PERTESFLAANA-001 (bounded caches provide size() method)
- PERTESFLAANA-002 (pruning logic to trigger under pressure)
- PERTESFLAANA-003 (cleanup methods to call under pressure)

**Should be implemented after** those tickets are complete.

## Estimated Effort

- Implementation: 3-4 hours
- Testing: 2-3 hours
- Integration: 1 hour
- Total: 6-8 hours

## Validation Checklist

Before marking complete:
- [ ] MemoryPressureMonitor implemented with full API
- [ ] Integration with GoapController complete
- [ ] getCacheSizes() added to GoapPlanner
- [ ] Unit tests pass with 100% coverage
- [ ] Integration tests demonstrate pressure detection
- [ ] Performance overhead measured < 1ms per turn
- [ ] All GOAP tests pass
- [ ] Full test suite passes (`npm run test:ci`)
- [ ] ESLint passes on all modified files
- [ ] Events dispatched correctly to event bus
- [ ] Documentation updated
- [ ] Code review completed

## Future Enhancements

Consider for future work (not this ticket):
- Metrics export to external monitoring systems (Prometheus, DataDog, etc.)
- Automatic threshold tuning based on historical data
- Predictive pressure detection using trend analysis
- Per-actor memory tracking and quotas
- Memory profiling hooks for development
