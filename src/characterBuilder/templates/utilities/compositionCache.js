/**
 * @file Composition Cache for template performance optimization
 * @module characterBuilder/templates/utilities/compositionCache
 * @description Caches composition results with LRU eviction and TTL support
 */

/**
 * Caches composition results for performance
 */
export class CompositionCache {
  #cache;
  #maxSize;
  #ttl;
  #accessOrder;
  #stats;

  /**
   * @param {object} config - Cache configuration
   * @param {number} [config.maxSize=100] - Maximum number of cache entries
   * @param {number} [config.ttl=3600000] - Time to live in milliseconds (default: 1 hour)
   * @param {boolean} [config.enableStats=false] - Enable cache statistics tracking
   */
  constructor({ maxSize = 100, ttl = 3600000, enableStats = false } = {}) {
    this.#cache = new Map();
    this.#maxSize = maxSize;
    this.#ttl = ttl;
    this.#accessOrder = new Map(); // Track access order for LRU
    
    this.#stats = enableStats ? {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
      stores: 0
    } : null;
  }

  /**
   * Generate cache key from composition parameters
   * @param {string|Function|object} template - Template
   * @param {object} context - Context object
   * @returns {string} Cache key
   */
  generateKey(template, context) {
    const templateId = this.#getTemplateId(template);
    const contextHash = this.#hashObject(context);
    return `${templateId}:${contextHash}`;
  }

  /**
   * Get cached composition
   * @param {string} key - Cache key
   * @returns {string|null} Cached value or null
   */
  get(key) {
    const entry = this.#cache.get(key);
    
    if (!entry) {
      if (this.#stats) this.#stats.misses++;
      return null;
    }

    // Check TTL
    if (this.#isExpired(entry)) {
      this.#cache.delete(key);
      this.#accessOrder.delete(key);
      if (this.#stats) {
        this.#stats.expirations++;
        this.#stats.misses++;
      }
      return null;
    }

    // Update access time for LRU
    this.#accessOrder.delete(key);
    this.#accessOrder.set(key, Date.now());
    
    if (this.#stats) this.#stats.hits++;
    return entry.value;
  }

  /**
   * Store composition result
   * @param {string} key - Cache key
   * @param {string} value - Value to cache
   */
  set(key, value) {
    // Check if we need to evict
    if (this.#cache.size >= this.#maxSize && !this.#cache.has(key)) {
      this.#evictLRU();
    }

    // Store entry
    this.#cache.set(key, {
      value,
      timestamp: Date.now()
    });
    
    // Update access order
    this.#accessOrder.delete(key);
    this.#accessOrder.set(key, Date.now());
    
    if (this.#stats) this.#stats.stores++;
  }

  /**
   * Check if a key exists in cache (without accessing it)
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and is not expired
   */
  has(key) {
    const entry = this.#cache.get(key);
    if (!entry) return false;
    
    if (this.#isExpired(entry)) {
      this.#cache.delete(key);
      this.#accessOrder.delete(key);
      if (this.#stats) this.#stats.expirations++;
      return false;
    }
    
    return true;
  }

  /**
   * Delete a specific cache entry
   * @param {string} key - Cache key
   * @returns {boolean} True if entry was deleted
   */
  delete(key) {
    const existed = this.#cache.delete(key);
    if (existed) {
      this.#accessOrder.delete(key);
    }
    return existed;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.#cache.clear();
    this.#accessOrder.clear();
    
    if (this.#stats) {
      this.#stats.hits = 0;
      this.#stats.misses = 0;
      this.#stats.evictions = 0;
      this.#stats.expirations = 0;
      this.#stats.stores = 0;
    }
  }

  /**
   * Get cache size
   * @returns {number} Number of cached entries
   */
  get size() {
    return this.#cache.size;
  }

  /**
   * Get cache statistics
   * @returns {object|null} Cache statistics if enabled
   */
  getStats() {
    if (!this.#stats) return null;
    
    const total = this.#stats.hits + this.#stats.misses;
    const hitRate = total > 0 ? this.#stats.hits / total : 0;
    
    return {
      ...this.#stats,
      size: this.#cache.size,
      maxSize: this.#maxSize,
      hitRate: Math.round(hitRate * 1000) / 10, // Percentage with 1 decimal
      ttl: this.#ttl
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    if (this.#stats) {
      this.#stats.hits = 0;
      this.#stats.misses = 0;
      this.#stats.evictions = 0;
      this.#stats.expirations = 0;
      this.#stats.stores = 0;
    }
  }

  /**
   * Prune expired entries
   * @returns {number} Number of pruned entries
   */
  prune() {
    let pruned = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.#cache.entries()) {
      if (now - entry.timestamp > this.#ttl) {
        this.#cache.delete(key);
        this.#accessOrder.delete(key);
        pruned++;
      }
    }
    
    if (this.#stats) {
      this.#stats.expirations += pruned;
    }
    
    return pruned;
  }

  /**
   * Get all cache keys
   * @returns {Array<string>} Array of cache keys
   */
  keys() {
    return Array.from(this.#cache.keys());
  }

  /**
   * Get cache entries sorted by access time (most recent first)
   * @returns {Array<object>} Array of cache entries
   */
  getEntries() {
    const entries = [];
    
    for (const [key, accessTime] of this.#accessOrder.entries()) {
      const entry = this.#cache.get(key);
      if (entry && !this.#isExpired(entry)) {
        entries.push({
          key,
          value: entry.value,
          timestamp: entry.timestamp,
          lastAccess: accessTime,
          age: Date.now() - entry.timestamp
        });
      }
    }
    
    return entries.sort((a, b) => b.lastAccess - a.lastAccess);
  }

  /**
   * Update TTL for all entries
   * @param {number} newTTL - New TTL in milliseconds
   */
  updateTTL(newTTL) {
    this.#ttl = newTTL;
    // Optionally prune entries that are now expired
    this.prune();
  }

  /**
   * Update max size
   * @param {number} newSize - New maximum size
   */
  updateMaxSize(newSize) {
    this.#maxSize = newSize;
    
    // Evict entries if necessary
    while (this.#cache.size > this.#maxSize) {
      this.#evictLRU();
    }
  }

  /**
   * Get template identifier
   * @private
   * @param {*} template - Template
   * @returns {string} Template identifier
   */
  #getTemplateId(template) {
    if (typeof template === 'string') {
      // Use first 100 chars of string template as ID
      return template.substring(0, 100);
    } else if (typeof template === 'function') {
      return template.name || 'anonymous-function';
    } else if (template && typeof template === 'object') {
      return template.id || template.name || 'object-template';
    }
    return 'unknown-template';
  }

  /**
   * Hash object for cache key generation
   * @private
   * @param {object} obj - Object to hash
   * @returns {string} Hash string
   */
  #hashObject(obj) {
    try {
      const seen = new WeakSet();
      const str = JSON.stringify(obj, (key, value) => {
        // Handle special types
        if (typeof value === 'function') {
          return `[Function: ${value.name || 'anonymous'}]`;
        }
        if (value === undefined) {
          return '[undefined]';
        }
        if (typeof value === 'object' && value !== null) {
          // Check for circular reference
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
          
          if (value instanceof Date) {
            return value.toISOString();
          }
          if (value instanceof RegExp) {
            return value.toString();
          }
          if (value instanceof Map) {
            return { __type: 'Map', entries: Array.from(value.entries()) };
          }
          if (value instanceof Set) {
            return { __type: 'Set', values: Array.from(value) };
          }
        }
        return value;
      });
      
      // Simple hash algorithm
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash.toString(36);
    } catch (e) {
      // Fallback for unhashable objects
      return `unhashable-${Date.now()}`;
    }
  }

  /**
   * Check if entry is expired
   * @private
   * @param {object} entry - Cache entry
   * @returns {boolean} True if expired
   */
  #isExpired(entry) {
    return Date.now() - entry.timestamp > this.#ttl;
  }

  /**
   * Evict least recently used entry
   * @private
   */
  #evictLRU() {
    // Get the least recently used key (first in accessOrder map)
    const oldestKey = this.#accessOrder.keys().next().value;
    
    if (oldestKey) {
      this.#cache.delete(oldestKey);
      this.#accessOrder.delete(oldestKey);
      
      if (this.#stats) {
        this.#stats.evictions++;
      }
    }
  }
}

// Export utility functions for testing
export const __testUtils = {
  createTestCache: (config) => new CompositionCache(config),
};