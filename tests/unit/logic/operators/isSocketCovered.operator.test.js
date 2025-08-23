/**
 * @file Unit tests for isSocketCovered operator
 * @description Tests the operator that checks if anatomical sockets are covered by clothing
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { IsSocketCoveredOperator } from '../../../../src/logic/operators/isSocketCoveredOperator.js';

describe('IsSocketCoveredOperator', () => {
  let operator;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    operator = new IsSocketCoveredOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('Socket Coverage Detection', () => {
    it('should return false when entity has no clothing:equipment component', () => {
      // Arrange
      mockEntityManager.getComponentData.mockReturnValue(null);
      const context = {
        actor: { id: 'test:entity' },
      };

      // Act
      const result = operator.evaluate(['actor', 'penis'], context);

      // Assert
      expect(result).toBe(false);
      // The operator logs debug messages about no equipment component
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'test:entity',
        'clothing:equipment'
      );
    });

    it('should return false when socket is not covered (empty slot)', () => {
      // Arrange
      const context = {
        actor: { id: 'test:entity' },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                lower_body: {}, // Empty slot
              },
            };
          }
          if (componentId === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                lower_body: {
                  coveredSockets: ['penis', 'vagina'],
                },
              },
            };
          }
          return null;
        }
      );

      // Act
      const result = operator.evaluate(['actor', 'penis'], context);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true when socket is covered by clothing in base layer', () => {
      // Arrange
      const context = {
        actor: { id: 'test:entity' },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                lower_body: {
                  base: ['underwear'], // Has clothing in base layer
                },
              },
            };
          }
          if (componentId === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                lower_body: {
                  coveredSockets: ['penis', 'vagina'],
                },
              },
            };
          }
          return null;
        }
      );

      // Act
      const result = operator.evaluate(['actor', 'penis'], context);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when only accessories layer has items', () => {
      // Arrange
      const context = {
        actor: { id: 'test:entity' },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                lower_body: {
                  accessories: ['belt'], // Only accessories, no coverage
                },
              },
            };
          }
          if (componentId === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                lower_body: {
                  coveredSockets: ['penis', 'vagina'],
                },
              },
            };
          }
          return null;
        }
      );

      // Act
      const result = operator.evaluate(['actor', 'penis'], context);

      // Assert
      expect(result).toBe(false);
      // Accessories don't provide coverage
    });

    it('should return true when outer layer has clothing', () => {
      // Arrange
      const context = {
        actor: { id: 'test:entity' },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                lower_body: {
                  outer: ['pants'], // Outer layer provides coverage
                },
              },
            };
          }
          if (componentId === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                lower_body: {
                  coveredSockets: ['penis', 'vagina'],
                },
              },
            };
          }
          return null;
        }
      );

      // Act
      const result = operator.evaluate(['actor', 'penis'], context);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when socket has no covering slots defined', () => {
      // Arrange
      const context = {
        actor: { id: 'test:entity' },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                lower_body: {
                  base: ['underwear'],
                },
              },
            };
          }
          if (componentId === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                lower_body: {
                  coveredSockets: ['vagina'], // Penis not in covered sockets
                },
              },
            };
          }
          return null;
        }
      );

      // Act
      const result = operator.evaluate(['actor', 'penis'], context);

      // Assert
      expect(result).toBe(false);
      // Socket not in covered slots
    });

    it('should check multiple slots that can cover the same socket', () => {
      // Arrange
      const context = {
        actor: { id: 'test:entity' },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                lower_body: {}, // Empty
                full_body: {
                  base: ['bodysuit'], // Full body suit covers everything
                },
              },
            };
          }
          if (componentId === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                lower_body: {
                  coveredSockets: ['penis', 'vagina'],
                },
                full_body: {
                  coveredSockets: ['penis', 'vagina', 'chest'],
                },
              },
            };
          }
          return null;
        }
      );

      // Act
      const result = operator.evaluate(['actor', 'penis'], context);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle missing or invalid parameters gracefully', () => {
      const context = {
        actor: { id: 'test:entity' },
      };

      // Act & Assert - missing socket parameter (only entity path)
      expect(operator.evaluate(['actor'], context)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isSocketCovered: Invalid parameters'
      );

      // Act & Assert - invalid socket parameter (number instead of string)
      mockLogger.warn.mockClear();
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: { lower_body: {} },
      });
      expect(operator.evaluate(['actor', 123], context)).toBe(false);

      // Act & Assert - no parameters
      mockLogger.warn.mockClear();
      expect(operator.evaluate([], context)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isSocketCovered: Invalid parameters'
      );
    });

    it('should handle entity with no slot metadata gracefully', () => {
      // Arrange
      const context = {
        actor: { id: 'test:entity' },
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                lower_body: {
                  base: ['underwear'],
                },
              },
            };
          }
          return null; // No slot metadata
        }
      );

      // Act
      const result = operator.evaluate(['actor', 'penis'], context);

      // Assert
      expect(result).toBe(false);
      // No slot metadata means no socket coverage info
    });
  });

  describe('Trace Context Support', () => {
    it('should capture operator evaluation in trace when trace context is provided', () => {
      // Arrange
      const mockTrace = {
        captureOperatorEvaluation: jest.fn(),
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                lower_body: {
                  base: ['underwear'],
                },
              },
            };
          }
          if (componentId === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                lower_body: {
                  coveredSockets: ['penis'],
                },
              },
            };
          }
          return null;
        }
      );

      // Act
      const context = {
        actor: { id: 'test:entity' },
        trace: mockTrace,
      };
      const result = operator.evaluate(['actor', 'penis'], context);

      // Assert
      expect(result).toBe(true);
      expect(mockTrace.captureOperatorEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          operator: 'isSocketCovered',
          entityId: 'test:entity',
          socketId: 'penis',
          result: true,
          hasEquipmentComponent: true,
          potentialCoveringSlots: ['lower_body'],
        })
      );
    });
  });

  describe('Cache Management', () => {
    it('should cache socket-to-slot mappings for performance', () => {
      // Arrange
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return { equipped: {} };
          }
          if (componentId === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                lower_body: { coveredSockets: ['penis'] },
              },
            };
          }
          return null;
        }
      );

      // Act - First call
      const context = {
        actor: { id: 'test:entity' },
      };
      operator.evaluate(['actor', 'penis'], context);
      const firstCallCount =
        mockEntityManager.getComponentData.mock.calls.length;

      // Act - Second call (should use cache)
      operator.evaluate(['actor', 'penis'], context);
      const secondCallCount =
        mockEntityManager.getComponentData.mock.calls.length;

      // Assert - slot_metadata should only be fetched once due to caching
      expect(secondCallCount).toBeLessThan(firstCallCount * 2);
    });

    it('should clear cache when requested', () => {
      // Arrange
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return { equipped: {} };
          }
          if (componentId === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                lower_body: { coveredSockets: ['penis'] },
              },
            };
          }
          return null;
        }
      );

      // Act
      const context = {
        actor: { id: 'test:entity' },
      };
      operator.evaluate(['actor', 'penis'], context);
      operator.clearCache('test:entity');
      operator.evaluate(['actor', 'penis'], context);

      // Assert - slot_metadata should be fetched again after cache clear
      const slotMetadataCalls =
        mockEntityManager.getComponentData.mock.calls.filter(
          (call) => call[1] === 'clothing:slot_metadata'
        );
      expect(slotMetadataCalls.length).toBe(2);
    });
  });
});
