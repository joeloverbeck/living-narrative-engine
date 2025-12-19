// src/tests/logic/operationHandlers/atomicModifyComponentHandler.test.js

/**
 * @jest-environment node
 */
import {
  describe,
  expect,
  test,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import AtomicModifyComponentHandler from '../../../../src/logic/operationHandlers/atomicModifyComponentHandler.js';
import * as contextVariableUtils from '../../../../src/utils/contextVariableUtils.js';

// --- Type-hints (for editors only) ------------------------------------------
/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../src/logic/defs.js').ExecutionContext} ExecutionContext */

// -----------------------------------------------------------------------------
//  Mock services
// -----------------------------------------------------------------------------
const mockEntityManager = {
  getComponentData: jest.fn(),
  addComponent: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

/** @type {{ dispatch: jest.Mock }} */
let dispatcher;

// -----------------------------------------------------------------------------
//  Helper – ExecutionContext factory
// -----------------------------------------------------------------------------
const actorId = 'actor-1';
const targetId = 'target-2';

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

// -----------------------------------------------------------------------------
//  Test suite
// -----------------------------------------------------------------------------
describe('AtomicModifyComponentHandler', () => {
  /** @type {AtomicModifyComponentHandler} */
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for addComponent to simulate success
    mockEntityManager.addComponent.mockReturnValue(true);
    // Clear any specific mock implementations for getComponentData from previous tests
    mockEntityManager.getComponentData.mockReset();
    dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    handler = new AtomicModifyComponentHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: dispatcher,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  //  Constructor validation
  // ---------------------------------------------------------------------------
  test('throws without valid dependencies', () => {
    expect(
      () => new AtomicModifyComponentHandler({ logger: mockLogger })
    ).toThrow(/entityManager/);
    expect(
      () =>
        new AtomicModifyComponentHandler({
          entityManager: {
            addComponent: jest.fn() /* missing getComponentData */,
          },
          logger: mockLogger,
        })
    ).toThrow(/getComponentData/);
    expect(
      () =>
        new AtomicModifyComponentHandler({ entityManager: mockEntityManager })
    ).toThrow(/logger/);
    expect(
      () =>
        new AtomicModifyComponentHandler({
          entityManager: mockEntityManager,
          logger: mockLogger,
        })
    ).toThrow(/safeEventDispatcher/);
  });

  // ---------------------------------------------------------------------------
  //  Parameter validation
  // ---------------------------------------------------------------------------
  test('handles null params gracefully', async () => {
    await handler.execute(null, buildCtx());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ATOMIC_MODIFY_COMPONENT: params missing or invalid.',
      { params: null }
    );
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
  });

  test('handles undefined params gracefully', async () => {
    await handler.execute(undefined, buildCtx());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ATOMIC_MODIFY_COMPONENT: params missing or invalid.',
      { params: undefined }
    );
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
  });

  test('stores failure result when entity validation fails', async () => {
    const params = {
      entity_ref: null,
      component_type: 'ns:comp',
      field: 'value',
      expected_value: undefined,
      new_value: 'next',
      result_variable: 'result',
    };

    const ctx = buildCtx();
    await handler.execute(params, ctx);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ATOMIC_MODIFY_COMPONENT: "entity_ref" parameter is required.'
    );
    expect(ctx.evaluationContext.context.result).toBe(false);
  });

  test('skips storing result when result variable is invalid during early exit', async () => {
    const params = {
      entity_ref: null,
      component_type: 'ns:comp',
      field: 'value',
      expected_value: undefined,
      new_value: 'next',
    };

    const spy = jest.spyOn(contextVariableUtils, 'writeContextVariable');

    await handler.execute(params, buildCtx());

    expect(spy).not.toHaveBeenCalled();
  });

  test('validates field parameter is required', async () => {
    const params = {
      entity_ref: 'actor',
      component_type: 'ns:comp',
      expected_value: null,
      new_value: 'test',
      result_variable: 'result',
    };
    await handler.execute(params, buildCtx());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ATOMIC_MODIFY_COMPONENT: "field" must be a non-empty string.'
    );
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
  });

  test('validates field parameter is non-empty string', async () => {
    const params = {
      entity_ref: 'actor',
      component_type: 'ns:comp',
      field: '   ',
      expected_value: null,
      new_value: 'test',
      result_variable: 'result',
    };
    await handler.execute(params, buildCtx());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ATOMIC_MODIFY_COMPONENT: "field" must be a non-empty string.'
    );
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
  });

  test('validates result_variable parameter is required', async () => {
    const params = {
      entity_ref: 'actor',
      component_type: 'ns:comp',
      field: 'test',
      expected_value: null,
      new_value: 'test',
    };
    await handler.execute(params, buildCtx());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ATOMIC_MODIFY_COMPONENT: "result_variable" must be a non-empty string.'
    );
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  //  Atomic operation success cases
  // ---------------------------------------------------------------------------
  test('successfully modifies when expected value matches exactly', async () => {
    const currentComponent = { spots: [null, 'actor-2', null] };
    mockEntityManager.getComponentData.mockReturnValue(currentComponent);

    const params = {
      entity_ref: 'target',
      component_type: 'sitting:allows_sitting',
      field: 'spots.0',
      expected_value: null,
      new_value: 'actor-1',
      result_variable: 'success',
    };

    const ctx = buildCtx();
    await handler.execute(params, ctx);

    // Should fetch current component
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
      targetId,
      'sitting:allows_sitting'
    );

    // Should modify and save component
    const expectedModifiedComponent = { spots: ['actor-1', 'actor-2', null] };
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      targetId,
      'sitting:allows_sitting',
      expectedModifiedComponent
    );

    // Should store success result
    expect(ctx.evaluationContext.context.success).toBe(true);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Successfully modified')
    );
  });

  test('handles complex object expected values with deep equality', async () => {
    const currentComponent = {
      config: {
        settings: { enabled: true, count: 5 },
        metadata: { name: 'test' },
      },
    };
    mockEntityManager.getComponentData.mockReturnValue(currentComponent);

    const params = {
      entity_ref: 'actor',
      component_type: 'game:config',
      field: 'config.settings',
      expected_value: { enabled: true, count: 5 },
      new_value: { enabled: false, count: 10 },
      result_variable: 'configUpdated',
    };

    const ctx = buildCtx();
    await handler.execute(params, ctx);

    // Should modify successfully
    const expectedModified = {
      config: {
        settings: { enabled: false, count: 10 },
        metadata: { name: 'test' },
      },
    };
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      actorId,
      'game:config',
      expectedModified
    );
    expect(ctx.evaluationContext.context.configUpdated).toBe(true);
  });

  // ---------------------------------------------------------------------------
  //  Atomic operation failure cases (check failed)
  // ---------------------------------------------------------------------------
  test('fails atomic check when expected value does not match', async () => {
    const currentComponent = { spots: ['actor-2', null, null] };
    mockEntityManager.getComponentData.mockReturnValue(currentComponent);

    const params = {
      entity_ref: 'target',
      component_type: 'sitting:allows_sitting',
      field: 'spots.0',
      expected_value: null, // Expected empty but spot is occupied
      new_value: 'actor-1',
      result_variable: 'success',
    };

    const ctx = buildCtx();
    await handler.execute(params, ctx);

    // Should fetch current component
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
      targetId,
      'sitting:allows_sitting'
    );

    // Should NOT modify component
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();

    // Should store failure result
    expect(ctx.evaluationContext.context.success).toBe(false);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Atomic check failed')
    );
  });

  test('fails when expected complex object does not match exactly', async () => {
    const currentComponent = {
      settings: { enabled: true, count: 5, extra: 'field' },
    };
    mockEntityManager.getComponentData.mockReturnValue(currentComponent);

    const params = {
      entity_ref: 'actor',
      component_type: 'game:config',
      field: 'settings',
      expected_value: { enabled: true, count: 5 }, // Missing 'extra' field
      new_value: { enabled: false },
      result_variable: 'result',
    };

    const ctx = buildCtx();
    await handler.execute(params, ctx);

    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    expect(ctx.evaluationContext.context.result).toBe(false);
  });

  // ---------------------------------------------------------------------------
  //  Component existence and validation
  // ---------------------------------------------------------------------------
  test('fails when component does not exist on entity', async () => {
    mockEntityManager.getComponentData.mockReturnValue(undefined);

    const params = {
      entity_ref: 'actor',
      component_type: 'missing:component',
      field: 'some.field',
      expected_value: 'old',
      new_value: 'new',
      result_variable: 'result',
    };

    const ctx = buildCtx();
    await handler.execute(params, ctx);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Component "missing:component" not found')
    );
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    expect(ctx.evaluationContext.context.result).toBe(false);
  });

  test('fails when component data is not an object', async () => {
    mockEntityManager.getComponentData.mockReturnValue('not-an-object');

    const params = {
      entity_ref: 'actor',
      component_type: 'bad:component',
      field: 'some.field',
      expected_value: 'old',
      new_value: 'new',
      result_variable: 'result',
    };

    const ctx = buildCtx();
    await handler.execute(params, ctx);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('is not an object')
    );
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    expect(ctx.evaluationContext.context.result).toBe(false);
  });

  // ---------------------------------------------------------------------------
  //  Entity reference resolution
  // ---------------------------------------------------------------------------
  test('resolves different entity reference types correctly', async () => {
    const testComponent = { value: 'test' };
    mockEntityManager.getComponentData.mockReturnValue(testComponent);

    // Test actor reference
    await handler.execute(
      {
        entity_ref: 'actor',
        component_type: 'test:comp',
        field: 'value',
        expected_value: 'test',
        new_value: 'updated',
        result_variable: 'result1',
      },
      buildCtx()
    );

    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
      actorId,
      'test:comp'
    );

    // Test target reference
    await handler.execute(
      {
        entity_ref: 'target',
        component_type: 'test:comp',
        field: 'value',
        expected_value: 'test',
        new_value: 'updated',
        result_variable: 'result2',
      },
      buildCtx()
    );

    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
      targetId,
      'test:comp'
    );

    // Test direct entity ID object
    await handler.execute(
      {
        entity_ref: { entityId: 'direct-id' },
        component_type: 'test:comp',
        field: 'value',
        expected_value: 'test',
        new_value: 'updated',
        result_variable: 'result3',
      },
      buildCtx()
    );

    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
      'direct-id',
      'test:comp'
    );
  });

  // ---------------------------------------------------------------------------
  //  EntityManager error handling
  // ---------------------------------------------------------------------------
  test('handles EntityManager.addComponent returning false', async () => {
    const currentComponent = { value: 'test' };
    mockEntityManager.getComponentData.mockReturnValue(currentComponent);
    mockEntityManager.addComponent.mockReturnValue(false);

    const params = {
      entity_ref: 'actor',
      component_type: 'test:comp',
      field: 'value',
      expected_value: 'test',
      new_value: 'new',
      result_variable: 'result',
    };

    const ctx = buildCtx();
    await handler.execute(params, ctx);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'EntityManager.addComponent reported an unexpected failure'
      )
    );
    expect(ctx.evaluationContext.context.result).toBe(false);
  });

  test('handles EntityManager.addComponent throwing an exception', async () => {
    const currentComponent = { value: 'test' };
    mockEntityManager.getComponentData.mockReturnValue(currentComponent);
    const testError = new Error('Database error');
    mockEntityManager.addComponent.mockImplementation(() => {
      throw testError;
    });

    const params = {
      entity_ref: 'actor',
      component_type: 'test:comp',
      field: 'value',
      expected_value: 'test',
      new_value: 'new',
      result_variable: 'result',
    };

    const ctx = buildCtx();
    await handler.execute(params, ctx);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:system_error_occurred',
      expect.objectContaining({
        details: expect.objectContaining({
          error: testError.message,
        }),
      })
    );
    expect(ctx.evaluationContext.context.result).toBe(false);
  });

  // ---------------------------------------------------------------------------
  //  Deep equality testing for edge cases
  // ---------------------------------------------------------------------------
  test('deep equality handles null and undefined correctly', async () => {
    const component1 = { value: null };
    const component2 = { value: undefined };

    mockEntityManager.getComponentData
      .mockReturnValueOnce(component1)
      .mockReturnValueOnce(component2);

    // Test null expected value
    const ctx1 = buildCtx();
    await handler.execute(
      {
        entity_ref: 'actor',
        component_type: 'test:comp',
        field: 'value',
        expected_value: null,
        new_value: 'new',
        result_variable: 'result1',
      },
      ctx1
    );

    expect(ctx1.evaluationContext.context.result1).toBe(true);

    // Test undefined expected value
    const ctx2 = buildCtx();
    await handler.execute(
      {
        entity_ref: 'actor',
        component_type: 'test:comp',
        field: 'value',
        expected_value: undefined,
        new_value: 'new',
        result_variable: 'result2',
      },
      ctx2
    );

    expect(ctx2.evaluationContext.context.result2).toBe(true);
  });

  test('deep equality handles arrays correctly', async () => {
    const currentComponent = {
      items: ['a', 'b', { nested: true }],
    };
    mockEntityManager.getComponentData.mockReturnValue(currentComponent);

    const ctx = buildCtx();
    await handler.execute(
      {
        entity_ref: 'actor',
        component_type: 'test:comp',
        field: 'items',
        expected_value: ['a', 'b', { nested: true }],
        new_value: ['updated'],
        result_variable: 'result',
      },
      ctx
    );

    expect(ctx.evaluationContext.context.result).toBe(true);
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      actorId,
      'test:comp',
      { items: ['updated'] }
    );
  });

  test('deep equality fails for different array lengths', async () => {
    const currentComponent = { items: ['a', 'b'] };
    mockEntityManager.getComponentData.mockReturnValue(currentComponent);

    const ctx = buildCtx();
    await handler.execute(
      {
        entity_ref: 'actor',
        component_type: 'test:comp',
        field: 'items',
        expected_value: ['a', 'b', 'c'], // Different length
        new_value: ['updated'],
        result_variable: 'result',
      },
      ctx
    );

    expect(ctx.evaluationContext.context.result).toBe(false);
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  //  Context logger usage
  // ---------------------------------------------------------------------------
  test('uses logger from execution context when provided', async () => {
    const ctxLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const ctx = buildCtx({ logger: ctxLogger });

    // Use invalid field to trigger warning
    await handler.execute(
      {
        entity_ref: 'actor',
        component_type: 'test:comp',
        field: '',
        expected_value: 'test',
        new_value: 'new',
        result_variable: 'result',
      },
      ctx
    );

    expect(ctxLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('field" must be a non-empty string')
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  //  Path creation and modification edge cases
  // ---------------------------------------------------------------------------
  test('logs and stores failure when setByPath cannot update path', async () => {
    const currentComponent = { nested: 42 };
    mockEntityManager.getComponentData.mockReturnValue(currentComponent);

    const ctx = buildCtx();
    await handler.execute(
      {
        entity_ref: 'actor',
        component_type: 'test:comp',
        field: 'nested.value',
        expected_value: undefined,
        new_value: 'next',
        result_variable: 'result',
      },
      ctx
    );

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ATOMIC_MODIFY_COMPONENT: Failed to set path "nested.value" on component "test:comp".'
    );
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    expect(ctx.evaluationContext.context.result).toBe(false);
  });

  test('warns when storing result in context fails', async () => {
    const currentComponent = { value: 'test' };
    mockEntityManager.getComponentData.mockReturnValue(currentComponent);
    jest
      .spyOn(contextVariableUtils, 'writeContextVariable')
      .mockReturnValue({ success: false, error: new Error('nope') });

    const ctx = buildCtx();
    await handler.execute(
      {
        entity_ref: 'actor',
        component_type: 'test:comp',
        field: 'value',
        expected_value: 'test',
        new_value: 'updated',
        result_variable: 'result',
      },
      ctx
    );

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ATOMIC_MODIFY_COMPONENT: Failed to store result in context variable "result"'
    );
  });
  test('successfully creates nested paths that do not exist', async () => {
    const currentComponent = {}; // Empty component
    mockEntityManager.getComponentData.mockReturnValue(currentComponent);

    const ctx = buildCtx();
    await handler.execute(
      {
        entity_ref: 'actor',
        component_type: 'test:comp',
        field: 'deeply.nested.path',
        expected_value: undefined, // Path doesn't exist
        new_value: 'created',
        result_variable: 'result',
      },
      ctx
    );

    expect(ctx.evaluationContext.context.result).toBe(true);
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      actorId,
      'test:comp',
      { deeply: { nested: { path: 'created' } } }
    );
  });
});
