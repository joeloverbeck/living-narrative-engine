/**
 * @file Unit tests for HasFreeGrabbingAppendagesOperator
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
import { HasFreeGrabbingAppendagesOperator } from '../../../../src/logic/operators/hasFreeGrabbingAppendagesOperator.js';
import * as grabbingUtils from '../../../../src/utils/grabbingUtils.js';

// Mock the grabbingUtils module
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn(),
}));

describe('HasFreeGrabbingAppendagesOperator', () => {
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

    operator = new HasFreeGrabbingAppendagesOperator({
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
        new HasFreeGrabbingAppendagesOperator({ logger: mockLogger });
      }).toThrow(
        'HasFreeGrabbingAppendagesOperator: Missing required dependencies'
      );
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new HasFreeGrabbingAppendagesOperator({
          entityManager: mockEntityManager,
        });
      }).toThrow(
        'HasFreeGrabbingAppendagesOperator: Missing required dependencies'
      );
    });

    it('should throw error if both dependencies are missing', () => {
      expect(() => {
        new HasFreeGrabbingAppendagesOperator({});
      }).toThrow(
        'HasFreeGrabbingAppendagesOperator: Missing required dependencies'
      );
    });
  });

  describe('Sufficient Free Appendages', () => {
    it('should return true when entity has enough free appendages', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate(['actor', 2], context);

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1'
      );
    });

    it('should return true when entity has more than required', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(4);

      const result = operator.evaluate(['actor', 2], context);

      expect(result).toBe(true);
    });

    it('should return true when entity has exactly 1 free appendage with default requiredCount', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(1);

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(true);
    });
  });

  describe('Insufficient Free Appendages', () => {
    it('should return false when entity has fewer free appendages than required', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(1);

      const result = operator.evaluate(['actor', 2], context);

      expect(result).toBe(false);
    });

    it('should return false when entity has zero free appendages', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(0);

      const result = operator.evaluate(['actor', 1], context);

      expect(result).toBe(false);
    });

    it('should return false when entity has no grabbing appendages at all', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(0);

      const result = operator.evaluate(['actor', 2], context);

      expect(result).toBe(false);
    });
  });

  describe('Default RequiredCount', () => {
    it('should default requiredCount to 1 when not provided', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(1);

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(true);
    });

    it('should return false with default when entity has 0 appendages', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(0);

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(false);
    });

    it('should handle non-numeric requiredCount by defaulting to 1', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(1);

      const result = operator.evaluate(['actor', 'invalid'], context);

      expect(result).toBe(true);
    });
  });

  describe('Entity Reference Resolution', () => {
    it('should resolve entity reference from context', () => {
      const context = {
        event: {
          payload: { entityId: 'npc_1' },
        },
        npc_1: { id: 'npc_1' },
      };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate(
        [{ var: 'event.payload.entityId' }, 2],
        context
      );

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'npc_1'
      );
    });

    it('should handle "self" reference', () => {
      const context = { self: 'actor_1' };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate(['self', 1], context);

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1'
      );
    });

    it('should resolve entity object with id', () => {
      const entity = { id: 'actor_1' };
      const context = { entity };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate([entity, 2], context);

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1'
      );
    });

    it('should handle direct entity ID strings', () => {
      const context = {};
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(3);

      const result = operator.evaluate(['entity_123', 2], context);

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'entity_123'
      );
    });

    it('should resolve nested entity paths like entity.target', () => {
      const target = { id: 'target_1' };
      const entity = { target };
      const context = { entity };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate(['entity.target', 1], context);

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'target_1'
      );
    });

    it('should handle target path resolution', () => {
      const context = { target: { id: 'target_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate(['target', 2], context);

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'target_1'
      );
    });
  });

  describe('Error Handling', () => {
    it('should return false for no parameters', () => {
      const context = {};

      const result = operator.evaluate([], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return false for null parameters', () => {
      const context = {};

      const result = operator.evaluate(null, context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return false for undefined parameters', () => {
      const context = {};

      const result = operator.evaluate(undefined, context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return false when entity path does not exist in context', () => {
      const context = {};
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(0);

      // Context path that doesn't exist - treated as entity ID
      const result = operator.evaluate(['nonexistent_id', 1], context);

      // Entity ID resolution succeeded but no appendages
      expect(result).toBe(false);
    });

    it('should return false for invalid entity path type (number)', () => {
      const context = {};

      const result = operator.evaluate([123, 1], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityPath type')
      );
    });

    it('should return false for invalid entity path type (boolean)', () => {
      const context = {};

      const result = operator.evaluate([true, 1], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityPath type')
      );
    });

    it('should return false when entity resolution produces null', () => {
      const context = { actor: null };

      const result = operator.evaluate(['actor', 1], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No entity found at path')
      );
    });

    it('should return false when entity resolution produces empty string', () => {
      const context = { actor: { id: '' } };

      const result = operator.evaluate(['actor', 1], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entity ID')
      );
    });

    it('should handle errors from countFreeGrabbingAppendages gracefully', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockImplementation(() => {
        throw new Error('Component access error');
      });

      const result = operator.evaluate(['actor', 1], context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during evaluation'),
        expect.any(Error)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero required count', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(0);

      const result = operator.evaluate(['actor', 0], context);

      expect(result).toBe(true);
    });

    it('should handle large required count', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate(['actor', 100], context);

      expect(result).toBe(false);
    });

    it('should handle fractional required count by treating as number', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      // 2.5 should require more than 2 free appendages
      const result = operator.evaluate(['actor', 2.5], context);

      expect(result).toBe(false);
    });

    it('should handle negative required count', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(0);

      // 0 >= -1 is true
      const result = operator.evaluate(['actor', -1], context);

      expect(result).toBe(true);
    });
  });

  describe('Logging', () => {
    it('should log debug message for successful check with enough appendages', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      operator.evaluate(['actor', 2], context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'has 2 free grabbing appendages, required 2, result=true'
        )
      );
    });

    it('should log debug message for insufficient appendages', () => {
      const context = { actor: { id: 'actor_1' } };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(1);

      operator.evaluate(['actor', 2], context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'has 1 free grabbing appendages, required 2, result=false'
        )
      );
    });
  });

  describe('Integration with JSON Logic context patterns', () => {
    it('should work with typical action condition context', () => {
      const context = {
        actor: { id: 'player_1' },
        target: { id: 'npc_1' },
        location: { id: 'room_1' },
      };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate(['actor', 1], context);

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'player_1'
      );
    });

    it('should work with targets context pattern', () => {
      const context = {
        actor: { id: 'player_1' },
        targets: [{ id: 'item_1' }, { id: 'item_2' }],
      };
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = operator.evaluate(['actor', 2], context);

      expect(result).toBe(true);
    });
  });
});
