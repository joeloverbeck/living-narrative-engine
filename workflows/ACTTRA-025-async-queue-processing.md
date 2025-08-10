# ACTTRA-025: Async Queue Processing (Proposed Enhancement)

## Summary

Design specification for enhanced asynchronous queue processing in ActionTraceOutputService. This document describes a proposed TraceQueueProcessor class with optimized batch processing, priority queuing, and advanced resource management capabilities that would extend the current basic implementation.

## Status

- **Type**: Design Specification / Proposed Enhancement
- **Implementation Status**: NOT IMPLEMENTED - Proposal Only
- **Priority**: Medium (current implementation is functional)
- **Complexity**: High
- **Estimated Time**: 4-6 hours
- **Dependencies**:
  - Current ActionTraceOutputService implementation
  - Browser storage capabilities (IndexedDB)

## Current Implementation

### What Exists Today

The current `ActionTraceOutputService` has basic queue processing built directly into the service:

```javascript
// src/actions/tracing/actionTraceOutputService.js
class ActionTraceOutputService {
  #outputQueue = [];        // Simple FIFO queue
  #isProcessing = false;    // Processing flag
  #maxQueueSize = 1000;     // Queue size limit
  #maxRetries = 3;          // Retry limit
  
  // Simple queue processing
  async #processQueue() {
    if (this.#isProcessing || this.#outputQueue.length === 0) {
      return;
    }
    
    this.#isProcessing = true;
    
    while (this.#outputQueue.length > 0) {
      const queueItem = this.#outputQueue.shift();
      
      try {
        // Write to IndexedDB via storage adapter
        await this.#storageAdapter.store('traces', queueItem.trace);
        queueItem.retryCount = 0; // Reset on success
      } catch (error) {
        // Simple retry with exponential backoff
        queueItem.retryCount = (queueItem.retryCount || 0) + 1;
        
        if (queueItem.retryCount < this.#maxRetries) {
          // Re-queue with delay
          const delay = Math.pow(2, queueItem.retryCount) * 1000;
          setTimeout(() => {
            if (this.#outputQueue.length < this.#maxQueueSize) {
              this.#outputQueue.push(queueItem);
            }
          }, delay);
        }
      }
    }
    
    this.#isProcessing = false;
  }
}
```

### Current Limitations

1. **No Priority System** - All traces processed in FIFO order
2. **Simple Retry Logic** - Basic exponential backoff without sophisticated handling
3. **No Batch Processing** - Traces processed one at a time
4. **Limited Metrics** - Only basic queue statistics
5. **Browser Storage Only** - Uses IndexedDB, not file system
6. **No Memory Management** - No tracking of queue memory usage
7. **No Backpressure** - Simple size limit without intelligent handling

## Proposed Enhancement

### Overview

Create a dedicated `TraceQueueProcessor` class that would provide:

1. **Priority Queue System** - Four-level priority handling
2. **Batch Processing** - Efficient grouping of writes
3. **Advanced Metrics** - Comprehensive performance tracking
4. **Memory Management** - Intelligent resource limits
5. **Backpressure Handling** - Sophisticated overflow management
6. **Parallel Processing** - Concurrent batch operations

### Proposed Architecture

```javascript
/**
 * PROPOSED: Advanced queue processor for trace output
 * This class would extend the current basic implementation
 */
export class TraceQueueProcessor {
  #priorityQueues;     // Map of priority levels to queues
  #metrics;            // Comprehensive performance metrics
  #resourceLimits;    // Memory and processing constraints
  
  constructor({ storageAdapter, logger, config }) {
    // Validate dependencies using current patterns
    validateDependency(storageAdapter, 'IStorageAdapter');
    validateDependency(logger, 'ILogger');
    
    // Initialize priority system
    this.#priorityQueues = new Map([
      [TracePriority.CRITICAL, []],
      [TracePriority.HIGH, []],
      [TracePriority.NORMAL, []],
      [TracePriority.LOW, []]
    ]);
  }
  
  // Advanced enqueue with priority
  enqueue(trace, priority = TracePriority.NORMAL) {
    // Check resource limits
    // Apply backpressure if needed
    // Add to appropriate queue
  }
  
  // Batch processing with parallelism
  async #processBatch() {
    // Collect items by priority
    // Process in parallel batches
    // Update metrics
    // Handle failures intelligently
  }
}
```

