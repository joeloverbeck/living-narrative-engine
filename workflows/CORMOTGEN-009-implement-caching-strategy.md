# CORMOTGEN-009: Implement Data Caching Strategy

## Ticket ID

CORMOTGEN-009

## Title

Implement caching strategy for Core Motivations data

## Status

TODO

## Priority

MEDIUM

## Estimated Effort

2-3 hours

## Dependencies

- CORMOTGEN-008 (CharacterBuilderService methods)

## Related Specs

- specs/core-motivations-generator.spec.md (Section 3.3 - Performance)
- Caching times: Concepts (10 min), Directions (10 min), Clichés (30 min), Motivations (session)

## Description

Implement a comprehensive caching strategy for Core Motivations data to improve performance and reduce database queries. This includes setting up cache invalidation, TTL management, and memory management.

## Technical Requirements

### 1. Cache Manager Implementation

**File**: `src/characterBuilder/cache/CoreMotivationsCacheManager.js`

```javascript
/**
 * @file Core Motivations Cache Manager
 * @description Manages caching for core motivations data with TTL and invalidation
 * @see ../services/characterBuilderService.js
 */

import { 
  validateDependency, 
  assertNonBlankString, 
  assertPresent 
} from '../../utils/dependencyUtils.js';
import { CHARACTER_BUILDER_EVENTS } from '../services/characterBuilderService.js';
import { ValidationError } from '../../errors/validationError.js';
import { CacheError } from '../../errors/cacheError.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/ISchemaValidator.js').ISchemaValidator} ISchemaValidator */

/**
 * Cache manager for Core Motivations data
 */
export class CoreMotivationsCacheManager {
  #cache = new Map();
  #logger;
  #eventBus;
  #schemaValidator;
  #maxCacheSize = 100; // Maximum number of cache entries
  #defaultTTL = 600000; // 10 minutes default
  #stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
  };

  // Cache TTL configuration (in milliseconds)
  #ttlConfig = {
    concepts: 600000, // 10 minutes
    directions: 600000, // 10 minutes
    cliches: 1800000, // 30 minutes
    motivations: null, // Session duration (no expiry)
  };

  /**
   * @param {Object} params
   * @param {ILogger} params.logger
   * @param {ISafeEventDispatcher} params.eventBus
   * @param {ISchemaValidator} [params.schemaValidator]
   */
  constructor({ logger, eventBus, schemaValidator }) {
    validateDependency(logger, 'ILogger');
    validateDependency(eventBus, 'ISafeEventDispatcher');
    
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#schemaValidator = schemaValidator;
    
    this.#dispatchEvent(CHARACTER_BUILDER_EVENTS.CACHE_INITIALIZED, {
      maxSize: this.#maxCacheSize,
      ttlConfig: this.#ttlConfig,
    });
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or null
   */
  get(key) {
    assertNonBlankString(key, 'Cache key is required');

    const entry = this.#cache.get(key);

    if (!entry) {
      this.#stats.misses++;
      this.#dispatchEvent(CHARACTER_BUILDER_EVENTS.CACHE_MISS, { key });
      return null;
    }

    // Check if expired
    if (entry.ttl && Date.now() > entry.expiresAt) {
      this.#cache.delete(key);
      this.#stats.misses++;
      this.#logger.debug(`Cache expired for key: ${key}`);
      return null;
    }

    // Update last accessed time and stats
    entry.lastAccessed = Date.now();
    entry.hits++;
    this.#stats.hits++;

    this.#dispatchEvent(CHARACTER_BUILDER_EVENTS.CACHE_HIT, { 
      key, 
      type: entry.type,
      totalHits: entry.hits 
    });
    
    this.#logger.debug(`Cache hit for key: ${key} (hits: ${entry.hits})`);
    return entry.data;
  }

  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   * @param {string} [type] - Data type for TTL configuration
   * @param {number} [customTTL] - Custom TTL in milliseconds
   */
  set(key, data, type = null, customTTL = null) {
    assertNonBlankString(key, 'Cache key is required');
    assertPresent(data, 'Cache data is required');

    // Validate cached data if schema validator available
    if (this.#schemaValidator && type) {
      try {
        this.#schemaValidator.validateAgainstSchema(data, `core:${type}-cache-entry`);
      } catch (validationError) {
        this.#logger.warn(`Cache data validation failed for ${key}:`, validationError);
        // Continue with caching - validation is advisory for cache
      }
    }

    // Enforce cache size limit
    if (this.#cache.size >= this.#maxCacheSize) {
      this.#evictLRU();
    }

    // Determine TTL
    let ttl = customTTL;
    if (!ttl && type && this.#ttlConfig[type] !== undefined) {
      ttl = this.#ttlConfig[type];
    } else if (!ttl) {
      ttl = this.#defaultTTL;
    }

    const entry = {
      data,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : null,
      ttl,
      type,
      hits: 0,
    };

    this.#cache.set(key, entry);
    this.#stats.sets++;
    
    this.#logger.debug(
      `Cached data for key: ${key} (type: ${type || 'generic'})`
    );
  }

  /**
   * Delete item from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if deleted
   */
  delete(key) {
    const deleted = this.#cache.delete(key);
    if (deleted) {
      this.#logger.debug(`Deleted cache entry: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache entries of a specific type
   * @param {string} type - Data type to clear
   */
  clearType(type) {
    const keysToDelete = [];

    for (const [key, entry] of this.#cache.entries()) {
      if (entry.type === type) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.#cache.delete(key));

    this.#logger.info(
      `Cleared ${keysToDelete.length} cache entries of type: ${type}`
    );
  }

  /**
   * Clear all cache entries
   */
  clearAll() {
    const size = this.#cache.size;
    this.#cache.clear();
    this.#logger.info(`Cleared all ${size} cache entries`);
  }

  /**
   * Invalidate cache entries by pattern
   * @param {string|RegExp} pattern - Pattern to match keys
   */
  invalidatePattern(pattern) {
    const keysToDelete = [];
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);

    for (const key of this.#cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.#cache.delete(key));

    this.#logger.debug(
      `Invalidated ${keysToDelete.length} cache entries matching pattern`
    );
  }

  /**
   * Helper method to dispatch events safely
   * @param {string} eventType 
   * @param {Object} payload 
   * @private
   */
  #dispatchEvent(eventType, payload) {
    try {
      this.#eventBus.dispatch({
        type: eventType,
        payload,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.#logger.error('Failed to dispatch cache event', error);
    }
  }

  /**
   * Evict least recently used entry
   * @private
   */
  #evictLRU() {
    let lruKey = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.#cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.#cache.delete(lruKey);
      this.#stats.evictions++;
      this.#dispatchEvent(CHARACTER_BUILDER_EVENTS.CACHE_EVICTED, { key: lruKey });
      this.#logger.debug(`Evicted LRU cache entry: ${lruKey}`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const stats = {
      size: this.#cache.size,
      maxSize: this.#maxCacheSize,
      hits: this.#stats.hits,
      misses: this.#stats.misses,
      sets: this.#stats.sets,
      evictions: this.#stats.evictions,
      hitRate: this.#stats.hits + this.#stats.misses > 0 ? 
        this.#stats.hits / (this.#stats.hits + this.#stats.misses) : 0,
      entries: [],
      totalHits: 0,
      byType: {},
    };

    for (const [key, entry] of this.#cache.entries()) {
      stats.entries.push({
        key,
        type: entry.type,
        hits: entry.hits,
        age: Date.now() - entry.createdAt,
        expiresIn: entry.expiresAt ? entry.expiresAt - Date.now() : null,
      });

      stats.totalHits += entry.hits;

      if (entry.type) {
        if (!stats.byType[entry.type]) {
          stats.byType[entry.type] = { count: 0, hits: 0 };
        }
        stats.byType[entry.type].count++;
        stats.byType[entry.type].hits += entry.hits;
      }
    }

    return stats;
  }

  /**
   * Clean expired entries
   * @returns {number} Number of entries cleaned
   */
  cleanExpired() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.#cache.entries()) {
      if (entry.ttl && entry.expiresAt < now) {
        this.#cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.#logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }

    return cleaned;
  }
}

