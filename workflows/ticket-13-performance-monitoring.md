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

### 1. Performance Monitoring Class

Create `src/characterBuilder/controllers/PerformanceMonitor.js`:

```javascript
/**
 * @file Performance monitoring utilities for character builder controllers
 * @description Tracks and reports performance metrics
 */

/**
 * Performance monitoring class
 */
export class PerformanceMonitor {
  #metrics = new Map();
  #thresholds = new Map();
  #enabled = true;
  #logger = null;

  /**
   * @param {object} options
   * @param {ILogger} options.logger - Logger instance
   * @param {boolean} [options.enabled=true] - Whether monitoring is enabled
   * @param {object} [options.thresholds={}] - Performance thresholds
   */
  constructor({ logger, enabled = true, thresholds = {} }) {
    this.#logger = logger;
    this.#enabled = enabled;
    this._setDefaultThresholds();
    this._applyCustomThresholds(thresholds);
  }

  /**
   * Set default performance thresholds
   * @private
   */
  _setDefaultThresholds() {
    this.#thresholds.set('initialization', 100); // 100ms
    this.#thresholds.set('elementCaching', 50); // 50ms
    this.#thresholds.set('eventSetup', 30); // 30ms
    this.#thresholds.set('dataLoading', 500); // 500ms
    this.#thresholds.set('stateTransition', 20); // 20ms
    this.#thresholds.set('destroy', 50); // 50ms
  }

  /**
   * Apply custom thresholds
   * @private
   */
  _applyCustomThresholds(thresholds) {
    Object.entries(thresholds).forEach(([key, value]) => {
      this.#thresholds.set(key, value);
    });
  }

  /**
   * Start timing an operation
   * @param {string} operation - Operation name
   * @param {object} [metadata={}] - Additional metadata
   * @returns {string} Timer ID
   */
  startTimer(operation, metadata = {}) {
    if (!this.#enabled) return null;

    const timerId = `${operation}-${Date.now()}-${Math.random()}`;
    const timer = {
      operation,
      startTime: performance.now(),
      metadata,
      marks: [],
    };

    this.#metrics.set(timerId, timer);
    return timerId;
  }

  /**
   * Mark a point in an operation
   * @param {string} timerId - Timer ID
   * @param {string} label - Mark label
   */
  mark(timerId, label) {
    if (!this.#enabled || !timerId) return;

    const timer = this.#metrics.get(timerId);
    if (!timer) return;

    timer.marks.push({
      label,
      time: performance.now() - timer.startTime,
    });
  }

  /**
   * End timing an operation
   * @param {string} timerId - Timer ID
   * @returns {object} Performance data
   */
  endTimer(timerId) {
    if (!this.#enabled || !timerId) return null;

    const timer = this.#metrics.get(timerId);
    if (!timer) return null;

    const duration = performance.now() - timer.startTime;
    const result = {
      operation: timer.operation,
      duration,
      marks: timer.marks,
      metadata: timer.metadata,
      threshold: this.#thresholds.get(timer.operation),
      exceedsThreshold: false,
    };

    if (result.threshold) {
      result.exceedsThreshold = duration > result.threshold;
    }

    // Log if exceeds threshold
    if (result.exceedsThreshold) {
      this.#logger.warn(
        `Performance: ${timer.operation} took ${duration.toFixed(2)}ms ` +
          `(threshold: ${result.threshold}ms)`,
        result
      );
    }

    this.#metrics.delete(timerId);
    return result;
  }

  /**
   * Measure async operation
   * @param {string} operation - Operation name
   * @param {Function} asyncFn - Async function to measure
   * @param {object} [metadata={}] - Additional metadata
   * @returns {Promise<any>} Function result
   */
  async measureAsync(operation, asyncFn, metadata = {}) {
    const timerId = this.startTimer(operation, metadata);

    try {
      const result = await asyncFn();
      const perf = this.endTimer(timerId);

      if (perf && !perf.exceedsThreshold) {
        this.#logger.debug(
          `Performance: ${operation} completed in ${perf.duration.toFixed(2)}ms`
        );
      }

      return result;
    } catch (error) {
      this.endTimer(timerId);
      throw error;
    }
  }

  /**
   * Measure sync operation
   * @param {string} operation - Operation name
   * @param {Function} fn - Function to measure
   * @param {object} [metadata={}] - Additional metadata
   * @returns {any} Function result
   */
  measureSync(operation, fn, metadata = {}) {
    const timerId = this.startTimer(operation, metadata);

    try {
      const result = fn();
      const perf = this.endTimer(timerId);

      if (perf && !perf.exceedsThreshold) {
        this.#logger.debug(
          `Performance: ${operation} completed in ${perf.duration.toFixed(2)}ms`
        );
      }

      return result;
    } catch (error) {
      this.endTimer(timerId);
      throw error;
    }
  }

  /**
   * Get performance summary
   * @returns {object} Summary data
   */
  getSummary() {
    const activeTimers = Array.from(this.#metrics.entries()).map(
      ([id, timer]) => ({
        operation: timer.operation,
        runningTime: performance.now() - timer.startTime,
      })
    );

    return {
      enabled: this.#enabled,
      thresholds: Object.fromEntries(this.#thresholds),
      activeTimers,
    };
  }

  /**
   * Enable/disable monitoring
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.#enabled = enabled;
    this.#logger.info(
      `Performance monitoring ${enabled ? 'enabled' : 'disabled'}`
    );
  }
}
```

