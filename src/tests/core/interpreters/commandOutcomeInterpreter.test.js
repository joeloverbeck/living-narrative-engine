// src/tests/core/interpreters/commandOutcomeInterpreter.test.js
// --- FILE START ---

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// --- Module to Test ---
import CommandOutcomeInterpreter from '../../../core/interpreters/commandOutcomeInterpreter.js';

// --- Constants ---
import TurnDirective from '../../../core/constants/turnDirectives.js';

// --- Mocks ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

const mockDispatcher = {
    dispatchSafely: jest.fn(),
};

// --- Test Suite ---
describe('CommandOutcomeInterpreter', () => {
    /** @type {CommandOutcomeInterpreter} */
    let interpreter;
    const actorId = 'player1';

    beforeEach(() => {
        jest.clearAllMocks();
        mockDispatcher.dispatchSafely.mockResolvedValue(true);
        interpreter = new CommandOutcomeInterpreter({
            dispatcher: mockDispatcher,
            logger: mockLogger,
        });
    });

    // --- Constructor Tests ---
    it('should instantiate successfully with valid dependencies', () => {
        expect(interpreter).toBeInstanceOf(CommandOutcomeInterpreter);
        expect(mockLogger.debug).toHaveBeenCalledWith('CommandOutcomeInterpreter: Instance created successfully.');
    });

    it('should throw error if logger is invalid', () => {
        expect(() => new CommandOutcomeInterpreter({ dispatcher: mockDispatcher, logger: null }))
            .toThrow('CommandOutcomeInterpreter: Invalid or missing ILogger dependency.');
        expect(() => new CommandOutcomeInterpreter({ dispatcher: mockDispatcher, logger: {} }))
            .toThrow('CommandOutcomeInterpreter: Invalid or missing ILogger dependency.');
    });

    it('should throw error if dispatcher is invalid', () => {
        expect(() => new CommandOutcomeInterpreter({ dispatcher: null, logger: mockLogger }))
            .toThrow('CommandOutcomeInterpreter: Invalid or missing ISafeEventDispatcher dependency.');
        expect(() => new CommandOutcomeInterpreter({ dispatcher: {}, logger: mockLogger }))
            .toThrow('CommandOutcomeInterpreter: Invalid or missing ISafeEventDispatcher dependency.');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing ISafeEventDispatcher'));
    });

    // --- interpret Method Tests ---

    it('should throw error if actorId is invalid', async () => {
        await expect(interpreter.interpret({ success: true, turnEnded: true }, null))
            .rejects.toThrow('CommandOutcomeInterpreter: Invalid actorId provided (null).');
        expect(mockLogger.error).toHaveBeenCalledWith('CommandOutcomeInterpreter: Invalid actorId provided (null).');
    });

    // --- *** CORRECTION 3: Adjust error message assertion *** ---
    it('should throw error if CommandResult is malformed (missing success)', async () => {
        const badResult = { turnEnded: true };
        mockDispatcher.dispatchSafely.mockResolvedValue(true);
        const expectedBaseErrorMessage = `CommandOutcomeInterpreter: Invalid CommandResult structure for actor ${actorId}. Missing 'success' or 'turnEnded'.`;

        // Assert against the specific error message thrown by the implementation
        await expect(interpreter.interpret(badResult, actorId))
            .rejects.toThrow(expectedBaseErrorMessage);

        // Verify logger was called with the *full* message including JSON
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${expectedBaseErrorMessage} Result: ${JSON.stringify(badResult)}`));
        // Verify core:system_error_occurred was dispatched with the base message
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:system_error_occurred', expect.objectContaining({ message: expectedBaseErrorMessage }));
    });

    it('should throw error if CommandResult is malformed (missing turnEnded)', async () => {
        const badResult = { success: true };
        mockDispatcher.dispatchSafely.mockResolvedValue(true);
        const expectedBaseErrorMessage = `CommandOutcomeInterpreter: Invalid CommandResult structure for actor ${actorId}. Missing 'success' or 'turnEnded'.`;

        await expect(interpreter.interpret(badResult, actorId))
            .rejects.toThrow(expectedBaseErrorMessage);

        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${expectedBaseErrorMessage} Result: ${JSON.stringify(badResult)}`));
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:system_error_occurred', expect.objectContaining({ message: expectedBaseErrorMessage }));
    });
    // --- *** END CORRECTION 3 *** ---

    // --- Test Matrix Cases ---

    it('Matrix [Success + TurnEnded]: should return END_TURN_SUCCESS and dispatch core:action_executed', async () => {
        const resultData = { success: true, turnEnded: true, message: 'Victory!', actionResult: { actionId: 'attack', damage: 10 } };
        const expectedPayload = {
            actorId: actorId,
            actionId: 'attack',
            outcome: 'Victory!',
            details: { actionId: 'attack', damage: 10 },
        };

        const directive = await interpreter.interpret(resultData, actorId);

        expect(directive).toBe(TurnDirective.END_TURN_SUCCESS);
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:action_executed', expectedPayload);
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('Matrix [Success + !TurnEnded]: should return RE_PROMPT and dispatch core:action_executed', async () => {
        const resultData = { success: true, turnEnded: false, message: 'Looked around.', actionResult: { actionId: 'look' } };
        const expectedPayload = {
            actorId: actorId,
            actionId: 'look',
            outcome: 'Looked around.',
            details: { actionId: 'look' },
        };

        const directive = await interpreter.interpret(resultData, actorId);

        expect(directive).toBe(TurnDirective.RE_PROMPT);
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:action_executed', expectedPayload);
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('Matrix [Failure + TurnEnded]: should return END_TURN_FAILURE and dispatch core:action_failed', async () => {
        const errorObj = new Error('Critical fumble!');
        const resultData = { success: false, turnEnded: true, error: errorObj };
        const expectedPayload = {
            actorId: actorId,
            errorMessage: 'Critical fumble!', // Correctly extracted from Error object
            details: errorObj,
        };

        const directive = await interpreter.interpret(resultData, actorId);

        expect(directive).toBe(TurnDirective.END_TURN_FAILURE);
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:action_failed', expectedPayload);
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // --- *** CORRECTION 4: Adjust expected payload based on logic change *** ---
    it('Matrix [Failure + !TurnEnded]: should return RE_PROMPT and dispatch core:action_failed', async () => {
        const resultData = { success: false, turnEnded: false, message: 'Cannot attack that target.', error: 'Invalid target' };
        // Now expects errorMessage to be result.message because result.error is not an Error
        const expectedPayload = {
            actorId: actorId,
            errorMessage: 'Cannot attack that target.',
            details: 'Invalid target', // details still contains the raw error
        };

        const directive = await interpreter.interpret(resultData, actorId);

        expect(directive).toBe(TurnDirective.RE_PROMPT);
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:action_failed', expectedPayload); // Assertion should now pass
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });
    // --- *** END CORRECTION 4 *** ---

    // --- VED Dispatch Failure Cases ---

    it('VED Failure Path [Success + TurnEnded]: should return intended directive (END_TURN_SUCCESS) and log warning', async () => {
        mockDispatcher.dispatchSafely.mockResolvedValue(false);
        const resultData = { success: true, turnEnded: true, message: 'Victory!' };

        const directive = await interpreter.interpret(resultData, actorId);

        expect(directive).toBe(TurnDirective.END_TURN_SUCCESS);
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:action_executed', expect.any(Object));
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`SafeEventDispatcher reported failure dispatching 'core:action_executed' for actor ${actorId}`)
        );
    });

    it('VED Failure Path [Failure + !TurnEnded]: should return intended directive (RE_PROMPT) and log warning', async () => {
        mockDispatcher.dispatchSafely.mockResolvedValue(false);
        const resultData = { success: false, turnEnded: false, error: 'Bad command' };

        const directive = await interpreter.interpret(resultData, actorId);

        expect(directive).toBe(TurnDirective.RE_PROMPT);
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:action_failed', expect.any(Object));
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`SafeEventDispatcher reported failure dispatching 'core:action_failed' for actor ${actorId}`)
        );
    });
});
// --- FILE END ---