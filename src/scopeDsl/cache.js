/**
 * @file Scope-DSL Cache
 * @description Caching wrapper for Scope-DSL resolution with automatic cache invalidation on turn start
 */

import { TURN_STARTED_ID } from '../constants/eventIds.js';
import { IScopeEngine } from '../interfaces/IScopeEngine.js';

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
 * Acts as a caching wrapper around ScopeEngine with automatic cache invalidation
 *
 * @implements {IScopeEngine}
 */
class ScopeCache extends IScopeEngine {
  /**
   * @param {object} dependencies - Dependencies for the cache
   * @param {object} dependencies.cache - A cache instance conforming to { get, set, clear, size }.
   * @param {import('../scopeDsl/engine.js').default} dependencies.scopeEngine - The ScopeEngine to wrap
   * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dependencies.safeEventDispatcher - Event dispatcher for listening to turn events
   * @param {import('../interfaces/coreServices.js').ILogger} dependencies.logger - Logger for debugging
   */
  constructor({ cache, scopeEngine, safeEventDispatcher, logger }) {
    super(); // Call parent constructor

    if (!cache) {
      throw new Error('A cache instance must be provided.');
    }
    if (!scopeEngine || typeof scopeEngine.resolve !== 'function') {
      throw new Error(
        'A ScopeEngine instance with resolve method must be provided.'
      );
    }
    if (
      !safeEventDispatcher ||
      typeof safeEventDispatcher.subscribe !== 'function'
    ) {
      throw new Error('A SafeEventDispatcher instance must be provided.');
    }
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error('A logger instance must be provided.');
    }

    this.cache = cache;
    this.scopeEngine = scopeEngine;
    this.logger = logger;
    this.unsubscribeFn = null;

    // Subscribe to turn started events to automatically clear cache
    this.unsubscribeFn = safeEventDispatcher.subscribe(
      TURN_STARTED_ID,
      this._handleTurnStarted.bind(this)
    );

    if (this.unsubscribeFn) {
      this.logger.debug(
        'ScopeCache: Successfully subscribed to TURN_STARTED_ID events'
      );
    } else {
      this.logger.error(
        'ScopeCache: Failed to subscribe to TURN_STARTED_ID events'
      );
    }
  }

  /**
   * Handle turn started event by clearing the cache
   *
   * @param {object} payload - Event payload
   * @private
   */
  _handleTurnStarted(payload) {
    this.logger.debug('ScopeCache: Turn started, clearing cache');
    this.cache.clear();
  }

  /**
   * Generate a cache key from actorId and AST
   *
   * @param {string} actorId - Actor ID
   * @param {object} ast - The parsed AST
   * @returns {string} Cache key
   * @private
   */
  _generateKey(actorId, ast) {
    // Create a stable key from the AST structure
    const astKey = JSON.stringify(ast);
    return `${actorId}:${astKey}`;
  }

  /**
   * Resolves a Scope-DSL AST to a set of entity IDs with caching
   * This method has the same signature as ScopeEngine.resolve()
   *
   * @param {object} ast - The parsed AST
   * @param {object} actorEntity - The acting entity instance
   * @param {object} runtimeCtx - Runtime context with services
   * @returns {Set<string>} Set of entity IDs
   */
  resolve(ast, actorEntity, runtimeCtx) {
    const key = this._generateKey(actorEntity.id, ast);

    // Check cache first
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      this.logger.debug(`ScopeCache: Cache hit for key: ${key}`);
      return cached;
    }

    // Resolve using the wrapped ScopeEngine and cache the result
    this.logger.debug(`ScopeCache: Cache miss for key: ${key}, resolving...`);
    const result = this.scopeEngine.resolve(ast, actorEntity, runtimeCtx);
    this.cache.set(key, result);
    return result;
  }

  /**
   * Set the maximum depth for scope resolution
   * Delegates to the wrapped ScopeEngine
   *
   * @param {number} n - Maximum depth
   */
  setMaxDepth(n) {
    this.scopeEngine.setMaxDepth(n);
  }

  /**
   * Get cache statistics for debugging
   *
   * @returns {object} Cache statistics
   */
  getStats() {
    return {
      size: this.cache.size(),
      maxSize: this.cache.maxSize || 'unknown',
      subscribed: this.unsubscribeFn !== null,
    };
  }

  /**
   * Clean up resources when the cache is no longer needed
   */
  dispose() {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
      this.logger.debug('ScopeCache: Unsubscribed from TURN_STARTED_ID events');
    }
  }
}

export default ScopeCache;
export { LRUCache };
