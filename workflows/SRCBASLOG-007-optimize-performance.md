# SRCBASLOG-007: Optimize Performance for 40+ Log Files

## Overview

Implement comprehensive performance optimizations to handle the increased file I/O operations from managing 40+ separate log files per day. This includes caching strategies, buffering mechanisms, and file handle management.

## Objectives

- Implement intelligent caching for source extraction
- Optimize file I/O operations for multiple destinations
- Add buffering strategies to reduce write frequency
- Manage file handles efficiently
- Minimize performance overhead to < 5%

## Dependencies

- SRCBASLOG-003: Server storage updates
- SRCBASLOG-005: Stack parsing implementation

## Implementation Details

### Performance Challenges

With 40+ log files instead of ~10:
- **4x more file operations** per logging cycle
- **Increased file handle usage** (risk of EMFILE errors)
- **Higher memory usage** for buffers
- **More complex rotation and cleanup**
- **Potential file system fragmentation**

### Optimization Strategies

#### 1. Hierarchical Write Buffer

```javascript
// src/logging/hierarchicalWriteBuffer.js
class HierarchicalWriteBuffer {
  constructor(config = {}) {
    this.#buffers = new Map(); // filePath -> buffer
    this.#config = {
      maxBufferSize: config.maxBufferSize || 100,
      flushInterval: config.flushInterval || 1000,
      maxMemoryUsage: config.maxMemoryUsage || 50 * 1024 * 1024, // 50MB
      compressionThreshold: config.compressionThreshold || 1024 * 1024 // 1MB
    };
    this.#stats = {
      writes: 0,
      flushes: 0,
      compressions: 0,
      memoryUsage: 0
    };
    this.#startFlushTimer();
  }
  
  add(filePath, log) {
    if (!this.#buffers.has(filePath)) {
      this.#buffers.set(filePath, {
        logs: [],
        size: 0,
        lastWrite: Date.now(),
        priority: this.#calculatePriority(filePath)
      });
    }
    
    const buffer = this.#buffers.get(filePath);
    const logSize = JSON.stringify(log).length;
    
    // Check memory pressure
    if (this.#stats.memoryUsage + logSize > this.#config.maxMemoryUsage) {
      this.#emergencyFlush();
    }
    
    buffer.logs.push(log);
    buffer.size += logSize;
    this.#stats.memoryUsage += logSize;
    
    // Flush if buffer is full
    if (buffer.logs.length >= this.#config.maxBufferSize ||
        buffer.size >= this.#config.compressionThreshold) {
      this.#flushBuffer(filePath);
    }
  }
  
  #calculatePriority(filePath) {
    // Higher priority for error/warning logs
    if (filePath.includes('error.jsonl')) return 10;
    if (filePath.includes('warning.jsonl')) return 9;
    
    // Medium priority for frequently accessed categories
    const highTrafficCategories = ['actions', 'engine', 'entities', 'events'];
    if (highTrafficCategories.some(cat => filePath.includes(cat))) return 5;
    
    return 1;
  }
  
  async #flushBuffer(filePath) {
    const buffer = this.#buffers.get(filePath);
    if (!buffer || buffer.logs.length === 0) return;
    
    try {
      // Compress if large
      const data = buffer.size > this.#config.compressionThreshold
        ? await this.#compressLogs(buffer.logs)
        : buffer.logs;
      
      await this.#writeToFile(filePath, data);
      
      this.#stats.flushes++;
      this.#stats.memoryUsage -= buffer.size;
      
      // Clear buffer
      buffer.logs = [];
      buffer.size = 0;
      buffer.lastWrite = Date.now();
    } catch (error) {
      console.error(`Failed to flush buffer for ${filePath}:`, error);
      // Keep logs in buffer for retry
    }
  }
  
  async #emergencyFlush() {
    // Flush buffers by priority
    const sortedBuffers = Array.from(this.#buffers.entries())
      .sort((a, b) => b[1].priority - a[1].priority);
    
    for (const [filePath] of sortedBuffers) {
      await this.#flushBuffer(filePath);
      
      // Check if enough memory freed
      if (this.#stats.memoryUsage < this.#config.maxMemoryUsage * 0.7) {
        break;
      }
    }
  }
}
```

#### 2. File Handle Pool

