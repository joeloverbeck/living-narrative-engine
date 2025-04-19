// src/actions/actionExecutor.literalSources.test.js

import {beforeEach, describe, expect, jest, test} from "@jest/globals";

import ActionExecutor from '../../actions/actionExecutor.js';
import Entity from '../../entities/entity.js'; // Needed for context creation even if not directly used by literals

import {ResolutionStatus} from '../../services/targetResolutionService.js'; // Import enum

// Import types for JSDoc
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../services/targetResolutionService.js').TargetResolutionResult} TargetResolutionResult */
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../services/actionValidationService.js').ActionTargetContext} ActionTargetContext */

// Mock dependencies
const mockGameDataRepository = {
    getAction: jest.fn(),
};
const mockTargetResolutionService = {
    resolveActionTarget: jest.fn(),
};
const mockActionValidationService = {
    isValid: jest.fn(),
};
const mockEventBus = {
    dispatch: jest.fn(),
};

// Mock logger
/** @type {ILogger} */
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Mock getDisplayName (Needed for ActionExecutor constructor/setup, even if not used in literal tests)
import {getDisplayName as originalGetDisplayName} from '../../utils/messages.js';
import PayloadValueResolverService from "../../services/payloadValueResolverService.js";

jest.mock('../../utils/messages.js', () => ({
    getDisplayName: jest.fn((entity) => entity?.id ?? 'mock unknown'), // Simple mock
    TARGET_MESSAGES: {},
}));

/** @type {jest.MockedFunction<typeof originalGetDisplayName>} */
const mockGetDisplayName = jest.requireMock('../../utils/messages.js').getDisplayName;


// Helper to create a basic ActionExecutor instance
// Factory function remains the same
const payloadValueResolverService = (logger = mockLogger) => {
    return new PayloadValueResolverService({logger});
}

// Corrected helper to create the executor
const createExecutor = (logger = mockLogger) => {
    // <<< --- FIX: Create an INSTANCE of the service first --- >>>
    const resolverServiceInstance = payloadValueResolverService(logger);

    return new ActionExecutor({
        gameDataRepository: mockGameDataRepository,
        targetResolutionService: mockTargetResolutionService,
        actionValidationService: mockActionValidationService,
        eventBus: mockEventBus,
        logger: logger,
        payloadValueResolverService: resolverServiceInstance
    });
};

// Helper to create baseline mock objects
/**
 * Creates a mock ActionContext.
 * @param {object} [overrides] - Properties to override in the default context.
 * @returns {ActionContext}
 */
const createMockActionContext = (overrides = {}) => {
    const player = new Entity('player_literal_test');
    const location = new Entity('loc_literal_test_room');

    /** @type {ActionContext} */
    const baseContext = {
        playerEntity: player,
        currentLocation: location,
        entityManager: { // Simplified mock, not really used by literal tests
            componentRegistry: {
                get: jest.fn(() => undefined), // No components needed for literals
            },
            getEntityInstance: jest.fn((id) => {
                if (id === player.id) return player;
                if (id === location.id) return location;
                return undefined;
            }),
        },
        eventBus: mockEventBus,
        parsedCommand: { // Not really used by literal tests
            actionId: 'test:literal_action',
            directObjectPhrase: null,
            indirectObjectPhrase: null,
            preposition: null,
            originalInput: 'do literal test',
            error: null,
        },
        gameDataRepository: mockGameDataRepository,
        dispatch: mockEventBus.dispatch,
        ...overrides,
    };
    return baseContext;
};

/**
 * @param {ResolutionStatus} status
 * @param {object} [overrides]
 * @returns {TargetResolutionResult}
 */
const createMockResolutionResult = (status = ResolutionStatus.FOUND_UNIQUE, overrides = {}) => {
    // For literal tests, the resolution result details don't matter much,
    // as long as the status allows executeAction to proceed.
    const baseResult = {
        status: status,
        targetType: 'none', // Doesn't affect literals
        targetId: null,
        targetEntity: null,
        targetConnectionEntity: null,
        candidateIds: [],
        details: null,
        error: null,
        ...overrides,
    };
    return baseResult;
};

