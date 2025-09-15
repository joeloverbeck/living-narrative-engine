# ANACLOENH-004-03: Create Central Error Handler

## Overview
Create a centralized error handler that processes all service errors, classifies them, and coordinates with the monitoring system.

## Parent Ticket
- ANACLOENH-004: Establish Error Handling Framework

## Depends On
- ANACLOENH-004-01: Create BaseError Class
- ANACLOENH-004-02: Update Existing Error Classes

## Current State
- Multiple domain-specific error handlers exist (ClothingErrorHandler, AnatomyErrorHandler)
- MonitoringCoordinator exists for system monitoring
- No central coordination of error handling

## Objectives
1. Create CentralErrorHandler class
2. Implement error classification system
3. Add context enhancement capabilities
4. Integrate with MonitoringCoordinator
5. Create error registry for tracking

## Technical Requirements

### CentralErrorHandler Implementation
```javascript
// Location: src/errors/CentralErrorHandler.js
import { validateDependency } from '../utils/dependencyUtils.js';
import BaseError from './BaseError.js';

class CentralErrorHandler {
  #logger;
  #eventBus;
  #monitoringCoordinator;
  #errorRegistry;
  #recoveryStrategies;
  #errorTransforms;
  #metrics;

  constructor({ logger, eventBus, monitoringCoordinator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'error', 'warn', 'debug']
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch', 'on']
    });
    validateDependency(monitoringCoordinator, 'IMonitoringCoordinator', logger, {
      requiredMethods: ['getCircuitBreaker', 'executeMonitored']
    });

    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#monitoringCoordinator = monitoringCoordinator;
    this.#errorRegistry = new Map();
    this.#recoveryStrategies = new Map();
    this.#errorTransforms = new Map();
    this.#metrics = {
      totalErrors: 0,
      recoveredErrors: 0,
      failedRecoveries: 0,
      errorsByType: new Map()
    };

    this.#registerEventListeners();
  }

  // Main error handling method
  async handle(error, context = {}) {
    const errorInfo = this.#classifyError(error, context);

    // Track metrics
    this.#updateMetrics(errorInfo);

    // Log error with classification
    this.#logError(errorInfo);

    // Dispatch error event
    this.#notifyError(errorInfo);

    // Attempt recovery if possible
    if (errorInfo.recoverable) {
      try {
        const result = await this.#attemptRecovery(errorInfo);
        if (result.success) {
          return result.data;
        }
      } catch (recoveryError) {
        this.#logger.error('Recovery failed', {
          originalError: errorInfo,
          recoveryError: recoveryError.message
        });
      }
    }

    // Enhance and throw if recovery failed or not recoverable
    throw this.#enhanceError(error, errorInfo);
  }

  // Synchronous error handling
  handleSync(error, context = {}) {
    const errorInfo = this.#classifyError(error, context);
    this.#updateMetrics(errorInfo);
    this.#logError(errorInfo);
    this.#notifyError(errorInfo);

    if (errorInfo.recoverable && this.#hasyncRecoveryStrategy(errorInfo.type)) {
      const fallback = this.#getSyncFallback(errorInfo);
      if (fallback !== undefined) {
        return fallback;
      }
    }

    throw this.#enhanceError(error, errorInfo);
  }

  // Register recovery strategy
  registerRecoveryStrategy(errorType, strategy) {
    this.#recoveryStrategies.set(errorType, strategy);
    this.#logger.debug(`Registered recovery strategy for ${errorType}`);
  }

  // Register error transform
  registerErrorTransform(errorType, transform) {
    this.#errorTransforms.set(errorType, transform);
    this.#logger.debug(`Registered error transform for ${errorType}`);
  }

  // Get fallback value for operation
  getFallbackValue(operation, errorType) {
    const fallbacks = {
      'fetch': null,
      'parse': {},
      'validate': false,
      'generate': '',
      'calculate': 0
    };
    return fallbacks[operation] ?? null;
  }

  // Private methods
  #classifyError(error, context) {
    const isBaseError = error instanceof BaseError;

    return {
      id: error.correlationId || this.#generateErrorId(),
      type: error.constructor.name,
      code: isBaseError ? error.code : 'UNKNOWN_ERROR',
      message: error.message,
      severity: isBaseError ? error.severity : 'error',
      recoverable: isBaseError ? error.recoverable : false,
      context: {
        ...context,
        ...(isBaseError ? error.context : {}),
        timestamp: Date.now(),
        stack: error.stack
      },
      originalError: error
    };
  }

  #enhanceError(error, errorInfo) {
    if (error instanceof BaseError) {
      // Add additional context
      error.addContext('handledBy', 'CentralErrorHandler');
      error.addContext('handledAt', Date.now());
      error.addContext('recoveryAttempted', errorInfo.recoverable);
      return error;
    }

    // Wrap non-BaseError in BaseError
    const enhancedError = new BaseError(
      error.message,
      'WRAPPED_ERROR',
      errorInfo.context
    );
    enhancedError.cause = error;
    return enhancedError;
  }

  #extractRootCause(error) {
    let rootCause = error;
    while (rootCause.cause) {
      rootCause = rootCause.cause;
    }
    return rootCause;
  }

  async #attemptRecovery(errorInfo) {
    const strategy = this.#recoveryStrategies.get(errorInfo.type);
    if (!strategy) {
      return { success: false };
    }

    try {
      const result = await strategy(errorInfo);
      this.#metrics.recoveredErrors++;
      return { success: true, data: result };
    } catch (error) {
      this.#metrics.failedRecoveries++;
      throw error;
    }
  }

  #generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  #logError(errorInfo) {
    const logData = {
      errorId: errorInfo.id,
      type: errorInfo.type,
      code: errorInfo.code,
      severity: errorInfo.severity,
      recoverable: errorInfo.recoverable,
      message: errorInfo.message,
      context: errorInfo.context
    };

    // Log based on severity
    switch (errorInfo.severity) {
      case 'critical':
        this.#logger.error('Critical error occurred', logData);
        break;
      case 'error':
        this.#logger.error('Error occurred', logData);
        break;
      case 'warning':
        this.#logger.warn('Warning occurred', logData);
        break;
      default:
        this.#logger.info('Error handled', logData);
    }
  }

  #notifyError(errorInfo) {
    this.#eventBus.dispatch({
      type: 'ERROR_OCCURRED',
      payload: {
        errorId: errorInfo.id,
        errorType: errorInfo.type,
        severity: errorInfo.severity,
        recoverable: errorInfo.recoverable,
        message: errorInfo.message,
        timestamp: errorInfo.context.timestamp
      }
    });
  }

  #updateMetrics(errorInfo) {
    this.#metrics.totalErrors++;

    const typeCount = this.#metrics.errorsByType.get(errorInfo.type) || 0;
    this.#metrics.errorsByType.set(errorInfo.type, typeCount + 1);

    // Register in error registry
    this.#errorRegistry.set(errorInfo.id, {
      ...errorInfo,
      registeredAt: Date.now()
    });

    // Clean old entries (keep last 1000)
    if (this.#errorRegistry.size > 1000) {
      const firstKey = this.#errorRegistry.keys().next().value;
      this.#errorRegistry.delete(firstKey);
    }
  }

  #registerEventListeners() {
    // Listen for domain-specific error events
    this.#eventBus.on('CLOTHING_ERROR_OCCURRED', (event) => {
      this.handle(event.payload.error, event.payload.context);
    });

    this.#eventBus.on('ANATOMY_ERROR_OCCURRED', (event) => {
      this.handle(event.payload.error, event.payload.context);
    });
  }

  // Public API
  getMetrics() {
    return {
      ...this.#metrics,
      errorsByType: Object.fromEntries(this.#metrics.errorsByType),
      registrySize: this.#errorRegistry.size,
      recoveryRate: this.#metrics.totalErrors > 0
        ? this.#metrics.recoveredErrors / this.#metrics.totalErrors
        : 0
    };
  }

  getErrorHistory(limit = 10) {
    const entries = Array.from(this.#errorRegistry.values());
    return entries.slice(-limit);
  }

  clearMetrics() {
    this.#metrics.totalErrors = 0;
    this.#metrics.recoveredErrors = 0;
    this.#metrics.failedRecoveries = 0;
    this.#metrics.errorsByType.clear();
    this.#errorRegistry.clear();
  }
}

export default CentralErrorHandler;
```

