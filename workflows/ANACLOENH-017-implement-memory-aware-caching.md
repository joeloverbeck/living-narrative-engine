# ANACLOENH-017: Implement Memory-Aware Caching

## Overview
Implement adaptive caching system that monitors memory pressure and dynamically adjusts cache behavior to prevent memory issues while maintaining performance. Target 40% reduction in memory usage during high-pressure scenarios.

## Current State
- **Fixed Cache Sizes**: Caches have static size limits regardless of memory availability
- **No Memory Pressure Detection**: System doesn't adapt to memory constraints
- **Memory Growth**: Gradual memory growth in long-running sessions
- **Cache Eviction**: Simple LRU without memory pressure consideration

## Objectives
1. Implement memory pressure detection and monitoring
2. Create adaptive cache sizing based on available memory
3. Add intelligent eviction strategies during memory pressure
4. Implement cache compression for large entries
5. Create memory-aware cache warming strategies
6. Reduce overall memory footprint by 40% during pressure scenarios

## Technical Requirements

### Memory-Aware Cache Implementation
```javascript
// Location: src/common/cache/MemoryAwareCache.js
class MemoryAwareCache extends UnifiedCache {
  #memoryMonitor;
  #pressureManager;
  #adaptiveConfig;
  #compressionThreshold;
  #lastPressureLevel;
  
  constructor(options) {
    const {
      memoryThreshold = 0.8,
      compressionThreshold = 1000,
      adaptiveResize = true,
      memoryMonitor,
      pressureManager,
      ...baseOptions
    } = options;
    
    super(baseOptions);
    
    this.#memoryMonitor = memoryMonitor;
    this.#pressureManager = pressureManager;
    this.#compressionThreshold = compressionThreshold;
    this.#lastPressureLevel = 'normal';
    
    this.#adaptiveConfig = {
      normal: {
        maxSize: baseOptions.maxSize,
        ttl: baseOptions.ttl,
        compressionEnabled: false
      },
      warning: {
        maxSize: Math.floor(baseOptions.maxSize * 0.7),
        ttl: Math.floor(baseOptions.ttl * 0.8),
        compressionEnabled: true
      },
      critical: {
        maxSize: Math.floor(baseOptions.maxSize * 0.4),
        ttl: Math.floor(baseOptions.ttl * 0.5),
        compressionEnabled: true
      }
    };
    
    this.#setupMemoryPressureHandling();
  }
  
  set(key, value, options = {}) {
    const pressureLevel = this.#getCurrentPressureLevel();
    const config = this.#adaptiveConfig[pressureLevel];
    
    // Apply memory pressure adaptations
    const adaptedOptions = {
      ...options,
      ttl: options.ttl || config.ttl,
      compress: config.compressionEnabled || this.#shouldCompress(value)
    };
    
    // Check if we need to make room
    if (this.size >= config.maxSize) {
      this.#makeRoom(pressureLevel);
    }
    
    // Compress value if needed
    if (adaptedOptions.compress) {
      value = this.#compressValue(value);
    }
    
    return super.set(key, value, adaptedOptions);
  }
  
  get(key, generator) {
    const pressureLevel = this.#getCurrentPressureLevel();
    
    // During critical pressure, skip expensive cache generation
    if (pressureLevel === 'critical' && generator) {
      const existing = super.get(key);
      if (existing === undefined) {
        // Return null instead of computing expensive values
        return null;
      }
    }
    
    let value = super.get(key, generator);
    
    // Decompress if needed
    if (value && value.__compressed) {
      value = this.#decompressValue(value);
    }
    
    return value;
  }
  
  #setupMemoryPressureHandling() {
    // Listen for memory pressure events
    this.#memoryMonitor.onThresholdExceeded((level) => {
      this.#handleMemoryPressure(level);
    });
    
    // Periodic memory pressure checks
    setInterval(() => {
      const currentLevel = this.#getCurrentPressureLevel();
      if (currentLevel !== this.#lastPressureLevel) {
        this.#adaptToMemoryPressure(currentLevel);
        this.#lastPressureLevel = currentLevel;
      }
    }, 5000); // Check every 5 seconds
  }
  
  #getCurrentPressureLevel() {
    const memoryUsage = this.#memoryMonitor.getCurrentUsage();
    const heapUsed = memoryUsage.heapUsed;
    const heapTotal = memoryUsage.heapTotal;
    const usage = heapUsed / heapTotal;
    
    if (usage > 0.9) return 'critical';
    if (usage > 0.8) return 'warning';
    return 'normal';
  }
  
  #handleMemoryPressure(level) {
    switch (level) {
      case 'critical':
        this.#performEmergencyCleanup();
        break;
      case 'warning':
        this.#performPreventiveCleanup();
        break;
      default:
        // Normal operation
        break;
    }
  }
  
  #performEmergencyCleanup() {
    // Aggressive cache clearing
    const targetSize = Math.floor(this.size * 0.3); // Keep only 30%
    
    // Clear least valuable entries first
    const entries = Array.from(this.entries())
      .sort((a, b) => this.#calculateEntryValue(a) - this.#calculateEntryValue(b));
    
    let cleared = 0;
    for (const [key] of entries) {
      if (this.size <= targetSize) break;
      
      this.delete(key);
      cleared++;
    }
    
    console.warn(`Emergency cache cleanup: cleared ${cleared} entries`);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
  
  #performPreventiveCleanup() {
    // Moderate cache reduction
    const targetSize = Math.floor(this.size * 0.7); // Keep 70%
    
    // Clear expired and low-value entries
    this.#clearExpiredEntries();
    
    if (this.size > targetSize) {
      const toRemove = this.size - targetSize;
      const leastValuable = this.#getLeastValuableEntries(toRemove);
      
      for (const key of leastValuable) {
        this.delete(key);
      }
    }
  }
  
  #adaptToMemoryPressure(level) {
    const config = this.#adaptiveConfig[level];
    
    // Resize cache if needed
    if (this.maxSize !== config.maxSize) {
      this.#resizeCache(config.maxSize);
    }
    
    // Update TTL for new entries
    this.defaultTTL = config.ttl;
    
    console.info(`Cache adapted to ${level} memory pressure`);
  }
  
  #makeRoom(pressureLevel) {
    const config = this.#adaptiveConfig[pressureLevel];
    const targetSize = Math.floor(config.maxSize * 0.9); // Leave some room
    
    if (this.size <= targetSize) return;
    
    const toRemove = this.size - targetSize;
    
    switch (pressureLevel) {
      case 'critical':
        // Remove largest entries first
        this.#removeLargestEntries(toRemove);
        break;
      case 'warning':
        // Standard LRU eviction
        this.#removeLeastRecentlyUsed(toRemove);
        break;
      default:
        // Standard eviction
        this.#removeLeastRecentlyUsed(Math.min(toRemove, 10));
        break;
    }
  }
  
  #shouldCompress(value) {
    if (typeof value === 'string') {
      return value.length > this.#compressionThreshold;
    }
    
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value).length > this.#compressionThreshold;
      } catch {
        return false;
      }
    }
    
    return false;
  }
  
  #compressValue(value) {
    // Simple compression simulation
    // In reality, would use actual compression library
    const serialized = JSON.stringify(value);
    
    return {
      __compressed: true,
      data: serialized, // Would be compressed data
      originalSize: serialized.length,
      compressedSize: Math.floor(serialized.length * 0.6) // Simulate 40% compression
    };
  }
  
  #decompressValue(compressedValue) {
    if (!compressedValue.__compressed) {
      return compressedValue;
    }
    
    try {
      return JSON.parse(compressedValue.data);
    } catch {
      return compressedValue.data;
    }
  }
  
  #calculateEntryValue(entry) {
    const [key, value, metadata] = entry;
    
    // Calculate value based on:
    // - Access frequency
    // - Computation cost
    // - Size
    // - Age
    
    const frequency = metadata?.accessCount || 1;
    const computationCost = metadata?.computationTime || 1;
    const size = this.#getEntrySize(value);
    const age = Date.now() - (metadata?.createdAt || Date.now());
    
    // Higher frequency and computation cost = higher value
    // Larger size and older age = lower value
    return (frequency * computationCost) / (size * Math.log(age + 1));
  }
  
  #getEntrySize(value) {
    if (value && value.__compressed) {
      return value.compressedSize || 0;
    }
    
    try {
      return JSON.stringify(value).length;
    } catch {
      return 100; // Default size estimate
    }
  }
  
  #removeLargestEntries(count) {
    const entries = Array.from(this.entries())
      .sort((a, b) => this.#getEntrySize(b[1]) - this.#getEntrySize(a[1]));
    
    for (let i = 0; i < Math.min(count, entries.length); i++) {
      this.delete(entries[i][0]);
    }
  }
  
  getMemoryStats() {
    const entries = Array.from(this.entries());
    
    let totalSize = 0;
    let compressedEntries = 0;
    let compressionSavings = 0;
    
    for (const [, value] of entries) {
      const size = this.#getEntrySize(value);
      totalSize += size;
      
      if (value && value.__compressed) {
        compressedEntries++;
        compressionSavings += (value.originalSize || 0) - (value.compressedSize || 0);
      }
    }
    
    return {
      totalEntries: this.size,
      totalMemoryUsage: totalSize,
      compressedEntries,
      compressionSavings,
      compressionRatio: compressionSavings / (totalSize + compressionSavings),
      pressureLevel: this.#getCurrentPressureLevel()
    };
  }
}

export default MemoryAwareCache;
```

