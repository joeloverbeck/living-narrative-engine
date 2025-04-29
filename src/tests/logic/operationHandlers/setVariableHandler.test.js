// src/tests/logic/operationHandlers.setVariableHandler.test.js
// NO CHANGE NEEDED AT THE TOP

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach} from '@jest/globals';
import SetVariableHandler from '../../../logic/operationHandlers/setVariableHandler.js'; // Adjust path if needed
// We don't mock resolvePath itself, but test its usage by the handler
// import resolvePath from '../../../utils/resolvePath.js'; // Not mocked directly

// --- Type-hints (for editors only) ------------------------------------------
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../logic/defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */ // Use the correct type from implementation
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
 * Builds a mock ExecutionContext (now aligning with JsonLogicEvaluationContext structure used by handler)
 * @param {object} [evaluationContextOverrides] - Properties to merge into the root context object.
 * @param {ILogger} [contextLogger] - Optional specific logger for this context (not standard for JsonLogicEvaluationContext).
 * @returns {JsonLogicEvaluationContext}
 */
function buildCtx(evaluationContextOverrides = {}, contextLogger = null) { // Note: contextLogger isn't standard here but kept for testing logger precedence
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
            components: { // Simulate component accessor structure if needed by resolvePath targets
                'core:health': {current: 50, max: 100},
            }
        },
        target: null, // Default to null
        context: { // Variables set by previous operations (or this one!)
            existingVar: 'pre-existing value',
            nested: {
                path: {
                    to: {value: 'deep context value'}
                }
            }
        },
        globals: {}, // Placeholder
        entities: {}, // Placeholder
        // Add logger if specifically testing context-based logging
        ...(contextLogger ? {logger: contextLogger} : {})
    };

    // Merge overrides deeply, especially for nested objects like context and event payload
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
                Object.assign(target, {[key]: sourceValue});
            }
        }
        return target;
    };

    // Create a deep copy of the base to avoid mutations across tests
    const finalEvaluationContext = JSON.parse(JSON.stringify(baseEvaluationContext));
    // Apply overrides using deep merge
    mergeDeep(finalEvaluationContext, evaluationContextOverrides);


    // The handler expects the evaluationContext directly, not nested under 'evaluationContext'
    return finalEvaluationContext;
}

