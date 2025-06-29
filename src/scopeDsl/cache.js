/**
 * @file Scope-DSL Cache
 * @description Caching wrapper for Scope-DSL resolution with automatic cache invalidation on turn start
 */

import { TURN_STARTED_ID } from '../constants/eventIds.js';
import { IScopeEngine } from '../interfaces/IScopeEngine.js';

/** @typedef {import('../types/runtimeContext.js').RuntimeContext} RuntimeContext */

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
   * @param {object} _payload - Event payload (unused)
   * @private
   */
  _handleTurnStarted(_payload) {
    this.logger.debug('ScopeCache: Turn started, clearing cache');
    this.cache.clear();
  }

  /**
   * Generate a cache key from actorId, location, and AST
   *
   * @param {string} actorId - Actor ID
   * @param {object} ast - The parsed AST
   * @param {RuntimeContext} runtimeCtx - Runtime context containing location
   * @returns {string} Cache key
   * @private
   */
  _generateKey(actorId, ast, runtimeCtx) {
    // Create a stable key from the AST structure
    const astKey = JSON.stringify(ast);

    // Extract location ID from runtime context if available
    const locationId = runtimeCtx?.location?.id || 'no-location';

    // Include location in cache key to ensure cache invalidation on location change
    return `${actorId}:${locationId}:${astKey}`;
  }

  /**
   * Resolves a Scope-DSL AST to a set of entity IDs with caching
   * This method has the same signature as ScopeEngine.resolve()
   *
   * @param {object} ast - The parsed AST
   * @param {object} actorEntity - The acting entity instance
   * @param {RuntimeContext} runtimeCtx - Runtime context with services
   * @returns {Set<string>} Set of entity IDs
   */
  resolve(ast, actorEntity, runtimeCtx) {
    const key = this._generateKey(actorEntity.id, ast, runtimeCtx);

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
      size: this.cache.size,
      maxSize: this.cache.max || 'unknown',
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
