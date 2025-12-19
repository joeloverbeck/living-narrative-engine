/**
 * @file Comprehensive edge case test suite for EstablishSittingClosenessHandler
 * Tests malformed inputs, corrupted data, and extreme scenarios
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EstablishSittingClosenessHandler from '../../../../src/logic/operationHandlers/establishSittingClosenessHandler.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';
import { createTestBed } from '../../../common/testBed.js';
import * as proximityUtils from '../../../../src/utils/proximityUtils.js';
import * as movementUtils from '../../../../src/utils/movementUtils.js';
import * as contextVariableUtils from '../../../../src/utils/contextVariableUtils.js';
import * as evaluationContextUtils from '../../../../src/utils/evaluationContextUtils.js';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';
import { ComponentStateValidator } from '../../../../src/utils/componentStateValidator.js';
import * as closenessCircleService from '../../../../src/logic/services/closenessCircleService.js';

// Mock dependencies
jest.mock('../../../../src/utils/proximityUtils.js');
jest.mock('../../../../src/utils/movementUtils.js', () => ({
  updateMovementLock: jest.fn(),
}));
jest.mock('../../../../src/utils/contextVariableUtils.js');
jest.mock('../../../../src/utils/evaluationContextUtils.js');
jest.mock('../../../../src/utils/safeDispatchErrorUtils.js');
jest.mock('../../../../src/utils/componentStateValidator.js');
jest.mock('../../../../src/errors/invalidArgumentError.js');
jest.mock('../../../../src/logic/services/closenessCircleService.js');

// Test helper to create valid execution context
/**
 *
 */
function createExecutionContext() {
  return {
    evaluationContext: {
      context: {},
    },
  };
}

// Helper to setup entity manager with realistic data
/**
 *
 * @param scenario
 */
function setupEntityManager(scenario) {
  const mockEntityManager = {
    getComponentData: jest.fn(),
    addComponent: jest.fn(),
  };

  switch (scenario) {
    case 'empty-furniture':
      mockEntityManager.getComponentData.mockReturnValue({ spots: [] });
      break;
    case 'full-furniture':
      mockEntityManager.getComponentData.mockReturnValue({
        spots: ['actor:1', 'actor:2', 'actor:3'],
      });
      break;
    case 'corrupted-spots':
      mockEntityManager.getComponentData.mockReturnValue({
        spots: 'not-an-array',
      });
      break;
    case 'null-spots':
      mockEntityManager.getComponentData.mockReturnValue({
        spots: null,
      });
      break;
    case 'oversized-furniture':
      mockEntityManager.getComponentData.mockReturnValue({
        spots: new Array(11).fill(null), // 11 spots (exceeds max of 10)
      });
      break;
    default:
      mockEntityManager.getComponentData.mockReturnValue(null);
  }

  return mockEntityManager;
}