```javascript
// src/logging/fileHandlePool.js
class FileHandlePool {
  constructor(config = {}) {
    this.#handles = new Map(); // filePath -> handle
    this.#maxHandles = config.maxHandles || 50;
    this.#ttl = config.ttl || 60000; // 1 minute
    this.#accessTimes = new Map(); // filePath -> lastAccess
    this.#locks = new Map(); // filePath -> promise
  }
  
  async getHandle(filePath) {
    // Wait for any ongoing operations
    if (this.#locks.has(filePath)) {
      await this.#locks.get(filePath);
    }
    
    // Return existing handle if available
    if (this.#handles.has(filePath)) {
      this.#accessTimes.set(filePath, Date.now());
      return this.#handles.get(filePath);
    }
    
    // Check if we need to free handles
    if (this.#handles.size >= this.#maxHandles) {
      await this.#evictLeastRecentlyUsed();
    }
    
    // Open new handle
    const handle = await this.#openFile(filePath);
    this.#handles.set(filePath, handle);
    this.#accessTimes.set(filePath, Date.now());
    
    // Schedule TTL cleanup
    this.#scheduleCleanup(filePath);
    
    return handle;
  }
  
  async #openFile(filePath) {
    const lockPromise = (async () => {
      try {
        // Ensure directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        
        // Open file with append flag
        return await fs.open(filePath, 'a');
      } catch (error) {
        if (error.code === 'EMFILE') {
          // Too many open files - force eviction
          await this.#forceEviction();
          return this.#openFile(filePath);
        }
        throw error;
      }
    })();
    
    this.#locks.set(filePath, lockPromise);
    const handle = await lockPromise;
    this.#locks.delete(filePath);
    
    return handle;
  }
  
  async #evictLeastRecentlyUsed() {
    const sorted = Array.from(this.#accessTimes.entries())
      .sort((a, b) => a[1] - b[1]);
    
    // Evict 20% of handles
    const evictCount = Math.ceil(this.#maxHandles * 0.2);
    
    for (let i = 0; i < evictCount && i < sorted.length; i++) {
      const [filePath] = sorted[i];
      await this.#closeHandle(filePath);
    }
  }
  
  async #closeHandle(filePath) {
    const handle = this.#handles.get(filePath);
    if (handle) {
      try {
        await handle.close();
      } catch (error) {
        console.warn(`Failed to close handle for ${filePath}:`, error);
      }
      this.#handles.delete(filePath);
      this.#accessTimes.delete(filePath);
    }
  }
}
```

#### 3. Source Extraction Cache

```javascript
// src/logging/sourceExtractionCache.js
class SourceExtractionCache {
  constructor(config = {}) {
    this.#cache = new Map();
    this.#maxSize = config.maxSize || 500;
    this.#ttl = config.ttl || 300000; // 5 minutes
    this.#hitRate = { hits: 0, misses: 0 };
    this.#compressionEnabled = config.compression !== false;
  }
  
  get(stackTrace) {
    const key = this.#generateKey(stackTrace);
    const entry = this.#cache.get(key);
    
    if (!entry) {
      this.#hitRate.misses++;
      return null;
    }
    
    if (Date.now() - entry.timestamp > this.#ttl) {
      this.#cache.delete(key);
      this.#hitRate.misses++;
      return null;
    }
    
    this.#hitRate.hits++;
    entry.accessCount++;
    entry.lastAccess = Date.now();
    
    return entry.value;
  }
  
  set(stackTrace, value) {
    const key = this.#generateKey(stackTrace);
    
    // Check cache size
    if (this.#cache.size >= this.#maxSize) {
      this.#evict();
    }
    
    this.#cache.set(key, {
      value,
      timestamp: Date.now(),
      lastAccess: Date.now(),
      accessCount: 1,
      size: JSON.stringify(value).length
    });
  }
  
  #generateKey(stackTrace) {
    if (!stackTrace) return 'empty';
    
    // Use first meaningful line as key
    const lines = stackTrace.split('\n');
    for (const line of lines) {
      if (line && !line.includes('Error') && !line.includes('node_modules')) {
        // Hash for shorter keys
        return this.#hash(line);
      }
    }
    
    return this.#hash(stackTrace.substring(0, 200));
  }
  
  #hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
  
  #evict() {
    // LFU (Least Frequently Used) with aging
    const entries = Array.from(this.#cache.entries());
    const now = Date.now();
    
    // Calculate scores (lower = evict first)
    const scored = entries.map(([key, entry]) => {
      const age = now - entry.timestamp;
      const recency = now - entry.lastAccess;
      const frequency = entry.accessCount;
      
      // Score formula: frequency / (age * recency)
      const score = frequency / Math.max(1, (age / 1000) * (recency / 1000));
      
      return { key, score, entry };
    });
    
    // Sort by score and evict lowest 20%
    scored.sort((a, b) => a.score - b.score);
    const evictCount = Math.ceil(this.#maxSize * 0.2);
    
    for (let i = 0; i < evictCount; i++) {
      this.#cache.delete(scored[i].key);
    }
  }
  
  getStats() {
    const total = this.#hitRate.hits + this.#hitRate.misses;
    const hitRate = total > 0 ? this.#hitRate.hits / total : 0;
    
    return {
      size: this.#cache.size,
      maxSize: this.#maxSize,
      hitRate: (hitRate * 100).toFixed(2) + '%',
      hits: this.#hitRate.hits,
      misses: this.#hitRate.misses,
      memoryUsage: this.#calculateMemoryUsage()
    };
  }
}
```

#### 4. Batch Write Coordinator

