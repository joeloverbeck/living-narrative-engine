// src/tests/core/handlers/playerTurnHandler.processValidatedCommand.unknownDirective.test.js
// --- FILE START (Entire file content as requested) ---

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// --- Module to Test ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjusted path

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
describe('PlayerTurnHandler: #_processValidatedCommand - Unknown Directive Path', () => {
    /** @type {PlayerTurnHandler} */
    let handler;
    // <<< REMOVED turnPromise variable >>>
    // let turnPromise;

    // --- Test Data ---
    const mockActor = { id: 'player-1', name: 'ConfusedActor' };
    // Outcome doesn't matter much, but needs to be something for the interpreter
    const mockCommandResult = { success: true, turnEnded: false, message: 'Did something maybe' };
    const invalidDirective = 'INVALID_DIRECTIVE_XYZ';
    // Define the error expected to be created internally and passed to _handleTurnEnd
    const expectedInternalError = new Error(`Received unexpected directive: ${invalidDirective}`);


    beforeEach(() => {
        // Reset all mocks before each test run
        jest.clearAllMocks();

        // --- Mock Configuration ---
        // PlayerPromptService: Succeeds on initial prompt call within startTurn
        mockPlayerPromptService.prompt.mockResolvedValueOnce(undefined);

        // Command processor returns a simple result
        mockCommandProcessor.processCommand.mockResolvedValue(mockCommandResult);

        // Interpreter returns the invalid directive
        mockCommandOutcomeInterpreter.interpret.mockResolvedValue(invalidDirective);

        // Turn end notification should succeed even on turn failure
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue();

        // Safe event dispatcher should succeed
        mockSafeEventDispatcher.dispatchSafely.mockResolvedValue(true);


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
                // Suppress errors during cleanup
            } finally {
                handler = null;
                // <<< REMOVED turnPromise reset >>>
                // turnPromise = null;
            }
        }
    });

    // <<< UPDATED Test Description >>>
    it('should log error, dispatch event, and signal turn end failure via TurnEndPort on unknown directive', async () => {
        // --- Setup ---
        // Start the turn and wait for initiation
        // <<< UPDATED: Call startTurn >>>
        await handler.startTurn(mockActor);

        // Allow the initial async prompt call within startTurn to complete
        // <<< UPDATED: Use nextTick >>>
        await new Promise(process.nextTick);

        // Verify initial prompt call happened (sanity check)
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor);

        // --- Steps ---
        // 1. Define valid command data (content doesn't matter due to mocks)
        const commandData = { command: 'do_something' };

        // 2. Call the internal method under test indirectly via command submission.
        //    _handleSubmittedCommand calls #_processValidatedCommand.
        //    The error handling within #_processValidatedCommand's default case
        //    calls _handleTurnEnd with the internal error.
        //    _handleSubmittedCommand should resolve void as the error is handled.
        await handler._handleSubmittedCommand(commandData);

        // <<< REMOVED: Awaiting turnPromise rejection >>>
        // const expectedError = new Error(`Received unexpected directive: ${invalidDirective}`);
        // await expect(turnPromise).rejects.toThrow(expectedError);

        // --- Assertions ---

        // 1. Processor Call:
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledTimes(1);
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(mockActor, commandData.command);

        // 2. Interpreter Call:
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledTimes(1);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(mockCommandResult, mockActor.id);

        // 3. Safe Dispatcher Call (from the default case):
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith('core:system_error_occurred', expect.objectContaining({
            message: `Handler received unknown directive '${invalidDirective}' for actor ${mockActor.id}.`,
            type: 'error',
            details: expectedInternalError.message // Compare against the expected internal error's message
        }));

        // 4. Turn End Port Call:
        // <<< UPDATED: This is the key assertion for failure >>>
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(mockActor.id, false); // false indicates failure

        // 5. Logging:
        // Check the specific error log from the 'default' case in #_processValidatedCommand
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Received unknown or invalid directive '${invalidDirective}' from CommandOutcomeInterpreter for actor ${mockActor.id}. Forcing turn failure.`)
        );
        // <<< UPDATED: Check the failure warning log from _handleTurnEnd >>>
        // It should log the specific internal error object passed to it.
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Turn for ${mockActor.id} ended with failure. Reason: ${expectedInternalError.message}`)
        );
        // <<< REMOVED: Check for "Rejecting turn promise" log >>>
        // expect(mockLogger.warn).toHaveBeenCalledWith(
        //    expect.stringContaining(`Rejecting turn promise for ${mockActor.id}. Reason: Received unexpected directive: ${invalidDirective}`)
        //);


        // 6. Promise Rejection:
        // No longer applicable.

        // 7. Internal State Cleanup Check:
        // Check the cleanup log message which indicates _cleanupTurnState was called by _handleTurnEnd.
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Cleaning up active turn state for actor ${mockActor.id}.`)
        );
        // Optional: Check the final log from _handleTurnEnd confirming sequence completion
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`_handleTurnEnd sequence completed for ${mockActor.id}.`)
        );
    });
});

// --- FILE END ---