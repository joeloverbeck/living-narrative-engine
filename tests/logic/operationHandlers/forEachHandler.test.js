// tests/logic/operations/forEachHandler.test.js
// -----------------------------------------------------------------------------
//  FOR_EACH Handler  —  Test Suite
// -----------------------------------------------------------------------------

import ForEachHandler from '../../../src/logic/operationHandlers/forEachHandler.js';
import { describe, expect, jest, test } from '@jest/globals';

// -----------------------------------------------------------------------------
//  MOCKS & HELPERS
// -----------------------------------------------------------------------------

const makeMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeExecCtx = () => ({
  evaluationContext: {
    context: {},
  },
  logger: makeMockLogger(), // A logger for the execution context itself
});

// -----------------------------------------------------------------------------
//  TESTS
// -----------------------------------------------------------------------------

describe('FOR_EACH handler', () => {
  // ---------------------------------------------------------------------------
  //  Happy Path & Core Logic
  // ---------------------------------------------------------------------------

  test('Requirement 1: Executes nested actions with correct variable binding', () => {
    const logger = makeMockLogger();
    const capturedContexts = [];
    const opInterpreter = {
      execute: jest.fn((_op, execCtx) => {
        capturedContexts.push(
          JSON.parse(JSON.stringify(execCtx.evaluationContext.context))
        );
      }),
    };

    const handler = new ForEachHandler({
      logger,
      operationInterpreter: opInterpreter,
    });

    const execCtx = makeExecCtx();
    execCtx.evaluationContext.context.items = ['alpha', 'beta', 'gamma'];

    handler.execute(
      {
        collection: 'context.items',
        item_variable: 'currentItem',
        actions: [{ type: 'LOG', parameters: { message: 'hello' } }],
      },
      execCtx
    );

    expect(opInterpreter.execute).toHaveBeenCalledTimes(3);
    expect(capturedContexts[0].currentItem).toBe('alpha');
    expect(capturedContexts[1].currentItem).toBe('beta');
    expect(capturedContexts[2].currentItem).toBe('gamma');
    expect(execCtx.evaluationContext.context.currentItem).toBeUndefined();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('Restores a pre-existing variable value after execution', () => {
    const logger = makeMockLogger();
    const opInterpreter = { execute: jest.fn() };
    const handler = new ForEachHandler({
      logger,
      operationInterpreter: opInterpreter,
    });
    const execCtx = makeExecCtx();

    execCtx.evaluationContext.context.loopVar = 'initial_value';
    execCtx.evaluationContext.context.myArray = [1, 2];

    handler.execute(
      {
        collection: 'context.myArray',
        item_variable: 'loopVar',
        actions: [{ type: 'NOOP' }],
      },
      execCtx
    );

    expect(opInterpreter.execute).toHaveBeenCalledTimes(2);
    expect(execCtx.evaluationContext.context.loopVar).toBe('initial_value');
  });

  // ---------------------------------------------------------------------------
  //  Error Handling & Edge Cases
  // ---------------------------------------------------------------------------

  test('Requirement 2: Stops looping and propagates error if a nested action throws', () => {
    const logger = makeMockLogger();
    const nestedError = new Error('Action failed!');
    const opInterpreter = {
      execute: jest
        .fn()
        .mockImplementationOnce(() => {})
        .mockImplementationOnce(() => {
          throw nestedError;
        }),
    };

    const handler = new ForEachHandler({
      logger,
      operationInterpreter: opInterpreter,
    });
    const execCtx = makeExecCtx();
    execCtx.evaluationContext.context.records = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ];
    execCtx.evaluationContext.context.v = 'original';

    expect(() =>
      handler.execute(
        {
          collection: 'context.records',
          item_variable: 'v',
          actions: [{ type: 'FAIL' }],
        },
        execCtx
      )
    ).toThrow(nestedError);

    expect(opInterpreter.execute).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      'FOR_EACH: nested action threw at loop index 1. Aborting loop.',
      nestedError
    );
    expect(execCtx.evaluationContext.context.v).toBe('original');
  });

  test('Requirement 3: Logs warning and exits if collection path does not resolve to an array', () => {
    const logger = makeMockLogger();
    const opInterpreter = { execute: jest.fn() };
    const handler = new ForEachHandler({
      logger,
      operationInterpreter: opInterpreter,
    });
    const execCtx = makeExecCtx();

    execCtx.evaluationContext.context.items = { not: 'an array' };
    handler.execute(
      {
        collection: 'context.items',
        item_variable: 'i',
        actions: [{ type: 'NOOP' }],
      },
      execCtx
    );

    expect(logger.warn).toHaveBeenCalledWith(
      `FOR_EACH: Path 'context.items' did not resolve to an array (got object). Loop skipped.`
    );

    handler.execute(
      {
        collection: 'context.nonexistent',
        item_variable: 'i',
        actions: [{ type: 'NOOP' }],
      },
      execCtx
    );

    expect(logger.warn).toHaveBeenCalledWith(
      `FOR_EACH: Path 'context.nonexistent' did not resolve to an array (got undefined). Loop skipped.`
    );

    expect(opInterpreter.execute).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  //  Input Validation
  // ---------------------------------------------------------------------------

  describe('Input Validation', () => {
    // FIX: Split into two tests for the two different log.warn() call signatures.

    // Test case for when `params` itself is invalid (logs with 2 arguments)
    test.each([
      [null, 'params missing or not an object'],
      [undefined, 'params missing or not an object'],
      ['a string', 'params missing or not an object'],
    ])('should log warning when params is %p', (params, expectedWarning) => {
      const logger = makeMockLogger();
      const opInterpreter = { execute: jest.fn() };
      const handler = new ForEachHandler({
        logger,
        operationInterpreter: opInterpreter,
      });

      handler.execute(params, makeExecCtx());

      expect(logger.warn).toHaveBeenCalledTimes(1);
      // Assert it was called with the message AND the params object
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(expectedWarning),
        { params }
      );
      expect(opInterpreter.execute).not.toHaveBeenCalled();
    });

    // Test cases for when a property inside `params` is invalid (logs with 1 argument)
    test.each([
      [
        { collection: '', item_variable: 'v', actions: [{}] },
        '"collection" must be non-empty string',
      ],
      [
        { collection: ' ', item_variable: 'v', actions: [{}] },
        '"collection" must be non-empty string',
      ],
      [
        { collection: 'c', item_variable: '', actions: [{}] },
        '"item_variable" must be non-empty string',
      ],
      [
        { collection: 'c', item_variable: ' ', actions: [{}] },
        '"item_variable" must be non-empty string',
      ],
      [
        { collection: 'c', item_variable: 'v', actions: [] },
        '"actions" must be non-empty array',
      ],
      [
        { collection: 'c', item_variable: 'v', actions: 'not-an-array' },
        '"actions" must be non-empty array',
      ],
    ])(
      'should log warning for invalid property in params: %p',
      (params, expectedWarning) => {
        const logger = makeMockLogger();
        const opInterpreter = { execute: jest.fn() };
        const handler = new ForEachHandler({
          logger,
          operationInterpreter: opInterpreter,
        });

        handler.execute(params, makeExecCtx());

        expect(logger.warn).toHaveBeenCalledTimes(1);
        // Assert it was called with ONLY the message string
        expect(logger.warn).toHaveBeenCalledWith(
          `FOR_EACH: ${expectedWarning}`
        );
        expect(opInterpreter.execute).not.toHaveBeenCalled();
      }
    );
  });

  // ---------------------------------------------------------------------------
  //  Constructor Validation
  // ---------------------------------------------------------------------------
  describe('Constructor', () => {
    test('should throw if logger is missing or invalid', () => {
      expect(
        () =>
          new ForEachHandler({
            operationInterpreter: {
              execute: () => {},
            },
          })
      ).toThrow('ForEachHandler needs ILogger');
      expect(
        () =>
          new ForEachHandler({
            logger: {},
            operationInterpreter: {
              execute: () => {},
            },
          })
      ).toThrow('ForEachHandler needs ILogger');
    });

    test('should throw if operationInterpreter is missing or invalid', () => {
      expect(() => new ForEachHandler({ logger: makeMockLogger() })).toThrow(
        'ForEachHandler needs OperationInterpreter'
      );
      expect(
        () =>
          new ForEachHandler({
            logger: makeMockLogger(),
            operationInterpreter: {},
          })
      ).toThrow('ForEachHandler needs OperationInterpreter');
    });
  });
});