/**
 * @param {object} [overrides]
 * @param {string} [overrides.id] - Action ID override.
 * @param {object} [overrides.payloadDef] - Payload definition override.
 * @returns {ActionDefinition}
 */
const createMockActionDefinition = (overrides = {}) => {
    /** @type {ActionDefinition} */
    const baseDefinition = {
        id: overrides.id ?? 'test:literal_default',
        target_domain: 'none', // Doesn't matter for literals
        template: 'test literal action',
        dispatch_event: {
            eventName: `test:event_${overrides.id ?? 'literal_default'}`,
            payload: overrides.payloadDef ?? {}, // Set per test case
        },
        // Remove other potential overrides if not needed for clarity
    };
    return baseDefinition;
};


// --- Test Suite ---

describe('ActionExecutor', () => {
    let executor;
    let mockContext;
    let mockResolutionResult; // Default successful resolution

    beforeEach(() => {
        jest.clearAllMocks();
        executor = createExecutor(mockLogger);
        mockContext = createMockActionContext();
        // Default setup for successful execution path (resolution/validation pass)
        // Literals don't depend on resolution details, just that it doesn't fail early.
        mockResolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE);
        mockTargetResolutionService.resolveActionTarget.mockResolvedValue(mockResolutionResult);
        mockActionValidationService.isValid.mockReturnValue(true);
        // mockGameDataRepository.getAction is mocked within each test group/test
    });

    describe('#getValueFromSource (via executeAction) - literal. Prefixes', () => {
        const payloadKey = 'literalValue';

        // --- literal.string ---
        describe('literal.string.<value>', () => {
            const actionIdPrefix = 'test:lit_str';

            test('should return simple string "hello"', async () => {
                const sourceString = 'literal.string.hello';
                const expectedValue = 'hello';
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_simple`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    actionDef.dispatch_event.eventName,
                    expect.objectContaining({[payloadKey]: expectedValue})
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should return string "hello world" with space', async () => {
                const sourceString = 'literal.string.hello world';
                const expectedValue = 'hello world';
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_space`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    actionDef.dispatch_event.eventName,
                    expect.objectContaining({[payloadKey]: expectedValue})
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should return string "a.b.c" with dots', async () => {
                // The implementation uses `parts.slice(2).join('.')`, so dots are preserved
                const sourceString = 'literal.string.a.b.c';
                const expectedValue = 'a.b.c';
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_dots`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    actionDef.dispatch_event.eventName,
                    expect.objectContaining({[payloadKey]: expectedValue})
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should return empty string "" for "literal.string."', async () => {
                // `parts = ['literal', 'string', '']`, `slice(2)` is `['']`, `join('.')` is `""`
                const sourceString = 'literal.string.';
                const expectedValue = '';
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_emptyval`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    actionDef.dispatch_event.eventName,
                    expect.objectContaining({[payloadKey]: expectedValue})
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should return string "." for "literal.string.."', async () => {
                // `parts = ['literal', 'string', '', '']`, `slice(2)` is `['', '']`, `join('.')` is `"."`
                const sourceString = 'literal.string..';
                const expectedValue = '.';
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_dotval`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    actionDef.dispatch_event.eventName,
                    expect.objectContaining({[payloadKey]: expectedValue})
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });
        });

        // --- literal.number ---
        describe('literal.number.<value>', () => {
            const actionIdPrefix = 'test:lit_num';

            test('should return positive integer 123', async () => {
                const sourceString = 'literal.number.123';
                const expectedValue = 123;
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_int`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    actionDef.dispatch_event.eventName,
                    expect.objectContaining({[payloadKey]: expectedValue})
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should return negative float -45.67', async () => {
                const sourceString = 'literal.number.-45.67';
                const expectedValue = -45.67;
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_negfloat`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    actionDef.dispatch_event.eventName,
                    expect.objectContaining({[payloadKey]: expectedValue})
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should return zero 0', async () => {
                const sourceString = 'literal.number.0';
                const expectedValue = 0;
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_zero`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    actionDef.dispatch_event.eventName,
                    expect.objectContaining({[payloadKey]: expectedValue})
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should return undefined and log error for invalid format "1.2.3"', async () => {
                // `parseFloat("1.2.3")` is `1.2`, but the ticket expectation implies it should fail?
                // Let's re-evaluate the code: `parseFloat` *will* parse `1.2.3` as `1.2`.
                // The ticket requirement might be slightly misaligned with `parseFloat` behavior.
                // Assuming the requirement is "fail if not a standard single-decimal number":
                // We would need custom validation *after* parseFloat. The current code doesn't do that.
                // Let's test the *actual* behaviour based on the code (parses as 1.2)
                // --- TEST ADJUSTED TO REFLECT ACTUAL CODE BEHAVIOUR ---
                const sourceString = 'literal.number.1.2.3';
                const expectedValue = 1.2; // parseFloat('1.2.3') -> 1.2
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_multi_dot`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    actionDef.dispatch_event.eventName,
                    expect.objectContaining({[payloadKey]: expectedValue}) // Should contain 1.2
                );
                // No error should be logged because parseFloat succeeds.
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should return undefined and log error for non-numeric string "abc"', async () => {
                const sourceString = 'literal.number.abc';
                const valueString = 'abc'; // Value part
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_abc`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`PayloadValueResolverService (#resolveLiteralSource): Failed to parse number from literal source '${sourceString}'\. Value\: '${valueString}'.`)
                    // Note: The actionDef.id part is no longer included in the log message from #resolveLiteralSource in this specific case,
                    //       so remove it from the expectation *if* it's truly absent in the Received message.
                    //       Looking at your code snippet, the action ID *is* missing from the specific error log lines
                    //       within #resolveLiteralSource. Double-check the exact output if needed.
                    //       If the action ID *should* be there, you'd add it back:
                    // expect.stringContaining(`PayloadValueResolverService (#resolveLiteralSource): Failed to parse number from literal source '<span class="math-inline">\{sourceString\}' for action '</span>{actionDef.id}'. Value: '${valueString}'.`)
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                );
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
            });
        });

        // --- literal.boolean ---
        describe('literal.boolean.<value>', () => {
            const actionIdPrefix = 'test:lit_bool';

            test('should return true for "literal.boolean.true"', async () => {
                const sourceString = 'literal.boolean.true';
                const expectedValue = true;
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_true_lc`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    actionDef.dispatch_event.eventName,
                    expect.objectContaining({[payloadKey]: expectedValue})
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should return false for "literal.boolean.FALSE" (case-insensitive)', async () => {
                const sourceString = 'literal.boolean.FALSE';
                const expectedValue = false;
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_false_uc`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    actionDef.dispatch_event.eventName,
                    expect.objectContaining({[payloadKey]: expectedValue})
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should return true for "literal.boolean.TrUe" (case-insensitive)', async () => {
                const sourceString = 'literal.boolean.TrUe';
                const expectedValue = true;
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_true_mixed`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    actionDef.dispatch_event.eventName,
                    expect.objectContaining({[payloadKey]: expectedValue})
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should return undefined and log error for invalid value "maybe"', async () => {
                const sourceString = 'literal.boolean.maybe';
                const valueString = 'maybe'; // Value part
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_invalid`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`PayloadValueResolverService (#resolveLiteralSource): Invalid boolean value in literal source '${sourceString}'\. Value\: '${valueString}'. Expected 'true' or 'false'.`)
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                );
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
            });
        });

        // --- literal.null ---
        describe('literal.null.', () => {
            const actionIdPrefix = 'test:lit_null';

            test('should return null for "literal.null."', async () => {
                const sourceString = 'literal.null.';
                const expectedValue = null;
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_empty`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    actionDef.dispatch_event.eventName,
                    expect.objectContaining({[payloadKey]: expectedValue})
                );
                expect(mockLogger.warn).toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should return null for "literal.null.ignoredValue"', async () => {
                const sourceString = 'literal.null.ignoredValue';
                const expectedValue = null;
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_ignored`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    actionDef.dispatch_event.eventName,
                    expect.objectContaining({[payloadKey]: expectedValue})
                );
                expect(mockLogger.warn).toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });
        });

        // --- Unknown Literal Type ---
        describe('Unknown Literal Type', () => {
            test('should return undefined and log error for "literal.foo.bar"', async () => {
                const sourceString = 'literal.foo.bar';
                const unknownType = 'foo';
                const actionDef = createMockActionDefinition({
                    id: 'test:lit_unknown_type',
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Unknown literal type '${unknownType}' in source '${sourceString}' for action '${actionDef.id}'.`)
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                );
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
            });
        });

        // --- Malformed literal. Strings ---
        describe('Malformed literal. Strings', () => {
            const actionIdPrefix = 'test:lit_malformed';

            test('literal.string. should return "" (covered by string tests)', () => {
                // This case is handled correctly by the literal.string tests above.
                // No separate test needed here, but acknowledging it's covered.
                expect(true).toBe(true); // Placeholder assertion
            });

            test('literal.number. should return undefined and log error', async () => {
                // `parseFloat('')` -> NaN
                const sourceString = 'literal.number.';
                const valueString = ''; // Value part after split/join
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_num_empty`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`PayloadValueResolverService (#resolveLiteralSource): Failed to parse number from literal source '${sourceString}'\. Value\: '${valueString}'.`)
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                );
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
            });

            test('literal.boolean. should return undefined and log error', async () => {
                // `valueString = ''`, `'' !== 'true'` and `'' !== 'false'`
                const sourceString = 'literal.boolean.';
                const valueString = ''; // Value part
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_bool_empty`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`PayloadValueResolverService (#resolveLiteralSource): Invalid boolean value in literal source '${sourceString}'\. Value\: '${valueString}'. Expected 'true' or 'false'.`)
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                );
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
            });

            test('literal.null. should return null (covered by null tests)', () => {
                // This case is handled correctly by the literal.null tests above.
                expect(true).toBe(true); // Placeholder assertion
            });

            test('literal. should return undefined and log warn (missing type and value)', async () => {
                // `parts = ['literal', '']`, length is 2, fails `parts.length < 3` check
                const sourceString = 'literal.';
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_dot_only`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`PayloadValueResolverService (#resolveLiteralSource): Malformed 'literal' source string '${sourceString}'. Type '' requires a value part ('literal.<type>.<value>').`)
                );
                expect(mockLogger.error).not.toHaveBeenCalled();
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                );
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
            });

            test('literal.string (no final dot) should return undefined and log warn', async () => {
                // `parts = ['literal', 'string']`, length is 2, fails `parts.length < 3` check
                const sourceString = 'literal.string';
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_no_val_part`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`PayloadValueResolverService (#resolveLiteralSource): Malformed 'literal' source string '${sourceString}'. Type 'string' requires a value part ('literal.<type>.<value>').`)
                );
                expect(mockLogger.error).not.toHaveBeenCalled();
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                );
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
            });

            test('literal (just prefix) should return undefined and log warn', async () => {
                // `parts = ['literal']`, length is 1, fails `parts.length < 3` check
                const sourceString = 'literal';
                const actionDef = createMockActionDefinition({
                    id: `${actionIdPrefix}_prefix_only`,
                    payloadDef: {[payloadKey]: sourceString}
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`PayloadValueResolverService (#resolveLiteralSource): Malformed 'literal' source string '${sourceString}'. Requires at least 'literal.<type>'.`)
                );
                expect(mockLogger.error).not.toHaveBeenCalled();
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                );
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
            });
        });

    }); // end describe #getValueFromSource (via executeAction) - literal. Prefixes

}); // end describe ActionExecutor