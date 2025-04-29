// src/tests/logic/operationHandlers/setVariableHandler.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach} from '@jest/globals';
import SetVariableHandler from '../../../logic/operationHandlers/setVariableHandler.js'; // Adjust path if needed
// resolvePath is NOT used by the handler itself anymore.

// --- Type-hints (for editors only) ------------------------------------------
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
// *** CORRECTED ExecutionContext typedef to match handler's actual usage and test setup ***
/**
 * Represents the overall execution environment for an operation.
 * The handler now expects a 'context' property directly on this object.
 * @typedef {object} ExecutionContext
 * @property {object} context - The shared context object for storing/retrieving variables.
 * @property {any} [event] - Optional event details.
 * @property {any} [actor] - Optional actor details.
 * @property {any} [target] - Optional target details.
 * @property {any} [globals] - Optional globals.
 * @property {any} [entities] - Optional entities.
 * @property {any} [services] - Optional services container.
 * @property {ILogger} [logger] - DEPRECATED logger on context.
 */
/** @typedef {import('../../../logic/operationHandlers/setVariableHandler.js').SetVariableOperationParams} SetVariableOperationParams */

// --- Mock services ---------------------------------------------------------
// Use a fresh mock for each test suite run potentially
const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

// --- Helper – ExecutionContext factory -------------------------------------
// *** CORRECTED Mock Builder to match handler's expectation of executionContext.context ***
/**
 * Builds a mock ExecutionContext with the 'context' property at the top level.
 * Includes other common properties found in evaluation context for potential use.
 * @param {object} [contextDataOverrides={}] - Properties to merge into the top-level 'context' object.
 * @param {object} [otherOverrides={}] - Properties to merge into the root executionContext object (e.g., event, actor, logger).
 * @returns {ExecutionContext}
 */
function buildCtx(contextDataOverrides = {}, otherOverrides = {}) {
    // Base context structure - simplified, add more if needed by tests
    const baseContextData = {
        existingVar: 'pre-existing value',
        nested: {
            path: {
                to: {value: 'deep context value'}
            }
        }
    };

    // Deep merge utility (simple implementation for demonstration)
    const mergeDeep = (target, source) => {
        const output = Object.assign({}, target); // Shallow copy target
        if (isObject(target) && isObject(source)) {
            Object.keys(source).forEach(key => {
                if (isObject(source[key])) {
                    if (!(key in target))
                        Object.assign(output, {[key]: source[key]});
                    else
                        output[key] = mergeDeep(target[key], source[key]);
                } else {
                    Object.assign(output, {[key]: source[key]});
                }
            });
        }
        return output;
    };

    const isObject = (item) => {
        return (item && typeof item === 'object' && !Array.isArray(item));
    };

    // Create final context data with overrides
    const finalContextData = mergeDeep(baseContextData, contextDataOverrides);

    // Base execution context structure
    const baseExecutionContext = {
        context: finalContextData, // Context is now top-level
        event: {
            type: 'TEST_EVENT',
            payload: {value: 123, nested: {key: 'event-payload-value'}},
        },
        actor: {
            id: 'actor-123',
            components: {'core:health': {current: 50, max: 100}}
        },
        target: null,
        globals: {},
        entities: {},
        services: { /* other services if needed */},
        // logger: createMockLogger(), // Usually provided at handler creation
    };

    // Apply root level overrides
    return mergeDeep(baseExecutionContext, otherOverrides);
}


