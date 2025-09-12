# ANACLOENH-001: Implement Unified Caching Infrastructure

## Overview
Create a standardized caching layer that consolidates the various cache implementations currently scattered across the clothing and anatomy systems. This will replace the mix of Map-based caches and LRUCache implementations with a unified approach.

## Current State
- **Clothing System**: Uses Map-based caches with manual TTL management (e.g., ClothingAccessibilityService)
- **Anatomy System**: Uses LRUCache with automatic eviction (AnatomyQueryCache, AnatomyClothingCache)
- **Issues**: Inconsistent memory management, cache coherence problems, duplicated logic

## Objectives
1. Create a unified cache interface that standardizes all caching operations
2. Implement consistent TTL and eviction policies
3. Provide both LRU and priority-based caching strategies
4. Ensure thread-safe operations for concurrent access
5. Add cache statistics and monitoring capabilities

## Technical Requirements

### Architecture Integration
The unified cache system must integrate with existing project patterns:

- **BaseService Pattern**: All cache services extend `BaseService` for consistent initialization
- **Dependency Injection**: Use existing token system (`src/dependencyInjection/tokens/tokens-core.js`)
- **Registration Pattern**: Register in `infrastructureRegistrations.js` following existing patterns  
- **Validation Pattern**: Use `validateDependency` for all injected dependencies
- **Event Integration**: Use `IValidatedEventDispatcher` for cache invalidation events
- **JSDoc Interfaces**: Define proper TypeScript-style interfaces for better IDE support

### Required New Tokens
Add to `tokens-core.js`:
```javascript
IUnifiedCache: 'IUnifiedCache',
UnifiedCache: 'UnifiedCache',
ICacheInvalidationManager: 'ICacheInvalidationManager', 
CacheInvalidationManager: 'CacheInvalidationManager',
ICacheMetrics: 'ICacheMetrics',
CacheMetrics: 'CacheMetrics',
```

### Core Implementation
```javascript
// Location: src/cache/UnifiedCache.js
import { BaseService } from '../utils/serviceBase.js';
import { validateDependency } from '../utils/dependencyUtils.js';

class UnifiedCache extends BaseService {
  #logger;
  
  constructor({ 
    logger,
    maxSize = 1000,
    ttl = 300000, // 5 minutes
    enablePriority = false,
    enableMetrics = true,
    evictionPolicy = 'lru' // 'lru' | 'lfu' | 'fifo'
  }) {
    super();
    this.#logger = this._init('UnifiedCache', logger);
    // Implementation details
  }
  
  // Core methods
  get(key, generator)
  set(key, value, options)
  invalidate(pattern)
  clear()
  
  // Monitoring methods
  getMetrics()
  getMemoryUsage()
  prune(aggressive = false)
}
```

### Cache Invalidation Strategy
```javascript
// Location: src/cache/CacheInvalidationManager.js
import { BaseService } from '../utils/serviceBase.js';
import { validateDependency } from '../utils/dependencyUtils.js';

class CacheInvalidationManager extends BaseService {
  #logger;
  #validatedEventDispatcher;
  
  constructor({ logger, validatedEventDispatcher }) {
    super();
    this.#logger = this._init('CacheInvalidationManager', logger);
    
    validateDependency(validatedEventDispatcher, 'IValidatedEventDispatcher', logger, {
      requiredMethods: ['dispatch']
    });
    this.#validatedEventDispatcher = validatedEventDispatcher;
    // Listen for invalidation events
  }
  
  registerCache(cacheId, cache)
  invalidatePattern(pattern)
  invalidateDependencies(entityId)
}
```

## Implementation Steps

1. **Create Base Cache Infrastructure** (Day 1-2)
   - Implement UnifiedCache class with configurable strategies
   - Add support for LRU, LFU, and FIFO eviction policies
   - Implement TTL management with automatic cleanup

2. **Add Priority Caching Support** (Day 3)
   - Implement PriorityCache extending UnifiedCache
   - Add priority-based eviction logic
   - Support for cache entry importance levels

3. **Implement Cache Invalidation** (Day 4)
   - Create CacheInvalidationManager
   - Add pattern-based invalidation
   - Implement dependency tracking

4. **Add Monitoring and Metrics** (Day 5)
   - Implement cache hit/miss tracking
   - Add memory usage monitoring
   - Create performance metrics collection

5. **Create Migration Utilities** (Day 6-7)
   - Build migration scripts for existing caches
   - Create compatibility layer for gradual migration
   - Migrate existing implementations:
     * `AnatomyClothingCache` and `AnatomyQueryCache` (already using LRU pattern)
     * `CoreMotivationsCacheManager` (character builder system)
     * Simple Map-based caches in `ClothingAccessibilityService`
     * Various cache utilities (`src/utils/lruCache.js`, cache helpers)
   - Update existing tests to work with unified interface
   - Document migration process

## File Changes

### New Files
- `src/cache/UnifiedCache.js`
- `src/cache/PriorityCache.js`
- `src/cache/CacheInvalidationManager.js`
- `src/cache/CacheMetrics.js`
- `src/cache/strategies/LRUStrategy.js`
- `src/cache/strategies/LFUStrategy.js`
- `src/cache/strategies/FIFOStrategy.js`

