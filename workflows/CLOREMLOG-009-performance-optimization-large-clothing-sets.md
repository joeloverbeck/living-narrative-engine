# CLOREMLOG-009: Performance Optimization for Large Clothing Sets

## Overview
**Priority**: Low  
**Phase**: 3 (System Enhancement)  
**Estimated Effort**: 6-10 hours  
**Dependencies**: CLOREMLOG-008 (Comprehensive test suite provides performance baselines)  
**Blocks**: None

## Problem Statement

While the unified clothing system from Phase 2 provides correct functionality, performance analysis from CLOREMLOG-008 may reveal optimization opportunities for large clothing sets. Characters with extensive wardrobes (20+ clothing items) or complex layering scenarios could experience slower response times that impact gameplay experience.

**Performance Targets**:
- Simple clothing queries: <5ms
- Complex clothing queries: <15ms  
- Large wardrobe queries (50+ items): <25ms
- Memory usage: <1MB growth per 1000 queries

**Areas for Optimization**:
- Coverage blocking analysis efficiency
- Priority calculation caching
- Service call optimization
- Memory usage minimization

## Root Cause

**Algorithmic Complexity**: The current implementation prioritizes correctness over performance. With the system now working correctly, optimization opportunities exist in:
- O(n²) coverage analysis for large equipment sets
- Repeated priority calculations without sufficient caching
- Service call overhead in resolver integration
- Memory allocation patterns in service operations

## Acceptance Criteria

### 1. Performance Profiling and Analysis
- [ ] **Baseline measurements**: Establish current performance metrics from test suite
- [ ] **Bottleneck identification**: Profile code to identify slowest operations
- [ ] **Memory analysis**: Identify memory allocation hotspots and leaks
- [ ] **Scalability testing**: Test with progressively larger clothing sets

### 2. Coverage Analysis Optimization
- [ ] **Algorithm improvement**: Optimize coverage blocking calculation from O(n²) to O(n log n)
- [ ] **Early termination**: Stop coverage analysis when sufficient results found
- [ ] **Incremental analysis**: Cache coverage results for unchanged equipment
- [ ] **Spatial indexing**: Group clothing by body area for faster lookups

### 3. Priority Calculation Optimization
- [ ] **Enhanced caching**: Improve cache hit rates and reduce cache misses
- [ ] **Batch calculations**: Calculate priorities for multiple items simultaneously
- [ ] **Precomputed priorities**: Cache common priority calculations at startup
- [ ] **Lazy evaluation**: Calculate priorities only when needed

### 4. Service Integration Optimization
- [ ] **Call batching**: Reduce number of service calls from resolvers
- [ ] **Result pooling**: Reuse service result objects to reduce garbage collection
- [ ] **Query optimization**: Optimize service queries for common use cases
- [ ] **Connection pooling**: Minimize service instantiation overhead

### 5. Memory Usage Optimization
- [ ] **Object pooling**: Reuse objects for clothing items and results
- [ ] **Cache size management**: Implement intelligent cache eviction
- [ ] **Memory profiling**: Eliminate memory leaks and unnecessary allocations
- [ ] **Garbage collection optimization**: Minimize GC pressure

## Implementation Details

### Performance Profiling Framework

#### Profiling Infrastructure
```javascript
// src/clothing/performance/clothingProfiler.js
export class ClothingPerformanceProfiler {
  #metrics;
  #samplingEnabled;

  constructor() {
    this.#metrics = new Map();
    this.#samplingEnabled = process.env.NODE_ENV === 'development';
  }

  startProfiling(operationName, context = {}) {
    if (!this.#samplingEnabled) return null;

    const profileId = `${operationName}_${Date.now()}_${Math.random()}`;
    this.#metrics.set(profileId, {
      operation: operationName,
      context,
      startTime: performance.now(),
      startMemory: process.memoryUsage().heapUsed
    });

    return profileId;
  }

  endProfiling(profileId) {
    if (!this.#samplingEnabled || !profileId) return null;

    const metric = this.#metrics.get(profileId);
    if (!metric) return null;

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    const result = {
      operation: metric.operation,
      context: metric.context,
      duration: endTime - metric.startTime,
      memoryDelta: endMemory - metric.startMemory,
      timestamp: Date.now()
    };

    this.#metrics.delete(profileId);
    this.recordMetric(result);

    return result;
  }

  private recordMetric(metric) {
    // Store metric for analysis
    console.debug(`Performance: ${metric.operation} took ${metric.duration.toFixed(2)}ms, memory: ${metric.memoryDelta} bytes`);
  }

  getMetricsSummary() {
    // Return performance summary for analysis
  }
}
```

