// src/tests/core/handlers/playerTurnHandler.handleSubmittedCommand.emptyCommand.promptError.test.js
// --- FILE START ---

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Module to Test ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjust path if needed

// --- Mock Dependencies ---
// Standard Mocks
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
// <<< ADDED Mock for CommandInputPort >>>
const mockUnsubscribeFn = jest.fn();
const mockCommandInputPort = {
    onCommand: jest.fn(() => mockUnsubscribeFn), // Needed for startTurn
};
// <<< END ADDED Mock >>>
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
describe('PlayerTurnHandler: _handleSubmittedCommand - Empty Command, Re-Prompt Error', () => {
    /** @type {PlayerTurnHandler} */
    let handler;
    const mockActor = {id: 'player-1', name: 'Tester'};
    const mockError = new Error('Re-prompt failed');
    const className = PlayerTurnHandler.name; // For logs

    beforeEach(() => {
        // Reset all mocks before each test run
        jest.clearAllMocks();
        // <<< Reset added mocks >>>
        mockUnsubscribeFn.mockClear();
        mockCommandInputPort.onCommand.mockClear();


        // Configure mocks specific to this scenario
        mockPlayerPromptService.prompt
            .mockResolvedValueOnce(undefined) // First call (during startTurn) succeeds
            .mockRejectedValueOnce(mockError);   // Second call (during re-prompt) fails

        mockTurnEndPort.notifyTurnEnded.mockResolvedValue(); // Assume notification succeeds

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
            commandInputPort: mockCommandInputPort, // <<< ADDED Dependency
            playerPromptService: mockPlayerPromptService,
            commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
            safeEventDispatcher: mockSafeEventDispatcher,
        });
    });

    afterEach(() => {
        // Attempt cleanup, though the error path should handle it
        try {
            // Call destroy, which handles cleanup internally
            handler?.destroy();
        } catch (e) {
            // Log unexpected synchronous errors during destroy setup
            // console.warn("Unexpected error during afterEach cleanup:", e);
        }
        handler = null;
    });

    it('should notify TurnEndPort of failure and log error when re-prompt fails', async () => {
        // --- Setup ---
        // Mocks configured in beforeEach
        // 1. Start a turn - awaits the initial prompt setup
        await handler.startTurn(mockActor);

        // 2. Allow the initial prompt call within startTurn to complete
        await new Promise(process.nextTick); // Yield control briefly
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Verify initial prompt

        // Reset mocks specifically for this test's actions
        mockPlayerPromptService.prompt.mockClear(); // Clear the initial call count
        mockTurnEndPort.notifyTurnEnded.mockClear();
        mockLogger.error.mockClear();
        mockLogger.warn.mockClear(); // Clear setup warnings if any
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockUnsubscribeFn.mockClear(); // Clear unsubscribe calls from potential setup/destroy


        // --- Steps ---
        const emptyCommandString = ''; // Use empty string directly

        // Call the method under test (_handleSubmittedCommand)
        // This call itself should resolve void because the error is handled internally
        // by calling #_promptPlayerForAction -> _handleTurnEnd.
        // <<< UPDATED: Pass string directly >>>
        const handleCommandCall = handler._handleSubmittedCommand(emptyCommandString);
        await expect(handleCommandCall).resolves.toBeUndefined();


        // --- Assertions ---

        // 1. Prompt Calls:
        // Should be called only ONCE within this test section (the failed re-prompt)
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor); // Re-prompt attempt

        // 2. Turn End Port Call: (Triggered by _handleTurnEnd in #_promptPlayerForAction catch)
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(mockActor.id, false); // Failure

        // 3. No Processor Call:
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();

        // 4. Logging:
        // Check the warning for the empty command itself was logged by _handleSubmittedCommand.
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `${className}: Received empty command string. Re-prompting actor ${mockActor.id}.`
        );
        // The error originates from #_promptPlayerForAction's catch block when the re-prompt fails.
        expect(mockLogger.error).toHaveBeenCalledTimes(1); // Should only be the prompt error
        expect(mockLogger.error).toHaveBeenCalledWith(
            `${className}: PlayerPromptService threw an error during prompt for actor ${mockActor.id}: ${mockError.message}`, // Exact log message
            mockError
        );
        // Check the logs from _handleTurnEnd which is called by the catch block in #_promptPlayerForAction
        expect(mockLogger.info).toHaveBeenCalledWith(
            `${className}: Signalling FAILED turn end for ${mockActor.id} due to prompt error.`
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            `${className}: Ending turn for actor ${mockActor.id} (status: failure).`
        );
        expect(mockLogger.warn).toHaveBeenCalledWith( // The failure reason log in _handleTurnEnd
            `${className}: Turn for ${mockActor.id} ended with failure. Reason: ${mockError.message}`
        );
        // Should be 2 warnings total (empty command + turn failure reason)
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);


        // 5. State Cleanup Logging & Unsubscribe:
        // Verify logs from _handleTurnEnd -> #_unsubscribeFromCommands / #_cleanupTurnState
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1); // Unsubscribe called by _handleTurnEnd
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Unsubscribing from command input.`) // Check unsubscribe log
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Notifying TurnEndPort for actor ${mockActor.id}, success=false.`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`TurnEndPort notified successfully for ${mockActor.id}.`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Cleaning up active turn state for actor ${mockActor.id}.`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Active turn state reset for ${mockActor.id}.`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`_handleTurnEnd sequence completed for ${mockActor.id}.`)
        );
        // Check the debug log from the empty command's catch block in _handleSubmittedCommand
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Caught re-thrown error from failed re-prompt in empty command case. Error: ${mockError.message}`)
        );

    });
});
// --- FILE END ---