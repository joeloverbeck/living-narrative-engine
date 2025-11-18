/**
 * @file Mock cache strategy for UnifiedScopeResolver testing
 */

import { jest } from '@jest/globals';

/**
 * Creates a mock cache strategy for testing UnifiedScopeResolver cache functionality
 * Optimized for performance in test scenarios
 *
 * @param {object} options - Configuration options
 * @param {boolean} options.enableSpies - Whether to enable Jest spies (default: true)
 * @param {Map} options.initialCache - Initial cache state
 * @returns {object} Mock cache strategy with spy methods
 */
export function createMockCacheStrategy(options = {}) {
  const { enableSpies = true, initialCache = null } = options;
  const cache = initialCache || new Map();

  // Optimized key generation without Jest overhead when spies disabled
  const generateKey = enableSpies
    ? jest.fn((scopeName, context) => {
        return `${scopeName}:${context.actor.id}:${context.actorLocation}`;
      })
    : (scopeName, context) => {
        return `${scopeName}:${context.actor.id}:${context.actorLocation}`;
      };

  // Optimized cache operations
  const getSync = enableSpies
    ? jest.fn((key) => cache.get(key) || null)
    : (key) => cache.get(key) || null;

  const setSync = enableSpies
    ? jest.fn((key, value, ttl) => {
        cache.set(key, value);
        return true;
      })
    : (key, value, ttl) => {
        cache.set(key, value);
        return true;
      };

  const clear = enableSpies
    ? jest.fn(() => cache.clear())
    : () => cache.clear();

  const mockStrategy = {
    generateKey,
    getSync,
    setSync,
    clear,

    // Helper method to pre-populate cache for testing
    _preloadCache: (key, value) => {
      cache.set(key, value);
    },

    // Helper method to get internal cache state for testing
    _getCacheState: () => {
      return new Map(cache);
    },

    // Helper to reset spy state without clearing cache
    _resetSpies: () => {
      if (enableSpies) {
        generateKey.mockReset();
        getSync.mockReset();
        setSync.mockReset();
        clear.mockReset();
      }
    },

    // Helper to check if spies are enabled
    _hasSpies: () => enableSpies,
  };

  return mockStrategy;
}

/**
 * Creates a shared cache strategy instance for performance testing
 * Reuses the same cache across multiple tests to reduce allocation overhead
 */
let sharedCacheInstance = null;

/**
 *
 */
export function getSharedMockCacheStrategy() {
  if (!sharedCacheInstance) {
    sharedCacheInstance = createMockCacheStrategy({ enableSpies: false });
  }
  return sharedCacheInstance;
}

/**
 * Resets the shared cache strategy instance
 */
export function resetSharedMockCacheStrategy() {
  if (sharedCacheInstance) {
    sharedCacheInstance.clear();
  }
}
