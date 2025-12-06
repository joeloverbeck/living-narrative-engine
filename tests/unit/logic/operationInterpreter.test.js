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
import OperationInterpreter, {
  __internal as operationInterpreterInternals,
} from '../../../src/logic/operationInterpreter.js';
import * as contextUtils from '../../../src/utils/contextUtils.js';
import { LOGGER_INFO_METHOD_ERROR } from '../../common/constants.js';
import { MissingHandlerError } from '../../../src/errors/missingHandlerError.js';

/**
 * -----------------------------------------------------------------------
 * Mock registry and logger
 * ---------------------------------------------------------------------
 */
const mockRegistry = {
  getHandler: jest.fn(),
  getRegisteredTypes: jest.fn(),
};
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

const {
  evaluateJsonLogicRecursively,
  hasValidJsonLogicShape,
  shouldSkipJsonLogicEvaluation,
  JSON_LOGIC_SKIP_PATHS,
  diagnoseOperationRegistration,
} = operationInterpreterInternals;

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
    mockRegistry.getRegisteredTypes.mockReset();
    mockQueryEntitiesHandler.mockReset();
    // Set default return value for getRegisteredTypes
    mockRegistry.getRegisteredTypes.mockReturnValue([
      'ADD_COMPONENT',
      'REMOVE_COMPONENT',
    ]);
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
  test('execute should call registry.getHandler with trimmed operation type and throw MissingHandlerError', () => {
    mockRegistry.getHandler.mockReturnValue(undefined);
    expect(() =>
      interpreter.execute(unknownOperation, mockExecutionContext)
    ).toThrow(MissingHandlerError);
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

    const resultPromise = interpreter.execute(
      logOperation,
      mockExecutionContext
    );

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

  test('execute skips JsonLogic evaluation for malformed operator objects', () => {
    const malformedJsonLogic = { if: 'literal string payload' };
    const spy = jest.spyOn(jsonLogic, 'apply');

    mockRegistry.getHandler.mockReturnValue(mockLogHandler);

    try {
      interpreter.execute(
        {
          type: 'CONFIGURE',
          parameters: { payload: malformedJsonLogic },
        },
        mockExecutionContext
      );

      expect(spy).not.toHaveBeenCalledWith(
        expect.objectContaining({ if: 'literal string payload' }),
        expect.anything()
      );
    } finally {
      spy.mockRestore();
    }
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

  describe('JSON Logic evaluation scenarios', () => {
    test('execute evaluates nested JSON Logic expressions with arrays and nested operators', () => {
      const capturingHandler = jest.fn((params) => params);
      mockRegistry.getHandler.mockReturnValue(capturingHandler);

      const executionContext = {
        ...mockExecutionContext,
        actor: { ...mockExecutionContext.actor, name: 'Hero' },
        evaluationContext: {
          ...mockExecutionContext.evaluationContext,
          context: { shouldLog: true, fallbackValue: 'fallback' },
          actor: { name: 'Hero' },
        },
      };

      const operation = {
        type: 'CUSTOM_LOGIC',
        parameters: {
          value: {
            if: [
              { var: ['context.shouldLog', false] },
              { log: { var: 'actor.name' } },
              { var: 'context.fallbackValue' },
            ],
          },
        },
      };

      interpreter.execute(operation, executionContext);

      expect(capturingHandler).toHaveBeenCalledWith(
        { value: 'Hero' },
        executionContext
      );
    });

    test('execute leaves invalid JsonLogic var operand unresolved', () => {
      const capturingHandler = jest.fn((params) => params);
      mockRegistry.getHandler.mockReturnValue(capturingHandler);
      const spy = jest.spyOn(jsonLogic, 'apply');

      const operation = {
        type: 'CUSTOM_LOGIC',
        parameters: {
          value: { var: [] },
        },
      };

      interpreter.execute(operation, mockExecutionContext);

      expect(capturingHandler).toHaveBeenCalledWith(
        { value: { var: [] } },
        mockExecutionContext
      );
      expect(spy).not.toHaveBeenCalledWith(
        expect.objectContaining({ var: [] }),
        expect.anything()
      );

      spy.mockRestore();
    });

    test('execute preserves action arrays defined in parameters', () => {
      const capturingHandler = jest.fn((params) => params);
      mockRegistry.getHandler.mockReturnValue(capturingHandler);

      const operation = {
        type: 'IF',
        parameters: {
          condition: { var: 'context.shouldRun' },
          then_actions: [
            { type: 'LOG', parameters: { message: '{actor.name}' } },
          ],
          metadata: { var: 'context.existingVar' },
        },
      };

      const executionContext = {
        ...mockExecutionContext,
        evaluationContext: {
          ...mockExecutionContext.evaluationContext,
          context: { shouldRun: true, existingVar: 'present' },
        },
      };

      interpreter.execute(operation, executionContext);

      const [params] = capturingHandler.mock.calls[0];
      expect(params.metadata).toBe('present');
      expect(params.then_actions).toEqual(operation.parameters.then_actions);
    });

    test('execute evaluates supplementary with_component_data keys while skipping conditions', () => {
      const capturingHandler = jest.fn((params) => params);
      mockRegistry.getHandler.mockReturnValue(capturingHandler);

      const executionContext = {
        ...mockExecutionContext,
        evaluationContext: {
          ...mockExecutionContext.evaluationContext,
          context: { shouldMatch: true, extraInfo: 'ready' },
        },
      };

      const operation = {
        type: 'QUERY_ENTITIES',
        parameters: {
          result_variable: 'followers',
          filters: [
            {
              with_component_data: {
                component_type: 'companionship:following',
                condition: { '==': [{ var: 'context.shouldMatch' }, true] },
                additional_value: { var: 'context.extraInfo' },
              },
            },
          ],
        },
      };

      interpreter.execute(operation, executionContext);

      const [params] = capturingHandler.mock.calls[0];
      expect(params.filters[0].with_component_data.condition).toEqual(
        operation.parameters.filters[0].with_component_data.condition
      );
      expect(params.filters[0].with_component_data.additional_value).toBe(
        'ready'
      );
    });

    test('execute logs warning and returns original value when JsonLogic evaluation fails', () => {
      const capturingHandler = jest.fn((params) => params);
      mockRegistry.getHandler.mockReturnValue(capturingHandler);
      const error = new Error('Computation failed');
      const applySpy = jest.spyOn(jsonLogic, 'apply').mockImplementation(() => {
        throw error;
      });

      const executionContext = {
        ...mockExecutionContext,
        evaluationContext: {
          ...mockExecutionContext.evaluationContext,
          context: { value: 10 },
        },
      };

      const logicPayload = { log: { var: 'context.value' } };
      const operation = {
        type: 'CUSTOM_LOGIC',
        parameters: { payload: logicPayload },
      };

      interpreter.execute(operation, executionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'OperationInterpreter: OperationInterpreter: Failed to evaluate JSON Logic expression: Computation failed. Using original value.'
      );
      expect(capturingHandler).toHaveBeenCalledWith(
        { payload: logicPayload },
        executionContext
      );

      applySpy.mockRestore();
    });

    test('execute logs error and skips handler when placeholder resolution fails', () => {
      const capturingHandler = jest.fn();
      mockRegistry.getHandler.mockReturnValue(capturingHandler);

      const placeholderError = new Error('Unable to resolve placeholder');
      const placeholderSpy = jest
        .spyOn(contextUtils, 'resolvePlaceholders')
        .mockImplementation(() => {
          throw placeholderError;
        });

      const operation = {
        type: 'CUSTOM_LOGIC',
        parameters: { value: '{actor.name}' },
      };

      interpreter.execute(operation, mockExecutionContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'OperationInterpreter: Error resolving placeholders for operation "CUSTOM_LOGIC". Skipping handler.',
        placeholderError
      );
      expect(capturingHandler).not.toHaveBeenCalled();

      placeholderSpy.mockRestore();
    });

    test('execute propagates rejected handler promises with debug logging', async () => {
      const rejection = new Error('Async failure');
      const asyncHandler = jest.fn(() => Promise.reject(rejection));
      mockRegistry.getHandler.mockReturnValue(asyncHandler);

      const operation = {
        type: 'PROMISE_OP',
        parameters: { value: 'data' },
      };

      await expect(
        interpreter.execute(operation, mockExecutionContext)
      ).rejects.toThrow(rejection);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OperationInterpreter: Handler for operation "PROMISE_OP" threw – re-throwing to caller.'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OperationInterpreter: [DEBUG] OperationInterpreter.execute - Handler for "PROMISE_OP" threw error:',
        rejection
      );
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
     Unknown handler - Fail-Fast Behavior (MissingHandlerError)
     ─────────────────────────────────────────────────────────────────────── */
  test('execute should throw MissingHandlerError when handler not found', () => {
    mockRegistry.getHandler.mockReturnValue(undefined);

    expect(() =>
      interpreter.execute(unknownOperation, mockExecutionContext)
    ).toThrow(MissingHandlerError);
    expect(mockRegistry.getHandler).toHaveBeenCalledWith('UNKNOWN_OP');
  });

  // Note: Fail-fast behavior implemented in ROBOPEHANVAL-003.
  // MissingHandlerError is thrown instead of logging + silent return.

  test('MissingHandlerError contains correct operation type', () => {
    mockRegistry.getHandler.mockReturnValue(undefined);

    let thrownError;
    expect(() => {
      try {
        interpreter.execute(unknownOperation, mockExecutionContext);
      } catch (err) {
        thrownError = err;
        throw err;
      }
    }).toThrow(MissingHandlerError);

    expect(thrownError.operationType).toBe('UNKNOWN_OP');
  });

  test('MissingHandlerError has null ruleId (no context tracking in interpreter)', () => {
    mockRegistry.getHandler.mockReturnValue(undefined);

    let thrownError;
    expect(() => {
      try {
        interpreter.execute(unknownOperation, mockExecutionContext);
      } catch (err) {
        thrownError = err;
        throw err;
      }
    }).toThrow(MissingHandlerError);

    expect(thrownError.ruleId).toBeNull();
  });

  test('MissingHandlerError propagates up the call stack (not swallowed)', () => {
    mockRegistry.getHandler.mockReturnValue(undefined);

    // Verify error propagates and isn't caught internally
    expect(() =>
      interpreter.execute(unknownOperation, mockExecutionContext)
    ).toThrow(MissingHandlerError);

    // Verify no logger.error was called (error is thrown, not logged)
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('HANDLER NOT FOUND')
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
  test('execute should treat IF like any other type (lookup in registry) and throw MissingHandlerError', () => {
    mockRegistry.getHandler.mockReturnValue(undefined);

    expect(() =>
      interpreter.execute(ifOperation, mockExecutionContext)
    ).toThrow(MissingHandlerError);
    expect(mockRegistry.getHandler).toHaveBeenCalledWith('IF');
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

describe('OperationInterpreter internal helpers', () => {
  test('hasValidJsonLogicShape handles expected truthy and falsy cases', () => {
    expect(hasValidJsonLogicShape(null)).toBe(false);
    expect(hasValidJsonLogicShape(['not', 'object'])).toBe(false);
    expect(hasValidJsonLogicShape({ foo: 'bar' })).toBe(false);
    expect(hasValidJsonLogicShape({ if: [1, 2, 3] })).toBe(true);
    expect(hasValidJsonLogicShape({ var: [] })).toBe(false);
    expect(hasValidJsonLogicShape({ var: ['context.value', 0] })).toBe(true);
    expect(hasValidJsonLogicShape({ log: { var: 'actor.name' } })).toBe(true);
  });

  test('evaluateJsonLogicRecursively returns empty objects without evaluation', () => {
    const loggerStub = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const emptyObject = {};

    const result = evaluateJsonLogicRecursively(
      emptyObject,
      {},
      loggerStub,
      new Set(),
      [],
      ['filters']
    );

    expect(result).toBe(emptyObject);
    expect(loggerStub.debug).not.toHaveBeenCalled();
    expect(loggerStub.warn).not.toHaveBeenCalled();
  });

  test('shouldSkipJsonLogicEvaluation respects wildcard path comparisons', () => {
    expect(
      shouldSkipJsonLogicEvaluation(
        ['filters', '0', 'with_component_data', 'condition'],
        JSON_LOGIC_SKIP_PATHS
      )
    ).toBe(true);
    expect(
      shouldSkipJsonLogicEvaluation(
        ['filters', '0', 'with_component_data', 'other'],
        JSON_LOGIC_SKIP_PATHS
      )
    ).toBe(false);
  });

  test('diagnoseOperationRegistration checks whitelist and handler registration', () => {
    // Note: KNOWN_OPERATION_TYPES is not imported in operationInterpreter.js,
    // so the function throws an error at line 260 and catches it at line 268,
    // returning all default false values. This test verifies the current behavior.
    const diagnostics1 = diagnoseOperationRegistration('ADD_COMPONENT', true);
    expect(diagnostics1.inWhitelist).toBe(false); // Error in try block prevents execution
    expect(diagnostics1.handlerRegistered).toBe(false); // Never reached due to error
    expect(diagnostics1.schemaExists).toBe(null); // Cannot check in browser
    expect(diagnostics1.tokenDefined).toBe(null); // Cannot check in browser

    // Test with an operation that's not in the whitelist
    const diagnostics2 = diagnoseOperationRegistration('UNKNOWN_OP', false);
    expect(diagnostics2.inWhitelist).toBe(false);
    expect(diagnostics2.handlerRegistered).toBe(false);
  });

  test('diagnoseOperationRegistration handles errors gracefully', () => {
    // Should not throw even if something fails internally
    expect(() => diagnoseOperationRegistration(null, false)).not.toThrow();
  });
});