### Memory Pressure Detector
```javascript
// Location: src/common/monitoring/MemoryPressureDetector.js
class MemoryPressureDetector {
  #monitor;
  #thresholds;
  #history;
  #listeners;
  
  constructor({ monitor, thresholds }) {
    this.#monitor = monitor;
    this.#thresholds = {
      warning: 0.8,
      critical: 0.9,
      ...thresholds
    };
    this.#history = [];
    this.#listeners = {
      warning: [],
      critical: [],
      normal: []
    };
    
    this.#startMonitoring();
  }
  
  #startMonitoring() {
    setInterval(() => {
      const usage = this.#monitor.getCurrentUsage();
      const pressureLevel = this.#detectPressureLevel(usage);
      
      this.#history.push({
        timestamp: Date.now(),
        usage,
        level: pressureLevel
      });
      
      // Keep only last 100 samples
      if (this.#history.length > 100) {
        this.#history.shift();
      }
      
      this.#notifyListeners(pressureLevel, usage);
    }, 1000); // Check every second
  }
  
  #detectPressureLevel(usage) {
    const heapRatio = usage.heapUsed / usage.heapTotal;
    
    if (heapRatio >= this.#thresholds.critical) {
      return 'critical';
    } else if (heapRatio >= this.#thresholds.warning) {
      return 'warning';
    }
    
    return 'normal';
  }
  
  onPressure(level, callback) {
    if (this.#listeners[level]) {
      this.#listeners[level].push(callback);
    }
  }
  
  #notifyListeners(level, usage) {
    const callbacks = this.#listeners[level] || [];
    for (const callback of callbacks) {
      try {
        callback(usage, level);
      } catch (error) {
        console.error('Memory pressure callback error:', error);
      }
    }
  }
  
  getPressureTrend() {
    if (this.#history.length < 10) return 'stable';
    
    const recent = this.#history.slice(-10);
    const increasing = recent.filter((sample, i) => {
      if (i === 0) return false;
      return sample.usage.heapUsed > recent[i - 1].usage.heapUsed;
    }).length;
    
    if (increasing >= 7) return 'increasing';
    if (increasing <= 3) return 'decreasing';
    return 'stable';
  }
}
```

