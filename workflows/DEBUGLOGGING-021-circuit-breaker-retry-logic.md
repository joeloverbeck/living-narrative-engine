# DEBUGLOGGING-021: Add Circuit Breaker and Retry Logic

**Status**: Not Started  
**Priority**: P1 - High  
**Phase**: 4 - Monitoring  
**Component**: Reliability  
**Estimated**: 4 hours  

## Description

Implement comprehensive circuit breaker pattern and retry logic with exponential backoff to handle network failures gracefully and prevent cascade failures. This builds upon the basic implementation in DEBUGLOGGING-009.

## Technical Requirements

### 1. Enhanced Circuit Breaker
```javascript
class CircuitBreaker {
  // States
  states = {
    CLOSED: 'CLOSED',         // Normal operation
    OPEN: 'OPEN',             // Blocking requests
    HALF_OPEN: 'HALF_OPEN'    // Testing recovery
  };
  
  // Configuration
  config = {
    failureThreshold: 5,      // Failures to open
    successThreshold: 2,      // Successes to close
    timeout: 60000,           // Time before half-open
    volumeThreshold: 10,      // Min requests for statistics
    errorThresholdPercentage: 50,
    slowCallDuration: 3000,   // Slow call threshold
    slowCallThreshold: 5      // Slow calls to open
  };
  
  // Statistics
  stats = {
    requests: [],             // Rolling window
    failures: 0,
    successes: 0,
    slowCalls: 0,
    lastFailureTime: null,
    stateChanges: []
  };
}
```

### 2. Retry Strategy
```javascript
class RetryStrategy {
  // Exponential backoff with jitter
  calculateDelay(attempt) {
    const baseDelay = this.config.baseDelay;
    const maxDelay = this.config.maxDelay;
    const exponential = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const jitter = Math.random() * exponential * 0.1; // 10% jitter
    return exponential + jitter;
  }
  
  // Retry conditions
  shouldRetry(error, attempt) {
    if (attempt >= this.config.maxAttempts) return false;
    if (this.isRetriableError(error)) return true;
    if (this.isRateLimitError(error)) return true;
    return false;
  }
}
```

### 3. Error Classification
```javascript
const ERROR_TYPES = {
  RETRIABLE: [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'NetworkError',
    503, // Service Unavailable
    502  // Bad Gateway
  ],
  
  RATE_LIMIT: [
    429  // Too Many Requests
  ],
  
  NON_RETRIABLE: [
    400, // Bad Request
    401, // Unauthorized
    403, // Forbidden
    404  // Not Found
  ]
};
```

## Implementation Steps

1. **Create Advanced Circuit Breaker**
   - [ ] Create `src/logging/reliability/advancedCircuitBreaker.js`
   - [ ] Implement state machine with statistics
   - [ ] Add rolling window for metrics
   - [ ] Implement health checks

2. **Circuit Breaker Implementation**
   ```javascript
   export class AdvancedCircuitBreaker {
     constructor(config) {
       this.config = { ...DEFAULT_CONFIG, ...config };
       this.state = this.states.CLOSED;
       this.stats = new RollingStats(this.config.windowSize);
       this.stateTimer = null;
     }
     
     async execute(fn, context) {
       // Check if we should attempt
       if (!this.canAttempt()) {
         throw new CircuitOpenError('Circuit breaker is OPEN');
       }
       
       const startTime = Date.now();
       
       try {
         const result = await this.executeWithTimeout(fn, context);
         this.recordSuccess(Date.now() - startTime);
         return result;
       } catch (error) {
         this.recordFailure(Date.now() - startTime, error);
         throw error;
       }
     }
     
     canAttempt() {
       switch (this.state) {
         case this.states.CLOSED:
           return true;
         case this.states.OPEN:
           return this.shouldTransitionToHalfOpen();
         case this.states.HALF_OPEN:
           return this.stats.attempts < this.config.halfOpenLimit;
       }
     }
     
     recordSuccess(duration) {
       this.stats.record({ success: true, duration });
       
       if (this.state === this.states.HALF_OPEN) {
         if (this.stats.recentSuccesses >= this.config.successThreshold) {
           this.transitionTo(this.states.CLOSED);
         }
       }
     }
     
     recordFailure(duration, error) {
       this.stats.record({ success: false, duration, error });
       
       if (this.shouldOpen()) {
         this.transitionTo(this.states.OPEN);
       }
     }
   }
   ```

3. **Create Retry Manager**
   - [ ] Create `src/logging/reliability/retryManager.js`
   - [ ] Implement exponential backoff
   - [ ] Add jitter calculation
   - [ ] Implement retry policies

4. **Retry Manager Implementation**
   ```javascript
   export class RetryManager {
     constructor(config) {
       this.config = config;
       this.retryPolicy = new RetryPolicy(config.policy);
     }
     
     async executeWithRetry(fn, context) {
       let lastError;
       
       for (let attempt = 0; attempt <= this.config.maxAttempts; attempt++) {
         try {
           // Add retry metadata to context
           const enrichedContext = {
             ...context,
             retryAttempt: attempt,
             isRetry: attempt > 0
           };
           
           const result = await fn(enrichedContext);
           
           // Success - report if it was a retry
           if (attempt > 0) {
             this.reportRetrySuccess(attempt, context);
           }
           
           return result;
         } catch (error) {
           lastError = error;
           
           // Check if we should retry
           if (!this.shouldRetry(error, attempt)) {
             throw error;
           }
           
           // Calculate and apply delay
           const delay = this.calculateDelay(attempt, error);
           await this.delay(delay);
           
           // Log retry attempt
           this.logRetryAttempt(attempt, delay, error);
         }
       }
       
       // All retries exhausted
       throw new RetryExhaustedError(lastError, this.config.maxAttempts);
     }
     
     shouldRetry(error, attempt) {
       // Check attempt limit
       if (attempt >= this.config.maxAttempts) {
         return false;
       }
       
       // Check error type
       return this.retryPolicy.isRetriable(error);
     }
   }
   ```

