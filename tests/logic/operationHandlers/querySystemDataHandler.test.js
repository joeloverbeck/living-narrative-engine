// src/tests/logic/operationHandlers/querySystemDataHandler.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import QuerySystemDataHandler from '../../../src/logic/operationHandlers/querySystemDataHandler.js';

// --- Type-hints ---
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/services/systemDataRegistry.js').SystemDataRegistry} SystemDataRegistry */
// This typedef now reflects the NESTED structure handlers receive
/**
 * @typedef {object} NestedExecutionContextForTest
 * @property {any} [event]
 * @property {any} [actor]
 * @property {any} [target]
 * @property {ILogger} logger
 * @property {EvaluationContextForTest} evaluationContext
 */
/**
 * @typedef {object} EvaluationContextForTest
 * @property {any} [event]
 * @property {any} [actor]
 * @property {any} [target]
 * @property {object} context // The actual variable store
 * @property {ILogger} logger
 */
/** @typedef {import('../../../src/logic/operationHandlers/querySystemDataHandler.js').QuerySystemDataParams} QuerySystemDataParams */

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createMockSystemDataRegistry = () => ({
  query: jest.fn(),
});

// --- REVISED Mock Builder to create the NESTED ExecutionContext structure ---
/**
 * Builds a mock NestedExecutionContext.
 * @param {object} [ruleVariables] - Initial data for evaluationContext.context.
 * @param {ILogger} [specificLoggerForEvalContext] - Logger for evaluationContext.logger.
 * @param {ILogger} [topLevelLogger] - Logger for the top-level executionContext.logger.
 * @param {any} [actorData] - Data for actor properties.
 * @param {any} [targetData] - Data for target properties.
 * @returns {NestedExecutionContextForTest}
 */
function buildNestedMockExecutionContext(
  ruleVariables = {},
  specificLoggerForEvalContext = null, // Logger for evaluationContext.logger
  topLevelLogger = null, // Logger for executionContext.logger
  actorData = null,
  targetData = null
) {
  const evalLogger = specificLoggerForEvalContext || createMockLogger();
  const mainLogger = topLevelLogger || createMockLogger();
  const eventData = { type: 'TEST_EVENT', payload: {} };

  return {
    event: eventData,
    actor: actorData, // Top-level actor
    target: targetData, // Top-level target
    logger: mainLogger, // Top-level system logger for SystemLogicInterpreter / OperationInterpreter
    evaluationContext: {
      // Nested evaluation context
      event: eventData,
      actor: actorData, // Actor for JSONLogic/handler logic if needed from here
      target: targetData, // Target for JSONLogic/handler logic if needed from here
      context: { ...ruleVariables }, // Rule variables stored here
      logger: evalLogger, // Logger specific to this evaluation scope
    },
  };
}

