/**
 * @file Unit tests for isSocketCoveredOperator with slot metadata component
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { IsSocketCoveredOperator } from '../../../../src/logic/operators/isSocketCoveredOperator.js';

describe('IsSocketCoveredOperator with slot metadata', () => {
  let operator;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock entity manager
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      hasComponent: jest.fn(),
      getComponentData: jest.fn(),
    };

    operator = new IsSocketCoveredOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('Socket coverage checks with slot metadata', () => {
    it('should return true when socket is covered by equipped clothing', () => {
      const entityId = 'test-entity';
      const context = { entity: entityId };

      // Mock equipment data
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (component === 'clothing:equipment') {
          return {
            equipped: {
              torso_upper: {
                base: 'shirt_id',
              },
            },
          };
        }
        if (component === 'clothing:slot_metadata') {
          return {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['left_chest', 'right_chest', 'chest_center'],
                allowedLayers: ['underwear', 'base', 'outer'],
              },
            },
          };
        }
        return null;
      });

      expect(operator.evaluate(['entity', 'left_chest'], context)).toBe(true);
      expect(operator.evaluate(['entity', 'right_chest'], context)).toBe(true);
      expect(operator.evaluate(['entity', 'chest_center'], context)).toBe(true);
    });

    it('should return false when socket is not covered', () => {
      const entityId = 'test-entity';
      const context = { entity: entityId };

      // Mock equipment data - torso_upper equipped but checking torso_lower socket
      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (component === 'clothing:equipment') {
          return {
            equipped: {
              torso_upper: {
                base: 'shirt_id',
              },
            },
          };
        }
        if (component === 'clothing:slot_metadata') {
          return {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['left_chest', 'right_chest'],
                allowedLayers: ['base', 'outer'],
              },
              torso_lower: {
                coveredSockets: ['vagina', 'penis', 'left_hip', 'right_hip'],
                allowedLayers: ['underwear', 'base', 'outer'],
              },
            },
          };
        }
        return null;
      });

      // Socket in torso_lower but only torso_upper is equipped
      expect(operator.evaluate(['entity', 'vagina'], context)).toBe(false);
      expect(operator.evaluate(['entity', 'penis'], context)).toBe(false);
    });

    it('should handle multiple slots covering the same socket', () => {
      const entityId = 'test-entity';
      const context = { entity: entityId };

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (component === 'clothing:equipment') {
          return {
            equipped: {
              torso_armor: {
                armor: 'chest_plate',
              },
            },
          };
        }
        if (component === 'clothing:slot_metadata') {
          return {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest_center'],
                allowedLayers: ['underwear', 'base', 'outer'],
              },
              torso_armor: {
                coveredSockets: ['chest_center', 'upper_back'],
                allowedLayers: ['armor'],
              },
            },
          };
        }
        return null;
      });

      // chest_center is covered by torso_armor
      expect(operator.evaluate(['entity', 'chest_center'], context)).toBe(true);
      expect(operator.evaluate(['entity', 'upper_back'], context)).toBe(true);
    });

    it('should return false when entity has no slot metadata component', () => {
      const entityId = 'test-entity';
      const context = { entity: entityId };

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (component === 'clothing:equipment') {
          return { equipped: {} };
        }
        if (component === 'clothing:slot_metadata') {
          return null; // No slot metadata
        }
        return null;
      });

      expect(operator.evaluate(['entity', 'any_socket'], context)).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('has no clothing:slot_metadata component')
      );
    });

    it('should return false when entity has no equipment component', () => {
      const entityId = 'test-entity';
      const context = { entity: entityId };

      mockEntityManager.getComponentData.mockImplementation(() => null);

      expect(operator.evaluate(['entity', 'any_socket'], context)).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('has no clothing:equipment component')
      );
    });

    it('should handle empty slot mappings', () => {
      const entityId = 'test-entity';
      const context = { entity: entityId };

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (component === 'clothing:equipment') {
          return { equipped: {} };
        }
        if (component === 'clothing:slot_metadata') {
          return { slotMappings: {} }; // Empty mappings
        }
        return null;
      });

      expect(operator.evaluate(['entity', 'any_socket'], context)).toBe(false);
    });
  });

  describe('Caching behavior', () => {
    it('should cache socket-to-slot lookups', () => {
      const entityId = 'test-entity';
      const context = { entity: entityId };

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (component === 'clothing:equipment') {
          return { equipped: {} };
        }
        if (component === 'clothing:slot_metadata') {
          return {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest_center'],
              },
            },
          };
        }
        return null;
      });

      // First call
      operator.evaluate(['entity', 'chest_center'], context);
      const firstCallCount =
        mockEntityManager.getComponentData.mock.calls.length;

      // Second call should use cache
      operator.evaluate(['entity', 'chest_center'], context);
      const secondCallCount =
        mockEntityManager.getComponentData.mock.calls.length;

      // Should have fewer calls on second evaluation due to caching
      expect(secondCallCount).toBeLessThan(firstCallCount * 2);
    });

    it('should clear cache for specific entity', () => {
      const entityId = 'test-entity';
      const context = { entity: entityId };

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (component === 'clothing:equipment') {
          return { equipped: {} };
        }
        if (component === 'clothing:slot_metadata') {
          return {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['chest_center'],
              },
            },
          };
        }
        return null;
      });

      // First evaluation
      operator.evaluate(['entity', 'chest_center'], context);
      const beforeClearCount =
        mockEntityManager.getComponentData.mock.calls.length;

      // Clear cache for this entity
      operator.clearCache(entityId);

      // Evaluation after cache clear should fetch data again
      operator.evaluate(['entity', 'chest_center'], context);
      const afterClearCount =
        mockEntityManager.getComponentData.mock.calls.length;

      // Should have made new calls after cache clear
      expect(afterClearCount).toBeGreaterThan(beforeClearCount);
    });

    it('should clear entire cache when no entity specified', () => {
      const entity1 = 'entity1';
      const entity2 = 'entity2';
      const context1 = { entity: entity1 };
      const context2 = { entity: entity2 };

      mockEntityManager.getComponentData.mockImplementation((id, component) => {
        if (component === 'clothing:equipment') {
          return { equipped: {} };
        }
        if (component === 'clothing:slot_metadata') {
          return { slotMappings: {} };
        }
        return null;
      });

      // Cache data for both entities
      operator.evaluate(['entity', 'test_socket'], context1);
      operator.evaluate(['entity', 'test_socket'], context2);

      // Clear entire cache
      operator.clearCache();

      // Both entities should need fresh lookups
      const callsBefore = mockEntityManager.getComponentData.mock.calls.length;
      operator.evaluate(['entity', 'test_socket'], context1);
      operator.evaluate(['entity', 'test_socket'], context2);
      const callsAfter = mockEntityManager.getComponentData.mock.calls.length;

      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });

  describe('Error handling', () => {
    it('should handle missing parameters gracefully', () => {
      expect(operator.evaluate([], {})).toBe(false);
      expect(operator.evaluate(['entity'], { entity: 'test' })).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle invalid socket parameter', () => {
      const context = { entity: 'test-entity' };

      expect(operator.evaluate(['entity', null], context)).toBe(false);
      expect(operator.evaluate(['entity', 123], context)).toBe(false);
      expect(operator.evaluate(['entity', {}], context)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid socketId parameter')
      );
    });

    it('should handle errors during evaluation', () => {
      const context = { entity: 'test-entity' };

      // Mock getComponentData to throw an error
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Database error');
      });

      expect(operator.evaluate(['entity', 'test_socket'], context)).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error checking socket coverage'),
        expect.any(Error)
      );
    });
  });
});
