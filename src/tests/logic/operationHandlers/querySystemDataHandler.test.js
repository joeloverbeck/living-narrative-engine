// src/tests/logic/operationHandlers/querySystemDataHandler.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach} from '@jest/globals';
import QuerySystemDataHandler from '../../../logic/operationHandlers/querySystemDataHandler.js'; // Adjust path if needed

// --- Type-hints (for editors only) ------------------------------------------
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../core/services/systemDataRegistry.js').SystemDataRegistry} SystemDataRegistry */
// *** CORRECTED ExecutionContext typedef based on handler's actual usage and needed test structure ***
/**
 * Represents the overall execution environment for an operation.
 * The handler now expects a 'context' property directly on this object.
 * @typedef {object} ExecutionContext
 * @property {object} context - The shared context object for storing/retrieving variables.
 * @property {any} entityManager - Mocked entity manager.
 * @property {any} validatedEventDispatcher - Mocked event dispatcher.
 * @property {ILogger} logger - DEPRECATED logger on context, should be ignored by handler.
 * @property {any} [event] - Optional event details (added for completeness in mock).
 * @property {any} [actor] - Optional actor details (added for completeness in mock).
 * @property {any} [target] - Optional target details (added for completeness in mock).
 * @property {any} [globals] - Optional globals (added for completeness in mock).
 * @property {any} [entities] - Optional entities (added for completeness in mock).
 */
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
// *** CORRECTED Mock Builder to match handler's expectation of executionContext.context ***
/**
 * Builds a mock ExecutionContext with the 'context' property at the top level.
 * @param {object} [contextData={}] - Initial data for executionContext.context.
 * @param {ILogger} [contextLogger=null] - **DEPRECATED**: Logger should come from constructor. Kept for testing the ignore mechanism.
 * @returns {ExecutionContext}
 */
