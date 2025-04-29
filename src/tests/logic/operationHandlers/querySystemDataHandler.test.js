// src/logic/operationHandlers/querySystemDataHandler.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import QuerySystemDataHandler from '../../../logic/operationHandlers/querySystemDataHandler.js'; // Adjust path if needed

// --- Type-hints (for editors only) ------------------------------------------
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../core/services/systemDataRegistry.js').SystemDataRegistry} SystemDataRegistry */
/** @typedef {import('../../../logic/defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../../logic/operationHandlers/querySystemDataHandler.js').QuerySystemDataParams} QuerySystemDataParams */

// --- Mock services ---------------------------------------------------------

/**
 * Creates a mock ILogger object.
 * @returns {jest.Mocked<ILogger>}
 */
const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

/**
 * Creates a mock SystemDataRegistry object.
 * @returns {jest.Mocked<Pick<SystemDataRegistry, 'query'>>} // Only mock needed methods
 */
const createMockSystemDataRegistry = () => ({
    query: jest.fn(),
});

// --- Helper – ExecutionContext factory -------------------------------------
/**
 * Builds a mock ExecutionContext.
 * @param {object} [contextData={}] - Initial data for evaluationContext.context.
 * @param {ILogger} [contextLogger=null] - Optional specific logger for this context.
 * @returns {ExecutionContext}
 */
function buildMockExecutionContext(contextData = {}, contextLogger = null) {
    return {
        evaluationContext: {
            event: { type: 'TEST_EVENT', payload: {} },
            actor: null,
            target: null,
            context: { ...contextData }, // Clone to prevent mutation across tests
            globals: {},
            entities: {},
        },
        entityManager: {}, // Mock or provide if needed
        validatedEventDispatcher: {}, // Mock if needed
        logger: contextLogger ?? createMockLogger(), // Use specific or create new default mock
        // gameDataRepository: {}, // Mock if needed
    };
}

