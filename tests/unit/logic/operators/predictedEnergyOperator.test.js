/**
 * @file Unit tests for PredictedEnergyOperator
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { PredictedEnergyOperator } from '../../../../src/logic/operators/predictedEnergyOperator.js';

describe('PredictedEnergyOperator', () => {
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

    operator = new PredictedEnergyOperator({
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
        new PredictedEnergyOperator({ logger: mockLogger });
      }).toThrow('PredictedEnergyOperator: Missing required dependencies');
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new PredictedEnergyOperator({ entityManager: mockEntityManager });
      }).toThrow('PredictedEnergyOperator: Missing required dependencies');
    });
  });

  describe('Basic Energy Calculation', () => {
    it('should return current energy when buffer is empty', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 500,
        max_energy: 1000,
        buffer_storage: [],
        buffer_capacity: 100,
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(500);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'metabolism:metabolic_store'
      );
    });

    it('should calculate predicted energy with buffered items', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 500,
        max_energy: 1000,
        buffer_storage: [
          { bulk: 20, energy_content: 150 },
          { bulk: 15, energy_content: 100 },
        ],
        buffer_capacity: 100,
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(750); // 500 + 150 + 100
    });

    it('should handle multiple buffered items correctly', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 300,
        max_energy: 1000,
        buffer_storage: [
          { bulk: 10, energy_content: 50 },
          { bulk: 20, energy_content: 120 },
          { bulk: 15, energy_content: 80 },
          { bulk: 5, energy_content: 30 },
        ],
        buffer_capacity: 100,
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(580); // 300 + 50 + 120 + 80 + 30
    });

    it('should handle zero current energy with buffered items', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 0,
        max_energy: 1000,
        buffer_storage: [{ bulk: 20, energy_content: 200 }],
        buffer_capacity: 100,
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(200);
    });
  });

  describe('Missing Component Handling', () => {
    it('should return 0 when entity missing metabolic_store', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('missing metabolism:metabolic_store')
      );
    });

    it('should return 0 when component data is undefined', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue(undefined);

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(0);
    });
  });

  describe('Entity Reference Resolution', () => {
    it('should resolve entity reference from context', () => {
      const context = {
        event: {
          payload: { actorId: 'npc_1' },
        },
        npc_1: { id: 'npc_1' },
      };

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 400,
        buffer_storage: [{ bulk: 10, energy_content: 100 }],
        buffer_capacity: 100,
      });

      const result = operator.evaluate([{ var: 'event.payload.actorId' }], context);

      expect(result).toBe(500);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'npc_1',
        'metabolism:metabolic_store'
      );
    });

    it('should handle "self" reference', () => {
      const context = { self: 'actor_1' };

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 600,
        buffer_storage: [],
        buffer_capacity: 100,
      });

      const result = operator.evaluate(['self'], context);

      expect(result).toBe(600);
    });

    it('should resolve entity object with id', () => {
      const entity = { id: 'actor_1' };
      const context = { entity };

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 700,
        buffer_storage: [{ bulk: 10, energy_content: 50 }],
        buffer_capacity: 100,
      });

      const result = operator.evaluate([entity], context);

      expect(result).toBe(750);
    });

    it('should handle direct entity ID strings', () => {
      const context = {};

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 800,
        buffer_storage: [],
        buffer_capacity: 100,
      });

      const result = operator.evaluate(['entity_123'], context);

      expect(result).toBe(800);
    });

    it('should resolve nested entity paths like entity.target', () => {
      const target = { id: 'target_1' };
      const entity = { target };
      const context = { entity };

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 450,
        buffer_storage: [{ bulk: 20, energy_content: 150 }],
        buffer_capacity: 100,
      });

      const result = operator.evaluate(['entity.target'], context);

      expect(result).toBe(600);
    });
  });

  describe('Error Handling', () => {
    it('should return 0 for invalid parameter count (no parameters)', () => {
      const context = {};

      const result = operator.evaluate([], context);

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return 0 for invalid parameter count (too many)', () => {
      const context = {};

      const result = operator.evaluate(['actor', 'extra_param'], context);

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return 0 for null parameters', () => {
      const context = {};

      const result = operator.evaluate(null, context);

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should return 0 when entity path does not exist in context', () => {
      const context = {};

      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['nonexistent'], context);

      expect(result).toBe(0);
    });

    it('should return 0 for invalid entity path type (number)', () => {
      const context = {};

      const result = operator.evaluate([123], context);

      expect(result).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityPath type')
      );
    });

    it('should return 0 for invalid entity path type (boolean)', () => {
      const context = {};

      const result = operator.evaluate([true], context);

      expect(result).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityPath type')
      );
    });

    it('should return 0 when entity resolution produces null', () => {
      const context = { actor: null };

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No entity found at path')
      );
    });

    it('should return 0 when entity resolution produces empty string', () => {
      const context = { actor: { id: '' } };

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(0);
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

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during evaluation'),
        expect.any(Error)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle buffer_storage with missing energy_content fields', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 500,
        buffer_storage: [
          { bulk: 20, energy_content: 100 },
          { bulk: 15 }, // Missing energy_content
        ],
        buffer_capacity: 100,
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(600); // 500 + 100 + 0
    });

    it('should handle missing buffer_storage field gracefully', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 500,
        buffer_capacity: 100,
        // No buffer_storage field
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(500);
    });

    it('should handle buffer with extra properties', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 300,
        buffer_storage: [
          {
            bulk: 20,
            energy_content: 150,
            digestTime: 10,
            fuelType: 'organic',
          },
        ],
        buffer_capacity: 100,
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(450);
    });

    it('should handle zero energy_content items', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 200,
        buffer_storage: [
          { bulk: 10, energy_content: 0 },
          { bulk: 15, energy_content: 0 },
        ],
        buffer_capacity: 100,
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(200);
    });

    it('should handle very large energy values', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 999999,
        buffer_storage: [{ bulk: 10, energy_content: 100000 }],
        buffer_capacity: 100,
      });

      const result = operator.evaluate(['actor'], context);

      expect(result).toBe(1099999);
    });
  });

  describe('Logging', () => {
    it('should log debug message for successful calculation', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 500,
        buffer_storage: [{ bulk: 20, energy_content: 150 }],
        buffer_capacity: 100,
      });

      operator.evaluate(['actor'], context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('predicted energy: current=500, buffered=150')
      );
    });

    it('should log debug message for empty buffer', () => {
      const context = { actor: { id: 'actor_1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        current_energy: 600,
        buffer_storage: [],
        buffer_capacity: 100,
      });

      operator.evaluate(['actor'], context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('buffered=0.0')
      );
    });
  });
});