export { CoreMotivationsCacheManager };
export default CoreMotivationsCacheManager;
```

### 2. Cache Integration Helper

**File**: `src/characterBuilder/cache/cacheHelpers.js`

```javascript
/**
 * Cache key generators for Core Motivations
 */
export const CacheKeys = {
  // Concept keys
  concept: (id) => `concept_${id}`,
  allConcepts: () => 'all_concepts',

  // Direction keys
  direction: (id) => `direction_${id}`,
  directionsForConcept: (conceptId) => `directions_concept_${conceptId}`,

  // Cliché keys
  clichesForDirection: (directionId) => `cliches_${directionId}`,

  // Motivation keys
  motivationsForDirection: (directionId) => `motivations_${directionId}`,
  motivationsForConcept: (conceptId) => `motivations_concept_${conceptId}`,
  motivationStats: (conceptId) => `motivation_stats_${conceptId}`,

  // Generation keys
  generationInProgress: (directionId) => `generating_${directionId}`,
  lastGeneration: (directionId) => `last_gen_${directionId}`,
};

/**
 * Cache invalidation helpers
 */
export const CacheInvalidation = {
  /**
   * Invalidate all caches for a concept
   */
  invalidateConcept(cache, conceptId) {
    cache.delete(CacheKeys.concept(conceptId));
    cache.delete(CacheKeys.allConcepts());
    cache.invalidatePattern(new RegExp(`concept_${conceptId}`));
  },

  /**
   * Invalidate all caches for a direction
   */
  invalidateDirection(cache, directionId) {
    cache.delete(CacheKeys.direction(directionId));
    cache.delete(CacheKeys.clichesForDirection(directionId));
    cache.delete(CacheKeys.motivationsForDirection(directionId));
    cache.invalidatePattern(new RegExp(`direction_${directionId}`));
  },

  /**
   * Invalidate motivation caches
   */
  invalidateMotivations(cache, directionId, conceptId) {
    cache.delete(CacheKeys.motivationsForDirection(directionId));
    if (conceptId) {
      cache.delete(CacheKeys.motivationsForConcept(conceptId));
      cache.delete(CacheKeys.motivationStats(conceptId));
    }
  },
};

