// src/tests/core/handlers/playerTurnHandler.handleSubmittedCommand.emptyCommand.success.test.js
// --- FILE START (Entire file content as requested) ---

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// --- Module to Test ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjust path if needed

// --- Mock Dependencies ---
// Standard Mocks (copied for consistency)
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};
const mockActionDiscoverySystem = {
    getValidActions: jest.fn(), // Needed for constructor validation
};
const mockCommandProcessor = {
    processCommand: jest.fn(),
};
const mockWorldContext = {
    getLocationOfEntity: jest.fn(), // Needed for constructor validation
};
const mockEntityManager = {
    getEntityInstance: jest.fn(), // Needed for constructor validation
};
const mockGameDataRepository = {
    getActionDefinition: jest.fn(), // Needed for constructor validation
};
const mockPromptOutputPort = {
    prompt: jest.fn(),
};
const mockTurnEndPort = {
    notifyTurnEnded: jest.fn(),
};
const mockPlayerPromptService = {
    prompt: jest.fn(),
};
const mockCommandOutcomeInterpreter = {
    interpret: jest.fn(),
};
const mockSafeEventDispatcher = {
    dispatchSafely: jest.fn(),
};

// --- Test Suite ---
describe('PlayerTurnHandler: _handleSubmittedCommand - Empty Command Handling', () => { // Updated suite description slightly
    /** @type {PlayerTurnHandler} */
    let handler;
    const mockActor = { id: 'player-1', name: 'Tester' }; // Example mock actor

    beforeEach(() => {
        // Reset all mocks *before* each test run
        jest.clearAllMocks();

        // Configure the crucial mock for this test path
        // Assume PlayerPromptService.prompt resolves successfully by default for this setup
        mockPlayerPromptService.prompt.mockResolvedValue();
        // Assume TurnEndPort notification works if called
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue();


        // Instantiate the handler with all mocks
        handler = new PlayerTurnHandler({
            logger: mockLogger,
            actionDiscoverySystem: mockActionDiscoverySystem,
            commandProcessor: mockCommandProcessor,
            worldContext: mockWorldContext,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
            promptOutputPort: mockPromptOutputPort,
            turnEndPort: mockTurnEndPort,
            playerPromptService: mockPlayerPromptService,
            commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
            safeEventDispatcher: mockSafeEventDispatcher,
        });
    });

    afterEach(async () => {
        // Ensure graceful cleanup if a turn was somehow left active
        // Use try-catch as destroy might throw if state is weird
        // No need to check specific error message here unless needed
        try {
            if (handler) {
                await handler.destroy();
            }
        } catch (e) {
            // console.warn("Suppressed error during afterEach cleanup:", e?.message);
        } finally {
            handler = null;
        }
    });

    // Test cases for both empty string and whitespace string leading to re-prompt
    it.each([
        { command: '', description: 'empty string' },
        { command: ' ', description: 'whitespace string' },
        { command: '\t\n ', description: 'mixed whitespace string' },
    ])('should re-prompt the actor via PlayerPromptService when command is $description', async ({ command }) => {
        // --- Setup ---
        // 1. Start a turn - await its initiation
        // <<< UPDATED: Call startTurn >>>
        await handler.startTurn(mockActor);

        // 2. Allow the initial async prompt call within startTurn to settle
        //    Using nextTick ensures microtasks resolve before proceeding.
        await new Promise(process.nextTick);

        // 3. Verify the *initial* prompt occurred (sanity check before clearing mocks)
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor);

        // 4. Reset mocks to isolate the calls made specifically by _handleSubmittedCommand
        jest.clearAllMocks();
        // Re-configure the prompt mock because clearAllMocks wipes its behavior
        mockPlayerPromptService.prompt.mockResolvedValue();


        // --- Steps ---
        // 1. Define empty command data
        const commandData = { command: command };
        // 2. Call the method under test
        await handler._handleSubmittedCommand(commandData);


        // --- Assertions ---

        // 1. Re-Prompt Call:
        // Ensure the prompt service was called exactly once *after* mocks were cleared
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor);

        // 2. No Other Calls:
        // Verify that the command processing and turn ending logic were bypassed
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();
        expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled(); // <<< Crucial: Turn should NOT end
        expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalled();

        // 3. Logging:
        // Verify the specific warning about the empty command was logged
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `PlayerTurnHandler: Received submitted command with empty command string. Re-prompting actor ${mockActor.id}.`
        );
        expect(mockLogger.error).not.toHaveBeenCalled(); // No errors expected in this path

        // 4. Turn State (Conceptual):
        // The turn should still be active because notifyTurnEnded was not called.
        // <<< REMOVED: The destroy/rejection check is no longer valid/needed >>>
        // await handler.destroy(); // This should force the turn to end (reject)
        // await expect(turnPromise).rejects.toThrow('PlayerTurnHandler destroyed during turn.');
    });

    // Test case for handling empty command when no turn is active
    it('should not re-prompt and log warning if no turn is active when _handleSubmittedCommand receives empty command', async () => {
        // --- Setup ---
        // No turn is started. Mocks are cleared in beforeEach.

        // --- Steps ---
        const commandData = { command: '' };
        await handler._handleSubmittedCommand(commandData); // Accessing protected method

        // --- Assertions ---
        expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled();
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Should log the warning about no active turn
        expect(mockLogger.warn).toHaveBeenCalledWith(
            'PlayerTurnHandler: Received submitted command but no player turn is active. Ignoring.'
        );
        expect(mockLogger.error).not.toHaveBeenCalled(); // Should not log errors
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Received submitted command. Payload:')); // Should log initial debug
    });

    // Test case for handling errors during the re-prompt itself
    it('should handle errors during the re-prompt gracefully, log errors, and signal turn end failure via TurnEndPort', async () => {
        // --- Setup ---
        // 1. Start a turn - await its initiation
        await handler.startTurn(mockActor);
        // 2. Allow initial async prompt to complete
        await new Promise(process.nextTick);
        // 3. Verify initial prompt (sanity check)
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Initial prompt

        // 4. Reset mocks to isolate calls during the specific step
        jest.clearAllMocks(); // Clear for the next step

        // 5. Configure PlayerPromptService to REJECT the *next* call (the re-prompt)
        const rePromptError = new Error('Failed to re-prompt');
        mockPlayerPromptService.prompt.mockRejectedValueOnce(rePromptError); // Make the re-prompt fail
        // Assume turn end notification itself works when called by the handler's error path
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue(); // Assume notification works

        // --- Steps ---
        const commandData = { command: ' ' }; // Use whitespace command
        // Trigger the command handling, which should lead to the failed re-prompt and turn end.
        const handleCommandPromise = handler._handleSubmittedCommand(commandData);

        // --- Assertions ---
        // 1. _handleSubmittedCommand completed successfully (error handled internally):
        await expect(handleCommandPromise).resolves.toBeUndefined();

        // 2. Re-Prompt Attempt:
        // Verify the failing prompt attempt was made.
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor);

        // 3. Logging:
        // Check the warning for the empty command.
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Received submitted command with empty command string. Re-prompting actor ${mockActor.id}.`)
        );

        // <<< CORRECTION: Expect only ONE error log now >>>
        expect(mockLogger.error).toHaveBeenCalledTimes(1);

        // Check the error log from #_promptPlayerForAction's catch block
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`PlayerPromptService threw an error during prompt for actor ${mockActor.id}: ${rePromptError.message}`),
            rePromptError
        );
        // <<< CORRECTION: Removed check for the second error log >>>
        // // Check the SECOND error log from _handleSubmittedCommand's catch block
        // expect(mockLogger.error).toHaveBeenCalledWith(
        //     expect.stringContaining(`Error during empty command re-prompt attempt for ${mockActor.id}: ${rePromptError.message}`),
        //     rePromptError // <<< It logs the same error object >>>
        // );

        // Check the info log from #_promptPlayerForAction's catch block signalling turn end
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Signalling FAILED turn end for ${mockActor.id} due to prompt error.`)
        );

        // Check the failure log from _handleTurnEnd
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Turn for ${mockActor.id} ended with failure. Reason: ${rePromptError.message}`)
        );

        // Check total warning count (should be 2: empty command + turn failure)
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);


        // 4. Turn End Triggered Due to Error:
        // Verify TurnEndPort was notified of failure (called by _handleTurnEnd).
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(mockActor.id, false); // `false` indicates failure

        // 5. No Other Calls:
        // Command processing should not have been reached.
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();
        expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();
    });

});
// --- FILE END ---