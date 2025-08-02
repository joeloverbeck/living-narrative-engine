# Ticket #13: Performance Monitoring and Optimization

## Overview

Add comprehensive performance monitoring to the BaseCharacterBuilderController to track initialization time, operation performance, and identify optimization opportunities. This will help ensure the base controller meets performance targets and provides insights for future improvements.

## Priority

**Low** - Performance monitoring is valuable but not critical for initial release.

## Dependencies

- Tickets #1-12: Complete base controller implementation (completed)

## Estimated Effort

**1-2 hours**

## Acceptance Criteria

1. ✅ Performance metrics collection implemented
2. ✅ Initialization time tracking with phase breakdown
3. ✅ Operation timing for key methods
4. ✅ Memory usage monitoring
5. ✅ Performance reporting utilities
6. ✅ Configurable performance thresholds
7. ✅ Performance optimization recommendations
8. ✅ Dashboard or log output for metrics

## Implementation Details

### 1. Performance Monitoring Integration

Integrate existing `src/entities/monitoring/PerformanceMonitor.js` with BaseCharacterBuilderController:

**Key Integration Points:**

- Use existing PerformanceMonitor class (comprehensive implementation already available)
- Leverage existing timing infrastructure in BaseCharacterBuilderController
- Extend current performance tracking (lines 1775, 1830, 3082 in BaseCharacterBuilderController.js)
- Integrate with existing private field patterns (`#` prefix)

**Existing PerformanceMonitor Features:**

- Timer management with `startTimer()` and `stopTimer()`
- Operation tracking with `timeOperation()` and `timeSync()`
- Memory monitoring with `checkMemoryUsage()`
- Metrics collection with `getMetrics()`
- Performance reporting with `getPerformanceReport()`

### 2. BaseCharacterBuilderController Integration

Add performance monitoring to the existing BaseCharacterBuilderController by injecting the PerformanceMonitor:

```javascript
// Add to imports in BaseCharacterBuilderController.js
import PerformanceMonitor from '../../entities/monitoring/PerformanceMonitor.js';

// Add to private fields (around line 100)
/** @private @type {PerformanceMonitor} */
#performanceMonitor;

// Add to constructor dependency injection (around line 145)
// Note: Use additionalServices pattern to inject performanceMonitor
const { performanceMonitor } = this.#additionalServices;
if (performanceMonitor) {
  this.#performanceMonitor = performanceMonitor;
}
```

### 3. Enhanced Initialize Method

Extend the existing initialization performance tracking (currently at lines 1775-1842):

```javascript
// Current timing code exists at line 1775:
// const startTime = performance.now();

// Enhance with detailed phase tracking using PerformanceMonitor
async initialize() {
  if (this.isInitialized) {
    this.logger.warn(
      `${this.constructor.name}: Already initialized, skipping re-initialization`
    );
    return;
  }

  if (this.isInitializing) {
    this.logger.warn(
      `${this.constructor.name}: Initialization already in progress, skipping concurrent initialization`
    );
    return;
  }

  // Use existing timing + enhanced monitoring if available
  const startTime = performance.now();
  let initTimerId = null;

  if (this.#performanceMonitor) {
    initTimerId = this.#performanceMonitor.startTimer('controller_initialization', {
      controller: this.constructor.name,
    });
  }

  try {
    // Set initializing state (existing logic at line 1779)
    this._setInitializationState(true, false);

    this.logger.info(`${this.constructor.name}: Starting initialization`);

    // Phase 1: Pre-initialization hook
    if (this.#performanceMonitor) {
      await this.#performanceMonitor.timeOperation(
        'pre_initialization',
        () => this._executeLifecycleMethod('_preInitialize', 'pre-initialization')
      );
    } else {
      await this._executeLifecycleMethod('_preInitialize', 'pre-initialization');
    }

    // Phase 2: Cache DOM elements (existing at line 1790)
    if (this.#performanceMonitor) {
      await this.#performanceMonitor.timeOperation(
        'element_caching',
        () => this._executeLifecycleMethod('_cacheElements', 'element caching', true)
      );
    } else {
      await this._executeLifecycleMethod('_cacheElements', 'element caching', true);
    }

    // Continue with existing phases...
    // (Lines 1796-1825 contain the remaining lifecycle methods)

    // Set initialized state (existing logic at line 1828)
    this._setInitializationState(false, true);

    const initTime = performance.now() - startTime;

    // Enhanced logging with performance monitor data
    if (this.#performanceMonitor) {
      const perfData = this.#performanceMonitor.stopTimer(initTimerId);
      this.logger.info(
        `${this.constructor.name}: Initialization completed in ${initTime.toFixed(2)}ms`,
        { performanceData: perfData }
      );
    } else {
      // Existing logging at line 1831
      this.logger.info(
        `${this.constructor.name}: Initialization completed in ${initTime.toFixed(2)}ms`
      );
    }

    // Existing event dispatch (lines 1836-1841)
    if (this.eventBus) {
      this.eventBus.dispatch('CONTROLLER_INITIALIZED', {
        controllerName: this.constructor.name,
        initializationTime: initTime,
      });
    }
  } catch (error) {
    // Enhanced error handling
    const initTime = performance.now() - startTime;
    if (this.#performanceMonitor && initTimerId) {
      this.#performanceMonitor.stopTimer(initTimerId);
    }

    // Existing error handling (lines 1842-1854)
    this.logger.error(
      `${this.constructor.name}: Initialization failed after ${initTime.toFixed(2)}ms`,
      error
    );
    this._setInitializationState(false, false);
    await this._handleInitializationError(error);
    throw error;
  }
}

```

