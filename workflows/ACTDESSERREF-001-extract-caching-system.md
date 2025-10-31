# ACTDESSERREF-001: Extract Unified Caching System

**Priority**: CRITICAL FIRST
**Effort**: 5 days
**Risk**: LOW
**Accuracy**: 95%
**Dependencies**: None
**Phase**: 1 - Foundation (Weeks 1-2)

## Context

The ActivityDescriptionService currently maintains 4 separate Map instances for caching, each with duplicated TTL logic, event subscriptions, and cleanup code. This creates code duplication across 15 cache-related methods and fragmented cache lifecycle management.

**File Location**: `src/anatomy/services/activityDescriptionService.js`
**Current Implementation**: Lines 119-125 (cache declarations), Lines 196-382 (cache operations)

### Current Cache Architecture

```javascript
// Separate cache declarations (lines 119-125)
#entityNameCache = new Map();     // TTL: 60s
#genderCache = new Map();          // TTL: 300s
#activityIndexCache = new Map();   // TTL: 120s
#closenessCache = new Map();       // TTL: 60s

// Generic operations duplicated for each cache
#getCacheValue(cache, key)         // Line 196
#setCacheValue(cache, key, value)  // Line 217

// Per-cache invalidation methods (duplicated pattern)
#invalidateNameCache(entityId)     // Line 249
#invalidateGenderCache(entityId)   // Line 258
#invalidateActivityCache(entityId) // Line 267
#invalidateClosenessCache(entityId) // Line 276
#invalidateAllCachesForEntity(entityId) // Line 285

// Event subscriptions (lines 359-382)
#subscribeToInvalidationEvents() {
  this.#eventBus.on('COMPONENT_ADDED', (event) => {
    this.#invalidateAllCachesForEntity(event.payload.entityId);
  });
  this.#eventBus.on('COMPONENT_REMOVED', ...);
  this.#eventBus.on('COMPONENTS_BATCH_ADDED', ...);
  this.#eventBus.on('ENTITY_REMOVED', ...);
}

// Periodic cleanup (lines 299-314)
#setupCacheCleanup() {
  this.#cleanupInterval = setInterval(() => {
    this.#cleanupCaches();
  }, 5 * 60 * 1000); // 5 minutes
}

// LRU pruning (lines 329-349)
#pruneCache(cache, maxSize, now) {
  const entries = Array.from(cache.entries());
  entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
  const removeCount = Math.floor(maxSize * 0.2);
  for (let i = 0; i < removeCount; i++) {
    cache.delete(entries[i][0]);
  }
}
```

## Target Architecture

Create `ActivityCacheManager` - a unified caching system with:
- Centralized cache registration (not hardcoded Maps)
- Consistent TTL enforcement across all caches
- Single event subscription point
- LRU pruning strategy
- Periodic cleanup (every 5 minutes)

## Implementation Steps

### Step 1: Create ActivityCacheManager Class

**Location**: `src/anatomy/services/caching/activityCacheManager.js`

