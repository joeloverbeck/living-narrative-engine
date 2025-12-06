/**
 * @file Unit tests for CanActorGrabItemOperator
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
import { CanActorGrabItemOperator } from '../../../../src/logic/operators/canActorGrabItemOperator.js';
import * as grabbingUtils from '../../../../src/utils/grabbingUtils.js';

// Mock the grabbingUtils module
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn(),
}));

describe('CanActorGrabItemOperator', () => {
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
    grabbingUtils.countFreeGrabbingAppendages.mockReset();

    operator = new CanActorGrabItemOperator({
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
        new CanActorGrabItemOperator({ logger: mockLogger });
      }).toThrow('CanActorGrabItemOperator: Missing required dependencies');
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new CanActorGrabItemOperator({ entityManager: mockEntityManager });
      }).toThrow('CanActorGrabItemOperator: Missing required dependencies');
    });

    it('should throw error if both dependencies are missing', () => {
      expect(() => {
        new CanActorGrabItemOperator({});
      }).toThrow('CanActorGrabItemOperator: Missing required dependencies');
    });
  });

  describe('Basic Functionality', () => {
    it('should return true when actor has enough free appendages for item', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'sword_1' } };
      // Item requires 2 hands
      mockEntityManager.getComponentData.mockReturnValue({ handsRequired: 2 });
      // Actor has 2 free hands
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'sword_1',
        'anatomy:requires_grabbing'
      );
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1'
      );
    });

    it('should return false when actor lacks sufficient free appendages', () => {
      const context = {
        actor: { id: 'actor_1' },
        entity: { id: 'longsword_1' },
      };
      // Item requires 2 hands
      mockEntityManager.getComponentData.mockReturnValue({ handsRequired: 2 });
      // Actor has only 1 free hand
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(1);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(false);
    });

    it('should default to requiring 1 hand when item lacks requires_grabbing component', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'dagger_1' } };
      // Item has no requires_grabbing component
      mockEntityManager.getComponentData.mockReturnValue(null);
      // Actor has 1 free hand
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(1);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(true);
    });

    it('should return true when handsRequired is 0 (rings, etc.)', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'ring_1' } };
      // Item requires 0 hands
      mockEntityManager.getComponentData.mockReturnValue({ handsRequired: 0 });
      // Actor has 0 free hands (doesn't matter)
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(0);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(true);
      // Should not even call countFreeGrabbingAppendages when handsRequired is 0
      expect(grabbingUtils.countFreeGrabbingAppendages).not.toHaveBeenCalled();
    });
  });

  describe('Parameter Resolution', () => {
    it('should resolve actor from string path (e.g., "actor")', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'item_1' } };
      mockEntityManager.getComponentData.mockReturnValue({ handsRequired: 1 });
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(1);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
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
      mockEntityManager.getComponentData.mockReturnValue({ handsRequired: 1 });
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate(
        [{ var: 'event.payload.actorId' }, 'entity'],
        context
      );

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1'
      );
    });

    it('should resolve actor from entity object with id property', () => {
      const actorObj = { id: 'actor_1' };
      const itemObj = { id: 'item_1' };
      const context = {};
      mockEntityManager.getComponentData.mockReturnValue({ handsRequired: 1 });
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate([actorObj, itemObj], context);

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1'
      );
    });

    it('should resolve item from "entity" path in filter context', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'weapon_1' } };
      mockEntityManager.getComponentData.mockReturnValue({ handsRequired: 1 });
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'weapon_1',
        'anatomy:requires_grabbing'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should return false when actor has no anatomy:body component', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'item_1' } };
      mockEntityManager.getComponentData.mockReturnValue({ handsRequired: 1 });
      // Actor has 0 free appendages (no body)
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(0);

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
      mockEntityManager.getComponentData.mockReturnValue({ handsRequired: 2 });
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(3);

      operator.evaluate(['actor', 'entity'], context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'has 3 free grabbing appendages, item item_1 requires 2, result=true'
        )
      );
    });

    it('should log debug message when handsRequired is 0', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'ring_1' } };
      mockEntityManager.getComponentData.mockReturnValue({ handsRequired: 0 });

      operator.evaluate(['actor', 'entity'], context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('requires 0 hands, returning true')
      );
    });
  });

  describe('Error Handling', () => {
    it('should catch and log errors during evaluation', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'item_1' } };
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Component access error');
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
      mockEntityManager.getComponentData.mockReturnValue({ handsRequired: 1 });
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate(['actor', 'entity.target'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'weapon_1',
        'anatomy:requires_grabbing'
      );
    });

    it('should handle direct entity ID strings', () => {
      const context = {};
      mockEntityManager.getComponentData.mockReturnValue({ handsRequired: 1 });
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate(['actor_123', 'item_456'], context);

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_123'
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'item_456',
        'anatomy:requires_grabbing'
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
      mockEntityManager.getComponentData.mockReturnValue({ handsRequired: 1 });
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'player_1'
      );
    });

    it('should work with filter context (entity as current item)', () => {
      const context = {
        actor: { id: 'player_1' },
        entity: { id: 'longsword_1' },
      };
      mockEntityManager.getComponentData.mockReturnValue({ handsRequired: 2 });
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(true);
    });
  });

  describe('Default handsRequired behavior', () => {
    it('should default to 1 when requires_grabbing component returns undefined', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'item_1' } };
      mockEntityManager.getComponentData.mockReturnValue(undefined);
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(1);

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(true);
    });

    it('should default to 1 when requires_grabbing has no handsRequired property', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: 'item_1' } };
      mockEntityManager.getComponentData.mockReturnValue({});
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(1);

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
        expect.stringContaining('Invalid actor ID')
      );
    });

    it('should return false when item entity has empty string id', () => {
      const context = { actor: { id: 'actor_1' }, entity: { id: '' } };

      const result = operator.evaluate(['actor', 'entity'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid item ID')
      );
    });

    it('should return false when actor path type is invalid (boolean)', () => {
      const context = { entity: { id: 'item_1' } };

      const result = operator.evaluate([true, 'entity'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid actor path type')
      );
    });

    it('should return false when item path type is invalid (number)', () => {
      const context = { actor: { id: 'actor_1' } };

      const result = operator.evaluate(['actor', 123], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid item path type')
      );
    });
  });
});