### 2. Integration with BaseCharacterBuilderController

Update `BaseCharacterBuilderController.js` to include performance monitoring:

```javascript
// Add to imports
import { PerformanceMonitor } from './PerformanceMonitor.js';

// Add to class fields
/** @private @type {PerformanceMonitor} */
_performanceMonitor;

/** @private @type {string} */
_initTimerId;

// Update constructor
constructor({
  logger,
  characterBuilderService,
  eventBus,
  schemaValidator,
  performanceConfig,
  ...additionalServices
}) {
  // ... existing validation ...

  // Initialize performance monitor
  this._performanceMonitor = new PerformanceMonitor({
    logger: this._logger,
    enabled: performanceConfig?.enabled !== false,
    thresholds: performanceConfig?.thresholds || {},
  });

  // ... rest of constructor
}

// Update initialize method
async initialize() {
  if (this._isInitialized) {
    this._logger.warn(
      `${this.constructor.name}: Already initialized, skipping re-initialization`
    );
    return;
  }

  // Start overall initialization timer
  this._initTimerId = this._performanceMonitor.startTimer('initialization', {
    controller: this.constructor.name,
  });

  try {
    this._logger.info(`${this.constructor.name}: Starting initialization`);

    // Pre-initialization hook
    await this._performanceMonitor.measureAsync(
      'preInitialize',
      () => this._executeLifecycleMethod('_preInitialize', 'pre-initialization')
    );

    // Mark after pre-init
    this._performanceMonitor.mark(this._initTimerId, 'pre-init-complete');

    // Step 1: Cache DOM elements
    await this._performanceMonitor.measureAsync(
      'elementCaching',
      () => this._executeLifecycleMethod('_cacheElements', 'element caching', true)
    );

    this._performanceMonitor.mark(this._initTimerId, 'elements-cached');

    // Step 2: Initialize services
    await this._performanceMonitor.measureAsync(
      'serviceInitialization',
      () => this._executeLifecycleMethod('_initializeServices', 'service initialization')
    );

    this._performanceMonitor.mark(this._initTimerId, 'services-initialized');

    // Step 3: Set up event listeners
    await this._performanceMonitor.measureAsync(
      'eventSetup',
      () => this._executeLifecycleMethod('_setupEventListeners', 'event listener setup', true)
    );

    this._performanceMonitor.mark(this._initTimerId, 'events-setup');

    // Step 4: Load initial data
    await this._performanceMonitor.measureAsync(
      'dataLoading',
      () => this._executeLifecycleMethod('_loadInitialData', 'initial data loading')
    );

    this._performanceMonitor.mark(this._initTimerId, 'data-loaded');

    // Step 5: Initialize UI state
    await this._performanceMonitor.measureAsync(
      'uiStateInit',
      () => this._executeLifecycleMethod('_initializeUIState', 'UI state initialization')
    );

    this._performanceMonitor.mark(this._initTimerId, 'ui-initialized');

    // Post-initialization hook
    await this._performanceMonitor.measureAsync(
      'postInitialize',
      () => this._executeLifecycleMethod('_postInitialize', 'post-initialization')
    );

    this._isInitialized = true;

    // End initialization timer
    const perfData = this._performanceMonitor.endTimer(this._initTimerId);

    if (perfData) {
      this._logInitializationPerformance(perfData);
    }

    // Dispatch initialization complete event with performance data
    if (this._eventBus) {
      this._eventBus.dispatch('CONTROLLER_INITIALIZED', {
        controllerName: this.constructor.name,
        initializationTime: perfData?.duration || 0,
        performanceData: perfData,
      });
    }

  } catch (error) {
    // End timer on error
    const perfData = this._performanceMonitor.endTimer(this._initTimerId);

    this._logger.error(
      `${this.constructor.name}: Initialization failed after ${perfData?.duration.toFixed(2)}ms`,
      error
    );

    await this._handleInitializationError(error);
    throw error;
  }
}

// Add performance logging method
/**
 * Log initialization performance details
 * @private
 * @param {object} perfData - Performance data
 */
_logInitializationPerformance(perfData) {
  const phaseDurations = this._calculatePhaseDurations(perfData.marks);

  this._logger.info(
    `${this.constructor.name}: Initialization completed in ${perfData.duration.toFixed(2)}ms`,
    {
      totalTime: perfData.duration,
      phases: phaseDurations,
      marks: perfData.marks,
    }
  );

  // Log slow phases
  Object.entries(phaseDurations).forEach(([phase, duration]) => {
    const threshold = this._performanceMonitor.#thresholds.get(phase) || 50;
    if (duration > threshold) {
      this._logger.warn(
        `${this.constructor.name}: Slow initialization phase '${phase}' took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`
      );
    }
  });
}

/**
 * Calculate phase durations from marks
 * @private
 * @param {Array} marks - Performance marks
 * @returns {object} Phase durations
 */
_calculatePhaseDurations(marks) {
  const durations = {};
  let previousTime = 0;

  marks.forEach((mark, index) => {
    const duration = mark.time - previousTime;
    const phaseName = this._getPhaseNameFromMark(mark.label);
    durations[phaseName] = duration;
    previousTime = mark.time;
  });

  return durations;
}
```