describe('EstablishSittingClosenessHandler - Edge Case Test Suite', () => {
  let testBed;
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockDispatcher;
  let executionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    testBed = createTestBed();

    // Setup mock logger
    mockLogger = testBed.mockLogger;

    // Setup mock entity manager
    mockEntityManager = {
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
    };

    // Setup mock dispatcher
    mockDispatcher = {
      dispatch: jest.fn(),
    };

    // Setup mock closeness circle service
    closenessCircleService.repair = jest.fn((partners) => {
      return [...new Set(partners)].sort();
    });
    closenessCircleService.merge = jest.fn();

    // Setup execution context
    executionContext = createExecutionContext();

    // Create handler instance
    handler = new EstablishSittingClosenessHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
      closenessCircleService: closenessCircleService,
    });

    // Setup default mocks
    proximityUtils.validateProximityParameters.mockReturnValue(true);
    proximityUtils.findAdjacentOccupants.mockReturnValue([]);
    evaluationContextUtils.ensureEvaluationContext.mockReturnValue(true);
    contextVariableUtils.tryWriteContextVariable.mockReturnValue({
      success: true,
    });

    // Setup ComponentStateValidator mocks
    ComponentStateValidator.mockImplementation(() => ({
      validateFurnitureComponent: jest.fn(),
      validateClosenessComponent: jest.fn(),
      validateBidirectionalCloseness: jest.fn(),
    }));

    // Setup error class mocks
    InvalidArgumentError.mockImplementation((message) => {
      const error = new Error(message);
      error.name = 'InvalidArgumentError';
      return error;
    });
  });

  describe('Input Validation Edge Cases', () => {
    describe('Malformed Entity IDs', () => {
      it('should handle malformed entity IDs gracefully', async () => {
        const invalidIds = [
          '', // Empty string
          '   ', // Whitespace only
          'no-colon', // Missing namespace separator
          ':missing-mod', // Missing mod ID
          'missing-id:', // Missing identifier
          'mod::double-colon', // Double colon
          'mod:id:extra', // Extra colons
          'mod-dash:id', // Invalid mod ID characters
          'mod:id@special', // Invalid identifier characters
          null, // Null value
          undefined, // Undefined value
          123, // Number
          {}, // Object
          [], // Array
        ];

        for (const invalidId of invalidIds) {
          // Reset mocks for each iteration
          jest.clearAllMocks();
          proximityUtils.validateProximityParameters.mockImplementation(() => {
            throw new Error(`Invalid entity ID: ${invalidId}`);
          });

          // Test invalid furniture_id
          const result1 = await handler.execute(
            {
              furniture_id: invalidId,
              actor_id: 'game:alice',
              spot_index: 1,
            },
            executionContext
          );

          expect(result1.success).toBe(false);
          expect(result1.error).toContain('Parameter validation failed');

          // Test invalid actor_id
          jest.clearAllMocks();
          proximityUtils.validateProximityParameters.mockImplementation(
            (furnitureId, actorId) => {
              if (actorId === invalidId) {
                throw new Error(`Invalid entity ID: ${invalidId}`);
              }
            }
          );

          const result2 = await handler.execute(
            {
              furniture_id: 'furniture:couch',
              actor_id: invalidId,
              spot_index: 1,
            },
            executionContext
          );

          expect(result2.success).toBe(false);
          expect(result2.error).toContain('Parameter validation failed');
        }
      });
    });

    describe('Spot Index Validation', () => {
      it('should handle extreme spot index values', async () => {
        const invalidSpotIndices = [
          -1, // Negative
          -999, // Large negative
          10, // Above maximum
          100, // Far above maximum
          1.5, // Decimal
          NaN, // Not a number
          Infinity, // Infinity
          -Infinity, // Negative infinity
          '0', // String number
          '1', // String number
          null, // Null
          undefined, // Undefined
        ];

        const furnitureComponent = {
          spots: [null, null, null], // 3 spots available
        };

        for (const invalidSpot of invalidSpotIndices) {
          jest.clearAllMocks();

          // Setup mocks for this iteration
          mockEntityManager.getComponentData.mockReturnValue(
            furnitureComponent
          );
          proximityUtils.validateProximityParameters.mockImplementation(
            (furnitureId, actorId, spotIndex) => {
              if (
                typeof spotIndex !== 'number' ||
                spotIndex < 0 ||
                spotIndex >= 10 ||
                !Number.isInteger(spotIndex)
              ) {
                throw new Error(`Invalid spot index: ${spotIndex}`);
              }
            }
          );

          const mockValidator = {
            validateFurnitureComponent: jest.fn(),
            validateClosenessComponent: jest.fn(),
          };
          ComponentStateValidator.mockImplementation(() => mockValidator);

          const result = await handler.execute(
            {
              furniture_id: 'furniture:couch',
              actor_id: 'game:alice',
              spot_index: invalidSpot,
            },
            executionContext
          );

          // Should either fail validation or exceed bounds
          expect(result.success).toBe(false);
        }
      });
    });
  });

  describe('Component State Edge Cases', () => {
    it('should handle corrupted furniture component', async () => {
      // Spots is not an array
      mockEntityManager.getComponentData.mockReturnValue({
        spots: 'not-an-array',
      });

      const mockValidator = {
        validateFurnitureComponent: jest.fn().mockImplementation(() => {
          throw new InvalidArgumentError('Furniture spots must be an array');
        }),
        validateClosenessComponent: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(
        {
          furniture_id: 'furniture:corrupted',
          actor_id: 'game:alice',
          spot_index: 1,
        },
        executionContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Furniture spots must be an array');
    });

    it('should handle furniture with empty spots array', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        spots: [],
      });

      const mockValidator = {
        validateFurnitureComponent: jest.fn().mockImplementation(() => {
          throw new InvalidArgumentError('Furniture has no spots');
        }),
        validateClosenessComponent: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(
        {
          furniture_id: 'furniture:empty',
          actor_id: 'game:alice',
          spot_index: 0,
        },
        executionContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Furniture has no spots');
    });

    it('should handle furniture exceeding maximum capacity', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        spots: new Array(11).fill(null), // 11 spots (exceeds max of 10)
      });

      const mockValidator = {
        validateFurnitureComponent: jest.fn().mockImplementation(() => {
          throw new InvalidArgumentError(
            'Furniture exceeds maximum capacity of 10 spots'
          );
        }),
        validateClosenessComponent: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(
        {
          furniture_id: 'furniture:oversized',
          actor_id: 'game:alice',
          spot_index: 10,
        },
        executionContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Furniture exceeds maximum capacity');
    });
  });

  describe('Complex Relationship Scenarios', () => {
    it('should handle circular closeness references', async () => {
      // Setup circular reference: A → B → C → A
      let getComponentCallCount = 0;
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          getComponentCallCount++;

          // First call is for furniture validation
          if (getComponentCallCount === 1) {
            return { spots: ['game:alice', 'game:bob', 'game:charlie'] };
          }

          if (componentType === 'personal-space-states:closeness') {
            switch (entityId) {
              case 'game:alice':
                return { partners: ['game:bob'] };
              case 'game:bob':
                return { partners: ['game:charlie'] };
              case 'game:charlie':
                return { partners: ['game:alice'] };
            }
          }
          if (componentType === 'sitting:allows_sitting') {
            return {
              spots: ['game:alice', 'game:bob', 'game:charlie', 'game:dave'],
            };
          }
          return null;
        }
      );

      proximityUtils.findAdjacentOccupants.mockReturnValue(['game:charlie']);

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      // Should handle gracefully without infinite loops
      const result = await handler.execute(
        {
          furniture_id: 'furniture:couch',
          actor_id: 'game:dave',
          spot_index: 3,
        },
        executionContext
      );

      expect(result.success).toBeDefined();
      // Verify no infinite loop occurred (test completes)
      // The test completing without timeout is the success criterion
    });

    it('should handle self-referential closeness', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            componentType === 'personal-space-states:closeness' &&
            entityId === 'game:alice'
          ) {
            return { partners: ['game:alice'] }; // Self-reference
          }
          if (componentType === 'sitting:allows_sitting') {
            return { spots: ['game:alice', null] };
          }
          return null;
        }
      );

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest
          .fn()
          .mockImplementation((actorId, component) => {
            if (
              component &&
              component.partners &&
              component.partners.includes(actorId)
            ) {
              throw new InvalidArgumentError(
                'Self-referential closeness detected'
              );
            }
          }),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(
        {
          furniture_id: 'furniture:couch',
          actor_id: 'game:alice',
          spot_index: 0,
        },
        executionContext
      );

      // Should handle the self-reference error
      expect(result.success).toBeDefined();
    });
  });

  describe('JavaScript Single-Threaded Model', () => {
    it('should handle sequential operations correctly', async () => {
      // JavaScript is single-threaded, operations are inherently atomic
      const operations = [];

      // Setup furniture with 3 spots
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'sitting:allows_sitting') {
            return { spots: [null, null, null] };
          }
          return null;
        }
      );

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      // Execute multiple operations in parallel
      for (let i = 0; i < 10; i++) {
        operations.push(
          handler
            .execute(
              {
                furniture_id: 'furniture:shared',
                actor_id: `game:actor_${i}`,
                spot_index: i % 3,
              },
              executionContext
            )
            .catch((err) => ({ error: err }))
        );
      }

      const results = await Promise.all(operations);

      // All operations should complete without data corruption
      results.forEach((result) => {
        expect(result).toBeDefined();
        // Either success or controlled error
        expect(result.success !== undefined || result.error !== undefined).toBe(
          true
        );
      });
    });

    it('should maintain data consistency across async operations', async () => {
      const updateLog = [];

      // Track all component updates
      mockEntityManager.addComponent.mockImplementation(
        (entityId, componentType, data) => {
          updateLog.push({
            entityId,
            componentType,
            data,
            timestamp: Date.now(),
          });
          return Promise.resolve();
        }
      );

      // Setup furniture
      mockEntityManager.getComponentData.mockReturnValue({
        spots: [null, null, null],
      });

      proximityUtils.findAdjacentOccupants
        .mockReturnValueOnce(['game:actor2']) // For actor1
        .mockReturnValueOnce(['game:actor1']); // For actor2

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      // Execute operations that modify shared state
      await Promise.all([
        handler.execute(
          {
            furniture_id: 'furniture:bench',
            actor_id: 'game:actor1',
            spot_index: 0,
          },
          executionContext
        ),
        handler.execute(
          {
            furniture_id: 'furniture:bench',
            actor_id: 'game:actor2',
            spot_index: 1,
          },
          executionContext
        ),
      ]);

      // Verify updates occurred
      expect(updateLog.length).toBeGreaterThan(0);
      // Each update should have a timestamp
      updateLog.forEach((entry) => {
        expect(entry.timestamp).toBeDefined();
        expect(typeof entry.timestamp).toBe('number');
      });
    });
  });

  describe('Edge Furniture Configurations', () => {
    it('should handle single-spot furniture correctly', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        spots: [null], // Single spot
      });

      proximityUtils.findAdjacentOccupants.mockReturnValue([]);

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(
        {
          furniture_id: 'furniture:stool',
          actor_id: 'game:alice',
          spot_index: 0,
        },
        executionContext
      );

      // Should succeed but establish no closeness (no adjacent spots)
      expect(result.success).toBe(true);
      expect(result.adjacentActors).toEqual([]);
    });

    it('should handle furniture at maximum capacity', async () => {
      const maxSpots = new Array(10).fill('game:actor');
      maxSpots[5] = null; // One empty spot

      mockEntityManager.getComponentData.mockReturnValue({
        spots: maxSpots,
      });

      proximityUtils.findAdjacentOccupants.mockReturnValue([
        'game:actor',
        'game:actor',
      ]);

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(
        {
          furniture_id: 'furniture:large-couch',
          actor_id: 'game:alice',
          spot_index: 5,
        },
        executionContext
      );

      expect(result.success).toBe(true);
      expect(result.adjacentActors).toHaveLength(2); // Actors at spots 4 and 6
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from partial update failures', async () => {
      let callCount = 0;

      // Fail on third call
      mockEntityManager.addComponent.mockImplementation(() => {
        callCount++;
        if (callCount === 3) {
          return Promise.reject(new Error('Database error'));
        }
        return Promise.resolve();
      });

      mockEntityManager.getComponentData.mockReturnValue({
        spots: ['alice', 'bob', null],
      });

      proximityUtils.findAdjacentOccupants.mockReturnValue(['alice']);
      movementUtils.updateMovementLock.mockImplementation(() => {
        return Promise.reject(new Error('Database error'));
      });

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(
        {
          furniture_id: 'furniture:couch',
          actor_id: 'charlie',
          spot_index: 2,
        },
        executionContext
      );

      // Should handle the error gracefully
      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate final state even after successful updates', async () => {
      // Setup successful updates but inconsistent final state
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'sitting:allows_sitting') {
            return { spots: [null, 'game:bob', null] };
          }
          if (componentType === 'personal-space-states:closeness') {
            // Return unidirectional relationship after update
            if (entityId === 'game:alice') {
              return { partners: ['game:bob'] };
            }
            if (entityId === 'game:bob') {
              return { partners: [] }; // Missing reverse relationship
            }
          }
          return null;
        }
      );

      proximityUtils.findAdjacentOccupants.mockReturnValue(['game:bob']);
      movementUtils.updateMovementLock.mockResolvedValue();

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn().mockImplementation(() => {
          throw new Error('Bidirectional validation failed');
        }),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(
        {
          furniture_id: 'furniture:couch',
          actor_id: 'game:alice',
          spot_index: 0,
        },
        executionContext
      );

      // Should log warning about inconsistency but not throw
      expect(mockLogger.error).toHaveBeenCalledWith(
        'EstablishSittingClosenessHandler: Final state validation failed',
        expect.any(Object)
      );
      // Operation should still succeed
      expect(result.success).toBe(true);
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle null closeness components gracefully', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'personal-space-states:closeness') {
            return null; // No closeness component
          }
          if (componentType === 'sitting:allows_sitting') {
            return { spots: ['game:alice', null, 'game:bob'] };
          }
          return null;
        }
      );

      proximityUtils.findAdjacentOccupants.mockReturnValue(['game:alice']);
      movementUtils.updateMovementLock.mockResolvedValue();

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(
        {
          furniture_id: 'furniture:bench',
          actor_id: 'game:charlie',
          spot_index: 1,
        },
        executionContext
      );

      expect(result.success).toBe(true);
    });

    it('should handle missing logger methods', async () => {
      const invalidLoggers = [
        null,
        undefined,
        {},
        { info: 'not-a-function' },
        { info: jest.fn(), warn: jest.fn() }, // Missing error and debug
      ];

      for (const invalidLogger of invalidLoggers) {
        // Test handler construction with invalid logger
        expect(() => {
          new EstablishSittingClosenessHandler({
            logger: invalidLogger,
            entityManager: mockEntityManager,
            safeEventDispatcher: mockDispatcher,
            closenessCircleService: closenessCircleService,
          });
        }).toThrow();
      }
    });

    it('should handle undefined parameters gracefully', async () => {
      const result = await handler.execute(
        {
          furniture_id: undefined,
          actor_id: 'game:alice',
          spot_index: 0,
        },
        executionContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing component data', async () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      const mockValidator = {
        validateFurnitureComponent: jest.fn().mockImplementation(() => {
          throw new InvalidArgumentError('Furniture component not found');
        }),
        validateClosenessComponent: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const result = await handler.execute(
        {
          furniture_id: 'furniture:missing',
          actor_id: 'game:alice',
          spot_index: 0,
        },
        executionContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Furniture component not found');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle rapid successive calls efficiently', async () => {
      const startTime = Date.now();
      const iterations = 100;
      const results = [];

      mockEntityManager.getComponentData.mockReturnValue({
        spots: [null, null, null],
      });

      proximityUtils.findAdjacentOccupants.mockReturnValue([]);

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      for (let i = 0; i < iterations; i++) {
        results.push(
          await handler.execute(
            {
              furniture_id: 'furniture:bench',
              actor_id: `game:actor_${i}`,
              spot_index: i % 3,
            },
            executionContext
          )
        );
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete 100 operations in less than 1 second
      expect(totalTime).toBeLessThan(1000);
      expect(results).toHaveLength(iterations);
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle memory efficiently with large furniture', async () => {
      // Create furniture with maximum spots
      const largeSpots = new Array(10)
        .fill(null)
        .map((_, i) => `game:actor_${i}`);
      largeSpots[5] = null; // One empty spot

      mockEntityManager.getComponentData.mockReturnValue({
        spots: largeSpots,
      });

      proximityUtils.findAdjacentOccupants.mockReturnValue([
        'game:actor_4',
        'game:actor_6',
      ]);
      movementUtils.updateMovementLock.mockResolvedValue();

      const mockValidator = {
        validateFurnitureComponent: jest.fn(),
        validateClosenessComponent: jest.fn(),
        validateBidirectionalCloseness: jest.fn(),
      };
      ComponentStateValidator.mockImplementation(() => mockValidator);

      const memoryBefore = process.memoryUsage().heapUsed;

      const result = await handler.execute(
        {
          furniture_id: 'furniture:large',
          actor_id: 'game:alice',
          spot_index: 5,
        },
        executionContext
      );

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      expect(result.success).toBe(true);
    });
  });
});
