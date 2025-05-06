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
        await new Promise(process.nextTick); // Yield control briefly
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Verify initial prompt

        // Reset mocks specifically for this test's actions
        mockPlayerPromptService.prompt.mockClear();
        mockTurnEndPort.notifyTurnEnded.mockClear();
        mockLogger.error.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockUnsubscribeFn.mockClear();


        // --- Steps ---
        const emptyCommandString = '';
        const handleCommandCall = handler._handleSubmittedCommand(emptyCommandString);
        await expect(handleCommandCall).resolves.toBeUndefined();


        // --- Assertions ---

        // 1. Prompt Calls:
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor);

        // 2. Turn End Port Call:
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(mockActor.id, false); // Failure

        // 3. No Processor Call:
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();

        // 4. Logging:
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `${className}: Received empty command string. Re-prompting actor ${mockActor.id}.`
        );
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            `${className}: PlayerPromptService threw an error during prompt for actor ${mockActor.id}: ${mockError.message}`, // Exact log message
            mockError
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            `${className}: Signalling FAILED turn end for ${mockActor.id} due to prompt error.`
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            `${className}: Ending turn for actor ${mockActor.id} (status: failure).`
        );
        expect(mockLogger.warn).toHaveBeenCalledWith( // The failure reason log in _handleTurnEnd
            `${className}: Turn for ${mockActor.id} ended with failure. Reason: ${mockError.message}`
        );
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);


        // 5. State Cleanup Logging & Unsubscribe:
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);

        // --- MODIFIED ASSERTION ---
        // Check for the exact debug log message from #_unsubscribeFromCommands
        const expectedUnsubscribeLog = `${className}: Unsubscribing from command input for actor ${mockActor.id}.`;
        expect(mockLogger.debug).toHaveBeenCalledWith(expectedUnsubscribeLog);
        // --- END MODIFIED ASSERTION ---

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
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Caught re-thrown error from failed re-prompt in empty command case. Error: ${mockError.message}`)
        );

    });
});
// --- FILE END ---