### Integration Strategy

The proposed TraceQueueProcessor would integrate with the existing ActionTraceOutputService:

```javascript
// Modified ActionTraceOutputService constructor
constructor({ storageAdapter, logger, actionTraceFilter }) {
  // Existing validation
  validateDependency(storageAdapter, 'IStorageAdapter');
  
  // PROPOSED: Use advanced queue processor if available
  if (typeof TraceQueueProcessor !== 'undefined') {
    this.#queueProcessor = new TraceQueueProcessor({
      storageAdapter: this.#storageAdapter,
      logger: this.#logger,
      config: this.#loadQueueConfig()
    });
  } else {
    // Fall back to current simple implementation
    this.#outputQueue = [];
    this.#isProcessing = false;
  }
}
```

## Technical Specification

### 1. Priority Levels

```javascript
export const TracePriority = {
  CRITICAL: 3,  // System errors, crashes
  HIGH: 2,      // User-facing errors
  NORMAL: 1,    // Regular traces
  LOW: 0        // Debug information
};
```

### 2. Batch Processing Algorithm

```javascript
// Proposed batch collection strategy
#collectBatch() {
  const batch = [];
  const maxBatchSize = this.#config.maxBatchSize || 10;
  
  // Collect from queues by priority
  for (const [priority, queue] of this.#priorityQueues) {
    while (queue.length > 0 && batch.length < maxBatchSize) {
      batch.push(queue.shift());
    }
    if (batch.length >= maxBatchSize) break;
  }
  
  return batch;
}
```

### 3. Resource Management

```javascript
// Proposed memory tracking
#estimateTraceSize(trace) {
  // Estimate object size in browser memory
  const jsonStr = JSON.stringify(trace);
  return new Blob([jsonStr]).size;
}

#checkMemoryLimit(newSize) {
  const used = performance.memory?.usedJSHeapSize || 0;
  const limit = performance.memory?.jsHeapSizeLimit || Infinity;
  return (used + newSize) < (limit * 0.8); // 80% threshold
}
```

### 4. Backpressure Handling

```javascript
// Proposed backpressure strategy
#handleBackpressure() {
  // Drop low-priority items first
  const lowQueue = this.#priorityQueues.get(TracePriority.LOW);
  if (lowQueue.length > 0) {
    const dropped = lowQueue.splice(0, Math.floor(lowQueue.length / 2));
    this.#metrics.droppedCount += dropped.length;
  }
  
  // Notify via event system
  this.#eventBus.dispatch({
    type: 'TRACE_QUEUE_BACKPRESSURE',
    payload: { queueSize: this.#getTotalSize() }
  });
}
```

## Implementation Considerations

### Browser Environment Constraints

1. **Storage API** - Must use IndexedDB, not file system
2. **Memory Limits** - Browser heap constraints
3. **Concurrency** - Limited by browser thread model
4. **Performance API** - Use for memory monitoring where available

### Compatibility Requirements

1. **Dependency Injection** - Follow existing DI patterns
2. **Validation** - Use `validateDependency` with `isFunction: true`
3. **Error Handling** - Dispatch events, don't log directly
4. **Testing** - Integrate with existing test framework

### Migration Path

1. **Phase 1**: Implement TraceQueueProcessor as optional enhancement
2. **Phase 2**: Test with feature flag in development
3. **Phase 3**: Gradual rollout with fallback to simple queue
4. **Phase 4**: Make default once proven stable

