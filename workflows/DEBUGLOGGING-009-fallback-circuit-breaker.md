# DEBUGLOGGING-009: Implement Fallback Mechanisms and Circuit Breaker

**Status**: Not Started  
**Priority**: P1 - High  
**Phase**: 2 - Integration  
**Component**: Client-Side Logger  
**Estimated**: 4 hours  

## Description

Implement robust fallback mechanisms and a circuit breaker pattern to handle network failures gracefully. This ensures logging continues to function even when the remote server is unavailable.

## Technical Requirements

### 1. Circuit Breaker States
```javascript
class CircuitBreaker {
  // States
  CLOSED = 'CLOSED';       // Normal operation
  OPEN = 'OPEN';           // Too many failures, blocking calls
  HALF_OPEN = 'HALF_OPEN'; // Testing recovery
  
  // Configuration
  failureThreshold: 5;     // Failures before opening
  successThreshold: 2;     // Successes to close from half-open
  timeout: 60000;          // Time before half-open (ms)
  
  // Tracking
  failureCount: 0;
  successCount: 0;
  lastFailureTime: null;
  state: 'CLOSED';
}
```

### 2. Fallback Chain
```
RemoteLogger (primary)
    ↓ (on failure)
Console Logger (fallback 1)
    ↓ (if disabled)
Memory Buffer (fallback 2)
    ↓ (if full)
Drop logs (last resort)
```

### 3. Recovery Strategy
- Gradual recovery from failures
- Exponential backoff between attempts
- Health check probes during half-open state
- Automatic state transitions

## Implementation Steps

1. **Create Circuit Breaker Class**
   - [ ] Create `src/logging/circuitBreaker.js`
   - [ ] Implement state machine logic
   - [ ] Add failure/success tracking
   - [ ] Implement timeout mechanism

2. **Circuit Breaker State Machine**
   ```javascript
   class CircuitBreaker {
     constructor(options) {
       this.failureThreshold = options.failureThreshold || 5;
       this.successThreshold = options.successThreshold || 2;
       this.timeout = options.timeout || 60000;
       this.state = 'CLOSED';
       this.failureCount = 0;
       this.successCount = 0;
       this.nextAttempt = Date.now();
     }
     
     async execute(fn) {
       if (this.state === 'OPEN') {
         if (Date.now() < this.nextAttempt) {
           throw new Error('Circuit breaker is OPEN');
         }
         this.state = 'HALF_OPEN';
       }
       
       try {
         const result = await fn();
         this.onSuccess();
         return result;
       } catch (error) {
         this.onFailure();
         throw error;
       }
     }
   }
   ```

3. **Implement Fallback Manager**
   - [ ] Create `src/logging/fallbackManager.js`
   - [ ] Define fallback chain
   - [ ] Implement fallback execution
   - [ ] Add recovery detection

4. **Fallback Execution Logic**
   ```javascript
   class FallbackManager {
     constructor(fallbacks) {
       this.fallbacks = fallbacks;
       this.currentIndex = 0;
     }
     
     async execute(operation, ...args) {
       for (let i = this.currentIndex; i < this.fallbacks.length; i++) {
         try {
           const result = await this.fallbacks[i][operation](...args);
           this.currentIndex = Math.max(0, i - 1); // Gradual recovery
           return result;
         } catch (error) {
           console.warn(`Fallback ${i} failed:`, error);
         }
       }
       // All fallbacks failed
       this.handleTotalFailure();
     }
   }
   ```

5. **Create Memory Buffer Fallback**
   - [ ] Implement in-memory circular buffer
   - [ ] Set maximum buffer size (1000 logs)
   - [ ] Add buffer overflow handling
   - [ ] Implement buffer drain on recovery

6. **Integration with RemoteLogger**
   - [ ] Wrap network calls with circuit breaker
   - [ ] Implement fallback chain
   - [ ] Add recovery detection
   - [ ] Track failure metrics

## Acceptance Criteria

- [ ] Circuit breaker opens after threshold failures
- [ ] Circuit breaker transitions to half-open after timeout
- [ ] Circuit breaker closes after successful recovery
- [ ] Fallback to console logger works
- [ ] Memory buffer captures logs when console unavailable
- [ ] Recovery is detected and gradual
- [ ] No infinite retry loops
- [ ] Metrics track circuit breaker state changes

## Dependencies

- **Modifies**: DEBUGLOGGING-006 (RemoteLogger)
- **Uses**: ConsoleLogger (existing)

## Testing Requirements

1. **Unit Tests**
   - [ ] Test circuit breaker state transitions
   - [ ] Test failure counting logic
   - [ ] Test timeout mechanism
   - [ ] Test fallback chain execution
   - [ ] Test memory buffer limits

2. **Integration Tests**
   - [ ] Test with network failures
   - [ ] Test recovery scenarios
   - [ ] Test fallback chain
   - [ ] Test buffer drain on recovery

3. **Failure Simulation Tests**
   - [ ] Simulate server down
   - [ ] Simulate intermittent failures
   - [ ] Simulate slow responses
   - [ ] Simulate partial failures

## Files to Create/Modify

- **Create**: `src/logging/circuitBreaker.js`
- **Create**: `src/logging/fallbackManager.js`
- **Create**: `src/logging/memoryBuffer.js`
- **Modify**: `src/logging/remoteLogger.js`
- **Create**: `tests/unit/logging/circuitBreaker.test.js`
- **Create**: `tests/unit/logging/fallbackManager.test.js`

## Circuit Breaker Configuration

```javascript
{
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,      // Failures before opening
    successThreshold: 2,      // Successes to close
    timeout: 60000,          // Ms before half-open
    monitoringInterval: 5000 // Health check interval
  }
}
```

## Monitoring and Metrics

Track and report:
- Circuit breaker state changes
- Failure/success rates
- Fallback activation count
- Buffer usage statistics
- Recovery time metrics

```javascript
// Emit events for monitoring
eventBus.emit('logger.circuit.open', { timestamp, failures });
eventBus.emit('logger.circuit.close', { timestamp, recoveryTime });
eventBus.emit('logger.fallback.activated', { level, from, to });
```

## Memory Buffer Implementation

```javascript
class MemoryBuffer {
  constructor(maxSize = 1000) {
    this.buffer = [];
    this.maxSize = maxSize;
    this.droppedCount = 0;
  }
  
  add(log) {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift(); // Remove oldest
      this.droppedCount++;
    }
    this.buffer.push(log);
  }
  
  drain() {
    const logs = [...this.buffer];
    this.buffer = [];
    return logs;
  }
}
```

## Recovery Detection

```javascript
// Periodic health check
setInterval(() => {
  if (this.circuitBreaker.state === 'OPEN') {
    this.attemptRecovery();
  }
}, config.monitoringInterval);

async attemptRecovery() {
  try {
    await this.sendHealthCheck();
    this.circuitBreaker.reset();
    await this.drainBuffer();
  } catch (error) {
    // Still down, wait for next check
  }
}
```

## Notes

- Consider implementing backpressure handling
- May need different thresholds for different error types
- Test with various network conditions
- Consider persisting buffer to localStorage
- Monitor impact on application performance

## Related Tickets

- **Modifies**: DEBUGLOGGING-006 (RemoteLogger)
- **Related**: DEBUGLOGGING-021 (monitoring)
- **Related**: DEBUGLOGGING-022 (optimization)