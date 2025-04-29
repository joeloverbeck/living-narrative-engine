// src/tests/logic/operationHandlers/querySystemDataHandler.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach} from '@jest/globals';
import QuerySystemDataHandler from '../../../logic/operationHandlers/querySystemDataHandler.js'; // Adjust path if needed

// --- Type-hints (for editors only) ------------------------------------------
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../core/services/systemDataRegistry.js').SystemDataRegistry} SystemDataRegistry */
// *** Corrected typedef for ExecutionContext based on buildMockExecutionContext usage ***
/**
 * Represents the overall execution environment for an operation.
 * Note: Based on user feedback, this context should NOT contain its own logger.
 * @typedef {object} ExecutionContext
 * @property {import('../../../logic/defs.js').JsonLogicEvaluationContext} evaluationContext - The context specific to JsonLogic rules.
 * @property {any} entityManager - Mocked entity manager.
 * @property {any} validatedEventDispatcher - Mocked event dispatcher.
 * @property {ILogger} logger - The logger instance (problematic according to user feedback, but present in mock builder).
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
/**
 * Builds a mock ExecutionContext.
 * @param {object} [contextData={}] - Initial data for evaluationContext.context.
 * @param {ILogger} [contextLogger=null] - **DEPRECATED**: Logger should come from constructor. Kept for existing tests but ideally removed.
 * @returns {ExecutionContext}
 */
