/**
 * @file Scope-DSL Cache
 * @description LRU cache for Scope-DSL resolution results
 */

/**
 * LRU Cache implementation for Scope-DSL resolution
 */
class LRUCache {
  constructor(maxSize = 256) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * Get a value from the cache
   *
   * @param {string} key - Cache key
   * @returns {any} Cached value or undefined if not found
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Set a value in the cache
   *
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  set(key, value) {
    if (this.cache.has(key)) {
      // Update existing entry
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first entry)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  /**
   * Clear all entries from the cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get the current size of the cache
   *
   * @returns {number} Number of entries in cache
   */
  size() {
    return this.cache.size;
  }
}

/**
 * Scope-DSL Cache that provides memoization for scope resolution
 */
class ScopeCache {
  constructor() {
    this.cache = new LRUCache(256);
    this.currentTurn = null;
  }

  /**
   * Generate a cache key from turn, actorId, and scopeName
   *
   * @param {string} turn - Current turn identifier
   * @param {string} actorId - Actor ID
   * @param {string} scopeName - Scope name/expression
   * @returns {string} Cache key
   * @private
   */
  _generateKey(turn, actorId, scopeName) {
    return `${turn}:${actorId}:${scopeName}`;
  }

  /**
   * Resolve a scope with caching
   *
   * @param {string} scopeName - Scope name/expression
   * @param {string} actorId - Actor ID
   * @param {Function} resolveFn - Function to resolve the scope if not cached
   * @returns {any} Resolved scope result
   */
  resolve(scopeName, actorId, resolveFn) {
    if (!this.currentTurn) {
      throw new Error('Cache not initialized - call newTurn() first');
    }

    const key = this._generateKey(this.currentTurn, actorId, scopeName);

    // Check cache first
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Resolve and cache
    const result = resolveFn();
    this.cache.set(key, result);
    return result;
  }

  /**
   * Start a new turn, clearing the cache
   *
   * @param {string} turn - Turn identifier
   */
  newTurn(turn) {
    this.currentTurn = turn;
    this.cache.clear();
  }

  /**
   * Get cache statistics for debugging
   *
   * @returns {object} Cache statistics
   */
  getStats() {
    return {
      size: this.cache.size(),
      maxSize: this.cache.maxSize,
      currentTurn: this.currentTurn,
    };
  }
}

export default ScopeCache;
