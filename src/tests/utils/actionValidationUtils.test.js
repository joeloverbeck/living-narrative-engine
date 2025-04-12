// src/tests/utils/actionValidationUtils.test.js

import {beforeEach, afterEach, describe, expect, jest, test} from '@jest/globals';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js'; // Corrected path assuming structure

// --- Mocks & Spies ---

// Mock for the dispatch function within the ActionContext
const mockDispatch = jest.fn();

// Spies for console methods to verify logging side-effects
let consoleErrorSpy;
let consoleWarnSpy;

// --- Helper Functions ---

/**
 * Factory function to create a mock ActionContext object for testing.
 * Allows overriding default mock properties.
 * Note: For tests specifically checking missing context/parsedCommand,
 * this helper might not be used directly, or used with specific null overrides.
 *
 * @param {object} overrides - Properties to override in the default mock context.
 * @param {object | null} [overrides.playerEntity={ id: 'player-1', name: 'Tester' }] - Mock player entity. Can be null.
 * @param {object | null} [overrides.parsedCommand={}] - Mock parsed command object. Can be null.
 * @param {function | null} [overrides.dispatch=mockDispatch] - Mock dispatch function. Can be null/undefined.
 * @returns {import('../../actions/actionTypes.js').ActionContext | null | undefined} A mock ActionContext or potentially null/undefined based on overrides.
 */
const createMockActionContext = (overrides = {}) => {
    // Default player entity structure
    const defaultPlayerEntity = {id: 'player-1', name: 'Tester'};
    let playerEntity;
    if (overrides.playerEntity === null) {
        playerEntity = null;
    } else if (overrides.playerEntity !== undefined) {
        playerEntity = {...defaultPlayerEntity, ...overrides.playerEntity};
    } else {
        playerEntity = defaultPlayerEntity;
    }

    // Default parsed command structure (empty object)
    let parsedCommand;
    if (overrides.parsedCommand === null) {
        parsedCommand = null;
    } else if (overrides.parsedCommand !== undefined) {
        parsedCommand = {...overrides.parsedCommand};
    } else {
        parsedCommand = {}; // Default to empty object if not overridden
    }

    // Default dispatch function
    const dispatch = overrides.dispatch === undefined ? mockDispatch : overrides.dispatch;

    return {
        playerEntity: playerEntity,
        parsedCommand: parsedCommand,
        dispatch: dispatch,
        // Add other context properties if needed by the function or future tests
    };
};


// --- Test Suite Setup ---

