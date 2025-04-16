// src/tests/utils/actionValidationUtils.test.js

import { beforeEach, afterEach, describe, expect, jest, test } from '@jest/globals';
// Assuming the path to the utility function is correct relative to this test file
import { validateRequiredCommandPart } from '../../utils/actionValidationUtils.js';
// Ensure you have this type definition accessible or adjust the JSDoc
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../utils/actionValidationUtils.js').RequiredCommandPart} RequiredCommandPart */


// --- Mocks & Spies ---

// Mock for the dispatch function within the ActionContext's eventBus
const mockDispatch = jest.fn();

// Spies for console methods to verify logging side-effects
let consoleErrorSpy;
let consoleWarnSpy;
let consoleLogSpy; // Optional: if you want to suppress/check debug logs too

// --- Helper Functions ---

/**
 * Factory function to create a mock ActionContext object for testing.
 * Allows overriding default mock properties.
 *
 * @param {object} overrides - Properties to override in the default mock context.
 * @param {object | null} [overrides.playerEntity={ id: 'player-1', name: 'Tester' }] - Mock player entity. Can be null.
 * @param {object | null} [overrides.parsedCommand={}] - Mock parsed command object. Can be null.
 * @param {function | null} [overrides.eventBusDispatch] - Mock dispatch function for the event bus. Defaults to the global mockDispatch. Pass null to simulate missing dispatch.
 * @returns {ActionContext} A mock ActionContext. Note: Type casting might be needed in tests if playerEntity is null, as ActionContext might strictly require it.
 */
const createMockActionContext = (overrides = {}) => {
    // Default player entity structure
    const defaultPlayerEntity = { id: 'player-1', name: 'Tester' };
    let playerEntity;
    if (overrides.playerEntity === null) {
        playerEntity = null;
    } else if (overrides.playerEntity !== undefined) {
        playerEntity = { ...defaultPlayerEntity, ...overrides.playerEntity };
    } else {
        playerEntity = defaultPlayerEntity;
    }

    // Default parsed command structure (empty object)
    let parsedCommand;
    if (overrides.parsedCommand === null) {
        parsedCommand = null;
    } else if (overrides.parsedCommand !== undefined) {
        parsedCommand = { ...overrides.parsedCommand };
    } else {
        parsedCommand = {}; // Default to empty object if not overridden
    }

    // --- Corrected Event Bus Setup ---
    // Use the global mockDispatch for eventBus.dispatch by default,
    // but allow overriding it (e.g., setting to null to test missing dispatch).
    const eventBusDispatch = overrides.eventBusDispatch === undefined ? mockDispatch : overrides.eventBusDispatch;
    let eventBus = null;
    // Only create eventBus object if the dispatch function is provided (not explicitly null)
    if (eventBusDispatch !== null) {
        eventBus = {
            dispatch: eventBusDispatch
        };
    }
    // --- End Correction ---

    // Cast to 'any' then 'ActionContext' to satisfy typing if structure deviates (e.g. playerEntity=null)
    // but be cautious with this in strictly typed environments.
    return /** @type {ActionContext} */ (/** @type {any} */ ({
        playerEntity: playerEntity,
        parsedCommand: parsedCommand,
        eventBus: eventBus, // Correctly provides eventBus with dispatch
        // Add other context properties if needed by the function or future tests
    }));
};


// --- Test Suite Setup ---