```javascript
/**
 * @file Multi-Cache Manager for Activity Description System
 * Handles TTL-based caching, event-driven invalidation, and LRU pruning
 */

import { validateDependency, assertNonBlankString } from '../../utils/dependencyUtils.js';

class ActivityCacheManager {
  #caches = new Map(); // Map<cacheName, CacheEntry>
  #eventBus;
  #logger;
  #cleanupInterval;
  #config;

  constructor({ eventBus, logger, config }) {
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['on', 'dispatch']
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });

    this.#eventBus = eventBus;
    this.#logger = logger;
    this.#config = config;

    this.#setupCacheCleanup();
    this.#subscribeToInvalidationEvents();
  }

  /**
   * Register a named cache with TTL and size limits
   */
  registerCache(name, { ttl = 60000, maxSize = 1000 } = {}) {
    assertNonBlankString(name, 'Cache name', 'registerCache', this.#logger);

    if (this.#caches.has(name)) {
      this.#logger.warn(`Cache '${name}' already registered, skipping`);
      return;
    }

    this.#caches.set(name, {
      data: new Map(),
      ttl,
      maxSize,
    });

    this.#logger.debug(`Registered cache: ${name} (TTL: ${ttl}ms, Max: ${maxSize})`);
  }

  /**
   * Get value from cache with TTL check
   * Returns null if expired/missing
   */
  get(cacheName, key) {
    const cache = this.#getCache(cacheName);
    if (!cache) return null;

    const entry = cache.data.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > cache.ttl) {
      cache.data.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set value in cache with timestamp
   */
  set(cacheName, key, value, customTTL = null) {
    const cache = this.#getCache(cacheName);
    if (!cache) {
      this.#logger.warn(`Cannot set value: cache '${cacheName}' not registered`);
      return;
    }

    cache.data.set(key, {
      value,
      timestamp: Date.now(),
      ttl: customTTL ?? cache.ttl,
    });

    // Prune if over size limit
    if (cache.data.size > cache.maxSize) {
      this.#pruneCache(cacheName);
    }
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(cacheName, key) {
    const cache = this.#getCache(cacheName);
    if (cache) {
      cache.data.delete(key);
    }
  }

  /**
   * Invalidate key across ALL caches
   */
  invalidateAll(key) {
    for (const [cacheName, cache] of this.#caches) {
      cache.data.delete(key);
    }
    this.#logger.debug(`Invalidated key '${key}' across all caches`);
  }

  /**
   * Manual cache cleanup (remove expired entries)
   */
  cleanup() {
    const now = Date.now();
    let totalRemoved = 0;

    for (const [cacheName, cache] of this.#caches) {
      let removed = 0;
      for (const [key, entry] of cache.data) {
        if (now - entry.timestamp > entry.ttl) {
          cache.data.delete(key);
          removed++;
        }
      }
      if (removed > 0) {
        this.#logger.debug(`Cleaned ${removed} expired entries from cache '${cacheName}'`);
        totalRemoved += removed;
      }
    }

    return totalRemoved;
  }

  /**
   * Prune cache using LRU strategy
   * @private
   */
  #pruneCache(cacheName) {
    const cache = this.#getCache(cacheName);
    if (!cache) return;

    const entries = Array.from(cache.data.entries());

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest 20%
    const removeCount = Math.floor(cache.maxSize * 0.2);
    for (let i = 0; i < removeCount && i < entries.length; i++) {
      cache.data.delete(entries[i][0]);
    }

    this.#logger.debug(`Pruned ${removeCount} entries from cache '${cacheName}'`);
  }

  /**
   * Setup periodic cleanup timer (every 5 minutes)
   * @private
   */
  #setupCacheCleanup() {
    this.#cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Subscribe to entity change events for cache invalidation
   * @private
   */
  #subscribeToInvalidationEvents() {
    if (!this.#eventBus) return;

    const invalidationEvents = [
      'COMPONENT_ADDED',
      'COMPONENT_REMOVED',
      'COMPONENTS_BATCH_ADDED',
      'ENTITY_REMOVED',
    ];

    invalidationEvents.forEach(eventType => {
      this.#eventBus.on(eventType, (event) => {
        const entityId = event.payload?.entityId;
        if (entityId) {
          this.invalidateAll(entityId);
        }
      });
    });

    this.#logger.debug('Subscribed to cache invalidation events');
  }

  /**
   * Get cache by name
   * @private
   */
  #getCache(cacheName) {
    const cache = this.#caches.get(cacheName);
    if (!cache) {
      this.#logger.warn(`Cache '${cacheName}' not registered`);
      return null;
    }
    return cache;
  }

  /**
   * Cleanup resources (call on service destruction)
   */
  destroy() {
    if (this.#cleanupInterval) {
      clearInterval(this.#cleanupInterval);
      this.#cleanupInterval = null;
    }
    this.#caches.clear();
    this.#logger.debug('ActivityCacheManager destroyed');
  }
}

export default ActivityCacheManager;
```

### Step 2: Update ActivityDescriptionService Constructor

**Location**: `src/anatomy/services/activityDescriptionService.js` (line 91)

```javascript
import ActivityCacheManager from './caching/activityCacheManager.js';

constructor({
  logger,
  entityManager,
  anatomyFormattingService,
  jsonLogicEvaluationService,
  activityIndex = null,
  eventBus = null,
}) {
  // ... existing validation ...

  // Create unified cache manager
  this.#cacheManager = new ActivityCacheManager({
    eventBus,
    logger,
    config: this.#getActivityIntegrationConfig().caching
  });

  // Register all caches with specific TTLs
  this.#cacheManager.registerCache('entityName', {
    ttl: 60000,    // 1 minute
    maxSize: 1000
  });
  this.#cacheManager.registerCache('gender', {
    ttl: 300000,   // 5 minutes
    maxSize: 1000
  });
  this.#cacheManager.registerCache('activityIndex', {
    ttl: 120000,   // 2 minutes
    maxSize: 500
  });
  this.#cacheManager.registerCache('closeness', {
    ttl: 60000,    // 1 minute
    maxSize: 1000
  });

  // Keep old caches temporarily for gradual migration
  this.#entityNameCache = new Map();
  this.#genderCache = new Map();
  this.#activityIndexCache = new Map();
  this.#closenessCache = new Map();
}
```

### Step 3: Create Delegation Layer

Update cache access methods to delegate to CacheManager:

```javascript
#getCacheValue(cache, key) {
  const cacheName = this.#resolveCacheName(cache);
  const managerValue = this.#cacheManager.get(cacheName, key);

  // Fallback to old cache during migration
  if (managerValue === null) {
    const oldEntry = cache.get(key);
    if (oldEntry && Date.now() - oldEntry.timestamp <= oldEntry.ttl) {
      return oldEntry;
    }
  }

  return managerValue !== null ? { value: managerValue } : null;
}

#setCacheValue(cache, key, value, ttl) {
  const cacheName = this.#resolveCacheName(cache);
  this.#cacheManager.set(cacheName, key, value, ttl);

  // Also set in old cache during migration
  cache.set(key, { value, timestamp: Date.now(), ttl });
}

#resolveCacheName(cacheMapReference) {
  if (cacheMapReference === this.#entityNameCache) return 'entityName';
  if (cacheMapReference === this.#genderCache) return 'gender';
  if (cacheMapReference === this.#activityIndexCache) return 'activityIndex';
  if (cacheMapReference === this.#closenessCache) return 'closeness';
  throw new Error('Unknown cache reference');
}
```

### Step 4: Remove Old Cache Infrastructure

Once all tests pass and behavior is verified:

```javascript
// DELETE these declarations (lines 119-125)
// #entityNameCache = new Map();
// #genderCache = new Map();
// #activityIndexCache = new Map();
// #closenessCache = new Map();

// DELETE per-cache invalidation methods (lines 249-276)

// UPDATE #invalidateAllCachesForEntity (line 285)
#invalidateAllCachesForEntity(entityId) {
  this.#cacheManager.invalidateAll(entityId);
}

// DELETE #subscribeToInvalidationEvents (line 359)
// Now handled by ActivityCacheManager

// UPDATE #cleanupCaches (line 314)
#cleanupCaches() {
  return this.#cacheManager.cleanup();
}
```

## Testing Strategy

### Unit Tests

**Location**: `tests/unit/anatomy/services/caching/activityCacheManager.test.js`

Test coverage areas:
1. Cache registration (default and custom TTL/maxSize)
2. Get/Set operations (within TTL, expired, non-existent)
3. Invalidation (specific cache, all caches)
4. Event-driven invalidation (4 event types)
5. Cleanup and pruning (LRU strategy)
6. Lifecycle (destroy method)

Minimum 90% coverage required.

### Integration Tests

Verify ActivityDescriptionService works with CacheManager:
- Cache hit/miss behavior
- Event-driven invalidation
- Performance (no regression)

## Acceptance Criteria

- [ ] ActivityCacheManager class created with all cache operations
- [ ] All 4 caches registered with correct TTLs (60s, 300s, 120s, 60s)
- [ ] Event subscriptions migrated to CacheManager
- [ ] Periodic cleanup timer functional
- [ ] LRU pruning works when maxSize exceeded
- [ ] All existing tests pass without modification
- [ ] Cache behavior unchanged from user perspective
- [ ] No performance regression (benchmark comparison)
- [ ] Unit tests achieve 90%+ coverage for ActivityCacheManager
- [ ] Integration tests verify ActivityDescriptionService + CacheManager

## Success Metrics

- **Code Reduction**: Delete 15 cache-related private methods (lines 196-382)
- **Centralization**: 1 cache manager instead of 4 separate Maps
- **Test Impact**: Zero test modifications required (implementation detail)
- **Performance**: No regression (verify via benchmarks)
- **Cache Hit Rate**: Maintain current rate (measure before/after)

## Migration Checklist

1. [ ] Create ActivityCacheManager class with tests
2. [ ] Add CacheManager to ActivityDescriptionService constructor
3. [ ] Register all 4 caches with correct TTLs
4. [ ] Create delegation layer (#resolveCacheName)
5. [ ] Run full test suite - all tests pass
6. [ ] Run performance benchmarks - no regression
7. [ ] Remove old cache declarations
8. [ ] Remove per-cache invalidation methods
9. [ ] Remove #subscribeToInvalidationEvents
10. [ ] Update documentation

## Risks & Mitigation

**Risk**: Cache behavior changes subtly during migration
**Mitigation**: Gradual migration with fallback to old caches, extensive integration testing

**Risk**: Event subscription timing issues
**Mitigation**: CacheManager subscribes immediately in constructor, before any cache operations

**Risk**: Performance regression
**Mitigation**: Benchmark suite runs before/after, abort if >5% degradation

## Dependencies

None - this is the first refactoring to implement.

## Blockers

None - can start immediately.

## Related Tickets

- ACTDESSERREF-002 (can run in parallel)
- All subsequent tickets depend on this completing first
