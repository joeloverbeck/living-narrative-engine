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

**File**: `src/characterBuilder/cache/coreMotivationsCacheManager.js`

```javascript
/**
 * @file Core Motivations Cache Manager
 * @description Manages caching for core motivations data with TTL and invalidation
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Cache manager for Core Motivations data
 */
class CoreMotivationsCacheManager {
  #cache = new Map();
  #logger;
  #maxCacheSize = 100; // Maximum number of cache entries
  #defaultTTL = 600000; // 10 minutes default

  // Cache TTL configuration (in milliseconds)
  #ttlConfig = {
    concepts: 600000, // 10 minutes
    directions: 600000, // 10 minutes
    cliches: 1800000, // 30 minutes
    motivations: null, // Session duration (no expiry)
  };

  /**
   * @param {Object} params
   * @param {import('../../interfaces/ILogger.js').ILogger} params.logger
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger');
    this.#logger = logger;
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or null
   */
  get(key) {
    const entry = this.#cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.ttl && Date.now() > entry.expiresAt) {
      this.#cache.delete(key);
      this.#logger.debug(`Cache expired for key: ${key}`);
      return null;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();
    entry.hits++;

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
   * Evict least recently used entry
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

/**
 * Singleton instance manager
 */
class CoreMotivationsCacheService {
  static #instance = null;

  /**
   * Get or create cache manager instance
   * @param {Object} [params] - Parameters for initialization
   * @returns {CoreMotivationsCacheManager}
   */
  static getInstance(params) {
    if (!this.#instance && params) {
      this.#instance = new CoreMotivationsCacheManager(params);
    }
    return this.#instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static reset() {
    this.#instance = null;
  }
}

export { CoreMotivationsCacheManager, CoreMotivationsCacheService };
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
   */
  async warmCache(cache, service) {
    try {
      // Load all concepts
      const concepts = await service.getAllCharacterConcepts();
      if (concepts) {
        cache.set(CacheKeys.allConcepts(), concepts, 'concepts');
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
        }
      }
    } catch (error) {
      // Cache warming is best-effort, don't throw
      console.warn('Cache warming failed:', error);
    }
  },
};
```

### 3. Integration with CharacterBuilderService

Update the CharacterBuilderService to use the cache manager:

```javascript
// In constructor
this.#cache = CoreMotivationsCacheService.getInstance({ logger: this.#logger });

// In methods, use cache helpers
async getCoreMotivationsByDirectionId(directionId) {
    const cacheKey = CacheKeys.motivationsForDirection(directionId);

    // Check cache
    const cached = this.#cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    // Fetch from database
    const motivations = await this.#database.getCoreMotivationsByDirectionId(directionId);

    // Cache with appropriate type
    this.#cache.set(cacheKey, motivations, 'motivations');

    return motivations;
}

// On modifications, invalidate cache
async saveCoreMotivations(directionId, motivations) {
    // ... save logic ...

    // Invalidate related caches
    CacheInvalidation.invalidateMotivations(
        this.#cache,
        directionId,
        motivations[0]?.conceptId
    );
}
```

## Implementation Steps

1. **Create cache manager**
   - Implement CoreMotivationsCacheManager class
   - Add TTL management
   - Implement LRU eviction
   - Add statistics tracking

2. **Create cache helpers**
   - Key generation utilities
   - Invalidation helpers
   - Cache warming utilities

3. **Integrate with service**
   - Update CharacterBuilderService
   - Add cache checks before database queries
   - Invalidate on modifications

4. **Add cache maintenance**
   - Periodic cleanup of expired entries
   - Memory management
   - Statistics logging

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

1. **Unit Tests** (`tests/unit/characterBuilder/cache/coreMotivationsCacheManager.test.js`)
   - Test get/set operations
   - Test TTL expiration
   - Test LRU eviction
   - Test invalidation patterns
   - Test statistics

2. **Integration Tests**
   - Test with CharacterBuilderService
   - Verify performance improvements
   - Test cache invalidation flow

## Performance Metrics

- Cache hit rate target: >80%
- Database query reduction: >60%
- Response time improvement: >40%
- Memory usage: <50MB

## Notes

- Session cache for motivations (no expiry)
- Consider Redis for production scaling
- Monitor cache hit rates
- Implement cache warming on startup

## Checklist

- [ ] Create cache manager class
- [ ] Implement TTL management
- [ ] Add LRU eviction
- [ ] Create cache helpers
- [ ] Integrate with service
- [ ] Add invalidation logic
- [ ] Implement statistics
- [ ] Write unit tests
- [ ] Test performance improvements
