/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import IfHandler from '../../../../src/logic/operationHandlers/ifHandler.js';

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
    context: { testValue: true },
  },
};

// --- Test Suite ---
describe('IfHandler', () => {
  /** @type {IfHandler} */
  let handler;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Create a new handler instance for isolation
    handler = new IfHandler({
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
          new IfHandler({
            jsonLogic: mockJsonLogic,
            logger: mockLogger,
          })
      ).toThrow(
        'IfHandler requires a valid OperationInterpreter resolver or instance.'
      );
    });

    test('should throw if operationInterpreter is invalid', () => {
      expect(
        () =>
          new IfHandler({
            operationInterpreter: {},
            jsonLogic: mockJsonLogic,
            logger: mockLogger,
          })
      ).toThrow(
        'IfHandler requires operationInterpreter to be either a resolver function or an object with execute() method.'
      );
    });

    test('should throw if jsonLogic is missing', () => {
      expect(
        () =>
          new IfHandler({
            operationInterpreter: mockOperationInterpreter,
            logger: mockLogger,
          })
      ).toThrow(
        'IfHandler requires a valid JsonLogicEvaluationService instance.'
      );
    });

    test('should throw if jsonLogic is invalid', () => {
      expect(
        () =>
          new IfHandler({
            operationInterpreter: mockOperationInterpreter,
            jsonLogic: {},
            logger: mockLogger,
          })
      ).toThrow(
        'IfHandler requires a valid JsonLogicEvaluationService instance.'
      );
    });

    test('should throw if logger is missing', () => {
      expect(
        () =>
          new IfHandler({
            operationInterpreter: mockOperationInterpreter,
            jsonLogic: mockJsonLogic,
          })
      ).toThrow('IfHandler requires a valid ILogger instance.');
    });

    test('should throw if logger is invalid', () => {
      expect(
        () =>
          new IfHandler({
            operationInterpreter: mockOperationInterpreter,
            jsonLogic: mockJsonLogic,
            logger: {},
          })
      ).toThrow('IfHandler requires a valid ILogger instance.');
    });

    test('should construct successfully with valid dependencies', () => {
      expect(() => {
        new IfHandler({
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
  describe('IF operation execution', () => {
    test('should execute with valid parameters', async () => {
      const params = {
        condition: { '==': [{ var: 'testValue' }, true] },
        then_actions: [{ type: 'LOG', parameters: { message: 'then' } }],
        else_actions: [{ type: 'LOG', parameters: { message: 'else' } }],
      };

      await handler.execute(params, mockExecutionContext);

      // Should not error
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should accept parameters with only then_actions', async () => {
      const params = {
        condition: { '==': [1, 1] },
        then_actions: [{ type: 'LOG', parameters: { message: 'then' } }],
      };

      await handler.execute(params, mockExecutionContext);

      // Should not error
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should accept parameters with empty actions arrays', async () => {
      const params = {
        condition: { '==': [1, 1] },
        then_actions: [],
        else_actions: [],
      };

      await handler.execute(params, mockExecutionContext);

      // Should not error
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