describe('QuerySystemDataHandler', () => {
  let handler;
  let mockConstructorLogger;
  let mockSystemDataRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConstructorLogger = createMockLogger();
    mockSystemDataRegistry = createMockSystemDataRegistry();
    handler = new QuerySystemDataHandler({
      logger: mockConstructorLogger,
      systemDataRegistry: mockSystemDataRegistry,
    });
    mockConstructorLogger.debug.mockClear();
  });

  describe('Constructor', () => {
    test('initializes successfully with valid dependencies', () => {
      const logger = createMockLogger();
      handler = new QuerySystemDataHandler({
        logger: logger,
        systemDataRegistry: mockSystemDataRegistry,
      });
      expect(handler).toBeInstanceOf(QuerySystemDataHandler);
      expect(logger.debug).toHaveBeenCalledWith(
        'QuerySystemDataHandler: Instance created successfully.'
      );
    });

    test('throws TypeError if logger dependency is missing or invalid', () => {
      const invalidLoggers = [
        null,
        undefined,
        {},
        { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      ];
      invalidLoggers.forEach((invalidLogger) => {
        expect(
          () =>
            new QuerySystemDataHandler({
              logger: invalidLogger,
              systemDataRegistry: mockSystemDataRegistry,
            })
        ).toThrow(/QuerySystemDataHandler requires a valid ILogger instance/);
      });
    });

    test('throws TypeError if systemDataRegistry dependency is missing or invalid', () => {
      const tempLogger = createMockLogger();
      const invalidRegistries = [
        null,
        undefined,
        {},
        { query: 'not a function' },
      ];
      invalidRegistries.forEach((invalidRegistry) => {
        expect(
          () =>
            new QuerySystemDataHandler({
              logger: tempLogger,
              systemDataRegistry: invalidRegistry,
            })
        ).toThrow(
          /QuerySystemDataHandler requires a valid SystemDataRegistry instance/
        );
        if (invalidRegistry !== null && invalidRegistry !== undefined) {
          expect(tempLogger.error).toHaveBeenCalledWith(
            'QuerySystemDataHandler: Invalid SystemDataRegistry dependency provided.',
            { systemDataRegistry: invalidRegistry }
          );
        }
      });
    });
  });

  describe('execute', () => {
    const defaultSourceId = 'gameRepo';
    const defaultQueryDetails = { method: 'getWorldName' };
    const defaultResultVariable = 'worldNameResult';
    const defaultParams = {
      source_id: defaultSourceId,
      query_details: defaultQueryDetails,
      result_variable: defaultResultVariable,
    };
    const successResult = 'TestWorld';

    describe('Parameter Validation', () => {
      test.each([
        ['null params', null],
        ['undefined params', undefined],
        ['non-object params', 123],
      ])(
        'logs error and returns if params are invalid (%s)',
        (desc, invalidParams) => {
          const ctx = buildNestedMockExecutionContext(); // Use new builder
          handler.execute(invalidParams, ctx);
          expect(mockConstructorLogger.error).toHaveBeenCalledWith(
            'QUERY_SYSTEM_DATA: Missing or invalid parameters object.',
            { params: invalidParams }
          );
        }
      );

      test('logs error and returns if params are invalid (array params)', () => {
        const invalidParams = [];
        const ctx = buildNestedMockExecutionContext();
        handler.execute(invalidParams, ctx);
        expect(mockConstructorLogger.error).toHaveBeenCalledWith(
          'QUERY_SYSTEM_DATA: Missing or invalid required "source_id" parameter (must be non-empty string).',
          { receivedParams: invalidParams }
        );
      });

      test.each([
        ['missing', { query_details: 'q', result_variable: 'r' }],
        ['null', { source_id: null, query_details: 'q', result_variable: 'r' }],
        [
          'empty string',
          { source_id: '', query_details: 'q', result_variable: 'r' },
        ],
      ])(
        'logs error and returns if "source_id" is invalid (%s)',
        (desc, params) => {
          const ctx = buildNestedMockExecutionContext();
          handler.execute(params, ctx);
          expect(mockConstructorLogger.error).toHaveBeenCalledWith(
            'QUERY_SYSTEM_DATA: Missing or invalid required "source_id" parameter (must be non-empty string).',
            { receivedParams: params }
          );
        }
      );

      test.each([
        ['missing', { source_id: 's', result_variable: 'r' }],
        // 'undefined' is already covered by the test 'allows null as query_details' not failing
      ])(
        'logs error and returns if "query_details" is invalid (missing)',
        (desc, params) => {
          const ctx = buildNestedMockExecutionContext();
          handler.execute(params, ctx);
          expect(mockConstructorLogger.error).toHaveBeenCalledWith(
            'QUERY_SYSTEM_DATA: Missing required "query_details" parameter.',
            { receivedParams: params }
          );
        }
      );
      test('logs error and returns if "query_details" is invalid (undefined)', () => {
        const params = {
          source_id: 's',
          query_details: undefined,
          result_variable: 'r',
        };
        const ctx = buildNestedMockExecutionContext();
        handler.execute(params, ctx);
        expect(mockConstructorLogger.error).toHaveBeenCalledWith(
          'QUERY_SYSTEM_DATA: Missing required "query_details" parameter.',
          { receivedParams: params }
        );
      });

      test('allows null as query_details', () => {
        const ctx = buildNestedMockExecutionContext();
        const paramsWithNull = { ...defaultParams, query_details: null };
        mockSystemDataRegistry.query.mockReturnValue('result from null query');
        handler.execute(paramsWithNull, ctx);
        expect(mockConstructorLogger.error).not.toHaveBeenCalledWith(
          expect.stringContaining('query_details')
        );
        expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
        expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(
          defaultSourceId,
          null
        );
        // Assert on the NESTED context path
        expect(ctx.evaluationContext.context[defaultResultVariable]).toBe(
          'result from null query'
        );
      });

      test.each([
        ['missing', { source_id: 's', query_details: 'q' }],
        [
          'empty string',
          { source_id: 's', query_details: 'q', result_variable: '' },
        ],
      ])(
        'logs error and returns if "result_variable" is invalid (%s)',
        (desc, params) => {
          const ctx = buildNestedMockExecutionContext();
          handler.execute(params, ctx);
          expect(mockConstructorLogger.error).toHaveBeenCalledWith(
            'QUERY_SYSTEM_DATA: Missing or invalid required "result_variable" parameter (must be non-empty string).',
            { receivedParams: params }
          );
        }
      );
    });

    describe('Execution Context Validation', () => {
      const validParams = { ...defaultParams };

      test.each([
        ['null executionContext', null],
        ['undefined executionContext', undefined],
        [
          'executionContext without evaluationContext',
          { logger: createMockLogger() },
        ],
        [
          'evaluationContext without context',
          { evaluationContext: { logger: createMockLogger() } },
        ],
        [
          'evaluationContext with null context',
          {
            evaluationContext: {
              context: null,
              logger: createMockLogger(),
            },
          },
        ],
        [
          'evaluationContext with non-object context',
          {
            evaluationContext: {
              context: 'string',
              logger: createMockLogger(),
            },
          },
        ],
      ])(
        'logs error and returns if execution context structure is invalid (%s)',
        (desc, invalidCtx) => {
          handler.execute(validParams, invalidCtx);
          expect(mockConstructorLogger.error).toHaveBeenCalledWith(
            'QUERY_SYSTEM_DATA: nestedExecutionContext.evaluationContext.context is missing or invalid. Cannot store result.',
            { receivedFullContext: invalidCtx }
          );
          expect(mockSystemDataRegistry.query).not.toHaveBeenCalled();
        }
      );
    });

    describe('Core Execution Scenarios', () => {
      test('executes successfully, calls registry.query, stores result in context', () => {
        const ctx = buildNestedMockExecutionContext({ initialVar: 'exists' });
        mockSystemDataRegistry.query.mockReturnValue(successResult);
        handler.execute(defaultParams, ctx);
        expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
        expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(
          defaultSourceId,
          defaultQueryDetails
        );
        expect(ctx.evaluationContext.context).toHaveProperty(
          defaultResultVariable,
          successResult
        );
        expect(ctx.evaluationContext.context['initialVar']).toBe('exists');
        expect(mockConstructorLogger.error).not.toHaveBeenCalled();
        expect(mockConstructorLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `Successfully queried source "${defaultSourceId}"`
          )
        );
      });

      test('handles successful query returning complex object', () => {
        const ctx = buildNestedMockExecutionContext();
        const complexResult = { data: [1, 2], nested: { flag: true } };
        mockSystemDataRegistry.query.mockReturnValue(complexResult);
        handler.execute(defaultParams, ctx);
        expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(
          defaultSourceId,
          defaultQueryDetails
        );
        expect(ctx.evaluationContext.context[defaultResultVariable]).toEqual(
          complexResult
        );
        expect(mockConstructorLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `Stored result in "${defaultResultVariable}": ${JSON.stringify(complexResult)}`
          )
        );
      });

      test('handles successful query returning null', () => {
        const ctx = buildNestedMockExecutionContext();
        mockSystemDataRegistry.query.mockReturnValue(null);
        handler.execute(defaultParams, ctx);
        expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(
          defaultSourceId,
          defaultQueryDetails
        );
        expect(ctx.evaluationContext.context[defaultResultVariable]).toBeNull();
        expect(mockConstructorLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `Stored result in "${defaultResultVariable}": null`
          )
        );
      });

      test('handles query failure (registry returns undefined), stores undefined, logs warning', () => {
        const ctx = buildNestedMockExecutionContext();
        mockSystemDataRegistry.query.mockReturnValue(undefined);
        handler.execute(defaultParams, ctx);
        expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(
          defaultSourceId,
          defaultQueryDetails
        );
        expect(ctx.evaluationContext.context).toHaveProperty(
          defaultResultVariable,
          undefined
        );
        expect(mockConstructorLogger.warn).toHaveBeenCalledWith(
          `QUERY_SYSTEM_DATA: Query to source "${defaultSourceId}" returned undefined or an error occurred during query. Stored 'undefined' in "${defaultResultVariable}".`
        );
      });

      test('handles query error (registry throws), stores undefined, logs error', () => {
        const ctx = buildNestedMockExecutionContext();
        const queryError = new Error('Database connection failed');
        mockSystemDataRegistry.query.mockImplementation(() => {
          throw queryError;
        });
        handler.execute(defaultParams, ctx);
        expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(
          defaultSourceId,
          defaultQueryDetails
        );
        expect(ctx.evaluationContext.context).toHaveProperty(
          defaultResultVariable,
          undefined
        );
        expect(mockConstructorLogger.error).toHaveBeenCalledWith(
          `QUERY_SYSTEM_DATA: Error occurred while executing query on source "${defaultSourceId}". Storing 'undefined' in "${defaultResultVariable}".`,
          expect.objectContaining({
            error: queryError.message,
            stack: queryError.stack,
          })
        );
        expect(mockConstructorLogger.warn).toHaveBeenCalledWith(
          `QUERY_SYSTEM_DATA: Query to source "${defaultSourceId}" returned undefined or an error occurred during query. Stored 'undefined' in "${defaultResultVariable}".`
        );
      });

      test('trims whitespace from source_id and result_variable', () => {
        const ctx = buildNestedMockExecutionContext();
        const paramsWithWhitespace = {
          source_id: `  ${defaultSourceId}  `,
          query_details: defaultQueryDetails,
          result_variable: `  ${defaultResultVariable}  `,
        };
        mockSystemDataRegistry.query.mockReturnValue(successResult);
        handler.execute(paramsWithWhitespace, ctx);
        expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(
          defaultSourceId,
          defaultQueryDetails
        );
        expect(ctx.evaluationContext.context).toHaveProperty(
          defaultResultVariable,
          successResult
        );
        expect(ctx.evaluationContext.context).not.toHaveProperty(
          `  ${defaultResultVariable}  `
        );
      });

      test('uses ONLY the constructor logger, ignoring any logger in execution context', () => {
        const specificEvalContextLogger = createMockLogger();
        const specificTopLevelLogger = createMockLogger();
        // Pass the specific loggers to the context builder
        const ctx = buildNestedMockExecutionContext(
          {},
          specificEvalContextLogger,
          specificTopLevelLogger
        );

        mockSystemDataRegistry.query.mockReturnValue(successResult);
        handler.execute(defaultParams, ctx);

        // Verify the CONSTRUCTOR logger (mockConstructorLogger) was used
        expect(mockConstructorLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `Attempting to query source "${defaultSourceId}"`
          )
        );
        // Verify the loggers provided IN THE CONTEXT were NOT used by the handler
        expect(specificEvalContextLogger.debug).not.toHaveBeenCalled();
        expect(specificTopLevelLogger.debug).not.toHaveBeenCalled();
        expect(specificEvalContextLogger.error).not.toHaveBeenCalled();
        expect(specificTopLevelLogger.error).not.toHaveBeenCalled();
      });

      test('handles non-stringifiable result during logging gracefully', () => {
        const ctx = buildNestedMockExecutionContext();
        const circularResult = {};
        circularResult.myself = circularResult;
        mockSystemDataRegistry.query.mockReturnValue(circularResult);
        handler.execute(defaultParams, ctx);
        expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(
          defaultSourceId,
          defaultQueryDetails
        );
        expect(ctx.evaluationContext.context[defaultResultVariable]).toBe(
          circularResult
        );
        expect(mockConstructorLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `Stored result in "${defaultResultVariable}": [Could not stringify result]`
          )
        );
      });
    });
  });
});