/**
 * Cache warming utilities
 */
export const CacheWarming = {
  /**
   * Pre-warm cache with frequently accessed data
   * @param {CoreMotivationsCacheManager} cache - Cache manager instance
   * @param {CharacterBuilderService} service - Character builder service
   * @param {ILogger} logger - Logger instance
   */
  async warmCache(cache, service, logger) {
    try {
      // Load all concepts
      const concepts = await service.getAllCharacterConcepts();
      if (concepts) {
        cache.set(CacheKeys.allConcepts(), concepts, 'concepts');
        logger.debug('Cache warmed with all concepts');
      }

      // Load recent concept and its data
      if (concepts && concepts.length > 0) {
        const recentConcept = concepts[concepts.length - 1];

        // Load directions for recent concept
        const directions = await service.getThematicDirectionsByConceptId(
          recentConcept.id
        );

        if (directions) {
          cache.set(
            CacheKeys.directionsForConcept(recentConcept.id),
            directions,
            'directions'
          );
          logger.debug(`Cache warmed with directions for concept ${recentConcept.id}`);
        }
      }
    } catch (error) {
      // Cache warming is best-effort, don't throw but log properly
      logger.warn('Cache warming failed:', error);
    }
  },
};
```

### 3. Integration with CharacterBuilderService

Update the CharacterBuilderService to use the cache manager via proper dependency injection:

```javascript
// Update constructor to accept cache manager via DI
constructor({
  logger,
  storageService,
  directionGenerator,
  eventBus,
  database,
  schemaValidator,
  clicheGenerator,
  container,
  cacheManager, // Add cache manager dependency
}) {
  // ... existing validations ...
  validateDependency(cacheManager, 'ICoreMotivationsCacheManager');
  
  // ... existing assignments ...
  this.#cacheManager = cacheManager;
  
  // Initialize cache with existing Maps as fallback
  this.#enhanceCacheIntegration();
}

