// src/tests/logic/operationHandlers/setVariableHandler.test.js
// NO CHANGE NEEDED AT THE TOP

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach} from '@jest/globals';
import SetVariableHandler from '../../../logic/operationHandlers/setVariableHandler.js'; // Adjust path if needed
// resolvePath is NOT used by the handler itself anymore.

// --- Type-hints (for editors only) ------------------------------------------
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
// ** Use the correct type expected by the handler's execute method **
/** @typedef {import('../../../logic/defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../../logic/operationHandlers/setVariableHandler.js').SetVariableOperationParams} SetVariableOperationParams */

// --- Mock services ---------------------------------------------------------
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// --- Helper – ExecutionContext factory -------------------------------------
/**
 * Builds a mock ExecutionContext containing the nested evaluationContext
 * @param {object} [evaluationContextOverrides] - Properties to merge into the evaluationContext object.
 * @param {object} [rootContextOverrides] - Properties to merge into the root executionContext object (e.g., logger).
 * @returns {ExecutionContext}
 */
function buildCtx(evaluationContextOverrides = {}, rootContextOverrides = {}) {
    const baseEvaluationContext = {
        event: {
            type: 'TEST_EVENT',
            payload: {
                value: 123,
                nested: {key: 'event-payload-value'},
            },
        },
        actor: {
            id: 'actor-123',
            components: {
                'core:health': {current: 50, max: 100},
            }
        },
        target: null,
        context: { // Variables set by previous operations (or this one!)
            existingVar: 'pre-existing value',
            nested: {
                path: {
                    to: {value: 'deep context value'}
                }
            }
        },
        globals: {},
        entities: {},
    };

    // Use deep merge utility (or implement one if not available)
    // For simplicity, assuming a basic merge for overrides here. Replace with deep merge if needed.
    const mergeDeep = (target, source) => {
        for (const key of Object.keys(source)) {
            const targetValue = target[key];
            const sourceValue = source[key];
            if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
                if (!targetValue || typeof targetValue !== 'object' || Array.isArray(targetValue)) {
                    target[key] = {}; // Initialize target if not an object
                }
                mergeDeep(target[key], sourceValue);
            } else {
                // Use assign for non-objects or if target doesn't exist
                // Object.assign won't work correctly for deep merge, manual recursion needed
                // Simplified assignment here for brevity - ensure your real merge handles deep objects
                target[key] = sourceValue;
            }
        }
        return target;
    };

    // Create deep copies to avoid mutations
    const finalEvaluationContext = JSON.parse(JSON.stringify(baseEvaluationContext));
    // Apply overrides using a proper deep merge if necessary
    // Using Object.assign for simplicity here, adjust if deep merging of overrides is critical
    Object.assign(finalEvaluationContext, evaluationContextOverrides); // Shallow merge for demo


    const baseExecutionContext = {
        // logger: mockLogger, // Usually provided at handler creation, not here unless overriding
        services: { /* other services if needed */},
        evaluationContext: finalEvaluationContext, // The structure handler expects
        ...rootContextOverrides // Apply root level overrides (e.g., specific logger)
    };

    return baseExecutionContext;
}


