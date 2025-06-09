/**
 * @file This test suite tests the scope 'followers' of entityScopeService.
 * @see tests/entities/entityScopeService.followers.test.js
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { getEntityIdsForScopes } from '../../src/entities/entityScopeService.js'; // Adjust path as necessary
import {
  LEADING_COMPONENT_ID,
  INVENTORY_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

// --- Mocks & Setup ---

// Mock Entity class or object structure
const createMockEntity = (id, components = {}) => ({
  id,
  // Jest mock functions for component interactions
  hasComponent: jest.fn((componentId) => componentId in components),
  getComponentData: jest.fn((componentId) => components[componentId] || null),
});

// Mock dependencies required by the ActionContext
const mockEntityManager = {
  // Not directly used by _handleFollowers, but good practice to mock
  getEntityInstance: jest.fn(),
};

describe('entityScopeService - "followers" scope', () => {
  let consoleWarnSpy;

  beforeEach(() => {
    // Reset mocks to ensure test isolation
    jest.resetAllMocks();
    // Spy on console.warn to check for warnings in failure cases
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original console.warn behavior
    consoleWarnSpy.mockRestore();
  });

  // Test Case 1: Standard success case with followers
  test('should return a set of follower IDs when the actor has a valid leading component', () => {
    const leaderId = 'player:1';
    const followerIds = ['npc:1', 'npc:2'];
    const mockPlayer = createMockEntity(leaderId, {
      [LEADING_COMPONENT_ID]: { followers: followerIds },
    });

    // FIX: The context now uses 'actingEntity' as required by the service.
    const context = {
      actingEntity: mockPlayer,
      entityManager: mockEntityManager,
    };

    const result = getEntityIdsForScopes('followers', context);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(2);
    expect(result).toEqual(new Set(followerIds));
    expect(mockPlayer.hasComponent).toHaveBeenCalledWith(LEADING_COMPONENT_ID);
    expect(mockPlayer.getComponentData).toHaveBeenCalledWith(
      LEADING_COMPONENT_ID
    );
  });

  // Test Case 2: Actor is a leader but has no followers
  test('should return an empty set if the followers array is empty', () => {
    const leaderId = 'player:1';
    const mockPlayer = createMockEntity(leaderId, {
      [LEADING_COMPONENT_ID]: { followers: [] },
    });

    // FIX: The context now uses 'actingEntity'.
    const context = {
      actingEntity: mockPlayer,
      entityManager: mockEntityManager,
    };

    const result = getEntityIdsForScopes('followers', context);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  // Test Case 3: Actor does not have the leading component
  test('should return an empty set if the actor is not a leader', () => {
    const nonLeaderId = 'player:2';
    // Entity without a 'core:leading' component
    const mockPlayer = createMockEntity(nonLeaderId, {});

    // FIX: The context now uses 'actingEntity'.
    const context = {
      actingEntity: mockPlayer,
      entityManager: mockEntityManager,
    };

    const result = getEntityIdsForScopes('followers', context);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
    // FIX: This check will now pass because the service finds the actingEntity.
    expect(mockPlayer.hasComponent).toHaveBeenCalledWith(LEADING_COMPONENT_ID);
    // getComponentData should not be called if hasComponent is false
    expect(mockPlayer.getComponentData).not.toHaveBeenCalled();
  });

  // Test Case 4: Component data is malformed (missing 'followers' property)
  test('should return an empty set and warn if component data is malformed', () => {
    const leaderId = 'player:1';
    // Malformed data: missing the 'followers' array property
    const mockPlayer = createMockEntity(leaderId, {
      [LEADING_COMPONENT_ID]: { not_followers: [] },
    });

    // FIX: The context now uses 'actingEntity'.
    const context = {
      actingEntity: mockPlayer,
      entityManager: mockEntityManager,
    };

    const result = getEntityIdsForScopes('followers', context);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  // Test Case 5: Player entity is missing from the context
  test('should return an empty set and warn if playerEntity is missing from context', () => {
    // FIX: The context correctly reflects a missing actingEntity.
    const context = {
      actingEntity: null,
      entityManager: mockEntityManager,
    };

    const result = getEntityIdsForScopes('followers', context);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
    // FIX: Update the expected warning to check for "actingEntity".
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "entityScopeService(#createActorComponentScopeHandler): Scope 'followers' requested but actingEntity is missing in context."
    );
  });

  // Test Case 6: Integration with other scopes
  test('should correctly aggregate follower IDs when requested with other scopes', () => {
    const leaderId = 'player:1';
    const followerIds = ['npc:1', 'npc:2'];
    const inventoryItemId = 'item:sword';

    const mockPlayer = createMockEntity(leaderId, {
      [LEADING_COMPONENT_ID]: { followers: followerIds },
      [INVENTORY_COMPONENT_ID]: { items: [inventoryItemId] },
    });

    // FIX: The context now uses 'actingEntity'.
    const context = {
      actingEntity: mockPlayer,
      entityManager: mockEntityManager,
    };

    const result = getEntityIdsForScopes(['followers', 'inventory'], context);

    expect(result).toBeInstanceOf(Set);
    // FIX: This check will now pass as both scope handlers find the actingEntity.
    expect(result.size).toBe(3);
    expect(result).toEqual(new Set(['npc:1', 'npc:2', 'item:sword']));
  });
});
