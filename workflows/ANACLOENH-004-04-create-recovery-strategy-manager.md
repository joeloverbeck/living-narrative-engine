# ANACLOENH-004-04: Create Recovery Strategy Manager

## Overview
Implement a recovery strategy manager that handles retry logic, circuit breaker integration, and fallback mechanisms for error recovery.

## Parent Ticket
- ANACLOENH-004: Establish Error Handling Framework

## Depends On
- ANACLOENH-004-01: Create BaseError Class
- ANACLOENH-004-03: Create Central Error Handler

## Current State
- Circuit breakers exist in clothing and monitoring modules
- ClothingErrorHandler has basic recovery strategies
- No unified recovery management system

## Objectives
1. Create RecoveryStrategyManager class
2. Implement retry mechanisms with backoff
3. Integrate existing circuit breakers
4. Create fallback value system
5. Add caching for successful fallbacks

## Technical Requirements

### RecoveryStrategyManager Implementation
```javascript
// Location: src/errors/RecoveryStrategyManager.js
import { validateDependency } from '../utils/dependencyUtils.js';

class RecoveryStrategyManager {
  #logger;
  #strategies;
  #circuitBreakers;
  #fallbacks;
  #cache;
  #monitoringCoordinator;

  constructor({ logger, monitoringCoordinator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'error', 'warn', 'debug']
    });

    if (monitoringCoordinator) {
      validateDependency(monitoringCoordinator, 'IMonitoringCoordinator', logger, {
        requiredMethods: ['getCircuitBreaker']
      });
    }

    this.#logger = logger;
    this.#monitoringCoordinator = monitoringCoordinator;
    this.#strategies = new Map();
    this.#circuitBreakers = new Map();
    this.#fallbacks = new Map();
    this.#cache = new Map();

    this.#initializeDefaultStrategies();
  }

  // Register a recovery strategy for an error type
  registerStrategy(errorType, strategy) {
    this.#strategies.set(errorType, {
      retry: strategy.retry || this.#defaultRetry,
      fallback: strategy.fallback || this.#defaultFallback,
      circuitBreaker: strategy.circuitBreaker || this.#defaultCircuitBreaker,
      maxRetries: strategy.maxRetries || 3,
      backoff: strategy.backoff || 'exponential',
      timeout: strategy.timeout || 5000
    });
    this.#logger.debug(`Registered recovery strategy for ${errorType}`);
  }

  // Execute operation with full recovery capabilities
  async executeWithRecovery(operation, options = {}) {
    const {
      operationName = 'unknown',
      errorType = null,
      maxRetries = 3,
      backoff = 'exponential',
      useCircuitBreaker = true,
      useFallback = true,
      cacheResult = false,
      timeout = 5000
    } = options;

    // Check cache first
    if (cacheResult && this.#cache.has(operationName)) {
      const cached = this.#cache.get(operationName);
      if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
        this.#logger.debug(`Returning cached result for ${operationName}`);
        return cached.value;
      }
    }

    // Get circuit breaker if enabled
    const circuitBreaker = useCircuitBreaker && this.#monitoringCoordinator
      ? this.#monitoringCoordinator.getCircuitBreaker(operationName)
      : null;

    // Execute with circuit breaker if available
    if (circuitBreaker) {
      try {
        return await this.#executeWithCircuitBreaker(
          circuitBreaker,
          operation,
          { maxRetries, backoff, timeout, operationName, cacheResult }
        );
      } catch (error) {
        if (useFallback) {
          return await this.#executeFallback(operationName, error, errorType);
        }
        throw error;
      }
    }

    // Execute with retry logic
    try {
      const result = await this.#executeWithRetry(
        operation,
        { maxRetries, backoff, timeout, operationName }
      );

      if (cacheResult) {
        this.#cache.set(operationName, {
          value: result,
          timestamp: Date.now()
        });
      }

      return result;
    } catch (error) {
      if (useFallback) {
        return await this.#executeFallback(operationName, error, errorType);
      }
      throw error;
    }
  }

  // Private: Execute with circuit breaker
  async #executeWithCircuitBreaker(circuitBreaker, operation, options) {
    return await circuitBreaker.execute(async () => {
      return await this.#executeWithRetry(operation, options);
    });
  }

  // Private: Execute with retry logic
  async #executeWithRetry(operation, options) {
    const { maxRetries, backoff, timeout, operationName } = options;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add timeout wrapper
        const result = await this.#withTimeout(operation(), timeout);

        this.#logger.debug(`Operation ${operationName} succeeded on attempt ${attempt}`);
        return result;
      } catch (error) {
        lastError = error;

        // Check if error is retriable
        if (!this.#isRetriable(error)) {
          this.#logger.warn(`Non-retriable error for ${operationName}`, {
            error: error.message
          });
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = this.#calculateBackoff(attempt, backoff);
          this.#logger.debug(`Retrying ${operationName} after ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await this.#wait(delay);
        }
      }
    }

    this.#logger.error(`All retry attempts failed for ${operationName}`, {
      attempts: maxRetries,
      lastError: lastError.message
    });
    throw lastError;
  }

  // Private: Execute fallback
  async #executeFallback(operationName, error, errorType) {
    this.#logger.info(`Executing fallback for ${operationName}`);

    // Check for registered fallback
    const strategy = errorType ? this.#strategies.get(errorType) : null;
    if (strategy && strategy.fallback) {
      try {
        return await strategy.fallback(error, operationName);
      } catch (fallbackError) {
        this.#logger.error(`Fallback failed for ${operationName}`, {
          error: fallbackError.message
        });
      }
    }

    // Use default fallback value
    const fallbackValue = this.#fallbacks.get(operationName);
    if (fallbackValue !== undefined) {
      return typeof fallbackValue === 'function'
        ? fallbackValue(error)
        : fallbackValue;
    }

    // Return generic fallback based on operation type
    return this.#getGenericFallback(operationName);
  }

  // Register fallback value for an operation
  registerFallback(operationName, value) {
    this.#fallbacks.set(operationName, value);
    this.#logger.debug(`Registered fallback for ${operationName}`);
  }

  // Check if error is retriable
  #isRetriable(error) {
    // Check if error extends BaseError and has recoverable flag
    if (error.recoverable !== undefined) {
      return error.recoverable;
    }

    // Check for specific non-retriable error types
    const nonRetriableErrors = [
      'ValidationError',
      'ConfigurationError',
      'InitializationError',
      'AuthenticationError',
      'AuthorizationError'
    ];

    if (nonRetriableErrors.includes(error.constructor.name)) {
      return false;
    }

    // Check for specific error codes
    const nonRetriableCodes = [
      'INVALID_ARGUMENT',
      'PERMISSION_DENIED',
      'NOT_FOUND',
      'ALREADY_EXISTS'
    ];

    if (error.code && nonRetriableCodes.includes(error.code)) {
      return false;
    }

    // Default to retriable for network and timeout errors
    const retriableMessages = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'timeout'
    ];

    return retriableMessages.some(msg =>
      error.message && error.message.includes(msg)
    );
  }

  // Calculate backoff delay
  #calculateBackoff(attempt, strategy) {
    const baseDelay = 100; // Base delay in ms

    switch (strategy) {
      case 'exponential':
        // Exponential backoff with jitter
        const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
        const jitter = Math.random() * exponentialDelay * 0.1; // 10% jitter
        return exponentialDelay + jitter;

      case 'linear':
        // Linear backoff
        return baseDelay * attempt;

      case 'constant':
        // Constant delay
        return baseDelay;

      default:
        // Default to exponential
        return Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
    }
  }

  // Wait for specified milliseconds
  #wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Add timeout to promise
  #withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
      )
    ]);
  }

  // Get generic fallback value
  #getGenericFallback(operationName) {
    // Infer fallback based on operation name
    if (operationName.includes('fetch') || operationName.includes('get')) {
      return null;
    }
    if (operationName.includes('list') || operationName.includes('array')) {
      return [];
    }
    if (operationName.includes('count') || operationName.includes('size')) {
      return 0;
    }
    if (operationName.includes('validate') || operationName.includes('check')) {
      return false;
    }
    if (operationName.includes('generate') || operationName.includes('create')) {
      return {};
    }

    return null;
  }

  // Initialize default strategies
  #initializeDefaultStrategies() {
    // Default retry strategy
    this.#defaultRetry = {
      maxRetries: 3,
      backoff: 'exponential'
    };

    // Default fallback strategy
    this.#defaultFallback = (error, operation) => {
      this.#logger.warn(`Using default fallback for ${operation}`);
      return null;
    };

    // Default circuit breaker config
    this.#defaultCircuitBreaker = {
      failureThreshold: 5,
      resetTimeout: 60000
    };
  }

  // Get metrics
  getMetrics() {
    return {
      registeredStrategies: this.#strategies.size,
      registeredFallbacks: this.#fallbacks.size,
      cacheSize: this.#cache.size,
      circuitBreakers: this.#circuitBreakers.size
    };
  }

  // Clear cache
  clearCache() {
    this.#cache.clear();
    this.#logger.debug('Recovery strategy cache cleared');
  }
}