function buildMockExecutionContext(contextData = {}, contextLogger = null) {
    const loggerToUse = contextLogger ?? createMockLogger();
    return {
        // --- Core properties expected by the handler/tests ---
        context: {...contextData}, // Context is now directly on executionContext
        entityManager: {}, // Mock or provide if needed
        validatedEventDispatcher: {}, // Mock if needed

        // --- Deprecated logger property ---
        logger: loggerToUse, // Present for testing it's ignored

        // --- Other potential properties (might be needed by registry.query implementations) ---
        event: {type: 'TEST_EVENT', payload: {}},
        actor: null,
        target: null,
        globals: {},
        entities: {},
        // No nested evaluationContext needed based on handler's current logic
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
        // This is the logger instance that SHOULD be used by the handler
        mockLogger = createMockLogger();
        mockSystemDataRegistry = createMockSystemDataRegistry();
        // Create a new handler instance for each test, injecting the main mockLogger
        handler = new QuerySystemDataHandler({
            logger: mockLogger,
            systemDataRegistry: mockSystemDataRegistry,
        });
        // Clear the constructor log call specifically if needed
        mockLogger.debug.mockClear();
    });

    // --- Constructor Validation ----------------------------------------------
    describe('Constructor', () => {
        // ... (constructor tests remain the same)
        test('initializes successfully with valid dependencies', () => {
            // Re-check constructor log call expectation after clearing in beforeEach
            mockLogger.debug.mockImplementationOnce(() => {
            }); // Temporarily suppress for this check if cleared
            handler = new QuerySystemDataHandler({logger: mockLogger, systemDataRegistry: mockSystemDataRegistry});
            expect(handler).toBeInstanceOf(QuerySystemDataHandler);
            expect(mockLogger.debug).toHaveBeenCalledWith('QuerySystemDataHandler: Instance created successfully.');
            expect(mockLogger.error).not.toHaveBeenCalled(); // No errors during construction
            mockLogger.debug.mockClear(); // Clean up for subsequent tests
        });

        test('throws TypeError if logger dependency is missing or invalid', () => {
            const invalidLoggers = [
                null,
                undefined,
                {},
                {info: jest.fn(), warn: jest.fn(), error: jest.fn() /* missing debug */},
                {info: 'not a function', warn: jest.fn(), error: jest.fn(), debug: jest.fn()},
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
                {query: 'not a function'},
            ];
            invalidRegistries.forEach(invalidRegistry => {
                // Need a valid logger to test the registry validation part
                const validLogger = createMockLogger(); // Use a temporary valid logger for this specific test
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
                    // This assertion should still use the 'validLogger' instance passed to the constructor in this test case
                    expect(validLogger.error).toHaveBeenCalledWith(
                        'QuerySystemDataHandler: Invalid SystemDataRegistry dependency provided.',
                        {systemDataRegistry: invalidRegistry}
                    );
                }
            });
        });
    });

    // --- Execute Method Tests -------------------------------------------------
    describe('execute', () => {
        const defaultSourceId = 'gameRepo';
        const defaultQueryDetails = {method: 'getWorldName'};
        const defaultResultVariable = 'worldNameResult';
        const defaultParams = {
            source_id: defaultSourceId,
            query_details: defaultQueryDetails,
            result_variable: defaultResultVariable,
        };
        const successResult = 'TestWorld';

        // --- Parameter Validation ---
        // *** This block should remain the same as it tests 'params' object, not 'executionContext' ***
        describe('Parameter Validation', () => {
            // Tests for invalid 'params' object (null, undefined, non-object) - These should still expect { params: ... }
            test.each([
                ['null params', null, 'Missing or invalid parameters object.', {params: null}],
                ['undefined params', undefined, 'Missing or invalid parameters object.', {params: undefined}],
                ['non-object params', 123, 'Missing or invalid parameters object.', {params: 123}],
            ])('logs error and returns if params are invalid (%s)', (desc, invalidParams, expectedMsg, expectedPayload) => {
                const ctx = buildMockExecutionContext();
                handler.execute(invalidParams, ctx);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    `QUERY_SYSTEM_DATA: ${expectedMsg}`,
                    expectedPayload // Expecting { params: ... } here is CORRECT
                );
                expect(ctx.context).toEqual({});
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });

            // Test case for array params - Fails source_id check AFTER destructuring attempt
            test('logs error and returns if params are invalid (array params)', () => {
                const invalidParams = [];
                const ctx = buildMockExecutionContext();
                handler.execute(invalidParams, ctx);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'QUERY_SYSTEM_DATA: Missing or invalid required "source_id" parameter (must be non-empty string).',
                    // ***** CORRECTION: Expect receivedParams *****
                    {receivedParams: invalidParams}
                );
                expect(ctx.context).toEqual({});
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });


            // Test cases for invalid 'source_id' - These should expect { receivedParams: ... }
            test.each([
                ['missing', {query_details: 'q', result_variable: 'r'}],
                ['null', {source_id: null, query_details: 'q', result_variable: 'r'}],
                ['undefined', {source_id: undefined, query_details: 'q', result_variable: 'r'}],
                ['empty string', {source_id: '', query_details: 'q', result_variable: 'r'}],
                ['whitespace string', {source_id: '  ', query_details: 'q', result_variable: 'r'}],
                ['non-string', {source_id: 123, query_details: 'q', result_variable: 'r'}],
            ])('logs error and returns if "source_id" is invalid (%s)', (desc, params) => {
                const ctx = buildMockExecutionContext();
                handler.execute(params, ctx);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'QUERY_SYSTEM_DATA: Missing or invalid required "source_id" parameter (must be non-empty string).',
                    // ***** CORRECTION: Expect receivedParams *****
                    {receivedParams: params}
                );
                expect(ctx.context).toEqual({});
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });

            // Test cases for invalid 'query_details' - These should expect { receivedParams: ... }
            test.each([
                ['missing', {source_id: 's', result_variable: 'r'}],
                ['undefined', {source_id: 's', query_details: undefined, result_variable: 'r'}],
            ])('logs error and returns if "query_details" is invalid (%s)', (desc, params) => {
                const ctx = buildMockExecutionContext();
                handler.execute(params, ctx);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'QUERY_SYSTEM_DATA: Missing required "query_details" parameter.',
                    // ***** CORRECTION: Expect receivedParams *****
                    {receivedParams: params}
                );
                expect(ctx.context).toEqual({});
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });

            // Test for 'allows null as query_details' remains logically the same (checks NO error is logged)
            test('allows null as query_details', () => {
                const ctx = buildMockExecutionContext();
                const paramsWithNull = {...defaultParams, query_details: null};
                mockSystemDataRegistry.query.mockReturnValue('result from null query');

                handler.execute(paramsWithNull, ctx);

                expect(mockLogger.error).not.toHaveBeenCalledWith(
                    expect.stringContaining('Missing required "query_details"'),
                    expect.anything() // No need to check payload key if no error logged
                );
                expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, null);
                expect(ctx.context[defaultResultVariable]).toBe('result from null query');
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });

            // Test cases for invalid 'result_variable' - These should expect { receivedParams: ... }
            test.each([
                ['missing', {source_id: 's', query_details: 'q'}],
                ['null', {source_id: 's', query_details: 'q', result_variable: null}],
                ['undefined', {source_id: 's', query_details: 'q', result_variable: undefined}],
                ['empty string', {source_id: 's', query_details: 'q', result_variable: ''}],
                ['whitespace string', {source_id: 's', query_details: 'q', result_variable: '  '}],
                ['non-string', {source_id: 's', query_details: 'q', result_variable: 123}],
            ])('logs error and returns if "result_variable" is invalid (%s)', (desc, params) => {
                const ctx = buildMockExecutionContext();
                handler.execute(params, ctx);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'QUERY_SYSTEM_DATA: Missing or invalid required "result_variable" parameter (must be non-empty string).',
                    // ***** CORRECTION: Expect receivedParams *****
                    {receivedParams: params}
                );
                expect(ctx.context).toEqual({});
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });
        });
        // *** END Parameter Validation block ***


        // --- Execution Context Validation ---
        // *** CORRECTED ASSERTION BLOCK AND TEST CASES ***
        describe('Execution Context Validation', () => {
            const validParams = {...defaultParams};

            // Define test cases for various invalid execution context structures
            // targeting the check: !executionContext || typeof executionContext.context !== 'object' || executionContext.context === null
            test.each([
                ['null executionContext', null],
                ['undefined executionContext', undefined],
                // Cases where executionContext exists, but its 'context' property is invalid
                ['executionContext without context', {}], // context is undefined
                ['executionContext with null context', {context: null}], // context is null
                ['executionContext with non-object context', {context: 'string'}], // context is not an object
                // Added case: context is an array (technically typeof 'object', but might be undesired)
                // Note: The current code allows arrays. Add this if stricter checking is needed.
                // ['executionContext with array context', { context: [] }],
            ])('logs error and returns if execution context structure is invalid (%s)', (desc, invalidCtx) => {
                // Execute the handler with valid operation parameters but an invalid context structure
                handler.execute(validParams, invalidCtx);

                // --- CORRECTED ASSERTION: Expect the *new* error message ---
                expect(mockLogger.error).toHaveBeenCalledWith(
                    // The NEW message reflecting the check on executionContext.context
                    'QUERY_SYSTEM_DATA: executionContext.context is missing or invalid. Cannot store result.',
                    // The logged object should contain the invalid context structure under the key 'executionContext'
                    {executionContext: invalidCtx}
                );

                // Also verify that if the invalidCtx happened to have a logger, it wasn't used.
                if (invalidCtx && typeof invalidCtx === 'object' && invalidCtx.logger && typeof invalidCtx.logger.error === 'function') {
                    expect(invalidCtx.logger.error).not.toHaveBeenCalled();
                }
            });
        });
        // *** END CORRECTED BLOCK ***


        // --- Core Execution Paths ---
        // *** CORRECTED ASSERTION BLOCK ***
        describe('Core Execution Scenarios', () => {
            // *** CORRECTED TEST FOR SUCCESSFUL EXECUTION ***
            test('executes successfully, calls registry.query, stores result in context', () => {
                const ctx = buildMockExecutionContext({initialVar: 'exists'}); // Correct builder provides ctx.context
                mockSystemDataRegistry.query.mockReturnValue(successResult);

                handler.execute(defaultParams, ctx);

                // --- ASSERTION FIX: Should now be called because ctx.context is valid ---
                expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);

                // --- ASSERTION FIX: Check the correct context location ---
                expect(ctx.context).toHaveProperty(defaultResultVariable, successResult);
                expect(ctx.context['initialVar']).toBe('exists'); // Check initial data preserved

                // --- Assert against mockLogger ---
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Attempting to query source "${defaultSourceId}"`));
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully queried source "${defaultSourceId}". Stored result in "${defaultResultVariable}": ${JSON.stringify(successResult)}`));
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
                // --- Verify ctx logger not used ---
                expect(ctx.logger.debug).not.toHaveBeenCalled();
                expect(ctx.logger.warn).not.toHaveBeenCalled();
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });

            // *** CORRECTED COMPLEX OBJECT TEST ***
            test('handles successful query returning complex object', () => {
                const ctx = buildMockExecutionContext(); // Correct builder provides ctx.context
                const complexResult = {data: [1, 2], nested: {flag: true}};
                mockSystemDataRegistry.query.mockReturnValue(complexResult);

                handler.execute(defaultParams, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);
                // --- ASSERTION FIX: Check the correct context location ---
                expect(ctx.context[defaultResultVariable]).toEqual(complexResult);
                // --- Assert against mockLogger ---
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Stored result in "${defaultResultVariable}": ${JSON.stringify(complexResult)}`));
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
                // --- Verify ctx logger not used ---
                expect(ctx.logger.debug).not.toHaveBeenCalled();
                expect(ctx.logger.warn).not.toHaveBeenCalled();
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });

            // *** CORRECTED NULL RESULT TEST ***
            test('handles successful query returning null', () => {
                const ctx = buildMockExecutionContext(); // Correct builder provides ctx.context
                mockSystemDataRegistry.query.mockReturnValue(null);

                handler.execute(defaultParams, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);
                // --- ASSERTION FIX: Check the correct context location ---
                expect(ctx.context[defaultResultVariable]).toBeNull();
                // --- Assert against mockLogger ---
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Stored result in "${defaultResultVariable}": null`));
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
                // --- Verify ctx logger not used ---
                expect(ctx.logger.debug).not.toHaveBeenCalled();
                expect(ctx.logger.warn).not.toHaveBeenCalled();
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });

            // *** CORRECTED QUERY FAILURE (UNDEFINED RETURN) TEST ***
            test('handles query failure (registry returns undefined), stores undefined, logs warning', () => {
                const ctx = buildMockExecutionContext({initialVar: 'exists'}); // Correct builder provides ctx.context
                mockSystemDataRegistry.query.mockReturnValue(undefined);

                handler.execute(defaultParams, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);
                // --- ASSERTION FIX: Check the correct context location ---
                expect(ctx.context).toHaveProperty(defaultResultVariable, undefined);
                expect(ctx.context['initialVar']).toBe('exists'); // Check initial data preserved

                // --- Assert against mockLogger ---
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Attempting to query source "${defaultSourceId}"`));
                expect(mockLogger.warn).toHaveBeenCalledTimes(1);
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    `QUERY_SYSTEM_DATA: Query to source "${defaultSourceId}" failed or returned no result. Stored 'undefined' in "${defaultResultVariable}".`
                );
                expect(mockLogger.error).not.toHaveBeenCalled();
                expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Successfully queried source'));
                // --- Verify ctx logger not used ---
                expect(ctx.logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Successfully queried source'));
                expect(ctx.logger.warn).not.toHaveBeenCalled();
                expect(ctx.logger.error).not.toHaveBeenCalled();

            });

            // *** CORRECTED QUERY ERROR (THROW) TEST ***
            // Note: This test had correct assertions already regarding logging, just needs context access fix.
            test('handles query error (registry throws), stores undefined, logs error', () => {
                const ctx = buildMockExecutionContext({initialVar: 'exists'}); // Correct builder provides ctx.context
                const queryError = new Error('Database connection failed');
                mockSystemDataRegistry.query.mockImplementation(() => {
                    throw queryError;
                });

                handler.execute(defaultParams, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);
                // --- ASSERTION FIX: Check the correct context location ---
                expect(ctx.context).toHaveProperty(defaultResultVariable, undefined);
                expect(ctx.context['initialVar']).toBe('exists'); // Check initial data preserved

                // --- Assert against mockLogger (Error and Warning logs) ---
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Attempting to query source "${defaultSourceId}"`));
                expect(mockLogger.error).toHaveBeenCalledWith(
                    `QUERY_SYSTEM_DATA: Error occurred while executing query on source "${defaultSourceId}". Storing 'undefined' in "${defaultResultVariable}".`,
                    expect.objectContaining({ // Check the payload details
                        sourceId: defaultSourceId,
                        queryDetails: defaultQueryDetails,
                        resultVariable: defaultResultVariable,
                        error: queryError.message,
                    })
                );
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    `QUERY_SYSTEM_DATA: Query to source "${defaultSourceId}" failed or returned no result. Stored 'undefined' in "${defaultResultVariable}".`
                );
                expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Successfully queried source'));

                // --- Verify ctx logger not used ---
                expect(ctx.logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Successfully queried source'));
                expect(ctx.logger.warn).not.toHaveBeenCalled();
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });
            // ##### End Corrected Test Block #####

            // *** CORRECTED TRIMMING TEST ***
            test('trims whitespace from source_id and result_variable', () => {
                const ctx = buildMockExecutionContext(); // Correct builder provides ctx.context
                const paramsWithWhitespace = {
                    source_id: `  ${defaultSourceId}  `,
                    query_details: defaultQueryDetails,
                    result_variable: `  ${defaultResultVariable}  `,
                };
                mockSystemDataRegistry.query.mockReturnValue(successResult);

                handler.execute(paramsWithWhitespace, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails); // Trimmed source_id used
                // --- ASSERTION FIX: Check the correct context location with trimmed key ---
                expect(ctx.context).toHaveProperty(defaultResultVariable, successResult); // Trimmed result_variable used as key
                expect(ctx.context).not.toHaveProperty(`  ${defaultResultVariable}  `); // Verify spacey key wasn't used

                // --- Assert against mockLogger ---
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`query source "${defaultSourceId}"`));
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Stored result in "${defaultResultVariable}"`));
                // --- Verify ctx logger not used ---
                expect(ctx.logger.debug).not.toHaveBeenCalled();
            });

            // This test confirms the absence of using the context logger (already correct)
            test('uses ONLY the constructor logger, ignoring any logger in execution context', () => {
                const specificContextLogger = createMockLogger();
                // Use the corrected builder, passing the specific logger to be ignored
                const ctx = buildMockExecutionContext({}, specificContextLogger);
                mockSystemDataRegistry.query.mockReturnValue(successResult);

                handler.execute(defaultParams, ctx);

                // Verify the CONSTRUCTOR logger (mockLogger) was used
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Attempting to query source "${defaultSourceId}"`));
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully queried source "${defaultSourceId}"`));

                // Verify the specific logger provided in the context was NOT used
                expect(specificContextLogger.debug).not.toHaveBeenCalled();
                expect(specificContextLogger.info).not.toHaveBeenCalled();
                expect(specificContextLogger.warn).not.toHaveBeenCalled();
                expect(specificContextLogger.error).not.toHaveBeenCalled();
            });

            // *** CORRECTED NON-STRINGIFIABLE RESULT TEST ***
            test('handles non-stringifiable result during logging gracefully', () => {
                const ctx = buildMockExecutionContext(); // Correct builder provides ctx.context
                const circularResult = {};
                circularResult.myself = circularResult;
                mockSystemDataRegistry.query.mockReturnValue(circularResult);

                handler.execute(defaultParams, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);
                // --- ASSERTION FIX: Check the correct context location ---
                expect(ctx.context[defaultResultVariable]).toBe(circularResult);

                // --- Assert against mockLogger ---
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully queried source "${defaultSourceId}". Stored result in "${defaultResultVariable}": [Could not stringify result]`));
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
                // --- Verify ctx logger not used ---
                expect(ctx.logger.debug).not.toHaveBeenCalled();
                expect(ctx.logger.warn).not.toHaveBeenCalled();
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });
        });
        // *** END Core Execution Scenarios block ***
    });
});