function buildMockExecutionContext(contextData = {}, contextLogger = null) {
    // If a specific logger isn't passed, create a new mock one.
    // This logger in the context is problematic based on user feedback.
    const loggerToUse = contextLogger ?? createMockLogger();
    return {
        evaluationContext: {
            event: {type: 'TEST_EVENT', payload: {}},
            actor: null,
            target: null,
            context: {...contextData}, // Clone to prevent mutation across tests
            globals: {},
            entities: {},
            // evaluationContext should NOT have a logger per user feedback
        },
        entityManager: {}, // Mock or provide if needed
        validatedEventDispatcher: {}, // Mock if needed
        // This logger property on the ExecutionContext itself seems to be the source of confusion.
        // Ideally, ExecutionContext would only contain evaluationContext, entityManager, etc.
        // and the handler would *only* use the constructor-injected logger.
        // However, to make existing tests pass with minimal changes, we keep it for now.
        logger: loggerToUse,
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
        // *** CORRECTED ASSERTION BLOCK ***
        describe('Parameter Validation', () => {
            // Test cases for invalid 'params' object itself
            test.each([
                ['null params', null, 'Missing or invalid parameters object.', {params: null}],
                ['undefined params', undefined, 'Missing or invalid parameters object.', {params: undefined}],
                ['non-object params', 123, 'Missing or invalid parameters object.', {params: 123}],
                // Array passes object check, fails source_id check because source_id becomes undefined
                ['array params', [], 'Missing or invalid required "source_id" parameter (must be non-empty string).', {params: []}],
            ])('logs error and returns if params are invalid (%s)', (desc, invalidParams, expectedMsg, expectedPayload) => {
                // Note: buildMockExecutionContext creates a context with its OWN logger by default.
                // However, the handler should IGNORE ctx.logger and ALWAYS use mockLogger (from constructor).
                const ctx = buildMockExecutionContext(); // We still need a valid structure for evaluationContext.context
                handler.execute(invalidParams, ctx);

                // --- CORRECTED ASSERTION: Use mockLogger (constructor injected) ---
                expect(mockLogger.error).toHaveBeenCalledWith(
                    `QUERY_SYSTEM_DATA: ${expectedMsg}`,
                    expectedPayload
                );
                // Ensure the actual evaluation context wasn't accidentally modified
                expect(ctx.evaluationContext.context).toEqual({});
                // Verify the logger within ctx was NOT used (as per user requirement)
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });

            // Test cases for invalid 'source_id'
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
                // --- CORRECTED ASSERTION: Use mockLogger ---
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'QUERY_SYSTEM_DATA: Missing or invalid required "source_id" parameter (must be non-empty string).',
                    {params}
                );
                expect(ctx.evaluationContext.context).toEqual({});
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });

            // Test cases for invalid 'query_details'
            test.each([
                ['missing', {source_id: 's', result_variable: 'r'}],
                // ['null', { source_id: 's', query_details: null, result_variable: 'r' }], // null is a valid value
                ['undefined', {source_id: 's', query_details: undefined, result_variable: 'r'}],
            ])('logs error and returns if "query_details" is invalid (%s)', (desc, params) => {
                const ctx = buildMockExecutionContext();
                handler.execute(params, ctx);
                // --- CORRECTED ASSERTION: Use mockLogger ---
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'QUERY_SYSTEM_DATA: Missing required "query_details" parameter.',
                    {params}
                );
                expect(ctx.evaluationContext.context).toEqual({});
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });

            test('allows null as query_details', () => {
                const ctx = buildMockExecutionContext();
                const paramsWithNull = {...defaultParams, query_details: null};
                mockSystemDataRegistry.query.mockReturnValue('result from null query'); // Simulate success
                handler.execute(paramsWithNull, ctx);
                // --- CORRECTED ASSERTION: Use mockLogger ---
                // Should NOT log the "missing query_details" error
                expect(mockLogger.error).not.toHaveBeenCalledWith(
                    expect.stringContaining('Missing required "query_details"'),
                    expect.anything()
                );
                // Should proceed to query
                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, null);
                expect(ctx.evaluationContext.context[defaultResultVariable]).toBe('result from null query');
                expect(ctx.logger.error).not.toHaveBeenCalled(); // Also check ctx logger wasn't used
            });

            // Test cases for invalid 'result_variable'
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
                // --- CORRECTED ASSERTION: Use mockLogger ---
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'QUERY_SYSTEM_DATA: Missing or invalid required "result_variable" parameter (must be non-empty string).',
                    {params}
                );
                expect(ctx.evaluationContext.context).toEqual({});
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });
        });
        // *** END CORRECTED BLOCK ***


        // --- Execution Context Validation ---
        // *** CORRECTED ASSERTION BLOCK ***
        describe('Execution Context Validation', () => {
            const validParams = {...defaultParams};

            // Define test cases for various invalid execution context structures
            // Note: The concept of passing a logger within the context is flawed per user feedback.
            // These tests primarily validate the check for `evaluationContext.context` being a valid object.
            test.each([
                ['null executionContext', null],
                ['undefined executionContext', undefined],
                // Cases where evaluationContext itself is missing or invalid
                ['executionContext without evaluationContext', {logger: createMockLogger()}], // Still has logger, but no eval ctx
                ['executionContext with null evaluationContext', {logger: createMockLogger(), evaluationContext: null}],
                // Cases where evaluationContext exists, but its 'context' property is invalid
                ['evaluationContext without context', {evaluationContext: {}}], // Missing context property
                ['evaluationContext with null context', {evaluationContext: {context: null}}],
                ['evaluationContext with non-object context', {evaluationContext: {context: 'string'}}],
            ])('logs error and returns if execution context structure is invalid (%s)', (desc, invalidCtx) => {
                // Execute the handler with valid operation parameters but an invalid context structure
                handler.execute(validParams, invalidCtx);

                // --- CORRECTED ASSERTION: Always use mockLogger and expect correct payload key ---
                // The handler MUST use the constructor-injected logger (mockLogger).
                // The log payload key should be 'executionContext' as fixed in the code.
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'QUERY_SYSTEM_DATA: executionContext.evaluationContext.context is missing or invalid. Cannot store result.',
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
        describe('Core Execution Scenarios', () => {
            test('executes successfully, calls registry.query, stores result in context', () => {
                const ctx = buildMockExecutionContext({initialVar: 'exists'});
                mockSystemDataRegistry.query.mockReturnValue(successResult);

                handler.execute(defaultParams, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);
                expect(ctx.evaluationContext.context).toHaveProperty(defaultResultVariable, successResult);
                expect(ctx.evaluationContext.context['initialVar']).toBe('exists');

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

            test('handles successful query returning complex object', () => {
                const ctx = buildMockExecutionContext();
                const complexResult = {data: [1, 2], nested: {flag: true}};
                mockSystemDataRegistry.query.mockReturnValue(complexResult);

                handler.execute(defaultParams, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);
                expect(ctx.evaluationContext.context[defaultResultVariable]).toEqual(complexResult);
                // --- Assert against mockLogger ---
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Stored result in "${defaultResultVariable}": ${JSON.stringify(complexResult)}`));
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
                // --- Verify ctx logger not used ---
                expect(ctx.logger.debug).not.toHaveBeenCalled();
                expect(ctx.logger.warn).not.toHaveBeenCalled();
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });

            test('handles successful query returning null', () => {
                const ctx = buildMockExecutionContext();
                mockSystemDataRegistry.query.mockReturnValue(null);

                handler.execute(defaultParams, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);
                expect(ctx.evaluationContext.context[defaultResultVariable]).toBeNull();
                // --- Assert against mockLogger ---
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Stored result in "${defaultResultVariable}": null`));
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
                // --- Verify ctx logger not used ---
                expect(ctx.logger.debug).not.toHaveBeenCalled();
                expect(ctx.logger.warn).not.toHaveBeenCalled();
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });


            test('handles query failure (registry returns undefined), stores undefined, logs warning', () => {
                const ctx = buildMockExecutionContext({initialVar: 'exists'});
                mockSystemDataRegistry.query.mockReturnValue(undefined);

                handler.execute(defaultParams, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);
                expect(ctx.evaluationContext.context).toHaveProperty(defaultResultVariable, undefined);
                expect(ctx.evaluationContext.context['initialVar']).toBe('exists');

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

            // ##### Test Block Corrected #####
            test('handles query error (registry throws), stores undefined, logs error', () => {
                const ctx = buildMockExecutionContext({initialVar: 'exists'});
                const queryError = new Error('Database connection failed');
                mockSystemDataRegistry.query.mockImplementation(() => {
                    throw queryError;
                });

                handler.execute(defaultParams, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);
                expect(ctx.evaluationContext.context).toHaveProperty(defaultResultVariable, undefined);
                expect(ctx.evaluationContext.context['initialVar']).toBe('exists');

                // --- Assert against mockLogger ---
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Attempting to query source "${defaultSourceId}"`));

                // --- Assert Error Log Call ---
                // *** CORRECTED VARIABLE IN STRING ***
                // Check the error message logged when the registry.query throws
                expect(mockLogger.error).toHaveBeenCalledWith(
                    `QUERY_SYSTEM_DATA: Error occurred while executing query on source "${defaultSourceId}". Storing 'undefined' in "${defaultResultVariable}".`, // Use defaultResultVariable here
                    expect.objectContaining({ // Check the payload details
                        sourceId: defaultSourceId, // Expect trimmed source ID (which is defaultSourceId here)
                        queryDetails: defaultQueryDetails, // Expect original query details
                        resultVariable: defaultResultVariable, // Expect trimmed result variable (which is defaultResultVariable here)
                        error: queryError.message, // Expect the error message
                    })
                );

                // --- Assert Final Warning Log Call ---
                // Check the warning message logged after handling the error (since result is undefined)
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    `QUERY_SYSTEM_DATA: Query to source "${defaultSourceId}" failed or returned no result. Stored 'undefined' in "${defaultResultVariable}".`
                );

                // --- Assert Absence of Success Log ---
                expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Successfully queried source'));

                // --- Verify ctx logger not used ---
                expect(ctx.logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Successfully queried source'));
                expect(ctx.logger.warn).not.toHaveBeenCalled();
                expect(ctx.logger.error).not.toHaveBeenCalled();
            });
            // ##### End Corrected Test Block #####


            test('trims whitespace from source_id and result_variable', () => {
                const ctx = buildMockExecutionContext();
                const paramsWithWhitespace = {
                    source_id: `  ${defaultSourceId}  `,
                    query_details: defaultQueryDetails,
                    result_variable: `  ${defaultResultVariable}  `,
                };
                mockSystemDataRegistry.query.mockReturnValue(successResult);

                handler.execute(paramsWithWhitespace, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails); // Trimmed source_id used
                expect(ctx.evaluationContext.context).toHaveProperty(defaultResultVariable, successResult); // Trimmed result_variable used
                expect(ctx.evaluationContext.context).not.toHaveProperty(`  ${defaultResultVariable}  `);

                // --- Assert against mockLogger ---
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`query source "${defaultSourceId}"`));
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Stored result in "${defaultResultVariable}"`));
                // --- Verify ctx logger not used ---
                expect(ctx.logger.debug).not.toHaveBeenCalled();
            });

            // This test is now confirming the *absence* of using the context logger
            test('uses ONLY the constructor logger, ignoring any logger in execution context', () => {
                // Create a specific logger intended for the context (which should be ignored)
                const specificContextLogger = createMockLogger();
                // Pass it via the (now discouraged) second argument of buildMockExecutionContext
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


            test('handles non-stringifiable result during logging gracefully', () => {
                const ctx = buildMockExecutionContext();
                const circularResult = {};
                circularResult.myself = circularResult;
                mockSystemDataRegistry.query.mockReturnValue(circularResult);

                handler.execute(defaultParams, ctx);

                expect(mockSystemDataRegistry.query).toHaveBeenCalledWith(defaultSourceId, defaultQueryDetails);
                expect(ctx.evaluationContext.context[defaultResultVariable]).toBe(circularResult);

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
    });
});