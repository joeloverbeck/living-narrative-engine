/**
 * @file Mock cache strategy for UnifiedScopeResolver testing
 */

import { jest } from '@jest/globals';

/**
 * Creates a mock cache strategy for testing UnifiedScopeResolver cache functionality
 *
 * @returns {object} Mock cache strategy with spy methods
 */
export function createMockCacheStrategy() {
  const cache = new Map();

  const mockStrategy = {
    generateKey: jest.fn((scopeName, context) => {
      return `${scopeName}:${context.actor.id}:${context.actorLocation}`;
    }),

    getSync: jest.fn((key) => {
      return cache.get(key) || null;
    }),

    setSync: jest.fn((key, value, ttl) => {
      cache.set(key, value);
      return true;
    }),

    clear: jest.fn(() => {
      cache.clear();
    }),

    // Helper method to pre-populate cache for testing
    _preloadCache: (key, value) => {
      cache.set(key, value);
    },

    // Helper method to get internal cache state for testing
    _getCacheState: () => {
      return new Map(cache);
    },
  };

  return mockStrategy;
}
