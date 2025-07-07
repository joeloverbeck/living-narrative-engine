/**
 * @file Integration test to verify the scope cache properly invalidates when component state changes.
 */

import { describe, it, expect } from '@jest/globals';
import ScopeCache from '../../../src/scopeDsl/cache.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import {
  FOLLOWING_COMPONENT_ID,
  LEADING_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Scope Cache Component State Integration', () => {
  it('should include following/leading component state in cache key', () => {
    const logger = new ConsoleLogger('INFO');
    const cache = new Map();
    const mockScopeEngine = {
      resolve: () => new Set(['result']),
      setMaxDepth: () => {}
    };
    const mockEventDispatcher = {
      subscribe: () => () => {}
    };
    
    const scopeCache = new ScopeCache({
      cache,
      scopeEngine: mockScopeEngine,
      safeEventDispatcher: mockEventDispatcher,
      logger
    });
    
    // Test scenario matching the bug: Amaia with Iker as follower
    const amaiaWithFollower = {
      id: 'p_erotica:amaia_castillo_instance',
      components: {
        [LEADING_COMPONENT_ID]: { 
          followers: ['p_erotica:iker_aguirre_instance'] 
        }
      }
    };
    
    const ast = { type: 'Filter', logic: { and: [] } };
    const runtimeCtx = { location: { id: 'room_test' } };
    
    const key1 = scopeCache._generateKey(
      amaiaWithFollower.id, 
      ast, 
      runtimeCtx, 
      amaiaWithFollower
    );
    
    // Verify the key includes the follower information
    expect(key1).toContain('followers=p_erotica:iker_aguirre_instance');
    
    // Now test with Amaia having no followers
    const amaiaNoFollowers = {
      id: 'p_erotica:amaia_castillo_instance',
      components: {}
    };
    
    const key2 = scopeCache._generateKey(
      amaiaNoFollowers.id, 
      ast, 
      runtimeCtx, 
      amaiaNoFollowers
    );
    
    // Keys should be different
    expect(key1).not.toBe(key2);
    expect(key2).not.toContain('followers=');
    
    // Test with entity that is following someone
    const ikerFollowingAmaia = {
      id: 'p_erotica:iker_aguirre_instance',
      components: {
        [FOLLOWING_COMPONENT_ID]: { 
          leaderId: 'p_erotica:amaia_castillo_instance' 
        }
      }
    };
    
    const key3 = scopeCache._generateKey(
      ikerFollowingAmaia.id,
      ast,
      runtimeCtx,
      ikerFollowingAmaia
    );
    
    // Should include following information
    expect(key3).toContain('following=p_erotica:amaia_castillo_instance');
    
    console.log('Cache keys properly include component state:');
    console.log('- With followers:', key1);
    console.log('- No followers:', key2);
    console.log('- Following someone:', key3);
  });
});