5. **Create Error Classifier**
   ```javascript
   export class ErrorClassifier {
     classify(error) {
       // Network errors
       if (error.code && NETWORK_ERROR_CODES.includes(error.code)) {
         return { type: 'network', retriable: true };
       }
       
       // HTTP status codes
       if (error.status) {
         if (ERROR_TYPES.RETRIABLE.includes(error.status)) {
           return { type: 'server', retriable: true };
         }
         if (ERROR_TYPES.RATE_LIMIT.includes(error.status)) {
           return { type: 'rate_limit', retriable: true, delay: error.retryAfter };
         }
         if (ERROR_TYPES.NON_RETRIABLE.includes(error.status)) {
           return { type: 'client', retriable: false };
         }
       }
       
       // Timeout errors
       if (error.name === 'TimeoutError') {
         return { type: 'timeout', retriable: true };
       }
       
       // Default
       return { type: 'unknown', retriable: false };
     }
   }
   ```

6. **Integration with RemoteLogger**
   ```javascript
   // In RemoteLogger
   async sendBatch(logs) {
     return this.circuitBreaker.execute(async () => {
       return this.retryManager.executeWithRetry(async (context) => {
         return this.httpClient.post(this.endpoint, { logs }, {
           timeout: this.config.requestTimeout,
           headers: {
             'X-Retry-Attempt': context.retryAttempt
           }
         });
       });
     });
   }
   ```

## Acceptance Criteria

- [ ] Circuit breaker opens on threshold failures
- [ ] Circuit breaker transitions states correctly
- [ ] Retry logic uses exponential backoff
- [ ] Jitter prevents thundering herd
- [ ] Error classification works correctly
- [ ] Statistics are tracked accurately
- [ ] Health checks trigger recovery
- [ ] No infinite retry loops

## Dependencies

- **Enhances**: DEBUGLOGGING-009 (basic implementation)
- **Used By**: DEBUGLOGGING-006 (RemoteLogger)
- **Monitors**: DEBUGLOGGING-020 (metrics)

## Testing Requirements

1. **Unit Tests**
   - [ ] Test state transitions
   - [ ] Test retry calculations
   - [ ] Test error classification
   - [ ] Test statistics tracking

2. **Integration Tests**
   - [ ] Test with network failures
   - [ ] Test with server errors
   - [ ] Test recovery scenarios
   - [ ] Test under load

3. **Chaos Engineering Tests**
   - [ ] Random network failures
   - [ ] Latency injection
   - [ ] Server unavailability
   - [ ] Partial failures

## Files to Create/Modify

- **Create**: `src/logging/reliability/advancedCircuitBreaker.js`
- **Create**: `src/logging/reliability/retryManager.js`
- **Create**: `src/logging/reliability/errorClassifier.js`
- **Create**: `src/logging/reliability/retryPolicy.js`
- **Modify**: `src/logging/remoteLogger.js`
- **Create**: `tests/unit/logging/reliability/`

## Configuration Example

```javascript
{
  "reliability": {
    "circuitBreaker": {
      "enabled": true,
      "failureThreshold": 5,
      "successThreshold": 2,
      "timeout": 60000,
      "halfOpenLimit": 3,
      "slowCallDuration": 3000
    },
    "retry": {
      "enabled": true,
      "maxAttempts": 3,
      "baseDelay": 1000,
      "maxDelay": 30000,
      "policy": "exponential"
    }
  }
}
```

## Monitoring Integration

```javascript
// Emit events for monitoring
this.eventBus.emit('circuit.state.change', {
  from: oldState,
  to: newState,
  reason: reason,
  stats: this.stats.getSummary()
});

this.eventBus.emit('retry.attempt', {
  attempt: attemptNumber,
  delay: delayMs,
  error: error.message
});
```

## Health Check Implementation

```javascript
class HealthChecker {
  async checkEndpoint(url) {
    try {
      const response = await fetch(`${url}/health`, {
        method: 'HEAD',
        timeout: 1000
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  scheduleHealthChecks(circuitBreaker) {
    setInterval(async () => {
      if (circuitBreaker.state === 'OPEN') {
        const healthy = await this.checkEndpoint(this.endpoint);
        if (healthy) {
          circuitBreaker.transitionTo('HALF_OPEN');
        }
      }
    }, 30000); // Every 30 seconds
  }
}
```

## Notes

- Consider implementing bulkhead pattern
- May need different policies for different error types
- Think about retry budget to prevent overload
- Consider adaptive retry delays
- Document retry behavior for users

## Related Tickets

- **Enhances**: DEBUGLOGGING-009
- **Used By**: DEBUGLOGGING-006
- **Monitored By**: DEBUGLOGGING-020