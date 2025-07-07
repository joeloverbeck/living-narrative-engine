/**
 * @file Unit tests for ScopeCache component building functionality
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import ScopeCache from '../../../src/scopeDsl/cache.js';

describe('ScopeCache - Component Building', () => {
  let cache;
  let mockCache;
  let mockScopeEngine;
  let mockLogger;
  let mockDispatcher;
  let mockEntityManager;

  beforeEach(() => {
    mockCache = new Map();
    
    mockScopeEngine = {
      resolve: jest.fn().mockReturnValue(new Set(['result1', 'result2'])),
      setMaxDepth: jest.fn()
    };
    
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    mockDispatcher = {
      subscribe: jest.fn().mockReturnValue(() => {})
    };
    
    mockEntityManager = {
      getComponentData: jest.fn()
    };
    
    cache = new ScopeCache({
      cache: mockCache,
      scopeEngine: mockScopeEngine,
      safeEventDispatcher: mockDispatcher,
      logger: mockLogger
    });
  });

  describe('Actor entity component building', () => {
    test('builds components when actor entity lacks them but has componentTypeIds', () => {
      const ast = { type: 'Test' };
      const actorEntity = {
        id: 'actor123',
        componentTypeIds: ['core:name', 'core:leading']
        // No components property
      };
      const runtimeCtx = { 
        entityManager: mockEntityManager,
        location: { id: 'loc1' }
      };
      
      // Mock component data
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'actor123') {
          if (componentId === 'core:name') return { text: 'Actor Name' };
          if (componentId === 'core:leading') return { followers: ['follower1'] };
        }
        return null;
      });
      
      cache.resolve(ast, actorEntity, runtimeCtx);
      
      // Verify component data was fetched
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith('actor123', 'core:name');
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith('actor123', 'core:leading');
      
      // Verify cache key includes follower data
      const cacheKeys = Array.from(mockCache.keys());
      expect(cacheKeys[0]).toContain('followers=follower1');
    });

    test('does not build components when actor already has them', () => {
      const ast = { type: 'Test' };
      const actorEntity = {
        id: 'actor123',
        componentTypeIds: ['core:name', 'core:leading'],
        components: {
          'core:name': { text: 'Existing Name' },
          'core:leading': { followers: ['existing-follower'] }
        }
      };
      const runtimeCtx = { 
        entityManager: mockEntityManager,
        location: { id: 'loc1' }
      };
      
      cache.resolve(ast, actorEntity, runtimeCtx);
      
      // Verify component data was NOT fetched
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      
      // Verify cache key still includes existing follower data
      const cacheKeys = Array.from(mockCache.keys());
      expect(cacheKeys[0]).toContain('followers=existing-follower');
    });

    test('handles actor entity without componentTypeIds', () => {
      const ast = { type: 'Test' };
      const actorEntity = {
        id: 'actor123'
        // No componentTypeIds or components
      };
      const runtimeCtx = { 
        entityManager: mockEntityManager,
        location: { id: 'loc1' }
      };
      
      cache.resolve(ast, actorEntity, runtimeCtx);
      
      // Should not attempt to build components
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      
      // Cache key should not include component state
      const cacheKeys = Array.from(mockCache.keys());
      expect(cacheKeys[0]).not.toContain('followers=');
    });

    test('handles null/undefined actor entity', () => {
      const ast = { type: 'Test' };
      const runtimeCtx = { 
        entityManager: mockEntityManager,
        location: { id: 'loc1' }
      };
      
      // Test with null
      cache.resolve(ast, null, runtimeCtx);
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      
      // Test with undefined
      cache.resolve(ast, undefined, runtimeCtx);
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('includes multiple component states in cache key', () => {
      const ast = { type: 'Test' };
      const actorEntity = {
        id: 'actor123',
        componentTypeIds: ['core:leading', 'core:following'],
        components: {
          'core:leading': { followers: ['follower1', 'follower2'] },
          'core:following': { leaderId: 'leader1' }
        }
      };
      const runtimeCtx = { 
        entityManager: mockEntityManager,
        location: { id: 'loc1' }
      };
      
      cache.resolve(ast, actorEntity, runtimeCtx);
      
      const cacheKeys = Array.from(mockCache.keys());
      expect(cacheKeys[0]).toContain('followers=follower1,follower2');
      expect(cacheKeys[0]).toContain('following=leader1');
    });

    test('sorts followers for stable cache key generation', () => {
      const ast = { type: 'Test' };
      
      // First call with unsorted followers
      const actorEntity1 = {
        id: 'actor123',
        components: {
          'core:leading': { followers: ['zebra', 'alpha', 'beta'] }
        }
      };
      
      const runtimeCtx = { 
        entityManager: mockEntityManager,
        location: { id: 'loc1' }
      };
      
      cache.resolve(ast, actorEntity1, runtimeCtx);
      
      // Second call with same followers in different order
      const actorEntity2 = {
        id: 'actor123',
        components: {
          'core:leading': { followers: ['beta', 'zebra', 'alpha'] }
        }
      };
      
      cache.resolve(ast, actorEntity2, runtimeCtx);
      
      // Should only have one cache entry (same key)
      expect(mockCache.size).toBe(1);
      
      // Key should have sorted followers
      const cacheKeys = Array.from(mockCache.keys());
      expect(cacheKeys[0]).toContain('followers=alpha,beta,zebra');
    });
  });
});