## Implementation Steps

1. **Memory-Aware Cache Core** (Day 1-2)
   - Implement MemoryAwareCache class
   - Add adaptive sizing logic
   - Create compression mechanisms

2. **Memory Pressure Detection** (Day 3)
   - Build MemoryPressureDetector
   - Add threshold monitoring
   - Create trend analysis

3. **Adaptive Behaviors** (Day 4)
   - Implement intelligent eviction strategies
   - Add emergency cleanup procedures
   - Create cache warming optimization

4. **Integration with Existing Systems** (Day 5)
   - Update facades to use memory-aware caching
   - Integrate with clothing and anatomy systems
   - Add configuration options

5. **Testing and Validation** (Day 6)
   - Performance testing under memory pressure
   - Memory usage validation
   - Compression effectiveness testing

## File Changes

### New Files
- `src/common/cache/MemoryAwareCache.js`
- `src/common/monitoring/MemoryPressureDetector.js`
- `src/common/cache/strategies/MemoryAwareEvictionStrategy.js`

### Modified Files
- `src/clothing/facades/ClothingSystemFacade.js` - Use memory-aware cache
- `src/anatomy/facades/AnatomySystemFacade.js` - Use memory-aware cache
- `src/dependencyInjection/registrations/infrastructureRegistrations.js`

### Test Files
- `tests/unit/common/cache/MemoryAwareCache.test.js`
- `tests/unit/common/monitoring/MemoryPressureDetector.test.js`
- `tests/memory/cache/memoryAwareCaching.memory.test.js`

## Dependencies
- **Prerequisites**: 
  - ANACLOENH-001 (Unified Cache)
  - ANACLOENH-003 (Memory Monitor)
- **Internal**: MemoryMonitor, UnifiedCache

## Acceptance Criteria
1. ✅ 40% memory reduction during critical pressure
2. ✅ Adaptive cache sizing works correctly
3. ✅ Compression reduces memory usage by >30%
4. ✅ Emergency cleanup prevents memory exhaustion
5. ✅ Performance degradation <10% under normal conditions
6. ✅ All existing functionality preserved

## Estimated Effort: 6 days
## Success Metrics: 40% memory reduction, <10% performance impact, 95% memory pressure detection accuracy