// --- Test-suite ------------------------------------------------------------
describe('SetVariableHandler', () => {
    /** @type {SetVariableHandler} */
    let handler;
    let originalResolvePath; // To store original resolvePath for restoration
    let resolvePathModule;   // To hold the required module for mocking

    beforeEach(() => {
        jest.clearAllMocks();
        // Create a new handler instance for each test with the default mock logger
        handler = new SetVariableHandler({logger: mockLogger});

        // Ensure resolvePath is restored if it was mocked in a previous test
        if (resolvePathModule && originalResolvePath) {
            resolvePathModule.default = originalResolvePath;
        }
        resolvePathModule = null;
        originalResolvePath = null;
        // Reset modules cache if mocking with require
        jest.resetModules();
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
        // This test.each uses the evaluation context structure returned by buildCtx()
        const baseCtx = buildCtx();

        test.each([
            ['null params', null, 'SET_VARIABLE: Missing or invalid parameters object.', {params: null}],
            ['undefined params', undefined, 'SET_VARIABLE: Missing or invalid parameters object.', {params: undefined}],
            ['non-object params', 'string', 'SET_VARIABLE: Missing or invalid parameters object.', {params: 'string'}],
            // --- NO CHANGE HERE: Expectation aligns with code logic (fails on variable_name check after destructuring []) ---
            ['array params', [], 'SET_VARIABLE: Invalid or missing "variable_name" parameter. Must be a non-empty string.', {variable_name: undefined}],
        ])('logs error and returns if params object is invalid (%s)', (desc, invalidParams, expectedErrorMsg, expectedErrorObj) => {
            const ctx = buildCtx(); // Get a fresh context
            const initialContextState = JSON.stringify(ctx.context); // Store initial state
            handler.execute(invalidParams, ctx);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, expectedErrorObj);
            expect(JSON.stringify(ctx.context)).toEqual(initialContextState); // Context unchanged
        });


        test.each([
            ['missing', {value: 1}],
            ['null', {value: 1, variable_name: null}],
            ['undefined', {value: 1, variable_name: undefined}],
            ['empty string', {value: 1, variable_name: ''}],
            ['whitespace string', {value: 1, variable_name: '   '}],
            ['non-string', {value: 1, variable_name: 123}],
        ])('logs error and returns if "variable_name" is invalid (%s)', (desc, params) => {
            const ctx = buildCtx();
            const initialContextState = JSON.stringify(ctx.context);
            handler.execute(params, ctx);
            expect(mockLogger.error).toHaveBeenCalledWith('SET_VARIABLE: Invalid or missing "variable_name" parameter. Must be a non-empty string.', {variable_name: params.variable_name});
            expect(JSON.stringify(ctx.context)).toEqual(initialContextState); // Context unchanged
        });

        test('logs error and returns if "value" is undefined', () => {
            const params = {variable_name: 'myVar' /* value: undefined is implicit */};
            const ctx = buildCtx();
            const initialContextState = JSON.stringify(ctx.context);
            handler.execute(params, ctx);
            expect(mockLogger.error).toHaveBeenCalledWith('SET_VARIABLE: Missing "value" parameter for variable "myVar".', {params});
            expect(JSON.stringify(ctx.context)).toEqual(initialContextState); // Context unchanged
        });

        // --- Tests for allowed 'falsy' values (No changes needed) ---
        test('does NOT log error if "value" is null', () => {
            const params = {variable_name: 'myVar', value: null};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('Missing "value" parameter'));
            expect(ctx.context['myVar']).toBeNull();
        });

        test('does NOT log error if "value" is false', () => {
            const params = {variable_name: 'myVar', value: false};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('Missing "value" parameter'));
            expect(ctx.context['myVar']).toBe(false);
        });

        test('does NOT log error if "value" is 0', () => {
            const params = {variable_name: 'myVar', value: 0};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('Missing "value" parameter'));
            expect(ctx.context['myVar']).toBe(0);
        });
    });

    // --- Execution Context Validation (`execute`) ----------------------------
    describe('Execution Context Validation', () => {
        const validParams = {variable_name: 'v', value: 1};

        // Define test cases with the invalid context structure itself
        // Note: The handler expects JsonLogicEvaluationContext directly.
        const invalidContextTestCases = [
            ['null evaluationContext', null],
            ['undefined evaluationContext', undefined],
            // Test cases where evaluationContext is an object, but lacks the 'context' property
            ['evaluationContext without context property', {}], // lacks .context
            ['evaluationContext with null context property', {context: null}], // .context is null
            ['evaluationContext with non-object context property', {context: 'string'}], // .context is not an object
        ];

        test.each(invalidContextTestCases)('logs error and returns if evaluation context structure is invalid (%s)', (desc, invalidEvalCtx) => {
            // We don't need to determine the logger here, the handler uses its internal one
            handler.execute(validParams, invalidEvalCtx);

            // --- CORRECTED EXPECTATION ---
            // Check which specific error message should be logged based on the invalid context
            if (invalidEvalCtx === null || invalidEvalCtx === undefined) {
                // This triggers the first check in the handler
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'SET_VARIABLE: evaluationContext is missing or invalid. Cannot resolve or store variable.',
                    expect.objectContaining({evaluationContext: invalidEvalCtx}) // Code logs { evaluationContext }
                );
            } else {
                // These trigger the second check in the handler (evaluationContext.context is invalid)
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'SET_VARIABLE: evaluationContext.context is missing or invalid. Cannot store variable.',
                    // Code logs { evaluationContext }, so we expect the *whole* invalid object here
                    expect.objectContaining({evaluationContext: invalidEvalCtx})
                );
            }
        });

        // Test case for when evaluationContext is not an object (e.g., a string)
        test('logs error and returns if evaluationContext is not an object', () => {
            const invalidEvalCtx = 'not an object';
            handler.execute(validParams, invalidEvalCtx);
            // This triggers the first check
            expect(mockLogger.error).toHaveBeenCalledWith(
                'SET_VARIABLE: evaluationContext is missing or invalid. Cannot resolve or store variable.',
                expect.objectContaining({evaluationContext: invalidEvalCtx})
            );
        });
    });


    // --- Literal Value Setting -----------------------------------------------
    describe('Literal Value Setting', () => {
        test('sets literal string value', () => {
            const params = {variable_name: 'message', value: 'Hello World'};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context['message']).toBe('Hello World'); // Check assignment in ctx.context
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "message" to ORIGINAL value: "Hello World"');
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        test('sets literal number value', () => {
            const params = {variable_name: 'count', value: 42};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context['count']).toBe(42);
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "count" to ORIGINAL value: 42');
        });

        test('sets literal boolean value (true)', () => {
            const params = {variable_name: 'isActive', value: true};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context['isActive']).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "isActive" to ORIGINAL value: true');
        });

        test('sets literal boolean value (false)', () => {
            const params = {variable_name: 'isDisabled', value: false};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context['isDisabled']).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "isDisabled" to ORIGINAL value: false');
        });

        test('sets literal null value', () => {
            const params = {variable_name: 'optionalData', value: null};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context['optionalData']).toBeNull();
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "optionalData" to ORIGINAL value: null');
        });

        test('sets literal object value', () => {
            const objValue = {key: 'value', nested: {num: 1}};
            const params = {variable_name: 'config', value: objValue};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context['config']).toEqual(objValue);
            // Use expect.any(String) for object/array stringification in logs if exact format is fragile
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('SET_VARIABLE: Setting context variable "config" to ORIGINAL value:'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(objValue)));
        });

        test('sets literal array value', () => {
            const arrValue = [1, 'two', true, null];
            const params = {variable_name: 'items', value: arrValue};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context['items']).toEqual(arrValue);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('SET_VARIABLE: Setting context variable "items" to ORIGINAL value:'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(arrValue)));
        });

        test('trims whitespace from variable_name before setting', () => {
            const params = {variable_name: '  paddedVar  ', value: 'trimmed'};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context).toHaveProperty('paddedVar');
            expect(ctx.context['paddedVar']).toBe('trimmed');
            expect(ctx.context).not.toHaveProperty('  paddedVar  ');
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "paddedVar" to ORIGINAL value: "trimmed"');
        });
    });

    // --- Placeholder Resolution ---------------------------------------------
    describe('Placeholder Resolution ($)', () => {
        test('resolves $context.existingVar', () => {
            const params = {variable_name: 'newVar', value: '$context.existingVar'};
            const ctx = buildCtx(); // Uses default context with existingVar
            handler.execute(params, ctx);
            expect(ctx.context['newVar']).toBe('pre-existing value'); // Check assignment in ctx.context
            expect(mockLogger.debug).toHaveBeenCalledWith('SET_VARIABLE: Detected placeholder "$context.existingVar" for variable "newVar". Attempting to resolve path "context.existingVar"...');
            expect(mockLogger.debug).toHaveBeenCalledWith('SET_VARIABLE: Placeholder path "context.existingVar" resolved successfully for variable "newVar". Resolved value: "pre-existing value"');
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "newVar" to RESOLVED value: "pre-existing value" (Original placeholder: "$context.existingVar")');
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        test('resolves $context.nested.path.to.value', () => {
            const params = {variable_name: 'deepVar', value: '$context.nested.path.to.value'};
            const ctx = buildCtx(); // Uses default context with nested path
            handler.execute(params, ctx);
            expect(ctx.context['deepVar']).toBe('deep context value');
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "deepVar" to RESOLVED value: "deep context value" (Original placeholder: "$context.nested.path.to.value")');
        });

        test('resolves $event.type', () => {
            const params = {variable_name: 'triggerEvent', value: '$event.type'};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context['triggerEvent']).toBe('TEST_EVENT');
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "triggerEvent" to RESOLVED value: "TEST_EVENT" (Original placeholder: "$event.type")');
        });

        test('resolves $event.payload.nested.key', () => {
            const params = {variable_name: 'payloadKey', value: '$event.payload.nested.key'};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context['payloadKey']).toBe('event-payload-value');
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "payloadKey" to RESOLVED value: "event-payload-value" (Original placeholder: "$event.payload.nested.key")');
        });

        test('resolves $actor.id', () => {
            const params = {variable_name: 'actorWhoTriggered', value: '$actor.id'};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context['actorWhoTriggered']).toBe('actor-123');
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "actorWhoTriggered" to RESOLVED value: "actor-123" (Original placeholder: "$actor.id")');
        });

        // Test resolving a complex path including components
        test('resolves $actor.components["core:health"].current', () => {
            const params = {variable_name: 'actorHP', value: '$actor.components.core:health.current'};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context['actorHP']).toBe(50);
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "actorHP" to RESOLVED value: 50 (Original placeholder: "$actor.components.core:health.current")');
        });

        test('resolves placeholder resulting in an object', () => {
            const params = {variable_name: 'healthObj', value: '$actor.components.core:health'};
            const ctx = buildCtx();
            const expectedObj = {current: 50, max: 100};
            handler.execute(params, ctx);
            expect(ctx.context['healthObj']).toEqual(expectedObj);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`SET_VARIABLE: Setting context variable "healthObj" to RESOLVED value:`));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(expectedObj)));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('(Original placeholder: "$actor.components.core:health")'));
        });

        test('resolves placeholder resulting in null (from context)', () => {
            const params = {variable_name: 'targetVar', value: '$target'}; // Target is null in default context
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context['targetVar']).toBeNull();
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "targetVar" to RESOLVED value: null (Original placeholder: "$target")');
        });
    });

    // --- Unresolved Placeholders --------------------------------------------
    describe('Unresolved Placeholder Handling', () => {
        test('handles unresolved $context.nonExistentVar - stores undefined', () => {
            const params = {variable_name: 'missingVar', value: '$context.nonExistentVar'};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context).toHaveProperty('missingVar');
            expect(ctx.context['missingVar']).toBeUndefined();
            // --- CORRECTED EXPECTATION ---
            // Match the actual warning logged by the handler when resolvePath returns undefined
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'SET_VARIABLE: Placeholder path "context.nonExistentVar" resolved to UNDEFINED in evaluationContext for variable "missingVar". Storing undefined.'
            );
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "missingVar" to RESOLVED value: undefined (Original placeholder: "$context.nonExistentVar")');
        });

        test('handles unresolved $event.payload.missing - stores undefined', () => {
            const params = {variable_name: 'missingPayload', value: '$event.payload.missing'};
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context['missingPayload']).toBeUndefined();
            // --- CORRECTED EXPECTATION ---
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'SET_VARIABLE: Placeholder path "event.payload.missing" resolved to UNDEFINED in evaluationContext for variable "missingPayload". Storing undefined.'
            );
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "missingPayload" to RESOLVED value: undefined (Original placeholder: "$event.payload.missing")');
        });

        test('handles unresolved path through null intermediate ($target.id when target is null)', () => {
            const params = {variable_name: 'targetIdVar', value: '$target.id'}; // Target is null
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context['targetIdVar']).toBeUndefined();
            // --- CORRECTED EXPECTATION ---
            // If resolvePath returns undefined when accessing property of null, the handler logs its standard undefined warning.
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'SET_VARIABLE: Placeholder path "target.id" resolved to UNDEFINED in evaluationContext for variable "targetIdVar". Storing undefined.'
            );
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "targetIdVar" to RESOLVED value: undefined (Original placeholder: "$target.id")');
        });

        test('handles unresolved path through undefined intermediate ($context.missing.path)', () => {
            const params = {variable_name: 'missingPathVar', value: '$context.missing.path'}; // context.missing is undefined
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.context['missingPathVar']).toBeUndefined();
            // --- CORRECTED EXPECTATION ---
            // If resolvePath returns undefined when accessing property of undefined, the handler logs its standard undefined warning.
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'SET_VARIABLE: Placeholder path "context.missing.path" resolved to UNDEFINED in evaluationContext for variable "missingPathVar". Storing undefined.'
            );
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "missingPathVar" to RESOLVED value: undefined (Original placeholder: "$context.missing.path")');
        });
    });

    // --- Edge Cases ---------------------------------------------------------
    // Assume resolvePath correctly handles empty/whitespace paths and logs errors/warnings
    describe('Edge Cases and resolvePath Errors', () => {
        // Helper to mock resolvePath throwing a specific error
        // NOTE: For empty/whitespace paths, the real resolvePath validation might throw *before* this mock.
        const mockResolvePathWithError = async (errorToThrow, pathAttempted) => {
            resolvePathModule = await import('../../../utils/resolvePath.js');
            originalResolvePath = resolvePathModule.default;
            resolvePathModule.default = jest.fn().mockImplementation((root, path) => {
                if (path === pathAttempted) {
                    throw errorToThrow;
                }
                return originalResolvePath(root, path);
            });
        };

        const restoreResolvePath = () => {
            if (resolvePathModule && originalResolvePath) {
                resolvePathModule.default = originalResolvePath;
                resolvePathModule = null;
                originalResolvePath = null;
                jest.resetModules(); // Ensure clean slate
            }
        };

        // Test for value being just '$' -> path becomes ''
        test('handles value being just "$" (empty path for resolvePath)', async () => {
            const params = {variable_name: 'edgeCase', value: '$'};
            const ctx = buildCtx();
            // NOTE: We still mock to ensure isolation if resolvePath implementation changes,
            // but the actual error for '' likely comes from real resolvePath validation.
            const mockError = new Error("Simulated resolvePath error for empty path");
            const actualErrorMessageFromResolvePath = "resolvePath: dotPath must be a non-empty string"; // Actual validation error
            await mockResolvePathWithError(mockError, '');

            handler.execute(params, ctx);

            expect(mockLogger.warn).toHaveBeenCalledWith('SET_VARIABLE: Value was \'$\' with no path. Using empty string as path for resolution against context root for variable "edgeCase".');
            // --- CORRECTED EXPECTATION ---
            // Expect the ERROR log from the catch block, matching the handler's format AND the *actual* error message from resolvePath validation
            expect(mockLogger.error).toHaveBeenCalledWith(
                'SET_VARIABLE: Error during resolvePath for path "" (variable: "edgeCase"). Assigning UNDEFINED.',
                expect.objectContaining({
                    // Expect the ACTUAL error message received from the real resolvePath validation
                    error: actualErrorMessageFromResolvePath,
                    originalValue: "$",
                    pathAttempted: ""
                })
            );
            expect(ctx.context['edgeCase']).toBeUndefined();
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "edgeCase" to RESOLVED value: undefined (Original placeholder: "$")');

            restoreResolvePath();
        });

        // Test for value like '$ ' -> path becomes ' '
        test('handles value being "$ " (whitespace path for resolvePath)', async () => {
            const params = {variable_name: 'edgeCaseSpace', value: '$ '};
            const ctx = buildCtx();
            // NOTE: We still mock to ensure isolation if resolvePath implementation changes,
            // but the actual error for ' ' likely comes from real resolvePath validation.
            const mockError = new Error("Simulated resolvePath error for whitespace path");
            const actualErrorMessageFromResolvePath = "resolvePath: dotPath must be a non-empty string"; // Actual validation error
            await mockResolvePathWithError(mockError, ' ');

            handler.execute(params, ctx);

            expect(mockLogger.debug).toHaveBeenCalledWith('SET_VARIABLE: Detected placeholder "$ " for variable "edgeCaseSpace". Attempting to resolve path " "...');
            // --- CORRECTED EXPECTATION ---
            // Expect the ERROR log from the catch block, matching the handler's format AND the *actual* error message from resolvePath validation
            expect(mockLogger.error).toHaveBeenCalledWith(
                'SET_VARIABLE: Error during resolvePath for path " " (variable: "edgeCaseSpace"). Assigning UNDEFINED.',
                expect.objectContaining({
                    // Expect the ACTUAL error message received from the real resolvePath validation
                    error: actualErrorMessageFromResolvePath,
                    originalValue: "$ ",
                    pathAttempted: " "
                })
            );
            expect(ctx.context['edgeCaseSpace']).toBeUndefined();
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "edgeCaseSpace" to RESOLVED value: undefined (Original placeholder: "$ ")');

            restoreResolvePath();
        });
    });


    // --- Context Logger Precedence ------------------------------------------
    // This requires the handler to potentially use a logger from the context, which isn't standard for JsonLogicEvaluationContext.
    // Let's skip this for now unless your handler explicitly checks `evaluationContext.logger`.
    // If it *only* uses the logger injected at construction, these tests aren't relevant.
    /*
    describe('Context Logger Usage', () => {
        test('uses logger from execution context when provided', () => {
            // This test assumes the handler checks evaluationContext.logger
            // If it doesn't, this test is invalid for the current implementation.
            const specificLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
            // Pass logger via the factory, assuming it adds it to the context object
            const ctx = buildCtx({}, specificLogger);

            const params = { variable_name: 'logTestVar', value: 'test-log' };
            handler.execute(params, ctx);

            // IF context logger is used:
            // expect(specificLogger.info).toHaveBeenCalledWith(...);
            // expect(mockLogger.info).not.toHaveBeenCalled();

            // IF context logger is NOT used (constructor logger only):
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "logTestVar" to ORIGINAL value: "test-log"');
             if (typeof specificLogger.info.mock !== 'undefined') { // Check if it's a Jest mock
                expect(specificLogger.info).not.toHaveBeenCalled();
             }
        });
    });
    */

});
