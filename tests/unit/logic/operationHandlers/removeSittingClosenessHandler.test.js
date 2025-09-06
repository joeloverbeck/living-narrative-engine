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

// Mock dependencies
jest.mock('../../../../src/utils/proximityUtils.js');
jest.mock('../../../../src/utils/movementUtils.js', () => ({
  updateMovementLock: jest.fn(),
}));
jest.mock('../../../../src/utils/contextVariableUtils.js');
jest.mock('../../../../src/utils/evaluationContextUtils.js');
jest.mock('../../../../src/utils/safeDispatchErrorUtils.js');

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
    mockClosenessCircleService = {
      repair: jest.fn(),
      merge: jest.fn(),
    };

    // Setup execution context
    executionContext = {
      logger: mockLogger,
    };

    // Setup mocks
    proximityUtils.validateProximityParameters.mockReturnValue(true);
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

      mockEntityManager.getComponentData.mockReturnValue(null);

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

      mockEntityManager.getComponentData.mockReturnValue(null);

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

      mockEntityManager.getComponentData.mockReturnValue({
        partners: [],
      });

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

      mockEntityManager.getComponentData.mockReturnValue({
        partners: 'invalid-data',
      });

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No closeness relationships to remove',
        expect.objectContaining({
          actorId: 'game:alice',
        })
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
        .mockReturnValueOnce({ partners: ['game:alice', 'game:charlie'] }) // Bob's closeness
        .mockReturnValueOnce(furnitureComponent); // Furniture component

      proximityUtils.getAdjacentSpots.mockReturnValue([0, 2]); // Adjacent to spot 1

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
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Alice's closeness
        .mockReturnValueOnce(furnitureComponent); // Furniture component

      proximityUtils.getAdjacentSpots.mockReturnValue([1]); // Only spot 1 adjacent to spot 0

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
        spots: [null, null, null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ partners: ['game:distant'] }) // Alice's closeness
        .mockReturnValueOnce(furnitureComponent); // Furniture component

      proximityUtils.getAdjacentSpots.mockReturnValue([1]); // Adjacent spot is empty

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No formerly adjacent actors found',
        expect.objectContaining({
          actorId: 'game:alice',
        })
      );
    });

    it('should handle missing furniture component', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Alice's closeness
        .mockReturnValueOnce(null); // Missing furniture component

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No formerly adjacent actors found',
        expect.objectContaining({
          actorId: 'game:alice',
        })
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
        .mockReturnValueOnce({ partners: ['game:bob', 'game:david'] }) // Alice's closeness
        .mockReturnValueOnce(furnitureComponent) // Furniture component
        .mockReturnValueOnce({ partners: ['game:alice', 'game:bob'] }) // Alice's partners for processing
        .mockReturnValueOnce({ partners: ['game:alice', 'game:charlie'] }); // Bob's partners

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
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Alice's closeness
        .mockReturnValueOnce(furnitureComponent) // Furniture component
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Alice's partners for processing
        .mockReturnValueOnce({ partners: ['game:alice'] }); // Bob's partners

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

    it('should deduplicate and sort partner arrays after removal', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
      };

      const furnitureComponent = {
        spots: ['game:bob', null, null],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ partners: ['game:bob', 'game:charlie', 'game:bob'] }) // Alice with duplicates
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValueOnce({ partners: ['game:bob', 'game:charlie', 'game:bob'] }) // Alice's partners
        .mockReturnValueOnce({ partners: ['game:alice'] }); // Bob's partners

      proximityUtils.getAdjacentSpots.mockReturnValue([0]);
      mockClosenessCircleService.repair
        .mockReturnValueOnce(['game:charlie']) // Repair removes duplicates and sorts
        .mockReturnValueOnce([]); // Bob has no partners left

      await handler.execute(parameters, executionContext);

      expect(mockClosenessCircleService.repair).toHaveBeenCalledWith(['game:charlie']);
      expect(mockClosenessCircleService.repair).toHaveBeenCalledWith([]);
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

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Alice's only partner
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValueOnce({ partners: ['game:bob'] })
        .mockReturnValueOnce({ partners: ['game:alice'] });

      proximityUtils.getAdjacentSpots.mockReturnValue([1]);
      mockClosenessCircleService.repair
        .mockReturnValueOnce([]) // No partners left for Alice
        .mockReturnValueOnce([]); // No partners left for Bob

      await handler.execute(parameters, executionContext);

      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'game:alice',
        'positioning:closeness'
      );
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'game:bob',
        'positioning:closeness'
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
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Alice's closeness
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValueOnce({ partners: ['game:bob'] })
        .mockReturnValueOnce({ partners: ['game:alice'] })
        .mockReturnValueOnce(null) // Alice has no closeness after removal
        .mockReturnValueOnce(null); // Bob has no closeness after removal

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
        .mockReturnValueOnce({ partners: ['game:bob'] })
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValueOnce({ partners: ['game:bob'] })
        .mockReturnValueOnce({ partners: ['game:alice'] })
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);

      proximityUtils.getAdjacentSpots.mockReturnValue([1]);
      mockClosenessCircleService.repair
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      movementUtils.updateMovementLock.mockRejectedValueOnce(new Error('Movement update failed'));

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
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Alice's initial closeness 
        .mockReturnValueOnce(furnitureComponent) // Furniture component for adjacent detection
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice'] }) // Bob for processing  
        // Movement lock checking phase:
        .mockReturnValueOnce(null) // Alice has no partners left after removal
        .mockReturnValueOnce(null); // Bob has no partners left

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
  });

  describe('Result Variable Handling', () => {
    it('should store success result when requested', async () => {
      const parameters = {
        furniture_id: 'furniture:couch',
        actor_id: 'game:alice',
        spot_index: 1,
        result_variable: 'removal_result',
      };

      mockEntityManager.getComponentData.mockReturnValue(null);

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

      mockEntityManager.getComponentData.mockReturnValue(null);
      evaluationContextUtils.ensureEvaluationContext.mockReturnValue(false);

      await handler.execute(parameters, executionContext);

      expect(contextVariableUtils.tryWriteContextVariable).not.toHaveBeenCalled();
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
        .mockReturnValueOnce({ partners: ['game:bob', 'game:charlie'] }) // Alice's partners
        .mockReturnValueOnce(furnitureComponent) // Updated furniture state
        .mockReturnValueOnce({ partners: ['game:bob', 'game:charlie'] })
        .mockReturnValueOnce({ partners: ['game:alice'] }); // Charlie's partners

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

      // Bob was in middle, connected Alice and Charlie
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ partners: ['game:alice', 'game:charlie'] }) // Bob's partners
        .mockReturnValueOnce(furnitureComponent) // Furniture after Bob stood
        .mockReturnValueOnce({ partners: ['game:alice', 'game:charlie'] }) // Bob
        .mockReturnValueOnce({ partners: ['game:bob', 'game:charlie'] }) // Alice
        .mockReturnValueOnce({ partners: ['game:alice', 'game:bob'] }); // Charlie

      proximityUtils.getAdjacentSpots.mockReturnValue([0, 2]);
      mockClosenessCircleService.repair
        .mockReturnValueOnce([]) // Bob loses all partners
        .mockReturnValueOnce(['game:charlie']) // Alice keeps Charlie (if manual)
        .mockReturnValueOnce(['game:alice']); // Charlie keeps Alice (if manual)

      await handler.execute(parameters, executionContext);

      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'game:bob',
        'positioning:closeness'
      );
      // Alice and Charlie maintain their relationship if it was manual
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
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Alice had manual relationship
        .mockReturnValueOnce(furnitureComponent);

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
        spots: [],
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ partners: ['game:bob'] })
        .mockReturnValueOnce(furnitureComponent);

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No formerly adjacent actors found',
        expect.objectContaining({
          actorId: 'game:alice',
        })
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
        .mockReturnValueOnce({ partners: ['game:bob'] })
        .mockReturnValueOnce(furnitureComponent)
        .mockReturnValueOnce({ partners: ['game:bob'] })
        .mockReturnValueOnce({ partners: 'invalid-data' }); // Malformed data

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