### 4. Enhanced Destroy Method

Extend the existing destroy performance tracking (currently at lines 3081-3170):

```javascript
// Current timing code exists at line 3082:
// const startTime = performance.now();

// Enhanced destroy with performance monitoring
destroy() {
  const startTime = performance.now();
  let destroyTimerId = null;

  // Check if already destroyed (existing logic at line 3085)
  if (this.#isDestroyed) {
    this.#logger.warn(
      `${this.constructor.name}: Already destroyed, skipping destruction`
    );
    return;
  }

  if (this.#performanceMonitor) {
    destroyTimerId = this.#performanceMonitor.startTimer('controller_destroy', {
      controller: this.constructor.name,
    });
  }

  try {
    // Set destroying state (existing logic at line 3100)
    this.#isDestroying = true;
    this.#logger.info(`${this.constructor.name}: Starting destruction`);

    // Execute existing destruction phases (lines 3103-3131)
    // Enhanced with performance monitoring if available
    this._executePhase('event listener cleanup', () => this._removeEventListeners());
    this._executePhase('timer cleanup', () => this._clearTimers());
    // ... continue with existing phases

    // Mark as destroyed (existing logic at line 3137)
    this.#isDestroyed = true;
    this.#isDestroying = false;

    const duration = performance.now() - startTime;

    // Enhanced logging
    if (this.#performanceMonitor) {
      const perfData = this.#performanceMonitor.stopTimer(destroyTimerId);
      this.#logger.info(
        `${this.constructor.name}: Destruction completed in ${duration.toFixed(2)}ms`,
        { performanceData: perfData }
      );
    } else {
      // Existing logging at line 3141
      this.#logger.info(
        `${this.constructor.name}: Destruction completed in ${duration.toFixed(2)}ms`
      );
    }
  } catch (error) {
    // Enhanced error handling
    if (this.#performanceMonitor && destroyTimerId) {
      this.#performanceMonitor.stopTimer(destroyTimerId);
    }
    // Existing error handling continues...
    this.#isDestroyed = true;
    this.#isDestroying = false;
    throw error;
  }
}
```

### 5. Performance Monitoring for Key Operations

Optionally enhance specific operations with performance monitoring:

```javascript
// Enhanced state transitions (existing method around line 1050)
_showState(state, options = {}) {
  if (this.#performanceMonitor) {
    return this.#performanceMonitor.timeSync(
      'state_transition',
      () => {
        // Call existing implementation
        const previousState = this.#uiStateManager.getCurrentState();
        // ... existing state transition logic
        this.#uiStateManager.showState(state, message);
      },
      `from_${this.#uiStateManager.getCurrentState()}_to_${state}`
    );
  } else {
    // Existing implementation without monitoring
    const previousState = this.#uiStateManager.getCurrentState();
    // ... existing logic
    this.#uiStateManager.showState(state, message);
  }
}

// Enhanced element caching (existing method around line 567)
_cacheElement(key, selector, required = true) {
  if (this.#performanceMonitor) {
    return this.#performanceMonitor.timeSync(
      'element_caching',
      () => {
        // Call existing implementation (lines 567-596)
        const startTime = performance.now();
        // ... existing caching logic
        const element = document.querySelector(selector);
        if (element) {
          this.#elements[key] = element;
        }
        // ... existing validation and logging
        return element;
      },
      `cache_${key}`
    );
  } else {
    // Use existing implementation as-is
    const startTime = performance.now();
    // ... existing caching logic
  }
}
```

### 6. Cross-Browser Memory Monitoring

Add memory monitoring using the existing PerformanceMonitor infrastructure:

```javascript
/**
 * Enhanced memory monitoring using existing PerformanceMonitor
 * @protected
 */