// Helper to integrate new cache with existing cache Maps
#enhanceCacheIntegration() {
  // Migrate existing cache data if present
  if (this.#clicheCache.size > 0) {
    for (const [key, value] of this.#clicheCache.entries()) {
      this.#cacheManager.set(key, value.data, 'cliches');
    }
    this.#clicheCache.clear();
  }
  
  if (this.#motivationCache.size > 0) {
    for (const [key, value] of this.#motivationCache.entries()) {
      this.#cacheManager.set(key, value.data, 'motivations');
    }
    this.#motivationCache.clear();
  }
}

// Updated method using cache helpers
async getCoreMotivationsByDirectionId(directionId) {
  assertNonBlankString(directionId, 'Direction ID is required');
  
  const cacheKey = CacheKeys.motivationsForDirection(directionId);

  // Check cache first
  const cached = this.#cacheManager.get(cacheKey);
  if (cached) {
    this.#eventBus.dispatch({
      type: CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED,
      payload: { directionId, source: 'cache', count: cached.length },
    });
    return cached;
  }

  try {
    // Fetch from database
    const motivations = await this.#database.getCoreMotivationsByDirectionId(directionId);
    
    if (motivations) {
      // Cache with appropriate type
      this.#cacheManager.set(cacheKey, motivations, 'motivations');
    }

    this.#eventBus.dispatch({
      type: CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED,
      payload: { directionId, source: 'database', count: motivations?.length || 0 },
    });

    return motivations;
  } catch (error) {
    this.#logger.error(`Failed to get core motivations for direction ${directionId}:`, error);
    throw new CharacterBuilderError(`Failed to retrieve core motivations`, error);
  }
}

