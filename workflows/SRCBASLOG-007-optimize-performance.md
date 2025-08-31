# SRCBASLOG-007: Optimize Performance for HTTP-Based Remote Logging

## Overview

Implement comprehensive performance optimizations for the HTTP-based remote logging system that sends logs from the browser-based Living Narrative Engine to the llm-proxy-server. This includes optimizing batching strategies, improving network resilience, and reducing memory overhead for the RemoteLogger and HybridLogger components.

## Objectives

- Optimize HTTP request batching and adaptive flushing
- Improve circuit breaker responsiveness and recovery times
- Enhance memory management for log buffering
- Optimize log category detection and caching
- Minimize performance overhead to < 5% of application runtime

## Dependencies

- SRCBASLOG-003: Server storage updates
- SRCBASLOG-005: Stack parsing implementation

## Implementation Details

### Performance Challenges

With increased logging volume in browser-based HTTP remote logging:
- **Higher HTTP request frequency** to llm-proxy-server endpoint
- **Increased memory pressure** from log buffering in browser environment
- **Network latency impact** on logging performance
- **Circuit breaker overhead** during network failures
- **Category detection computation** cost for log classification
- **Browser memory limits** constraining buffer sizes

### Optimization Strategies

#### 1. RemoteLogger Adaptive Batching Optimization

Enhance the existing `RemoteLogger` class (src/logging/remoteLogger.js) with dynamic batching based on logging volume and network conditions:

**Key Improvements:**
- **Adaptive batch sizing**: Adjust `batchSize` based on recent throughput metrics
- **Priority-based flushing**: Process error/warning logs with higher priority
- **Memory pressure detection**: Implement emergency flush when buffer approaches browser memory limits
- **Network condition awareness**: Adjust flush intervals based on circuit breaker state

```javascript
// Enhancement to src/logging/remoteLogger.js
// Add adaptive batching configuration
const adaptiveConfig = {
  minBatchSize: 10,
  maxBatchSize: 200,
  adaptiveThreshold: 0.8, // Adapt when buffer is 80% full
  priorityLevels: ['error', 'warn', 'info', 'debug']
};

// Implement priority-based buffer management
#priorityBuffers = new Map(); // level -> logs[]
#adaptBatchSize(currentThroughput, networkLatency) {
  // Dynamic batch size based on performance metrics
}
```

#### 2. LogCategoryDetector Caching Enhancement

Optimize the existing `LogCategoryDetector` (src/logging/logCategoryDetector.js) to reduce computation overhead:

**Key Improvements:**
- **LRU cache for category patterns**: Cache detection results for frequently seen log patterns
- **Precompiled regex patterns**: Convert string patterns to compiled regex for faster matching
- **Category hint system**: Allow components to provide category hints to skip detection

```javascript
// Enhancement to src/logging/logCategoryDetector.js
#categoryCache = new LRUCache({ max: 1000, ttl: 300000 }); // 5 min TTL
#precompiledPatterns = new Map(); // Compile regex patterns once

detectCategory(message, hint = null) {
  if (hint && this.#validateCategoryHint(hint)) return hint;
  
  const cacheKey = this.#generateCacheKey(message);
  if (this.#categoryCache.has(cacheKey)) {
    return this.#categoryCache.get(cacheKey);
  }
  
  // Existing detection logic with precompiled patterns
  const category = this.#performDetection(message);
  this.#categoryCache.set(cacheKey, category);
  return category;
}
```

#### 3. HybridLogger Filtering Optimization

Enhance the existing `HybridLogger` (src/logging/hybridLogger.js) with more efficient filtering:

**Key Improvements:**
- **Early filtering**: Filter logs before expensive processing steps
- **Shared filter compilation**: Reuse compiled filters across console/remote loggers
- **Dynamic filter updating**: Allow runtime filter updates without logger restart

```javascript
// Enhancement to src/logging/hybridLogger.js
#compiledFilters = {
  console: new CompiledFilterSet(),
  remote: new CompiledFilterSet()
};

#shouldLog(destination, level, category, message) {
  const filterSet = this.#compiledFilters[destination];
  return filterSet.test(level, category, message);
}
```

#### 4. CircuitBreaker Tuning for Network Resilience

Optimize the existing `CircuitBreaker` (src/logging/circuitBreaker.js) for better network failure handling:

**Key Improvements:**
- **Exponential backoff**: Implement smarter retry timing
- **Partial failure detection**: Distinguish between network and server errors
- **Health check integration**: Add lightweight health checks before reopening circuit
- **Adaptive thresholds**: Adjust failure thresholds based on historical performance

```javascript
// Enhancement to src/logging/circuitBreaker.js
#adaptiveThresholds = {
  baseFailureThreshold: 5,
  currentThreshold: 5,
  successfulRequestsToIncrease: 20
};

#isNetworkError(error) {
  return error.name === 'NetworkError' || 
         error.code === 'NETWORK_ERROR' ||
         error.message.includes('fetch');
}
```

## Performance Testing

Use existing performance test infrastructure in `tests/performance/logging/` to validate optimizations.

### Benchmarks to Run

1. **HTTP Request Throughput Test**
   
   Reference: `tests/performance/logging/remoteLogger.performance.test.js`
   
   ```javascript
   // Test RemoteLogger with varying batch sizes and logging volumes
   describe('RemoteLogger Performance', () => {
     it('should handle high-volume logging within performance targets', async () => {
       const logger = new RemoteLogger({
         batchSize: 50,
         flushInterval: 2000,
         endpoint: 'http://localhost:3001/api/debug-logs'
       });
       
       const startTime = performance.now();
       const logCount = 10000;
       
       for (let i = 0; i < logCount; i++) {
         logger.info(`Performance test log ${i}`, { iteration: i });
       }
       
       await logger.flush(); // Ensure all logs sent
       const duration = performance.now() - startTime;
       const throughput = logCount / (duration / 1000);
       
       expect(throughput).toBeGreaterThan(1000); // >1000 logs/second
       expect(duration).toBeLessThan(10000); // <10 seconds total
     });
   });
   ```

2. **Memory Usage and Buffer Management Test**
   
   Reference: `tests/performance/logging/hybridLogger.performance.test.js`
   
   ```javascript
   // Monitor browser memory usage during intensive logging
   it('should maintain memory usage within browser limits', async () => {
     const initialMemory = performance.memory.usedJSHeapSize;
     const logger = new HybridLogger({/* config */});
     
     // Generate sustained logging load
     for (let batch = 0; batch < 100; batch++) {
       for (let i = 0; i < 100; i++) {
         logger.debug(`Memory test ${batch}-${i}`, { data: 'x'.repeat(1000) });
       }
       await new Promise(resolve => setTimeout(resolve, 10)); // Allow processing
     }
     
     const finalMemory = performance.memory.usedJSHeapSize;
     const memoryGrowth = finalMemory - initialMemory;
     
     expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // <50MB growth
   });
   ```

3. **Circuit Breaker and Network Resilience Test**
   
   Reference: `tests/performance/logging/circuitBreaker.performance.test.js`
   
   ```javascript
   // Test circuit breaker performance under network failures
   it('should handle network failures without significant performance impact', async () => {
     const circuitBreaker = new CircuitBreaker({
       threshold: 5,
       timeout: 1000
     });
     
     // Simulate network failures and measure recovery time
     const startTime = performance.now();
     
     // Test pattern: failures → recovery → normal operation
     await simulateNetworkFailures(circuitBreaker, 10);
     await simulateNetworkRecovery(circuitBreaker);
     
     const recoveryTime = performance.now() - startTime;
     expect(recoveryTime).toBeLessThan(5000); // <5 second recovery
   });
   ```

4. **Category Detection Performance Test**
   
   New test to add: `tests/performance/logging/logCategoryDetector.performance.test.js`
   
   ```javascript
   // Benchmark category detection caching effectiveness
   it('should achieve >80% cache hit rate with realistic log patterns', async () => {
     const detector = new LogCategoryDetector({ enableCache: true });
     const testMessages = generateRealisticLogMessages(1000);
     
     // First pass - populate cache
     for (const message of testMessages) {
       detector.detectCategory(message);
     }
     
     // Second pass - measure cache performance
     const startTime = performance.now();
     for (const message of testMessages) {
       detector.detectCategory(message);
     }
     const duration = performance.now() - startTime;
     
     const stats = detector.getCacheStats();
     expect(stats.hitRate).toBeGreaterThan(0.8); // >80% hit rate
     expect(duration).toBeLessThan(100); // <100ms for 1000 detections
   });
   ```

## Configuration Tuning

Optimize configuration for actual logging components. Reference existing configuration patterns from the codebase.