#### Profiling Integration
```javascript
// Integration into ClothingAccessibilityService
export class ClothingAccessibilityService {
  #profiler;

  getAccessibleItems(entityId, options = {}) {
    const profileId = this.#profiler.startProfiling('getAccessibleItems', {
      entityId,
      mode: options.mode,
      itemCount: this.getEstimatedItemCount(entityId)
    });

    try {
      const result = this.performGetAccessibleItems(entityId, options);
      return result;
    } finally {
      this.#profiler.endProfiling(profileId);
    }
  }

  private getEstimatedItemCount(entityId) {
    const equipment = this.#entityManager.getComponent(entityId, 'core:equipment');
    return Object.values(equipment?.equipped || {}).reduce((count, slot) => {
      return count + Object.keys(slot || {}).length;
    }, 0);
  }
}
```

### Coverage Analysis Optimization

#### Optimized Coverage Blocking Algorithm
```javascript
// src/clothing/optimization/optimizedCoverageAnalyzer.js
export class OptimizedCoverageAnalyzer {
  #spatialIndex;
  #coverageCache;
  #bodyAreaGroups;

  constructor() {
    this.#spatialIndex = new Map(); // Group items by body area
    this.#coverageCache = new LRUCache(1000, 300000); // 5-minute TTL
    this.#bodyAreaGroups = this.initializeBodyAreaGroups();
  }

  analyzeCoverageBlocking(equipped, entityId) {
    const cacheKey = this.createCacheKey(equipped, entityId);
    
    // Check cache first
    let cached = this.#coverageCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Build spatial index for efficient lookups
    this.buildSpatialIndex(equipped);

    // Perform optimized coverage analysis
    const analysis = this.performOptimizedAnalysis(equipped, entityId);
    
    // Cache result
    this.#coverageCache.set(cacheKey, analysis);
    
    return analysis;
  }

  private buildSpatialIndex(equipped) {
    this.#spatialIndex.clear();

    for (const [slotName, slotData] of Object.entries(equipped)) {
      if (!slotData || typeof slotData !== 'object') continue;

      const bodyArea = this.getBodyAreaForSlot(slotName);
      if (!this.#spatialIndex.has(bodyArea)) {
        this.#spatialIndex.set(bodyArea, []);
      }

      for (const [layer, itemId] of Object.entries(slotData)) {
        this.#spatialIndex.get(bodyArea).push({
          itemId,
          layer,
          slotName,
          bodyArea
        });
      }
    }
  }

  private performOptimizedAnalysis(equipped, entityId) {
    const accessibilityMap = new Map();

    // Process each body area independently (parallel optimization opportunity)
    for (const [bodyArea, items] of this.#spatialIndex) {
      this.analyzeBodyAreaCoverage(bodyArea, items, accessibilityMap);
    }

    return {
      isAccessible: (itemId, slotName, layer) => {
        return accessibilityMap.get(itemId)?.accessible ?? true;
      },
      getBlockingItem: (itemId) => {
        return accessibilityMap.get(itemId)?.blockedBy ?? null;
      }
    };
  }

  private analyzeBodyAreaCoverage(bodyArea, items, accessibilityMap) {
    // Sort items by priority (once per body area)
    const sortedItems = items.sort((a, b) => 
      this.comparePriority(a.layer, b.layer)
    );

    // Process in priority order - early termination when blocked
    for (let i = 0; i < sortedItems.length; i++) {
      const item = sortedItems[i];
      const accessibility = this.calculateItemAccessibility(item, sortedItems.slice(0, i));
      accessibilityMap.set(item.itemId, accessibility);
    }
  }

  private calculateItemAccessibility(item, higherPriorityItems) {
    // Check if any higher priority item blocks this one
    for (const higherItem of higherPriorityItems) {
      if (this.doesItemBlock(higherItem, item)) {
        return {
          accessible: false,
          blockedBy: higherItem.itemId,
          reason: 'blocked_by_coverage'
        };
      }
    }

    return {
      accessible: true,
      blockedBy: null,
      reason: 'accessible'
    };
  }

  private doesItemBlock(blocker, blocked) {
    // Optimized blocking check with early returns
    if (blocker.bodyArea !== blocked.bodyArea) return false;
    if (blocker.layer === blocked.layer) return false;
    
    const blockerPriority = this.getLayerPriority(blocker.layer);
    const blockedPriority = this.getLayerPriority(blocked.layer);
    
    return blockerPriority < blockedPriority; // Lower number = higher priority
  }
}
```