_logMemoryUsage(context) {
  if (this.#performanceMonitor) {
    // Use existing PerformanceMonitor memory checking (checkMemoryUsage method)
    this.#performanceMonitor.checkMemoryUsage();

    this.logger.debug(
      `${this.constructor.name}: Memory check at ${context}`
    );
  } else {
    // Fallback: track DOM elements and event listeners as memory indicators
    const elementCount = Object.keys(this.elements).length;
    const listenerCount = this.#eventListeners.length;
    const timerCount = this.#pendingTimers.size + this.#pendingIntervals.size;

    this.logger.debug(
      `${this.constructor.name}: Resource usage at ${context}`,
      {
        cachedElements: elementCount,
        eventListeners: listenerCount,
        activeTimers: timerCount,
      }
    );

    // Warn on high resource usage
    if (elementCount > 100 || listenerCount > 50 || timerCount > 20) {
      this.logger.warn(
        `${this.constructor.name}: High resource usage detected`,
        { elementCount, listenerCount, timerCount }
      );
    }
  }
}

// Add memory logging to existing lifecycle methods
// Note: These would be added to existing _postInitialize/_preDestroy hooks if they exist
_logMemoryAfterInitialization() {
  this._logMemoryUsage('post-initialization');
}

_logMemoryBeforeDestruction() {
  this._logMemoryUsage('pre-destruction');
}
```

### 7. Performance Dashboard

Create a simple performance dashboard using existing data:

```javascript
/**
 * Get performance dashboard data
 * @public
 * @returns {object} Dashboard data
 */
getPerformanceDashboard() {
  const dashboard = {
    controller: this.constructor.name,
    initialized: this.isInitialized,
    destroyed: this.isDestroyed,
    elementCount: Object.keys(this.elements).length,
    eventListenerCount: this.#eventListeners.length,
    timerCount: this.#pendingTimers.size,
    intervalCount: this.#pendingIntervals.size,
    cleanupTaskCount: this.#cleanupTasks.length,
  };

  // Add performance monitor data if available
  if (this.#performanceMonitor) {
    const metrics = this.#performanceMonitor.getMetrics();
    dashboard.performanceMetrics = {
      totalOperations: metrics.totalOperations,
      slowOperations: metrics.slowOperations,
      averageTime: metrics.averageOperationTime.toFixed(2),
      activeTimers: metrics.activeTimers,
    };

    // Add recent performance report
    dashboard.performanceReport = this.#performanceMonitor.getPerformanceReport();
  }

  return dashboard;
}

/**
 * Log performance dashboard
 * @public
 */
logPerformanceDashboard() {
  const dashboard = this.getPerformanceDashboard();

  // Basic controller status
  console.table({
    Controller: dashboard.controller,
    Status: dashboard.initialized ? 'Initialized' : 'Not initialized',
    Destroyed: dashboard.destroyed ? 'Yes' : 'No',
    'Cached Elements': dashboard.elementCount,
    'Event Listeners': dashboard.eventListenerCount,
    'Active Timers': dashboard.timerCount,
    'Active Intervals': dashboard.intervalCount,
    'Cleanup Tasks': dashboard.cleanupTaskCount,
  });

  // Performance metrics if available
  if (dashboard.performanceMetrics) {
    console.log('\nPerformance Metrics:');
    console.table(dashboard.performanceMetrics);
  }

  // Full performance report if available
  if (dashboard.performanceReport) {
    console.log('\nDetailed Performance Report:');
    console.log(dashboard.performanceReport);
  }
}
```

### 8. Performance Configuration

Configure performance monitoring through dependency injection:

```javascript
// Example usage in subclass or factory
class MyController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    // Create PerformanceMonitor instance
    const performanceMonitor = new PerformanceMonitor({
      logger: dependencies.logger,
      enabled: process.env.NODE_ENV !== 'production',
      slowOperationThreshold: 150, // Custom threshold
      maxHistorySize: 500,
    });

    super({
      ...dependencies,
      // Inject through additionalServices
      performanceMonitor,
    });
  }
}

