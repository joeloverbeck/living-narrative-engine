// src/tests/logic/operationHandlers/queryComponentOptionalHandler.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import QueryComponentOptionalHandler from '../../../src/logic/operationHandlers/queryComponentOptionalHandler.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../src/logic/defs.js').ExecutionContext} ExecutionContext */

const mockEntityManager = { getComponentData: jest.fn() };
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const baseCtx = {
  event: { type: 'TEST', payload: {} },
  actor: { id: 'actor1' },
  target: { id: 'target1' },
  logger: mockLogger,
  evaluationContext: {
    actor: { id: 'actor1' },
    target: { id: 'target1' },
    context: {},
  },
};

const ctx = (overrides = {}) => ({
  ...baseCtx,
  evaluationContext: {
    ...baseCtx.evaluationContext,
    context: { ...baseCtx.evaluationContext.context },
    ...(overrides.evaluationContext || {}),
  },
  ...overrides,
});

describe('QueryComponentOptionalHandler', () => {
  /** @type {QueryComponentOptionalHandler} */
  let handler;
  let safeDispatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    safeDispatcher = { dispatch: jest.fn() };
    handler = new QueryComponentOptionalHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: safeDispatcher,
    });
  });

  test('constructor throws with invalid deps', () => {
    expect(
      () =>
        new QueryComponentOptionalHandler({
          logger: mockLogger,
          safeEventDispatcher: { dispatch: jest.fn() },
        })
    ).toThrow(/EntityManager/);
    expect(
      () =>
        new QueryComponentOptionalHandler({
          entityManager: {},
          logger: mockLogger,
          safeEventDispatcher: { dispatch: jest.fn() },
        })
    ).toThrow(/getComponentData/);
    expect(
      () =>
        new QueryComponentOptionalHandler({
          entityManager: mockEntityManager,
          safeEventDispatcher: { dispatch: jest.fn() },
        })
    ).toThrow(/ILogger/);
  });

  test('stores component data when present', () => {
    const params = {
      entity_ref: 'actor',
      component_type: 'core:test',
      result_variable: 'data',
    };
    const c = ctx();
    const result = { foo: 'bar' };
    mockEntityManager.getComponentData.mockReturnValue(result);
    handler.execute(params, c);
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
      'actor1',
      'core:test'
    );
    expect(c.evaluationContext.context.data).toEqual(result);
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(safeDispatcher.dispatch).not.toHaveBeenCalled();
  });

  test('stores null when component missing', () => {
    const params = {
      entity_ref: 'actor',
      component_type: 'core:missing',
      result_variable: 'maybe',
    };
    const c = ctx();
    mockEntityManager.getComponentData.mockReturnValue(undefined);
    handler.execute(params, c);
    expect(c.evaluationContext.context.maybe).toBeNull();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Stored 'null'")
    );
    expect(safeDispatcher.dispatch).not.toHaveBeenCalled();
  });

  test('uses execution context logger if provided', () => {
    const customLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    const params = {
      entity_ref: 'actor',
      component_type: 'core:test',
      result_variable: 'data',
    };
    const c = ctx({ logger: customLogger });
    mockEntityManager.getComponentData.mockReturnValue({});
    handler.execute(params, c);
    expect(customLogger.debug).toHaveBeenCalled();
    expect(mockLogger.debug).not.toHaveBeenCalled();
    expect(safeDispatcher.dispatch).not.toHaveBeenCalled();
  });
});
