/**
 * @file Unit tests for RemoveLyingClosenessHandler
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RemoveLyingClosenessHandler from '../../../../src/logic/operationHandlers/removeLyingClosenessHandler.js';
import * as movementUtils from '../../../../src/utils/movementUtils.js';
import * as contextVariableUtils from '../../../../src/utils/contextVariableUtils.js';
import * as evaluationContextUtils from '../../../../src/utils/evaluationContextUtils.js';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';
import * as closenessCircleService from '../../../../src/logic/services/closenessCircleService.js';

// Mock dependencies
jest.mock('../../../../src/utils/movementUtils.js', () => ({
  updateMovementLock: jest.fn(),
}));
jest.mock('../../../../src/utils/contextVariableUtils.js');
jest.mock('../../../../src/utils/evaluationContextUtils.js');
jest.mock('../../../../src/utils/safeDispatchErrorUtils.js');
jest.mock('../../../../src/logic/services/closenessCircleService.js');

describe('RemoveLyingClosenessHandler', () => {
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
      getEntitiesWithComponent: jest.fn(),
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
    movementUtils.updateMovementLock.mockResolvedValue({});
    contextVariableUtils.tryWriteContextVariable.mockReturnValue(true);
    evaluationContextUtils.ensureEvaluationContext.mockReturnValue(true);

    // Create handler instance
    handler = new RemoveLyingClosenessHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
      closenessCircleService: mockClosenessCircleService,
    });
  });

  describe('constructor', () => {
    it('should create handler with proper dependencies', () => {
      expect(handler).toBeInstanceOf(RemoveLyingClosenessHandler);
      // Logger is wrapped by BaseOperationHandler, so we check it exists
      expect(handler.logger).toBeDefined();
    });

    it('should validate entity manager methods', () => {
      expect(() => {
        new RemoveLyingClosenessHandler({
          logger: mockLogger,
          entityManager: { getComponentData: jest.fn() }, // Missing methods
          safeEventDispatcher: mockDispatcher,
          closenessCircleService: mockClosenessCircleService,
        });
      }).toThrow();
    });

    it('should validate dispatcher methods', () => {
      expect(() => {
        new RemoveLyingClosenessHandler({
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
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
      };

      // Mock furniture component first (for validation)
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:bed' &&
            componentType === 'lying:allows_lying_on'
          ) {
            return {}; // Valid furniture component
          }
          return null; // Actor has no closeness component
        }
      );
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      await handler.execute(parameters, executionContext);

      // Should complete without parameter validation errors
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          error: expect.stringContaining('validation failed'),
        })
      );
    });

    it('should handle parameter validation failure for missing furniture_id', async () => {
      const parameters = {
        furniture_id: '',
        actor_id: 'game:alice',
      };

      await handler.execute(parameters, executionContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to remove lying closeness',
        expect.objectContaining({
          error: expect.stringContaining('Parameter validation failed'),
        })
      );
      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'REMOVE_LYING_CLOSENESS_FAILED',
        expect.objectContaining({
          reason: expect.stringContaining('Parameter validation failed'),
        }),
        mockLogger
      );
    });

    it('should handle parameter validation failure for missing actor_id', async () => {
      const parameters = {
        furniture_id: 'furniture:bed',
        actor_id: '',
      };

      await handler.execute(parameters, executionContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to remove lying closeness',
        expect.objectContaining({
          error: expect.stringContaining('Parameter validation failed'),
        })
      );
      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'REMOVE_LYING_CLOSENESS_FAILED',
        expect.objectContaining({
          reason: expect.stringContaining('Parameter validation failed'),
        }),
        mockLogger
      );
    });
  });

  describe('No Closeness Component Handling', () => {
    it('should handle actor with no closeness component gracefully', async () => {
      const parameters = {
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
        result_variable: 'operation_result',
      };

      // Mock furniture component first (for validation)
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:bed' &&
            componentType === 'lying:allows_lying_on'
          ) {
            return {}; // Valid furniture component
          }
          return null; // Actor has no closeness component
        }
      );
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

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
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:bed' &&
            componentType === 'lying:allows_lying_on'
          ) {
            return {}; // Valid furniture component
          }
          if (
            entityId === 'game:alice' &&
            componentType === 'personal-space-states:closeness'
          ) {
            return { partners: [] }; // Empty partners array
          }
          return null;
        }
      );
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

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
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:bed' &&
            componentType === 'lying:allows_lying_on'
          ) {
            return {}; // Valid furniture component
          }
          if (
            entityId === 'game:alice' &&
            componentType === 'personal-space-states:closeness'
          ) {
            return { partners: 'invalid-data' }; // Invalid partners data
          }
          return null;
        }
      );

      await handler.execute(parameters, executionContext);

      // Invalid partners data should cause validation error and be handled in catch block
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to remove lying closeness',
        expect.objectContaining({
          actorId: 'game:alice',
          error: expect.stringContaining('invalid closeness partners array'),
        })
      );
      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'REMOVE_LYING_CLOSENESS_FAILED',
        expect.objectContaining({
          actorId: 'game:alice',
          reason: expect.stringContaining('invalid closeness partners array'),
        }),
        mockLogger
      );
    });

    it('should handle missing evaluation context for result variable in no-closeness case', async () => {
      const parameters = {
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
        result_variable: 'operation_result',
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:bed' &&
            componentType === 'lying:allows_lying_on'
          ) {
            return {}; // Valid furniture component
          }
          if (
            entityId === 'game:alice' &&
            componentType === 'personal-space-states:closeness'
          ) {
            return { partners: [] }; // Empty partners array
          }
          return null;
        }
      );
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);
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
  });

  describe('Missing Furniture Component Validation', () => {
    it('should handle missing furniture component', async () => {
      const parameters = {
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
      };

      mockEntityManager.getComponentData.mockReturnValueOnce(null); // Missing furniture component causes validation error

      await handler.execute(parameters, executionContext);

      // Missing furniture should cause validation error and be handled in catch block
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to remove lying closeness',
        expect.objectContaining({
          actorId: 'game:alice',
          error: expect.stringContaining('missing allows_lying_on component'),
        })
      );
      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'REMOVE_LYING_CLOSENESS_FAILED',
        expect.objectContaining({
          actorId: 'game:alice',
          reason: expect.stringContaining('missing allows_lying_on component'),
        }),
        mockLogger
      );
    });
  });

  describe('Former Lying Actor Detection', () => {
    it('should identify formerly lying actors correctly', async () => {
      const parameters = {
        furniture_id: 'furniture:bed',
        actor_id: 'game:bob',
      };

      // Bob is standing up, Alice and Charlie are still lying on the same bed
      mockEntityManager.getComponentData
        .mockReturnValueOnce({}) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:alice', 'game:charlie'] }) // Second call: Bob's closeness
        .mockReturnValueOnce({ furniture_id: 'furniture:bed' }) // Alice's lying_down
        .mockReturnValueOnce({ furniture_id: 'furniture:bed' }) // Charlie's lying_down
        .mockReturnValueOnce({ partners: ['game:alice', 'game:charlie'] }) // Fourth call: Bob's closeness for processing
        .mockReturnValueOnce({ partners: ['game:bob', 'game:charlie'] }) // Fifth call: Alice's closeness
        .mockReturnValueOnce({ partners: ['game:alice', 'game:bob'] }) // Sixth call: Charlie's closeness
        .mockReturnValueOnce(null) // Seventh call: Bob has no closeness after removal
        .mockReturnValueOnce({ partners: ['game:charlie'] }) // Eighth call: Alice still has Charlie
        .mockReturnValueOnce({ partners: ['game:alice'] }); // Ninth call: Charlie still has Alice

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'game:alice' },
        { id: 'game:charlie' },
      ]);

      // Mock repair to return proper cleaned arrays
      closenessCircleService.repair
        .mockReturnValueOnce([]) // Bob loses all lying partners
        .mockReturnValueOnce(['game:charlie']) // Alice keeps Charlie (both still lying)
        .mockReturnValueOnce(['game:alice']); // Charlie keeps Alice (both still lying)

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Lying closeness removed successfully',
        expect.objectContaining({
          formerLyingActors: ['game:alice', 'game:charlie'],
        })
      );
    });

    it('should handle no formerly lying actors', async () => {
      const parameters = {
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({}) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:distant'] }); // Second call: Alice's closeness

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]); // No other lying actors

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No formerly lying actors found',
        expect.objectContaining({
          actorId: 'game:alice',
        })
      );
    });

    it('should exclude departing actor from formerly lying actors', async () => {
      const parameters = {
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({}) // Furniture validation
        .mockReturnValueOnce({ partners: ['game:bob'] }); // Alice's closeness

      // Alice is in the list but should be excluded
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'game:alice' },
        { id: 'game:bob' },
      ]);

      await handler.execute(parameters, executionContext);

      // Should not fail and should process correctly
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('Selective Closeness Removal', () => {
    it('should remove only lying-based closeness relationships', async () => {
      const parameters = {
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
      };

      // Alice was lying with Bob, has manual relationship with David
      mockEntityManager.getComponentData
        .mockReturnValueOnce({}) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob', 'game:david'] }) // Second call: Alice's closeness
        .mockReturnValueOnce({ furniture_id: 'furniture:bed' }) // Bob's lying_down
        .mockReturnValueOnce({ partners: ['game:bob', 'game:david'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice', 'game:charlie'] }) // Fifth call: Bob's partners
        .mockReturnValueOnce(null) // Sixth call: David's closeness (not lying, no component)
        .mockReturnValueOnce({ partners: ['game:david'] }) // Seventh call: Alice final state validation
        .mockReturnValueOnce({ partners: ['game:charlie'] }); // Eighth call: Bob final state validation

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'game:bob' },
      ]);

      mockClosenessCircleService.repair
        .mockReturnValueOnce(['game:david']) // Alice keeps David (manual relationship)
        .mockReturnValueOnce(['game:charlie']); // Bob keeps Charlie (not Alice)

      await handler.execute(parameters, executionContext);

      // Verify component updates
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'game:alice',
        'personal-space-states:closeness',
        { partners: ['game:david'] }
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'game:bob',
        'personal-space-states:closeness',
        { partners: ['game:charlie'] }
      );
    });

    it('should maintain bidirectional relationship consistency', async () => {
      const parameters = {
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({}) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Second call: Alice's closeness
        .mockReturnValueOnce({ furniture_id: 'furniture:bed' }) // Bob's lying_down
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice'] }) // Fifth call: Bob's partners
        .mockReturnValueOnce(null) // Sixth call: Alice final state (no component after removal)
        .mockReturnValueOnce(null); // Seventh call: Bob final state (no component after removal)

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'game:bob' },
      ]);

      mockClosenessCircleService.repair
        .mockReturnValueOnce([]) // Alice has no partners left
        .mockReturnValueOnce([]); // Bob has no partners left

      await handler.execute(parameters, executionContext);

      // Both should have components removed
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'game:alice',
        'personal-space-states:closeness'
      );
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'game:bob',
        'personal-space-states:closeness'
      );
    });

    it('should handle validation failure for duplicate partners in closeness component', async () => {
      const parameters = {
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
      };

      // Set up mocks to return invalid data (duplicates should cause validation error)
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:bed' &&
            componentType === 'lying:allows_lying_on'
          ) {
            return {};
          }
          if (
            entityId === 'game:alice' &&
            componentType === 'personal-space-states:closeness'
          ) {
            return { partners: ['game:bob', 'game:charlie', 'game:bob'] }; // Duplicate partners trigger validation error
          }
          if (
            entityId === 'game:bob' &&
            componentType === 'personal-space-states:closeness'
          ) {
            return { partners: ['game:alice'] };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'game:bob' },
      ]);

      await handler.execute(parameters, executionContext);

      // Verify that validation errors were logged (duplicate partners detected)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to remove lying closeness',
        expect.objectContaining({
          actorId: 'game:alice',
          error: expect.stringContaining('duplicate partners'),
        })
      );

      // Verify that an error dispatch occurred
      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'REMOVE_LYING_CLOSENESS_FAILED',
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
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({}) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Second call: Alice's closeness
        .mockReturnValueOnce({ furniture_id: 'furniture:bed' }) // Bob's lying_down
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice'] }) // Fifth call: Bob for processing
        .mockReturnValueOnce(null) // Sixth call: Alice final state validation
        .mockReturnValueOnce(null) // Seventh call: Bob final state validation
        .mockReturnValueOnce(null) // Eighth call: Alice movement lock check
        .mockReturnValueOnce(null); // Ninth call: Bob movement lock check

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'game:bob' },
      ]);

      mockClosenessCircleService.repair
        .mockReturnValueOnce([]) // Alice has no partners left
        .mockReturnValueOnce([]); // Bob has no partners left

      await handler.execute(parameters, executionContext);

      // Verify that components were removed
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'game:alice',
        'personal-space-states:closeness'
      );
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'game:bob',
        'personal-space-states:closeness'
      );

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
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({}) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Second call: Alice's closeness
        .mockReturnValueOnce({ furniture_id: 'furniture:bed' }) // Bob's lying_down
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice'] }) // Fifth call: Bob's partners
        .mockReturnValueOnce(null) // Sixth call: Alice final state validation
        .mockReturnValueOnce(null) // Seventh call: Bob final state validation
        .mockReturnValueOnce(null) // Eighth call: Alice movement lock check
        .mockReturnValueOnce(null); // Ninth call: Bob movement lock check

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'game:bob' },
      ]);

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
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({}) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Second call: Alice's closeness
        .mockReturnValueOnce({ furniture_id: 'furniture:bed' }) // Bob's lying_down
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice'] }) // Fifth call: Bob's partners
        .mockReturnValueOnce(null) // Sixth call: Alice final state validation
        .mockReturnValueOnce(null) // Seventh call: Bob final state validation
        .mockReturnValueOnce(null) // Eighth call: Alice movement lock check
        .mockReturnValueOnce(null); // Ninth call: Bob movement lock check

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'game:bob' },
      ]);

      mockClosenessCircleService.repair
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      movementUtils.updateMovementLock.mockRejectedValueOnce(
        new Error('Movement update failed')
      );

      await handler.execute(parameters, executionContext);

      expect(safeDispatchError).toHaveBeenCalledWith(
        mockDispatcher,
        'REMOVE_LYING_CLOSENESS: failed updating movement lock',
        expect.objectContaining({
          actorId: 'game:alice',
          error: 'Movement update failed',
        }),
        expect.any(Object) // Logger is wrapped by BaseOperationHandler
      );
    });
  });

  describe('Result Variable Handling', () => {
    it('should store success result when requested', async () => {
      const parameters = {
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
        result_variable: 'removal_result',
      };

      // Mock furniture component first (for validation)
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:bed' &&
            componentType === 'lying:allows_lying_on'
          ) {
            return {}; // Valid furniture component
          }
          return null; // Actor has no closeness component
        }
      );
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

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
        furniture_id: '',
        actor_id: 'game:alice',
        result_variable: 'removal_result',
      };

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
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
        result_variable: 'removal_result',
      };

      // Mock furniture component first (for validation)
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (
            entityId === 'furniture:bed' &&
            componentType === 'lying:allows_lying_on'
          ) {
            return {}; // Valid furniture component
          }
          return null; // Actor has no closeness component
        }
      );
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);
      evaluationContextUtils.ensureEvaluationContext.mockReturnValue(false);

      await handler.execute(parameters, executionContext);

      expect(
        contextVariableUtils.tryWriteContextVariable
      ).not.toHaveBeenCalled();
    });

    it('should handle successful operation with available evaluation context', async () => {
      const parameters = {
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
        result_variable: 'removal_result',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({}) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Second call: Alice's closeness
        .mockReturnValueOnce({ furniture_id: 'furniture:bed' }) // Bob's lying_down
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Fourth call: Alice for processing
        .mockReturnValueOnce({ partners: ['game:alice'] }) // Fifth call: Bob for processing
        .mockReturnValueOnce(null) // Sixth call: Alice final state validation
        .mockReturnValueOnce(null) // Seventh call: Bob final state validation
        .mockReturnValueOnce(null) // Eighth call: Alice movement lock check
        .mockReturnValueOnce(null); // Ninth call: Bob movement lock check

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'game:bob' },
      ]);

      mockClosenessCircleService.repair
        .mockReturnValueOnce([]) // Alice has no partners
        .mockReturnValueOnce([]); // Bob has no partners

      evaluationContextUtils.ensureEvaluationContext.mockReturnValue(true);

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Lying closeness removed successfully',
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
    it('should handle three actors lying together, one gets up', async () => {
      const parameters = {
        furniture_id: 'furniture:bed',
        actor_id: 'game:bob',
      };

      // Bob, Alice, and Charlie are lying together
      // Bob gets up, Alice and Charlie should keep closeness with each other
      mockEntityManager.getComponentData
        .mockReturnValueOnce({}) // First call: furniture validation
        .mockReturnValueOnce({ partners: ['game:alice', 'game:charlie'] }) // Second call: Bob's closeness
        .mockReturnValueOnce({ furniture_id: 'furniture:bed' }) // Alice's lying_down
        .mockReturnValueOnce({ furniture_id: 'furniture:bed' }) // Charlie's lying_down
        .mockReturnValueOnce({ partners: ['game:alice', 'game:charlie'] }) // Fourth call: Bob for processing
        .mockReturnValueOnce({ partners: ['game:bob', 'game:charlie'] }) // Fifth call: Alice's closeness
        .mockReturnValueOnce({ partners: ['game:alice', 'game:bob'] }) // Sixth call: Charlie's closeness
        .mockReturnValueOnce(null) // Seventh call: Bob final state validation (no component)
        .mockReturnValueOnce({ partners: ['game:charlie'] }) // Eighth call: Alice final state validation
        .mockReturnValueOnce({ partners: ['game:alice'] }) // Ninth call: Charlie final state validation
        .mockReturnValueOnce(null) // Tenth call: Bob movement lock check
        .mockReturnValueOnce({ partners: ['game:charlie'] }) // Eleventh call: Alice movement lock check
        .mockReturnValueOnce({ partners: ['game:alice'] }); // Twelfth call: Charlie movement lock check

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'game:alice' },
        { id: 'game:charlie' },
      ]);

      // Mock repair to return proper cleaned arrays
      closenessCircleService.repair
        .mockReturnValueOnce([]) // Bob loses all lying partners
        .mockReturnValueOnce(['game:charlie']) // Alice keeps Charlie (both still lying)
        .mockReturnValueOnce(['game:alice']); // Charlie keeps Alice (both still lying)

      await handler.execute(parameters, executionContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Lying closeness removed successfully',
        expect.objectContaining({
          formerLyingActors: ['game:alice', 'game:charlie'],
        })
      );

      // Bob should have component removed
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'game:bob',
        'personal-space-states:closeness'
      );

      // Alice and Charlie should keep their components with each other
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'game:alice',
        'personal-space-states:closeness',
        { partners: ['game:charlie'] }
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'game:charlie',
        'personal-space-states:closeness',
        { partners: ['game:alice'] }
      );
    });

    it('should handle different furniture - actor lying on different bed should not be affected', async () => {
      const parameters = {
        furniture_id: 'furniture:bed1',
        actor_id: 'game:alice',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({}) // Furniture validation
        .mockReturnValueOnce({ partners: ['game:bob', 'game:charlie'] }); // Alice's closeness

      // Bob is on different furniture, Charlie is on the same furniture
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'game:bob' },
        { id: 'game:charlie' },
      ]);

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ furniture_id: 'furniture:bed2' }) // Bob's lying_down (different furniture)
        .mockReturnValueOnce({ furniture_id: 'furniture:bed1' }); // Charlie's lying_down (same furniture)

      await handler.execute(parameters, executionContext);

      // Should only identify Charlie as formerly lying on same furniture
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle actor with missing closeness component during processing', async () => {
      const parameters = {
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({})
        .mockReturnValueOnce({ partners: ['game:bob'] })
        .mockReturnValueOnce({ furniture_id: 'furniture:bed' })
        .mockReturnValueOnce(null) // Alice's component missing during processing
        .mockReturnValueOnce({ partners: ['game:alice'] })
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'game:bob' },
      ]);

      await handler.execute(parameters, executionContext);

      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'game:alice',
        'personal-space-states:closeness'
      );
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'game:bob',
        'personal-space-states:closeness'
      );
    });

    it('should handle partner with missing closeness component', async () => {
      const parameters = {
        furniture_id: 'furniture:bed',
        actor_id: 'game:alice',
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({}) // Furniture validation
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Alice's closeness
        .mockReturnValueOnce({ furniture_id: 'furniture:bed' }) // Bob's lying_down
        .mockReturnValueOnce({ partners: ['game:bob'] }) // Alice for processing
        .mockReturnValueOnce(null) // Bob has no closeness component
        .mockReturnValueOnce(null) // Alice final state
        .mockReturnValueOnce(null); // Alice movement lock check

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'game:bob' },
      ]);

      mockClosenessCircleService.repair.mockReturnValueOnce([]); // Alice has no partners left

      await handler.execute(parameters, executionContext);

      // Should complete successfully
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Lying closeness removed successfully',
        expect.anything()
      );
    });
  });
});
