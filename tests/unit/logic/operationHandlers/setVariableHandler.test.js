// src/tests/logic/operationHandlers/setVariableHandler.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import SetVariableHandler from '../../../../src/logic/operationHandlers/setVariableHandler.js';
import jsonLogic from 'json-logic-js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} HandlerJsonLogicEvaluationContext
 * @property {object} context - The shared context object for storing/retrieving variables.
 * @property {any} [event]
 * @property {any} [actor]
 * @property {any} [target]
 * @property {ILogger} [logger]
 */

/**
 * @typedef {object} OperationExecutionContext
 * @property {HandlerJsonLogicEvaluationContext} evaluationContext
 * @property {any} [event]
 * @property {any} [actor]
 * @property {any} [target]
 * @property {ILogger} [logger]
 */
/** @typedef {import('../../../../src/logic/operationHandlers/setVariableHandler.js').SetVariableOperationParams} SetVariableOperationParams */

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  loggedMessages: [],
});

/**
 * Builds a mock OperationExecutionContext.
 *
 * @param {ILogger} loggerInstance - The logger instance to use in the root of the context.
 * @param {object} [variableStoreData]
 * @param {object} [evalContextShellProps]
 * @param {object} [rootProps]
 * @returns {OperationExecutionContext}
 */
function buildCtx(
  loggerInstance,
  variableStoreData = {},
  evalContextShellProps = {},
  rootProps = {}
) {
  const defaultVariableStore = {
    existingVar: 'pre-existing value',
    nested: { path: { to: { value: 'deep context value' } } },
  };
  const finalVariableStore = { ...defaultVariableStore, ...variableStoreData };

  const defaultEvalContextShell = {
    event: { type: 'EVAL_CTX_EVENT', id: 'event-in-eval-ctx' },
    actor: { id: 'actor-in-eval-ctx', name: 'EvalActor' },
    target: { id: 'target-in-eval-ctx', status: 'active' },
  };
  const finalEvalContextShell = {
    ...defaultEvalContextShell,
    ...evalContextShellProps,
  };

  return {
    evaluationContext: {
      ...finalEvalContextShell,
      context: finalVariableStore,
    },
    event: { type: 'ROOT_EVENT', id: 'event-at-root' },
    actor: { id: 'actor-at-root' },
    logger: loggerInstance, // Use passed logger instance
    ...rootProps,
  };
}

