// src/tests/logic/operationHandlers.setVariableHandler.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import SetVariableHandler from '../../../logic/operationHandlers/setVariableHandler.js'; // Adjust path if needed
// We don't mock resolvePath itself, but test its usage by the handler
// import resolvePath from '../../../utils/resolvePath.js'; // Not mocked directly

// --- Type-hints (for editors only) ------------------------------------------
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
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
 * Builds a mock ExecutionContext with customizable evaluation context.
 * @param {object} [evaluationContextOverrides] - Properties to merge into evaluationContext.
 * @param {ILogger} [contextLogger] - Optional specific logger for this context.
 * @returns {ExecutionContext}
 */
function buildCtx(evaluationContextOverrides = {}, contextLogger = null) {
    const baseEvaluationContext = {
        event: {
            type: 'TEST_EVENT',
            payload: {
                value: 123,
                nested: { key: 'event-payload-value' },
            },
        },
        actor: {
            id: 'actor-123',
            components: { // Simulate component accessor structure if needed by resolvePath targets
                'core:health': { current: 50, max: 100 },
            }
        },
        target: null, // Default to null
        context: { // Variables set by previous operations (or this one!)
            existingVar: 'pre-existing value',
            nested: {
                path: {
                    to: { value: 'deep context value' }
                }
            }
        },
        globals: {}, // Placeholder
        entities: {}, // Placeholder
    };

    const finalEvaluationContext = {
        ...baseEvaluationContext,
        ...evaluationContextOverrides,
        // Ensure deep merge of context if provided in overrides
        context: {
            ...baseEvaluationContext.context,
            ...(evaluationContextOverrides.context || {}),
        },
        // Ensure deep merge of event payload if provided
        event: {
            ...baseEvaluationContext.event,
            ...(evaluationContextOverrides.event || {}),
            payload: {
                ...baseEvaluationContext.event.payload,
                ...(evaluationContextOverrides.event?.payload || {}),
            }
        }
    };

    return {
        evaluationContext: finalEvaluationContext,
        entityManager: {}, // Mock or provide if needed by complex resolutions (not typical for setVariable)
        validatedEventDispatcher: {}, // Mock if needed
        logger: contextLogger ?? mockLogger, // Use specific logger or default mock
        // gameDataRepository: {}, // Mock if needed
    };
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
        handler = new SetVariableHandler({ logger: mockLogger });

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
            expect(() => new SetVariableHandler({ logger: null })).toThrow(/ILogger instance/);
            expect(() => new SetVariableHandler({ logger: { info: jest.fn() } })).toThrow(/ILogger instance/); // Missing methods
        });

        test('initializes successfully with a valid logger', () => {
            expect(() => new SetVariableHandler({ logger: mockLogger })).not.toThrow();
            expect(mockLogger.debug).toHaveBeenCalledWith('SetVariableHandler initialized.');
        });
    });

    // --- Parameter Validation (`execute`) ------------------------------------
    describe('Parameter Validation', () => {
        test.each([
            ['null params', null, 'SET_VARIABLE: Missing or invalid parameters object.', { params: null }],
            ['undefined params', undefined, 'SET_VARIABLE: Missing or invalid parameters object.', { params: undefined }],
            ['non-object params', 'string', 'SET_VARIABLE: Missing or invalid parameters object.', { params: 'string' }],
            // --- CORRECTED EXPECTATION FOR ARRAY ---
            ['array params', [], 'SET_VARIABLE: Invalid or missing "variable_name" parameter. Must be a non-empty string.', { variable_name: undefined }],
        ])('logs error and returns if params object is invalid (%s)', (desc, invalidParams, expectedErrorMsg, expectedErrorObj) => {
            const ctx = buildCtx();
            handler.execute(invalidParams, ctx);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, expectedErrorObj);
            expect(ctx.evaluationContext.context).toEqual(buildCtx().evaluationContext.context); // Context unchanged
        });


        test.each([
            ['missing', { value: 1 }],
            ['null', { value: 1, variable_name: null }],
            ['undefined', { value: 1, variable_name: undefined }],
            ['empty string', { value: 1, variable_name: '' }],
            ['whitespace string', { value: 1, variable_name: '   ' }],
            ['non-string', { value: 1, variable_name: 123 }],
        ])('logs error and returns if "variable_name" is invalid (%s)', (desc, params) => {
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(mockLogger.error).toHaveBeenCalledWith('SET_VARIABLE: Invalid or missing "variable_name" parameter. Must be a non-empty string.', { variable_name: params.variable_name });
            expect(ctx.evaluationContext.context).toEqual(buildCtx().evaluationContext.context); // Context unchanged
        });

        test('logs error and returns if "value" is undefined', () => {
            const params = { variable_name: 'myVar' /* value: undefined is implicit */ };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(mockLogger.error).toHaveBeenCalledWith('SET_VARIABLE: Missing "value" parameter for variable "myVar".', { params });
            expect(ctx.evaluationContext.context).toEqual(buildCtx().evaluationContext.context); // Context unchanged
        });

        test('does NOT log error if "value" is null', () => {
            const params = { variable_name: 'myVar', value: null };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('Missing "value" parameter'));
            expect(ctx.evaluationContext.context['myVar']).toBeNull();
        });

        test('does NOT log error if "value" is false', () => {
            const params = { variable_name: 'myVar', value: false };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('Missing "value" parameter'));
            expect(ctx.evaluationContext.context['myVar']).toBe(false);
        });

        test('does NOT log error if "value" is 0', () => {
            const params = { variable_name: 'myVar', value: 0 };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('Missing "value" parameter'));
            expect(ctx.evaluationContext.context['myVar']).toBe(0);
        });
    });

    // --- Execution Context Validation (`execute`) ----------------------------
    describe('Execution Context Validation', () => {
        const validParams = { variable_name: 'v', value: 1 };

        test.each([
            ['null executionContext', null],
            ['undefined executionContext', undefined],
            ['executionContext without evaluationContext', { logger: mockLogger }],
            ['executionContext with null evaluationContext', { logger: mockLogger, evaluationContext: null }],
            ['evaluationContext without context', { logger: mockLogger, evaluationContext: {} }],
            ['evaluationContext with null context', { logger: mockLogger, evaluationContext: { context: null } }],
            ['evaluationContext with non-object context', { logger: mockLogger, evaluationContext: { context: 'string' } }],
        ])('logs error and returns if execution context structure is invalid (%s)', (desc, invalidCtx) => {
            handler.execute(validParams, invalidCtx);
            // Access logger safely depending on the test case
            const logger = invalidCtx?.logger ?? mockLogger;
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('executionContext or evaluationContext or evaluationContext.context is missing or invalid'), expect.anything());
        });
    });

    // --- Literal Value Setting -----------------------------------------------
    describe('Literal Value Setting', () => {
        test('sets literal string value', () => {
            const params = { variable_name: 'message', value: 'Hello World' };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['message']).toBe('Hello World');
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "message" to ORIGINAL value: "Hello World"');
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        test('sets literal number value', () => {
            const params = { variable_name: 'count', value: 42 };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['count']).toBe(42);
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "count" to ORIGINAL value: 42');
        });

        test('sets literal boolean value (true)', () => {
            const params = { variable_name: 'isActive', value: true };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['isActive']).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "isActive" to ORIGINAL value: true');
        });

        test('sets literal boolean value (false)', () => {
            const params = { variable_name: 'isDisabled', value: false };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['isDisabled']).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "isDisabled" to ORIGINAL value: false');
        });

        test('sets literal null value', () => {
            const params = { variable_name: 'optionalData', value: null };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['optionalData']).toBeNull();
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "optionalData" to ORIGINAL value: null');
        });

        test('sets literal object value', () => {
            const objValue = { key: 'value', nested: { num: 1 } };
            const params = { variable_name: 'config', value: objValue };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['config']).toEqual(objValue);
            expect(mockLogger.info).toHaveBeenCalledWith(`SET_VARIABLE: Setting context variable "config" to ORIGINAL value: ${JSON.stringify(objValue)}`);
        });

        test('sets literal array value', () => {
            const arrValue = [1, 'two', true, null];
            const params = { variable_name: 'items', value: arrValue };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['items']).toEqual(arrValue);
            expect(mockLogger.info).toHaveBeenCalledWith(`SET_VARIABLE: Setting context variable "items" to ORIGINAL value: ${JSON.stringify(arrValue)}`);
        });

        test('trims whitespace from variable_name before setting', () => {
            const params = { variable_name: '  paddedVar  ', value: 'trimmed' };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context).toHaveProperty('paddedVar');
            expect(ctx.evaluationContext.context['paddedVar']).toBe('trimmed');
            expect(ctx.evaluationContext.context).not.toHaveProperty('  paddedVar  ');
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "paddedVar" to ORIGINAL value: "trimmed"');
        });
    });

    // --- Placeholder Resolution ---------------------------------------------
    describe('Placeholder Resolution ($)', () => {
        test('resolves $context.existingVar', () => {
            const params = { variable_name: 'newVar', value: '$context.existingVar' };
            const ctx = buildCtx(); // Uses default context with existingVar
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['newVar']).toBe('pre-existing value');
            expect(mockLogger.debug).toHaveBeenCalledWith('SET_VARIABLE: Detected placeholder "$context.existingVar" for variable "newVar". Attempting to resolve path "context.existingVar"...');
            expect(mockLogger.debug).toHaveBeenCalledWith('SET_VARIABLE: Placeholder path "context.existingVar" resolved successfully for variable "newVar". Resolved value: "pre-existing value"');
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "newVar" to RESOLVED value: "pre-existing value" (Original placeholder: "$context.existingVar")');
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        test('resolves $context.nested.path.to.value', () => {
            const params = { variable_name: 'deepVar', value: '$context.nested.path.to.value' };
            const ctx = buildCtx(); // Uses default context with nested path
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['deepVar']).toBe('deep context value');
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "deepVar" to RESOLVED value: "deep context value" (Original placeholder: "$context.nested.path.to.value")');
        });

        test('resolves $event.type', () => {
            const params = { variable_name: 'triggerEvent', value: '$event.type' };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['triggerEvent']).toBe('TEST_EVENT');
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "triggerEvent" to RESOLVED value: "TEST_EVENT" (Original placeholder: "$event.type")');
        });

        test('resolves $event.payload.nested.key', () => {
            const params = { variable_name: 'payloadKey', value: '$event.payload.nested.key' };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['payloadKey']).toBe('event-payload-value');
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "payloadKey" to RESOLVED value: "event-payload-value" (Original placeholder: "$event.payload.nested.key")');
        });

        test('resolves $actor.id', () => {
            const params = { variable_name: 'actorWhoTriggered', value: '$actor.id' };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['actorWhoTriggered']).toBe('actor-123');
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "actorWhoTriggered" to RESOLVED value: "actor-123" (Original placeholder: "$actor.id")');
        });

        // Test resolving a complex path including components (if component accessor setup in context)
        test('resolves $actor.components["core:health"].current', () => {
            const params = { variable_name: 'actorHP', value: '$actor.components.core:health.current' };
            // buildCtx already includes actor with core:health component data
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['actorHP']).toBe(50);
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "actorHP" to RESOLVED value: 50 (Original placeholder: "$actor.components.core:health.current")');
        });

        test('resolves placeholder resulting in an object', () => {
            const params = { variable_name: 'healthObj', value: '$actor.components.core:health' };
            const ctx = buildCtx();
            const expectedObj = { current: 50, max: 100 };
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['healthObj']).toEqual(expectedObj);
            expect(mockLogger.info).toHaveBeenCalledWith(`SET_VARIABLE: Setting context variable "healthObj" to RESOLVED value: ${JSON.stringify(expectedObj)} (Original placeholder: "$actor.components.core:health")`);
        });

        test('resolves placeholder resulting in null (from context)', () => {
            const params = { variable_name: 'targetVar', value: '$target' }; // Target is null in default context
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['targetVar']).toBeNull();
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "targetVar" to RESOLVED value: null (Original placeholder: "$target")');
        });
    });

    // --- Unresolved Placeholders --------------------------------------------
    describe('Unresolved Placeholder Handling', () => {
        test('handles unresolved $context.nonExistentVar - stores undefined', () => {
            const params = { variable_name: 'missingVar', value: '$context.nonExistentVar' };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context).toHaveProperty('missingVar');
            expect(ctx.evaluationContext.context['missingVar']).toBeUndefined();
            expect(mockLogger.warn).toHaveBeenCalledWith('SET_VARIABLE: Placeholder path "context.nonExistentVar" resolved to UNDEFINED in executionContext.evaluationContext for variable "missingVar". Storing undefined.');
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "missingVar" to RESOLVED value: undefined (Original placeholder: "$context.nonExistentVar")');
        });

        test('handles unresolved $event.payload.missing - stores undefined', () => {
            const params = { variable_name: 'missingPayload', value: '$event.payload.missing' };
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['missingPayload']).toBeUndefined();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('resolved to UNDEFINED'));
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "missingPayload" to RESOLVED value: undefined (Original placeholder: "$event.payload.missing")');
        });

        test('handles unresolved path through null intermediate ($target.id when target is null)', () => {
            const params = { variable_name: 'targetIdVar', value: '$target.id' }; // Target is null
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['targetIdVar']).toBeUndefined();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('resolved to UNDEFINED'));
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "targetIdVar" to RESOLVED value: undefined (Original placeholder: "$target.id")');
        });

        test('handles unresolved path through undefined intermediate ($context.missing.path)', () => {
            const params = { variable_name: 'missingPathVar', value: '$context.missing.path' }; // context.missing is undefined
            const ctx = buildCtx();
            handler.execute(params, ctx);
            expect(ctx.evaluationContext.context['missingPathVar']).toBeUndefined();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('resolved to UNDEFINED'));
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "missingPathVar" to RESOLVED value: undefined (Original placeholder: "$context.missing.path")');
        });
    });

    // --- Edge Cases ---------------------------------------------------------
    describe('Edge Cases', () => {
        // Use dynamic import for resolvePath module within the test if mocking is needed
        // to ensure clean state between tests.
        test('handles value being just "$"', async () => {
            const params = { variable_name: 'edgeCase', value: '$' };
            const ctx = buildCtx();
            // --- CORRECTED: Match the actual error thrown by resolvePath ---
            const mockResolvePathError = new TypeError("resolvePath: dotPath must be a non-empty string");

            // Dynamically import resolvePath only when needed for mocking
            resolvePathModule = await import('../../../utils/resolvePath.js');
            originalResolvePath = resolvePathModule.default;
            resolvePathModule.default = jest.fn().mockImplementation((root, path) => {
                // Simulate the actual resolvePath behavior throwing TypeError for empty string path
                if (path === '') throw mockResolvePathError;
                // Fallback to original implementation if needed for other tests (unlikely here)
                // return originalResolvePath(root, path);
            });

            handler.execute(params, ctx);

            expect(mockLogger.warn).toHaveBeenCalledWith("SET_VARIABLE: Value was '$' with no path. Using empty string as path for resolution against context root for variable \"edgeCase\".");
            // --- CORRECTED: Expect the error object with the TypeError ---
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error during resolvePath for path ""'), // Check message structure
                expect.objectContaining({ // Check the object payload
                    error: mockResolvePathError, // Expect the specific TypeError instance
                    originalValue: "$",
                    pathAttempted: ""
                })
            );
            expect(ctx.evaluationContext.context['edgeCase']).toBeUndefined(); // Should store undefined on error
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "edgeCase" to RESOLVED value: undefined (Original placeholder: "$")');

            // Restore original resolvePath
            if (resolvePathModule && originalResolvePath) {
                resolvePathModule.default = originalResolvePath;
            }
        });

        test('handles value being "$ " (resolves path " ")', async () => {
            const params = { variable_name: 'edgeCaseSpace', value: '$ ' };
            const ctx = buildCtx();
            // --- CORRECTED: Match the actual error thrown by resolvePath ---
            const mockResolvePathError = new TypeError("resolvePath: dotPath must be a non-empty string");

            resolvePathModule = await import('../../../utils/resolvePath.js');
            originalResolvePath = resolvePathModule.default;
            resolvePathModule.default = jest.fn().mockImplementation((root, path) => {
                // Simulate the actual resolvePath behavior throwing TypeError for whitespace path
                if (path.trim() === '') throw mockResolvePathError;
                // return originalResolvePath(root, path);
            });

            handler.execute(params, ctx);

            expect(mockLogger.debug).toHaveBeenCalledWith('SET_VARIABLE: Detected placeholder "$ " for variable "edgeCaseSpace". Attempting to resolve path " "...');
            // --- CORRECTED: Expect the error object with the TypeError ---
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error during resolvePath for path " "'), // Check message structure
                expect.objectContaining({ // Check the object payload
                    error: mockResolvePathError, // Expect the specific TypeError instance
                    originalValue: "$ ",
                    pathAttempted: " "
                })
            );
            expect(ctx.evaluationContext.context['edgeCaseSpace']).toBeUndefined();
            expect(mockLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "edgeCaseSpace" to RESOLVED value: undefined (Original placeholder: "$ ")');

            // Restore original resolvePath
            if (resolvePathModule && originalResolvePath) {
                resolvePathModule.default = originalResolvePath;
            }
        });
    });

    // --- Context Logger Precedence ------------------------------------------
    describe('Context Logger Usage', () => {
        test('uses logger from execution context when provided', () => {
            const specificLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
            const ctx = buildCtx({}, specificLogger); // Pass specific logger here

            // Test a path that uses the logger (e.g., successful literal set)
            const params = { variable_name: 'logTestVar', value: 'test-log' };
            handler.execute(params, ctx);

            expect(specificLogger.info).toHaveBeenCalledWith('SET_VARIABLE: Setting context variable "logTestVar" to ORIGINAL value: "test-log"');
            expect(mockLogger.info).not.toHaveBeenCalled(); // Ensure default constructor logger wasn't used

            // Test another path (e.g., unresolved placeholder)
            jest.clearAllMocks(); // Clear mocks for next check
            const paramsUnresolved = { variable_name: 'logTestUnresolved', value: '$context.nope' };
            handler.execute(paramsUnresolved, ctx);

            expect(specificLogger.warn).toHaveBeenCalledWith(expect.stringContaining('resolved to UNDEFINED'));
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });
    });

});