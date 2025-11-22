/**
 * @file Unit tests for IsHungryOperator
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { IsHungryOperator } from '../../../../src/logic/operators/isHungryOperator.js';

describe('IsHungryOperator', () => {
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

    operator = new IsHungryOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(operator).toBeDefined();
    });

    it('should throw error if entityManager is missing', () => {
      expect(() => {
        new IsHungryOperator({ logger: mockLogger });
      }).toThrow('IsHungryOperator: Missing required dependencies');
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new IsHungryOperator({ entityManager: mockEntityManager });
      }).toThrow('IsHungryOperator: Missing required dependencies');
    });
  });

  describe('Hungry States', () => {
    it('should return true for hungry state', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'hungry',
        energyPercentage: 25,
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'metabolism:hunger_state'
      );
    });

    it('should return true for starving state', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'starving',
        energyPercentage: 5,
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(true);
    });

    it('should return true for critical state', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'critical',
        energyPercentage: 0,
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(true);
    });
  });

  describe('Non-Hungry States', () => {
    it('should return false for satiated state', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'satiated',
        energyPercentage: 90,
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(false);
    });

    it('should return false for neutral state', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'neutral',
        energyPercentage: 50,
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(false);
    });

    it('should return false for gluttonous state', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'gluttonous',
        energyPercentage: 120,
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(false);
    });
  });

  describe('Missing Component', () => {
    it('should return false when entity missing hunger_state', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('missing metabolism:hunger_state')
      );
    });

    it('should return false when component data is undefined', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue(undefined);

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(false);
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

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'hungry',
        energyPercentage: 20,
      });

      const result = operator.evaluate([{ var: 'event.payload.entityId' }], context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'npc_1',
        'metabolism:hunger_state'
      );
    });

    it('should handle "self" reference', () => {
      const context = { self: 'actor_1' };

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'starving',
        energyPercentage: 8,
      });

      const result = operator.evaluate(['self'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'metabolism:hunger_state'
      );
    });

    it('should resolve entity object with id', () => {
      const entity = { id: 'actor_1' };
      const context = { entity };

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'hungry',
        energyPercentage: 15,
      });

      const result = operator.evaluate([entity], context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'metabolism:hunger_state'
      );
    });

    it('should handle direct entity ID strings', () => {
      const context = {};

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'critical',
        energyPercentage: 0,
      });

      const result = operator.evaluate(['entity_123'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'entity_123',
        'metabolism:hunger_state'
      );
    });

    it('should resolve nested entity paths like entity.target', () => {
      const target = { id: 'target_1' };
      const entity = { target };
      const context = { entity };

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'starving',
        energyPercentage: 3,
      });

      const result = operator.evaluate(['entity.target'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'target_1',
        'metabolism:hunger_state'
      );
    });
  });

  describe('Error Handling', () => {
    it('should return false for invalid parameter count (no parameters)', () => {
      const context = {};

      const result = operator.evaluate([], context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return false for invalid parameter count (too many)', () => {
      const context = {};

      const result = operator.evaluate(['actor', 'extra_param'], context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return false for null parameters', () => {
      const context = {};

      const result = operator.evaluate(null, context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return false when entity path does not exist in context', () => {
      const context = {};

      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['nonexistent'], context);

      expect(result).toBe(false);
      // Entity ID treated as direct string, component check returns null
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('missing metabolism:hunger_state')
      );
    });

    it('should return false for invalid entity path type (number)', () => {
      const context = {};

      const result = operator.evaluate([123], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityPath type')
      );
    });

    it('should return false for invalid entity path type (boolean)', () => {
      const context = {};

      const result = operator.evaluate([true], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityPath type')
      );
    });

    it('should return false when entity resolution produces null', () => {
      const context = { actor: null };

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No entity found at path')
      );
    });

    it('should return false when entity resolution produces empty string', () => {
      const context = { actor: { id: '' } };

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entity ID')
      );
    });

    it('should handle errors from getComponentData gracefully', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during evaluation'),
        expect.any(Error)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle entity with invalid hunger state value', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'unknown_state',
        energyPercentage: 50,
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(false);
    });

    it('should handle hunger state with extra properties', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'hungry',
        energyPercentage: 20,
        turnsInState: 5,
        starvationDamage: 0,
        extraProperty: 'ignored',
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(true);
    });

    it('should handle hunger state missing energyPercentage', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'starving',
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(true);
    });
  });

  describe('Logging', () => {
    it('should log debug message for successful hungry check', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'hungry',
        energyPercentage: 25,
      });

      operator.evaluate(['actor'], context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('hunger check: state=hungry, isHungry=true')
      );
    });

    it('should log debug message for successful non-hungry check', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        state: 'neutral',
        energyPercentage: 50,
      });

      operator.evaluate(['actor'], context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('hunger check: state=neutral, isHungry=false')
      );
    });
  });
});
