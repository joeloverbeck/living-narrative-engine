// tests/unit/logic/operationHandlers/regenerateDescriptionHandler.test.js

/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RegenerateDescriptionHandler from '../../../../src/logic/operationHandlers/regenerateDescriptionHandler.js';

// --- Mock services ---------------------------------------------------------
const mockEntityManager = {
  getEntityInstance: jest.fn(),
  addComponent: jest.fn(),
};

const mockBodyDescriptionComposer = {
  composeDescription: jest.fn(),
};

const mockSafeEventDispatcher = {
  dispatch: jest.fn().mockResolvedValue(true),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// --- Helper – ExecutionContext factory -------------------------------------
const actorId = 'actor-id-123';
const targetId = 'target-id-456';

/**
 *
 * @param overrides
 */
function buildCtx(overrides = {}) {
  const base = {
    logger: mockLogger,
    evaluationContext: {
      actor: { id: actorId },
      target: { id: targetId },
      context: {},
    },
  };
  return {
    ...base,
    ...overrides,
    evaluationContext: {
      ...base.evaluationContext,
      ...(overrides.evaluationContext || {}),
      context: {
        ...base.evaluationContext.context,
        ...(overrides.evaluationContext?.context || {}),
      },
    },
  };
}

describe('RegenerateDescriptionHandler', () => {
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new RegenerateDescriptionHandler({
      entityManager: mockEntityManager,
      bodyDescriptionComposer: mockBodyDescriptionComposer,
      logger: mockLogger,
      safeEventDispatcher: mockSafeEventDispatcher,
    });
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================
  describe('Constructor', () => {
    it('should throw without valid dependencies', () => {
      // Test missing entityManager
      expect(
        () =>
          new RegenerateDescriptionHandler({
            bodyDescriptionComposer: mockBodyDescriptionComposer,
            logger: mockLogger,
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow(/entityManager/);

      // Test invalid entityManager (missing required methods)
      expect(
        () =>
          new RegenerateDescriptionHandler({
            entityManager: {},
            bodyDescriptionComposer: mockBodyDescriptionComposer,
            logger: mockLogger,
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow(/getEntityInstance/);

      // Test missing bodyDescriptionComposer
      expect(
        () =>
          new RegenerateDescriptionHandler({
            entityManager: mockEntityManager,
            logger: mockLogger,
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow(/bodyDescriptionComposer/);

      // Test invalid bodyDescriptionComposer (missing required methods)
      expect(
        () =>
          new RegenerateDescriptionHandler({
            entityManager: mockEntityManager,
            bodyDescriptionComposer: {},
            logger: mockLogger,
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow(/composeDescription/);

      // Test missing logger
      expect(
        () =>
          new RegenerateDescriptionHandler({
            entityManager: mockEntityManager,
            bodyDescriptionComposer: mockBodyDescriptionComposer,
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow(/logger/);

      // Test missing safeEventDispatcher
      expect(
        () =>
          new RegenerateDescriptionHandler({
            entityManager: mockEntityManager,
            bodyDescriptionComposer: mockBodyDescriptionComposer,
            logger: mockLogger,
          })
      ).toThrow(/safeEventDispatcher/);

      // Test invalid safeEventDispatcher (missing required methods)
      expect(
        () =>
          new RegenerateDescriptionHandler({
            entityManager: mockEntityManager,
            bodyDescriptionComposer: mockBodyDescriptionComposer,
            logger: mockLogger,
            safeEventDispatcher: {},
          })
      ).toThrow(/dispatch/);
    });

    it('should initialize with valid dependencies', () => {
      // Test successful construction with all dependencies
      expect(() => {
        new RegenerateDescriptionHandler({
          entityManager: mockEntityManager,
          bodyDescriptionComposer: mockBodyDescriptionComposer,
          logger: mockLogger,
          safeEventDispatcher: mockSafeEventDispatcher,
        });
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // Happy Path Tests
  // ==========================================================================
  describe('Happy Path Execution', () => {
    it('should successfully regenerate description for valid entity', async () => {
      // Setup: Entity with anatomy:body component
      const mockEntity = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'A tall figure with dark hair.'
      );

      const params = {
        entity_ref: 'actor',
      };
      const ctx = buildCtx();

      // Action: Execute operation with valid parameters
      await handler.execute(params, ctx);

      // Assert: BodyDescriptionComposer.composeDescription called
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(mockEntity);

      // Assert: EntityManager.addComponent called with correct params
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        actorId,
        'core:description',
        { text: 'A tall figure with dark hair.' }
      );

      // Assert: Success logging occurred
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Successfully regenerated entity description',
        expect.objectContaining({
          entityId: actorId,
          descriptionLength: 29,
        })
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle different entity_ref formats', async () => {
      const mockEntity = {
        id: 'entity-123',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'Description'
      );

      // Test "actor" entity reference
      await handler.execute({ entity_ref: 'actor' }, buildCtx());
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);

      jest.clearAllMocks();
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'Description'
      );

      // Test "target" entity reference
      await handler.execute({ entity_ref: 'target' }, buildCtx());
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );

      jest.clearAllMocks();
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'Description'
      );

      // Test entity ID string reference
      await handler.execute({ entity_ref: 'custom-entity-id' }, buildCtx());
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'custom-entity-id'
      );

      jest.clearAllMocks();
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'Description'
      );

      // Test entity reference object
      await handler.execute(
        { entity_ref: { entityId: 'obj-entity-id' } },
        buildCtx()
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'obj-entity-id'
      );
    });

    it('should update core:description component correctly', async () => {
      const mockEntity = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'Complex description text'
      );

      await handler.execute({ entity_ref: 'actor' }, buildCtx());

      // Verify correct component ID and structure
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        actorId,
        'core:description',
        { text: 'Complex description text' }
      );
    });
  });

  // ==========================================================================
  // Edge Case Tests
  // ==========================================================================
  describe('Edge Cases', () => {
    it('should handle entity without anatomy:body component gracefully', async () => {
      // Setup: Entity missing anatomy component
      const mockEntity = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(false), // No anatomy:body
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      // BodyDescriptionComposer returns empty string when no anatomy:body
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('');

      const params = { entity_ref: 'actor' };
      const ctx = buildCtx();

      // Action: Execute operation
      await handler.execute(params, ctx);

      // Assert: composeDescription handles gracefully
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(mockEntity);

      // Assert: Component still gets updated with empty string
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        actorId,
        'core:description',
        { text: '' }
      );

      // Assert: No errors thrown
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Successfully regenerated entity description',
        expect.objectContaining({
          entityId: actorId,
          descriptionLength: 0,
        })
      );
    });

    it('should handle missing entity gracefully', async () => {
      // Setup: Non-existent entity ID
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const params = { entity_ref: 'non-existent-id' };
      const ctx = buildCtx();

      // Action: Execute operation
      await handler.execute(params, ctx);

      // Assert: Early return with warning log
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Entity not found for description regeneration',
        expect.objectContaining({
          entityId: 'non-existent-id',
          operation: 'REGENERATE_DESCRIPTION',
        })
      );

      // Assert: No component update attempted
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).not.toHaveBeenCalled();
    });

    it('should handle empty description from composer', async () => {
      // Setup: BodyDescriptionComposer returns empty string
      const mockEntity = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('');

      const params = { entity_ref: 'actor' };
      const ctx = buildCtx();

      // Action: Execute operation
      await handler.execute(params, ctx);

      // Assert: Empty description handled correctly
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        actorId,
        'core:description',
        { text: '' }
      );

      // Assert: Component still updated
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Successfully regenerated entity description',
        expect.objectContaining({
          entityId: actorId,
          descriptionLength: 0,
        })
      );
    });

    it('should handle null description from composer', async () => {
      const mockEntity = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(null);

      const params = { entity_ref: 'actor' };
      const ctx = buildCtx();

      await handler.execute(params, ctx);

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        actorId,
        'core:description',
        { text: null }
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Successfully regenerated entity description',
        expect.objectContaining({
          entityId: actorId,
          descriptionLength: 0,
        })
      );
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================
  describe('Error Handling', () => {
    it('should handle description generation failure', async () => {
      // Setup: Mock BodyDescriptionComposer to throw error
      const mockEntity = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      const testError = new Error('Description generation failed');
      mockBodyDescriptionComposer.composeDescription.mockRejectedValue(
        testError
      );

      const params = { entity_ref: 'actor' };
      const ctx = buildCtx();

      // Action: Execute operation
      await handler.execute(params, ctx);

      // Assert: Error logged and dispatched via safeDispatchError
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to regenerate entity description',
        expect.objectContaining({
          params,
          error: 'Description generation failed',
          stack: expect.any(String),
        })
      );

      // safeDispatchError calls dispatcher.dispatch with event ID and payload
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: 'REGENERATE_DESCRIPTION operation failed',
          details: expect.objectContaining({
            params,
            error: 'Description generation failed',
          }),
        })
      );

      // Assert: Component update not attempted
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    it('should handle component update failure', async () => {
      // Setup: Mock EntityManager.addComponent to throw error
      const mockEntity = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'Description'
      );
      const testError = new Error('Component update failed');
      mockEntityManager.addComponent.mockRejectedValue(testError);

      const params = { entity_ref: 'actor' };
      const ctx = buildCtx();

      // Action: Execute operation
      await handler.execute(params, ctx);

      // Assert: safeDispatchError called with proper context
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: 'REGENERATE_DESCRIPTION operation failed',
          details: expect.objectContaining({
            params,
            error: 'Component update failed',
          }),
        })
      );

      // Assert: Error properly logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to regenerate entity description',
        expect.objectContaining({
          params,
          error: 'Component update failed',
        })
      );
    });

    it('should validate parameters correctly', async () => {
      // Test null parameters
      await handler.execute(null, buildCtx());
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'REGENERATE_DESCRIPTION: params missing or invalid.',
        { params: null }
      );
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();

      jest.clearAllMocks();

      // Test undefined parameters
      await handler.execute(undefined, buildCtx());
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'REGENERATE_DESCRIPTION: params missing or invalid.',
        { params: undefined }
      );
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();

      jest.clearAllMocks();

      // Test non-object parameters
      await handler.execute('invalid', buildCtx());
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'REGENERATE_DESCRIPTION: params missing or invalid.',
        { params: 'invalid' }
      );
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
    });

    it('should handle entity reference validation failure', async () => {
      // Test invalid entity references
      const params = { entity_ref: null };
      const ctx = buildCtx();

      await handler.execute(params, ctx);

      // Assert: validateEntityRef error handling
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'REGENERATE_DESCRIPTION: "entity_ref" parameter is required.'
      );

      // Assert: Early return on validation failure
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).not.toHaveBeenCalled();
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    it('should handle invalid entity reference formats', async () => {
      // Test various invalid formats
      const invalidRefs = [
        { entity_ref: {} }, // Empty object
        { entity_ref: { wrongKey: 'value' } }, // Object without entityId
        { entity_ref: [] }, // Array
        { entity_ref: 123 }, // Number
        { entity_ref: true }, // Boolean
      ];

      for (const params of invalidRefs) {
        jest.clearAllMocks();
        await handler.execute(params, buildCtx());

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'REGENERATE_DESCRIPTION: Could not resolve entity id from entity_ref.',
          { entity_ref: params.entity_ref }
        );
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      }
    });
  });

  // ==========================================================================
  // ComponentOperationHandler Integration Tests
  // ==========================================================================
  describe('ComponentOperationHandler Integration', () => {
    it('should properly extend ComponentOperationHandler', () => {
      // Verify handler has inherited methods
      expect(typeof handler.validateEntityRef).toBe('function');
      expect(typeof handler.resolveEntity).toBe('function');
      expect(typeof handler.validateComponentType).toBe('function');
      expect(typeof handler.getLogger).toBe('function');
    });

    it('should use inherited validateEntityRef correctly', async () => {
      // The handler uses validateEntityRef from base class
      const mockEntity = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'Description'
      );

      // Test with context entities
      await handler.execute({ entity_ref: 'actor' }, buildCtx());
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);

      jest.clearAllMocks();
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'Description'
      );

      await handler.execute({ entity_ref: 'target' }, buildCtx());
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        targetId
      );
    });

    it('should integrate correctly with BodyDescriptionComposer', async () => {
      const mockEntity = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(true),
        getComponent: jest.fn().mockReturnValue({
          /* anatomy data */
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      // Test proper service method calls
      const expectedDescription = 'A detailed physical description';
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        expectedDescription
      );

      const params = { entity_ref: 'actor' };
      const ctx = buildCtx();

      await handler.execute(params, ctx);

      // Test parameter passing
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledTimes(1);
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(mockEntity);

      // Test response handling
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        actorId,
        'core:description',
        { text: expectedDescription }
      );
    });

    it('should integrate correctly with EntityManager', async () => {
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
      };

      // Test entity retrieval
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'Test description'
      );
      mockEntityManager.addComponent.mockResolvedValue(undefined);

      const params = { entity_ref: 'test-entity' };
      const ctx = buildCtx();

      await handler.execute(params, ctx);

      // Verify entity retrieval
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'test-entity'
      );

      // Test component updates
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'test-entity',
        'core:description',
        { text: 'Test description' }
      );
    });

    it('should integrate correctly with logging system', async () => {
      const mockEntity = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'Log test description'
      );

      const params = { entity_ref: 'actor' };
      const ctx = buildCtx();

      // Test success logging
      await handler.execute(params, ctx);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Successfully regenerated entity description',
        expect.objectContaining({
          entityId: actorId,
          descriptionLength: 20, // Length of 'Log test description'
        })
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();

      // Test warning logging (entity not found)
      jest.clearAllMocks();
      mockEntityManager.getEntityInstance.mockReturnValue(null);
      await handler.execute({ entity_ref: 'missing' }, ctx);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Entity not found for description regeneration',
        expect.objectContaining({
          entityId: 'missing',
          operation: 'REGENERATE_DESCRIPTION',
        })
      );
    });
  });
});