// Alternative: Factory pattern
function createControllerWithPerformance(BaseController, dependencies) {
  const performanceMonitor = new PerformanceMonitor({
    logger: dependencies.logger,
    enabled: dependencies.enablePerformanceMonitoring !== false,
    slowOperationThreshold: dependencies.performanceThreshold || 100,
  });

  return new BaseController({
    ...dependencies,
    performanceMonitor,
  });
}
```

### 9. Performance Optimization Recommendations

Reference existing performance testing infrastructure:

**Use Existing Performance Test Framework:**

- 30+ performance test files in `/tests/performance/`
- Performance test utilities in `/tests/common/performanceTestBed.js`
- Performance setup helpers in `/tests/setup/performanceSetup.js`

**Key Performance Targets (based on existing tests):**

| Operation        | Target | Threshold from existing PerformanceMonitor |
| ---------------- | ------ | ------------------------------------------ |
| Initialization   | < 50ms | 100ms (slowOperationThreshold)             |
| Element Caching  | < 20ms | 50ms (from existing timing code)           |
| Event Setup      | < 15ms | 30ms (based on existing patterns)          |
| State Transition | < 10ms | 20ms (UI responsiveness)                   |
| Destroy          | < 25ms | 50ms (cleanup operations)                  |

**Optimization Strategies using existing patterns:**

1. **Lazy Loading**: Use existing async patterns in `_executeLifecycleMethod()`
2. **Element Caching**: Leverage existing `_cacheElement()` timing (lines 567-596)
3. **Event Delegation**: Use existing `_addEventListener()` with delegation patterns
4. **Debouncing**: Use existing `_addDebouncedListener()` method (lines 1450+)

**Performance Monitoring in Development:**

```javascript
// Use existing PerformanceMonitor
const performanceMonitor = new PerformanceMonitor({
  logger: dependencies.logger,
  enabled: process.env.NODE_ENV !== 'production',
});

const controller = new MyController({
  ...dependencies,
  performanceMonitor,
});

// Check dashboard
controller.logPerformanceDashboard();

// Get detailed metrics
const metrics = performanceMonitor.getMetrics();
console.log(metrics);
```

**Common Performance Issues addressed by existing infrastructure:**

1. **Slow Initialization**: Already tracked at lines 1775-1842
2. **Memory Leaks**: Prevented by existing cleanup system (lines 3081-3170)
3. **Event Listener Leaks**: Tracked in `#eventListeners` array (line 97)

## Testing Performance

### Use Existing Performance Test Infrastructure

Reference and integrate with existing performance testing framework:

**Existing Performance Test Files:**

- `/tests/performance/` (30+ performance test files)
- `/tests/common/performanceTestBed.js` (performance test utilities)
- `/tests/setup/performanceSetup.js` (setup helpers)
- `/tests/monitoring/performanceDashboard.js` (monitoring tools)

**Example Integration with Existing Framework:**

```javascript
// Use existing performance test bed
import { PerformanceTestBed } from '../common/performanceTestBed.js';
import PerformanceMonitor from '../../src/entities/monitoring/PerformanceMonitor.js';

describe('BaseCharacterBuilderController Performance', () => {
  let testBed;
  let performanceMonitor;

  beforeEach(() => {
    testBed = new PerformanceTestBed();
    performanceMonitor = new PerformanceMonitor({
      logger: testBed.logger,
      enabled: true,
      slowOperationThreshold: 100,
    });
  });

  it('should initialize within performance budget', async () => {
    const controller = testBed.createController({
      performanceMonitor,
    });

    const timerId = performanceMonitor.startTimer('controller_init_test');
    await controller.initialize();
    const duration = performanceMonitor.stopTimer(timerId);

    expect(duration).toBeLessThan(100); // 100ms budget

    // Use existing metrics validation
    const metrics = performanceMonitor.getMetrics();
    expect(metrics.slowOperations).toBe(0);
  });

  // Reference existing performance patterns from /tests/performance/
});
```

**Performance Regression Testing:**

- Add controller performance tests to existing CI pipeline
- Use existing performance thresholds and validation
- Integrate with existing performance monitoring dashboard

## Definition of Done

- [ ] Existing PerformanceMonitor integrated with BaseCharacterBuilderController
- [ ] Dependency injection pattern updated to support performanceMonitor
- [ ] Enhanced timing added to initialize() and destroy() methods
- [ ] Cross-browser memory monitoring implemented
- [ ] Performance dashboard methods added to BaseCharacterBuilderController
- [ ] Configuration examples documented for subclasses
- [ ] Performance tests integrated with existing test framework
- [ ] Documentation updated to reference existing infrastructure

## Notes for Implementer

**Critical Implementation Notes:**

- **DO NOT create new PerformanceMonitor class** - Use existing implementation at `src/entities/monitoring/PerformanceMonitor.js`
- **Use private field patterns** - BaseCharacterBuilderController uses `#` prefix, not `_`
- **Follow dependency injection pattern** - Inject through `additionalServices`, not constructor parameters
- **Leverage existing timing** - Performance timing already exists at key points (lines 1775, 1830, 3082)
- **Reference existing tests** - 30+ performance test files already exist, integrate with them
- **Cross-browser compatibility** - Avoid Chrome-specific `performance.memory` API
- **Optional monitoring** - Make PerformanceMonitor injection optional, graceful fallback
- **Existing infrastructure** - Extensive performance monitoring already exists, enhance rather than replace