// --- Test-suite ------------------------------------------------------------
describe('QuerySystemDataHandler', () => {
    /** @type {QuerySystemDataHandler} */
    let handler;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger; // Default logger passed to constructor
    /** @type {jest.Mocked<Pick<SystemDataRegistry, 'query'>>} */
    let mockSystemDataRegistry;

    beforeEach(() => {
        jest.clearAllMocks();
        mockLogger = createMockLogger();
        mockSystemDataRegistry = createMockSystemDataRegistry();
        // Create a new handler instance for each test
        handler = new QuerySystemDataHandler({
            logger: mockLogger,
            systemDataRegistry: mockSystemDataRegistry,
        });
        // Clear the constructor log call specifically if needed, or rely on test-specific clears
        // mockLogger.debug.mockClear(); // Optional: clear constructor log here if preferred
    });

    // --- Constructor Validation ----------------------------------------------
    describe('Constructor', () => {
        test('initializes successfully with valid dependencies', () => {
            expect(handler).toBeInstanceOf(QuerySystemDataHandler);
            // Check constructor's own log message
            expect(mockLogger.debug).toHaveBeenCalledWith('QuerySystemDataHandler: Instance created successfully.');
            expect(mockLogger.error).not.toHaveBeenCalled(); // No errors during construction
        });

        test('throws TypeError if logger dependency is missing or invalid', () => {
            const invalidLoggers = [
                null,
                undefined,
                {},
                { info: jest.fn(), warn: jest.fn(), error: jest.fn() /* missing debug */ },
                { info: 'not a function', warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
            ];
            invalidLoggers.forEach(invalidLogger => {
                expect(() => new QuerySystemDataHandler({
                    logger: invalidLogger,
                    systemDataRegistry: mockSystemDataRegistry
                })).toThrow(TypeError);
                expect(() => new QuerySystemDataHandler({
                    logger: invalidLogger,
                    systemDataRegistry: mockSystemDataRegistry
                })).toThrow(/QuerySystemDataHandler requires a valid ILogger instance/);
            });
        });

        test('throws TypeError if systemDataRegistry dependency is missing or invalid', () => {
            const invalidRegistries = [
                null,
                undefined,
                {},
                { query: 'not a function' },
            ];
            invalidRegistries.forEach(invalidRegistry => {
                // Need a valid logger to test the registry validation part
                const validLogger = createMockLogger();
                expect(() => new QuerySystemDataHandler({
                    logger: validLogger,
                    systemDataRegistry: invalidRegistry
                })).toThrow(TypeError);
                expect(() => new QuerySystemDataHandler({
                    logger: validLogger,
                    systemDataRegistry: invalidRegistry
                })).toThrow(/QuerySystemDataHandler requires a valid SystemDataRegistry instance/);

                // Check if the error about invalid registry was logged *before* throwing
                if (invalidRegistry !== null && invalidRegistry !== undefined) {
                    expect(validLogger.error).toHaveBeenCalledWith(
                        'QuerySystemDataHandler: Invalid SystemDataRegistry dependency provided.',
                        { systemDataRegistry: invalidRegistry }
                    );
                }
            });
        });
    });

    // --- Execute Method Tests -------------------------------------------------
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

        // --- Parameter Validation ---
        describe('Parameter Validation', () => {
            // --- CORRECTED ARRAY TEST CASE ---
            test.each([
                ['null params', null, 'Missing or invalid parameters object.', { params: null }],
                ['undefined params', undefined, 'Missing or invalid parameters object.', { params: undefined }],
                ['non-object params', 123, 'Missing or invalid parameters object.', { params: 123 }],
                // Array passes object check, fails source_id check because source_id becomes undefined
                ['array params', [], 'Missing or invalid required "source_id" parameter (must be non-empty string).', { params: [] }],
            ])('logs error and returns if params are invalid (%s)', (desc, invalidParams, expectedMsg, expectedPayload) => {
                const ctx = buildMockExecutionContext();
                handler.execute(invalidParams, ctx);
                expect(ctx.logger.error).toHaveBeenCalledWith(
                    `QUERY_SYSTEM_DATA: ${expectedMsg}`,
                    expectedPayload // Use the payload from the test.each data
                );
                // Ensure context wasn't accidentally modified
                expect(ctx.evaluationContext.context).toEqual({});
            });

            test.each([
                ['missing', { query_details: 'q', result_variable: 'r' }],
                ['null', { source_id: null, query_details: 'q', result_variable: 'r' }],
                ['undefined', { source_id: undefined, query_details: 'q', result_variable: 'r' }],
                ['empty string', { source_id: '', query_details: 'q', result_variable: 'r' }],
                ['whitespace string', { source_id: '  ', query_details: 'q', result_variable: 'r' }],
                ['non-string', { source_id: 123, query_details: 'q', result_variable: 'r' }],
            ])('logs error and returns if "source_id" is invalid (%s)', (desc, params) => {
                const ctx = buildMockExecutionContext();
                handler.execute(params, ctx);
                expect(ctx.logger.error).toHaveBeenCalledWith(
                    'QUERY_SYSTEM_DATA: Missing or invalid required "source_id" parameter (must be non-empty string).',
                    { params } // The logged object contains the original invalid params
                );
                expect(ctx.evaluationContext.context).toEqual({});
            });

            test.each([
                ['missing', { source_id: 's', result_variable: 'r' }],
                // ['null', { source_id: 's', query_details: null, result_variable: 'r' }], // null is a valid value
                ['undefined', { source_id: 's', query_details: undefined, result_variable: 'r' }],
            ])('logs error and returns if "query_details" is invalid (%s)', (desc, params) => {
                const ctx = buildMockExecutionContext();
                handler.execute(params, ctx);
                expect(ctx.logger.error).toHaveBeenCalledWith(
                    'QUERY_SYSTEM_DATA: Missing required "query_details" parameter.',
                    { params }
                );
                expect(ctx.evaluationContext.context).toEqual({});
            });
            test('allows null as query_details', () => {
                const ctx = buildMockExecutionContext();
                const paramsWithNull = { ...defaultParams, query_details: null };
                mockSystemDataRegistry.query.mockReturnValue('result from null query'); // Simulate success
                handler.execute(paramsWithNull, ctx);
                // Should NOT log the "missing query_details" error
                expect(ctx.logger.error).not.toHaveBeenCalledWith(
                    expect.stringContaining('Missing required "query_details"'),
                    expect.anything()
                );
                // Should proceed to query
                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, null);
                expect(ctx.evaluationContext.context[defaultResultVariable]).toBe('result from null query');
            });

            test.each([
                ['missing', { source_id: 's', query_details: 'q' }],
                ['null', { source_id: 's', query_details: 'q', result_variable: null }],
                ['undefined', { source_id: 's', query_details: 'q', result_variable: undefined }],
                ['empty string', { source_id: 's', query_details: 'q', result_variable: '' }],
                ['whitespace string', { source_id: 's', query_details: 'q', result_variable: '  ' }],
                ['non-string', { source_id: 's', query_details: 'q', result_variable: 123 }],
            ])('logs error and returns if "result_variable" is invalid (%s)', (desc, params) => {
                const ctx = buildMockExecutionContext();
                handler.execute(params, ctx);
                expect(ctx.logger.error).toHaveBeenCalledWith(
                    'QUERY_SYSTEM_DATA: Missing or invalid required "result_variable" parameter (must be non-empty string).',
                    { params }
                );
                expect(ctx.evaluationContext.context).toEqual({});
            });
        });

        // --- Execution Context Validation ---
        describe('Execution Context Validation', () => {
            const validParams = { ...defaultParams };

            test.each([
                ['null executionContext', null],
                ['undefined executionContext', undefined],
                ['executionContext without evaluationContext', { logger: createMockLogger() }],
                ['executionContext with null evaluationContext', { logger: createMockLogger(), evaluationContext: null }],
                ['evaluationContext without context', { logger: createMockLogger(), evaluationContext: {} }],
                ['evaluationContext with null context', { logger: createMockLogger(), evaluationContext: { context: null } }],
                ['evaluationContext with non-object context', { logger: createMockLogger(), evaluationContext: { context: 'string' } }],
            ])('logs error and returns if execution context structure is invalid (%s)', (desc, invalidCtx) => {
                // Determine which logger would be used (context or default)
                const expectedLogger = invalidCtx?.logger ?? mockLogger; // Handler falls back to constructor logger if context/logger missing

                handler.execute(validParams, invalidCtx);

                expect(expectedLogger.error).toHaveBeenCalledWith(
                    'QUERY_SYSTEM_DATA: evaluationContext.context is missing or invalid. Cannot store result.',
                    { executionContext: invalidCtx }
                );
            });
        });

        // --- Core Execution Paths ---
        describe('Core Execution Scenarios', () => {
            test('executes successfully, calls registry.query, stores result in context', () => {
                const ctx = buildMockExecutionContext({ initialVar: 'exists' });
                // Configure mock to return success value
                mockSystemDataRegistry.query.mockReturnValue(successResult);

                handler.execute(defaultParams, ctx);

                // Verify query call
                expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);

                // Verify context update (AC: context variable is set correctly)
                expect(ctx.evaluationContext.context).toHaveProperty(defaultResultVariable, successResult);
                expect(ctx.evaluationContext.context['initialVar']).toBe('exists'); // Check didn't wipe other context

                // Verify logging (AC: Verify correct logging)
                expect(ctx.logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Attempting to query source "${defaultSourceId}"`));
                expect(ctx.logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully queried source "${defaultSourceId}". Stored result in "${defaultResultVariable}": ${JSON.stringify(successResult)}`));
                expect(ctx.logger.warn).not.toHaveBeenCalled();
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });

            test('handles successful query returning complex object', () => {
                const ctx = buildMockExecutionContext();
                const complexResult = { data: [1, 2], nested: { flag: true } };
                mockSystemDataRegistry.query.mockReturnValue(complexResult);

                handler.execute(defaultParams, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);
                expect(ctx.evaluationContext.context[defaultResultVariable]).toEqual(complexResult); // Use toEqual for deep comparison
                expect(ctx.logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Stored result in "${defaultResultVariable}": ${JSON.stringify(complexResult)}`));
                expect(ctx.logger.warn).not.toHaveBeenCalled();
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });

            test('handles successful query returning null', () => {
                const ctx = buildMockExecutionContext();
                mockSystemDataRegistry.query.mockReturnValue(null);

                handler.execute(defaultParams, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);
                expect(ctx.evaluationContext.context[defaultResultVariable]).toBeNull();
                expect(ctx.logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Stored result in "${defaultResultVariable}": null`));
                expect(ctx.logger.warn).not.toHaveBeenCalled(); // Query succeeded, even if result is null
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });


            test('handles query failure (registry returns undefined), stores undefined, logs warning', () => {
                const ctx = buildMockExecutionContext({ initialVar: 'exists' });
                // Configure mock to return undefined (simulates source not found, query unsupported, etc.)
                mockSystemDataRegistry.query.mockReturnValue(undefined);

                handler.execute(defaultParams, ctx);

                // Verify query call
                expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);

                // Verify context update (AC: context variable is undefined)
                expect(ctx.evaluationContext.context).toHaveProperty(defaultResultVariable, undefined);
                expect(ctx.evaluationContext.context['initialVar']).toBe('exists');

                // Verify logging (AC: warning logged)
                expect(ctx.logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Attempting to query source "${defaultSourceId}"`));
                expect(ctx.logger.warn).toHaveBeenCalledTimes(1);
                expect(ctx.logger.warn).toHaveBeenCalledWith(
                    `QUERY_SYSTEM_DATA: Query to source "${defaultSourceId}" failed or returned no result. Stored 'undefined' in "${defaultResultVariable}".`
                );
                expect(ctx.logger.error).not.toHaveBeenCalled();
                // Debug log for success should NOT have been called
                expect(ctx.logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Successfully queried source'));
            });

            test('handles query error (registry throws), stores undefined, logs error', () => {
                const ctx = buildMockExecutionContext({ initialVar: 'exists' });
                const queryError = new Error('Database connection failed');
                // Configure mock to throw an error
                mockSystemDataRegistry.query.mockImplementation(() => {
                    throw queryError;
                });

                handler.execute(defaultParams, ctx);

                // Verify query call
                expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);

                // Verify context update (AC: context variable is undefined)
                expect(ctx.evaluationContext.context).toHaveProperty(defaultResultVariable, undefined);
                expect(ctx.evaluationContext.context['initialVar']).toBe('exists');

                // Verify logging (AC: error logged)
                expect(ctx.logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Attempting to query source "${defaultSourceId}"`));
                expect(ctx.logger.error).toHaveBeenCalledTimes(1);
                expect(ctx.logger.error).toHaveBeenCalledWith(
                    `QUERY_SYSTEM_DATA: Error occurred while executing query on source "${defaultSourceId}". Storing 'undefined' in "${defaultResultVariable}".`,
                    expect.objectContaining({
                        sourceId: defaultSourceId,
                        queryDetails: defaultQueryDetails,
                        resultVariable: defaultResultVariable,
                        error: queryError.message, // Check error message is logged
                    })
                );
                // AC: Appropriate errors/warnings logged -> also expect the final warning because result is undefined
                expect(ctx.logger.warn).toHaveBeenCalledTimes(1);
                expect(ctx.logger.warn).toHaveBeenCalledWith(
                    `QUERY_SYSTEM_DATA: Query to source "${defaultSourceId}" failed or returned no result. Stored 'undefined' in "${defaultResultVariable}".`
                );
                // Debug log for success should NOT have been called
                expect(ctx.logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Successfully queried source'));
            });

            test('trims whitespace from source_id and result_variable', () => {
                const ctx = buildMockExecutionContext();
                const paramsWithWhitespace = {
                    source_id: `  ${defaultSourceId}  `,
                    query_details: defaultQueryDetails,
                    result_variable: `  ${defaultResultVariable}  `,
                };
                mockSystemDataRegistry.query.mockReturnValue(successResult);

                handler.execute(paramsWithWhitespace, ctx);

                // Verify query call used trimmed source_id
                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);

                // Verify context update used trimmed result_variable
                expect(ctx.evaluationContext.context).toHaveProperty(defaultResultVariable, successResult);
                // Ensure it wasn't stored under the untrimmed key
                expect(ctx.evaluationContext.context).not.toHaveProperty(`  ${defaultResultVariable}  `);

                // Verify logging uses trimmed names
                expect(ctx.logger.debug).toHaveBeenCalledWith(expect.stringContaining(`query source "${defaultSourceId}"`));
                expect(ctx.logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Stored result in "${defaultResultVariable}"`));
            });

            // --- CORRECTED LOGGER CONTEXT TEST ---
            test('uses logger from execution context if provided', () => {
                const specificContextLogger = createMockLogger();
                const ctx = buildMockExecutionContext({}, specificContextLogger); // Pass specific logger
                mockSystemDataRegistry.query.mockReturnValue(successResult);

                // Clear the constructor mock call *before* executing the method under test
                // This ensures we only check calls made by the execute method itself.
                mockLogger.debug.mockClear();
                mockLogger.info.mockClear();
                mockLogger.warn.mockClear();
                mockLogger.error.mockClear();
                // Or more concisely: jest.clearAllMocks(mockLogger); // This clears all methods on the mock

                handler.execute(defaultParams, ctx);

                // Verify the specific logger was used for execute phase logs
                expect(specificContextLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Attempting to query source "${defaultSourceId}"`));
                expect(specificContextLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully queried source "${defaultSourceId}"`));

                // Verify the default constructor logger was NOT used *during execute*
                expect(mockLogger.debug).not.toHaveBeenCalled();
                expect(mockLogger.info).not.toHaveBeenCalled();
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('handles non-stringifiable result during logging gracefully', () => {
                const ctx = buildMockExecutionContext();
                // Create a circular structure that JSON.stringify will fail on
                const circularResult = {};
                circularResult.myself = circularResult;
                mockSystemDataRegistry.query.mockReturnValue(circularResult);

                handler.execute(defaultParams, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);
                // Result should still be stored correctly
                expect(ctx.evaluationContext.context[defaultResultVariable]).toBe(circularResult);

                // Verify logging shows the fallback message
                expect(ctx.logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully queried source "${defaultSourceId}". Stored result in "${defaultResultVariable}": [Could not stringify result]`));
                expect(ctx.logger.warn).not.toHaveBeenCalled();
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });
        });
    });
});