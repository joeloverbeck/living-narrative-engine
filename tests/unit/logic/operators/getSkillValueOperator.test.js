/**
 * @file Unit tests for GetSkillValueOperator
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
import { GetSkillValueOperator } from '../../../../src/logic/operators/getSkillValueOperator.js';

describe('GetSkillValueOperator', () => {
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

    operator = new GetSkillValueOperator({
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
        new GetSkillValueOperator({ logger: mockLogger });
      }).toThrow('GetSkillValueOperator: Missing required dependencies');
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new GetSkillValueOperator({ entityManager: mockEntityManager });
      }).toThrow('GetSkillValueOperator: Missing required dependencies');
    });

    it('should throw error if both dependencies are missing', () => {
      expect(() => {
        new GetSkillValueOperator({});
      }).toThrow('GetSkillValueOperator: Missing required dependencies');
    });
  });

  describe('Basic Retrieval', () => {
    it('should return skill value when component exists', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue({ value: 75 });

      const result = operator.evaluate(
        ['actor', 'skills:melee_skill', 'value', 0],
        context
      );

      expect(result).toBe(75);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'skills:melee_skill'
      );
    });

    it('should return default when component missing', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(
        ['actor', 'skills:melee_skill', 'value', 10],
        context
      );

      expect(result).toBe(10);
    });

    it('should return default when entity not found', () => {
      const context = {};
      mockEntityManager.getComponentData.mockReturnValue({ value: 50 });

      // actor path doesn't exist in context
      const result = operator.evaluate(
        ['actor', 'skills:melee_skill', 'value', 25],
        context
      );

      expect(result).toBe(25);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No entity found at path')
      );
    });

    it('should handle nested property paths', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue({
        stats: {
          strength: 80,
          dexterity: 60,
        },
      });

      const result = operator.evaluate(
        ['actor', 'skills:combat', 'stats.strength', 0],
        context
      );

      expect(result).toBe(80);
    });
  });

  describe('Default Values', () => {
    it('should default propertyPath to "value" when not provided', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue({ value: 42 });

      const result = operator.evaluate(
        ['actor', 'skills:melee_skill'],
        context
      );

      expect(result).toBe(42);
    });

    it('should default defaultValue to 0 when not provided', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(
        ['actor', 'skills:melee_skill', 'value'],
        context
      );

      expect(result).toBe(0);
    });

    it('should use custom default value when component missing', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(
        ['actor', 'skills:melee_skill', 'value', 50],
        context
      );

      expect(result).toBe(50);
    });

    it('should return default when property path not found in component', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue({ other: 100 });

      const result = operator.evaluate(
        ['actor', 'skills:melee_skill', 'nonexistent', 15],
        context
      );

      expect(result).toBe(15);
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
      mockEntityManager.getComponentData.mockReturnValue({ value: 65 });

      const result = operator.evaluate(
        [{ var: 'event.payload.entityId' }, 'skills:melee_skill', 'value', 0],
        context
      );

      expect(result).toBe(65);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'npc_1',
        'skills:melee_skill'
      );
    });

    it('should handle "self" reference', () => {
      const context = { self: 'actor_1' };
      mockEntityManager.getComponentData.mockReturnValue({ value: 55 });

      const result = operator.evaluate(
        ['self', 'skills:melee_skill', 'value', 0],
        context
      );

      expect(result).toBe(55);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'skills:melee_skill'
      );
    });

    it('should resolve entity object with id', () => {
      const entity = { id: 'actor_1' };
      const context = { entity };
      mockEntityManager.getComponentData.mockReturnValue({ value: 70 });

      const result = operator.evaluate(
        [entity, 'skills:melee_skill', 'value', 0],
        context
      );

      expect(result).toBe(70);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'skills:melee_skill'
      );
    });

    it('should handle direct entity ID strings', () => {
      const context = {};
      mockEntityManager.getComponentData.mockReturnValue({ value: 85 });

      const result = operator.evaluate(
        ['entity_123', 'skills:melee_skill', 'value', 0],
        context
      );

      expect(result).toBe(85);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'entity_123',
        'skills:melee_skill'
      );
    });

    it('should resolve nested entity paths like entity.target', () => {
      const target = { id: 'target_1' };
      const entity = { target };
      const context = { entity };
      mockEntityManager.getComponentData.mockReturnValue({ value: 45 });

      const result = operator.evaluate(
        ['entity.target', 'skills:defense_skill', 'value', 0],
        context
      );

      expect(result).toBe(45);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'target_1',
        'skills:defense_skill'
      );
    });

    it('should handle target path resolution', () => {
      const context = { target: { id: 'target_1' } };
      mockEntityManager.getComponentData.mockReturnValue({ value: 60 });

      const result = operator.evaluate(
        ['target', 'skills:defense_skill', 'value', 0],
        context
      );

      expect(result).toBe(60);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'target_1',
        'skills:defense_skill'
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 0 for no parameters', () => {
      const context = {};

      const result = operator.evaluate([], context);

      expect(result).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return 0 for null parameters', () => {
      const context = {};

      const result = operator.evaluate(null, context);

      expect(result).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return 0 for undefined parameters', () => {
      const context = {};

      const result = operator.evaluate(undefined, context);

      expect(result).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return default when entity path does not exist in context', () => {
      const context = {};
      mockEntityManager.getComponentData.mockReturnValue({ value: 50 });

      // Using only one param (entityPath) returns 0 because componentId is missing
      const result = operator.evaluate(['nonexistent_path'], context);

      expect(result).toBe(0);
    });

    it('should return default for invalid entity path type (number)', () => {
      const context = {};

      const result = operator.evaluate(
        [123, 'skills:melee_skill', 'value', 20],
        context
      );

      expect(result).toBe(20);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityPath type')
      );
    });

    it('should return default for invalid entity path type (boolean)', () => {
      const context = {};

      const result = operator.evaluate(
        [true, 'skills:melee_skill', 'value', 30],
        context
      );

      expect(result).toBe(30);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityPath type')
      );
    });

    it('should return default when entity resolution produces null', () => {
      const context = { actor: null };

      const result = operator.evaluate(
        ['actor', 'skills:melee_skill', 'value', 40],
        context
      );

      expect(result).toBe(40);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No entity found at path')
      );
    });

    it('should return default when entity resolution produces empty string', () => {
      const context = { actor: { id: '' } };

      const result = operator.evaluate(
        ['actor', 'skills:melee_skill', 'value', 35],
        context
      );

      expect(result).toBe(35);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entity ID')
      );
    });

    it('should handle exceptions gracefully and return 0', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Component access error');
      });

      const result = operator.evaluate(
        ['actor', 'skills:melee_skill', 'value', 50],
        context
      );

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during evaluation'),
        expect.any(Error)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should return 0 when skill value is 0 (not the default)', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue({ value: 0 });

      const result = operator.evaluate(
        ['actor', 'skills:melee_skill', 'value', 50],
        context
      );

      expect(result).toBe(0);
    });

    it('should handle large skill values correctly', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue({ value: 999999 });

      const result = operator.evaluate(
        ['actor', 'skills:melee_skill', 'value', 0],
        context
      );

      expect(result).toBe(999999);
    });

    it('should handle negative skill values correctly', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue({ value: -10 });

      const result = operator.evaluate(
        ['actor', 'skills:melee_skill', 'value', 0],
        context
      );

      expect(result).toBe(-10);
    });

    it('should handle empty string property path by returning default', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue({ value: 100 });

      const result = operator.evaluate(
        ['actor', 'skills:melee_skill', '', 25],
        context
      );

      expect(result).toBe(25);
    });

    it('should handle whitespace-only entityId', () => {
      const context = { actor: { id: '   ' } };

      const result = operator.evaluate(
        ['actor', 'skills:melee_skill', 'value', 55],
        context
      );

      expect(result).toBe(55);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entity ID')
      );
    });

    it('should handle component data with only the specified nested path', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue({
        deep: {
          nested: {
            value: 123,
          },
        },
      });

      const result = operator.evaluate(
        ['actor', 'skills:complex', 'deep.nested.value', 0],
        context
      );

      expect(result).toBe(123);
    });
  });

  describe('Logging', () => {
    it('should log debug message for successful skill retrieval', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue({ value: 75 });

      operator.evaluate(['actor', 'skills:melee_skill', 'value', 0], context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Entity actor_1, component skills:melee_skill, path value = 75'
        )
      );
    });

    it('should log debug message when component not found', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue(null);

      operator.evaluate(['actor', 'skills:melee_skill', 'value', 20], context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Component skills:melee_skill not found on entity actor_1, returning default 20'
        )
      );
    });

    it('should log error for exceptions during evaluation', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Test error');
      });

      operator.evaluate(['actor', 'skills:melee_skill', 'value', 0], context);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during evaluation'),
        expect.any(Error)
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
      mockEntityManager.getComponentData.mockReturnValue({ value: 80 });

      const result = operator.evaluate(
        ['actor', 'skills:melee_skill', 'value', 0],
        context
      );

      expect(result).toBe(80);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'player_1',
        'skills:melee_skill'
      );
    });

    it('should work with targets array context pattern', () => {
      const context = {
        actor: { id: 'player_1' },
        targets: [{ id: 'enemy_1' }, { id: 'enemy_2' }],
      };
      mockEntityManager.getComponentData.mockReturnValue({ value: 65 });

      const result = operator.evaluate(
        ['actor', 'skills:defense_skill', 'value', 0],
        context
      );

      expect(result).toBe(65);
    });

    it('should work in comparison operation pattern (skill >= threshold)', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue({ value: 75 });

      const skillValue = operator.evaluate(
        ['actor', 'skills:melee_skill', 'value', 0],
        context
      );

      // Simulates { ">=": [{ "getSkillValue": [...] }, 50] }
      expect(skillValue >= 50).toBe(true);
    });

    it('should work in arithmetic operation pattern (skill + modifier)', () => {
      const context = { actor: { id: 'actor_1' } };
      mockEntityManager.getComponentData.mockReturnValue({ value: 60 });

      const skillValue = operator.evaluate(
        ['actor', 'skills:melee_skill', 'value', 0],
        context
      );

      // Simulates { "+": [{ "getSkillValue": [...] }, 10] }
      expect(skillValue + 10).toBe(70);
    });
  });
});