### RemoteLogger Optimized Configuration

```json
{
  "remoteLogger": {
    "endpoint": "http://localhost:3001/api/debug-logs",
    "batchSize": 50,
    "flushInterval": 2000,
    "maxBufferSize": 1000,
    "retryAttempts": 3,
    "retryBaseDelay": 1000,
    "retryMaxDelay": 30000,
    "circuitBreakerThreshold": 5,
    "circuitBreakerTimeout": 60000,
    "requestTimeout": 10000,
    "metadataLevel": "standard",
    "enableCategoryCache": true,
    "categoryCacheSize": 1000
  }
}
```

### HybridLogger Filtering Configuration

```json
{
  "hybridLogger": {
    "filters": {
      "console": {
        "levels": ["error", "warn", "info"],
        "categories": null,
        "enabled": true
      },
      "remote": {
        "levels": ["error", "warn", "info", "debug"],
        "categories": null,
        "enabled": true
      }
    },
    "filtering": {
      "patterns": ["password", "token", "secret"],
      "replacement": "[FILTERED]"
    }
  }
}
```

### CircuitBreaker Configuration

```json
{
  "circuitBreaker": {
    "failureThreshold": 5,
    "successThreshold": 3,
    "timeout": 60000,
    "monitoringPeriod": 10000,
    "fallback": {
      "strategy": "buffer",
      "maxBufferSize": 500
    }
  }
}
```

### LogCategoryDetector Configuration

```json
{
  "logCategoryDetector": {
    "enableCache": true,
    "cacheSize": 1000,
    "cacheTTL": 300000,
    "patterns": {
      "engine": ["engine", "core", "system"],
      "entities": ["entity", "component", "ecs"],
      "actions": ["action", "handler", "operation"],
      "events": ["event", "dispatch", "listener"],
      "ui": ["dom", "render", "interface"]
    }
  }
}
```

## Success Criteria

- [ ] < 5% performance overhead vs current logging system
- [ ] Category detection cache hit rate > 80%
- [ ] HTTP request batch efficiency > 90% (successful batches/total requests)
- [ ] Browser memory usage growth < 50MB during intensive logging
- [ ] Throughput > 1,000 logs/second in browser environment
- [ ] HTTP request latency < 200ms p99 to llm-proxy-server
- [ ] Circuit breaker recovery time < 5 seconds after network restoration
- [ ] Log buffer utilization > 75% before flushing (efficient batching)

## Risk Assessment

### Risks

1. **Browser Memory Exhaustion**
   - Mitigation: Adaptive buffer size limits based on `performance.memory`
   - Emergency flush when approaching memory limits
   - Configurable maximum buffer sizes per logger instance

2. **Network Connectivity Issues**
   - Mitigation: Circuit breaker with exponential backoff
   - Fallback to console-only logging during extended outages
   - Intelligent retry strategies with connection health checks

3. **Log Data Loss During Browser Crashes**
   - Mitigation: More aggressive flushing for critical log levels (error, warn)
   - `navigator.sendBeacon()` for essential logs during page unload
   - Consider `localStorage` buffering for critical logs (optional enhancement)

4. **Performance Degradation Under High Load**
   - Mitigation: Adaptive batching based on current system performance
   - Priority-based log processing (errors first)
   - Dynamic configuration adjustment based on browser capabilities

## Estimated Effort

- **RemoteLogger enhancements**: 6-8 hours
  - Adaptive batching implementation
  - Priority-based buffer management
  - Memory pressure detection
- **LogCategoryDetector optimization**: 3-4 hours
  - LRU cache implementation
  - Pattern precompilation
  - Category hint system
- **HybridLogger filtering improvements**: 2-3 hours
  - Early filtering logic
  - Shared filter compilation
- **CircuitBreaker tuning**: 2-3 hours
  - Exponential backoff refinement
  - Health check integration
- **Performance testing**: 4-5 hours
  - Update existing performance tests
  - Add new category detection benchmarks
- **Configuration optimization**: 2-3 hours
  - Tune parameters based on test results
- **Total**: 19-26 hours

## Follow-up Tasks

- SRCBASLOG-008: Implement performance monitoring dashboard for HTTP-based logging metrics
- SRCBASLOG-009: Add real-time logging performance alerts and adaptive configuration
- SRCBASLOG-010: Investigate `localStorage` buffering for critical logs during connectivity issues