/**
 * @file Test to verify the cache fix for the follow action circular following bug.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ScopeCache from '../../../src/scopeDsl/cache.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { SimpleEntityManager } from '../../common/entities/index.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import {
  FOLLOWING_COMPONENT_ID,
  LEADING_COMPONENT_ID,
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Follow Action Cache Fix - Component State in Cache Key', () => {
  let cache;
  let scopeEngine;
  let scopeCache;
  let logger;
  let mockEventDispatcher;

  beforeEach(() => {
    logger = new ConsoleLogger('DEBUG');
    
    // Create a simple Map-based cache
    cache = new Map();
    
    // Create mock scope engine
    scopeEngine = {
      resolve: jest.fn().mockReturnValue(new Set(['entity1', 'entity2'])),
      setMaxDepth: jest.fn()
    };
    
    // Create mock event dispatcher
    mockEventDispatcher = {
      subscribe: jest.fn().mockReturnValue(() => {})
    };
    
    // Create scope cache
    scopeCache = new ScopeCache({
      cache,
      scopeEngine,
      safeEventDispatcher: mockEventDispatcher,
      logger
    });
  });

  it('should generate different cache keys when following/leading components change', () => {
    const ast = { type: 'Filter', logic: { test: true } };
    const runtimeCtx = { location: { id: 'room1' } };
    
    // Test 1: Actor with no following/leading components
    const actor1 = {
      id: 'actor1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Actor 1' }
      }
    };
    
    const key1 = scopeCache._generateKey(actor1.id, ast, runtimeCtx, actor1);
    
    // Test 2: Same actor now has followers
    const actor1WithFollowers = {
      id: 'actor1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Actor 1' },
        [LEADING_COMPONENT_ID]: { followers: ['follower1'] }
      }
    };
    
    const key2 = scopeCache._generateKey(actor1WithFollowers.id, ast, runtimeCtx, actor1WithFollowers);
    
    // Keys should be different
    expect(key1).not.toBe(key2);
    expect(key2).toContain('followers=follower1');
    
    // Test 3: Same actor with different followers
    const actor1WithDifferentFollowers = {
      id: 'actor1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Actor 1' },
        [LEADING_COMPONENT_ID]: { followers: ['follower1', 'follower2'] }
      }
    };
    
    const key3 = scopeCache._generateKey(actor1WithDifferentFollowers.id, ast, runtimeCtx, actor1WithDifferentFollowers);
    
    // Key should be different from previous
    expect(key3).not.toBe(key2);
    expect(key3).toContain('followers=follower1,follower2');
    
    // Test 4: Actor is following someone
    const actor1Following = {
      id: 'actor1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Actor 1' },
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'leader1' }
      }
    };
    
    const key4 = scopeCache._generateKey(actor1Following.id, ast, runtimeCtx, actor1Following);
    
    expect(key4).not.toBe(key1);
    expect(key4).toContain('following=leader1');
  });

  it('should invalidate cache when following relationships change', () => {
    const ast = { type: 'Filter', logic: { test: true } };
    const runtimeCtx = { location: { id: 'room1' } };
    
    // First call - no followers
    const actor1 = {
      id: 'actor1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Actor 1' }
      }
    };
    
    const result1 = scopeCache.resolve(ast, actor1, runtimeCtx);
    expect(scopeEngine.resolve).toHaveBeenCalledTimes(1);
    expect(result1).toEqual(new Set(['entity1', 'entity2']));
    
    // Second call with same state - should hit cache
    const result2 = scopeCache.resolve(ast, actor1, runtimeCtx);
    expect(scopeEngine.resolve).toHaveBeenCalledTimes(1); // Still 1, cache hit
    expect(result2).toEqual(new Set(['entity1', 'entity2']));
    
    // Third call with followers - should miss cache
    const actor1WithFollowers = {
      id: 'actor1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Actor 1' },
        [LEADING_COMPONENT_ID]: { followers: ['follower1'] }
      }
    };
    
    // Change the mock return value for different result
    scopeEngine.resolve.mockReturnValue(new Set(['entity3']));
    
    const result3 = scopeCache.resolve(ast, actor1WithFollowers, runtimeCtx);
    expect(scopeEngine.resolve).toHaveBeenCalledTimes(2); // Cache miss, new call
    expect(result3).toEqual(new Set(['entity3']));
  });

  it('should generate stable keys for the same component state', () => {
    const ast = { type: 'Filter', logic: { test: true } };
    const runtimeCtx = { location: { id: 'room1' } };
    
    // Test with unsorted followers array
    const actor1 = {
      id: 'actor1',
      components: {
        [LEADING_COMPONENT_ID]: { followers: ['follower2', 'follower1', 'follower3'] }
      }
    };
    
    const key1 = scopeCache._generateKey(actor1.id, ast, runtimeCtx, actor1);
    
    // Same followers in different order
    const actor2 = {
      id: 'actor1',
      components: {
        [LEADING_COMPONENT_ID]: { followers: ['follower3', 'follower1', 'follower2'] }
      }
    };
    
    const key2 = scopeCache._generateKey(actor2.id, ast, runtimeCtx, actor2);
    
    // Keys should be the same (followers are sorted)
    expect(key1).toBe(key2);
    expect(key1).toContain('followers=follower1,follower2,follower3');
  });
});