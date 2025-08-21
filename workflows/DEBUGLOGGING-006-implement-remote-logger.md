# DEBUGLOGGING-006: Implement RemoteLogger with Batching and Retry Logic

**Status**: Not Started  
**Priority**: P0 - Critical  
**Phase**: 1 - Infrastructure  
**Component**: Client-Side Logger  
**Estimated**: 6 hours  

## Description

Implement the RemoteLogger class that batches debug logs and sends them to the llm-proxy-server endpoint. This logger must handle network failures gracefully, implement retry logic with exponential backoff, and include circuit breaker functionality.

## Technical Requirements

### 1. Class Structure
```javascript
class RemoteLogger {
  #endpoint;           // Server endpoint URL
  #batchSize;          // Max logs per batch
  #flushInterval;      // Time-based flush in ms
  #buffer;             // Current batch buffer
  #flushTimer;         // Timer for time-based flush
  #retryAttempts;      // Max retry attempts
  #circuitBreaker;     // Circuit breaker state
  #sessionId;          // Unique session identifier
  #fallbackLogger;     // Console logger for failures
  
  constructor(config)
  
  // ILogger interface
  debug(message, metadata)
  info(message, metadata)
  warn(message, metadata)
  error(message, metadata)
  
  // ConsoleLogger compatibility
  groupCollapsed(label)
  groupEnd()
  table(data, columns)
  setLogLevel(logLevelInput)
  
  // Internal methods
  async #flush()
  async #sendBatch(logs)
  #scheduleFlush()
  #addToBuffer(level, message, metadata)
  #enrichLogEntry(level, message, metadata)
  #handleSendFailure(error, logs)
}
```

### 2. Batching Strategy
- Buffer logs until batch size reached (default: 100)
- Flush on timer interval (default: 1000ms)
- Flush immediately for error level logs
- Flush on page unload/visibility change

### 3. Retry Logic
```javascript
// Exponential backoff with jitter
const delay = Math.min(
  baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
  maxDelay
);
```

### 4. Circuit Breaker States
- **Closed**: Normal operation, sending logs
- **Open**: Too many failures, skip sending
- **Half-Open**: Test with single request

## Implementation Steps

1. **Create RemoteLogger Class**
   - [ ] Create `src/logging/remoteLogger.js`
   - [ ] Implement constructor with config validation
   - [ ] Initialize batch buffer and timers
   - [ ] Generate unique session ID

2. **Implement Batching Logic**
   - [ ] Add logs to buffer with enrichment
   - [ ] Check batch size and trigger flush
   - [ ] Implement time-based flush timer
   - [ ] Handle immediate flush for errors

3. **Implement Network Communication**
   - [ ] Create HTTP POST request handler
   - [ ] Add request timeout handling
   - [ ] Implement response validation
   - [ ] Handle network errors gracefully

4. **Implement Retry Mechanism**
   ```javascript
   async #retryWithBackoff(fn, maxAttempts) {
     for (let attempt = 0; attempt < maxAttempts; attempt++) {
       try {
         return await fn();
       } catch (error) {
         if (attempt === maxAttempts - 1) throw error;
         await this.#delay(this.#calculateBackoff(attempt));
       }
     }
   }
   ```

5. **Implement Circuit Breaker**
   ```javascript
   class CircuitBreaker {
     constructor(threshold, timeout)
     async execute(fn)
     recordSuccess()
     recordFailure()
     #checkState()
     #reset()
   }
   ```

6. **Add Page Lifecycle Handling**
   - [ ] Listen for beforeunload event
   - [ ] Listen for visibilitychange event
   - [ ] Implement synchronous flush for unload
   - [ ] Use sendBeacon API if available

7. **Implement Fallback Mechanism**
   - [ ] Fall back to console on network failure
   - [ ] Log circuit breaker state changes
   - [ ] Track and report failure metrics
   - [ ] Implement gradual recovery

## Metadata Enrichment

Each log entry should include:
```javascript
{
  level: "debug|info|warn|error",
  message: "Log message",
  category: "auto-detected category",
  timestamp: "ISO 8601",
  source: "file.js:line", // if available
  sessionId: "uuid-v4",
  metadata: {
    ...userMetadata,
    userAgent: navigator.userAgent,
    url: window.location.href,
    performance: {
      memory: performance.memory?.usedJSHeapSize,
      timing: performance.now()
    }
  }
}
```

## Acceptance Criteria

- [ ] Logs are batched before sending
- [ ] Batch sends when size limit reached
- [ ] Batch sends on timer interval
- [ ] Retry logic works with exponential backoff
- [ ] Circuit breaker prevents cascade failures
- [ ] Fallback to console logger works
- [ ] Page unload triggers final flush
- [ ] Session ID persists across all logs
- [ ] Network failures don't lose logs

## Dependencies

- **Requires**: DEBUGLOGGING-001 (server endpoint)
- **Requires**: DEBUGLOGGING-007 (category detection)
- **Used By**: DEBUGLOGGING-005 (LoggerStrategy)

## Testing Requirements

1. **Unit Tests**
   - [ ] Test batching logic
   - [ ] Test timer-based flush
   - [ ] Test retry mechanism
   - [ ] Test circuit breaker states
   - [ ] Test metadata enrichment

2. **Integration Tests**
   - [ ] Test network communication
   - [ ] Test failure handling
   - [ ] Test page lifecycle events
   - [ ] Test high-volume logging

3. **Performance Tests**
   - [ ] Test with 13,000+ logs
   - [ ] Measure memory usage
   - [ ] Test network bandwidth usage

## Files to Create/Modify

- **Create**: `src/logging/remoteLogger.js`
- **Create**: `src/logging/circuitBreaker.js`
- **Create**: `tests/unit/logging/remoteLogger.test.js`
- **Create**: `tests/unit/logging/circuitBreaker.test.js`

## Performance Considerations

- Use `navigator.sendBeacon()` for unload events
- Implement request debouncing
- Compress large batches if possible
- Monitor memory usage of buffer
- Consider using Web Workers for heavy processing

## Error Handling Strategy

1. **Network Errors**: Retry with backoff, then fallback
2. **Server Errors (5xx)**: Retry with longer backoff
3. **Client Errors (4xx)**: Log error, don't retry
4. **Timeout**: Treat as network error
5. **Circuit Open**: Skip sending, use fallback

## Configuration Example

```javascript
{
  endpoint: "http://localhost:3001/api/debug-log",
  batchSize: 100,
  flushInterval: 1000,
  retryAttempts: 3,
  retryBaseDelay: 1000,
  retryMaxDelay: 30000,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000,
  requestTimeout: 5000,
  fallbackToConsole: true
}
```

## Notes

- Consider implementing log compression in future
- May need to handle CORS issues
- Ensure no infinite retry loops
- Test with various network conditions
- Consider offline support with IndexedDB

## Related Tickets

- **Depends On**: DEBUGLOGGING-001 (endpoint)
- **Depends On**: DEBUGLOGGING-007 (categories)
- **Used By**: DEBUGLOGGING-005 (LoggerStrategy)
- **Next**: DEBUGLOGGING-008 (HybridLogger)