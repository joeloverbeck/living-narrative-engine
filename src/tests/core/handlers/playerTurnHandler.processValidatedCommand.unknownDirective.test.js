// src/tests/core/handlers/playerTurnHandler.processValidatedCommand.unknownDirective.test.js
// --- FILE START (Entire file content as requested) ---

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Module to Test ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjusted path

// --- Mock Dependencies ---
// (Existing mocks remain the same)
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
describe('PlayerTurnHandler: #_processValidatedCommand - Unknown Directive Path', () => {
    /** @type {PlayerTurnHandler} */
    let handler;
    const className = PlayerTurnHandler.name; // For logs

    // --- Test Data ---
    const mockActor = {id: 'player-1', name: 'ConfusedActor'};
    const mockCommandResult = {success: true, turnEnded: false, message: 'Did something maybe'};
    const invalidDirective = 'INVALID_DIRECTIVE_XYZ';
    const expectedInternalError = new Error(`Received unexpected directive: ${invalidDirective}`);


    beforeEach(() => {
        // Reset all mocks before each test run
        jest.clearAllMocks();
        // <<< Reset added mocks >>>
        mockUnsubscribeFn.mockClear();
        mockCommandInputPort.onCommand.mockClear();

        // --- Mock Configuration ---
        mockPlayerPromptService.prompt.mockResolvedValueOnce(undefined); // Initial startTurn prompt
        mockCommandProcessor.processCommand.mockResolvedValue(mockCommandResult);
        mockCommandOutcomeInterpreter.interpret.mockResolvedValue(invalidDirective); // Return invalid directive
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue(); // Turn end notification succeeds
        mockSafeEventDispatcher.dispatchSafely.mockResolvedValue(true); // Event dispatch succeeds


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
            commandInputPort: mockCommandInputPort, // <<< ADDED Dependency
            playerPromptService: mockPlayerPromptService,
            commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
            safeEventDispatcher: mockSafeEventDispatcher,
        });
    });

    afterEach(async () => { // Make async
        // Ensure graceful cleanup
        if (handler) {
            try {
                // Use destroy which handles potential active turn state
                handler.destroy();
                await new Promise(process.nextTick); // Allow microtasks if destroy becomes async
            } catch (e) {
                // Suppress errors during cleanup
            } finally {
                handler = null;
            }
        }
    });

    it('should log error, dispatch event, and signal turn end failure via TurnEndPort on unknown directive', async () => {
        // --- Setup ---
        await handler.startTurn(mockActor);
        await new Promise(process.nextTick); // Allow startTurn's internal prompt to finish
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Sanity check

        // --- Steps ---
        const commandString = 'do_something'; // Command string doesn't matter due to mocks

        // Call the internal method under test indirectly via command submission.
        // The error handling within #_processValidatedCommand's default case
        // calls _handleTurnEnd with the internal error.
        // _handleSubmittedCommand should resolve void as the error is handled.
        // <<< UPDATED: Pass string directly >>>
        await handler._handleSubmittedCommand(commandString);


        // --- Assertions ---

        // 1. Processor Call:
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledTimes(1);
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(mockActor, commandString);

        // 2. Interpreter Call:
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledTimes(1);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(mockCommandResult, mockActor.id);

        // 3. Safe Dispatcher Call (from the default case):
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith('core:system_error_occurred', expect.objectContaining({
            message: `Handler received unknown directive '${invalidDirective}' for actor ${mockActor.id}.`,
            type: 'error',
            details: expectedInternalError.message
        }));

        // 4. Turn End Port Call: (Triggered by _handleTurnEnd called from default case)
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(mockActor.id, false); // false indicates failure

        // 5. Logging:
        // Check the specific error log from the 'default' case in #_processValidatedCommand
        expect(mockLogger.error).toHaveBeenCalledWith(
            `${className}: Received unknown directive '${invalidDirective}'. Forcing turn failure.`
        );
        // Check the failure warning log from _handleTurnEnd
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `${className}: Turn for ${mockActor.id} ended with failure. Reason: ${expectedInternalError.message}`
        );
        // Ensure only one error log and one warn log (related to this flow)
        // Note: Constructor debug log also exists.
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);


        // 6. Internal State Cleanup Check:
        // Check the cleanup log message which indicates _cleanupTurnState was called by _handleTurnEnd.
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Cleaning up active turn state for actor ${mockActor.id}.`)
        );
        // Optional: Check the final log from _handleTurnEnd confirming sequence completion
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`_handleTurnEnd sequence completed for ${mockActor.id}.`)
        );

        // 7. Unsubscribe Called:
        // Check that _handleTurnEnd called unsubscribe
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
    });
});

// --- FILE END ---