## Testing Strategy

### Unit Tests (Proposed)

```javascript
// tests/unit/actions/tracing/traceQueueProcessor.test.js
describe('TraceQueueProcessor', () => {
  let testBed;
  
  beforeEach(() => {
    testBed = new TraceQueueProcessorTestBed();
  });
  
  describe('Priority Queue Management', () => {
    it('should process critical traces first');
    it('should maintain FIFO within priority levels');
    it('should handle priority changes during processing');
  });
  
  describe('Batch Processing', () => {
    it('should batch traces up to configured size');
    it('should process partial batches on timeout');
    it('should handle batch failures gracefully');
  });
  
  describe('Resource Management', () => {
    it('should track memory usage accurately');
    it('should apply backpressure at limits');
    it('should drop low-priority items when necessary');
  });
});
```

### Integration Tests (Proposed)

```javascript
// tests/integration/actions/tracing/queueIntegration.test.js
describe('Queue Processor Integration', () => {
  it('should integrate with ActionTraceOutputService');
  it('should work with IndexedDB storage adapter');
  it('should handle browser memory constraints');
  it('should recover from storage failures');
});
```

## Performance Targets

### Proposed Metrics

1. **Throughput**: 500+ traces/second in browser
2. **Latency**: <50ms for critical priority
3. **Memory**: <5MB queue memory (browser constraint)
4. **Batch Efficiency**: >70% full batches
5. **Drop Rate**: <1% under normal load

### Measurement Strategy

```javascript
// Proposed metrics collection
getMetrics() {
  return {
    throughput: this.#metrics.processedCount / this.#metrics.elapsedTime,
    avgLatency: this.#metrics.totalLatency / this.#metrics.processedCount,
    memoryUsage: this.#calculateMemoryUsage(),
    batchEfficiency: this.#metrics.fullBatches / this.#metrics.totalBatches,
    dropRate: this.#metrics.droppedCount / this.#metrics.totalCount
  };
}
```

## Benefits of Enhancement

1. **Improved Performance** - Batch processing reduces I/O overhead
2. **Better Reliability** - Priority system ensures critical traces persist
3. **Resource Efficiency** - Memory management prevents browser crashes
4. **Enhanced Observability** - Comprehensive metrics for monitoring
5. **Graceful Degradation** - Intelligent backpressure handling

## Risks and Mitigations

1. **Complexity** - Incremental implementation with fallback
2. **Browser Compatibility** - Feature detection and polyfills
3. **Memory Overhead** - Careful tuning of limits
4. **Testing Coverage** - Comprehensive test suite required

## Alternative Approaches Considered

1. **Web Workers** - Offload processing to worker thread
2. **Service Worker** - Background processing capability
3. **Shared Workers** - Cross-tab queue coordination
4. **Simple Enhancement** - Just add priorities to existing queue

## Recommendation

Given the current implementation is functional for basic needs, this enhancement should be considered when:

1. Performance bottlenecks are observed
2. Trace loss becomes problematic
3. Priority handling is required
4. System scales to need batch processing

Until then, the current simple implementation in ActionTraceOutputService is adequate for most use cases.

## Next Steps

If this enhancement is approved for implementation:

1. Create feature flag for gradual rollout
2. Implement TraceQueueProcessor class
3. Add comprehensive test coverage
4. Performance test in target browsers
5. Document configuration options
6. Plan migration strategy

## Related Workflows

- **ACTTRA-026** - JSON Output Formatter (can work with current implementation)
- **ACTTRA-027** - Human-Readable Formatter (independent of queue)
- **ACTTRA-028** - File Rotation Policies (browser storage consideration)

---

**Document Status**: Design Specification - Not Implemented
**Last Updated**: 2025-01-10
**Author**: System Architect
**Note**: This is a proposed enhancement. The current ActionTraceOutputService has basic queue functionality that meets current requirements.