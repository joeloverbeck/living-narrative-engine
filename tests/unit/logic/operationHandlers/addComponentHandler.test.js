// src/tests/logic/operationHandlers/addComponentHandler.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import AddComponentHandler from '../../../../src/logic/operationHandlers/addComponentHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js'; // Adjust path if needed

// --- Type-hints (for editors only) ------------------------------------------
/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../src/logic/defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../../../src/logic/operationHandlers/addComponentHandler.js').AddComponentOperationParams} AddComponentOperationParams */

// --- Mock services ---------------------------------------------------------
const mockEntityManager = {
  addComponent: jest.fn(),
};

const mockDispatcher = {
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
 * @param overrides
 * @returns {ExecutionContext}
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

// --- Test-suite ------------------------------------------------------------
describe('AddComponentHandler', () => {
  /** @type {AddComponentHandler} */
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new AddComponentHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
  });

  // --- Constructor validation ----------------------------------------------
  test('throws without valid dependencies', () => {
    expect(
      () =>
        new AddComponentHandler({
          logger: mockLogger,
          safeEventDispatcher: mockDispatcher,
        })
    ).toThrow(/entityManager/);
    expect(
      () =>
        new AddComponentHandler({
          entityManager: {},
          logger: mockLogger,
          safeEventDispatcher: mockDispatcher,
        })
    ).toThrow(/addComponent/);
    expect(
      () =>
        new AddComponentHandler({
          entityManager: mockEntityManager,
          safeEventDispatcher: mockDispatcher,
        })
    ).toThrow(/logger/);
  });

  test('throws if safeEventDispatcher is missing or invalid', () => {
    expect(
      () =>
        new AddComponentHandler({
          entityManager: mockEntityManager,
          logger: mockLogger,
        })
    ).toThrow(/safeEventDispatcher/);
    expect(
      () =>
        new AddComponentHandler({
          entityManager: mockEntityManager,
          logger: mockLogger,
          safeEventDispatcher: {},
        })
    ).toThrow(/safeEventDispatcher/);
  });

  // --- Happy Path - Basic Add/Replace ------------------------------------
  test('adds component by calling EntityManager.addComponent with correct args', async () => {
    const params = {
      entity_ref: 'actor',
      component_type: 'core:stats',
      value: { hp: 10, mp: 5 },
    };
    const ctx = buildCtx();
    await handler.execute(params, ctx);
    expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      actorId,
      'core:stats',
      { hp: 10, mp: 5 }
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Successfully added/replaced component')
    );
  });

  test('adds component with an empty object value', async () => {
    const params = {
      entity_ref: 'target',
      component_type: 'custom:marker',
      value: {},
    };
    const ctx = buildCtx();
    await handler.execute(params, ctx);
    expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      targetId,
      'custom:marker',
      {}
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  // --- Parameter Validation ----------------------------------------------
  test('warns and skips if params are missing or invalid', async () => {
    await handler.execute(null, buildCtx());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ADD_COMPONENT: params missing or invalid.',
      { params: null }
    );
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    mockLogger.warn.mockClear();
    await handler.execute(undefined, buildCtx());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ADD_COMPONENT: params missing or invalid.',
      { params: undefined }
    );
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    mockLogger.warn.mockClear();
    await handler.execute('invalid', buildCtx());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ADD_COMPONENT: params missing or invalid.',
      { params: 'invalid' }
    );
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
  });

  // --- UPDATED TEST for missing/falsy entity_ref ---
  test.each([
    ['missing property', { component_type: 'c:t', value: {} }],
    ['null', { component_type: 'c:t', value: {}, entity_ref: null }],
    ['undefined', { component_type: 'c:t', value: {}, entity_ref: undefined }],
  ])('warns and skips if entity_ref is %s', async (desc, params) => {
    await handler.execute(params, buildCtx());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ADD_COMPONENT: "entity_ref" parameter is required.'
    );
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
  });
  // --- End of Updated Test ---

  test.each([[null], [undefined], [''], ['  '], [123]])(
    'warns and skips if component_type is invalid (%p)',
    async (invalidType) => {
      const params = {
        entity_ref: 'actor',
        component_type: invalidType,
        value: {},
      };
      await handler.execute(params, buildCtx());
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid or missing "component_type"')
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    }
  );

  test.each([
    ['non-object value (number)', 7],
    ['non-object value (string)', 'hello'],
    ['null value', null],
    ['undefined value', undefined],
  ])('warns and skips if value is %s', async (desc, invalidValue) => {
    const params = {
      entity_ref: 'actor',
      component_type: 'ns:comp',
      value: invalidValue,
    };
    await handler.execute(params, buildCtx());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Invalid or missing "value" parameter (must be a non-null object)'
      )
    );
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
  });

  // --- Entity Reference Resolution (Happy Paths) -------------------------
  test('resolves "actor" entity reference', async () => {
    const params = { entity_ref: 'actor', component_type: 'c:t', value: {} };
    await handler.execute(params, buildCtx());
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      actorId,
      'c:t',
      {}
    );
  });

  test('resolves "target" entity reference', async () => {
    const params = { entity_ref: 'target', component_type: 'c:t', value: {} };
    await handler.execute(params, buildCtx());
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      targetId,
      'c:t',
      {}
    );
  });

  test('resolves direct string entity ID reference', async () => {
    const specificId = 'entity-directly-by-id-789';
    const params = { entity_ref: specificId, component_type: 'c:t', value: {} };
    await handler.execute(params, buildCtx());
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      specificId,
      'c:t',
      {}
    );
  });

  test('resolves object entity reference {entityId: "..."}', async () => {
    const specificId = 'entity-via-object-ref';
    const params = {
      entity_ref: { entityId: specificId },
      component_type: 'c:t',
      value: {},
    };
    await handler.execute(params, buildCtx());
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      specificId,
      'c:t',
      {}
    );
  });

  // --- UPDATED TEST for RESOLUTION Failures ---
  test.each([
    // null and undefined removed - caught by the '!entity_ref' check earlier
    ['empty string', ' '],
    ['object without entityId', {}],
    ['object with empty entityId', { entityId: '  ' }],
    ['object with non-string entityId', { entityId: 123 }],
  ])(
    'warns and skips if entity_ref cannot be resolved (%s)',
    async (desc, invalidRef) => {
      const params = {
        entity_ref: invalidRef,
        component_type: 'c:t',
        value: {},
      };
      await handler.execute(params, buildCtx());
      // These cases should pass the initial '!entity_ref' check but fail in resolveEntityId
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not resolve entity id'),
        { entity_ref: invalidRef }
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    }
  );
  // --- End of Updated Test ---

  // --- Error Handling during addComponent Call ---------------------------
  test('dispatches error event if EntityManager.addComponent throws', async () => {
    const error = new Error('Entity manager failed!');
    mockEntityManager.addComponent.mockImplementation(() => {
      throw error;
    });
    const params = { entity_ref: 'actor', component_type: 'c:t', value: {} };
    await handler.execute(params, buildCtx());
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      actorId,
      'c:t',
      {}
    );
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('Failed to add component'),
      })
    );
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
    const params = { entity_ref: 'actor', component_type: '', value: {} }; // Trigger validation warning
    await handler.execute(params, ctx);
    expect(ctxLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing "component_type"')
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
  });
});
