/**
 * @file Unit tests for RemoveSittingClosenessHandler
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RemoveSittingClosenessHandler from '../../../../src/logic/operationHandlers/removeSittingClosenessHandler.js';
import * as proximityUtils from '../../../../src/utils/proximityUtils.js';
import * as movementUtils from '../../../../src/utils/movementUtils.js';
import * as contextVariableUtils from '../../../../src/utils/contextVariableUtils.js';
import * as evaluationContextUtils from '../../../../src/utils/evaluationContextUtils.js';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';
import * as closenessCircleService from '../../../../src/logic/services/closenessCircleService.js';

// Mock dependencies
jest.mock('../../../../src/utils/proximityUtils.js');
jest.mock('../../../../src/utils/movementUtils.js', () => ({
  updateMovementLock: jest.fn(),
}));
jest.mock('../../../../src/utils/contextVariableUtils.js');
jest.mock('../../../../src/utils/evaluationContextUtils.js');
jest.mock('../../../../src/utils/safeDispatchErrorUtils.js');
jest.mock('../../../../src/logic/services/closenessCircleService.js');

describe('RemoveSittingClosenessHandler', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockDispatcher;
  let mockClosenessCircleService;
  let executionContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Setup mock entity manager
    mockEntityManager = {
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
      removeComponent: jest.fn(),
    };

    // Setup mock dispatcher
    mockDispatcher = {
      dispatch: jest.fn(),
    };

    // Setup mock closeness circle service
    mockClosenessCircleService = closenessCircleService;

    // Mock the service functions
    closenessCircleService.repair.mockImplementation((partners) =>
      partners ? partners.slice().sort() : []
    );
    closenessCircleService.merge.mockImplementation((...arrays) =>
      [...new Set(arrays.flat())].sort()
    );

    // Setup execution context
    executionContext = {
      logger: mockLogger,
    };

    // Setup mocks
    proximityUtils.validateProximityParameters.mockImplementation(() => {});
    proximityUtils.getAdjacentSpots.mockReturnValue([]);
    movementUtils.updateMovementLock.mockResolvedValue({});
    contextVariableUtils.tryWriteContextVariable.mockReturnValue(true);
    evaluationContextUtils.ensureEvaluationContext.mockReturnValue(true);

    // Create handler instance
    handler = new RemoveSittingClosenessHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
      closenessCircleService: mockClosenessCircleService,
    });
  });

  describe('constructor', () => {
    it('should create handler with proper dependencies', () => {
      expect(handler).toBeInstanceOf(RemoveSittingClosenessHandler);
      // Logger is wrapped by BaseOperationHandler, so we check it exists
      expect(handler.logger).toBeDefined();
    });

    it('should validate entity manager methods', () => {
      expect(() => {
        new RemoveSittingClosenessHandler({
          logger: mockLogger,
          entityManager: { getComponentData: jest.fn() }, // Missing methods
          safeEventDispatcher: mockDispatcher,
          closenessCircleService: mockClosenessCircleService,
        });
      }).toThrow();
    });

    it('should validate dispatcher methods', () => {
      expect(() => {
        new RemoveSittingClosenessHandler({
          logger: mockLogger,
          entityManager: mockEntityManager,
          safeEventDispatcher: { invalid: jest.fn() }, // Missing dispatch
          closenessCircleService: mockClosenessCircleService,
        });
      }).toThrow();
    });
  });

  describe('Parameter Validation', () => {
    it('should validate required parameters', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
      };

      // Mock furniture component first (for validation)
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:couch' &&
            componentType === 'sitting:allows_sitting'
          ) {
            return { spots: [null, null, null] }; // Valid furniture component
          }
          return null; // Actor has no closeness component
        }
      );

      await handler.execute(parameters, executionContext);

      expect(proximityUtils.validateProximityParameters).toHaveBeenCalledWith(
        'furniture:couch',
        'game:alice',
        1,
        mockLogger
      );
    });

    it('should handle parameter validation failure', async () => {
      const parameters = {
        furniture_id: '',
        actor_id: 'game:alice',
        spot_index: 1,
      };

      proximityUtils.validateProximityParameters.mockImplementation(() => {
        throw new Error('Invalid furniture_id');
      });

      await handler.execute(parameters, executionContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to remove sitting closeness',
        expect.objectContaining({
          error: 'Invalid furniture_id',
        })
      );
      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'REMOVE_SITTING_CLOSENESS_FAILED',
        expect.objectContaining({
          reason: 'Invalid furniture_id',
        }),
        mockLogger
      );
    });
  });

  describe('No Closeness Component Handling', () => {
    it('should handle actor with no closeness component gracefully', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
        result_variable: 'operation_result',
      };

      // Mock furniture component first (for validation)
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:couch' &&
            componentType === 'sitting:allows_sitting'
          ) {
            return { spots: [null, 'game:bob', null] }; // Valid furniture component
          }
          return null; // Actor has no closeness component
        }
      );

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No closeness relationships to remove',
        expect.objectContaining({
          actorId: 'game:alice',
        })
      );
      expect(contextVariableUtils.tryWriteContextVariable).toHaveBeenCalledWith(
        'operation_result',
        true,
        executionContext,
        mockDispatcher,
        mockLogger
      );
    });

    it('should handle actor with empty partners array', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:couch' &&
            componentType === 'sitting:allows_sitting'
          ) {
            return { spots: [null, 'game:bob', null] }; // Valid furniture component
          }
          if (
            entityId === 'game:alice' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: [] }; // Empty partners array
          }
          return null;
        }
      );

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No closeness relationships to remove',
        expect.objectContaining({
          actorId: 'game:alice',
        })
      );
    });

    it('should handle actor with invalid partners data', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:couch' &&
            componentType === 'sitting:allows_sitting'
          ) {
            return { spots: [null, null, null] }; // Valid furniture component
          }
          if (
            entityId === 'game:alice' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: 'invalid-data' }; // Invalid partners data
          }
          return null;
        }
      );

      await handler.execute(parameters, executionContext);

      // Invalid partners data should cause validation error and be handled in catch block
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to remove sitting closeness',
        expect.objectContaining({
          actorId: 'game:alice',
          error: expect.stringContaining('invalid closeness partners array'),
        })
      );
      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'REMOVE_SITTING_CLOSENESS_FAILED',
        expect.objectContaining({
          actorId: 'game:alice',
          reason: expect.stringContaining('invalid closeness partners array'),
        }),
        mockLogger
      );
    });

    it('should handle missing evaluation context for result variable in no-closeness case', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
        result_variable: 'operation_result',
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:couch' &&
            componentType === 'sitting:allows_sitting'
          ) {
            return { spots: [null, null, null] }; // Valid furniture component
          }
          if (
            entityId === 'game:alice' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: [] }; // Empty partners array
          }
          return null;
        }
      );
      evaluationContextUtils.ensureEvaluationContext.mockReturnValue(false);

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No closeness relationships to remove',
        expect.objectContaining({
          actorId: 'game:alice',
        })
      );
      expect(
        contextVariableUtils.tryWriteContextVariable
      ).not.toHaveBeenCalled();
    });

    it('should handle successful no-closeness case with available evaluation context', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
        result_variable: 'operation_result',
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:couch' &&
            componentType === 'sitting:allows_sitting'
          ) {
            return { spots: [null, null, null] }; // Valid furniture component
          }
          if (
            entityId === 'game:alice' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: [] }; // Empty partners array
          }
          return null;
        }
      );
      evaluationContextUtils.ensureEvaluationContext.mockReturnValue(true);

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No closeness relationships to remove',
        expect.objectContaining({
          actorId: 'game:alice',
        })
      );
      expect(contextVariableUtils.tryWriteContextVariable).toHaveBeenCalledWith(
        'operation_result',
        true,
        executionContext,
        mockDispatcher,
        mockLogger
      );
    });
  });

  describe('Former Adjacent Actor Detection', () => {
    it('should identify formerly adjacent actors correctly', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:bob',
        spot_index: 1,
      };

      // Bob is standing up from spot 1, Alice and Charlie are adjacent
      const furnitureComponent = {
        spots: ['game:alice', null, 'game:charlie'],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:alice', 'game:charlie'] }) // Second call: Bob's closeness
        .mockReturnValueOnce(furnitureComponent) // Third call: furniture for adjacent detection
        .mockReturnValueOnce({ partners: ['game:alice', 'game:charlie'] }) // Fourth call: Bob's closeness for processing
        .mockReturnValueOnce({ partners: ['game:bob', 'game:charlie'] }) // Fifth call: Alice's closeness
        .mockReturnValueOnce({ partners: ['game:alice', 'game:bob'] }) // Sixth call: Charlie's closeness
        .mockReturnValueOnce(null) // Seventh call: Bob has no closeness after removal
        .mockReturnValueOnce({ partners: ['game:charlie'] }) // Eighth call: Alice still has Charlie
        .mockReturnValueOnce({ partners: ['game:alice'] }); // Ninth call: Charlie still has Alice

      proximityUtils.getAdjacentSpots.mockReturnValue([0, 2]); // Adjacent to spot 1

      // Mock repair to return proper cleaned arrays
      closenessCircleService.repair
        .mockReturnValueOnce([]) // Bob loses all sitting partners
        .mockReturnValueOnce(['game:charlie']) // Alice keeps Charlie (non-adjacent)
        .mockReturnValueOnce(['game:alice']); // Charlie keeps Alice (non-adjacent)

      await handler.execute(parameters, executionContext);

      expect(proximityUtils.getAdjacentSpots).toHaveBeenCalledWith(1, 3);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Sitting closeness removed successfully',
        expect.objectContaining({
          formerAdjacentActors: ['game:alice', 'game:charlie'],
        })
      );
    });

    it('should handle edge position departures', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: [null, 'game:bob', null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Second call: Alice's closeness
        .mockReturnValueOnce(furnitureComponent) // Third call: furniture for adjacent detection
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice'] }) // Fifth call: Bob's closeness
        .mockReturnValueOnce(null) // Sixth call: Alice after removal
        .mockReturnValueOnce(null); // Seventh call: Bob after removal

      proximityUtils.getAdjacentSpots.mockReturnValue([1]); // Only spot 1 adjacent to spot 0
      mockClosenessCircleService.repair
        .mockReturnValueOnce([]) // Alice has no partners left
        .mockReturnValueOnce([]); // Bob has no partners left

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Sitting closeness removed successfully',
        expect.objectContaining({
          formerAdjacentActors: ['game:bob'],
        })
      );
    });

    it('should handle no formerly adjacent actors', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: [null, null, null], // All spots empty
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:distant'] }) // Second call: Alice's closeness
        .mockReturnValueOnce(furnitureComponent); // Third call: furniture for adjacent detection

      proximityUtils.getAdjacentSpots.mockReturnValue([1]); // Adjacent spot is empty

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No formerly adjacent actors found',
        expect.objectContaining({
          actorId: 'game:alice',
        })
      );
    });

    it('should store successful result when formerly adjacent actors list is empty', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 0,
        result_variable: 'operation_result',
      };

      const furnitureComponent = {
        spots: ['game:alice', 'game:bob', null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValueOnce({ partners: ['game:bob'] })
        .mockReturnValueOnce({});

      evaluationContextUtils.ensureEvaluationContext.mockReturnValue(true);

      await handler.execute(parameters, executionContext);

      expect(proximityUtils.getAdjacentSpots).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No formerly adjacent actors found',
        expect.objectContaining({
          actorId: 'game:alice',
        })
      );
      expect(contextVariableUtils.tryWriteContextVariable).toHaveBeenCalledWith(
        'operation_result',
        true,
        executionContext,
        mockDispatcher,
        mockLogger
      );
    });

    it('should handle missing furniture component', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
      };

      mockEntityManager.getComponentData.mockReturnValueOnce(null); // Missing furniture component causes validation error

      await handler.execute(parameters, executionContext);

      // Missing furniture should cause validation error and be handled in catch block
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to remove sitting closeness',
        expect.objectContaining({
          actorId: 'game:alice',
          error: expect.stringContaining('missing allows_sitting component'),
        })
      );
      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'REMOVE_SITTING_CLOSENESS_FAILED',
        expect.objectContaining({
          actorId: 'game:alice',
          reason: expect.stringContaining('missing allows_sitting component'),
        }),
        mockLogger
      );
    });
  });

  describe('Selective Closeness Removal', () => {
    it('should remove only sitting-based closeness relationships', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
      };

      const furnitureComponent = {
        spots: ['game:bob', null, 'game:charlie'],
      };

      // Alice was sitting adjacent to Bob, has manual relationship with David
      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob', 'game:david'] }) // Second call: Alice's closeness
        .mockReturnValueOnce(furnitureComponent) // Third call: furniture for adjacent detection
        .mockReturnValueOnce({ partners: ['game:bob', 'game:david'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice', 'game:charlie'] }) // Fifth call: Bob's partners
        .mockReturnValueOnce(null) // Sixth call: David's closeness (not adjacent, no component)
        .mockReturnValueOnce({ partners: ['game:david'] }) // Seventh call: Alice final state validation
        .mockReturnValueOnce({ partners: ['game:charlie'] }); // Eighth call: Bob final state validation

      proximityUtils.getAdjacentSpots.mockReturnValue([0, 2]); // Adjacent spots
      mockClosenessCircleService.repair
        .mockReturnValueOnce(['game:david']) // Alice keeps David
        .mockReturnValueOnce(['game:charlie']); // Bob keeps Charlie

      await handler.execute(parameters, executionContext);

      // Verify component updates
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'game:alice',
        'positioning:closeness',
        { partners: ['game:david'] }
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'game:bob',
        'positioning:closeness',
        { partners: ['game:charlie'] }
      );
    });

    it('should maintain bidirectional relationship consistency', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: [null, 'game:bob', null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Second call: Alice's closeness
        .mockReturnValueOnce(furnitureComponent) // Third call: furniture for adjacent detection
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice'] }) // Fifth call: Bob's partners
        .mockReturnValueOnce(null) // Sixth call: Alice final state (no component after removal)
        .mockReturnValueOnce(null); // Seventh call: Bob final state (no component after removal)

      proximityUtils.getAdjacentSpots.mockReturnValue([1]);
      mockClosenessCircleService.repair
        .mockReturnValueOnce([]) // Alice has no partners left
        .mockReturnValueOnce([]); // Bob has no partners left

      await handler.execute(parameters, executionContext);

      // Both should have components removed
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'game:alice',
        'positioning:closeness'
      );
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'game:bob',
        'positioning:closeness'
      );
    });

    it('should handle validation failure for duplicate partners in closeness component', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
      };

      const furnitureComponent = {
        spots: ['game:bob', null, null],
      };

      // Set up mocks to return invalid data (duplicates should cause validation error)
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:couch' &&
            componentType === 'sitting:allows_sitting'
          ) {
            return furnitureComponent;
          }
          if (
            entityId === 'game:alice' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['game:bob', 'game:charlie', 'game:bob'] }; // Duplicate partners trigger validation error
          }
          if (
            entityId === 'game:bob' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['game:alice'] };
          }
          return null;
        }
      );

      proximityUtils.getAdjacentSpots.mockReturnValue([0]); // Bob is adjacent at spot 0

      await handler.execute(parameters, executionContext);

      // Verify that validation errors were logged (duplicate partners detected)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to remove sitting closeness',
        expect.objectContaining({
          actorId: 'game:alice',
          error: expect.stringContaining('duplicate partners'),
        })
      );

      // Verify that an error dispatch occurred
      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'REMOVE_SITTING_CLOSENESS_FAILED',
        expect.objectContaining({
          actorId: 'game:alice',
          reason: expect.stringContaining('duplicate partners'),
        }),
        mockLogger
      );
    });
  });

  describe('Component Management', () => {
    it('should remove closeness component when no partners remain', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: [null, 'game:bob', null],
      };

      // Set up mocks to return data when called
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:couch' &&
            componentType === 'sitting:allows_sitting'
          ) {
            return furnitureComponent;
          }
          if (
            entityId === 'game:alice' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['game:bob'] };
          }
          if (
            entityId === 'game:bob' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['game:alice'] };
          }
          // For final state validation and movement lock checks
          return null;
        }
      );

      proximityUtils.getAdjacentSpots.mockReturnValue([1]); // Bob is adjacent at spot 1
      mockClosenessCircleService.repair.mockReturnValue([]); // No partners left after filtering for both actors

      await handler.execute(parameters, executionContext);

      // Verify that at least one component was removed
      expect(mockEntityManager.removeComponent).toHaveBeenCalled();

      // Verify no errors were logged
      expect(mockLogger.error).not.toHaveBeenCalled();

      // Verify the operation was successful
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('removed successfully'),
        expect.any(Object)
      );
    });

    it('should update movement locks appropriately', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: [null, 'game:bob', null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Second call: Alice's closeness
        .mockReturnValueOnce(furnitureComponent) // Third call: furniture for adjacent detection
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice'] }) // Fifth call: Bob's partners
        .mockReturnValueOnce(null) // Sixth call: Alice final state validation
        .mockReturnValueOnce(null) // Seventh call: Bob final state validation
        .mockReturnValueOnce(null) // Eighth call: Alice movement lock check
        .mockReturnValueOnce(null); // Ninth call: Bob movement lock check

      proximityUtils.getAdjacentSpots.mockReturnValue([1]);
      mockClosenessCircleService.repair
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      await handler.execute(parameters, executionContext);

      expect(movementUtils.updateMovementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'game:alice',
        false
      );
      expect(movementUtils.updateMovementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'game:bob',
        false
      );
    });

    it('should handle movement lock update errors gracefully', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: [null, 'game:bob', null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Second call: Alice's closeness
        .mockReturnValueOnce(furnitureComponent) // Third call: furniture for adjacent detection
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice'] }) // Fifth call: Bob's partners
        .mockReturnValueOnce(null) // Sixth call: Alice final state validation
        .mockReturnValueOnce(null) // Seventh call: Bob final state validation
        .mockReturnValueOnce(null) // Eighth call: Alice movement lock check
        .mockReturnValueOnce(null); // Ninth call: Bob movement lock check

      proximityUtils.getAdjacentSpots.mockReturnValue([1]);
      mockClosenessCircleService.repair
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      movementUtils.updateMovementLock.mockRejectedValueOnce(
        new Error('Movement update failed')
      );

      await handler.execute(parameters, executionContext);

      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'REMOVE_SITTING_CLOSENESS: failed updating movement lock',
        expect.objectContaining({
          actorId: 'game:alice',
          error: 'Movement update failed',
        }),
        expect.any(Object) // Logger is wrapped by BaseOperationHandler
      );
    });

    it('should call movement lock updates during operation', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: [null, 'game:bob', null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Second call: Alice's initial closeness
        .mockReturnValueOnce(furnitureComponent) // Third call: furniture component for adjacent detection
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice'] }) // Fifth call: Bob for processing
        .mockReturnValueOnce(null) // Sixth call: Alice final state validation
        .mockReturnValueOnce(null) // Seventh call: Bob final state validation
        // Movement lock checking phase:
        .mockReturnValueOnce(null) // Eighth call: Alice has no partners left after removal
        .mockReturnValueOnce(null); // Ninth call: Bob has no partners left

      proximityUtils.getAdjacentSpots.mockReturnValue([1]); // Spot 1 is adjacent to spot 0
      mockClosenessCircleService.repair
        .mockReturnValueOnce([]) // Alice has no partners
        .mockReturnValueOnce([]); // Bob has no partners

      await handler.execute(parameters, executionContext);

      // Both actors should have movement unlocked since they have no partners
      expect(movementUtils.updateMovementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'game:alice',
        false
      );
      expect(movementUtils.updateMovementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'game:bob',
        false
      );
    });

    it('should default departing actor partner data to empty when component missing during removal', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: ['game:alice', 'game:bob'],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValueOnce({ partners: ['game:bob'] })
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ partners: ['game:alice'] })
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);

      proximityUtils.getAdjacentSpots.mockReturnValue([1]);

      await handler.execute(parameters, executionContext);

      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'game:alice',
        'positioning:closeness'
      );
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'game:bob',
        'positioning:closeness'
      );
      expect(movementUtils.updateMovementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'game:alice',
        false
      );
      expect(movementUtils.updateMovementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'game:bob',
        false
      );
    });
  });

  describe('Result Variable Handling', () => {
    it('should store success result when requested', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
        result_variable: 'removal_result',
      };

      // Mock furniture component first (for validation)
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:couch' &&
            componentType === 'sitting:allows_sitting'
          ) {
            return { spots: [null, null, null] }; // Valid furniture component
          }
          return null; // Actor has no closeness component
        }
      );

      await handler.execute(parameters, executionContext);

      expect(contextVariableUtils.tryWriteContextVariable).toHaveBeenCalledWith(
        'removal_result',
        true,
        executionContext,
        mockDispatcher,
        mockLogger
      );
    });

    it('should store failure result on error', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
        result_variable: 'removal_result',
      };

      proximityUtils.validateProximityParameters.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      await handler.execute(parameters, executionContext);

      expect(contextVariableUtils.tryWriteContextVariable).toHaveBeenCalledWith(
        'removal_result',
        false,
        executionContext,
        mockDispatcher,
        mockLogger
      );
    });

    it('should handle missing evaluation context', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
        result_variable: 'removal_result',
      };

      // Mock furniture component first (for validation)
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:couch' &&
            componentType === 'sitting:allows_sitting'
          ) {
            return { spots: [null, null, null] }; // Valid furniture component
          }
          return null; // Actor has no closeness component
        }
      );
      evaluationContextUtils.ensureEvaluationContext.mockReturnValue(false);

      await handler.execute(parameters, executionContext);

      expect(
        contextVariableUtils.tryWriteContextVariable
      ).not.toHaveBeenCalled();
    });

    it('should handle successful operation with missing evaluation context for result variable', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 0,
        result_variable: 'removal_result',
      };

      const furnitureComponent = {
        spots: [null, 'game:bob', null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Second call: Alice's closeness
        .mockReturnValueOnce(furnitureComponent) // Third call: furniture for adjacent detection
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice'] }) // Fifth call: Bob for processing
        .mockReturnValueOnce(null) // Sixth call: Alice final state validation
        .mockReturnValueOnce(null) // Seventh call: Bob final state validation
        .mockReturnValueOnce(null) // Eighth call: Alice movement lock check
        .mockReturnValueOnce(null); // Ninth call: Bob movement lock check

      proximityUtils.getAdjacentSpots.mockReturnValue([1]);
      mockClosenessCircleService.repair
        .mockReturnValueOnce([]) // Alice has no partners
        .mockReturnValueOnce([]); // Bob has no partners

      evaluationContextUtils.ensureEvaluationContext.mockReturnValue(false);

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Sitting closeness removed successfully',
        expect.any(Object)
      );
      expect(
        contextVariableUtils.tryWriteContextVariable
      ).not.toHaveBeenCalled();
    });

    it('should handle successful operation and write result variable when context is available', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 0,
        result_variable: 'removal_result',
      };

      const furnitureComponent = {
        spots: [null, 'game:bob', null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Second call: Alice's closeness
        .mockReturnValueOnce(furnitureComponent) // Third call: furniture for adjacent detection
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice'] }) // Fifth call: Bob for processing
        .mockReturnValueOnce(null) // Sixth call: Alice final state validation
        .mockReturnValueOnce(null) // Seventh call: Bob final state validation
        .mockReturnValueOnce(null) // Eighth call: Alice movement lock check
        .mockReturnValueOnce(null); // Ninth call: Bob movement lock check

      proximityUtils.getAdjacentSpots.mockReturnValue([1]);
      mockClosenessCircleService.repair
        .mockReturnValueOnce([]) // Alice has no partners
        .mockReturnValueOnce([]); // Bob has no partners

      evaluationContextUtils.ensureEvaluationContext.mockReturnValue(true);

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Sitting closeness removed successfully',
        expect.any(Object)
      );
      expect(contextVariableUtils.tryWriteContextVariable).toHaveBeenCalledWith(
        'removal_result',
        true,
        executionContext,
        mockDispatcher,
        mockLogger
      );
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle concurrent standing operations', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
      };

      const furnitureComponent = {
        spots: [null, null, 'game:charlie'], // Bob already stood up
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob', 'game:charlie'] }) // Second call: Alice's partners
        .mockReturnValueOnce(furnitureComponent) // Third call: furniture for adjacent detection
        .mockReturnValueOnce({ partners: ['game:bob', 'game:charlie'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice'] }) // Fifth call: Charlie's partners
        .mockReturnValueOnce(null) // Sixth call: Bob's closeness (not adjacent, no component)
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Seventh call: Alice final state validation
        .mockReturnValueOnce(null) // Eighth call: Charlie final state validation (no component)
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Ninth call: Alice movement lock check
        .mockReturnValueOnce(null); // Tenth call: Charlie movement lock check

      proximityUtils.getAdjacentSpots.mockReturnValue([0, 2]); // Adjacent spots
      mockClosenessCircleService.repair
        .mockReturnValueOnce(['game:bob']) // Alice keeps Bob (not adjacent anymore)
        .mockReturnValueOnce([]); // Charlie loses Alice

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Sitting closeness removed successfully',
        expect.objectContaining({
          formerAdjacentActors: ['game:charlie'], // Only Charlie was still adjacent
        })
      );
    });

    it('should preserve chain closeness when middle actor stands', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:bob',
        spot_index: 1,
      };

      const furnitureComponent = {
        spots: ['game:alice', null, 'game:charlie'],
      };

      // Set up mocks to return data when called
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:couch' &&
            componentType === 'sitting:allows_sitting'
          ) {
            return furnitureComponent;
          }
          if (
            entityId === 'game:bob' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['game:alice', 'game:charlie'] };
          }
          if (
            entityId === 'game:alice' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['game:bob', 'game:charlie'] };
          }
          if (
            entityId === 'game:charlie' &&
            componentType === 'positioning:closeness'
          ) {
            return { partners: ['game:alice', 'game:bob'] };
          }
          // For final state validation and movement lock checks
          return null;
        }
      );

      proximityUtils.getAdjacentSpots.mockReturnValue([0, 2]); // Alice and Charlie are adjacent
      mockClosenessCircleService.repair
        .mockReturnValueOnce([]) // Bob loses all adjacent partners
        .mockReturnValueOnce(['game:charlie']) // Alice keeps Charlie (non-adjacent relationship)
        .mockReturnValueOnce(['game:alice']); // Charlie keeps Alice (non-adjacent relationship)

      await handler.execute(parameters, executionContext);

      // Bob should have his component removed since no partners remain
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'game:bob',
        'positioning:closeness'
      );

      // Alice and Charlie should keep their components with each other
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'game:alice',
        'positioning:closeness',
        { partners: ['game:charlie'] }
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'game:charlie',
        'positioning:closeness',
        { partners: ['game:alice'] }
      );

      // Verify the total number of component operations
      expect(mockEntityManager.removeComponent).toHaveBeenCalledTimes(1); // Only Bob
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(2); // Alice and Charlie
    });
  });

  describe('Edge Cases', () => {
    it('should handle single-spot furniture', async () => {
      const parameters = {
        furniture_id: 'furniture:chair',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: [null], // Single spot, now empty
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call: furniture component for validation
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Second call: Alice's closeness
        .mockReturnValueOnce(furnitureComponent); // Third call: furniture for adjacent detection

      proximityUtils.getAdjacentSpots.mockReturnValue([]); // No adjacent spots on single-spot furniture

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No formerly adjacent actors found',
        expect.objectContaining({
          actorId: 'game:alice',
        })
      );
    });

    it('should handle empty furniture spots array', async () => {
      const parameters = {
        furniture_id: 'furniture:broken',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      const furnitureComponent = {
        spots: [], // Empty spots array fails validation
      };

      mockEntityManager.getComponentData.mockReturnValueOnce(
        furnitureComponent
      ); // First call gets furniture

      await handler.execute(parameters, executionContext);

      // Empty spots array should cause validation error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to remove sitting closeness',
        expect.objectContaining({
          actorId: 'game:alice',
          error: expect.stringContaining('has empty spots array'),
        })
      );
      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'REMOVE_SITTING_CLOSENESS_FAILED',
        expect.objectContaining({
          actorId: 'game:alice',
          reason: expect.stringContaining('has empty spots array'),
        }),
        mockLogger
      );
    });

    it('should handle malformed closeness component data', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
      };

      const furnitureComponent = {
        spots: ['game:bob', null, null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce(furnitureComponent) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Second call: Alice's closeness
        .mockReturnValueOnce(furnitureComponent) // Third call: furniture for adjacent detection
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: 'invalid-data' }) // Fifth call: Bob's malformed data
        .mockReturnValueOnce(null) // Sixth call: Alice final state validation
        .mockReturnValueOnce(null); // Seventh call: Alice movement lock check

      proximityUtils.getAdjacentSpots.mockReturnValue([0]);
      mockClosenessCircleService.repair.mockReturnValueOnce([]);

      await handler.execute(parameters, executionContext);

      // Should complete successfully, ignoring malformed data
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Sitting closeness removed successfully',
        expect.anything()
      );
    });
  });
});