describe('actionValidationUtils', () => {

    // Setup spies before each test and clear mocks
    beforeEach(() => {
        mockDispatch.mockClear();
        // Capture console logs without printing them during tests
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
    });

    // Restore spies after each test
    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    // --- Tests for validateRequiredCommandPart ---
    describe('validateRequiredCommandPart', () => {
        const MOCK_PLAYER_ID = 'player-1'; // Consistent player ID for tests
        const MOCK_ACTION_VERB = 'do_something'; // Consistent action verb for tests

        // --- Basic Setup Tests (Implicitly Checked by Running) ---
        test('should have the basic structure and mocks ready', () => {
            const context = createMockActionContext({
                playerEntity: {id: MOCK_PLAYER_ID},
                parsedCommand: {directObjectPhrase: 'apple'}
            });
            expect(context).toBeDefined();
            expect(context.dispatch).toBe(mockDispatch);
            expect(typeof validateRequiredCommandPart).toBe('function');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        // ========================================================================
        // --- NEW TESTS: Early Exit on Missing Core Context (Sub-Ticket 4.5) ---
        // ========================================================================
        describe('Handling Missing Core Context/ParsedCommand (Sub-Ticket 4.5)', () => {
            const DUMMY_VERB = 'test_verb';
            const DUMMY_PART = 'directObjectPhrase'; // Value doesn't matter much here

            test('AC1: should return false and log error if context is null', () => {
                // Arrange
                const context = null;

                // Act
                const result = validateRequiredCommandPart(/** @type {any} */ (context), DUMMY_VERB, DUMMY_PART);

                // Assert
                expect(result).toBe(false); // AC 1.2
                expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // AC 1.3
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    expect.stringContaining(`[validateRequiredCommandPart] Invalid context provided for action '${DUMMY_VERB}'. Cannot validate.`) // AC 1.3
                );
                expect(mockDispatch).not.toHaveBeenCalled(); // AC 1.4
                expect(consoleWarnSpy).not.toHaveBeenCalled(); // AC 1.5
            });

            test('AC1: should return false and log error if context is undefined', () => {
                // Arrange
                const context = undefined;

                // Act
                const result = validateRequiredCommandPart(/** @type {any} */ (context), DUMMY_VERB, DUMMY_PART);

                // Assert
                expect(result).toBe(false); // AC 1.2
                expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // AC 1.3
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    expect.stringContaining(`[validateRequiredCommandPart] Invalid context provided for action '${DUMMY_VERB}'. Cannot validate.`) // AC 1.3
                );
                expect(mockDispatch).not.toHaveBeenCalled(); // AC 1.4
                expect(consoleWarnSpy).not.toHaveBeenCalled(); // AC 1.5
            });

            test('AC2: should return false and log error if context.parsedCommand is missing (null)', () => {
                // Arrange
                const context = createMockActionContext({
                    playerEntity: {id: MOCK_PLAYER_ID},
                    dispatch: mockDispatch,
                    parsedCommand: null // Explicitly missing parsedCommand
                });

                // Act
                const result = validateRequiredCommandPart(context, DUMMY_VERB, DUMMY_PART);

                // Assert
                expect(result).toBe(false); // AC 2.2
                expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // AC 2.3
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    expect.stringContaining(`[validateRequiredCommandPart] context.parsedCommand is missing for action '${DUMMY_VERB}'. Cannot validate required part '${DUMMY_PART}'.`) // AC 2.3
                );
                expect(mockDispatch).not.toHaveBeenCalled(); // AC 2.4
                expect(consoleWarnSpy).not.toHaveBeenCalled(); // AC 2.5
            });

            test('AC2: should return false and log error if context.parsedCommand is missing (undefined)', () => {
                // Arrange
                // Create a context object manually or modify helper if needed
                const context = {
                    playerEntity: {id: MOCK_PLAYER_ID, name: 'Tester'},
                    dispatch: mockDispatch,
                    parsedCommand: undefined // Explicitly undefined
                };

                // Act
                const result = validateRequiredCommandPart(context, DUMMY_VERB, DUMMY_PART);

                // Assert
                expect(result).toBe(false); // AC 2.2
                expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // AC 2.3
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    expect.stringContaining(`[validateRequiredCommandPart] context.parsedCommand is missing for action '${DUMMY_VERB}'. Cannot validate required part '${DUMMY_PART}'.`) // AC 2.3
                );
                expect(mockDispatch).not.toHaveBeenCalled(); // AC 2.4
                expect(consoleWarnSpy).not.toHaveBeenCalled(); // AC 2.5
            });
        }); // End describe('Handling Missing Core Context/ParsedCommand (Sub-Ticket 4.5)')


        // --- Successful Validation Tests (Sub-Ticket 4.2) ---
        describe('Successful Validation (Sub-Ticket 4.2)', () => {
            test('should return true if the required directObjectPhrase exists and is non-empty', () => {
                // Arrange
                const context = createMockActionContext({
                    playerEntity: {id: MOCK_PLAYER_ID},
                    parsedCommand: {directObjectPhrase: 'the shiny key'}
                });
                const actionVerb = 'unlock';
                const requiredPart = 'directObjectPhrase';
                // Act
                const result = validateRequiredCommandPart(context, actionVerb, requiredPart);
                // Assert
                expect(result).toBe(true);
                expect(mockDispatch).not.toHaveBeenCalled();
                expect(consoleErrorSpy).not.toHaveBeenCalled();
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            test('should return true if the required indirectObjectPhrase exists and is non-empty', () => {
                // Arrange
                const context = createMockActionContext({
                    playerEntity: {id: MOCK_PLAYER_ID},
                    parsedCommand: {directObjectPhrase: 'the coin', indirectObjectPhrase: 'the slot'}
                });
                const actionVerb = 'put';
                const requiredPart = 'indirectObjectPhrase';
                // Act
                const result = validateRequiredCommandPart(context, actionVerb, requiredPart);
                // Assert
                expect(result).toBe(true);
                expect(mockDispatch).not.toHaveBeenCalled();
                expect(consoleErrorSpy).not.toHaveBeenCalled();
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });
        }); // End describe('Successful Validation (Sub-Ticket 4.2)')

        // --- Failure Scenarios: Missing/Empty Command Parts (Sub-Ticket 4.3) ---
        describe('Failure: Missing/Empty Command Parts (Sub-Ticket 4.3)', () => {
            test('should return false and dispatch validation failed if directObjectPhrase is null', () => {
                // Arrange
                const context = createMockActionContext({
                    playerEntity: {id: MOCK_PLAYER_ID},
                    parsedCommand: {directObjectPhrase: null}
                });
                const actionVerb = 'take';
                const requiredPart = 'directObjectPhrase';
                const expectedPayload = {
                    actorId: MOCK_PLAYER_ID,
                    actionVerb: actionVerb,
                    reasonCode: 'MISSING_DIRECT_OBJECT'
                };
                // Act
                const result = validateRequiredCommandPart(context, actionVerb, requiredPart);
                // Assert
                expect(result).toBe(false);
                expect(mockDispatch).toHaveBeenCalledTimes(1);
                expect(mockDispatch).toHaveBeenCalledWith('action:validation_failed', expectedPayload);
                expect(consoleErrorSpy).not.toHaveBeenCalled();
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            test('should return false and dispatch validation failed if directObjectPhrase is an empty string', () => {
                // Arrange
                const context = createMockActionContext({
                    playerEntity: {id: MOCK_PLAYER_ID},
                    parsedCommand: {directObjectPhrase: ""}
                });
                const actionVerb = 'examine';
                const requiredPart = 'directObjectPhrase';
                const expectedPayload = {
                    actorId: MOCK_PLAYER_ID,
                    actionVerb: actionVerb,
                    reasonCode: 'MISSING_DIRECT_OBJECT'
                };
                // Act
                const result = validateRequiredCommandPart(context, actionVerb, requiredPart);
                // Assert
                expect(result).toBe(false);
                expect(mockDispatch).toHaveBeenCalledTimes(1);
                expect(mockDispatch).toHaveBeenCalledWith('action:validation_failed', expectedPayload);
                expect(consoleErrorSpy).not.toHaveBeenCalled();
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            test('should return false and dispatch validation failed if indirectObjectPhrase is null', () => {
                // Arrange
                const context = createMockActionContext({
                    playerEntity: {id: MOCK_PLAYER_ID},
                    parsedCommand: {directObjectPhrase: 'coin', indirectObjectPhrase: null}
                });
                const actionVerb = 'put';
                const requiredPart = 'indirectObjectPhrase';
                const expectedPayload = {
                    actorId: MOCK_PLAYER_ID,
                    actionVerb: actionVerb,
                    reasonCode: 'MISSING_INDIRECT_OBJECT'
                };
                // Act
                const result = validateRequiredCommandPart(context, actionVerb, requiredPart);
                // Assert
                expect(result).toBe(false);
                expect(mockDispatch).toHaveBeenCalledTimes(1);
                expect(mockDispatch).toHaveBeenCalledWith('action:validation_failed', expectedPayload);
                expect(consoleErrorSpy).not.toHaveBeenCalled();
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            test('should return false and dispatch validation failed if indirectObjectPhrase is an empty string', () => {
                // Arrange
                const context = createMockActionContext({
                    playerEntity: {id: MOCK_PLAYER_ID},
                    parsedCommand: {directObjectPhrase: 'key', indirectObjectPhrase: ""}
                });
                const actionVerb = 'use';
                const requiredPart = 'indirectObjectPhrase';
                const expectedPayload = {
                    actorId: MOCK_PLAYER_ID,
                    actionVerb: actionVerb,
                    reasonCode: 'MISSING_INDIRECT_OBJECT'
                };
                // Act
                const result = validateRequiredCommandPart(context, actionVerb, requiredPart);
                // Assert
                expect(result).toBe(false);
                expect(mockDispatch).toHaveBeenCalledTimes(1);
                expect(mockDispatch).toHaveBeenCalledWith('action:validation_failed', expectedPayload);
                expect(consoleErrorSpy).not.toHaveBeenCalled();
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });
        }); // End describe('Failure: Missing/Empty Command Parts (Sub-Ticket 4.3)')

        // --- Failure Scenario: Invalid `requiredPart` Argument (Sub-Ticket 4.4) ---
        describe('Failure: Invalid `requiredPart` Argument (Sub-Ticket 4.4)', () => {
            const invalidRequiredParts = ['prepositionalPhrase', 'someRandomString', '', null, undefined];
            const INVALID_PART_ACTION_VERB = 'do_invalid_part';

            invalidRequiredParts.forEach((invalidPart) => {
                test(`should return false, log error, and dispatch INVALID_VALIDATION_RULE when requiredPart is '${invalidPart}' and dispatch is possible`, () => {
                    // Arrange
                    const context = createMockActionContext({
                        playerEntity: {id: MOCK_PLAYER_ID},
                        parsedCommand: {directObjectPhrase: 'thing'} // Ensure parsedCommand exists
                    });
                    const expectedPayload = {
                        actorId: MOCK_PLAYER_ID,
                        actionVerb: INVALID_PART_ACTION_VERB,
                        reasonCode: 'INVALID_VALIDATION_RULE'
                    };
                    // Act
                    const result = validateRequiredCommandPart(context, INVALID_PART_ACTION_VERB, /** @type {any} */ (invalidPart));
                    // Assert
                    expect(result).toBe(false);
                    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] Invalid requiredPart '${invalidPart}' specified during validation check for action '${INVALID_PART_ACTION_VERB}'.`));
                    expect(mockDispatch).toHaveBeenCalledTimes(1);
                    expect(mockDispatch).toHaveBeenCalledWith('action:validation_failed', expectedPayload);
                    expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Dispatch skipped'));
                    expect(consoleWarnSpy).not.toHaveBeenCalled(); // No warning if dispatch is possible
                });

                test(`should return false, log errors, and NOT dispatch when requiredPart is '${invalidPart}' and dispatch is missing`, () => {
                    // Arrange
                    const context = createMockActionContext({
                        playerEntity: {id: MOCK_PLAYER_ID},
                        parsedCommand: {directObjectPhrase: 'thing'},
                        dispatch: null // Make dispatch impossible
                    });
                    // Act
                    const result = validateRequiredCommandPart(context, INVALID_PART_ACTION_VERB, /** @type {any} */ (invalidPart));
                    // Assert
                    expect(result).toBe(false);
                    // Initial error for invalid part
                    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] Invalid requiredPart '${invalidPart}' specified during validation check for action '${INVALID_PART_ACTION_VERB}'.`));
                    // Warning about inability to dispatch
                    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] context.dispatch or context.playerEntity is not available for action '${INVALID_PART_ACTION_VERB}'. Validation failure events cannot be dispatched.`));
                    // Secondary error for failure + skipped dispatch
                    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] Validation failed for action '${INVALID_PART_ACTION_VERB}'. Reason: INVALID_VALIDATION_RULE. Dispatch skipped due to missing prerequisites.`));
                    expect(mockDispatch).not.toHaveBeenCalled();
                    // Check total calls
                    expect(consoleErrorSpy).toHaveBeenCalledTimes(2); // Initial error + skipped dispatch error
                    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
                });

                test(`should return false, log errors, and NOT dispatch when requiredPart is '${invalidPart}' and playerEntity is missing`, () => {
                    // Arrange
                    const context = createMockActionContext({
                        playerEntity: null, // Make dispatch impossible
                        parsedCommand: {directObjectPhrase: 'thing'},
                        dispatch: mockDispatch // Dispatch function exists
                    });
                    // Act
                    const result = validateRequiredCommandPart(context, INVALID_PART_ACTION_VERB, /** @type {any} */ (invalidPart));
                    // Assert
                    expect(result).toBe(false);
                    // Initial error for invalid part
                    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] Invalid requiredPart '${invalidPart}' specified during validation check for action '${INVALID_PART_ACTION_VERB}'.`));
                    // Warning about inability to dispatch
                    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] context.dispatch or context.playerEntity is not available for action '${INVALID_PART_ACTION_VERB}'. Validation failure events cannot be dispatched.`));
                    // Secondary error for failure + skipped dispatch
                    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] Validation failed for action '${INVALID_PART_ACTION_VERB}'. Reason: INVALID_VALIDATION_RULE. Dispatch skipped due to missing prerequisites.`));
                    expect(mockDispatch).not.toHaveBeenCalled();
                    // Check total calls
                    expect(consoleErrorSpy).toHaveBeenCalledTimes(2); // Initial error + skipped dispatch error
                    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
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

            // --- Scenario 1: Failing Validation + Missing dispatch ---
            test('AC1: should warn, error, return false when validation fails and dispatch is missing', () => {
                // Arrange: Validation fails (missing DO), dispatch is null
                const context = createMockActionContext({
                    playerEntity: {id: MOCK_PLAYER_ID}, // Player exists
                    parsedCommand: {directObjectPhrase: null}, // Validation should fail
                    dispatch: null // Dispatch is missing
                });
                // Act
                const result = validateRequiredCommandPart(context, FAILING_ACTION_VERB, REQUIRED_PART);
                // Assert
                expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // AC1.3
                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] context.dispatch or context.playerEntity is not available for action '${FAILING_ACTION_VERB}'. Validation failure events cannot be dispatched.`));
                expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // AC1.4
                expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] Validation failed for action '${FAILING_ACTION_VERB}'. Reason: MISSING_DIRECT_OBJECT. Dispatch skipped due to missing prerequisites.`));
                expect(mockDispatch).not.toHaveBeenCalled(); // AC1.5
                expect(result).toBe(false); // AC1.6
            });

            // --- Scenario 2: Failing Validation + Missing playerEntity ---
            test('AC2: should warn, error, return false when validation fails and playerEntity is missing', () => {
                // Arrange: Validation fails (missing DO), playerEntity is null
                const context = createMockActionContext({
                    playerEntity: null, // Player is missing
                    parsedCommand: {directObjectPhrase: ""}, // Validation should fail
                    dispatch: mockDispatch // Dispatch exists
                });
                // Act
                const result = validateRequiredCommandPart(context, FAILING_ACTION_VERB, REQUIRED_PART);
                // Assert
                expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // AC2.3
                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] context.dispatch or context.playerEntity is not available for action '${FAILING_ACTION_VERB}'. Validation failure events cannot be dispatched.`));
                expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // AC2.4
                expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] Validation failed for action '${FAILING_ACTION_VERB}'. Reason: MISSING_DIRECT_OBJECT. Dispatch skipped due to missing prerequisites.`));
                expect(mockDispatch).not.toHaveBeenCalled(); // AC2.5
                expect(result).toBe(false); // AC2.6
            });

            // --- Scenario 3: Successful Validation + Missing dispatch ---
            test('AC3: should warn, return true when validation succeeds but dispatch is missing', () => {
                // Arrange: Validation succeeds (DO exists), dispatch is null
                const context = createMockActionContext({
                    playerEntity: {id: MOCK_PLAYER_ID}, // Player exists
                    parsedCommand: {directObjectPhrase: 'the widget'}, // Validation should succeed
                    dispatch: null // Dispatch is missing
                });
                // Act
                const result = validateRequiredCommandPart(context, SUCCESS_ACTION_VERB, REQUIRED_PART);
                // Assert
                expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // AC3.3
                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] context.dispatch or context.playerEntity is not available for action '${SUCCESS_ACTION_VERB}'. Validation failure events cannot be dispatched.`));
                expect(consoleErrorSpy).not.toHaveBeenCalled(); // AC3.4
                expect(mockDispatch).not.toHaveBeenCalled(); // AC3.5
                expect(result).toBe(true); // AC3.6
            });

            // --- Scenario 4: Successful Validation + Missing playerEntity ---
            test('AC4: should warn, return true when validation succeeds but playerEntity is missing', () => {
                // Arrange: Validation succeeds (DO exists), playerEntity is null
                const context = createMockActionContext({
                    playerEntity: null, // Player is missing
                    parsedCommand: {directObjectPhrase: 'the gadget'}, // Validation should succeed
                    dispatch: mockDispatch // Dispatch exists
                });
                // Act
                const result = validateRequiredCommandPart(context, SUCCESS_ACTION_VERB, REQUIRED_PART);
                // Assert
                expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // AC4.3
                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`[validateRequiredCommandPart] context.dispatch or context.playerEntity is not available for action '${SUCCESS_ACTION_VERB}'. Validation failure events cannot be dispatched.`));
                expect(consoleErrorSpy).not.toHaveBeenCalled(); // AC4.4
                expect(mockDispatch).not.toHaveBeenCalled(); // AC4.5
                expect(result).toBe(true); // AC4.6
            });
        }); // End describe('Handling Missing Context Prerequisites for Dispatch (Sub-Ticket 4.6)')


        // --- Placeholder Comments Review ---
        /*
        The original placeholder comments are now partially addressed:
        - 'should return false and log error if context is invalid' -> Covered by Sub-Ticket 4.5 tests above.
        - 'should return false and log error if context.parsedCommand is missing' -> Covered by Sub-Ticket 4.5 tests above.
        - 'should return false, log warning, and NOT dispatch if dispatch is missing (when required part IS valid but missing)' -> Covered by Sub-Ticket 4.6, Scenario 1 & 2 tests above.
        - 'should return false, log error, and NOT dispatch if playerEntity is missing (when required part IS valid but missing)' -> Covered by Sub-Ticket 4.6, Scenario 1 & 2 tests above.

        Keeping the original placeholder comments might be confusing. Removing them as they are now covered by specific sub-ticket tests.
        */

    }); // End describe('validateRequiredCommandPart')

}); // End describe('actionValidationUtils')