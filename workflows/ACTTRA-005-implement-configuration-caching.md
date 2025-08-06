# ACTTRA-005: Implement Configuration Caching

## Status

**Status**: Not Started  
**Priority**: P1 - High  
**Estimated Time**: 2 hours  
**Complexity**: Low  
**Dependencies**: ACTTRA-002 (config extension), ACTTRA-003 (ActionTraceFilter)  
**Blocked By**: None

## Context

To minimize performance impact, the action tracing system needs efficient configuration caching. This prevents repeated file system reads and JSON parsing during action processing.

## Requirements

### Functional Requirements

1. Cache configuration after first load
2. Support cache invalidation on configuration change
3. Implement TTL-based cache expiration
4. Provide cache statistics and monitoring
5. Support manual cache clearing
6. Handle concurrent access safely

### Non-Functional Requirements

- Zero allocation on cache hits
- Thread-safe cache operations
- Minimal memory footprint
- Support for hot reload in development

## Implementation Details

### 1. Configuration Cache Implementation

**File**: `src/actions/tracing/configurationCache.js`

```javascript
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @file Configuration cache for action tracing
 * Provides efficient caching with TTL and invalidation support
 */

/**
 * ConfigurationCache - Caches configuration with TTL and invalidation
 */
class ConfigurationCache {
  #cache;
  #ttl;
  #logger;
  #stats;
  #fileWatcher;

  constructor({ logger, ttl = 60000, fileWatcher = null }) {
    validateDependency(logger, 'ILogger');

    this.#logger = logger;
    this.#ttl = ttl; // Default 60 seconds
    this.#fileWatcher = fileWatcher;
    this.#cache = new Map();
    this.#stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      reloads: 0,
    };

    this.#setupFileWatcher();
  }

  /**
   * Setup file watcher for automatic invalidation
   * @private
   */
  #setupFileWatcher() {
    if (!this.#fileWatcher) {
      return;
    }

    this.#fileWatcher.on('change', (filepath) => {
      if (filepath.includes('trace-config.json')) {
        this.#logger.info('Configuration file changed, invalidating cache');
        this.invalidate('trace-config');
        this.#stats.reloads++;
      }
    });
  }

  /**
   * Get cached value
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    const entry = this.#cache.get(key);

    if (!entry) {
      this.#stats.misses++;
      return undefined;
    }

    // Check TTL
    if (this.#isExpired(entry)) {
      this.#cache.delete(key);
      this.#stats.evictions++;
      this.#stats.misses++;
      return undefined;
    }

    this.#stats.hits++;
    return entry.value;
  }

  /**
   * Set cached value
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - Custom TTL for this entry
   */
  set(key, value, ttl = null) {
    const entry = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.#ttl,
    };

    this.#cache.set(key, entry);

    this.#logger.debug(`Cached configuration: ${key}`, {
      ttl: entry.ttl,
    });
  }

  /**
   * Check if entry is expired
   * @private
   */
  #isExpired(entry) {
    const now = Date.now();
    return now - entry.timestamp > entry.ttl;
  }

  /**
   * Invalidate specific cache entry
   * @param {string} key - Cache key to invalidate
   */
  invalidate(key) {
    if (this.#cache.delete(key)) {
      this.#logger.debug(`Cache invalidated: ${key}`);
    }
  }

  /**
   * Clear entire cache
   */
  clear() {
    const size = this.#cache.size;
    this.#cache.clear();
    this.#logger.info(`Cache cleared: ${size} entries removed`);
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getStatistics() {
    const hitRate =
      this.#stats.hits + this.#stats.misses > 0
        ? (this.#stats.hits / (this.#stats.hits + this.#stats.misses)) * 100
        : 0;

    return {
      ...this.#stats,
      hitRate: hitRate.toFixed(2) + '%',
      size: this.#cache.size,
      memoryUsage: this.#estimateMemoryUsage(),
    };
  }

  /**
   * Estimate memory usage of cache
   * @private
   */
  #estimateMemoryUsage() {
    let bytes = 0;

    for (const [key, entry] of this.#cache) {
      // Rough estimation
      bytes += key.length * 2; // UTF-16 chars
      bytes += JSON.stringify(entry.value).length;
      bytes += 24; // Overhead for timestamp, ttl
    }

    return bytes;
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    let removed = 0;

    for (const [key, entry] of this.#cache) {
      if (this.#isExpired(entry)) {
        this.#cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.#logger.debug(`Cleanup removed ${removed} expired entries`);
      this.#stats.evictions += removed;
    }
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.#stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      reloads: 0,
    };
  }
}

export default ConfigurationCache;
```