### Priority Calculation Optimization

#### Enhanced Priority Caching
```javascript
// src/clothing/optimization/optimizedPriorityManager.js
export class OptimizedPriorityManager extends ClothingPriorityManager {
  #priorityCache;
  #batchCalculator;
  #precomputedPriorities;

  constructor(config) {
    super(config);
    this.#priorityCache = new AdvancedCache({
      maxSize: 10000,
      ttl: 600000, // 10 minutes
      strategy: 'lru'
    });
    this.#batchCalculator = new BatchPriorityCalculator();
    this.#precomputedPriorities = this.precomputeCommonPriorities();
  }

  calculatePriority(layer, context = 'removal', modifiers = {}) {
    // Check precomputed cache first (fastest path)
    const precomputedKey = `${layer}:${context}`;
    if (this.#precomputedPriorities.has(precomputedKey) && Object.keys(modifiers).length === 0) {
      return this.#precomputedPriorities.get(precomputedKey);
    }

    // Check runtime cache
    const cacheKey = this.createAdvancedCacheKey(layer, context, modifiers);
    const cached = this.#priorityCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Calculate and cache
    const priority = this.computePriority(layer, context, modifiers);
    this.#priorityCache.set(cacheKey, priority);
    
    return priority;
  }

  calculatePrioritiesBatch(items) {
    // Batch calculation for multiple items
    return this.#batchCalculator.calculateBatch(items, this);
  }

  private precomputeCommonPriorities() {
    const precomputed = new Map();
    const commonContexts = ['removal', 'equipping', 'display', 'topmost'];
    const commonLayers = ['outer', 'base', 'underwear', 'direct'];

    for (const context of commonContexts) {
      for (const layer of commonLayers) {
        const priority = super.calculatePriority(layer, context, {});
        precomputed.set(`${layer}:${context}`, priority);
      }
    }

    return precomputed;
  }
}
```

#### Batch Priority Calculator
```javascript
class BatchPriorityCalculator {
  calculateBatch(items, priorityManager) {
    // Group items by context for efficient calculation
    const contextGroups = this.groupByContext(items);
    const results = new Map();

    for (const [context, contextItems] of contextGroups) {
      const contextResults = this.calculateContextBatch(contextItems, context, priorityManager);
      for (const [itemId, priority] of contextResults) {
        results.set(itemId, priority);
      }
    }

    return results;
  }

  private groupByContext(items) {
    const groups = new Map();
    
    for (const item of items) {
      const context = item.context || 'removal';
      if (!groups.has(context)) {
        groups.set(context, []);
      }
      groups.get(context).push(item);
    }

    return groups;
  }

  private calculateContextBatch(items, context, priorityManager) {
    const results = new Map();
    
    // Sort by layer for potential optimization
    const sortedItems = items.sort((a, b) => a.layer.localeCompare(b.layer));
    
    for (const item of sortedItems) {
      const priority = priorityManager.calculatePriority(item.layer, context, item.modifiers);
      results.set(item.itemId, priority);
    }

    return results;
  }
}
```

### Service Integration Optimization