// On modifications, invalidate cache
async saveCoreMotivations(directionId, motivations) {
  assertNonBlankString(directionId, 'Direction ID is required');
  assertPresent(motivations, 'Motivations data is required');
  
  try {
    // ... existing save logic ...
    
    // Invalidate related caches
    CacheInvalidation.invalidateMotivations(
      this.#cacheManager,
      directionId,
      motivations[0]?.conceptId
    );
    
    this.#logger.debug(`Invalidated cache for direction ${directionId}`);
  } catch (error) {
    this.#logger.error(`Failed to save core motivations for direction ${directionId}:`, error);
    throw new CharacterBuilderError('Failed to save core motivations', error);
  }
}
```

## Implementation Steps

1. **Add Dependency Injection Tokens**
   - Add `ICoreMotivationsCacheManager` token to `src/dependencyInjection/tokens/tokens-core.js`
   - Add `CoreMotivationsCacheManager` token to same file
   - Register both tokens in DI container

2. **Add Cache Events to CHARACTER_BUILDER_EVENTS**
   - `CACHE_INITIALIZED: 'core:cache_initialized'`
   - `CACHE_HIT: 'core:cache_hit'`
   - `CACHE_MISS: 'core:cache_miss'`
   - `CACHE_EVICTED: 'core:cache_evicted'`

3. **Create cache manager**
   - Implement CoreMotivationsCacheManager class following AnatomyQueryCache pattern
   - Add TTL management with proper event integration
   - Implement LRU eviction with event dispatching
   - Add statistics tracking with hit rate calculation
   - Use proper validation utilities and error types

4. **Create cache helpers**
   - Key generation utilities following existing naming patterns
   - Invalidation helpers with event integration
   - Cache warming utilities using ILogger instead of console

5. **Update CharacterBuilderService**
   - Add cacheManager to constructor dependencies
   - Enhance existing cache integration (don't replace Maps immediately)
   - Add cache checks before database queries with proper event dispatching
   - Invalidate on modifications with proper error handling
   - Use assertNonBlankString and assertPresent for validation

6. **Register in DI Container**
   - Register CoreMotivationsCacheManager in container with proper dependencies
   - Update CharacterBuilderService registration to include cache manager
   - Ensure proper dependency resolution order

7. **Add cache maintenance**
   - Periodic cleanup of expired entries
   - Memory management following existing patterns
   - Statistics logging via ILogger interface

## Validation Criteria

### Acceptance Criteria

- [ ] Cache reduces database queries
- [ ] TTL works correctly for each data type
- [ ] LRU eviction prevents memory issues
- [ ] Cache invalidation works on modifications
- [ ] Statistics provide useful insights
- [ ] No stale data served
- [ ] Memory usage stays within limits

### Testing Requirements

1. **Unit Tests** (`tests/unit/characterBuilder/cache/CoreMotivationsCacheManager.test.js`)
   - Follow existing AnatomyQueryCache test structure
   - Use `createMockLogger()` from `tests/common/mockFactories/`
   - Use TestBed pattern with beforeEach/afterEach cleanup
   - Test get/set operations with proper validation
   - Test TTL expiration scenarios
   - Test LRU eviction with statistics validation
   - Test invalidation patterns with event verification
   - Test statistics including hit rate calculation
   - Test event dispatching for all cache operations
   - Test error scenarios and validation failures

2. **Cache Helper Tests** (`tests/unit/characterBuilder/cache/cacheHelpers.test.js`)
   - Test CacheKeys generation functions
   - Test CacheInvalidation pattern matching
   - Test CacheWarming with mock services and logger
   - Use proper mock factories for dependencies

3. **Integration Tests** (`tests/integration/characterBuilder/cache/`)
   - Test CharacterBuilderService with cache manager integration
   - Verify cache hit/miss statistics match expectations
   - Test cache invalidation flow with database operations
   - Test cache warming on service initialization
   - Use TestBed class for service setup and teardown
   - Verify event bus integration works correctly

4. **Test Coverage Requirements**
   - 80% branch coverage minimum
   - 90% function/line coverage minimum
   - Test all error scenarios and edge cases
   - Verify proper cleanup in all test scenarios

## Performance Metrics

- Cache hit rate target: >80%
- Database query reduction: >60%
- Response time improvement: >40%
- Memory usage: <50MB

## Notes

- **Follow Existing Patterns**: Use AnatomyQueryCache as reference implementation
- **Enhance, Don't Replace**: Build upon existing cache Maps in CharacterBuilderService
- **Event Integration**: All cache operations must dispatch appropriate events
- **Proper DI**: No singletons - use dependency injection throughout
- **Session cache for motivations** (no expiry for current session)
- **Validation Required**: Use project validation utilities, not generic Error types
- **Testing Standards**: Follow TestBed patterns from anatomy cache tests
- Consider Redis for production scaling
- Monitor cache hit rates via statistics
- Implement cache warming on service startup

## Important Architectural Requirements

⚠️  **CRITICAL**: This workflow must align with existing project patterns:

1. **Dependency Injection**: Register all services in DI container, no singleton pattern
2. **Event Bus Integration**: All cache operations must dispatch events
3. **Validation Patterns**: Use `assertNonBlankString`, `assertPresent`, domain-specific errors
4. **Testing Standards**: Use TestBed classes, mock factories, proper coverage
5. **Logging Standards**: Use ILogger interface, never direct console usage
6. **File Structure**: Follow existing cache organization like `src/anatomy/cache/`

## Checklist

- [ ] Add DI tokens to tokens-core.js
- [ ] Add cache events to CHARACTER_BUILDER_EVENTS
- [ ] Create cache manager class following AnatomyQueryCache pattern
- [ ] Implement TTL management with event integration
- [ ] Add LRU eviction with proper statistics tracking
- [ ] Create cache helpers with proper logging
- [ ] Integrate with CharacterBuilderService via DI (enhance existing cache)
- [ ] Add invalidation logic with event dispatching
- [ ] Implement statistics with hit rate calculation
- [ ] Register in DI container with proper dependencies
- [ ] Write unit tests following AnatomyQueryCache test structure
- [ ] Write integration tests using TestBed patterns
- [ ] Test performance improvements and cache hit rates
- [ ] Verify event bus integration works correctly
