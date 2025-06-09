// src/tests/logic/operationInterpreter.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import OperationInterpreter from '../../src/logic/operationInterpreter.js';

/**
 * -----------------------------------------------------------------------
 *  Mock registry and logger
 *  ---------------------------------------------------------------------
 */
const mockRegistry = { getHandler: jest.fn() };
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

/**
 * -----------------------------------------------------------------------
 *  Mock handlers
 *  ---------------------------------------------------------------------
 */
const mockLogHandler = jest.fn();
const mockModifyHandler = jest.fn();
const mockSetVariableHandler = jest.fn();
const mockHandlerWithError = jest.fn(() => {
  throw new Error('Handler failed!');
});

/**
 * -----------------------------------------------------------------------
 *  Sample operations
 *  ---------------------------------------------------------------------
 */
const logOperation = {
  type: 'LOG',
  parameters: { message: 'Test log message for {actor.name}', level: 'info' },
  comment: 'A test log operation',
};
const resolvedLogParameters = {
  message: 'Test log message for Hero',
  level: 'info',
};

const modifyOperation = {
  type: 'MODIFY_COMPONENT',
  parameters: {
    target: '{actor.id}',
    component: 'health',
    changes: { value: -10 },
  },
};
const resolvedModifyParameters = {
  target: 'player',
  component: 'health',
  changes: { value: -10 },
};

const unknownOperation = { type: '  UNKNOWN_OP  ', parameters: {} };

const ifOperation = {
  type: 'IF',
  parameters: {
    condition: { '==': [1, 1] },
    then_actions: [{ type: 'LOG', parameters: { message: 'IF was true' } }],
  },
};

const errorOperation = { type: 'ERROR_OP', parameters: { data: 123 } };

const setVariableOperation = {
  type: 'SET_VARIABLE',
  parameters: { variable_name: 'testVar', value: '{actor.name}' },
};
const resolvedSetVariableParameters = {
  variable_name: 'testVar',
  value: 'Hero',
};

/** operation with bad placeholder (for failing-path test) */
const opInvalidPlaceholder = {
  type: 'LOG',
  parameters: { message: '{invalid.path.that.does.not.exist}' },
};

/**
 * -----------------------------------------------------------------------
 *  Sample execution context
 *  ---------------------------------------------------------------------
 */
const mockExecutionContext = {
  event: { type: 'TEST_EVENT', payload: { someValue: 'payloadValue' } },
  actor: { id: 'player', name: 'Hero' },
  target: null,
  context: { existingVar: 'abc' },
  getService: jest.fn(),
  logger: mockLogger,
};

/**
 * -----------------------------------------------------------------------
 *  Test suite
 *  ---------------------------------------------------------------------
 */