### 3. Performance Monitoring for Key Operations

```javascript
// Update state transitions
_showState(state, options = {}) {
  return this._performanceMonitor.measureSync(
    'stateTransition',
    () => {
      // ... existing implementation
    },
    { fromState: this._currentState, toState: state }
  );
}

// Update element caching
_cacheElement(key, selector, required = true) {
  return this._performanceMonitor.measureSync(
    'elementCache',
    () => {
      // ... existing implementation
    },
    { key, selector }
  );
}

// Update destroy method
async destroy() {
  if (this._isDestroyed) {
    this._logger.warn(
      `${this.constructor.name}: Already destroyed, skipping cleanup`
    );
    return;
  }

  const destroyTimerId = this._performanceMonitor.startTimer('destroy', {
    controller: this.constructor.name,
  });

  try {
    // ... existing destroy implementation ...

    const perfData = this._performanceMonitor.endTimer(destroyTimerId);

    if (perfData) {
      this._logger.info(
        `${this.constructor.name}: Cleanup completed in ${perfData.duration.toFixed(2)}ms`
      );
    }

  } catch (error) {
    this._performanceMonitor.endTimer(destroyTimerId);
    throw error;
  }
}
```

### 4. Memory Usage Monitoring

Add memory monitoring utilities:

```javascript
/**
 * Get memory usage snapshot
 * @private
 * @returns {object} Memory data
 */
_getMemoryUsage() {
  if (!performance.memory) {
    return null; // Not supported in all browsers
  }

  return {
    usedJSHeapSize: performance.memory.usedJSHeapSize,
    totalJSHeapSize: performance.memory.totalJSHeapSize,
    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
    percentUsed: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100,
  };
}

/**
 * Log memory usage
 * @protected
 */
_logMemoryUsage(context) {
  const memory = this._getMemoryUsage();

  if (memory) {
    this._logger.debug(
      `${this.constructor.name}: Memory usage at ${context}`,
      {
        heapUsed: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        percentUsed: `${memory.percentUsed.toFixed(1)}%`,
      }
    );

    if (memory.percentUsed > 90) {
      this._logger.warn(
        `${this.constructor.name}: High memory usage detected (${memory.percentUsed.toFixed(1)}%)`
      );
    }
  }
}

// Add memory logging to key points
async _postInitialize() {
  this._logMemoryUsage('post-initialization');
}

async _postDestroy() {
  this._logMemoryUsage('post-destruction');
}
```

### 5. Performance Dashboard

Create a simple performance dashboard method:

```javascript
/**
 * Get performance dashboard data
 * @public
 * @returns {object} Dashboard data
 */
getPerformanceDashboard() {
  const memory = this._getMemoryUsage();
  const summary = this._performanceMonitor.getSummary();

  return {
    controller: this.constructor.name,
    initialized: this._isInitialized,
    destroyed: this._isDestroyed,
    memory: memory ? {
      heapUsedMB: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
      percentUsed: memory.percentUsed.toFixed(1),
    } : null,
    performance: summary,
    elementCount: Object.keys(this._elements).length,
    eventListenerCount: this._eventListeners.length,
  };
}

/**
 * Log performance dashboard
 * @public
 */
logPerformanceDashboard() {
  const dashboard = this.getPerformanceDashboard();

  console.table({
    Controller: dashboard.controller,
    Status: dashboard.initialized ? 'Initialized' : 'Not initialized',
    'Memory (MB)': dashboard.memory?.heapUsedMB || 'N/A',
    'Memory (%)': dashboard.memory?.percentUsed || 'N/A',
    'Elements': dashboard.elementCount,
    'Listeners': dashboard.eventListenerCount,
  });

  if (dashboard.performance.activeTimers.length > 0) {
    console.log('Active Timers:');
    console.table(dashboard.performance.activeTimers);
  }
}
```

