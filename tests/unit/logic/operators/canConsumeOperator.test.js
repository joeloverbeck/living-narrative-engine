/**
 * @file Unit tests for CanConsumeOperator
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { CanConsumeOperator } from '../../../../src/logic/operators/canConsumeOperator.js';

describe('CanConsumeOperator', () => {
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

    operator = new CanConsumeOperator({
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
        new CanConsumeOperator({ logger: mockLogger });
      }).toThrow('CanConsumeOperator: Missing required dependencies');
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new CanConsumeOperator({ entityManager: mockEntityManager });
      }).toThrow('CanConsumeOperator: Missing required dependencies');
    });
  });

  describe('Successful Consumption Validation', () => {
    it('should return true when all conditions are met', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'bread_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // fuel_converter
          capacity: 100,
          efficiency: 0.8,
          accepted_fuel_tags: ['organic', 'solid'],
        })
        .mockReturnValueOnce({
          // metabolic_store
          current_energy: 500,
          buffer_storage: [{ bulk: 30, energy_content: 150 }],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          // fuel_source
          energy_content: 200,
          bulk: 20,
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(true);
    });

    it('should return true when item has multiple matching fuel tags', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic', 'liquid'],
        })
        .mockReturnValueOnce({
          buffer_storage: [],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 10,
          fuel_tags: ['organic', 'liquid'],
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(true);
    });

    it('should return true with empty buffer and available capacity', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 50,
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(true);
    });

    it('should return true when exactly enough capacity remains', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [{ bulk: 70, energy_content: 300 }],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 30, // Exactly fits
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(true);
    });
  });

  describe('Fuel Tag Incompatibility', () => {
    it('should return false when no fuel tags match', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 10,
          fuel_tags: ['electric', 'battery'],
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Fuel tags incompatible')
      );
    });

    it('should return false with empty fuel_tags array', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 10,
          fuel_tags: [],
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(false);
    });

    it('should return false when fuel_tags is missing', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 10,
          // No fuel_tags field
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(false);
    });
  });

  describe('Buffer Capacity Validation', () => {
    it('should return false when buffer is full', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [
            { bulk: 50, energy_content: 200 },
            { bulk: 50, energy_content: 200 },
          ],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 10, // No room
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Insufficient buffer capacity')
      );
    });

    it('should return false when item bulk exceeds available space', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [{ bulk: 70, energy_content: 300 }],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 35, // Needs 35, only 30 available
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(false);
    });

    it('should calculate buffer bulk correctly with multiple items', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [
            { bulk: 20, energy_content: 100 },
            { bulk: 30, energy_content: 150 },
            { bulk: 25, energy_content: 120 },
          ],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 30, // Needs 30, only 25 available (100 - 75)
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(false);
    });
  });

  describe('Missing Component Handling', () => {
    it('should return false when fuel_converter is missing', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(null) // No fuel_converter
        .mockReturnValueOnce({
          buffer_storage: [],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 10,
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Missing components')
      );
    });

    it('should return false when metabolic_store is missing', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce(null) // No metabolic_store
        .mockReturnValueOnce({
          bulk: 10,
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(false);
    });

    it('should return false when fuel_source is missing', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce(null); // No fuel_source

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(false);
    });

    it('should return false when all components are missing', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(false);
    });
  });

  describe('Entity Reference Resolution', () => {
    it('should resolve entity references from context', () => {
      const context = {
        event: {
          payload: { actorId: 'npc_1', itemId: 'bread_1' },
        },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 20,
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate(
        [{ var: 'event.payload.actorId' }, { var: 'event.payload.itemId' }],
        context
      );

      expect(result).toBe(true);
    });

    it('should handle "self" reference for consumer', () => {
      const context = {
        self: 'actor_1',
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 20,
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate(['self', 'item'], context);

      expect(result).toBe(true);
    });

    it('should resolve entity objects with id', () => {
      const actor = { id: 'actor_1' };
      const item = { id: 'item_1' };
      const context = { actor, item };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 20,
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate([actor, item], context);

      expect(result).toBe(true);
    });

    it('should handle direct entity ID strings', () => {
      const context = {};

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 20,
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate(['actor_123', 'item_456'], context);

      expect(result).toBe(true);
    });

    it('should warn when context path is missing for consumer', () => {
      const context = { item: { id: 'item_1' } };

      const result = operator.evaluate(['actor.missing', 'item'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No consumer entity found at path actor.missing')
      );
    });

    it('should treat resolved object without id as original path', () => {
      const context = {
        actor: { name: 'nameless' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Resolved "actor" to object without id, treating original path as consumer entity ID'
        )
      );
    });

    it('should warn when JSON logic resolves to invalid entity object', () => {
      const context = { item: { id: 'item_1' } };

      const result = operator.evaluate([{ var: 'invalid.path' }, 'item'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid consumer entity at path {"var":"invalid.path"}')
      );
    });

    it('should warn when entity ID resolves to empty string', () => {
      const context = { item: { id: 'item_1' } };

      const result = operator.evaluate(['', 'item'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid consumer entity ID at path : ')
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

    it('should return false for invalid parameter count (one parameter)', () => {
      const context = {};

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return false for invalid parameter count (too many)', () => {
      const context = {};

      const result = operator.evaluate(['actor', 'item', 'extra'], context);

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

    it('should return false when consumer entity path does not exist', () => {
      const context = { item: { id: 'item_1' } };

      // When path doesn't exist, it's treated as entity ID
      // Component lookup will fail, returning false
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['nonexistent', 'item'], context);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Missing components')
      );
    });

    it('should return false when item entity path does not exist', () => {
      const context = { actor: { id: 'actor_1' } };

      // When path doesn't exist, it's treated as entity ID
      // Component lookup will fail, returning false
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['actor', 'nonexistent'], context);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Missing components')
      );
    });

    it('should return false for invalid consumer entity type', () => {
      const context = {};

      const result = operator.evaluate([123, 'item_1'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid consumer entityPath type')
      );
    });

    it('should return false for invalid item entity type', () => {
      const context = {};

      const result = operator.evaluate(['actor_1', true], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid item entityPath type')
      );
    });

    it('should handle errors from getComponentData gracefully', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during evaluation'),
        expect.any(Error)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle buffer_storage with missing bulk fields', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [
            { bulk: 30, energy_content: 150 },
            { energy_content: 100 }, // Missing bulk
          ],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 50,
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(true); // 30 used, 70 available, needs 50
    });

    it('should handle missing buffer_storage field gracefully', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_capacity: 100,
          // No buffer_storage field
        })
        .mockReturnValueOnce({
          bulk: 50,
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(true); // Empty buffer = full capacity
    });

    it('should handle very large bulk values', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 999999, // Way too big
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(false);
    });

    it('should handle zero bulk items', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [{ bulk: 100, energy_content: 500 }],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 0, // Zero bulk fits anywhere
          fuel_tags: ['organic'],
        });

      const result = operator.evaluate(['actor', 'item'], context);

      expect(result).toBe(true);
    });
  });

  describe('Logging', () => {
    it('should log debug message for successful validation', () => {
      const context = {
        actor: { id: 'actor_1' },
        item: { id: 'item_1' },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          capacity: 100,
          accepted_fuel_tags: ['organic'],
        })
        .mockReturnValueOnce({
          buffer_storage: [],
          buffer_capacity: 100,
        })
        .mockReturnValueOnce({
          bulk: 20,
          fuel_tags: ['organic'],
        });

      operator.evaluate(['actor', 'item'], context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Can consume: consumer=actor_1, item=item_1')
      );
    });
  });
});