## Implementation Steps

1. **Create CentralErrorHandler.js**
   - Implement core error handling logic
   - Add error classification system
   - Implement metrics tracking

2. **Create ErrorContext.js utilities**
   ```javascript
   // src/errors/ErrorContext.js
   export class ErrorContext {
     static extract(error) { /* ... */ }
     static enhance(error, context) { /* ... */ }
     static generateCorrelationId() { /* ... */ }
   }
   ```

3. **Register in DI container**
   - Add token to tokens-monitoring.js
   - Create registration in monitoringRegistrations.js

4. **Integrate with MonitoringCoordinator**
   - Add CentralErrorHandler as dependency
   - Wire up error handling pipeline

## File Changes

### New Files
- `src/errors/CentralErrorHandler.js`
- `src/errors/ErrorContext.js`

### Modified Files
- `src/dependencyInjection/tokens/tokens-monitoring.js` - Add ICentralErrorHandler token
- `src/dependencyInjection/registrations/monitoringRegistrations.js` - Register handler

## Dependencies
- **Prerequisites**:
  - ANACLOENH-004-01 (BaseError class)
  - ANACLOENH-004-02 (Updated error classes)
- **External**: MonitoringCoordinator, EventBus, Logger

## Acceptance Criteria
1. ✅ Central handler processes all error types
2. ✅ Error classification works correctly
3. ✅ Context is enhanced and preserved
4. ✅ Metrics are tracked accurately
5. ✅ Integration with monitoring system works
6. ✅ Error events are dispatched correctly
7. ✅ Recovery strategies can be registered

## Testing Requirements

### Unit Tests
Create `tests/unit/errors/CentralErrorHandler.test.js`:
- Test error classification
- Test context enhancement
- Test metrics tracking
- Test recovery strategy registration
- Test error event dispatching
- Test fallback value generation

### Integration Tests
- Test with real MonitoringCoordinator
- Test error flow through system
- Test recovery execution

## Estimated Effort
- **Development**: 3 hours
- **Testing**: 2 hours
- **Total**: 5 hours

## Risk Assessment
- **Medium Risk**: Complex integration with existing systems
- **Mitigation**: Thorough testing of integration points
- **Mitigation**: Gradual rollout with feature flags

## Success Metrics
- All errors routed through central handler
- 100% error classification accuracy
- Metrics tracking working correctly
- No performance degradation

## Notes
- Keep handler focused on coordination, not business logic
- Ensure handler is performant for high-volume errors
- Consider adding error sampling for very high volumes
- Document recovery strategy interface clearly