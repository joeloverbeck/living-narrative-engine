/**
 * @file Unit tests for HasComponentOperator
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { HasComponentOperator } from '../../../../src/logic/operators/hasComponentOperator.js';

describe('HasComponentOperator', () => {
  let testBed;
  let operator;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEntityManager = testBed.createMock('entityManager', [
      'hasComponent',
      'getComponentData',
    ]);

    operator = new HasComponentOperator({
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
        new HasComponentOperator({ logger: mockLogger });
      }).toThrow('HasComponentOperator: Missing required dependencies');
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new HasComponentOperator({ entityManager: mockEntityManager });
      }).toThrow('HasComponentOperator: Missing required dependencies');
    });
  });

  describe('evaluate', () => {
    it('should return true when entity has the specified component', () => {
      const entity = { id: 'entity-1' };
      const context = { entity };

      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = operator.evaluate(['entity', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith('entity-1', 'movement:is_dimensional_portal');
    });

    it('should return false when entity does not have the specified component', () => {
      const entity = { id: 'entity-1' };
      const context = { entity };

      mockEntityManager.hasComponent.mockReturnValue(false);

      const result = operator.evaluate(['entity', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(false);
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith('entity-1', 'movement:is_dimensional_portal');
    });

    it('should resolve nested entity paths like entity.blocker', () => {
      const blocker = { id: 'blocker-1' };
      const entity = { blocker };
      const context = { entity };

      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = operator.evaluate(['entity.blocker', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith('blocker-1', 'movement:is_dimensional_portal');
    });

    it('should return false when entity path resolves to null', () => {
      const context = { entity: null };

      const result = operator.evaluate(['entity', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false when entity path resolves to undefined', () => {
      const context = {};

      const result = operator.evaluate(['entity', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false when entity has no id', () => {
      const entity = { name: 'test' };
      const context = { entity };

      const result = operator.evaluate(['entity', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle entity as string ID', () => {
      const context = { entityId: 'entity-1' };

      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = operator.evaluate(['entityId', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith('entity-1', 'movement:is_dimensional_portal');
    });

    it('should return false with invalid parameters', () => {
      const result = operator.evaluate(null, {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false when parameters array is empty', () => {
      const result = operator.evaluate([], {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false when only one parameter is provided', () => {
      const result = operator.evaluate(['entity'], {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should log errors and return false on exceptions', () => {
      const entity = { id: 'entity-1' };
      const context = { entity };

      mockEntityManager.hasComponent.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = operator.evaluate(['entity', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle JSON Logic expressions in entityPath parameter', () => {
      const blocker = { id: 'blocker-1' };
      const context = { entity: { blocker } };

      mockEntityManager.hasComponent.mockReturnValue(true);

      // Pass a JSON Logic expression as the first parameter
      const result = operator.evaluate([{ var: 'entity.blocker' }, 'movement:is_dimensional_portal'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith('blocker-1', 'movement:is_dimensional_portal');
    });
  });
});