### 2. Cached Configuration Loader

**File**: `src/actions/tracing/cachedConfigLoader.js`

```javascript
import { validateDependency } from '../../utils/dependencyUtils.js';
import ConfigurationCache from './configurationCache.js';

/**
 * Configuration loader with caching support
 */
class CachedConfigLoader {
  #baseLoader;
  #cache;
  #logger;
  #loadPromises;

  constructor({ baseLoader, logger, cache = null, ttl = 60000 }) {
    validateDependency(baseLoader, 'IConfigLoader');
    validateDependency(logger, 'ILogger');

    this.#baseLoader = baseLoader;
    this.#logger = logger;
    this.#cache = cache || new ConfigurationCache({ logger, ttl });
    this.#loadPromises = new Map();
  }

  /**
   * Load configuration with caching
   * @param {string} configPath - Path to configuration
   * @returns {Promise<Object>}
   */
  async loadConfig(configPath) {
    // Check cache first
    const cached = this.#cache.get(configPath);
    if (cached !== undefined) {
      return cached;
    }

    // Prevent concurrent loads of same config
    if (this.#loadPromises.has(configPath)) {
      return this.#loadPromises.get(configPath);
    }

    // Start loading
    const loadPromise = this.#loadAndCache(configPath);
    this.#loadPromises.set(configPath, loadPromise);

    try {
      const config = await loadPromise;
      return config;
    } finally {
      this.#loadPromises.delete(configPath);
    }
  }

  /**
   * Load and cache configuration
   * @private
   */
  async #loadAndCache(configPath) {
    try {
      const config = await this.#baseLoader.loadConfig(configPath);

      // Cache the loaded configuration
      this.#cache.set(configPath, config);

      this.#logger.debug(`Configuration loaded and cached: ${configPath}`);

      return config;
    } catch (error) {
      this.#logger.error(`Failed to load configuration: ${configPath}`, error);
      throw error;
    }
  }

  /**
   * Reload configuration (bypass cache)
   * @param {string} configPath - Path to configuration
   * @returns {Promise<Object>}
   */
  async reloadConfig(configPath) {
    this.#cache.invalidate(configPath);
    return this.loadConfig(configPath);
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getCacheStatistics() {
    return this.#cache.getStatistics();
  }

  /**
   * Clear configuration cache
   */
  clearCache() {
    this.#cache.clear();
  }

  /**
   * Cleanup expired cache entries
   */
  cleanup() {
    this.#cache.cleanup();
  }
}

export default CachedConfigLoader;
```

### 3. Integration with ActionTraceFilter

Update ActionTraceFilter to use cached loader:

```javascript
// In actionTraceConfigLoader.js
import CachedConfigLoader from './cachedConfigLoader.js';

class ActionTraceConfigLoader {
  #cachedLoader;

  constructor({ configLoader, logger, validator }) {
    // ... existing code ...
    this.#cachedLoader = new CachedConfigLoader({
      baseLoader: configLoader,
      logger,
      ttl: 60000, // 1 minute cache
    });
  }

  async loadConfig() {
    // Use cached loader
    const fullConfig = await this.#cachedLoader.loadConfig(this.#configPath);
    // ... rest of existing logic ...
  }

  async reloadConfig() {
    return this.#cachedLoader.reloadConfig(this.#configPath);
  }

  getCacheStatistics() {
    return this.#cachedLoader.getCacheStatistics();
  }
}
```

## Testing Requirements

### Unit Tests

