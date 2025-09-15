# ANACLOENH-004: Establish Error Handling Framework

## Overview
Create a comprehensive error handling framework that standardizes error management across the clothing and anatomy systems, including custom error types, centralized handling, and recovery strategies.

## Current State
- **Clothing System**: Has circuit breaker in `src/clothing/monitoring/circuitBreaker.js` and `ClothingErrorHandler` with recovery strategies
- **Anatomy System**: Has `AnatomyErrorHandler` and custom error classes (AnatomyGenerationError, etc.)
- **Monitoring**: `MonitoringCoordinator` exists at `src/entities/monitoring/` with integrated error tracking
- **General Errors**: Base error classes exist at `src/errors/` (ValidationError, etc.)
- **Issues**: Fragmented error handling across systems, no unified BaseError class, inconsistent recovery patterns

## Objectives
1. Create standardized error type hierarchy
2. Implement centralized error handling with context preservation
3. Establish error recovery strategies and fallback mechanisms
4. Add error tracking and reporting capabilities
5. Integrate circuit breakers across all services

## Technical Requirements

### Error Type Hierarchy
```javascript
// Location: src/errors/BaseError.js
class BaseError extends Error {
  #code;
  #context;
  #timestamp;
  #severity;
  #recoverable;
  
  constructor(message, code, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.#code = code;
    this.#context = context;
    this.#timestamp = Date.now();
    this.#severity = this.getSeverity();
    this.#recoverable = this.isRecoverable();
    
    Error.captureStackTrace(this, this.constructor);
  }
  
  // Abstract methods for subclasses
  getSeverity() { return 'error'; }
  isRecoverable() { return false; }
  
  // Serialization
  toJSON()
  toString()
  getContext()
}

// Location: src/clothing/errors/ClothingErrors.js
class ClothingValidationError extends BaseError {
  getSeverity() { return 'warning'; }
  isRecoverable() { return true; }
}

class SlotConflictError extends BaseError {
  getSeverity() { return 'error'; }
  isRecoverable() { return true; }
}

class ItemNotAccessibleError extends BaseError {
  getSeverity() { return 'warning'; }
  isRecoverable() { return true; }
}

// Location: src/anatomy/errors/AnatomyErrors.js
class GraphValidationError extends BaseError {
  getSeverity() { return 'error'; }
  isRecoverable() { return false; }
}

class PartAttachmentError extends BaseError {
  getSeverity() { return 'error'; }
  isRecoverable() { return true; }
}

class ConstraintViolationError extends BaseError {
  getSeverity() { return 'critical'; }
  isRecoverable() { return false; }
}
```

### Central Error Handler
```javascript
// Location: src/errors/CentralErrorHandler.js
class CentralErrorHandler {
  #logger;
  #eventBus;
  #errorRegistry;
  #recoveryStrategies;
  #metrics;
  
  constructor({ logger, eventBus, monitoringCoordinator }) {
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#errorRegistry = new Map();
    this.#recoveryStrategies = new Map();
    this.#monitoringCoordinator = monitoringCoordinator; // Use existing MonitoringCoordinator
  }
  
  // Error handling
  async handle(error, context = {}) {
    const errorInfo = this.classifyError(error);
    this.logError(errorInfo);
    this.collectMetrics(errorInfo);
    
    if (errorInfo.recoverable) {
      return await this.attemptRecovery(errorInfo);
    }
    
    this.notifyError(errorInfo);
    throw this.enhanceError(error, context);
  }
  
  // Registration
  registerRecoveryStrategy(errorType, strategy)
  registerErrorTransform(errorType, transform)
  
  // Recovery
  async attemptRecovery(errorInfo)
  getFallbackValue(operation)
  
  // Analysis
  classifyError(error)
  enhanceError(error, context)
  extractRootCause(error)
}
```

### Recovery Strategy Manager
```javascript
// Location: src/errors/RecoveryStrategyManager.js
class RecoveryStrategyManager {
  #strategies;
  #circuitBreakers;
  #fallbacks;
  
  constructor({ logger }) {
    this.#strategies = new Map();
    this.#circuitBreakers = new Map();
    this.#fallbacks = new Map();
  }
  
  // Strategy registration
  registerStrategy(errorType, strategy) {
    this.#strategies.set(errorType, {
      retry: strategy.retry || this.defaultRetry,
      fallback: strategy.fallback || this.defaultFallback,
      circuitBreaker: strategy.circuitBreaker || this.defaultCircuitBreaker
    });
  }
  
  // Recovery execution
  async executeWithRecovery(operation, options = {}) {
    const { maxRetries = 3, backoff = 'exponential' } = options;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeWithCircuitBreaker(operation);
      } catch (error) {
        if (!this.isRetriable(error) || attempt === maxRetries) {
          return await this.executeFallback(operation, error);
        }
        await this.wait(this.calculateBackoff(attempt, backoff));
      }
    }
  }
  
  // Circuit breaker integration
  executeWithCircuitBreaker(operation)
  isCircuitOpen(operationKey)
  
  // Fallback management
  executeFallback(operation, error)
  getCachedFallback(operationKey)
}
```

### Error Reporter
```javascript
// Location: src/errors/ErrorReporter.js
class ErrorReporter {
  #buffer;
  #batchSize;
  #flushInterval;
  
  constructor({ 
    endpoint,
    batchSize = 50,
    flushInterval = 30000 
  }) {
    this.#buffer = [];
    this.#batchSize = batchSize;
    this.#flushInterval = flushInterval;
    
    this.startBatchReporting();
  }
  
  // Reporting
  report(error, context)
  flush()
  
  // Analysis
  generateErrorReport(timeRange)
  getErrorTrends()
  getTopErrors()
  
  // Alerting
  checkErrorThresholds()
  sendAlert(severity, message)
}
```

