/**
 * @file This module covers the functionality of entityScopeService.js
 * @see tests/entities/entityScopeService.test.js
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
// FIXED: Corrected the import path to match the project structure.
import { getEntityIdsForScopes } from '../../../src/entities/entityScopeService.js';
import {
  EXITS_COMPONENT_ID,
  INVENTORY_COMPONENT_ID,
  ITEM_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

// --- Mocks & Setup ---

/**
 * Creates a mock entity object for testing purposes.
 *
 * @param {string} id - The entity's ID.
 * @param {object} components - A map of component IDs to their data.
 * @returns {object} A mock entity.
 */
const createMockEntity = (id, components = {}) => ({
  id,
  hasComponent: jest.fn((componentId) => componentId in components),
  getComponentData: jest.fn((componentId) => components[componentId] || null),
});

describe('entityScopeService', () => {
  let consoleWarnSpy;
  let consoleErrorSpy;
  let consoleLogSpy;
  // FIXED: The mock entity manager will be fully reset before each test.
  let mockEntityManager;

  beforeEach(() => {
    // Reset all mocks provided by Jest.
    jest.resetAllMocks();

    // FIXED: Instantiate a fresh mock manager for each test to prevent state pollution.
    mockEntityManager = {
      entities: new Map(),
      getEntityInstance: jest.fn((id) => mockEntityManager.entities.get(id)),
      getEntitiesInLocation: jest.fn((locationId) => {
        const ids = new Set();
        mockEntityManager.entities.forEach((entity) => {
          const posData = entity.getComponentData('core:position');
          if (posData && posData.locationId === locationId) {
            ids.add(entity.id);
          }
        });
        return ids;
      }),
      addEntity(entity) {
        this.entities.set(entity.id, entity);
      },
      clear() {
        this.entities.clear();
        this.getEntityInstance.mockClear();
        this.getEntitiesInLocation.mockClear();
      },
    };

    // Set up spies for console output.
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console spies.
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  // --- Main Aggregator Function Tests ---
  describe('getEntityIdsForScopes', () => {
    test('should return an empty set and log an error if context or entityManager is missing', () => {
      expect(getEntityIdsForScopes('inventory', null)).toEqual(new Set());
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.',
        { context: null }
      );

      consoleErrorSpy.mockClear();

      expect(getEntityIdsForScopes('inventory', { actingEntity: {} })).toEqual(
        new Set()
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.',
        { context: { actingEntity: {} } }
      );
    });

    test('should warn and skip unknown scopes, returning IDs from valid ones', () => {
      const actingEntity = createMockEntity('player', {
        [INVENTORY_COMPONENT_ID]: { items: ['item1'] },
      });
      const context = { actingEntity, entityManager: mockEntityManager };

      const result = getEntityIdsForScopes(
        ['inventory', 'unknown_scope'],
        context
      );
      expect(result).toEqual(new Set(['item1']));
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "getEntityIdsForScopes: Unknown scope requested: 'unknown_scope'. Skipping."
      );
    });

    test("should log and skip scopes 'none' and 'direction'", () => {
      const context = { entityManager: mockEntityManager };
      const result = getEntityIdsForScopes(['none', 'direction'], context);

      expect(result).toEqual(new Set());
    });

    test('should handle a single scope string', () => {
      const actingEntity = createMockEntity('player', {
        [INVENTORY_COMPONENT_ID]: { items: ['item1'] },
      });
      const context = { actingEntity, entityManager: mockEntityManager };

      const result = getEntityIdsForScopes('inventory', context);
      expect(result).toEqual(new Set(['item1']));
    });

    test('should aggregate unique IDs from multiple scopes', () => {
      const actingEntity = createMockEntity('player', {
        [INVENTORY_COMPONENT_ID]: { items: ['item1', 'item2'] },
      });
      const context = { actingEntity, entityManager: mockEntityManager };
      const result = getEntityIdsForScopes(['self', 'inventory'], context);
      expect(result).toEqual(new Set(['player', 'item1', 'item2']));
    });

    test('should log an error and continue if a scope handler throws an exception', () => {
      const testError = new Error('Test DB Error');
      mockEntityManager.getEntitiesInLocation.mockImplementation(() => {
        throw testError;
      });

      const location = createMockEntity('loc1');
      const context = {
        currentLocation: location,
        entityManager: mockEntityManager,
      };

      const result = getEntityIdsForScopes('location', context);
      expect(result).toEqual(new Set());
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "getEntityIdsForScopes: Error executing handler for scope 'location':",
        testError
      );
    });
  });

  // --- Individual Scope Handler Tests ---
  describe('Scope: location & environment', () => {
    let location, itemInLoc, npcInLoc;

    beforeEach(() => {
      location = createMockEntity('loc1');
      itemInLoc = createMockEntity('itemInLoc', {
        'core:position': { locationId: 'loc1' },
      });
      npcInLoc = createMockEntity('npcInLoc', {
        'core:position': { locationId: 'loc1' },
      });

      mockEntityManager.addEntity(itemInLoc);
      mockEntityManager.addEntity(npcInLoc);
    });

    test('should return IDs of entities in the current location', () => {
      const context = {
        currentLocation: location,
        entityManager: mockEntityManager,
      };
      const result = getEntityIdsForScopes('location', context);
      expect(result).toEqual(new Set(['itemInLoc', 'npcInLoc']));
    });

    test('should return same result for "environment" scope', () => {
      const context = {
        currentLocation: location,
        entityManager: mockEntityManager,
      };
      const result = getEntityIdsForScopes('environment', context);
      expect(result).toEqual(new Set(['itemInLoc', 'npcInLoc']));
    });

    test('should exclude the actingEntity from the results', () => {
      const actingEntity = createMockEntity('player', {
        'core:position': { locationId: 'loc1' },
      });
      mockEntityManager.addEntity(actingEntity);
      const context = {
        actingEntity,
        currentLocation: location,
        entityManager: mockEntityManager,
      };
      const result = getEntityIdsForScopes('location', context);
      expect(result).toEqual(new Set(['itemInLoc', 'npcInLoc']));
      expect(result.has('player')).toBe(false);
    });
  });

  describe('Scope: location_items', () => {
    let location, itemInLoc, nonItemInLoc;
    beforeEach(() => {
      location = createMockEntity('loc1');
      itemInLoc = createMockEntity('item1', {
        [ITEM_COMPONENT_ID]: {},
        'core:position': { locationId: 'loc1' },
      });
      nonItemInLoc = createMockEntity('npc1', {
        'core:position': { locationId: 'loc1' },
      });

      mockEntityManager.addEntity(itemInLoc);
      mockEntityManager.addEntity(nonItemInLoc);
    });

    test('should return only entities with ItemComponent from the location', () => {
      const context = {
        currentLocation: location,
        entityManager: mockEntityManager,
      };
      const result = getEntityIdsForScopes('location_items', context);
      expect(result).toEqual(new Set(['item1']));
    });

    test('should warn if an entity from location cannot be found in manager', () => {
      mockEntityManager.getEntitiesInLocation.mockReturnValueOnce(
        new Set(['item1', 'nonexistent'])
      );
      const context = {
        currentLocation: location,
        entityManager: mockEntityManager,
      };

      const result = getEntityIdsForScopes('location_items', context);
      expect(result).toEqual(new Set(['item1']));
    });
  });

  describe('Scope: location_non_items', () => {
    let location, itemInLoc, nonItemInLoc;

    beforeEach(() => {
      location = createMockEntity('loc1');
      itemInLoc = createMockEntity('item1', {
        [ITEM_COMPONENT_ID]: {},
        'core:position': { locationId: 'loc1' },
      });
      nonItemInLoc = createMockEntity('npc1', {
        'core:position': { locationId: 'loc1' },
      });
      mockEntityManager.addEntity(itemInLoc);
      mockEntityManager.addEntity(nonItemInLoc);
    });

    test('should return only entities without ItemComponent from the location', () => {
      const context = {
        currentLocation: location,
        entityManager: mockEntityManager,
      };
      const result = getEntityIdsForScopes('location_non_items', context);
      expect(result).toEqual(new Set(['npc1']));
    });

    test('should warn if an entity from location cannot be found in manager', () => {
      mockEntityManager.getEntitiesInLocation.mockReturnValueOnce(
        new Set(['npc1', 'nonexistent'])
      );
      const context = {
        currentLocation: location,
        entityManager: mockEntityManager,
      };

      const result = getEntityIdsForScopes('location_non_items', context);
      expect(result).toEqual(new Set(['npc1']));
    });
  });

  describe('Scope: nearby', () => {
    test('should return a combination of inventory and location entities', () => {
      const actingEntity = createMockEntity('player', {
        [INVENTORY_COMPONENT_ID]: { items: ['inv_item'] },
        'core:position': { locationId: 'loc1' },
      });
      const location = createMockEntity('loc1');
      const locItem = createMockEntity('loc_item', {
        'core:position': { locationId: 'loc1' },
      });

      mockEntityManager.addEntity(actingEntity);
      mockEntityManager.addEntity(locItem);

      const context = {
        actingEntity,
        currentLocation: location,
        entityManager: mockEntityManager,
      };
      const result = getEntityIdsForScopes('nearby', context);

      expect(result).toEqual(new Set(['inv_item', 'loc_item']));
    });
  });

  describe('Scope: nearby_including_blockers', () => {
    let actingEntity, location, blockerEntity;

    beforeEach(() => {
      actingEntity = createMockEntity('player', {
        [INVENTORY_COMPONENT_ID]: { items: ['inv_item'] },
      });
      location = createMockEntity('loc1', {
        [EXITS_COMPONENT_ID]: [
          { dir: 'north', to: 'loc2', blocker: 'boulder' },
          { dir: 'south', to: 'loc3' },
        ],
      });
      blockerEntity = createMockEntity('boulder');
    });

    test('should include nearby items and exit blockers', () => {
      mockEntityManager.addEntity(blockerEntity);
      const context = {
        actingEntity,
        currentLocation: location,
        entityManager: mockEntityManager,
      };
      const result = getEntityIdsForScopes(
        'nearby_including_blockers',
        context
      );
      expect(result).toEqual(new Set(['inv_item', 'boulder']));
    });
  });
});