**File**: `tests/unit/actions/tracing/configurationCache.unit.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ConfigurationCache from '../../../../src/actions/tracing/configurationCache.js';

describe('ConfigurationCache', () => {
  let cache;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    cache = new ConfigurationCache({
      logger: mockLogger,
      ttl: 1000, // 1 second for testing
    });
  });

  describe('basic operations', () => {
    it('should cache and retrieve values', () => {
      const config = { enabled: true, actions: ['core:go'] };

      cache.set('test-key', config);
      const retrieved = cache.get('test-key');

      expect(retrieved).toEqual(config);
    });

    it('should return undefined for missing keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('should track cache hits and misses', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // Hit
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss

      const stats = cache.getStatistics();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe('66.67%');
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      cache.set('temp-key', 'value', 100); // 100ms TTL

      expect(cache.get('temp-key')).toBe('value');

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.get('temp-key')).toBeUndefined();

      const stats = cache.getStatistics();
      expect(stats.evictions).toBe(1);
    });

    it('should use default TTL when not specified', async () => {
      const shortCache = new ConfigurationCache({
        logger: mockLogger,
        ttl: 50, // 50ms default
      });

      shortCache.set('key', 'value');

      expect(shortCache.get('key')).toBe('value');

      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(shortCache.get('key')).toBeUndefined();
    });
  });

  describe('invalidation', () => {
    it('should invalidate specific entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.invalidate('key1');

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
    });

    it('should clear entire cache', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBeUndefined();

      const stats = cache.getStatistics();
      expect(stats.size).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries during cleanup', async () => {
      cache.set('short', 'value1', 50);
      cache.set('long', 'value2', 5000);

      await new Promise((resolve) => setTimeout(resolve, 100));

      cache.cleanup();

      expect(cache.get('short')).toBeUndefined();
      expect(cache.get('long')).toBe('value2');

      const stats = cache.getStatistics();
      expect(stats.evictions).toBeGreaterThan(0);
    });
  });

  describe('memory estimation', () => {
    it('should estimate memory usage', () => {
      const largeConfig = {
        enabled: true,
        actions: Array.from({ length: 100 }, (_, i) => `action${i}`),
      };

      cache.set('large-config', largeConfig);

      const stats = cache.getStatistics();
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('file watcher integration', () => {
    it('should invalidate cache on file change', () => {
      const mockWatcher = {
        on: jest.fn(),
      };

      const watchedCache = new ConfigurationCache({
        logger: mockLogger,
        ttl: 60000,
        fileWatcher: mockWatcher,
      });

      expect(mockWatcher.on).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );

      // Simulate file change
      watchedCache.set('trace-config', { enabled: true });
      const changeHandler = mockWatcher.on.mock.calls[0][1];
      changeHandler('config/trace-config.json');

      expect(watchedCache.get('trace-config')).toBeUndefined();
    });
  });
});
```

### Integration Tests

**File**: `tests/integration/actions/tracing/cachedConfigLoader.integration.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import CachedConfigLoader from '../../../../src/actions/tracing/cachedConfigLoader.js';
import fs from 'fs/promises';
import path from 'path';

describe('CachedConfigLoader Integration', () => {
  let loader;
  let testConfigPath;

  beforeEach(async () => {
    testConfigPath = path.join(process.cwd(), 'test-config.json');

    // Create test configuration
    await fs.writeFile(testConfigPath, JSON.stringify({
      actionTracing: {
        enabled: true,
        tracedActions: ['core:go']
      }
    }));

    // Create real loader
    loader = new CachedConfigLoader({
      baseLoader: /* real config loader */,
      logger: /* real logger */,
      ttl: 1000
    });
  });

  afterEach(async () => {
    // Cleanup
    await fs.unlink(testConfigPath).catch(() => {});
  });

  it('should cache configuration after first load', async () => {
    const config1 = await loader.loadConfig(testConfigPath);
    const config2 = await loader.loadConfig(testConfigPath);

    expect(config1).toBe(config2); // Same reference from cache

    const stats = loader.getCacheStatistics();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  it('should handle concurrent loads efficiently', async () => {
    const promises = Array.from({ length: 10 }, () =>
      loader.loadConfig(testConfigPath)
    );

    const results = await Promise.all(promises);

    // All should get same config
    const firstConfig = results[0];
    results.forEach(config => {
      expect(config).toBe(firstConfig);
    });

    // Should only load once
    const stats = loader.getCacheStatistics();
    expect(stats.misses).toBe(1);
  });
});
```

## Acceptance Criteria

- [ ] ConfigurationCache class implemented
- [ ] TTL-based expiration working
- [ ] Cache invalidation on file change
- [ ] Thread-safe concurrent access
- [ ] Cache statistics and monitoring
- [ ] Memory usage estimation
- [ ] Cleanup of expired entries
- [ ] Integration with config loader
- [ ] Unit tests with >80% coverage
- [ ] Integration tests passing
- [ ] Performance improvement verified

## Performance Metrics

- Cache hit rate > 95% in production
- Zero allocations on cache hits
- <1μs cache lookup time
- <100KB memory overhead for typical configs

## Related Tickets

- ACTTRA-002: Extend existing trace configuration (provides config)
- ACTTRA-003: Implement ActionTraceFilter class (uses caching)
- ACTTRA-006: Create configuration loader (integrates with)

## Notes

- Consider adding distributed cache support for multi-process scenarios
- May need to add cache warming on startup
- Monitor cache memory usage in production
