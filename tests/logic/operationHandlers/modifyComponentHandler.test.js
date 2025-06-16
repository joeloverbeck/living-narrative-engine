// src/tests/logic/operationHandlers/modifyComponentHandler.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import ModifyComponentHandler from '../../../src/logic/operationHandlers/modifyComponentHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

// --- Type-hints (for editors only) ------------------------------------------
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/entities/entityManager.js').default} EntityManager */ // Assuming default export
/** @typedef {import('../../../src/logic/defs.js').ExecutionContext} ExecutionContext */

// -----------------------------------------------------------------------------
//  Mock services
// -----------------------------------------------------------------------------
const mockEntityManager = {
  getComponentData: jest.fn(),
  addComponent: jest.fn(), // Crucial for the new logic
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
//  Test-suite
// -----------------------------------------------------------------------------
describe('ModifyComponentHandler', () => {
  /** @type {ModifyComponentHandler} */
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for addComponent to simulate success
    mockEntityManager.addComponent.mockReturnValue(true);
    // Clear any specific mock implementations for getComponentData from previous tests
    mockEntityManager.getComponentData.mockReset();
    dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    handler = new ModifyComponentHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: dispatcher,
    });
  });

  // ---------------------------------------------------------------------------
  //  Constructor validation
  // ---------------------------------------------------------------------------
  test('throws without valid dependencies', () => {
    expect(() => new ModifyComponentHandler({ logger: mockLogger })).toThrow(
      /entityManager/
    );
    expect(
      () =>
        new ModifyComponentHandler({
          entityManager: {
            addComponent: jest.fn() /* missing getComponentData */,
          },
          logger: mockLogger,
        })
    ).toThrow(/getComponentData/);
    expect(
      () => new ModifyComponentHandler({ entityManager: mockEntityManager })
    ).toThrow(/logger/);
    expect(
      () =>
        new ModifyComponentHandler({
          entityManager: mockEntityManager,
          logger: mockLogger,
        })
    ).toThrow(/safeEventDispatcher/);
  });

  // ---------------------------------------------------------------------------
  //  Validation: Field is required
  // ---------------------------------------------------------------------------
  test('set mode without field warns and skips', () => {
    const params = {
      entity_ref: 'actor',
      component_type: 'ns:c',
      mode: 'set',
      value: { a: 1 },
    };
    handler.execute(params, buildCtx());
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled(); // Should not call addComponent
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'MODIFY_COMPONENT: "field" must be a non-empty string.'
    );
  });

  // ---------------------------------------------------------------------------
  //  Field-level SET – path creation
  // ---------------------------------------------------------------------------
  test('set nested field creates path and assigns value', () => {
    const initialCompObj = {}; // What getComponentData returns
    mockEntityManager.getComponentData.mockReturnValue(initialCompObj);

    const params = {
      entity_ref: 'actor',
      component_type: 'game:stats',
      field: 'resources.mana.current',
      mode: 'set',
      value: 5,
    };
    handler.execute(params, buildCtx());

    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
      actorId,
      'game:stats'
    );
    // Assert that addComponent was called with the modified data
    const expectedModifiedData = {
      resources: {
        mana: {
          current: 5,
        },
      },
    };
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      actorId,
      'game:stats',
      expectedModifiedData
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  //  Entity reference resolution paths
  // ---------------------------------------------------------------------------
  test('resolves "actor", "target", direct id for getComponentData and addComponent', () => {
    const initialData = { f: 0 };
    mockEntityManager.getComponentData.mockReturnValue(initialData);
    const expectedModifiedData = { f: 1 };

    // Actor
    handler.execute(
      {
        entity_ref: 'actor',
        component_type: 'c:t',
        field: 'f',
        mode: 'set',
        value: 1,
      },
      buildCtx()
    );
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
      actorId,
      'c:t'
    );
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      actorId,
      'c:t',
      expectedModifiedData
    );

    // Target
    handler.execute(
      {
        entity_ref: 'target',
        component_type: 't:id',
        field: 'f',
        mode: 'set',
        value: 1,
      },
      buildCtx()
    );
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
      targetId,
      't:id'
    );
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      targetId,
      't:id',
      expectedModifiedData
    );

    // Direct ID
    handler.execute(
      {
        entity_ref: { entityId: 'specific' },
        component_type: 'x:y',
        field: 'f',
        mode: 'set',
        value: 1,
      },
      buildCtx()
    );
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
      'specific',
      'x:y'
    );
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      'specific',
      'x:y',
      expectedModifiedData
    );
  });

  test('fails to resolve bad entity_ref and logs (with field present)', () => {
    handler.execute(
      {
        entity_ref: '  ',
        component_type: 'c',
        field: 'some_field',
        mode: 'set',
        value: {},
      },
      buildCtx()
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('could not resolve entity id'),
      expect.anything()
    );
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Validation: Component existence and type checks
  // ---------------------------------------------------------------------------
  test('warns if component does not exist on entity', () => {
    mockEntityManager.getComponentData.mockReturnValue(undefined);
    handler.execute(
      {
        entity_ref: 'actor',
        component_type: 'non:existent',
        field: 'some.field',
        mode: 'set',
        value: 123,
      },
      buildCtx()
    );
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
      actorId,
      'non:existent'
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Component "non:existent" not found on entity "actor-1"'
      )
    );
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
  });

  test('warns if retrieved component data is not an object', () => {
    mockEntityManager.getComponentData.mockReturnValue('not-an-object');
    handler.execute(
      {
        entity_ref: 'actor',
        component_type: 'bad:data',
        field: 'some.field',
        mode: 'set',
        value: 123,
      },
      buildCtx()
    );
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
      actorId,
      'bad:data'
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Component "bad:data" on entity "actor-1" is not an object'
      )
    );
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  //  Context logger precedence
  // ---------------------------------------------------------------------------
  test('uses logger from execution context when provided', () => {
    const ctxLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    const ctx = buildCtx({ logger: ctxLogger });
    // Use an invalid mode to trigger a warning
    handler.execute(
      {
        entity_ref: 'actor',
        component_type: 'c',
        field: 'f',
        mode: 'inc', // Invalid mode on purpose
        value: 'bad',
      },
      ctx
    );
    expect(ctxLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unsupported mode "inc"')
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // EntityManager interaction
  // ---------------------------------------------------------------------------
  test('logs warning if entityManager.addComponent returns false', () => {
    const initialCompObj = { stats: { hp: 10 } };
    mockEntityManager.getComponentData.mockReturnValue(initialCompObj);
    mockEntityManager.addComponent.mockReturnValue(false); // Simulate addComponent failure

    const params = {
      entity_ref: 'actor',
      component_type: 'core:stats',
      field: 'stats.hp',
      mode: 'set',
      value: 25,
    };
    handler.execute(params, buildCtx());

    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      actorId,
      'core:stats',
      { stats: { hp: 25 } }
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'EntityManager.addComponent reported an unexpected failure'
      )
    );
  });

  test('logs error if entityManager.addComponent throws', () => {
    const initialCompObj = { stats: { hp: 10 } };
    mockEntityManager.getComponentData.mockReturnValue(initialCompObj);
    const testError = new Error('Validation failed in EM');
    mockEntityManager.addComponent.mockImplementation(() => {
      throw testError;
    });

    const params = {
      entity_ref: 'actor',
      component_type: 'core:stats',
      field: 'stats.hp',
      mode: 'set',
      value: 25,
    };
    handler.execute(params, buildCtx());

    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      actorId,
      'core:stats',
      { stats: { hp: 25 } }
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        details: expect.objectContaining({ error: testError.message }),
      })
    );
  });
});
