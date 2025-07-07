/**
 * @file Simple test to verify the cache fix for the circular following bug
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ScopeCache from '../../../src/scopeDsl/cache.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import {
  LEADING_COMPONENT_ID,
  NAME_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Follow Action Cache Fix - Simple Test', () => {
  let cache;
  let scopeCache;
  let logger;
  let mockEventDispatcher;
  let mockEntityManager;
  let mockScopeEngine;

  beforeEach(() => {
    logger = new ConsoleLogger('DEBUG');
    cache = new Map();

    // Create mock entity manager
    mockEntityManager = {
      getComponentData: jest.fn((entityId, componentId) => {
        if (entityId === 'p_erotica:amaia_castillo_instance') {
          if (componentId === LEADING_COMPONENT_ID) {
            return { followers: ['p_erotica:iker_aguirre_instance'] };
          }
          if (componentId === NAME_COMPONENT_ID) {
            return { text: 'Amaia Castillo' };
          }
        }
        return null;
      }),
    };

    // Create mock scope engine
    mockScopeEngine = {
      resolve: jest.fn().mockReturnValue(new Set(['entity1', 'entity2'])),
      setMaxDepth: jest.fn(),
    };

    // Create mock event dispatcher
    mockEventDispatcher = {
      subscribe: jest.fn().mockReturnValue(() => {}),
    };

    // Create scope cache
    scopeCache = new ScopeCache({
      cache,
      scopeEngine: mockScopeEngine,
      safeEventDispatcher: mockEventDispatcher,
      logger,
    });
  });

  it('should build components for actor entity when missing', () => {
    // Create actor entity without components (like TargetResolutionService does)
    const actorWithoutComponents = {
      id: 'p_erotica:amaia_castillo_instance',
      componentTypeIds: [NAME_COMPONENT_ID, LEADING_COMPONENT_ID],
      // Note: No 'components' property
    };

    const ast = { type: 'Test', logic: true };
    const runtimeCtx = {
      entityManager: mockEntityManager,
      location: { id: 'room_test' },
    };

    // Call resolve
    scopeCache.resolve(ast, actorWithoutComponents, runtimeCtx);

    // Verify that entity manager was called to fetch components
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
      'p_erotica:amaia_castillo_instance',
      LEADING_COMPONENT_ID
    );

    // Verify cache key includes followers
    const cacheKeys = Array.from(cache.keys());
    expect(cacheKeys.length).toBe(1);
    expect(cacheKeys[0]).toContain('followers=p_erotica:iker_aguirre_instance');
  });

  it('should use existing components when available', () => {
    // Create actor entity WITH components
    const actorWithComponents = {
      id: 'p_erotica:amaia_castillo_instance',
      componentTypeIds: [NAME_COMPONENT_ID, LEADING_COMPONENT_ID],
      components: {
        [LEADING_COMPONENT_ID]: {
          followers: ['p_erotica:iker_aguirre_instance'],
        },
      },
    };

    const ast = { type: 'Test', logic: true };
    const runtimeCtx = {
      entityManager: mockEntityManager,
      location: { id: 'room_test' },
    };

    // Call resolve
    scopeCache.resolve(ast, actorWithComponents, runtimeCtx);

    // Verify that entity manager was NOT called (components already present)
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();

    // Verify cache key still includes followers
    const cacheKeys = Array.from(cache.keys());
    expect(cacheKeys.length).toBe(1);
    expect(cacheKeys[0]).toContain('followers=p_erotica:iker_aguirre_instance');
  });

  it('should generate different cache keys for different follower states', () => {
    const ast = { type: 'Test', logic: true };
    const location = { id: 'room_test' };

    // Test 1: Actor with one follower
    const actor1 = {
      id: 'actor1',
      components: {
        [LEADING_COMPONENT_ID]: { followers: ['follower1'] },
      },
    };

    const runtimeCtx1 = { entityManager: mockEntityManager, location };
    scopeCache.resolve(ast, actor1, runtimeCtx1);

    // Test 2: Same actor with different followers
    const actor2 = {
      id: 'actor1',
      components: {
        [LEADING_COMPONENT_ID]: { followers: ['follower1', 'follower2'] },
      },
    };

    const runtimeCtx2 = { entityManager: mockEntityManager, location };
    scopeCache.resolve(ast, actor2, runtimeCtx2);

    // Should have two different cache entries
    expect(cache.size).toBe(2);

    const keys = Array.from(cache.keys());
    expect(keys[0]).toContain('followers=follower1');
    expect(keys[1]).toContain('followers=follower1,follower2');
  });

  it('builds components when actor entity lacks them', () => {
    const actorWithoutComponents = {
      id: 'test_actor',
      componentTypeIds: [LEADING_COMPONENT_ID],
    };

    const ast = { type: 'Test' };
    const runtimeCtx = {
      entityManager: mockEntityManager,
      location: { id: 'test_location' },
    };

    // Mock entity manager to return component data
    mockEntityManager.getComponentData.mockReturnValue({
      followers: ['test_follower'],
    });

    scopeCache.resolve(ast, actorWithoutComponents, runtimeCtx);

    // Verify that getComponentData was called to build components
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
      'test_actor',
      LEADING_COMPONENT_ID
    );

    // Verify cache key includes the built component data
    const cacheKeys = Array.from(cache.keys());
    expect(cacheKeys[0]).toContain('followers=test_follower');
  });
});
