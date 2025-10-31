# ACTDESSERREF-003: Extract Index Management System

**Priority**: HIGH
**Effort**: 4 days
**Risk**: LOW
**Accuracy**: 90%
**Dependencies**: ACTDESSERREF-001 (Caching System)
**Phase**: 2 - Core Extractions (Weeks 3-6)

## Context

The ActivityDescriptionService includes index management logic for optimizing activity lookups via pre-computed indexes. This logic (lines 2003-2178) should be extracted to a dedicated system that can be reused and tested independently.

**File Location**: `src/anatomy/services/activityDescriptionService.js`
**Methods to Extract**: Lines 2003-2178

## Current Implementation

```javascript
// Index building (line 2003)
#buildActivityIndex(activities) {
  const index = {
    byVerb: new Map(),
    byTarget: new Map(),
    byCategory: new Map(),
    signature: this.#buildActivitySignature(activities)
  };

  for (const activity of activities) {
    // Index by verb
    if (!index.byVerb.has(activity.verb)) {
      index.byVerb.set(activity.verb, new Set());
    }
    index.byVerb.get(activity.verb).add(activity);

    // Index by target
    if (activity.targetId) {
      if (!index.byTarget.has(activity.targetId)) {
        index.byTarget.set(activity.targetId, new Set());
      }
      index.byTarget.get(activity.targetId).add(activity);
    }

    // Index by category
    if (activity.category) {
      if (!index.byCategory.has(activity.category)) {
        index.byCategory.set(activity.category, new Set());
      }
      index.byCategory.get(activity.category).add(activity);
    }
  }

  return index;
}

// Signature generation (line 2081)
#buildActivitySignature(activities) {
  return activities
    .map(a => `${a.verb}:${a.targetId}:${a.priority}`)
    .sort()
    .join('|');
}

// Cache key construction (line 2116)
#buildActivityIndexCacheKey(namespace, entityId) {
  return `${namespace}:${entityId}`;
}

// Get/build index (line 2134)
#getActivityIndex(activities, cacheKey) {
  if (!cacheKey) {
    return this.#buildActivityIndex(activities);
  }

  const cached = this.#getCacheValue(this.#activityIndexCache, cacheKey);
  if (cached?.value) {
    const cachedIndex = cached.value;
    const currentSignature = this.#buildActivitySignature(activities);

    if (cachedIndex.signature === currentSignature) {
      return cachedIndex;
    }
  }

  const index = this.#buildActivityIndex(activities);
  this.#setCacheValue(this.#activityIndexCache, cacheKey, index, 120000);

  return index;
}
```

## Target Architecture

**Location**: `src/anatomy/services/indexing/activityIndexManager.js`

```javascript
/**
 * Activity Index Management System
 * Optimizes activity lookups via pre-computed indexes
 */
class ActivityIndexManager {
  #cacheManager;
  #logger;

  constructor({ cacheManager, logger }) {
    validateDependency(cacheManager, 'ActivityCacheManager', logger, {
      requiredMethods: ['get', 'set']
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });

    this.#cacheManager = cacheManager;
    this.#logger = logger;
  }

  /**
   * Build activity index structure
   */
  buildActivityIndex(activities) {
    const index = {
      byVerb: new Map(),
      byTarget: new Map(),
      byCategory: new Map(),
      signature: this.buildActivitySignature(activities)
    };

    for (const activity of activities) {
      // Index by verb
      if (!index.byVerb.has(activity.verb)) {
        index.byVerb.set(activity.verb, new Set());
      }
      index.byVerb.get(activity.verb).add(activity);

      // Index by target
      if (activity.targetId) {
        if (!index.byTarget.has(activity.targetId)) {
          index.byTarget.set(activity.targetId, new Set());
        }
        index.byTarget.get(activity.targetId).add(activity);
      }

      // Index by category
      if (activity.category) {
        if (!index.byCategory.has(activity.category)) {
          index.byCategory.set(activity.category, new Set());
        }
        index.byCategory.get(activity.category).add(activity);
      }
    }

    return index;
  }

  /**
   * Generate activity signature for cache validation
   */
  buildActivitySignature(activities) {
    return activities
      .map(a => `${a.verb}:${a.targetId}:${a.priority}`)
      .sort()
      .join('|');
  }

  /**
   * Build cache key for activity index
   */
  buildActivityIndexCacheKey(namespace, entityId) {
    return `${namespace}:${entityId}`;
  }

  /**
   * Get or build activity index with caching
   */
  getActivityIndex(activities, cacheKey = null) {
    if (!cacheKey) {
      return this.buildActivityIndex(activities);
    }

    // Check cache
    const cached = this.#cacheManager.get('activityIndex', cacheKey);
    if (cached) {
      const currentSignature = this.buildActivitySignature(activities);

      // Validate signature matches
      if (cached.signature === currentSignature) {
        this.#logger.debug(`Activity index cache hit: ${cacheKey}`);
        return cached;
      }

      this.#logger.debug(`Activity index stale (signature mismatch): ${cacheKey}`);
    }

    // Build new index
    const index = this.buildActivityIndex(activities);
    this.#cacheManager.set('activityIndex', cacheKey, index);

    this.#logger.debug(`Built activity index: ${cacheKey} (${activities.length} activities)`);
    return index;
  }
}

export default ActivityIndexManager;
```

## Integration with ActivityDescriptionService

```javascript
import ActivityIndexManager from './indexing/activityIndexManager.js';

constructor({
  logger,
  entityManager,
  anatomyFormattingService,
  jsonLogicEvaluationService,
  activityIndex = null,
  eventBus = null,
  cacheManager = null, // Injected from ACTDESSERREF-001
}) {
  // ... existing code ...

  // Create index manager
  this.#indexManager = new ActivityIndexManager({
    cacheManager: this.#cacheManager,
    logger
  });
}

// Delegate to IndexManager
#buildActivityIndex(activities) {
  return this.#indexManager.buildActivityIndex(activities);
}

#getActivityIndex(activities, cacheKey) {
  return this.#indexManager.getActivityIndex(activities, cacheKey);
}
```

## Testing Strategy

### Unit Tests
**Location**: `tests/unit/anatomy/services/indexing/activityIndexManager.test.js`

Test areas:
1. Index building (byVerb, byTarget, byCategory)
2. Signature generation
3. Cache key construction
4. Get/build with caching
5. Signature validation (stale detection)

### Integration Tests
Verify ActivityDescriptionService works with ActivityIndexManager.

## Acceptance Criteria

- [ ] ActivityIndexManager class created
- [ ] All 4 methods extracted with correct signatures
- [ ] Cache integration with ActivityCacheManager
- [ ] Signature validation for stale detection
- [ ] Unit tests achieve 90%+ coverage
- [ ] Integration tests verify ActivityDescriptionService + IndexManager
- [ ] All existing tests pass
- [ ] No performance regression

## Success Metrics

- **Code Reduction**: ~175 lines extracted from ActivityDescriptionService
- **Reusability**: Index management logic can be used by other systems
- **Test Coverage**: 90%+ for ActivityIndexManager
- **Performance**: Maintain or improve index lookup speed

## Dependencies

- ACTDESSERREF-001 (ActivityCacheManager must be available)

## Related Tickets

- ACTDESSERREF-001 (Caching System)
- ACTDESSERREF-007 (Grouping uses indexes)