## Implementation Steps

1. **Create Error Type Hierarchy** (Day 1-2)
   - Implement BaseError class
   - Create domain-specific error types
   - Add error serialization

2. **Build Central Error Handler** (Day 3-4)
   - Implement error classification
   - Add context enhancement
   - Create error registry

3. **Implement Recovery Strategies** (Day 5-6)
   - Build retry mechanisms
   - Add circuit breaker integration
   - Create fallback system

4. **Develop Error Reporter** (Day 7)
   - Implement batch reporting
   - Add error analytics
   - Create alerting system

5. **Integrate with Services** (Day 8-9)
   - Wrap service methods with error handling
   - Add recovery strategies
   - Update existing error handling

## File Changes

### New Files
- `src/errors/BaseError.js` - Base error class for inheritance
- `src/errors/CentralErrorHandler.js` - Unified error handler
- `src/errors/RecoveryStrategyManager.js` - Recovery strategy management
- `src/errors/ErrorReporter.js` - Error reporting service
- `src/errors/ErrorContext.js` - Error context utilities
- `src/errors/strategies/RetryStrategy.js` - Retry mechanism
- `src/errors/strategies/FallbackStrategy.js` - Fallback handling

### Modified Files
- `src/clothing/errors/clothingErrors.js` - Extend from BaseError
- `src/clothing/errors/clothingErrorHandler.js` - Integrate with CentralErrorHandler
- `src/anatomy/orchestration/anatomyErrorHandler.js` - Integrate with CentralErrorHandler
- `src/entities/monitoring/MonitoringCoordinator.js` - Add error handler integration
- `src/entities/monitoring/CircuitBreaker.js` - Enhance with error context
- `src/dependencyInjection/registrations/monitoringRegistrations.js` - Register error services
- `src/errors/validationError.js` - Extend from BaseError
- All service files - Integrate centralized error handling

### Test Files
- `tests/unit/errors/BaseError.test.js`
- `tests/unit/errors/CentralErrorHandler.test.js`
- `tests/unit/errors/RecoveryStrategyManager.test.js`
- `tests/integration/errors/errorHandling.test.js`
- `tests/integration/errors/recoveryStrategies.test.js`

## Dependencies
- **Prerequisites**: None (foundational)
- **External**: None
- **Internal**:
  - Logger (ILogger token)
  - EventBus (IEventBus token)
  - MonitoringCoordinator (IMonitoringCoordinator token)
  - MemoryMonitor (IMemoryMonitor token) - for resource-aware recovery
  - Existing error handlers (ClothingErrorHandler, AnatomyErrorHandler)

## Acceptance Criteria
1. ✅ All errors inherit from BaseError
2. ✅ Central handler processes all service errors
3. ✅ Recovery strategies execute correctly
4. ✅ Circuit breakers prevent cascading failures
5. ✅ Error reporting batches and sends correctly
6. ✅ Context is preserved through error chain
7. ✅ Fallback values return when recovery fails
8. ✅ 95% of retriable errors recover successfully

## Testing Requirements

### Unit Tests
- Test error type hierarchy
- Verify error classification
- Test recovery strategy execution
- Validate circuit breaker behavior

### Integration Tests
- Test end-to-end error flow
- Verify recovery with real services
- Test error reporting pipeline

### Failure Scenario Tests
- Simulate various failure modes
- Test cascading failure prevention
- Verify graceful degradation

## Risk Assessment

### Risks
1. **Over-engineering**: Too complex error handling
2. **Performance impact**: Error handling overhead
3. **Recovery loops**: Infinite retry scenarios

### Mitigation
1. Keep error handling simple by default
2. Make advanced features opt-in
3. Implement retry limits and timeouts

## Estimated Effort
- **Development**: 7-9 days
- **Testing**: 3 days
- **Integration**: 2 days
- **Total**: 12-14 days

## Success Metrics
- 90% reduction in unhandled errors
- 95% successful recovery rate for retriable errors
- 50% reduction in cascading failures
- 100% error context preservation

## Configuration Example
```javascript
// src/config/errorHandling.config.js
export const errorHandlingConfig = {
  retry: {
    maxAttempts: 3,
    backoff: {
      type: 'exponential',
      initialDelay: 100,
      maxDelay: 5000,
      factor: 2
    }
  },
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    halfOpenRequests: 3
  },
  reporting: {
    enabled: true,
    endpoint: process.env.ERROR_REPORTING_ENDPOINT,
    batchSize: 50,
    flushInterval: 30000,
    includeStackTrace: process.env.NODE_ENV !== 'production'
  },
  fallback: {
    useCache: true,
    cacheTimeout: 60000,
    defaultValues: {
      clothing: [],
      anatomy: {}
    }
  }
};
```

## Notes
- Build upon existing MonitoringCoordinator and error handlers
- Leverage existing CircuitBreaker implementations (both clothing and entities)
- Integrate with existing memory monitoring for resource-aware recovery
- Consider implementing error budgets for SLO tracking
- Add correlation IDs for distributed tracing
- Implement error sampling for high-volume scenarios
- Consider adding error replay capabilities for debugging

## Key Architecture Decisions
- Place all base error classes in `src/errors/` to match existing structure
- Extend existing error handlers rather than replacing them
- Use MonitoringCoordinator for metrics instead of creating new metrics service
- Maintain backward compatibility with existing error handling patterns