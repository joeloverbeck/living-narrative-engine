// src/tests/core/handlers/playerTurnHandler.handleSubmittedCommand.emptyCommand.promptError.test.js
// --- FILE START ---

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

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
    const mockActor = { id: 'player-1', name: 'Tester' };
    const mockError = new Error('Re-prompt failed');

    beforeEach(() => {
        // Reset all mocks before each test run
        jest.clearAllMocks();

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
            playerPromptService: mockPlayerPromptService,
            commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
            safeEventDispatcher: mockSafeEventDispatcher,
        });
    });

    afterEach(() => { // Removed async as destroy() doesn't need explicit await here
        // Attempt cleanup, though the error path should handle it
        try {
            // Call destroy, which handles cleanup internally (potentially async via _handleTurnEnd)
            handler?.destroy();
        } catch (e) {
            // Log unexpected synchronous errors during destroy setup
            console.warn("Unexpected error during afterEach cleanup:", e);
        }
        handler = null;
    });

    // --- CORRECTION: Updated test description ---
    it('should notify TurnEndPort of failure and log error when re-prompt fails', async () => {
        // --- Setup ---
        // Mocks configured in beforeEach
        // 1. Start a turn - awaits the initial prompt setup
        await handler.startTurn(mockActor); // <-- CORRECTION: Use startTurn

        // 2. Allow the initial prompt call within startTurn to complete
        await Promise.resolve(); // Yield control briefly

        // --- Steps ---
        // 1. Optional: Clear mocks to track calls *after* initial prompt if necessary.
        //    mockTurnEndPort.notifyTurnEnded.mockClear();
        //    mockLogger.error.mockClear();
        //    mockCommandProcessor.processCommand.mockClear();
        //    mockPlayerPromptService.prompt.mockClear(); // If only counting the re-prompt

        // Reset specifically for this test's actions
        mockPlayerPromptService.prompt.mockClear(); // Clear the initial call count
        mockTurnEndPort.notifyTurnEnded.mockClear();
        mockLogger.error.mockClear();
        mockLogger.warn.mockClear(); // Clear setup warnings if any
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();


        // 2. Define empty command data
        const commandData = { command: '' };

        // 3. Call the method under test (_handleSubmittedCommand)
        //    This call itself should resolve void because the error is handled internally
        //    by calling #_promptPlayerForAction -> _handleTurnEnd.
        const handleCommandCall = handler._handleSubmittedCommand(commandData);
        await expect(handleCommandCall).resolves.toBeUndefined();

        // 4. Await the original promise rejection (REMOVED - Not applicable to startTurn)
        // await expect(turnPromise).rejects.toThrow(mockError);

        // --- Assertions ---

        // 1. Prompt Calls:
        // Should be called only ONCE within this test section (the failed re-prompt)
        // because we cleared the mock after startTurn.
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor); // Re-prompt attempt

        // 2. Turn End Port Call:
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(mockActor.id, false); // Failure

        // 3. No Processor Call:
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();

        // 4. Logging:
        // Check the warning for the empty command itself was logged by _handleSubmittedCommand.
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Received submitted command with empty command string. Re-prompting actor ${mockActor.id}.`)
        );
        // The error originates from #_promptPlayerForAction's catch block when the re-prompt fails.
        expect(mockLogger.error).toHaveBeenCalledTimes(1); // Should only be the prompt error
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`PlayerPromptService threw an error during prompt for actor ${mockActor.id}: ${mockError.message}`),
            mockError
        );
        // Check the logs from _handleTurnEnd which is called by the catch block in #_promptPlayerForAction
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Signalling FAILED turn end for ${mockActor.id} due to prompt error.`)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Ending turn for actor ${mockActor.id} (status: failure).`)
        );
        expect(mockLogger.warn).toHaveBeenCalledWith( // The failure reason log in _handleTurnEnd
            expect.stringContaining(`Turn for ${mockActor.id} ended with failure. Reason: ${mockError.message}`)
        );


        // 5. Promise Rejection: (REMOVED assertion)

        // 6. State Cleanup Logging:
        // Verify logs from _handleTurnEnd -> #_cleanupTurnState
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


    });
});
// --- FILE END ---