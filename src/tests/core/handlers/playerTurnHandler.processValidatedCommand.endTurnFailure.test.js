// src/tests/core/handlers/playerTurnHandler.processValidatedCommand.endTurnFailure.test.js
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
const mockActionDiscoverySystem = {
    getValidActions: jest.fn(),
};
const mockCommandProcessor = {
    processCommand: jest.fn(),
};
const mockWorldContext = {
    getLocationOfEntity: jest.fn(),
};
const mockEntityManager = {
    getEntityInstance: jest.fn(),
};
const mockGameDataRepository = {
    getActionDefinition: jest.fn(),
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
describe('PlayerTurnHandler: #_processValidatedCommand - END_TURN_FAILURE Path', () => {
    /** @type {PlayerTurnHandler} */
    let handler;
    const mockActor = { id: 'player-1', name: 'FailureActor' };
    const mockFailureError = new Error('Action failed validation');
    const mockCommandResult = { success: false, turnEnded: true, error: mockFailureError, message: "Attack failed!" }; // Added message for clarity

    beforeEach(() => {
        // Reset all mocks before each test run
        jest.clearAllMocks();

        // Configure mocks specific to this scenario
        mockPlayerPromptService.prompt.mockResolvedValue(undefined); // Initial and subsequent prompts succeed if called
        mockCommandProcessor.processCommand.mockResolvedValue(mockCommandResult);
        mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.END_TURN_FAILURE);
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue(); // Notification succeeds

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

    afterEach(async () => { // Make async
        // Ensure graceful cleanup
        if (handler && typeof handler.destroy === 'function') {
            try {
                await handler.destroy();
            } catch (e) {
                // Suppress errors during cleanup
            } finally {
                handler = null; // Help garbage collection
            }
        }
    });


    // <<< UPDATED Test Description >>>
    it('should process command, interpret as failure, notify TurnEndPort with failure, and allow a new turn', async () => {
        // --- Setup ---
        // Mocks configured in beforeEach

        // 1. Start a turn and wait for initiation
        // <<< UPDATED: Call startTurn >>>
        await handler.startTurn(mockActor);

        // 2. Allow the initial async prompt call within startTurn to complete
        // <<< UPDATED: Use nextTick >>>
        await new Promise(process.nextTick);

        // Ensure initial prompt was called before proceeding (sanity check)
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor);

        // Clear prompt mocks to specifically check for re-prompt calls later
        mockPlayerPromptService.prompt.mockClear();

        // --- Steps ---
        // 1. Define valid command data (the *result* is failure, not the input itself)
        const commandData = { command: 'attack invalid' }; // Command string content matters for processor mock call

        // 2. Call the method under test indirectly via _handleSubmittedCommand.
        //    This triggers #_processValidatedCommand -> interpret -> END_TURN_FAILURE -> _handleTurnEnd
        const handleCommandCall = handler._handleSubmittedCommand(commandData);
        // Expect it to resolve void as the failure directive is handled internally
        await expect(handleCommandCall).resolves.toBeUndefined();

        // <<< REMOVED: Awaiting turnPromise rejection >>>
        // await expect(turnPromise).rejects.toThrow(mockFailureError);

        // --- Assertions (Part 1 - First Turn Outcome) ---

        // 1. Processor Call:
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledTimes(1);
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(mockActor, commandData.command);

        // 2. Interpreter Call:
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledTimes(1);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(mockCommandResult, mockActor.id);

        // 3. Turn End Port Call:
        // <<< UPDATED: Key assertion for failure outcome >>>
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(mockActor.id, false); // false for failure

        // 4. No Re-Prompt:
        expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled(); // Ensure no *additional* prompt calls occurred during the failed turn processing

        // 5. Promise Rejection:
        // No longer applicable. Failure confirmed via notifyTurnEnded(..., false).

        // 6. Logging: Check failure log from _handleTurnEnd
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Turn for ${mockActor.id} ended with failure. Reason: ${mockFailureError.message}`)
        );

        // --- Assertions (Part 2 - Verify State Reset Allows New Turn) ---

        // 7. Internal State Reset Verification:
        // Attempt to start a new turn. If #currentActor wasn't reset to null by _handleTurnEnd/_cleanupTurnState,
        // this call would throw an error.
        const secondActor = { id: 'player-2', name: 'SecondActor' };
        // Ensure prompt mock is ready for the *next* turn initiation
        // (clearAllMocks wasn't called, so previous behaviour persists unless reset/reconfigured)
        mockPlayerPromptService.prompt.mockResolvedValueOnce(undefined); // Configure for second turn start

        await expect(async () => {
            // <<< UPDATED: Call startTurn >>>
            await handler.startTurn(secondActor);
            // Allow the async operations within startTurn (like prompt call) to start/settle
            // <<< UPDATED: Use nextTick >>>
            await new Promise(process.nextTick);
        }).not.toThrow(); // Assert that starting the second turn does NOT throw

        // Verify the prompt was called for the *second* actor, confirming the handler accepted the new turn
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Only once since the last clear/reset
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(secondActor);

        // No need for explicit second turn promise cleanup; afterEach handles destroy if handler still exists.
    });
});

// --- FILE END ---