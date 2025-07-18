// src/tests/logic/operationHandlers/removeComponentHandler.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import RemoveComponentHandler from '../../../../src/logic/operationHandlers/removeComponentHandler.js'; // Adjust path if needed
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

// --- Type-hints (for editors only) ------------------------------------------
/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../src/logic/defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../../../src/logic/operationHandlers/removeComponentHandler.js').RemoveComponentOperationParams} RemoveComponentOperationParams */

// --- Mock services ---------------------------------------------------------
const mockEntityManager = {
  // Mock the method used by the handler
  removeComponent: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };

// --- Helper – ExecutionContext factory -------------------------------------
const actorId = 'actor-id-123';
const targetId = 'target-id-456';
const specificEntityId = 'specific-entity-789';

/**
 * @param overrides
 * @returns {ExecutionContext}
 */
function buildCtx(overrides = {}) {
  const base = {
    logger: mockLogger,
    evaluationContext: {
      actor: { id: actorId },
      target: { id: targetId },
      context: {}, // Ensure context object exists for result storage if needed elsewhere
    },
  };
  // Simple merge, assuming overrides don't need deep cloning logic like in query handler
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

// --- Test-suite ------------------------------------------------------------
describe('RemoveComponentHandler', () => {
  /** @type {RemoveComponentHandler} */
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock behavior for removeComponent: assume success (component found & removed)
    mockEntityManager.removeComponent.mockReturnValue(true);
    handler = new RemoveComponentHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
  });

  // --- Constructor validation ----------------------------------------------
  test('constructor throws without valid dependencies', () => {
    expect(
      () =>
        new RemoveComponentHandler({
          logger: mockLogger,
          safeEventDispatcher: mockDispatcher,
        })
    ).toThrow(/RemoveComponentHandler: entityManager/);
    // Check for specific method required by this handler
    expect(
      () =>
        new RemoveComponentHandler({
          entityManager: {},
          logger: mockLogger,
          safeEventDispatcher: mockDispatcher,
        })
    ).toThrow(/removeComponent/);
    expect(
      () =>
        new RemoveComponentHandler({
          entityManager: mockEntityManager,
          safeEventDispatcher: mockDispatcher,
        })
    ).toThrow(/logger/);
    expect(
      () =>
        new RemoveComponentHandler({
          entityManager: mockEntityManager,
          logger: mockLogger,
        })
    ).toThrow(/safeEventDispatcher/);
  });

  test('constructor initializes successfully with valid dependencies', () => {
    expect(
      () =>
        new RemoveComponentHandler({
          entityManager: mockEntityManager,
          logger: mockLogger,
          safeEventDispatcher: mockDispatcher,
        })
    ).not.toThrow();
  });

  // --- Happy Path - Basic Removal ----------------------------------------
  test('removes component by calling EntityManager.removeComponent with correct args', async () => {
    const params = { entity_ref: 'actor', component_type: 'core:stats' };
    const ctx = buildCtx();
    await handler.execute(params, ctx);

    expect(mockEntityManager.removeComponent).toHaveBeenCalledTimes(1);
    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
      actorId,
      'core:stats'
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
    // Check for the specific debug message indicating success or non-existence
    expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Successfully removed component "core:stats" from entity "${actorId}" (or component did not exist)`
      )
    );
  });

  // --- CORRECTED TEST ---
  test('logs warning when component removal fails (EntityManager returns false)', async () => {
    mockEntityManager.removeComponent.mockReturnValue(false); // Simulate component not found or other failure
    const params = {
      entity_ref: 'target',
      component_type: 'custom:nonexistent',
    };
    const ctx = buildCtx();
    await handler.execute(params, ctx);

    expect(mockEntityManager.removeComponent).toHaveBeenCalledTimes(1);
    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
      targetId,
      'custom:nonexistent'
    );
    // Expect warning because removeComponent returned false
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `Attempted to remove component "custom:nonexistent" from entity "${targetId}", but operation reported failure.`
      )
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    // Debug log should *not* be called in this case according to the if/else logic
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });
  // --- END CORRECTION ---

  test('trims whitespace from component_type before calling EntityManager', async () => {
    const params = {
      entity_ref: specificEntityId,
      component_type: '  padded:type  ',
    };
    const ctx = buildCtx();
    await handler.execute(params, ctx);

    expect(mockEntityManager.removeComponent).toHaveBeenCalledTimes(1);
    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
      specificEntityId,
      'padded:type'
    ); // Check trimmed type
    // Debug log is expected here because the default mock returns true
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Successfully removed component "padded:type"')
    );
  });

  // --- Parameter Validation ----------------------------------------------
  test.each([
    ['missing params', null],
    ['undefined params', undefined],
    ['non-object params', 'invalid'],
  ])('warns and skips if params are %s', async (desc, invalidParams) => {
    await handler.execute(invalidParams, buildCtx());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'REMOVE_COMPONENT: params missing or invalid.',
      { params: invalidParams }
    );
    expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
  });

  test.each([
    ['missing property', { component_type: 'c:t' }],
    ['null', { component_type: 'c:t', entity_ref: null }],
    ['undefined', { component_type: 'c:t', entity_ref: undefined }],
  ])('warns and skips if entity_ref is %s', async (desc, params) => {
    await handler.execute(params, buildCtx());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'REMOVE_COMPONENT: "entity_ref" parameter is required.'
    );
    expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
  });

  test.each([
    ['missing property', { entity_ref: 'actor' }],
    ['null', { entity_ref: 'actor', component_type: null }],
    ['undefined', { entity_ref: 'actor', component_type: undefined }],
    ['empty string', { entity_ref: 'actor', component_type: '' }],
    ['whitespace string', { entity_ref: 'actor', component_type: '   ' }],
    ['non-string', { entity_ref: 'actor', component_type: 123 }],
  ])('warns and skips if component_type is %s', async (desc, params) => {
    await handler.execute(params, buildCtx());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing "component_type" parameter')
    );
    expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
  });

  // --- Entity Reference Resolution (Happy Paths) -------------------------
  test('resolves "actor" entity reference', async () => {
    const params = { entity_ref: 'actor', component_type: 'c:t' };
    await handler.execute(params, buildCtx());
    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
      actorId,
      'c:t'
    );
  });

  test('resolves "target" entity reference', async () => {
    const params = { entity_ref: 'target', component_type: 'c:t' };
    await handler.execute(params, buildCtx());
    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
      targetId,
      'c:t'
    );
  });

  test('resolves direct string entity ID reference', async () => {
    const params = { entity_ref: specificEntityId, component_type: 'c:t' };
    await handler.execute(params, buildCtx());
    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
      specificEntityId,
      'c:t'
    );
  });

  test('resolves object entity reference {entityId: "..."}', async () => {
    const params = {
      entity_ref: { entityId: specificEntityId },
      component_type: 'c:t',
    };
    await handler.execute(params, buildCtx());
    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
      specificEntityId,
      'c:t'
    );
  });

  test('resolves and trims object entity reference {entityId: " spaced "}', async () => {
    const spacedId = '  spaced-id  ';
    const trimmedId = 'spaced-id';
    const params = {
      entity_ref: { entityId: spacedId },
      component_type: 'c:t',
    };
    await handler.execute(params, buildCtx());
    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
      trimmedId,
      'c:t'
    );
  });

  test('resolves and trims direct string entity ID reference " spaced "', async () => {
    const spacedId = '  direct-spaced-id  ';
    const trimmedId = 'direct-spaced-id';
    const params = { entity_ref: spacedId, component_type: 'c:t' };
    await handler.execute(params, buildCtx());
    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
      trimmedId,
      'c:t'
    );
  });

  // --- Entity Reference Resolution (Failure Paths) -----------------------
  test.each([
    // null and undefined already caught by '!entity_ref' check
    ['empty string', ' '],
    ['object without entityId', {}],
    ['object with empty entityId', { entityId: '  ' }],
    ['object with non-string entityId', { entityId: 123 }],
    ['number', 123], // Handle cases where non-string/non-object refs are passed
    ['boolean', true],
  ])(
    'warns and skips if entity_ref cannot be resolved (%s)',
    async (desc, invalidRef) => {
      const params = { entity_ref: invalidRef, component_type: 'c:t' };
      await handler.execute(params, buildCtx());
      // These cases should pass the initial '!entity_ref' check but fail in resolveEntityId
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not resolve entity id from entity_ref.'),
        { entity_ref: invalidRef }
      );
      expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
    }
  );

  test('warns and skips if context lacks actor for "actor" ref', async () => {
    const params = { entity_ref: 'actor', component_type: 'c:t' };
    const ctx = buildCtx({ evaluationContext: { actor: null } }); // No actor
    await handler.execute(params, ctx);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not resolve entity id from entity_ref.'),
      { entity_ref: 'actor' }
    );
    expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
  });

  test('warns and skips if context lacks target for "target" ref', async () => {
    const params = { entity_ref: 'target', component_type: 'c:t' };
    const ctx = buildCtx({ evaluationContext: { target: null } }); // No target
    await handler.execute(params, ctx);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not resolve entity id from entity_ref.'),
      { entity_ref: 'target' }
    );
    expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
  });

  // --- Error Handling during removeComponent Call ------------------------
  test('dispatches error event if EntityManager.removeComponent throws', async () => {
    const error = new Error('EntityManager failed during removal!');
    mockEntityManager.removeComponent.mockImplementation(() => {
      throw error;
    });
    const params = { entity_ref: 'actor', component_type: 'problem:comp' };
    await handler.execute(params, buildCtx());

    expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
      actorId,
      'problem:comp'
    );
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('Failed to remove component'),
      })
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.debug).not.toHaveBeenCalled(); // Should not log success debug if error occurred
  });

  // --- Context logger precedence -----------------------------------------
  test('uses logger from execution context when provided', async () => {
    const ctxLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    const ctx = buildCtx({ logger: ctxLogger });
    // Trigger validation warning
    const params = { entity_ref: 'actor', component_type: '' };
    await handler.execute(params, ctx);

    expect(ctxLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing "component_type"')
    );
    expect(mockLogger.warn).not.toHaveBeenCalled(); // Ensure default logger wasn't used
    expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();

    // Trigger success debug log
    jest.clearAllMocks(); // Clear previous mock calls
    mockEntityManager.removeComponent.mockReturnValue(true); // Ensure success path for next step
    const successParams = {
      entity_ref: 'target',
      component_type: 'removable:comp',
    };
    await handler.execute(successParams, ctx);

    expect(ctxLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Successfully removed component')
    );
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });
});