export default RecoveryStrategyManager;
```

## Implementation Steps

1. **Create RecoveryStrategyManager.js**
   - Implement retry logic with backoff strategies
   - Add circuit breaker integration
   - Create fallback system

2. **Create retry strategy implementations**
   ```javascript
   // src/errors/strategies/RetryStrategy.js
   export class RetryStrategy {
     constructor(options) { /* ... */ }
     async execute(operation) { /* ... */ }
   }
   ```

3. **Create fallback strategy implementations**
   ```javascript
   // src/errors/strategies/FallbackStrategy.js
   export class FallbackStrategy {
     constructor(defaults) { /* ... */ }
     getFallback(operation, error) { /* ... */ }
   }
   ```

## File Changes

### New Files
- `src/errors/RecoveryStrategyManager.js`
- `src/errors/strategies/RetryStrategy.js`
- `src/errors/strategies/FallbackStrategy.js`

### Modified Files
- `src/dependencyInjection/tokens/tokens-monitoring.js` - Add IRecoveryStrategyManager

## Dependencies
- **Prerequisites**:
  - ANACLOENH-004-01 (BaseError class)
  - ANACLOENH-004-03 (CentralErrorHandler)
- **External**: MonitoringCoordinator

## Acceptance Criteria
1. ✅ Retry logic works with configurable backoff
2. ✅ Circuit breaker integration works
3. ✅ Fallback values return correctly
4. ✅ Caching works for successful operations
5. ✅ Non-retriable errors fail immediately
6. ✅ Timeout mechanism works
7. ✅ Strategies can be registered dynamically

## Testing Requirements

### Unit Tests
Create `tests/unit/errors/RecoveryStrategyManager.test.js`:
- Test retry with different backoff strategies
- Test circuit breaker integration
- Test fallback execution
- Test caching mechanism
- Test timeout handling
- Test retriable vs non-retriable errors

## Estimated Effort
- **Development**: 3 hours
- **Testing**: 2 hours
- **Total**: 5 hours

## Risk Assessment
- **Medium Risk**: Complex retry and circuit breaker logic
- **Mitigation**: Extensive unit testing
- **Mitigation**: Clear documentation of retry policies

## Success Metrics
- 95% of retriable errors recover successfully
- Circuit breakers prevent cascading failures
- Fallback values prevent system crashes
- No infinite retry loops

## Notes
- Keep retry logic simple and predictable
- Ensure backoff doesn't exceed reasonable limits
- Document which errors are retriable
- Consider adding retry budget to prevent overload