// --- Test-suite ------------------------------------------------------------
describe('SetVariableHandler', () => {
    /** @type {SetVariableHandler} */
    let handler;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger; // Use a per-test fresh logger

    beforeEach(() => {
        jest.clearAllMocks();
        mockLogger = createMockLogger(); // Create fresh mock logger
        // Create a new handler instance for each test with the fresh mock logger
        handler = new SetVariableHandler({logger: mockLogger});
        // Clear the constructor log if needed (it logs debug on init)
        mockLogger.debug.mockClear();
    });

    // --- Constructor Validation ----------------------------------------------
    describe('Constructor', () => {
        test('throws if logger dependency is missing or invalid', () => {
            expect(() => new SetVariableHandler({})).toThrow(/ILogger instance/);
            expect(() => new SetVariableHandler({logger: null})).toThrow(/ILogger instance/);
            // Pass a valid mock logger to test *other* dependencies if they existed
            expect(() => new SetVariableHandler({logger: {info: jest.fn()}})).toThrow(/ILogger instance/); // Missing methods
        });

        test('initializes successfully with a valid logger', () => {
            // Reset mocks just before this specific test's constructor call if needed
            const freshLogger = createMockLogger();
            expect(() => new SetVariableHandler({logger: freshLogger})).not.toThrow();
            expect(freshLogger.debug).toHaveBeenCalledWith('SetVariableHandler initialized.');
        });
    });

    // --- Parameter Validation (`execute`) ------------------------------------
    describe('Parameter Validation', () => {
        // const baseExecCtx = buildCtx(); // Build the full ExecutionContext - now uses new structure

        test.each([
            ['null params', null, 'SET_VARIABLE: Missing or invalid parameters object.', {params: null}],
            ['undefined params', undefined, 'SET_VARIABLE: Missing or invalid parameters object.', {params: undefined}],
            ['non-object params', 'string', 'SET_VARIABLE: Missing or invalid parameters object.', {params: 'string'}],
            // Destructuring [] results in undefined for variable_name/value, triggers variable_name check
            ['array params', [], 'SET_VARIABLE: Invalid or missing "variable_name" parameter. Must be a non-empty string.', {variable_name: undefined}],
        ])('logs error and returns if params object is invalid (%s)', (desc, invalidParams, expectedErrorMsg, expectedErrorObj) => {
            const execCtx = buildCtx(); // Get a fresh context using the CORRECTED builder
            const initialContextState = JSON.stringify(execCtx.context); // Store initial state of the CORRECT context
            handler.execute(invalidParams, execCtx);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, expectedErrorObj);
            // Ensure the CORRECT context remains unchanged
            expect(JSON.stringify(execCtx.context)).toEqual(initialContextState);
        });


        test.each([
            ['missing', {value: 1}],
            ['null', {value: 1, variable_name: null}],
            ['undefined', {value: 1, variable_name: undefined}],
            ['empty string', {value: 1, variable_name: ''}],
            ['whitespace string', {value: 1, variable_name: '   '}],
            ['non-string', {value: 1, variable_name: 123}],
        ])('logs error and returns if "variable_name" is invalid (%s)', (desc, params) => {
            const execCtx = buildCtx(); // CORRECTED builder
            const initialContextState = JSON.stringify(execCtx.context); // CORRECT context path
            handler.execute(params, execCtx);
            expect(mockLogger.error).toHaveBeenCalledWith('SET_VARIABLE: Invalid or missing "variable_name" parameter. Must be a non-empty string.', {variable_name: params.variable_name});
            expect(JSON.stringify(execCtx.context)).toEqual(initialContextState); // CORRECT context path
        });

        // --- UPDATED TEST for received undefined value ---
        test('logs error and returns if resolved "value" is undefined', () => {
            // Simulate the interpreter passing undefined after failing to resolve a placeholder
            const params = {variable_name: 'myVar', value: undefined};
            const execCtx = buildCtx(); // CORRECTED builder
            const initialContextState = JSON.stringify(execCtx.context); // CORRECT context path
            handler.execute(params, execCtx);
            // Expect the error message for receiving undefined
            expect(mockLogger.error).toHaveBeenCalledWith(
                'SET_VARIABLE: Resolved "value" is undefined for variable "myVar". Assignment skipped. Check placeholder resolution.',
                {params} // The handler logs the original params object
            );
            expect(JSON.stringify(execCtx.context)).toEqual(initialContextState); // Context unchanged
        });

        // --- CORRECTED TESTS for allowed 'falsy' values ---
        // These failed before because context validation failed unexpectedly.
        test('does NOT log error if "value" is null', () => {
            const params = {variable_name: 'myVar', value: null};
            const execCtx = buildCtx(); // CORRECTED builder - context validation now passes
            handler.execute(params, execCtx);
            // --- ASSERTION FIX: Error should NOT be called ---
            expect(mockLogger.error).not.toHaveBeenCalled();
            // --- ASSERTION FIX: Verify assignment happened correctly in the right context ---
            expect(execCtx.context['myVar']).toBeNull();
        });

        test('does NOT log error if "value" is false', () => {
            const params = {variable_name: 'myVar', value: false};
            const execCtx = buildCtx(); // CORRECTED builder
            handler.execute(params, execCtx);
            // --- ASSERTION FIX: Error should NOT be called ---
            expect(mockLogger.error).not.toHaveBeenCalled();
            // --- ASSERTION FIX: Verify assignment in the right context ---
            expect(execCtx.context['myVar']).toBe(false);
        });

        test('does NOT log error if "value" is 0', () => {
            const params = {variable_name: 'myVar', value: 0};
            const execCtx = buildCtx(); // CORRECTED builder
            handler.execute(params, execCtx);
            // --- ASSERTION FIX: Error should NOT be called ---
            expect(mockLogger.error).not.toHaveBeenCalled();
            // --- ASSERTION FIX: Verify assignment in the right context ---
            expect(execCtx.context['myVar']).toBe(0);
        });
    });

    // --- Execution Context Validation (`execute`) ----------------------------
    // *** CORRECTED Execution Context Validation ***
    describe('Execution Context Validation', () => {
        const validParams = {variable_name: 'v', value: 1}; // Value is pre-resolved

        // Test cases targeting the new validation:
        // !executionContext || typeof executionContext.context !== 'object' || executionContext.context === null
        const invalidContextTestCases = [
            ['null executionContext', null],
            ['undefined executionContext', undefined],
            ['executionContext without context', {}], // context is undefined
            ['executionContext with null context', {context: null}], // context is null
            ['executionContext with non-object context', {context: 'string'}], // context is not an object
            // Test case where context is technically an object, but an array (should pass current validation)
            // ['executionContext with array context', { context: [] }], // This would PASS the current check
        ];

        test.each(invalidContextTestCases)('logs error and returns if execution context structure is invalid (%s)', (desc, invalidExecCtx) => {
            handler.execute(validParams, invalidExecCtx);

            // --- ASSERTION FIX: Expect the CORRECT error message ---
            expect(mockLogger.error).toHaveBeenCalledWith(
                'SET_VARIABLE: executionContext.context is missing or invalid. Cannot store variable.',
                // The handler logs the received executionContext object
                expect.objectContaining({executionContext: invalidExecCtx})
            );
        });

        // Keep this test as it's a valid edge case for the root object type
        test('logs error and returns if executionContext is not an object', () => {
            const invalidExecCtx = 'not an object';
            handler.execute(validParams, invalidExecCtx);
            // --- ASSERTION FIX: Expect the CORRECT error message ---
            // This fails the initial `!executionContext` check implicitly because typeof is not 'object'
            expect(mockLogger.error).toHaveBeenCalledWith(
                'SET_VARIABLE: executionContext.context is missing or invalid. Cannot store variable.',
                expect.objectContaining({executionContext: invalidExecCtx})
            );
        });
    });


    // --- Value Setting (Handler receives resolved values) ---------------------
    // *** CORRECTED Value Assignment Tests ***
    describe('Value Assignment', () => {
        test('sets literal string value', () => {
            const params = {variable_name: 'message', value: 'Hello World'}; // Value is pre-resolved
            const execCtx = buildCtx(); // CORRECTED builder
            handler.execute(params, execCtx);
            // --- ASSERTION FIX: Check correct context ---
            expect(execCtx.context['message']).toBe('Hello World');
            // --- ASSERTION FIX: Expect correct log message ---
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "message" to ORIGINAL value: "Hello World"');
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        test('sets literal number value', () => {
            const params = {variable_name: 'count', value: 42};
            const execCtx = buildCtx(); // CORRECTED builder
            handler.execute(params, execCtx);
            // --- ASSERTION FIX: Check correct context ---
            expect(execCtx.context['count']).toBe(42);
            // --- ASSERTION FIX: Expect correct log message ---
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "count" to ORIGINAL value: 42');
        });

        test('sets literal boolean value (true)', () => {
            const params = {variable_name: 'isActive', value: true};
            const execCtx = buildCtx(); // CORRECTED builder
            handler.execute(params, execCtx);
            // --- ASSERTION FIX: Check correct context ---
            expect(execCtx.context['isActive']).toBe(true);
            // --- ASSERTION FIX: Expect correct log message ---
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "isActive" to ORIGINAL value: true');
        });

        test('sets literal boolean value (false)', () => {
            const params = {variable_name: 'isDisabled', value: false};
            const execCtx = buildCtx(); // CORRECTED builder
            handler.execute(params, execCtx);
            // --- ASSERTION FIX: Check correct context ---
            expect(execCtx.context['isDisabled']).toBe(false);
            // --- ASSERTION FIX: Expect correct log message ---
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "isDisabled" to ORIGINAL value: false');
        });

        test('sets literal null value', () => {
            const params = {variable_name: 'optionalData', value: null};
            const execCtx = buildCtx(); // CORRECTED builder
            handler.execute(params, execCtx);
            // --- ASSERTION FIX: Check correct context ---
            expect(execCtx.context['optionalData']).toBeNull();
            // --- ASSERTION FIX: Expect correct log message ---
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "optionalData" to ORIGINAL value: null');
        });

        test('sets literal object value', () => {
            const objValue = {key: 'value', nested: {num: 1}};
            const params = {variable_name: 'config', value: objValue}; // Assume already resolved to this object
            const execCtx = buildCtx(); // CORRECTED builder
            handler.execute(params, execCtx);
            // --- ASSERTION FIX: Check correct context ---
            expect(execCtx.context['config']).toEqual(objValue); // Use toEqual for objects/arrays
            // --- ASSERTION FIX: Expect correct log message ---
            expect(mockLogger.info).toHaveBeenCalledWith(`SET_VARIABLE: Setting context variable "config" to ORIGINAL value: ${JSON.stringify(objValue)}`);
        });

        test('sets literal array value', () => {
            const arrValue = [1, 'two', true, null];
            const params = {variable_name: 'items', value: arrValue}; // Assume already resolved
            const execCtx = buildCtx(); // CORRECTED builder
            handler.execute(params, execCtx);
            // --- ASSERTION FIX: Check correct context ---
            expect(execCtx.context['items']).toEqual(arrValue);
            // --- ASSERTION FIX: Expect correct log message ---
            expect(mockLogger.info).toHaveBeenCalledWith(`SET_VARIABLE: Setting context variable "items" to ORIGINAL value: ${JSON.stringify(arrValue)}`);
        });

        test('trims whitespace from variable_name before setting', () => {
            const params = {variable_name: '  paddedVar  ', value: 'trimmed'};
            const execCtx = buildCtx(); // CORRECTED builder
            handler.execute(params, execCtx);
            // --- ASSERTION FIX: Check correct context properties ---
            expect(execCtx.context).toHaveProperty('paddedVar');
            expect(execCtx.context['paddedVar']).toBe('trimmed');
            expect(execCtx.context).not.toHaveProperty('  paddedVar  ');
            // --- ASSERTION FIX: Expect correct log message (uses trimmed name) ---
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "paddedVar" to ORIGINAL value: "trimmed"');
        });

        test('overwrites existing variable', () => {
            const params = {variable_name: 'existingVar', value: 'new value'}; // Overwrite 'pre-existing value'
            const execCtx = buildCtx(); // CORRECTED builder
            // --- ASSERTION FIX: Check correct context for initial state ---
            expect(execCtx.context['existingVar']).toBe('pre-existing value'); // Verify initial state
            handler.execute(params, execCtx);
            // --- ASSERTION FIX: Check correct context for overwritten value ---
            expect(execCtx.context['existingVar']).toBe('new value'); // Verify overwritten value
            // --- ASSERTION FIX: Expect correct log message ---
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "existingVar" to ORIGINAL value: "new value"');
        });
    });

    // Removed obsolete test blocks related to placeholder resolution as per user file

});