// --- Test-suite ------------------------------------------------------------
describe('SetVariableHandler', () => {
    /** @type {SetVariableHandler} */
    let handler;

    beforeEach(() => {
        jest.clearAllMocks();
        // Create a new handler instance for each test with the default mock logger
        handler = new SetVariableHandler({logger: mockLogger});
        // No need to mock/restore resolvePath as it's not used by the handler
    });

    // --- Constructor Validation ----------------------------------------------
    describe('Constructor', () => {
        test('throws if logger dependency is missing or invalid', () => {
            expect(() => new SetVariableHandler({})).toThrow(/ILogger instance/);
            expect(() => new SetVariableHandler({logger: null})).toThrow(/ILogger instance/);
            expect(() => new SetVariableHandler({logger: {info: jest.fn()}})).toThrow(/ILogger instance/); // Missing methods
        });

        test('initializes successfully with a valid logger', () => {
            expect(() => new SetVariableHandler({logger: mockLogger})).not.toThrow();
            expect(mockLogger.debug).toHaveBeenCalledWith('SetVariableHandler initialized.');
        });
    });

    // --- Parameter Validation (`execute`) ------------------------------------
    describe('Parameter Validation', () => {
        const baseExecCtx = buildCtx(); // Build the full ExecutionContext

        test.each([
            ['null params', null, 'SET_VARIABLE: Missing or invalid parameters object.', {params: null}],
            ['undefined params', undefined, 'SET_VARIABLE: Missing or invalid parameters object.', {params: undefined}],
            ['non-object params', 'string', 'SET_VARIABLE: Missing or invalid parameters object.', {params: 'string'}],
            // Destructuring [] results in undefined for variable_name/value, triggers variable_name check
            ['array params', [], 'SET_VARIABLE: Invalid or missing "variable_name" parameter. Must be a non-empty string.', {variable_name: undefined}],
        ])('logs error and returns if params object is invalid (%s)', (desc, invalidParams, expectedErrorMsg, expectedErrorObj) => {
            const execCtx = buildCtx(); // Get a fresh context
            const initialContextState = JSON.stringify(execCtx.evaluationContext.context); // Store initial state
            handler.execute(invalidParams, execCtx);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, expectedErrorObj);
            // Ensure the nested evaluationContext.context remains unchanged
            expect(JSON.stringify(execCtx.evaluationContext.context)).toEqual(initialContextState);
        });


        test.each([
            ['missing', {value: 1}],
            ['null', {value: 1, variable_name: null}],
            ['undefined', {value: 1, variable_name: undefined}],
            ['empty string', {value: 1, variable_name: ''}],
            ['whitespace string', {value: 1, variable_name: '   '}],
            ['non-string', {value: 1, variable_name: 123}],
        ])('logs error and returns if "variable_name" is invalid (%s)', (desc, params) => {
            const execCtx = buildCtx();
            const initialContextState = JSON.stringify(execCtx.evaluationContext.context);
            handler.execute(params, execCtx);
            expect(mockLogger.error).toHaveBeenCalledWith('SET_VARIABLE: Invalid or missing "variable_name" parameter. Must be a non-empty string.', {variable_name: params.variable_name});
            expect(JSON.stringify(execCtx.evaluationContext.context)).toEqual(initialContextState);
        });

        // --- UPDATED TEST for received undefined value ---
        test('logs error and returns if resolved "value" is undefined', () => {
            // Simulate the interpreter passing undefined after failing to resolve a placeholder
            const params = {variable_name: 'myVar', value: undefined};
            const execCtx = buildCtx();
            const initialContextState = JSON.stringify(execCtx.evaluationContext.context);
            handler.execute(params, execCtx);
            // Expect the NEW error message for receiving undefined
            expect(mockLogger.error).toHaveBeenCalledWith(
                'SET_VARIABLE: Resolved "value" is undefined for variable "myVar". Assignment skipped. Check placeholder resolution.',
                {params} // The handler logs the original params object
            );
            expect(JSON.stringify(execCtx.evaluationContext.context)).toEqual(initialContextState); // Context unchanged
        });

        // --- UPDATED TESTS for allowed 'falsy' values ---
        test('does NOT log error if "value" is null', () => {
            const params = {variable_name: 'myVar', value: null};
            const execCtx = buildCtx();
            handler.execute(params, execCtx);
            // Ensure NO error was logged for this valid value
            expect(mockLogger.error).not.toHaveBeenCalled();
            // Verify assignment happened correctly
            expect(execCtx.evaluationContext.context['myVar']).toBeNull();
        });

        test('does NOT log error if "value" is false', () => {
            const params = {variable_name: 'myVar', value: false};
            const execCtx = buildCtx();
            handler.execute(params, execCtx);
            // Ensure NO error was logged
            expect(mockLogger.error).not.toHaveBeenCalled();
            // Verify assignment
            expect(execCtx.evaluationContext.context['myVar']).toBe(false);
        });

        test('does NOT log error if "value" is 0', () => {
            const params = {variable_name: 'myVar', value: 0};
            const execCtx = buildCtx();
            handler.execute(params, execCtx);
            // Ensure NO error was logged
            expect(mockLogger.error).not.toHaveBeenCalled();
            // Verify assignment
            expect(execCtx.evaluationContext.context['myVar']).toBe(0);
        });
    });

    // --- Execution Context Validation (`execute`) ----------------------------
    describe('Execution Context Validation', () => {
        const validParams = {variable_name: 'v', value: 1}; // Value is pre-resolved

        // Test cases with invalid overall ExecutionContext or nested structures
        const invalidContextTestCases = [
            ['null executionContext', null],
            ['undefined executionContext', undefined],
            ['executionContext without evaluationContext', {}],
            ['executionContext with null evaluationContext', {evaluationContext: null}],
            ['evaluationContext without context property', {evaluationContext: {}}],
            ['evaluationContext with null context property', {evaluationContext: {context: null}}],
            ['evaluationContext with non-object context property', {evaluationContext: {context: 'string'}}],
        ];

        test.each(invalidContextTestCases)('logs error and returns if execution context structure is invalid (%s)', (desc, invalidExecCtx) => {
            handler.execute(validParams, invalidExecCtx);

            // Check which specific error message should be logged based on the invalid context
            // The handler checks `executionContext?.evaluationContext?.context`
            if (!invalidExecCtx?.evaluationContext?.context) {
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'SET_VARIABLE: executionContext.evaluationContext.context is missing or invalid. Cannot store variable.',
                    // The handler logs the received executionContext object
                    expect.objectContaining({executionContext: invalidExecCtx})
                );
            } else {
                // This case should ideally not be hit by the logic, but acts as a fallback assertion
                // If context *was* valid, no error should be logged regarding context structure.
                expect(mockLogger.error).not.toHaveBeenCalledWith(
                    expect.stringContaining('executionContext.evaluationContext.context is missing or invalid')
                );
            }
        });

        test('logs error and returns if executionContext is not an object', () => {
            const invalidExecCtx = 'not an object';
            handler.execute(validParams, invalidExecCtx);
            // This triggers the check for evaluationContext.context failing due to invalid root context
            expect(mockLogger.error).toHaveBeenCalledWith(
                'SET_VARIABLE: executionContext.evaluationContext.context is missing or invalid. Cannot store variable.',
                expect.objectContaining({executionContext: invalidExecCtx})
            );
        });
    });


    // --- Value Setting (Handler receives resolved values) ---------------------
    describe('Value Assignment', () => {
        test('sets literal string value', () => {
            const params = {variable_name: 'message', value: 'Hello World'}; // Value is pre-resolved
            const execCtx = buildCtx();
            handler.execute(params, execCtx);
            expect(execCtx.evaluationContext.context['message']).toBe('Hello World');
            // --- UPDATED LOG EXPECTATION ---
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "message" to resolved value: "Hello World"');
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        test('sets literal number value', () => {
            const params = {variable_name: 'count', value: 42};
            const execCtx = buildCtx();
            handler.execute(params, execCtx);
            expect(execCtx.evaluationContext.context['count']).toBe(42);
            // --- UPDATED LOG EXPECTATION ---
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "count" to resolved value: 42');
        });

        test('sets literal boolean value (true)', () => {
            const params = {variable_name: 'isActive', value: true};
            const execCtx = buildCtx();
            handler.execute(params, execCtx);
            expect(execCtx.evaluationContext.context['isActive']).toBe(true);
            // --- UPDATED LOG EXPECTATION ---
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "isActive" to resolved value: true');
        });

        test('sets literal boolean value (false)', () => {
            const params = {variable_name: 'isDisabled', value: false};
            const execCtx = buildCtx();
            handler.execute(params, execCtx);
            expect(execCtx.evaluationContext.context['isDisabled']).toBe(false);
            // --- UPDATED LOG EXPECTATION ---
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "isDisabled" to resolved value: false');
        });

        test('sets literal null value', () => {
            const params = {variable_name: 'optionalData', value: null};
            const execCtx = buildCtx();
            handler.execute(params, execCtx);
            expect(execCtx.evaluationContext.context['optionalData']).toBeNull();
            // --- UPDATED LOG EXPECTATION ---
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "optionalData" to resolved value: null');
        });

        test('sets literal object value', () => {
            const objValue = {key: 'value', nested: {num: 1}};
            const params = {variable_name: 'config', value: objValue}; // Assume already resolved to this object
            const execCtx = buildCtx();
            handler.execute(params, execCtx);
            expect(execCtx.evaluationContext.context['config']).toEqual(objValue); // Use toEqual for objects/arrays
            // --- UPDATED LOG EXPECTATION ---
            expect(mockLogger.info).toHaveBeenCalledWith(`SET_VARIABLE: Setting context variable "config" to resolved value: ${JSON.stringify(objValue)}`);
        });

        test('sets literal array value', () => {
            const arrValue = [1, 'two', true, null];
            const params = {variable_name: 'items', value: arrValue}; // Assume already resolved
            const execCtx = buildCtx();
            handler.execute(params, execCtx);
            expect(execCtx.evaluationContext.context['items']).toEqual(arrValue);
            // --- UPDATED LOG EXPECTATION ---
            expect(mockLogger.info).toHaveBeenCalledWith(`SET_VARIABLE: Setting context variable "items" to resolved value: ${JSON.stringify(arrValue)}`);
        });

        test('trims whitespace from variable_name before setting', () => {
            const params = {variable_name: '  paddedVar  ', value: 'trimmed'};
            const execCtx = buildCtx();
            handler.execute(params, execCtx);
            expect(execCtx.evaluationContext.context).toHaveProperty('paddedVar');
            expect(execCtx.evaluationContext.context['paddedVar']).toBe('trimmed');
            expect(execCtx.evaluationContext.context).not.toHaveProperty('  paddedVar  ');
            // --- UPDATED LOG EXPECTATION (uses trimmed name) ---
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "paddedVar" to resolved value: "trimmed"');
        });

        test('overwrites existing variable', () => {
            const params = {variable_name: 'existingVar', value: 'new value'}; // Overwrite 'pre-existing value'
            const execCtx = buildCtx();
            expect(execCtx.evaluationContext.context['existingVar']).toBe('pre-existing value'); // Verify initial state
            handler.execute(params, execCtx);
            expect(execCtx.evaluationContext.context['existingVar']).toBe('new value'); // Verify overwritten value
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "existingVar" to resolved value: "new value"');
        });
    });

    // --- REMOVED OBSOLETE TEST BLOCKS ---
    // describe('Placeholder Resolution ($)' ... removed ...
    // describe('Unresolved Placeholder Handling' ... removed ...
    // describe('Edge Cases and resolvePath Errors' ... removed ...


    // --- Context Logger Precedence (If handler checked context for logger) ---
    // This functionality wasn't present in the provided handler code (it uses constructor logger only)
    // describe('Context Logger Usage', () => { ... }); // Keep commented out or remove if not applicable

});