describe('SetVariableHandler', () => {
  let handler;
  let mockLoggerInstance; // Renamed for clarity to avoid conflict with global mockLogger if any

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoggerInstance = createMockLogger();
    handler = new SetVariableHandler({
      logger: mockLoggerInstance,
    });
    mockLoggerInstance.debug.mockClear();
  });

  describe('Constructor', () => {
    test('throws if logger dependency is missing or invalid', () => {
      expect(() => new SetVariableHandler({})).toThrow(/ILogger instance/);
      expect(() => new SetVariableHandler({ logger: null })).toThrow(
        /ILogger instance/
      );
      expect(
        () => new SetVariableHandler({ logger: { info: jest.fn() } })
      ).toThrow(/ILogger instance/);
    });

    test('initializes successfully with a valid logger', () => {
      const freshLogger = createMockLogger();
      expect(
        () => new SetVariableHandler({ logger: freshLogger })
      ).not.toThrow();
      expect(freshLogger.debug).toHaveBeenCalledWith(
        'SetVariableHandler initialized.'
      );
    });
  });

  describe('Parameter Validation', () => {
    test.each([
      [
        'null params',
        null,
        'SET_VARIABLE: params missing or invalid.',
        { params: null },
      ],
      [
        'undefined params',
        undefined,
        'SET_VARIABLE: params missing or invalid.',
        { params: undefined },
      ],
      [
        'non-object params',
        'string',
        'SET_VARIABLE: params missing or invalid.',
        { params: 'string' },
      ],
      [
        'array params',
        [],
        'SET_VARIABLE: Invalid or missing "variable_name" parameter. Must be a non-empty string.',
        { variable_name: undefined },
      ],
    ])(
      'logs warning and returns if params object is invalid (%s)',
      (desc, invalidParams, expectedErrorMsg, expectedErrorObj) => {
        const execCtx = buildCtx(mockLoggerInstance); // Pass logger
        const initialVarStoreState = JSON.stringify(
          execCtx.evaluationContext.context
        );
        handler.execute(invalidParams, execCtx);
        if (desc === 'array params') {
          expect(mockLoggerInstance.error).toHaveBeenCalledWith(
            expectedErrorMsg,
            expectedErrorObj
          );
        } else {
          expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
            expectedErrorMsg,
            expectedErrorObj
          );
        }
        expect(JSON.stringify(execCtx.evaluationContext.context)).toEqual(
          initialVarStoreState
        );
      }
    );

    test.each([
      ['missing', { value: 1 }],
      ['null', { value: 1, variable_name: null }],
      ['undefined', { value: 1, variable_name: undefined }],
      ['empty string', { value: 1, variable_name: '' }],
      ['whitespace string', { value: 1, variable_name: '   ' }],
      ['non-string', { value: 1, variable_name: 123 }],
    ])(
      'logs error and returns if "variable_name" is invalid (%s)',
      (desc, params) => {
        const execCtx = buildCtx(mockLoggerInstance); // Pass logger
        const initialVarStoreState = JSON.stringify(
          execCtx.evaluationContext.context
        );
        handler.execute(params, execCtx);
        expect(mockLoggerInstance.error).toHaveBeenCalledWith(
          'SET_VARIABLE: Invalid or missing "variable_name" parameter. Must be a non-empty string.',
          { variable_name: params.variable_name }
        );
        expect(JSON.stringify(execCtx.evaluationContext.context)).toEqual(
          initialVarStoreState
        );
      }
    );

    test('logs error and returns if resolved "value" is undefined', () => {
      const params = { variable_name: 'myVar', value: undefined };
      const execCtx = buildCtx(mockLoggerInstance); // Pass logger
      const initialVarStoreState = JSON.stringify(
        execCtx.evaluationContext.context
      );
      handler.execute(params, execCtx);
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'SET_VARIABLE: Resolved "value" is undefined for variable "myVar". Assignment skipped. Check placeholder resolution or JsonLogic evaluation if applicable.',
        { params }
      );
      expect(JSON.stringify(execCtx.evaluationContext.context)).toEqual(
        initialVarStoreState
      );
    });

    test('does NOT log error if "value" is null', () => {
      const params = { variable_name: 'myVar', value: null };
      const execCtx = buildCtx(mockLoggerInstance); // Pass logger
      handler.execute(params, execCtx);
      expect(mockLoggerInstance.error).not.toHaveBeenCalled();
      expect(execCtx.evaluationContext.context['myVar']).toBeNull();
    });

    test('does NOT log error if "value" is false', () => {
      const params = { variable_name: 'myVar', value: false };
      const execCtx = buildCtx(mockLoggerInstance); // Pass logger
      handler.execute(params, execCtx);
      expect(mockLoggerInstance.error).not.toHaveBeenCalled();
      expect(execCtx.evaluationContext.context['myVar']).toBe(false);
    });

    test('does NOT log error if "value" is 0', () => {
      const params = { variable_name: 'myVar', value: 0 };
      const execCtx = buildCtx(mockLoggerInstance); // Pass logger
      handler.execute(params, execCtx);
      expect(mockLoggerInstance.error).not.toHaveBeenCalled();
      expect(execCtx.evaluationContext.context['myVar']).toBe(0);
    });
  });

  describe('Execution Context Validation', () => {
    const validParams = { variable_name: 'v', value: 1 };

    const invalidExecContextTestCases = [
      [
        'null executionContext',
        null,
        {
          hasExecutionContext: false,
          hasEvaluationContext: false,
          typeOfVariableStore: 'undefined',
        },
      ],
      [
        'undefined executionContext',
        undefined,
        {
          hasExecutionContext: false,
          hasEvaluationContext: false,
          typeOfVariableStore: 'undefined',
        },
      ],
      [
        'executionContext without evaluationContext',
        {},
        {
          hasExecutionContext: true,
          hasEvaluationContext: false,
          typeOfVariableStore: 'undefined',
        },
      ],
      [
        'executionContext with null evaluationContext',
        { evaluationContext: null },
        {
          hasExecutionContext: true,
          hasEvaluationContext: false,
          typeOfVariableStore: 'undefined',
        },
      ],
      [
        'evaluationContext without context',
        { evaluationContext: {} },
        {
          hasExecutionContext: true,
          hasEvaluationContext: true,
          typeOfVariableStore: 'undefined',
        },
      ],
      [
        'evaluationContext with null context',
        { evaluationContext: { context: null } },
        {
          hasExecutionContext: true,
          hasEvaluationContext: true,
          typeOfVariableStore: 'object',
        },
      ],
      [
        'evaluationContext with non-object context',
        { evaluationContext: { context: 'string' } },
        {
          hasExecutionContext: true,
          hasEvaluationContext: true,
          typeOfVariableStore: 'string',
        },
      ],
    ];

    test.each(invalidExecContextTestCases)(
      'logs error and returns if execution context structure is invalid (%s)',
      (desc, invalidExecCtx, expectedDetails) => {
        // For these tests, invalidExecCtx might not have the 'logger' property that buildCtx adds.
        // If invalidExecCtx is null/undefined, it won't. If it's an object, we ensure our handler's logger is used.
        handler.execute(validParams, invalidExecCtx);
        expect(mockLoggerInstance.error).toHaveBeenCalledWith(
          'ensureEvaluationContext: executionContext.evaluationContext.context is missing or invalid.'
        );
      }
    );

    test('logs error and returns if executionContext is not an object (e.g. string)', () => {
      const invalidExecCtx = 'not an object';
      handler.execute(validParams, invalidExecCtx);
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'ensureEvaluationContext: executionContext.evaluationContext.context is missing or invalid.'
      );
    });
  });

  describe('Value Assignment', () => {
    test('sets literal string value', () => {
      const params = { variable_name: 'message', value: 'Hello World' };
      const execCtx = buildCtx(mockLoggerInstance); // Pass logger
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context['message']).toBe('Hello World');
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        'SET_VARIABLE: Setting context variable "message" in evaluationContext.context to value: "Hello World"'
      );
      expect(mockLoggerInstance.warn).not.toHaveBeenCalled();
      expect(mockLoggerInstance.error).not.toHaveBeenCalled();
    });

    test('sets literal number value', () => {
      const params = { variable_name: 'count', value: 42 };
      const execCtx = buildCtx(mockLoggerInstance); // Pass logger
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context['count']).toBe(42);
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        'SET_VARIABLE: Setting context variable "count" in evaluationContext.context to value: 42'
      );
    });

    test('sets literal boolean value (true)', () => {
      const params = { variable_name: 'isActive', value: true };
      const execCtx = buildCtx(mockLoggerInstance); // Pass logger
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context['isActive']).toBe(true);
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        'SET_VARIABLE: Setting context variable "isActive" in evaluationContext.context to value: true'
      );
    });

    test('sets literal boolean value (false)', () => {
      const params = { variable_name: 'isDisabled', value: false };
      const execCtx = buildCtx(mockLoggerInstance); // Pass logger
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context['isDisabled']).toBe(false);
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        'SET_VARIABLE: Setting context variable "isDisabled" in evaluationContext.context to value: false'
      );
    });

    test('sets literal null value', () => {
      const params = { variable_name: 'optionalData', value: null };
      const execCtx = buildCtx(mockLoggerInstance); // Pass logger
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context['optionalData']).toBeNull();
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        'SET_VARIABLE: Setting context variable "optionalData" in evaluationContext.context to value: null'
      );
    });

    test('sets literal object value (empty object)', () => {
      const objValue = {};
      const params = { variable_name: 'emptyConfig', value: objValue };
      const execCtx = buildCtx(mockLoggerInstance); // Pass logger
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context['emptyConfig']).toEqual(
        objValue
      );
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        `SET_VARIABLE: Setting context variable "emptyConfig" in evaluationContext.context to value: ${JSON.stringify(objValue)}`
      );
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        'SET_VARIABLE: Value for "emptyConfig" is an empty object {}. Using it directly.'
      );
    });

    test('sets literal object value (non-empty object, treated as literal)', () => {
      const objValue = { data: 'some data', isLiteral: true };
      const params = { variable_name: 'literalComplexObj', value: objValue };
      const execCtx = buildCtx(mockLoggerInstance); // Pass logger
      const mockApply = jest.spyOn(jsonLogic, 'apply');
      // Simulate jsonLogic returning the object itself if it's not a rule it processes
      mockApply.mockImplementation((rule, data) => rule);

      handler.execute(params, execCtx);

      expect(mockApply).toHaveBeenCalledWith(
        objValue,
        execCtx.evaluationContext
      );
      expect(execCtx.evaluationContext.context['literalComplexObj']).toEqual(
        objValue
      );
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        `SET_VARIABLE: Setting context variable "literalComplexObj" in evaluationContext.context to value: ${JSON.stringify(objValue)}`
      );
      mockApply.mockRestore();
    });

    test('sets literal array value', () => {
      const arrValue = [1, 'two', true, null];
      const params = { variable_name: 'items', value: arrValue };
      const execCtx = buildCtx(mockLoggerInstance); // Pass logger
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context['items']).toEqual(arrValue);
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        `SET_VARIABLE: Setting context variable "items" in evaluationContext.context to value: ${JSON.stringify(arrValue)}`
      );
    });

    test('trims whitespace from variable_name before setting', () => {
      const params = { variable_name: '  paddedVar  ', value: 'trimmed' };
      const execCtx = buildCtx(mockLoggerInstance); // Pass logger
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context).toHaveProperty('paddedVar');
      expect(execCtx.evaluationContext.context['paddedVar']).toBe('trimmed');
      expect(execCtx.evaluationContext.context).not.toHaveProperty(
        '  paddedVar  '
      );
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        'SET_VARIABLE: Setting context variable "paddedVar" in evaluationContext.context to value: "trimmed"'
      );
    });

    test('overwrites existing variable', () => {
      const params = { variable_name: 'existingVar', value: 'new value' };
      const execCtx = buildCtx(mockLoggerInstance, {
        existingVar: 'pre-existing value',
      }); // Pass logger and initial store data
      expect(execCtx.evaluationContext.context['existingVar']).toBe(
        'pre-existing value'
      );
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context['existingVar']).toBe(
        'new value'
      );
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        'SET_VARIABLE: Setting context variable "existingVar" in evaluationContext.context to value: "new value"'
      );
    });
  });

  describe('JsonLogic Value Evaluation', () => {
    test('evaluates JsonLogic object value and sets the result', () => {
      const jsonLogicRule = { var: 'actor.name' };
      const params = {
        variable_name: 'actorNameFromLogic',
        value: jsonLogicRule,
      };
      const execCtx = buildCtx(
        mockLoggerInstance, // Pass logger
        {},
        { actor: { id: 'actor-for-logic-eval', name: 'LogicActor' } }
      );
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context['actorNameFromLogic']).toBe(
        'LogicActor'
      );
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        'SET_VARIABLE: Setting context variable "actorNameFromLogic" in evaluationContext.context to value: "LogicActor"'
      );
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        'SET_VARIABLE: JsonLogic evaluation successful for "actorNameFromLogic". Result: "LogicActor"'
      );
    });

    test('evaluates JsonLogic accessing context.variable and sets the result', () => {
      const jsonLogicRule = { '+': [{ var: 'context.existingVar' }, 5] };
      const params = { variable_name: 'calculatedVar', value: jsonLogicRule };
      const execCtx = buildCtx(
        mockLoggerInstance, // Pass logger
        { existingVar: 10 }
      );
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context['calculatedVar']).toBe(15);
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        'SET_VARIABLE: Setting context variable "calculatedVar" in evaluationContext.context to value: 15'
      );
    });

    test('logs error and skips assignment if JsonLogic evaluation fails', () => {
      const invalidJsonLogicRule = { invalidOperator: [1, 2] };
      const params = {
        variable_name: 'failedLogicVar',
        value: invalidJsonLogicRule,
      };
      const execCtx = buildCtx(mockLoggerInstance); // Pass logger
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context).not.toHaveProperty(
        'failedLogicVar'
      );
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        `SET_VARIABLE: Error evaluating JsonLogic value for variable "failedLogicVar". Storing 'undefined'. Original value: ${JSON.stringify(invalidJsonLogicRule)}`,
        // ***** THIS IS THE CORRECTED LINE *****
        expect.objectContaining({
          errorMessage: expect.stringContaining(
            'Unrecognized operation invalidOperator'
          ),
        })
      );
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        `SET_VARIABLE: JsonLogic evaluation for variable "failedLogicVar" failed with an error (see previous log). Assignment skipped. Original value: ${JSON.stringify(invalidJsonLogicRule)}`
      );
    });

    test('logs warning and skips assignment if JsonLogic evaluates to undefined (without error)', () => {
      const jsonLogicRule = { var: 'nonExistentProperty' };
      const mockApply = jest
        .spyOn(jsonLogic, 'apply')
        .mockReturnValue(undefined);
      const params = {
        variable_name: 'undefinedLogicResult',
        value: jsonLogicRule,
      };
      const execCtx = buildCtx(mockLoggerInstance); // Pass logger
      handler.execute(params, execCtx);
      expect(execCtx.evaluationContext.context).not.toHaveProperty(
        'undefinedLogicResult'
      );
      expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
        `SET_VARIABLE: JsonLogic evaluation resulted in 'undefined' for variable "undefinedLogicResult". Assignment skipped. Original value: ${JSON.stringify(jsonLogicRule)}`
      );
      mockApply.mockRestore();
    });

    test('skips assignment if JsonLogic evaluation requires evaluationContext but it is missing (handler perspective)', () => {
      const jsonLogicRule = { var: 'actor.name' };
      const params = { variable_name: 'testVar', value: jsonLogicRule };
      // This context is invalid because 'evaluationContext' is missing.
      // The handler's first check for `variableStore` will fail.
      const execCtxMissingEvalCtx = { logger: mockLoggerInstance }; // Does not have evaluationContext

      handler.execute(params, execCtxMissingEvalCtx);

      // Expect the initial validation error for the variable store
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'ensureEvaluationContext: executionContext.evaluationContext.context is missing or invalid.'
      );
      // Ensure the more specific error about JsonLogic evaluation is NOT called because the first check returns.
      expect(mockLoggerInstance.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Cannot evaluate JsonLogic value for variable'),
        expect.anything()
      );
      // And consequently, the variable is not set.
      expect(execCtxMissingEvalCtx).not.toHaveProperty('evaluationContext'); // Still no eval context
    });
  });
});