#### Optimized Service Calls
```javascript
// Optimized resolver integration
export class OptimizedArrayIterationResolver extends ArrayIterationResolver {
  #serviceCallCache;
  #resultPool;

  constructor(dependencies) {
    super(dependencies);
    this.#serviceCallCache = new Map();
    this.#resultPool = new ObjectPool(() => this.createResultObject());
  }

  getAllClothingItems(clothingAccess, trace) {
    const { entityId, mode } = clothingAccess;
    
    // Check if we have recent results for this entity
    const cacheKey = `${entityId}:${mode}`;
    const cached = this.#serviceCallCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      trace?.addStep('Using cached service results');
      return this.cloneResults(cached.results);
    }

    // Batch service call with optimized parameters
    const serviceResults = this.#clothingAccessibilityService.getAccessibleItems(entityId, {
      mode: mode,
      context: 'removal',
      includeMetadata: true, // Get everything we need in one call
      optimization: 'speed'  // Hint to service for speed over completeness
    });

    // Convert and cache results
    const resolverResults = this.convertServiceResultsOptimized(serviceResults, trace);
    this.#serviceCallCache.set(cacheKey, {
      results: resolverResults,
      timestamp: Date.now(),
      equipmentHash: this.getEquipmentHash(clothingAccess.equipped)
    });

    return resolverResults;
  }

  private convertServiceResultsOptimized(serviceItems, trace) {
    const results = [];
    
    for (const item of serviceItems) {
      // Reuse pooled objects to reduce allocation
      const resultItem = this.#resultPool.acquire();
      resultItem.itemId = item.itemId;
      resultItem.layer = item.layer;
      resultItem.slotName = item.slotName;
      resultItem.coveragePriority = item.priority;
      resultItem.source = 'clothing_service';
      resultItem.priority = 0;
      
      results.push(resultItem);
    }

    return results;
  }

  private isCacheValid(cached) {
    const age = Date.now() - cached.timestamp;
    return age < 5000; // 5 second cache for clothing queries
  }

  private getEquipmentHash(equipped) {
    // Simple hash of equipment state for cache invalidation
    return JSON.stringify(equipped).split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
  }
}
```

### Memory Optimization

#### Object Pool Implementation
```javascript
// src/clothing/optimization/objectPool.js
export class ObjectPool {
  #factory;
  #resetFn;
  #pool;
  #maxSize;

  constructor(factory, resetFn = null, maxSize = 1000) {
    this.#factory = factory;
    this.#resetFn = resetFn;
    this.#pool = [];
    this.#maxSize = maxSize;
  }

  acquire() {
    if (this.#pool.length > 0) {
      return this.#pool.pop();
    }
    return this.#factory();
  }

  release(obj) {
    if (this.#pool.length < this.#maxSize) {
      if (this.#resetFn) {
        this.#resetFn(obj);
      }
      this.#pool.push(obj);
    }
  }

  clear() {
    this.#pool.length = 0;
  }

  get size() {
    return this.#pool.length;
  }
}
```

#### Advanced Caching System
```javascript
// src/clothing/optimization/advancedCache.js
export class AdvancedCache {
  #cache;
  #accessTimes;
  #maxSize;
  #ttl;
  #strategy;

  constructor({ maxSize = 1000, ttl = 300000, strategy = 'lru' }) {
    this.#cache = new Map();
    this.#accessTimes = new Map();
    this.#maxSize = maxSize;
    this.#ttl = ttl;
    this.#strategy = strategy;
  }

  get(key) {
    const entry = this.#cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.#ttl) {
      this.delete(key);
      return null;
    }

    // Update access time for LRU
    if (this.#strategy === 'lru') {
      this.#accessTimes.set(key, Date.now());
    }

    return entry.value;
  }

  set(key, value) {
    // Evict if at capacity
    if (this.#cache.size >= this.#maxSize && !this.#cache.has(key)) {
      this.evict();
    }

    const now = Date.now();
    this.#cache.set(key, { value, timestamp: now });
    this.#accessTimes.set(key, now);
  }

  delete(key) {
    this.#cache.delete(key);
    this.#accessTimes.delete(key);
  }

  private evict() {
    if (this.#strategy === 'lru') {
      this.evictLRU();
    } else if (this.#strategy === 'ttl') {
      this.evictExpired();
    }
  }

  private evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, time] of this.#accessTimes) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  private evictExpired() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, entry] of this.#cache) {
      if (now - entry.timestamp > this.#ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.delete(key));
  }
}
```