```javascript
// src/logging/batchWriteCoordinator.js
class BatchWriteCoordinator {
  constructor(config = {}) {
    this.#writeBuffer = new HierarchicalWriteBuffer(config.buffer);
    this.#fileHandlePool = new FileHandlePool(config.handles);
    this.#writeQueue = [];
    this.#isProcessing = false;
    this.#maxConcurrentWrites = config.maxConcurrentWrites || 5;
  }
  
  async write(filePath, logs) {
    // Add to buffer
    for (const log of logs) {
      this.#writeBuffer.add(filePath, log);
    }
    
    // Process queue if not already processing
    if (!this.#isProcessing) {
      this.#processQueue();
    }
  }
  
  async #processQueue() {
    this.#isProcessing = true;
    
    try {
      const buffers = await this.#writeBuffer.getBuffersToFlush();
      
      // Group writes by priority
      const prioritized = this.#prioritizeWrites(buffers);
      
      // Process in batches
      for (const batch of prioritized) {
        await this.#processBatch(batch);
      }
    } finally {
      this.#isProcessing = false;
    }
  }
  
  async #processBatch(batch) {
    const promises = batch.map(async ({ filePath, logs }) => {
      try {
        const handle = await this.#fileHandlePool.getHandle(filePath);
        const content = logs.map(log => JSON.stringify(log)).join('\n') + '\n';
        
        await handle.appendFile(content);
      } catch (error) {
        console.error(`Batch write failed for ${filePath}:`, error);
        // Add back to queue for retry
        this.#writeQueue.push({ filePath, logs, retryCount: 1 });
      }
    });
    
    // Limit concurrent writes
    const chunks = this.#chunkArray(promises, this.#maxConcurrentWrites);
    for (const chunk of chunks) {
      await Promise.allSettled(chunk);
    }
  }
  
  #prioritizeWrites(buffers) {
    // Group by priority
    const groups = {
      critical: [], // errors, warnings
      high: [],     // frequently accessed
      normal: [],   // standard categories
      low: []       // rarely accessed
    };
    
    for (const buffer of buffers) {
      if (buffer.filePath.includes('error') || buffer.filePath.includes('warning')) {
        groups.critical.push(buffer);
      } else if (buffer.size > 10000) {
        groups.high.push(buffer);
      } else if (buffer.logs.length > 50) {
        groups.normal.push(buffer);
      } else {
        groups.low.push(buffer);
      }
    }
    
    return [groups.critical, groups.high, groups.normal, groups.low];
  }
}
```

## Performance Testing

### Benchmarks to Run

1. **Throughput Test**
   ```javascript
   async function throughputTest() {
     const coordinator = new BatchWriteCoordinator();
     const startTime = Date.now();
     const logCount = 100000;
     
     for (let i = 0; i < logCount; i++) {
       const category = categories[i % categories.length];
       await coordinator.write(`logs/${category}.jsonl`, [{
         level: 'debug',
         message: `Test log ${i}`,
         timestamp: new Date().toISOString()
       }]);
     }
     
     const duration = Date.now() - startTime;
     const throughput = logCount / (duration / 1000);
     
     console.log(`Throughput: ${throughput.toFixed(2)} logs/second`);
   }
   ```

2. **Memory Usage Test**
   - Monitor memory usage over time
   - Test with different buffer sizes
   - Verify memory cleanup

3. **File Handle Test**
   - Test with maximum file handles
   - Verify proper cleanup
   - Test EMFILE error handling

## Configuration Tuning

```json
{
  "performance": {
    "buffer": {
      "maxBufferSize": 100,
      "flushInterval": 1000,
      "maxMemoryUsage": 52428800,
      "compressionThreshold": 1048576
    },
    "fileHandles": {
      "maxHandles": 50,
      "ttl": 60000,
      "evictionRatio": 0.2
    },
    "cache": {
      "maxSize": 500,
      "ttl": 300000,
      "compression": true
    },
    "writes": {
      "maxConcurrentWrites": 5,
      "retryAttempts": 3,
      "retryDelay": 1000
    }
  }
}
```

## Success Criteria

- [ ] < 5% performance overhead vs current system
- [ ] Cache hit rate > 80%
- [ ] No EMFILE errors under load
- [ ] Memory usage < 100MB
- [ ] Throughput > 10,000 logs/second
- [ ] Write latency < 10ms p99
- [ ] Successful handling of 40+ concurrent files

## Risk Assessment

### Risks

1. **Memory Exhaustion**
   - Mitigation: Emergency flush mechanism
   - Memory usage monitoring
   - Configurable limits

2. **File Handle Exhaustion**
   - Mitigation: Handle pooling
   - Automatic eviction
   - EMFILE error recovery

3. **Data Loss on Crash**
   - Mitigation: Periodic flushes
   - Write-ahead logging
   - Graceful shutdown handlers

## Estimated Effort

- Implementation: 10-12 hours
- Testing: 4-5 hours
- Performance tuning: 3-4 hours
- Total: 17-21 hours

## Follow-up Tasks

- SRCBASLOG-008: Add performance benchmarks
- SRCBASLOG-009: Implement monitoring dashboard