describe('OperationInterpreter', () => {
  let interpreter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegistry.getHandler.mockReset();
    interpreter = new OperationInterpreter({
      logger: mockLogger,
      operationRegistry: mockRegistry,
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Constructor validation
     ─────────────────────────────────────────────────────────────────────── */
  test('constructor should throw if logger is missing or invalid', () => {
    expect(
      () => new OperationInterpreter({ operationRegistry: mockRegistry })
    ).toThrow('ILogger');
    expect(
      () =>
        new OperationInterpreter({
          logger: {},
          operationRegistry: mockRegistry,
        })
    ).toThrow('ILogger');
  });

  test('constructor should throw if registry is missing or invalid', () => {
    expect(() => new OperationInterpreter({ logger: mockLogger })).toThrow(
      'OperationRegistry'
    );
    expect(
      () =>
        new OperationInterpreter({ logger: mockLogger, operationRegistry: {} })
    ).toThrow('OperationRegistry');
  });

  test('constructor should initialize successfully with valid dependencies', () => {
    expect(
      () =>
        new OperationInterpreter({
          logger: mockLogger,
          operationRegistry: mockRegistry,
        })
    ).not.toThrow();
  });

  /* ────────────────────────────────────────────────────────────────────────
     Registry lookup & trimming
     ─────────────────────────────────────────────────────────────────────── */
  test('execute should call registry.getHandler with trimmed operation type', () => {
    mockRegistry.getHandler.mockReturnValue(undefined);
    interpreter.execute(unknownOperation, mockExecutionContext);
    expect(mockRegistry.getHandler).toHaveBeenCalledTimes(1);
    expect(mockRegistry.getHandler).toHaveBeenCalledWith('UNKNOWN_OP');
  });

  /* ────────────────────────────────────────────────────────────────────────
     Handler invocation with resolved parameters
     ─────────────────────────────────────────────────────────────────────── */
  test('execute should call the LOG handler with RESOLVED parameters and context', () => {
    mockRegistry.getHandler.mockReturnValue(mockLogHandler);
    interpreter.execute(logOperation, mockExecutionContext);
    expect(mockRegistry.getHandler).toHaveBeenCalledWith('LOG');
    expect(mockLogHandler).toHaveBeenCalledTimes(1);
    expect(mockLogHandler).toHaveBeenCalledWith(
      resolvedLogParameters,
      mockExecutionContext
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Executing handler for operation type "LOG"...'
    );
  });

  test('execute should call the MODIFY_COMPONENT handler with RESOLVED parameters and context', () => {
    mockRegistry.getHandler.mockReturnValue(mockModifyHandler);
    interpreter.execute(modifyOperation, mockExecutionContext);
    expect(mockRegistry.getHandler).toHaveBeenCalledWith('MODIFY_COMPONENT');
    expect(mockModifyHandler).toHaveBeenCalledTimes(1);
    expect(mockModifyHandler).toHaveBeenCalledWith(
      resolvedModifyParameters,
      mockExecutionContext
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  /* SET_VARIABLE */
  test('execute should call SET_VARIABLE handler with RESOLVED parameters via registry', () => {
    mockRegistry.getHandler.mockImplementation((type) =>
      type === 'SET_VARIABLE' ? mockSetVariableHandler : undefined
    );
    interpreter.execute(setVariableOperation, mockExecutionContext);
    expect(mockRegistry.getHandler).toHaveBeenCalledWith('SET_VARIABLE');
    expect(mockSetVariableHandler).toHaveBeenCalledTimes(1);
    expect(mockSetVariableHandler).toHaveBeenCalledWith(
      resolvedSetVariableParameters,
      mockExecutionContext
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Executing handler for operation type "SET_VARIABLE"...'
    );
  });

  /* ────────────────────────────────────────────────────────────────────────
     Unknown handler
     ─────────────────────────────────────────────────────────────────────── */
  test('execute should log an error and not throw if getHandler returns undefined', () => {
    mockRegistry.getHandler.mockReturnValue(undefined);
    expect(() =>
      interpreter.execute(unknownOperation, mockExecutionContext)
    ).not.toThrow();
    expect(mockRegistry.getHandler).toHaveBeenCalledWith('UNKNOWN_OP');
    expect(mockLogger.error).toHaveBeenCalledWith(
      '---> HANDLER NOT FOUND for operation type: "UNKNOWN_OP". Skipping execution.'
    );
  });

  /* Invalid operation objects */
  test('execute should log error if operation object is invalid (null)', () => {
    interpreter.execute(null, mockExecutionContext);
    expect(mockRegistry.getHandler).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('invalid operation object'),
      expect.objectContaining({ operation: null })
    );
  });

  test('execute should log error if operation.type is missing or empty', () => {
    const opMissingType = { parameters: {} };
    interpreter.execute(opMissingType, mockExecutionContext);
    expect(mockRegistry.getHandler).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();

    const opWhitespaceType = { type: '  ', parameters: {} };
    interpreter.execute(opWhitespaceType, mockExecutionContext);
    expect(mockRegistry.getHandler).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  /* ────────────────────────────────────────────────────────────────────────
     🔧  Updated – behaviour for unresolved full-string placeholders
     ─────────────────────────────────────────────────────────────────────── */
  test('execute should warn and call handler with parameters where an unresolved full-string placeholder becomes undefined', () => {
    mockRegistry.getHandler.mockReturnValue(mockLogHandler);

    expect(() =>
      interpreter.execute(opInvalidPlaceholder, mockExecutionContext)
    ).not.toThrow();

    expect(mockRegistry.getHandler).toHaveBeenCalledWith('LOG');
    expect(mockLogHandler).toHaveBeenCalledTimes(1);

    const [actualParams] = mockLogHandler.mock.calls[0];
    expect(actualParams).toEqual({ message: undefined });

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Placeholder path "invalid.path.that.does.not.exist"'
      )
    );
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Error resolving placeholders')
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Executing handler for operation type "LOG"...'
    );
  });

  /* ────────────────────────────────────────────────────────────────────────
     IF behaves like any other op (no special logic in interpreter)
     ─────────────────────────────────────────────────────────────────────── */
  test('execute should treat IF like any other type (lookup in registry)', () => {
    mockRegistry.getHandler.mockReturnValue(undefined);
    interpreter.execute(ifOperation, mockExecutionContext);
    expect(mockRegistry.getHandler).toHaveBeenCalledWith('IF');
    expect(mockLogger.error).toHaveBeenCalledWith(
      '---> HANDLER NOT FOUND for operation type: "IF". Skipping execution.'
    );
  });

  /* ────────────────────────────────────────────────────────────────────────
     Re-throw handler errors
     ─────────────────────────────────────────────────────────────────────── */
  test('execute should re-throw errors originating from the handler function', () => {
    const error = new Error('Handler failed!');
    mockHandlerWithError.mockImplementationOnce(() => {
      throw error;
    });
    mockRegistry.getHandler.mockReturnValue(mockHandlerWithError);

    expect(() =>
      interpreter.execute(errorOperation, mockExecutionContext)
    ).toThrow(error);

    expect(mockRegistry.getHandler).toHaveBeenCalledWith('ERROR_OP');
    expect(mockHandlerWithError).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Handler for operation type "ERROR_OP" threw an error. Rethrowing...'
    );
  });
});
