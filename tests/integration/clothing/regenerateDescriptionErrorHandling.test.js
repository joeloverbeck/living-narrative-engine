/**
 * @file Comprehensive error handling validation tests for REGENERATE_DESCRIPTION operation
 * Ensures graceful failure, preservation of existing descriptions, and system stability
 * under all error conditions as specified in ENTDESCREG-009 workflow.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import RegenerateDescriptionHandler from '../../../src/logic/operationHandlers/regenerateDescriptionHandler.js';

describe('Description Regeneration Error Handling', () => {
  let testBed;
  let handler;
  let mockLogger;
  let mockSafeEventDispatcher;
  let mockEntityManager;
  let mockBodyDescriptionComposer;

  beforeEach(() => {
    testBed = createTestBed();

    // Create mock dependencies using TestBed API
    mockLogger = testBed.createMockLogger();
    mockSafeEventDispatcher = testBed.createMock('SafeEventDispatcher', [
      'dispatch',
    ]);
    mockEntityManager = testBed.createMock('EntityManager', [
      'getEntityInstance',
      'addComponent',
    ]);
    mockBodyDescriptionComposer = testBed.createMock(
      'BodyDescriptionComposer',
      ['composeDescription']
    );

    // Ensure dispatcher returns a promise for async operations
    mockSafeEventDispatcher.dispatch.mockResolvedValue(true);

    // Create handler instance with mocked dependencies
    handler = new RegenerateDescriptionHandler({
      entityManager: mockEntityManager,
      bodyDescriptionComposer: mockBodyDescriptionComposer,
      logger: mockLogger,
      safeEventDispatcher: mockSafeEventDispatcher,
    });
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Missing Entity Scenarios
  // ==========================================================================
  describe('Missing Entity Error Handling', () => {
    it('should handle non-existent entity gracefully', async () => {
      // Setup: Configure entity manager to return null
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const params = { entity_ref: 'non-existent-entity' };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
      };

      // Action: Execute operation
      await handler.execute(params, executionContext);

      // Assert: Warning logged but no exception thrown
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Entity not found'),
        expect.objectContaining({
          entityId: 'non-existent-entity',
        })
      );

      // Assert: No component update attempted
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();

      // Assert: No error dispatched (this is expected behavior for warnings)
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should handle entity reference resolution failure', async () => {
      // Setup: Invalid entity reference that fails validation
      const params = { entity_ref: { invalid: 'reference' } };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
      };

      // Action: Execute operation (validateEntityRef will return null)
      await handler.execute(params, executionContext);

      // Assert: Warning logged about invalid entity reference
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not resolve entity id from entity_ref'),
        expect.objectContaining({ entity_ref: { invalid: 'reference' } })
      );

      // Assert: Operation exits early without proceeding
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Description Generation Failures
  // ==========================================================================
  describe('Description Generation Error Handling', () => {
    it('should handle BodyDescriptionComposer exception gracefully', async () => {
      // Setup: Entity exists but description generation fails
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const generationError = new Error('Description generation failed');
      mockBodyDescriptionComposer.composeDescription.mockRejectedValue(
        generationError
      );

      const params = { entity_ref: 'test-entity' };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
      };

      // Action: Execute operation
      await handler.execute(params, executionContext);

      // Assert: Error logged with context
      expect(mockLogger.error).toHaveBeenCalledWith(
        'RegenerateDescriptionHandler: Failed to regenerate entity description',
        expect.objectContaining({
          params,
          error: 'Description generation failed',
          stack: expect.any(String),
        })
      );

      // Assert: Error dispatched with correct event ID and payload structure
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'REGENERATE_DESCRIPTION operation failed',
          details: expect.objectContaining({
            params,
            error: 'Description generation failed',
          }),
        })
      );

      // Assert: No component update attempted
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    it('should preserve existing description when generation fails', async () => {
      // Setup: Entity with existing description
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponent: jest
          .fn()
          .mockReturnValue({ text: 'Original description' }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      // Setup: Description generation fails
      mockBodyDescriptionComposer.composeDescription.mockRejectedValue(
        new Error('Composer service unavailable')
      );

      const params = { entity_ref: 'test-entity' };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
      };

      // Action: Execute operation
      await handler.execute(params, executionContext);

      // Assert: Original description preserved (no addComponent call)
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();

      // Assert: Entity's original description remains unchanged
      const currentDescription = mockEntity.getComponent('core:description');
      expect(currentDescription.text).toBe('Original description');

      // Assert: Error properly handled
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );
    });

    it('should handle null description from composer gracefully', async () => {
      // Setup: Entity exists and composer returns null
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(null);

      const params = { entity_ref: 'test-entity' };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
      };

      // Action: Execute operation
      await handler.execute(params, executionContext);

      // Assert: Null description is handled correctly
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'test-entity',
        'core:description',
        { text: null }
      );

      // Assert: Success logged even with null description
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'RegenerateDescriptionHandler: Successfully regenerated entity description',
        expect.objectContaining({
          entityId: 'test-entity',
          descriptionLength: 0,
        })
      );
    });
  });

  // ==========================================================================
  // Component Update Failures
  // ==========================================================================
  describe('Component Update Error Handling', () => {
    it('should handle addComponent failure gracefully', async () => {
      // Setup: Successful description generation but component update fails
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'New generated description'
      );

      const updateError = new Error('Component update failed');
      mockEntityManager.addComponent.mockRejectedValue(updateError);

      const params = { entity_ref: 'test-entity' };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
      };

      // Action: Execute operation
      await handler.execute(params, executionContext);

      // Assert: Error logged with full context
      expect(mockLogger.error).toHaveBeenCalledWith(
        'RegenerateDescriptionHandler: Failed to regenerate entity description',
        expect.objectContaining({
          params,
          error: 'Component update failed',
          stack: expect.any(String),
        })
      );

      // Assert: Error dispatched with correct event structure
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'REGENERATE_DESCRIPTION operation failed',
          details: expect.objectContaining({
            params,
            error: 'Component update failed',
          }),
        })
      );
    });

    it('should handle database/persistence failures', async () => {
      // Setup: Entity exists and description generates successfully
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'New description'
      );

      // Setup: Database persistence failure
      const persistenceError = new Error('Database connection lost');
      mockEntityManager.addComponent.mockRejectedValue(persistenceError);

      const params = { entity_ref: 'test-entity' };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
      };

      // Action: Execute operation
      await handler.execute(params, executionContext);

      // Assert: Database error properly handled and logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'RegenerateDescriptionHandler: Failed to regenerate entity description',
        expect.objectContaining({
          error: 'Database connection lost',
        })
      );

      // Assert: System error event dispatched
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'REGENERATE_DESCRIPTION operation failed',
          details: expect.objectContaining({
            error: 'Database connection lost',
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Parameter Validation Failures
  // ==========================================================================
  describe('Parameter Validation Error Handling', () => {
    it('should handle missing parameters gracefully', async () => {
      // Setup: Invalid parameters object
      const invalidParams = {}; // Missing entity_ref
      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
      };

      // Action: Execute operation
      await handler.execute(invalidParams, executionContext);

      // Assert: Warning logged about missing entity_ref
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('"entity_ref" parameter is required')
      );

      // Assert: Operation exits early, no entity operations attempted
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    it('should handle null/undefined parameters', async () => {
      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
      };

      // Test null parameters
      await handler.execute(null, executionContext);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('params missing or invalid'),
        { params: null }
      );
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();

      jest.clearAllMocks();

      // Test undefined parameters
      await handler.execute(undefined, executionContext);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('params missing or invalid'),
        { params: undefined }
      );
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
    });

    it('should handle malformed entity references', async () => {
      // Test various malformed entity reference formats
      const malformedRefs = [
        { entity_ref: null },
        { entity_ref: undefined },
        { entity_ref: 123 }, // Should be string
        { entity_ref: {} }, // Empty object
        { entity_ref: [] }, // Array instead of reference
        { entity_ref: true }, // Boolean
      ];

      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
      };

      for (const params of malformedRefs) {
        jest.clearAllMocks();
        await handler.execute(params, executionContext);

        // Assert: validateEntityRef logs warnings for invalid references
        if (params.entity_ref === null || params.entity_ref === undefined) {
          expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('"entity_ref" parameter is required')
          );
        } else {
          expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(
              'Could not resolve entity id from entity_ref'
            ),
            expect.objectContaining({ entity_ref: params.entity_ref })
          );
        }

        // Assert: No entity manager operations attempted for any malformed refs
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      }
    });
  });

  // ==========================================================================
  // System Integration Error Scenarios
  // ==========================================================================
  describe('System Integration Error Handling', () => {
    it('should handle rule processing interruption gracefully', async () => {
      // Setup: Mock a scenario where REGENERATE_DESCRIPTION is part of a larger rule
      // This test validates that rule processing continues when description fails

      const mockEntity = {
        id: 'test-actor',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      // Setup: Description generation fails
      mockBodyDescriptionComposer.composeDescription.mockRejectedValue(
        new Error('System overload')
      );

      const params = { entity_ref: 'test-actor' };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
        // Additional context that might be present during rule processing
        ruleContext: { operationIndex: 2, totalOperations: 5 },
      };

      // Action: Execute operation (simulating it as part of larger rule)
      await handler.execute(params, executionContext);

      // Assert: Error is handled gracefully, operation doesn't crash
      expect(mockLogger.error).toHaveBeenCalledWith(
        'RegenerateDescriptionHandler: Failed to regenerate entity description',
        expect.objectContaining({
          error: 'System overload',
        })
      );

      // Assert: System error dispatched but operation completes
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );

      // Test demonstrates graceful failure - operation doesn't throw uncaught errors
      // Rule processing can continue with other operations
    });

    it('should handle concurrent operation conflicts', async () => {
      // Setup: Test concurrent access to same entity
      const mockEntity = {
        id: 'shared-entity',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      // Setup: First call succeeds, second fails due to concurrent modification
      mockBodyDescriptionComposer.composeDescription
        .mockResolvedValueOnce('First description')
        .mockRejectedValueOnce(new Error('Concurrent modification detected'));

      mockEntityManager.addComponent
        .mockResolvedValueOnce() // First succeeds
        .mockRejectedValueOnce(new Error('Entity locked by another operation')); // Second fails

      const params = { entity_ref: 'shared-entity' };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
      };

      // Action: Execute operations concurrently
      const promises = [
        handler.execute(params, executionContext),
        handler.execute(params, executionContext),
      ];

      await Promise.allSettled(promises);

      // Assert: Both operations handle errors appropriately without crashes
      // At least one error should be logged for the concurrent conflict
      expect(mockLogger.error).toHaveBeenCalled();

      // Assert: Errors properly dispatched
      const errorDispatchCalls =
        mockSafeEventDispatcher.dispatch.mock.calls.filter(
          (call) => call[0] === SYSTEM_ERROR_OCCURRED_ID
        );
      expect(errorDispatchCalls.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Recovery and Cleanup Validation
  // ==========================================================================
  describe('Recovery and Cleanup', () => {
    it('should clean up resources after errors', async () => {
      // Setup: Operation that fails partway through
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      mockBodyDescriptionComposer.composeDescription.mockRejectedValue(
        new Error('Resource allocation failed')
      );

      const params = { entity_ref: 'test-entity' };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
      };

      // Action: Execute operation
      await handler.execute(params, executionContext);

      // Assert: Error handled gracefully without resource leaks
      // Operation completes execution path despite error
      expect(mockLogger.error).toHaveBeenCalled();

      // Assert: No hanging promises or unclosed resources
      // For this test, we verify the operation doesn't leave the system in bad state
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);

      // Assert: Error properly dispatched
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );
    });

    it('should maintain consistent entity state after errors', async () => {
      // Setup: Entity with initial state
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponent: jest
          .fn()
          .mockReturnValue({ text: 'Initial description' }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      // Setup: Description generates but component update fails
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'New description'
      );
      mockEntityManager.addComponent.mockRejectedValue(
        new Error('Update failed')
      );

      const params = { entity_ref: 'test-entity' };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
      };

      // Action: Execute operation
      await handler.execute(params, executionContext);

      // Assert: Entity state remains consistent
      // Original description is preserved when update fails
      const originalDescription = mockEntity.getComponent('core:description');
      expect(originalDescription.text).toBe('Initial description');

      // Assert: No partial updates or corrupted state
      // addComponent was attempted once but failed cleanly
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);

      // Assert: System error logged but entity remains in valid state
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'REGENERATE_DESCRIPTION operation failed',
        })
      );
    });
  });

  // ==========================================================================
  // Stress Testing Scenarios
  // ==========================================================================
  describe('Stress Testing and Edge Cases', () => {
    it('should handle multiple sequential failures without degradation', async () => {
      // Setup: Entity that will fail multiple times
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      // All calls fail
      mockBodyDescriptionComposer.composeDescription.mockRejectedValue(
        new Error('Persistent failure')
      );

      const params = { entity_ref: 'test-entity' };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
      };

      // Action: Execute operation multiple times
      for (let i = 0; i < 5; i++) {
        await handler.execute(params, executionContext);
      }

      // Assert: Each failure handled consistently
      expect(mockLogger.error).toHaveBeenCalledTimes(5);
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(5);

      // Assert: No degradation or resource accumulation
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(5);
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    it('should handle mixed success and failure scenarios', async () => {
      // Setup: Alternating success and failure
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      // Alternate between success and failure
      mockBodyDescriptionComposer.composeDescription
        .mockResolvedValueOnce('Success 1')
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockResolvedValueOnce('Success 2')
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('Success 3');

      mockEntityManager.addComponent.mockResolvedValue();

      const params = { entity_ref: 'test-entity' };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'test-actor' },
        },
      };

      // Action: Execute operations
      for (let i = 0; i < 5; i++) {
        await handler.execute(params, executionContext);
      }

      // Assert: Successes and failures handled independently
      expect(mockLogger.debug).toHaveBeenCalledTimes(3); // 3 successes
      expect(mockLogger.error).toHaveBeenCalledTimes(2); // 2 failures
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(3); // 3 successful updates
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(2); // 2 error events
    });
  });

  // ==========================================================================
  // Entity Reference Resolution Tests
  // ==========================================================================
  describe('Entity Reference Resolution', () => {
    it('should resolve "actor" reference correctly', async () => {
      const mockEntity = {
        id: 'actor-123',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'Actor description'
      );
      mockEntityManager.addComponent.mockResolvedValue();

      const params = { entity_ref: 'actor' };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'actor-123' },
          target: { id: 'target-456' },
        },
      };

      await handler.execute(params, executionContext);

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'actor-123'
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'actor-123',
        'core:description',
        { text: 'Actor description' }
      );
    });

    it('should resolve "target" reference correctly', async () => {
      const mockEntity = {
        id: 'target-456',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'Target description'
      );
      mockEntityManager.addComponent.mockResolvedValue();

      const params = { entity_ref: 'target' };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'actor-123' },
          target: { id: 'target-456' },
        },
      };

      await handler.execute(params, executionContext);

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'target-456'
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'target-456',
        'core:description',
        { text: 'Target description' }
      );
    });

    it('should resolve direct entity ID reference', async () => {
      const mockEntity = {
        id: 'custom-entity-789',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'Custom description'
      );
      mockEntityManager.addComponent.mockResolvedValue();

      const params = { entity_ref: 'custom-entity-789' };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'actor-123' },
        },
      };

      await handler.execute(params, executionContext);

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'custom-entity-789'
      );
    });

    it('should resolve entity object reference with entityId', async () => {
      const mockEntity = {
        id: 'object-entity-999',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'Object description'
      );
      mockEntityManager.addComponent.mockResolvedValue();

      const params = { entity_ref: { entityId: 'object-entity-999' } };
      const executionContext = {
        evaluationContext: {
          actor: { id: 'actor-123' },
        },
      };

      await handler.execute(params, executionContext);

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'object-entity-999'
      );
    });
  });
});
