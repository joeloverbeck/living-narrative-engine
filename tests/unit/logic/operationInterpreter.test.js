// tests/logic/operationInterpreter.test.js

/**
 * @jest-environment node
 */
import {
  describe,
  expect,
  test,
  jest,
  beforeEach,
  beforeAll,
  afterAll,
} from '@jest/globals';
import jsonLogic from 'json-logic-js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import { LOGGER_INFO_METHOD_ERROR } from '../../common/constants.js';

/**
 * -----------------------------------------------------------------------
 * Mock registry and logger
 * ---------------------------------------------------------------------
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
 * Mock handlers
 * ---------------------------------------------------------------------
 */
const mockLogHandler = jest.fn();
const mockModifyHandler = jest.fn();
const mockSetVariableHandler = jest.fn();
const mockQueryEntitiesHandler = jest.fn();
const mockHandlerWithError = jest.fn(() => {
  throw new Error('Handler failed!');
});

/**
 * -----------------------------------------------------------------------
 * Sample operations
 * ---------------------------------------------------------------------
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

const withComponentDataCondition = {
  '==': [{ var: 'leaderId' }, 'leader-123'],
};

const queryEntitiesOperation = {
  type: 'QUERY_ENTITIES',
  parameters: {
    result_variable: 'followers',
    filters: [
      {
        with_component_data: {
          component_type: 'companionship:following',
          condition: withComponentDataCondition,
        },
      },
    ],
  },
};

/** operation with bad placeholder (for failing-path test) */
const opInvalidPlaceholder = {
  type: 'LOG',
  parameters: { message: '{invalid.path.that.does.not.exist}' },
};

/**
 * -----------------------------------------------------------------------
 * Sample execution context
 * ---------------------------------------------------------------------
 */
const mockExecutionContext = {
  event: { type: 'TEST_EVENT', payload: { someValue: 'payloadValue' } },
  actor: { id: 'player', name: 'Hero' },
  target: null,
  context: { existingVar: 'abc' },
  getService: jest.fn(),
  logger: mockLogger,
  evaluationContext: {
    context: {},
  },
};

/**
 * -----------------------------------------------------------------------
 * Test suite
 * ---------------------------------------------------------------------
 */
describe('OperationInterpreter', () => {
  let interpreter;

  beforeAll(() => {
    jsonLogic.add_operation('double', (value) => value * 2);
  });

  afterAll(() => {
    jsonLogic.rm_operation('double');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegistry.getHandler.mockReset();
    mockQueryEntitiesHandler.mockReset();
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
    ).toThrow('Missing required dependency: logger.');
    expect(
      () =>
        new OperationInterpreter({
          logger: {},
          operationRegistry: mockRegistry,
        })
    ).toThrow(LOGGER_INFO_METHOD_ERROR);
  });

  test('constructor should throw if registry is missing or invalid', () => {
    expect(() => new OperationInterpreter({ logger: mockLogger })).toThrow(
      'Missing required dependency: OperationInterpreter: operationRegistry.'
    );
    expect(
      () =>
        new OperationInterpreter({ logger: mockLogger, operationRegistry: {} })
    ).toThrow(
      "Invalid or missing method 'getHandler' on dependency 'OperationInterpreter: operationRegistry'."
    );
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
      'OperationInterpreter: Executing handler for operation type "LOG"…'
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

  test('execute returns the handler result for synchronous handlers', () => {
    const handlerResult = { success: true };
    mockRegistry.getHandler.mockReturnValue(() => handlerResult);

    const result = interpreter.execute(logOperation, mockExecutionContext);

    expect(result).toBe(handlerResult);
  });

  test('execute resolves promises returned by handlers and propagates the value', async () => {
    const handlerResult = { success: true };
    const asyncHandler = jest.fn().mockResolvedValue(handlerResult);
    mockRegistry.getHandler.mockReturnValue(asyncHandler);

    const resultPromise = interpreter.execute(logOperation, mockExecutionContext);

    await expect(resultPromise).resolves.toBe(handlerResult);
    expect(asyncHandler).toHaveBeenCalledWith(
      resolvedLogParameters,
      mockExecutionContext
    );
  });

  test('execute resolves custom JSON Logic operations inside parameters', () => {
    const operationWithCustomLogic = {
      type: 'SET_VARIABLE',
      parameters: {
        variable_name: 'computed',
        value: { double: [5] },
      },
    };

    mockRegistry.getHandler.mockReturnValue(mockSetVariableHandler);

    interpreter.execute(operationWithCustomLogic, mockExecutionContext);

    expect(mockSetVariableHandler).toHaveBeenCalledWith(
      { variable_name: 'computed', value: 10 },
      mockExecutionContext
    );
  });

  test('execute should preserve JSON Logic conditions inside with_component_data filters', () => {
    mockRegistry.getHandler.mockReturnValue(mockQueryEntitiesHandler);

    const executionContext = {
      ...mockExecutionContext,
      evaluationContext: { context: {} },
    };

    interpreter.execute(queryEntitiesOperation, executionContext);

    expect(mockRegistry.getHandler).toHaveBeenCalledWith('QUERY_ENTITIES');
    expect(mockQueryEntitiesHandler).toHaveBeenCalledTimes(1);

    const [params] = mockQueryEntitiesHandler.mock.calls[0];
    expect(params.filters[0].with_component_data.condition).toEqual(
      withComponentDataCondition
    );
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
      'OperationInterpreter: Executing handler for operation type "SET_VARIABLE"…'
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
      'OperationInterpreter: ---> HANDLER NOT FOUND for operation type: "UNKNOWN_OP".'
    );
  });

  /* Invalid operation objects */
  test('execute should log error if operation object is invalid (null)', () => {
    interpreter.execute(null, mockExecutionContext);
    expect(mockRegistry.getHandler).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'OperationInterpreter received invalid operation object'
      ),
      expect.objectContaining({ operation: null })
    );
  });

  test('execute should log error if operation.type is missing or empty', () => {
    const opMissingType = { parameters: {} };
    interpreter.execute(opMissingType, mockExecutionContext);
    expect(mockRegistry.getHandler).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'OperationInterpreter: OperationInterpreter.execute: operationType must be a non-empty string.'
    );
  });

  /* ────────────────────────────────────────────────────────────────────────
     🔧  Updated – behaviour for unresolved full-string placeholders
     ─────────────────────────────────────────────────────────────────────── */
  test('execute should log debug and call handler with parameters where an unresolved full-string placeholder becomes undefined', () => {
    mockRegistry.getHandler.mockReturnValue(mockLogHandler);

    expect(() =>
      interpreter.execute(opInvalidPlaceholder, mockExecutionContext)
    ).not.toThrow();

    expect(mockRegistry.getHandler).toHaveBeenCalledWith('LOG');
    expect(mockLogHandler).toHaveBeenCalledTimes(1);

    const [actualParams] = mockLogHandler.mock.calls[0];
    expect(actualParams).toEqual({ message: undefined });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'OperationInterpreter: PlaceholderResolver: Placeholder "{invalid.path.that.does.not.exist}" not found in provided data sources. Replacing with empty string.'
    );
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Error resolving placeholders')
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'OperationInterpreter: Executing handler for operation type "LOG"…'
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
      'OperationInterpreter: ---> HANDLER NOT FOUND for operation type: "IF".'
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
      'OperationInterpreter: Handler for operation "ERROR_OP" threw – re-throwing to caller.'
    );
  });
});
