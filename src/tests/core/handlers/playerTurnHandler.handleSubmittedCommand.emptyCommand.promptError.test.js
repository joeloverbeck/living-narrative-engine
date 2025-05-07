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
const mockUnsubscribeFn = jest.fn();
const mockCommandInputPort = {
    onCommand: jest.fn(() => mockUnsubscribeFn), // Needed for startTurn
};
const mockPlayerPromptService = {
    prompt: jest.fn(),
};
const mockCommandOutcomeInterpreter = {
    interpret: jest.fn(),
};
const mockSafeEventDispatcher = {
    dispatchSafely: jest.fn(),
    subscribe: jest.fn(),
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
            commandInputPort: mockCommandInputPort,
            playerPromptService: mockPlayerPromptService,
            commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
            safeEventDispatcher: mockSafeEventDispatcher,
        });
    });

    afterEach(() => {
        try {
            handler?.destroy();
        } catch (e) {
            // console.warn("Unexpected error during afterEach cleanup:", e);
        }
        handler = null;
    });

    it('should notify TurnEndPort of failure and log error when re-prompt fails', async () => {
        // --- Setup ---
        await handler.startTurn(mockActor);
        // await new Promise(process.nextTick); // Usually not needed if startTurn is fully awaited and mocks resolve.
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Verify initial prompt from startTurn

        // Reset/clear mocks for logs and critical functions to isolate assertions to _handleSubmittedCommand
        mockPlayerPromptService.prompt.mockClear(); // Clear calls from startTurn
        mockTurnEndPort.notifyTurnEnded.mockClear();
        mockLogger.error.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockUnsubscribeFn.mockClear();


        // --- Steps ---
        const emptyCommandString = '';
        // _handleSubmittedCommand should internally handle the error and resolve.
        await handler._handleSubmittedCommand(emptyCommandString);


        // --- Assertions ---

        // 1. Prompt Calls:
        // Expect re-prompt attempt within _handleSubmittedCommand -> #_promptPlayerForAction
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor);

        // 2. Turn End Port Call:
        // Called by _handleTurnEnd, which is triggered by the error in #_promptPlayerForAction
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(mockActor.id, false); // Failure

        // 3. No Processor Call:
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();

        // 4. Logging (Warn, Error, Info):
        // Log from _handleSubmittedCommand for empty string
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `${className}: Received empty command string. Re-prompting actor ${mockActor.id}.`
        );
        // Log from #_promptPlayerForAction's catch block (error during prompt)
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            `${className}: PlayerPromptService threw an error during prompt for actor ${mockActor.id}: ${mockError.message}`,
            mockError
        );
        // Log from #_promptPlayerForAction's catch block (signalling turn end)
        expect(mockLogger.info).toHaveBeenCalledWith(
            `${className}: Signalling FAILED turn end for ${mockActor.id} due to prompt error.`
        );
        // Log from _handleTurnEnd (ending turn status)
        expect(mockLogger.info).toHaveBeenCalledWith(
            `${className}: Ending turn for actor ${mockActor.id} (status: failure).`
        );
        // Log from _handleTurnEnd (failure reason)
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `${className}: Turn for ${mockActor.id} ended with failure. Reason: ${mockError.message}`
        );
        expect(mockLogger.warn).toHaveBeenCalledTimes(2); // Total warn calls
        expect(mockLogger.info).toHaveBeenCalledTimes(2); // Total info calls after clear


        // 5. State Cleanup Logging & Unsubscribe (Debug Logs):
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1); // Called from _handleTurnEnd

        // Debug logs expected AFTER mocks were cleared:
        // Order:
        // 1. _handleSubmittedCommand: "Received submitted command..."
        // 2. #_promptPlayerForAction: "Delegating prompt logic..."
        // 3. _handleTurnEnd -> #_unsubscribeFromCommands: "Unsubscribing from command input for actor context..."
        // 4. _handleTurnEnd: "Notifying TurnEndPort..."
        // 5. _handleTurnEnd: "TurnEndPort notified successfully..."
        // 6. _handleTurnEnd -> #_cleanupTurnState: "Cleaning up primary active turn state..."
        // 7. _handleTurnEnd -> #_cleanupTurnState: "Active turn state (currentActor) reset..."
        // 8. _handleTurnEnd: "_handleTurnEnd sequence completed..."
        // 9. _handleSubmittedCommand (catch block for #_promptPlayerForAction): "Caught re-thrown error..."

        expect(mockLogger.debug).toHaveBeenCalledWith(`${className}: Received submitted command via subscription: "${emptyCommandString}"`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`${className}: Delegating prompt logic for actor ${mockActor.id} to PlayerPromptService.`);

        const expectedUnsubscribeLog = `${className}: Unsubscribing from command input for actor context '${mockActor.id}'.`;
        expect(mockLogger.debug).toHaveBeenCalledWith(expectedUnsubscribeLog);

        // --- CORRECTED Log Expectation for Notifying TurnEndPort ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `Notifying TurnEndPort for actor ${mockActor.id}, success=false.` // Removed ${className}: prefix
        );
        // --- END CORRECTION ---

        expect(mockLogger.debug).toHaveBeenCalledWith(
            `${className}: Cleaning up primary active turn state for actor ${mockActor.id}.`
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `${className}: Active turn state (currentActor) reset for ${mockActor.id}.`
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `${className}: _handleTurnEnd sequence completed for ${mockActor.id}.`
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `${className}: Caught re-thrown error from failed re-prompt in empty command case. Error: ${mockError.message}`
        );

        expect(mockLogger.debug).toHaveBeenCalledTimes(9); // Total debug calls after clear
    });
});
// --- FILE END ---