### Modified Files
- `src/dependencyInjection/registrations/infrastructureRegistrations.js` - Register new cache services
- `src/dependencyInjection/tokens/tokens-core.js` - Add cache service tokens

### Registration Example
Add to `infrastructureRegistrations.js`:
```javascript
// Register UnifiedCache as singleton
container.register(
  tokens.IUnifiedCache,
  (c) =>
    new UnifiedCache({
      logger: c.resolve(tokens.ILogger),
      config: {
        maxSize: 1000,
        ttl: 300000,
        enableMetrics: true
      }
    }),
  { lifecycle: 'singleton' }
);

// Register CacheInvalidationManager
container.register(
  tokens.ICacheInvalidationManager,
  (c) =>
    new CacheInvalidationManager({
      logger: c.resolve(tokens.ILogger),
      validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher)
    }),
  { lifecycle: 'singleton' }
);
```

### Test Files
- `tests/unit/cache/UnifiedCache.test.js`
- `tests/unit/cache/CacheInvalidationManager.test.js` 
- `tests/unit/cache/PriorityCache.test.js`
- `tests/unit/cache/CacheMetrics.test.js`
- `tests/integration/cache/cacheIntegration.test.js`
- `tests/performance/cache/cachePerformance.test.js`
- `tests/memory/cache/cacheMemory.test.js`

### Migration Required Files
- Existing `tests/unit/cache/lruCache.test.js` - Update to work with UnifiedCache
- Existing `src/utils/lruCache.js` - Deprecate in favor of UnifiedCache
- Existing cache implementations in anatomy and character builder systems

## Dependencies
- **External**: `lru-cache` npm package (version 11.1.0 already in project)
- **Internal**: 
  - Event bus (`IValidatedEventDispatcher`) for invalidation events
  - BaseService pattern for consistent service initialization
  - Dependency injection tokens and infrastructure registration
  - Logger service for debug and monitoring output

## Acceptance Criteria
1. ✅ UnifiedCache supports all three eviction policies
2. ✅ TTL-based expiration works correctly
3. ✅ Cache invalidation patterns work as expected
4. ✅ Memory usage stays within configured limits
5. ✅ Performance metrics are accurately collected
6. ✅ All unit tests pass with >90% coverage
7. ✅ Performance tests show <0.01ms for cached hits
8. ✅ Memory tests show no leaks over 10,000 operations

## Testing Requirements

### Unit Tests
- Test all eviction policies
- Verify TTL expiration
- Test concurrent access scenarios
- Validate invalidation patterns
- Check memory limits enforcement

### Integration Tests
- Test with clothing and anatomy services
- Verify event-based invalidation
- Test cache warming scenarios

### Performance Tests
- Benchmark cache operations (target: <0.01ms for hits)
- Test with various cache sizes (100, 1000, 10000 entries)
- Measure memory overhead per entry

### Memory Tests
- Verify no memory leaks
- Test aggressive pruning under memory pressure
- Validate weak reference usage where applicable

## Risk Assessment

### Risks
1. **Migration complexity**: Existing code depends on current cache implementations
2. **Performance regression**: New abstraction might add overhead  
3. **Memory overhead**: Metrics collection could increase memory usage
4. **Breaking changes**: Existing cache interfaces may not be fully compatible
5. **Integration issues**: Complex event bus integration may introduce bugs

### Mitigation
1. **Gradual Migration Strategy**: 
   - Keep existing cache implementations running in parallel initially
   - Create adapter pattern for seamless interface compatibility
   - Migrate one system at a time (anatomy → character builder → clothing)
2. **Performance Safeguards**:
   - Extensive performance testing before migration
   - Benchmark against existing `AnatomyClothingCache` performance
   - Make metrics collection optional and lightweight
3. **Compatibility Layer**:
   - Provide wrapper classes that maintain existing method signatures
   - Support for both old and new cache key formats during transition
   - Maintain backward compatibility for at least 2 versions

## Estimated Effort
- **Development**: 5-7 days
- **Testing**: 2-3 days
- **Documentation**: 1 day
- **Total**: 8-11 days

## Success Metrics
- 30% reduction in memory usage for caching
- 50% improvement in cache hit rates
- Zero cache-related bugs in production for 30 days
- All systems migrated within 4 weeks

## Notes
- **Existing LRU Cache**: Project already uses `lru-cache` v11.1.0 successfully in anatomy systems
- **Pattern Consistency**: Follow existing `AnatomyClothingCache` patterns for multi-typed cache organization
- **Event Integration**: Cache invalidation should integrate with existing event system (`COMPONENT_MODIFIED`, `ENTITY_MOVED`, etc.)
- **Memory Management**: Consider using WeakMap for certain cache entries to allow GC
- **Cache Warming**: Implement cache warming strategies for critical paths (anatomy blueprints, slot lookups)
- **Debug Support**: Add debug mode for cache operation logging (similar to existing scope DSL debugging)
- **Development Mode**: Consider implementing cache persistence for development mode
- **Test Compatibility**: Existing cache tests in `tests/unit/cache/lruCache.test.js` should be updated, not replaced