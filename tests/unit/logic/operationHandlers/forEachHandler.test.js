/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import ForEachHandler from '../../../../src/logic/operationHandlers/forEachHandler.js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/logic/defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../../../src/logic/operationInterpreter.js').default} OperationInterpreter */
/** @typedef {import('../../../../src/logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */

// --- Mock OperationInterpreter ---
const mockOperationInterpreter = {
  execute: jest.fn(),
};

// --- Mock JsonLogicEvaluationService ---
const mockJsonLogic = {
  evaluate: jest.fn(),
};

// --- Mock Logger ---
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// --- Mock Execution Context ---
const mockExecutionContext = {
  evaluationContext: {
    event: { type: 'TEST_EVENT', payload: {} },
    actor: null,
    target: null,
    context: {
      items: ['item1', 'item2', 'item3'],
    },
  },
};

// --- Test Suite ---
describe('ForEachHandler', () => {
  /** @type {ForEachHandler} */
  let handler;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Create a new handler instance for isolation
    handler = new ForEachHandler({
      operationInterpreter: mockOperationInterpreter,
      jsonLogic: mockJsonLogic,
      logger: mockLogger,
    });
  });

  // --- Constructor Tests ---
  describe('constructor validation', () => {
    test('should throw if operationInterpreter is missing', () => {
      expect(
        () =>
          new ForEachHandler({
            jsonLogic: mockJsonLogic,
            logger: mockLogger,
          })
      ).toThrow('ForEachHandler requires a valid OperationInterpreter resolver or instance.');
    });

    test('should throw if operationInterpreter is invalid', () => {
      expect(
        () =>
          new ForEachHandler({
            operationInterpreter: {},
            jsonLogic: mockJsonLogic,
            logger: mockLogger,
          })
      ).toThrow('ForEachHandler requires operationInterpreter to be either a resolver function or an object with execute() method.');
    });

    test('should throw if jsonLogic is missing', () => {
      expect(
        () =>
          new ForEachHandler({
            operationInterpreter: mockOperationInterpreter,
            logger: mockLogger,
          })
      ).toThrow('ForEachHandler requires a valid JsonLogicEvaluationService instance.');
    });

    test('should throw if jsonLogic is invalid', () => {
      expect(
        () =>
          new ForEachHandler({
            operationInterpreter: mockOperationInterpreter,
            jsonLogic: {},
            logger: mockLogger,
          })
      ).toThrow('ForEachHandler requires a valid JsonLogicEvaluationService instance.');
    });

    test('should throw if logger is missing', () => {
      expect(
        () =>
          new ForEachHandler({
            operationInterpreter: mockOperationInterpreter,
            jsonLogic: mockJsonLogic,
          })
      ).toThrow('ForEachHandler requires a valid ILogger instance.');
    });

    test('should throw if logger is invalid', () => {
      expect(
        () =>
          new ForEachHandler({
            operationInterpreter: mockOperationInterpreter,
            jsonLogic: mockJsonLogic,
            logger: {},
          })
      ).toThrow('ForEachHandler requires a valid ILogger instance.');
    });

    test('should construct successfully with valid dependencies', () => {
      expect(() => {
        new ForEachHandler({
          operationInterpreter: mockOperationInterpreter,
          jsonLogic: mockJsonLogic,
          logger: mockLogger,
        });
      }).not.toThrow();
    });
  });

  // --- Parameter Validation Tests ---
  describe('parameter validation', () => {
    test('should handle null parameters gracefully', async () => {
      await handler.execute(null, mockExecutionContext);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters'),
        expect.any(Object)
      );
    });

    test('should handle undefined parameters gracefully', async () => {
      await handler.execute(undefined, mockExecutionContext);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters'),
        expect.any(Object)
      );
    });

    test('should handle non-object parameters gracefully', async () => {
      await handler.execute('invalid', mockExecutionContext);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters'),
        expect.any(Object)
      );
    });
  });

  // --- Execution Tests ---
  describe('FOR_EACH operation execution', () => {
    test('should execute with valid parameters', async () => {
      const params = {
        collection: 'items',
        item_variable: 'currentItem',
        actions: [{ type: 'LOG', parameters: { message: 'Processing item' } }],
      };

      await handler.execute(params, mockExecutionContext);

      // Should not error
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should accept parameters with empty actions array', async () => {
      const params = {
        collection: 'items',
        item_variable: 'currentItem',
        actions: [],
      };

      await handler.execute(params, mockExecutionContext);

      // Flow handler will handle this - no error from wrapper
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should accept valid collection paths', async () => {
      const params = {
        collection: 'actor.inventory',
        item_variable: 'item',
        actions: [{ type: 'LOG', parameters: { message: 'item' } }],
      };

      await handler.execute(params, mockExecutionContext);

      // Should not error
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