### 6. Performance Configuration

Add configuration options for performance monitoring:

```javascript
// Example usage in subclass
class MyController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    super({
      ...dependencies,
      performanceConfig: {
        enabled: process.env.NODE_ENV !== 'production',
        thresholds: {
          initialization: 150, // Custom threshold
          dataLoading: 1000, // Allow more time for data
        },
      },
    });
  }
}
```

### 7. Performance Optimization Recommendations

Create `docs/characterBuilder/performance-guide.md`:

````markdown
# Character Builder Controller Performance Guide

## Performance Targets

| Operation        | Target | Acceptable | Action Required |
| ---------------- | ------ | ---------- | --------------- |
| Initialization   | < 50ms | < 100ms    | > 100ms         |
| Element Caching  | < 20ms | < 50ms     | > 50ms          |
| Event Setup      | < 15ms | < 30ms     | > 30ms          |
| State Transition | < 10ms | < 20ms     | > 20ms          |
| Destroy          | < 25ms | < 50ms     | > 50ms          |

## Optimization Strategies

### 1. Lazy Loading

```javascript
async _loadInitialData() {
  // Load only critical data initially
  const criticalData = await this._loadCriticalData();

  // Load rest asynchronously
  this._loadRemainingData().catch(error => {
    this._logger.error('Failed to load remaining data', error);
  });
}
```
````

### 2. Element Caching Optimization

```javascript
_cacheElements() {
  // Cache only visible elements initially
  this._cacheVisibleElements();

  // Defer hidden element caching
  requestIdleCallback(() => {
    this._cacheHiddenElements();
  });
}
```

### 3. Event Delegation

```javascript
_setupEventListeners() {
  // Use delegation for dynamic content
  this._addDelegatedListener('container', '.item', 'click',
    (e, item) => this._handleItemClick(item)
  );
}
```

### 4. Debounce Expensive Operations

```javascript
_setupEventListeners() {
  // Debounce search input
  this._addDebouncedListener('searchInput', 'input',
    this._performSearch.bind(this), 300
  );
}
```

## Performance Monitoring

### Enable in Development

```javascript
const controller = new MyController({
  ...dependencies,
  performanceConfig: {
    enabled: true,
    thresholds: {
      initialization: 100,
    },
  },
});
```

### Check Performance Dashboard

```javascript
// In console
controller.logPerformanceDashboard();
```

### Monitor Memory Usage

```javascript
// Check after operations
controller._logMemoryUsage('after-heavy-operation');
```

## Common Performance Issues

### 1. Slow Initialization

- Too many synchronous operations
- Heavy DOM queries
- Large initial data loads

### 2. Memory Leaks

- Event listeners not cleaned up
- Circular references
- Large data retained in closures

### 3. Janky UI Updates

- Too many DOM manipulations
- Missing requestAnimationFrame
- Synchronous heavy computations

````

## Testing Performance

### Performance Tests
Add performance tests to verify targets:

```javascript
describe('Performance', () => {
  it('should initialize within performance budget', async () => {
    const startTime = performance.now();
    await testBase.controller.initialize();
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(100); // 100ms budget
  });

  it('should cache elements efficiently', () => {
    const controller = testBase.controller;
    const startTime = performance.now();

    // Add many elements to DOM
    for (let i = 0; i < 50; i++) {
      document.body.insertAdjacentHTML('beforeend',
        `<div id="test-element-${i}"></div>`
      );
    }

    // Cache them
    for (let i = 0; i < 50; i++) {
      controller._cacheElement(`elem${i}`, `#test-element-${i}`);
    }

    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(50); // Should be fast
  });

  it('should clean up efficiently', async () => {
    await testBase.controller.initialize();

    // Add many listeners
    for (let i = 0; i < 100; i++) {
      testBase.controller._addEventListener('submitBtn', 'click', () => {});
    }

    const startTime = performance.now();
    await testBase.controller.destroy();
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(50); // 50ms budget
  });
});
````

## Definition of Done

- [ ] PerformanceMonitor class implemented
- [ ] Base controller integrated with monitoring
- [ ] Key operations instrumented
- [ ] Memory monitoring added
- [ ] Performance dashboard available
- [ ] Configuration options documented
- [ ] Optimization guide created
- [ ] Performance tests added

## Notes for Implementer

- Keep monitoring lightweight to avoid impacting performance
- Make monitoring optional for production
- Provide clear actionable insights
- Consider browser compatibility for memory APIs
- Add performance regression tests
- Document findings from real-world usage