describe('actionValidationUtils', () => {

    // Setup spies before each test and clear mocks
    beforeEach(() => {
        mockDispatch.mockClear();
        // Capture console logs without printing them during tests
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        // Optional: Suppress regular logs during tests if they are noisy
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    // Restore spies after each test
    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore(); // Optional
        jest.clearAllMocks(); // Ensure all mocks are cleared
    });

    // --- Tests for validateRequiredCommandPart ---
    describe('validateRequiredCommandPart', () => {
        const MOCK_PLAYER_ID = 'player-1'; // Consistent player ID for tests
        const MOCK_ACTION_VERB = 'do_something'; // Consistent action verb for tests

        // --- Basic Setup Tests (Implicitly Checked by Running) ---
        test('should have the basic structure and mocks ready', () => {
            // Arrange
            const context = createMockActionContext({ // Now uses corrected helper
                playerEntity: { id: MOCK_PLAYER_ID },
                parsedCommand: { directObjectPhrase: 'apple' }
            });
            // Assert
            expect(context).toBeDefined();
            expect(context.eventBus).toBeDefined(); // Check eventBus exists
            expect(context.eventBus?.dispatch).toBe(mockDispatch); // Check dispatch is the mock
            expect(typeof validateRequiredCommandPart).toBe('function');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        // ========================================================================
        // --- NEW TESTS: Early Exit on Missing Core Context (Sub-Ticket 4.5) ---
        // ========================================================================
        describe('Handling Missing Core Context/ParsedCommand (Sub-Ticket 4.5)', () => {
            const DUMMY_VERB = 'test_verb';
            const DUMMY_PART = 'directObjectPhrase';

            test('AC1: should return false and log error if context is null', async () => {
                // Arrange
                const context = null;
                // Act
                const result = await validateRequiredCommandPart(/** @type {any} */ (context), DUMMY_VERB, DUMMY_PART);
                // Assert
                expect(result).toBe(false);
                expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    expect.stringContaining(`[validateRequiredCommandPart] Invalid context provided for action '${DUMMY_VERB}'. Cannot validate.`)
                );
                expect(mockDispatch).not.toHaveBeenCalled();
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            test('AC1: should return false and log error if context is undefined', async () => {
                // Arrange
                const context = undefined;
                // Act
                const result = await validateRequiredCommandPart(/** @type {any} */ (context), DUMMY_VERB, DUMMY_PART);
                // Assert
                expect(result).toBe(false);
                expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    expect.stringContaining(`[validateRequiredCommandPart] Invalid context provided for action '${DUMMY_VERB}'. Cannot validate.`)
                );
                expect(mockDispatch).not.toHaveBeenCalled();
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            test('AC2: should return false and log error if context.parsedCommand is missing (null)', async() => {
                // Arrange
                const context = createMockActionContext({ // Uses corrected helper
                    playerEntity: { id: MOCK_PLAYER_ID },
                    parsedCommand: null // Explicitly missing parsedCommand
                });
                // Act
                const result = await validateRequiredCommandPart(context, DUMMY_VERB, DUMMY_PART);
                // Assert
                expect(result).toBe(false);
                expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    expect.stringContaining(`[validateRequiredCommandPart] context.parsedCommand is missing for action '${DUMMY_VERB}'. Cannot validate required part '${DUMMY_PART}'.`)
                );
                expect(mockDispatch).not.toHaveBeenCalled();
                // Warning about dispatch shouldn't happen here, the error is earlier
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            test('AC2: should return false and log error if context.parsedCommand is missing (undefined)', async () => {
                // Arrange
                // Create context manually to test undefined parsedCommand
                const context = /** @type {ActionContext} */ (/** @type {any} */ ({
                    playerEntity: {id: MOCK_PLAYER_ID, name: 'Tester'},
                    eventBus: { dispatch: mockDispatch }, // Ensure eventBus exists for consistency if needed later
                    parsedCommand: undefined // Explicitly undefined
                }));
                // Act
                const result = await validateRequiredCommandPart(context, DUMMY_VERB, DUMMY_PART);
                // Assert
                expect(result).toBe(false);
                expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    expect.stringContaining(`[validateRequiredCommandPart] context.parsedCommand is missing for action '${DUMMY_VERB}'. Cannot validate required part '${DUMMY_PART}'.`)
                );
                expect(mockDispatch).not.toHaveBeenCalled();
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });
        }); // End describe('Handling Missing Core Context/ParsedCommand (Sub-Ticket 4.5)')


        // --- Successful Validation Tests (Sub-Ticket 4.2) ---
        describe('Successful Validation (Sub-Ticket 4.2)', () => {
            // THIS TEST SHOULD NOW PASS
            test('should return true if the required directObjectPhrase exists and is non-empty', async () => {
                // Arrange
                const context = createMockActionContext({ // Uses corrected helper
                    playerEntity: { id: MOCK_PLAYER_ID },
                    parsedCommand: { directObjectPhrase: 'the shiny key' }
                    // eventBus.dispatch is implicitly mockDispatch and playerEntity exists
                });
                const actionVerb = 'unlock';
                const requiredPart = 'directObjectPhrase';
                // Act
                const result = await validateRequiredCommandPart(context, actionVerb, requiredPart);
                // Assert
                expect(result).toBe(true);
                expect(mockDispatch).not.toHaveBeenCalled(); // Dispatch not needed for success
                expect(consoleErrorSpy).not.toHaveBeenCalled();
                expect(consoleWarnSpy).not.toHaveBeenCalled(); // Dispatch is possible, so no warning
            });

            // THIS TEST SHOULD NOW PASS
            test('should return true if the required indirectObjectPhrase exists and is non-empty', async () => {
                // Arrange
                const context = createMockActionContext({ // Uses corrected helper
                    playerEntity: { id: MOCK_PLAYER_ID },
                    parsedCommand: { directObjectPhrase: 'the coin', indirectObjectPhrase: 'the slot' }
                });
                const actionVerb = 'put';
                const requiredPart = 'indirectObjectPhrase';
                // Act
                const result = await validateRequiredCommandPart(context, actionVerb, requiredPart);
                // Assert
                expect(result).toBe(true);
                expect(mockDispatch).not.toHaveBeenCalled(); // Dispatch not needed for success
                expect(consoleErrorSpy).not.toHaveBeenCalled();
                expect(consoleWarnSpy).not.toHaveBeenCalled(); // Dispatch is possible, so no warning
            });
        }); // End describe('Successful Validation (Sub-Ticket 4.2)')

        // --- Failure Scenarios: Missing/Empty Command Parts (Sub-Ticket 4.3) ---
        describe('Failure: Missing/Empty Command Parts (Sub-Ticket 4.3)', () => {
            // THIS TEST SHOULD NOW PASS
            test('should return false and dispatch validation failed if directObjectPhrase is null', async () => {
                // Arrange
                const context = createMockActionContext({ // Uses corrected helper
                    playerEntity: { id: MOCK_PLAYER_ID },
                    parsedCommand: { directObjectPhrase: null }
                    // eventBus.dispatch is mockDispatch, playerEntity exists -> dispatch possible
                });
                const actionVerb = 'take';
                const requiredPart = 'directObjectPhrase';
                const expectedPayload = {
                    actorId: MOCK_PLAYER_ID,
                    actionVerb: actionVerb,
                    reasonCode: 'MISSING_DIRECT_OBJECT'
                };
                // Act
                const result = await validateRequiredCommandPart(context, actionVerb, requiredPart);
                // Assert
                expect(result).toBe(false);
                expect(mockDispatch).toHaveBeenCalledTimes(1); // Expect dispatch on failure
                expect(mockDispatch).toHaveBeenCalledWith('action:validation_failed', expectedPayload);
                // Should not log the "Dispatch skipped" error
                expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Dispatch skipped'));
                // Should not warn if dispatch is possible
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            test('should return false and dispatch validation failed if directObjectPhrase is an empty string', async () => {
                // Arrange
                const context = createMockActionContext({ // Uses corrected helper
                    playerEntity: { id: MOCK_PLAYER_ID },
                    parsedCommand: { directObjectPhrase: "" }
                });
                const actionVerb = 'examine';
                const requiredPart = 'directObjectPhrase';
                const expectedPayload = {
                    actorId: MOCK_PLAYER_ID,
                    actionVerb: actionVerb,
                    reasonCode: 'MISSING_DIRECT_OBJECT'
                };
                // Act
                const result = await validateRequiredCommandPart(context, actionVerb, requiredPart);
                // Assert
                expect(result).toBe(false);
                expect(mockDispatch).toHaveBeenCalledTimes(1);
                expect(mockDispatch).toHaveBeenCalledWith('action:validation_failed', expectedPayload);
                expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Dispatch skipped'));
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            test('should return false and dispatch validation failed if indirectObjectPhrase is null', async () => {
                // Arrange
                const context = createMockActionContext({ // Uses corrected helper
                    playerEntity: { id: MOCK_PLAYER_ID },
                    parsedCommand: { directObjectPhrase: 'coin', indirectObjectPhrase: null }
                });
                const actionVerb = 'put';
                const requiredPart = 'indirectObjectPhrase';
                const expectedPayload = {
                    actorId: MOCK_PLAYER_ID,
                    actionVerb: actionVerb,
                    reasonCode: 'MISSING_INDIRECT_OBJECT'
                };
                // Act
                const result = await validateRequiredCommandPart(context, actionVerb, requiredPart);
                // Assert
                expect(result).toBe(false);
                expect(mockDispatch).toHaveBeenCalledTimes(1);
                expect(mockDispatch).toHaveBeenCalledWith('action:validation_failed', expectedPayload);
                expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Dispatch skipped'));
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            test('should return false and dispatch validation failed if indirectObjectPhrase is an empty string', async () => {
                // Arrange
                const context = createMockActionContext({ // Uses corrected helper
                    playerEntity: { id: MOCK_PLAYER_ID },
                    parsedCommand: { directObjectPhrase: 'key', indirectObjectPhrase: "" }
                });
                const actionVerb = 'use';
                const requiredPart = 'indirectObjectPhrase';
                const expectedPayload = {
                    actorId: MOCK_PLAYER_ID,
                    actionVerb: actionVerb,
                    reasonCode: 'MISSING_INDIRECT_OBJECT'
                };
                // Act
                const result = await validateRequiredCommandPart(context, actionVerb, requiredPart);
                // Assert
                expect(result).toBe(false);
                expect(mockDispatch).toHaveBeenCalledTimes(1);
                expect(mockDispatch).toHaveBeenCalledWith('action:validation_failed', expectedPayload);
                expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Dispatch skipped'));
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });
        }); // End describe('Failure: Missing/Empty Command Parts (Sub-Ticket 4.3)')

        // --- Failure Scenario: Invalid `requiredPart` Argument (Sub-Ticket 4.4) ---
        describe('Failure: Invalid `requiredPart` Argument (Sub-Ticket 4.4)', () => {
            // Use RequiredCommandPart for type checking valid parts if possible, but test invalid strings too.
            const invalidRequiredParts = ['prepositionalPhrase', 'someRandomString', '', null, undefined];
            const INVALID_PART_ACTION_VERB = 'do_invalid_part';

            invalidRequiredParts.forEach((invalidPart) => {
                test(`should return false, log error, and dispatch INVALID_VALIDATION_RULE when requiredPart is '${invalidPart}' and dispatch is possible`, async () => {
                    // Arrange
                    const context = createMockActionContext({ // Uses corrected helper
                        playerEntity: { id: MOCK_PLAYER_ID },
                        parsedCommand: { directObjectPhrase: 'thing' } // Ensure parsedCommand exists
                        // Dispatch is possible by default
                    });
                    const expectedPayload = {
                        actorId: MOCK_PLAYER_ID,
                        actionVerb: INVALID_PART_ACTION_VERB,
                        reasonCode: 'INVALID_VALIDATION_RULE'
                    };
                    // Act
                    // Cast invalidPart to any to bypass TS/JS type checking for the test
                    const result = await validateRequiredCommandPart(context, INVALID_PART_ACTION_VERB, /** @type {any} */ (invalidPart));
                    // Assert
                    expect(result).toBe(false);
                    // Should log error about the invalid part itself
                    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] Invalid requiredPart '${invalidPart}' specified during validation check for action '${INVALID_PART_ACTION_VERB}'.`));
                    // Should dispatch failure event because dispatch is possible
                    expect(mockDispatch).toHaveBeenCalledTimes(1);
                    expect(mockDispatch).toHaveBeenCalledWith('action:validation_failed', expectedPayload);
                    // Should NOT log the "Dispatch skipped" error message
                    expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Dispatch skipped'));
                    // Should not warn if dispatch is possible
                    expect(consoleWarnSpy).not.toHaveBeenCalled();
                });

                test(`should return false, log errors, and NOT dispatch when requiredPart is '${invalidPart}' and eventBusDispatch is missing`, async () => {
                    // Arrange
                    const context = createMockActionContext({ // Uses corrected helper
                        playerEntity: { id: MOCK_PLAYER_ID },
                        parsedCommand: { directObjectPhrase: 'thing' },
                        eventBusDispatch: null // <<< Make dispatch impossible via eventBus
                    });
                    // Act
                    const result = await validateRequiredCommandPart(context, INVALID_PART_ACTION_VERB, /** @type {any} */ (invalidPart));
                    // Assert
                    expect(result).toBe(false);
                    // Initial error for invalid part
                    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] Invalid requiredPart '${invalidPart}' specified during validation check for action '${INVALID_PART_ACTION_VERB}'.`));
                    // Warning about inability to dispatch
                    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] context.eventBus.dispatch or context.playerEntity is not available for action '${INVALID_PART_ACTION_VERB}'. Validation failure events cannot be dispatched.`));
                    // Secondary error for failure + skipped dispatch
                    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] Validation failed for action '${INVALID_PART_ACTION_VERB}'. Reason: INVALID_VALIDATION_RULE. Dispatch skipped due to missing prerequisites.`));
                    expect(mockDispatch).not.toHaveBeenCalled();
                    // Check total calls - depends on exact logging, adjust if needed
                    expect(consoleErrorSpy).toHaveBeenCalledTimes(2); // Invalid part error + Dispatch skipped error
                    expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // Warning about inability to dispatch
                });

                test(`should return false, log errors, and NOT dispatch when requiredPart is '${invalidPart}' and playerEntity is missing`, async () => {
                    // Arrange
                    const context = createMockActionContext({ // Uses corrected helper
                        playerEntity: null, // <<< Make dispatch impossible via missing player
                        parsedCommand: { directObjectPhrase: 'thing' },
                        // eventBusDispatch defaults to mockDispatch, but playerEntity is missing
                    });
                    // Act
                    const result = await validateRequiredCommandPart(context, INVALID_PART_ACTION_VERB, /** @type {any} */ (invalidPart));
                    // Assert
                    expect(result).toBe(false);
                    // Initial error for invalid part
                    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] Invalid requiredPart '${invalidPart}' specified during validation check for action '${INVALID_PART_ACTION_VERB}'.`));
                    // Warning about inability to dispatch
                    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] context.eventBus.dispatch or context.playerEntity is not available for action '${INVALID_PART_ACTION_VERB}'. Validation failure events cannot be dispatched.`));
                    // Secondary error for failure + skipped dispatch
                    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] Validation failed for action '${INVALID_PART_ACTION_VERB}'. Reason: INVALID_VALIDATION_RULE. Dispatch skipped due to missing prerequisites.`));
                    expect(mockDispatch).not.toHaveBeenCalled();
                    // Check total calls
                    expect(consoleErrorSpy).toHaveBeenCalledTimes(2); // Invalid part + Dispatch skipped
                    expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // Warning
                });
            });
        }); // End describe('Failure: Invalid `requiredPart` Argument (Sub-Ticket 4.4)')


        // ========================================================================
        // --- TESTS: Missing Context Prerequisites for Dispatch (Sub-Ticket 4.6) ---
        // ========================================================================
        describe('Handling Missing Context Prerequisites for Dispatch (Sub-Ticket 4.6)', () => {
            const FAILING_ACTION_VERB = 'fail_action';
            const SUCCESS_ACTION_VERB = 'success_action';
            const REQUIRED_PART = 'directObjectPhrase'; // Consistent part for these tests

            // --- Scenario 1: Failing Validation + Missing eventBusDispatch ---
            test('AC1: should warn, error, return false when validation fails and eventBusDispatch is missing', async () => {
                // Arrange: Validation fails (missing DO), dispatch is null
                const context = createMockActionContext({ // Uses corrected helper
                    playerEntity: { id: MOCK_PLAYER_ID }, // Player exists
                    parsedCommand: { directObjectPhrase: null }, // Validation should fail
                    eventBusDispatch: null // <<< Dispatch is missing via eventBus
                });
                // Act
                const result = await validateRequiredCommandPart(context, FAILING_ACTION_VERB, REQUIRED_PART);
                // Assert
                expect(result).toBe(false); // AC1.6
                expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // AC1.3
                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] context.eventBus.dispatch or context.playerEntity is not available for action '${FAILING_ACTION_VERB}'. Validation failure events cannot be dispatched.`));
                expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // AC1.4
                expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] Validation failed for action '${FAILING_ACTION_VERB}'. Reason: MISSING_DIRECT_OBJECT. Dispatch skipped due to missing prerequisites.`));
                expect(mockDispatch).not.toHaveBeenCalled(); // AC1.5 (global mock not called)
            });

            // --- Scenario 2: Failing Validation + Missing playerEntity ---
            test('AC2: should warn, error, return false when validation fails and playerEntity is missing', async () => {
                // Arrange: Validation fails (missing DO), playerEntity is null
                const context = createMockActionContext({ // Uses corrected helper
                    playerEntity: null, // <<< Player is missing
                    parsedCommand: { directObjectPhrase: "" }, // Validation should fail
                    // eventBusDispatch defaults to mockDispatch, but dispatch is still impossible
                });
                // Act
                const result = await validateRequiredCommandPart(context, FAILING_ACTION_VERB, REQUIRED_PART);
                // Assert
                expect(result).toBe(false); // AC2.6
                expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // AC2.3
                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] context.eventBus.dispatch or context.playerEntity is not available for action '${FAILING_ACTION_VERB}'. Validation failure events cannot be dispatched.`));
                expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // AC2.4
                expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] Validation failed for action '${FAILING_ACTION_VERB}'. Reason: MISSING_DIRECT_OBJECT. Dispatch skipped due to missing prerequisites.`));
                expect(mockDispatch).not.toHaveBeenCalled(); // AC2.5
            });

            // --- Scenario 3: Successful Validation + Missing eventBusDispatch ---
            // NOTE: The function *still* logs a warning if dispatch is impossible, even if validation succeeds!
            test('AC3: should warn, return true when validation succeeds but eventBusDispatch is missing', async () => {
                // Arrange: Validation succeeds (DO exists), dispatch is null
                const context = createMockActionContext({ // Uses corrected helper
                    playerEntity: { id: MOCK_PLAYER_ID }, // Player exists
                    parsedCommand: { directObjectPhrase: 'the widget' }, // Validation should succeed
                    eventBusDispatch: null // <<< Dispatch is missing via eventBus
                });
                // Act
                const result = await validateRequiredCommandPart(context, SUCCESS_ACTION_VERB, REQUIRED_PART);
                // Assert
                expect(result).toBe(true); // AC3.6 - Validation still passes
                expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // AC3.3 - Warns about inability to dispatch failures
                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] context.eventBus.dispatch or context.playerEntity is not available for action '${SUCCESS_ACTION_VERB}'. Validation failure events cannot be dispatched.`));
                expect(consoleErrorSpy).not.toHaveBeenCalled(); // AC3.4 - No error occurred
                expect(mockDispatch).not.toHaveBeenCalled(); // AC3.5 - No dispatch attempted
            });

            // --- Scenario 4: Successful Validation + Missing playerEntity ---
            // NOTE: Similar to AC3, logs a warning even on success.
            test('AC4: should warn, return true when validation succeeds but playerEntity is missing', async () => {
                // Arrange: Validation succeeds (DO exists), playerEntity is null
                const context = createMockActionContext({ // Uses corrected helper
                    playerEntity: null, // <<< Player is missing
                    parsedCommand: { directObjectPhrase: 'the gadget' }, // Validation should succeed
                    // eventBusDispatch defaults to mockDispatch, but dispatch still impossible
                });
                // Act
                const result = await validateRequiredCommandPart(context, SUCCESS_ACTION_VERB, REQUIRED_PART);
                // Assert
                expect(result).toBe(true); // AC4.6 - Validation still passes
                expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // AC4.3 - Warns about inability to dispatch failures
                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] context.eventBus.dispatch or context.playerEntity is not available for action '${SUCCESS_ACTION_VERB}'. Validation failure events cannot be dispatched.`));
                expect(consoleErrorSpy).not.toHaveBeenCalled(); // AC4.4 - No error occurred
                expect(mockDispatch).not.toHaveBeenCalled(); // AC4.5 - No dispatch attempted
            });
        }); // End describe('Handling Missing Context Prerequisites for Dispatch (Sub-Ticket 4.6)')

    }); // End describe('validateRequiredCommandPart')

}); // End describe('actionValidationUtils')