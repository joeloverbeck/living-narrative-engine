/**
 * @file Unit tests for IsItemBeingGrabbedOperator
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { IsItemBeingGrabbedOperator } from '../../../../src/logic/operators/isItemBeingGrabbedOperator.js';
import * as grabbingUtils from '../../../../src/utils/grabbingUtils.js';

// Mock the grabbingUtils module
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  getHeldItems: jest.fn(),
}));

describe('IsItemBeingGrabbedOperator', () => {
  let testBed;
  let operator;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEntityManager = testBed.createMock('entityManager', [
      'getComponentData',
    ]);

    // Reset the mock
    grabbingUtils.getHeldItems.mockReset();

    operator = new IsItemBeingGrabbedOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(operator).toBeDefined();
    });

    it('should throw error if entityManager is missing', () => {
      expect(() => {
        new IsItemBeingGrabbedOperator({ logger: mockLogger });
      }).toThrow('IsItemBeingGrabbedOperator: Missing required dependencies');
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new IsItemBeingGrabbedOperator({ entityManager: mockEntityManager });
      }).toThrow('IsItemBeingGrabbedOperator: Missing required dependencies');
    });

    it('should throw error if both dependencies are missing', () => {
      expect(() => {
        new IsItemBeingGrabbedOperator({});
      }).toThrow('IsItemBeingGrabbedOperator: Missing required dependencies');
    });
  });

  describe('Basic Functionality', () => {
    it('should return true when item is being held by actor', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'sword_1' } };
      // Actor is holding the sword
      grabbingUtils.getHeldItems.mockReturnValue([
        { partId: 'actor_1:right_hand', itemId: 'sword_1' },
      ]);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(true);
      expect(grabbingUtils.getHeldItems).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1'
      );
    });

    it('should return false when item is not being held by actor', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'sword_1' } };
      // Actor is holding a different item
      grabbingUtils.getHeldItems.mockReturnValue([
        { partId: 'actor_1:right_hand', itemId: 'shield_1' },
      ]);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(false);
    });

    it('should return false when actor holds no items', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'sword_1' } };
      // Actor is not holding anything
      grabbingUtils.getHeldItems.mockReturnValue([]);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(false);
    });

    it('should return true when actor holds multiple items including the target', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'dagger_1' } };
      // Actor is holding multiple items
      grabbingUtils.getHeldItems.mockReturnValue([
        { partId: 'actor_1:left_hand', itemId: 'torch_1' },
        { partId: 'actor_1:right_hand', itemId: 'dagger_1' },
      ]);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(true);
    });
  });

  describe('Parameter Resolution', () => {
    it('should resolve actor from string path (e.g., "actor")', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'item_1' } };
      grabbingUtils.getHeldItems.mockReturnValue([
        { partId: 'actor_1:hand', itemId: 'item_1' },
      ]);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(true);
      expect(grabbingUtils.getHeldItems).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1'
      );
    });

    it('should resolve actor from JSON Logic expression', () => {
      const context = {
        event: { payload: { actorId: 'actor_1' } },
        actor_1: { id: 'actor_1' },
        entity: { id: 'item_1' },
      };
      grabbingUtils.getHeldItems.mockReturnValue([
        { partId: 'actor_1:hand', itemId: 'item_1' },
      ]);

      const result = operator.evaluate(
        [{ var: 'event.payload.actorId' }, 'entity'],
        context
      );

      expect(result).toBe(true);
      expect(grabbingUtils.getHeldItems).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1'
      );
    });

    it('should resolve actor from entity object with id property', () => {
      const actorObj = { id: 'actor_1' };
      const itemObj = { id: 'item_1' };
      const context = {};
      grabbingUtils.getHeldItems.mockReturnValue([
        { partId: 'actor_1:hand', itemId: 'item_1' },
      ]);

      const result = operator.evaluate([actorObj, itemObj], context);

      expect(result).toBe(true);
      expect(grabbingUtils.getHeldItems).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1'
      );
    });

    it('should resolve item from "entity" path in filter context', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'weapon_1' } };
      grabbingUtils.getHeldItems.mockReturnValue([
        { partId: 'actor_1:hand', itemId: 'weapon_1' },
      ]);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(true);
      expect(grabbingUtils.getHeldItems).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should return false when actor has no grabbing appendages', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'item_1' } };
      // getHeldItems returns empty array when no grabbing appendages
      grabbingUtils.getHeldItems.mockReturnValue([]);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(false);
    });

    it('should return false when params are missing', () => {
      const context = { actor: { id: 'actor_1' } };

      const result = operator.evaluate([], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return false when params is not an array', () => {
      const context = { actor: { id: 'actor_1' } };

      const result = operator.evaluate('invalid', context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return false when params is null', () => {
      const context = { actor: { id: 'actor_1' } };

      const result = operator.evaluate(null, context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return false when params is undefined', () => {
      const context = { actor: { id: 'actor_1' } };

      const result = operator.evaluate(undefined, context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return false when actor cannot be resolved', () => {
      const context = { entity: { id: 'item_1' } };

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No actor entity found at path')
      );
    });

    it('should return false when item cannot be resolved', () => {
      const context = { actor: { id: 'actor_1' } };

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No item entity found at path')
      );
    });

    it('should return false when only one parameter is provided', () => {
      const context = { actor: { id: 'actor_1' } };

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });
  });

  describe('Logging', () => {
    it('should log warning when parameters are invalid', () => {
      const context = {};

      operator.evaluate(null, context);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should log debug message with evaluation result', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'item_1' } };
      grabbingUtils.getHeldItems.mockReturnValue([
        { partId: 'actor_1:hand', itemId: 'item_1' },
      ]);

      operator.evaluate(['actor', 'entity'], context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Actor actor_1 holds 1 items, checking for item item_1, result=true'
        )
      );
    });

    it('should log debug message when item is not held', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'item_1' } };
      grabbingUtils.getHeldItems.mockReturnValue([]);

      operator.evaluate(['actor', 'entity'], context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Actor actor_1 holds 0 items, checking for item item_1, result=false'
        )
      );
    });
  });

  describe('Error Handling', () => {
    it('should catch and log errors during evaluation', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'item_1' } };
      grabbingUtils.getHeldItems.mockImplementation(() => {
        throw new Error('Grabbing utils error');
      });

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during evaluation'),
        expect.any(Error)
      );
    });
  });

  describe('Complex Path Resolution', () => {
    it('should handle nested entity paths like entity.target', () => {
      const target = { id: 'weapon_1' };
      const context = { actor: { id: 'actor_1' }, entity: { target } };
      grabbingUtils.getHeldItems.mockReturnValue([
        { partId: 'actor_1:hand', itemId: 'weapon_1' },
      ]);

      const result = operator.evaluate(['actor', 'entity.target'], context);

      expect(result).toBe(true);
    });

    it('should handle direct entity ID strings', () => {
      const context = {};
      grabbingUtils.getHeldItems.mockReturnValue([
        { partId: 'actor_123:hand', itemId: 'item_456' },
      ]);

      const result = operator.evaluate(['actor_123', 'item_456'], context);

      expect(result).toBe(true);
      expect(grabbingUtils.getHeldItems).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_123'
      );
    });
  });

  describe('Integration with JSON Logic context patterns', () => {
    it('should work with typical action condition context', () => {
      const context = {
        actor: { id: 'player_1' },
        target: { id: 'npc_1' },
        entity: { id: 'sword_1' },
        location: { id: 'room_1' },
      };
      grabbingUtils.getHeldItems.mockReturnValue([
        { partId: 'player_1:hand', itemId: 'sword_1' },
      ]);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(true);
      expect(grabbingUtils.getHeldItems).toHaveBeenCalledWith(
        mockEntityManager,
        'player_1'
      );
    });

    it('should work with filter context (entity as current item)', () => {
      const context = {
        actor: { id: 'player_1' },
        entity: { id: 'longsword_1' },
      };
      grabbingUtils.getHeldItems.mockReturnValue([
        { partId: 'player_1:hand', itemId: 'longsword_1' },
      ]);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(true);
    });
  });

  describe('Invalid Entity ID Edge Cases', () => {
    it('should return false when actor entity has empty string id', () => {
      const context = { actor: { id: '' }, entity: { id: 'item_1' } };

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid actor entity ID')
      );
    });

    it('should return false when item entity has empty string id', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: '' } };

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid item entity ID')
      );
    });

    it('should return false when actor path type is invalid (boolean)', () => {
      const context = { entity: { id: 'item_1' } };

      const result = operator.evaluate([true, 'entity'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid actor parameter type')
      );
    });

    it('should return false when item path type is invalid (number)', () => {
      const context = { actor: { id: 'actor_1' } };

      const result = operator.evaluate(['actor', 123], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid item parameter type')
      );
    });

    it('should return false when actor entity has null id', () => {
      const context = { actor: { id: null }, entity: { id: 'item_1' } };

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(false);
    });

    it('should return false when item entity has undefined id', () => {
      const context = { actor: { id: 'actor_1' }, entity: {} };

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(false);
    });
  });

  describe('State Immutability', () => {
    it('should not modify entity state', () => {
      const actor = { id: 'actor_1', name: 'Test Actor' };
      const entity = { id: 'sword_1', name: 'Test Sword' };
      const context = { actor, entity };
      const originalActorState = JSON.stringify(actor);
      const originalEntityState = JSON.stringify(entity);

      grabbingUtils.getHeldItems.mockReturnValue([]);

      operator.evaluate(['actor', 'entity'], context);

      expect(JSON.stringify(actor)).toBe(originalActorState);
      expect(JSON.stringify(entity)).toBe(originalEntityState);
    });
  });
});