## Testing Requirements

### Performance Test Updates
```javascript
// tests/performance/clothing/optimizedClothingPerformance.test.js
describe('Optimized Clothing Performance', () => {
  describe('Response Time Improvements', () => {
    it('should resolve simple queries within 3ms (improved from 5ms)', () => {
      // Test improved simple query performance
    });

    it('should resolve complex queries within 10ms (improved from 15ms)', () => {
      // Test improved complex query performance
    });

    it('should resolve large wardrobes within 20ms (improved from 25ms)', () => {
      // Test improved large wardrobe performance
    });
  });

  describe('Memory Usage Improvements', () => {
    it('should limit memory growth to <500KB per 1000 queries (improved from 1MB)', () => {
      // Test improved memory usage
    });

    it('should benefit significantly from object pooling', () => {
      // Test object pool effectiveness
    });

    it('should maintain stable memory usage over extended operation', () => {
      // Test long-running memory stability
    });
  });

  describe('Cache Effectiveness', () => {
    it('should achieve >90% cache hit rate for repeated queries', () => {
      // Test cache hit rate improvements
    });

    it('should handle cache eviction gracefully', () => {
      // Test cache eviction performance
    });
  });

  describe('Scalability Improvements', () => {
    it('should handle 200+ clothing items without significant slowdown', () => {
      // Test improved scalability
    });

    it('should maintain performance with concurrent queries', () => {
      // Test concurrency performance
    });
  });
});
```

### Memory Profiling Tests
```javascript
describe('Memory Usage Profiling', () => {
  it('should not leak memory during extended operation', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Perform 10,000 clothing queries
    for (let i = 0; i < 10000; i++) {
      clothingService.getAccessibleItems(`entity_${i % 100}`);
      if (i % 1000 === 0) {
        global.gc?.(); // Force garbage collection if available
      }
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;

    expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024); // < 5MB growth
  });

  it('should benefit from object pooling', () => {
    // Test with and without object pooling
  });
});
```

## Risk Assessment

### Performance Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-------------|
| Over-optimization complexity | Medium | Low | Focus on proven bottlenecks only |
| Cache invalidation bugs | Medium | Medium | Comprehensive cache testing |
| Memory leak introduction | Low | High | Thorough memory profiling |
| Regression in functionality | Low | High | Extensive regression testing |

### Implementation Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-------------|
| Premature optimization | Low | Low | Profile-driven optimization only |
| Breaking existing APIs | Low | Medium | Maintain API compatibility |
| Cache coherency issues | Medium | Medium | Simple cache invalidation strategy |

## Definition of Done
- [ ] Performance targets met: <5ms simple, <15ms complex, <25ms large wardrobe
- [ ] Memory usage improved: <500KB growth per 1000 queries
- [ ] Cache hit rates >90% for common query patterns
- [ ] No functionality regressions from optimization changes
- [ ] Performance test suite validates improvements
- [ ] Memory profiling shows no leaks or excessive allocation
- [ ] Code maintains readability and maintainability

## Dependencies and Integration

### Upstream Dependencies
- **CLOREMLOG-008**: Performance baselines and test infrastructure
- **Phase 2 completion**: Stable, correct implementation to optimize

### Downstream Impact
- **Future development**: Provides performance foundation for advanced features
- **User experience**: Improved responsiveness for clothing interactions
- **Scalability**: Better support for complex character configurations

## Success Metrics
- **Response time**: 40-50% improvement in query response times
- **Memory efficiency**: 50% reduction in memory growth rate
- **Cache effectiveness**: >90% hit rate for repeated queries
- **Scalability**: Support for 2x larger clothing sets at same performance
- **User experience**: No noticeable delay in clothing-related actions

## Notes
- Focus on measurable performance improvements backed by profiling data
- Maintain code clarity and maintainability during optimization
- Use standard optimization patterns (caching, pooling, indexing)
- Document performance characteristics for future developers
- Consider adding performance monitoring for production use
- Optimization should be invisible to service consumers (no API changes)