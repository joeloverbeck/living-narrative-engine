// src/tests/core/handlers/playerTurnHandler.processValidatedCommand.rePrompt.failure.test.js
// --- FILE START (Entire file content as requested) ---

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// --- Module to Test ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjusted path
import TurnDirective from '../../../core/constants/turnDirectives.js'; // Adjusted path

// --- Mock Dependencies ---
// (Mocks remain the same)
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};
const mockActionDiscoverySystem = { getValidActions: jest.fn() };
const mockCommandProcessor = { processCommand: jest.fn() };
const mockWorldContext = { getLocationOfEntity: jest.fn() };
const mockEntityManager = { getEntityInstance: jest.fn() };
const mockGameDataRepository = { getActionDefinition: jest.fn() };
const mockPromptOutputPort = { prompt: jest.fn() };
const mockTurnEndPort = { notifyTurnEnded: jest.fn() };
const mockPlayerPromptService = { prompt: jest.fn() };
const mockCommandOutcomeInterpreter = { interpret: jest.fn() };
const mockSafeEventDispatcher = { dispatchSafely: jest.fn() };


// --- Test Suite ---
describe('PlayerTurnHandler: #_processValidatedCommand - RE_PROMPT Prompt Failure Path', () => {
    /** @type {PlayerTurnHandler} */
    let handler;
    // <<< REMOVED turnPromise variable >>>
    // let turnPromise;

    // --- Test Data ---
    const mockActor = { id: 'player-1', name: 'FailPromptActor' };
    const mockPromptError = new Error('Prompt service failed on re-prompt');
    // Command result indicates success but turn does not end, leading to interpreter choosing RE_PROMPT
    const mockCommandResult = {
        success: true,
        turnEnded: false,
        message: 'Looked around.',
        actionResult: { actionId: 'look' } // Example action result
    };

    beforeEach(() => {
        // Reset all mocks before each test run
        jest.clearAllMocks();

        // --- Mock Configuration ---
        // PlayerPromptService: Succeeds on first call (startTurn), fails on second (re-prompt)
        mockPlayerPromptService.prompt
            .mockResolvedValueOnce(undefined) // For initial startTurn prompt
            .mockRejectedValueOnce(mockPromptError); // For the re-prompt call

        // Command processor returns a result that triggers RE_PROMPT via the interpreter
        mockCommandProcessor.processCommand.mockResolvedValue(mockCommandResult);

        // Interpreter indicates a re-prompt is needed
        mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.RE_PROMPT);

        // Turn end notification should succeed even on turn failure
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue();

        // --- Handler Instantiation ---
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

    afterEach(async () => { // Make async
        // Ensure graceful cleanup
        if (handler) {
            try {
                await handler.destroy();
            } catch (e) {
                // console.warn("Suppressed error during afterEach cleanup:", e);
            } finally {
                handler = null;
                // <<< REMOVED turnPromise reset >>>
                // turnPromise = null;
            }
        }
    });

    // <<< UPDATED Test Description >>>
    it('should process command, interpret RE_PROMPT, fail on re-prompt, log error, and notify TurnEndPort of failure', async () => {
        // --- Setup ---
        // Mocks configured in beforeEach

        // Start the turn and wait for initiation
        // <<< UPDATED: Call startTurn >>>
        await handler.startTurn(mockActor);

        // Allow the initial async prompt call within startTurn to complete
        // <<< UPDATED: Use nextTick >>>
        await new Promise(process.nextTick);

        // Verify initial prompt call happened (sanity check)
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenNthCalledWith(1, mockActor);

        // --- Steps ---
        // 1. Define valid command data that leads to RE_PROMPT
        const commandData = { command: 'look' }; // The specific command string doesn't matter as much as the mocks' behavior

        // 2. Call the internal method under test indirectly via command submission.
        //    _handleSubmittedCommand calls #_processValidatedCommand -> RE_PROMPT -> #_promptPlayerForAction (which fails).
        //    The error from the failed prompt is caught within #_promptPlayerForAction,
        //    which triggers _handleTurnEnd.
        //    _handleSubmittedCommand should resolve void as the error is handled internally.
        await handler._handleSubmittedCommand(commandData);

        // <<< REMOVED: Awaiting turnPromise rejection >>>
        // await expect(turnPromise).rejects.toThrow(mockPromptError);

        // --- Assertions ---

        // 1. Processor Call:
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledTimes(1);
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(mockActor, commandData.command);

        // 2. Interpreter Call:
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledTimes(1);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(mockCommandResult, mockActor.id);

        // 3. Prompt Calls:
        //    Should be called twice: once initially (in setup), once for the failed re-prompt attempt.
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(2);
        expect(mockPlayerPromptService.prompt).toHaveBeenNthCalledWith(1, mockActor); // Initial prompt (from setup)
        expect(mockPlayerPromptService.prompt).toHaveBeenNthCalledWith(2, mockActor); // Re-prompt attempt (failed)

        // 4. Turn End Port Call:
        // <<< UPDATED: Key assertion for failure >>>
        //    Should be called exactly once, indicating failure, triggered by the catch block in #_promptPlayerForAction.
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(mockActor.id, false); // false indicates failure

        // 5. Promise Rejection:
        //    No longer applicable. Failure confirmed via notifyTurnEnded.

        // 6. Logging:
        //    Check the error log from #_promptPlayerForAction's catch block.
        expect(mockLogger.error).toHaveBeenCalledTimes(1); // Ensure only one error log
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`PlayerPromptService threw an error during prompt for actor ${mockActor.id}: ${mockPromptError.message}`),
            mockPromptError
        );
        // Check the info log from #_promptPlayerForAction's catch block signalling the turn end
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Signalling FAILED turn end for ${mockActor.id} due to prompt error.`)
        );
        // Check the warning log from _handleTurnEnd confirming the failure reason
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Turn for ${mockActor.id} ended with failure. Reason: ${mockPromptError.message}`)
        );

        // 7. Internal State:
        // Verified implicitly by notifyTurnEnded call and logging.
    });
});

// --- FILE END ---