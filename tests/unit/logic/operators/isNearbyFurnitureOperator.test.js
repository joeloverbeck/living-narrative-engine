/**
 * @file Unit tests for IsNearbyFurnitureOperator
 * @description Tests for JSON Logic operator that checks if an entity IS the
 * nearby furniture that the actor can access while seated.
 *
 * This operator checks if an entity ID is in the nearFurnitureIds array of the
 * furniture the actor is sitting on. Use this to find furniture surfaces (like tables)
 * that can be interacted with while seated.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { IsNearbyFurnitureOperator } from '../../../../src/logic/operators/isNearbyFurnitureOperator.js';

describe('IsNearbyFurnitureOperator', () => {
  let mockEntityManager;
  let mockLogger;
  let operator;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    operator = new IsNearbyFurnitureOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should throw if entityManager is missing', () => {
      expect(
        () => new IsNearbyFurnitureOperator({ logger: mockLogger })
      ).toThrow();
    });

    it('should create operator with valid dependencies', () => {
      const op = new IsNearbyFurnitureOperator({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });
      expect(op).toBeDefined();
    });
  });

  describe('evaluate', () => {
    it('should return false when context has no actor', () => {
      const result = operator.evaluate(['table-1'], {});
      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'isNearbyFurniture: No actor in context'
      );
    });

    it('should return false when actor is not sitting', () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['table-1'], { actor: { id: 'actor-1' } });

      expect(result).toBe(false);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor-1',
        'positioning:sitting_on'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'isNearbyFurniture: Actor actor-1 is not sitting'
      );
    });

    it('should return false when sitting_on has no furniture_id', () => {
      mockEntityManager.getComponentData.mockReturnValue({});

      const result = operator.evaluate(['table-1'], { actor: { id: 'actor-1' } });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'isNearbyFurniture: No furniture_id in sitting_on component'
      );
    });

    it('should return false when furniture has no near_furniture component', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ furniture_id: 'stool-1' }) // sitting_on
        .mockReturnValueOnce(null); // near_furniture

      const result = operator.evaluate(['table-1'], { actor: { id: 'actor-1' } });

      expect(result).toBe(false);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'stool-1',
        'furniture:near_furniture'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'isNearbyFurniture: Furniture stool-1 has no near_furniture relationships'
      );
    });

    it('should return false when nearFurnitureIds is not an array', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ furniture_id: 'stool-1' }) // sitting_on
        .mockReturnValueOnce({ nearFurnitureIds: 'not-an-array' }); // near_furniture (invalid)

      const result = operator.evaluate(['table-1'], { actor: { id: 'actor-1' } });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'isNearbyFurniture: Furniture stool-1 has no near_furniture relationships'
      );
    });

    it('should return false when entity is NOT in nearFurnitureIds', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ furniture_id: 'stool-1' }) // sitting_on
        .mockReturnValueOnce({ nearFurnitureIds: ['table-1', 'shelf-1'] }); // near_furniture

      const result = operator.evaluate(['desk-1'], { actor: { id: 'actor-1' } });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'isNearbyFurniture: Entity desk-1 is not in nearFurnitureIds of stool-1'
      );
    });

    it('should return true when entity IS in nearFurnitureIds', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ furniture_id: 'stool-1' }) // sitting_on
        .mockReturnValueOnce({ nearFurnitureIds: ['table-1', 'shelf-1'] }); // near_furniture

      const result = operator.evaluate(['table-1'], { actor: { id: 'actor-1' } });

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'isNearbyFurniture: Entity table-1 is nearby furniture (in nearFurnitureIds of stool-1)'
      );
    });

    it('should return true when entity is the only item in nearFurnitureIds', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ furniture_id: 'stool-1' }) // sitting_on
        .mockReturnValueOnce({ nearFurnitureIds: ['table-1'] }); // near_furniture

      const result = operator.evaluate(['table-1'], { actor: { id: 'actor-1' } });

      expect(result).toBe(true);
    });

    it('should handle errors gracefully and return false', () => {
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = operator.evaluate(['table-1'], { actor: { id: 'actor-1' } });

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle null entityId gracefully', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ furniture_id: 'stool-1' }) // sitting_on
        .mockReturnValueOnce({ nearFurnitureIds: ['table-1'] }); // near_furniture

      const result = operator.evaluate([null], { actor: { id: 'actor-1' } });

      // null won't be found in nearFurnitureIds array
      expect(result).toBe(false);
    });

    it('should handle undefined context gracefully', () => {
      const result = operator.evaluate(['table-1'], undefined);
      expect(result).toBe(false);
    });

    it('should handle context without actor.id gracefully', () => {
      const result = operator.evaluate(['table-1'], { actor: {} });
      expect(result).toBe(false);
    });

    it('should handle empty nearFurnitureIds array', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ furniture_id: 'stool-1' }) // sitting_on
        .mockReturnValueOnce({ nearFurnitureIds: [] }); // near_furniture (empty)

      const result = operator.evaluate(['table-1'], { actor: { id: 'actor-1' } });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'isNearbyFurniture: Entity table-1 is not in nearFurnitureIds of stool-1'
      );
    });

    // Bertram scenario tests
    describe('Bertram production scenario', () => {
      it('should return true for table when actor is sitting on stool with near_furniture pointing to table', () => {
        // Simulates: Bertram sitting on stool-1, stool-1 has near_furniture pointing to table-1
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ furniture_id: 'fantasy:plain_wooden_stool_1_instance' }) // Bertram's sitting_on
          .mockReturnValueOnce({
            nearFurnitureIds: ['fantasy:aldous_kitchen_rustic_wooden_table_instance']
          }); // stool's near_furniture

        const result = operator.evaluate(
          ['fantasy:aldous_kitchen_rustic_wooden_table_instance'],
          { actor: { id: 'fantasy:bertram_the_muddy_instance' } }
        );

        expect(result).toBe(true);
      });

      it('should return false for unrelated furniture when actor is sitting', () => {
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ furniture_id: 'fantasy:plain_wooden_stool_1_instance' }) // sitting_on
          .mockReturnValueOnce({
            nearFurnitureIds: ['fantasy:aldous_kitchen_rustic_wooden_table_instance']
          }); // near_furniture

        const result = operator.evaluate(
          ['fantasy:some_other_table_instance'],
          { actor: { id: 'fantasy:bertram_the_muddy_instance' } }
        );

        expect(result).toBe(false);
      });
    });
  });
});
