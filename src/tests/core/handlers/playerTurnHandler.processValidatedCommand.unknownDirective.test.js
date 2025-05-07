// src/tests/core/handlers/playerTurnHandler.processValidatedCommand.unknownDirective.test.js
// --- FILE START ---

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
    subscribe: jest.fn(),      // <<< CORRECTED: Added subscribe mock method
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
        // Using process.nextTick can be helpful but often not strictly necessary if mocks resolve synchronously
        // or if the async operations within startTurn are fully awaited before proceeding.
        // For this test, the primary async operation is prompt, which is awaited.
        // await new Promise(process.nextTick);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Sanity check

        // Clear logs from setup phase (constructor, startTurn) to focus on _handleSubmittedCommand behavior
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();


        // --- Steps ---
        const commandString = 'do_something'; // Command string doesn't matter due to mocks

        await handler._handleSubmittedCommand(commandString);


        // --- Assertions ---

        // 1. Processor Call: (Already covered by beforeEach mock if not cleared)
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
            `${className}: Received unknown directive '${invalidDirective}' for actor ${mockActor.id} after successful command. Forcing turn failure.`
        );
        // Check the failure warning log from _handleTurnEnd
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `${className}: Turn for ${mockActor.id} ended with failure. Reason: ${expectedInternalError.message}`
        );

        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);

        // Check specific info logs from the path taken after mocks are cleared
        expect(mockLogger.info).toHaveBeenCalledWith(`${className}: Handling command "${commandString}" for current actor ${mockActor.id}.`);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${className}: Delegating command "${commandString}" for ${mockActor.id} to ICommandProcessor...`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${className}: CommandProcessor raw result for ${mockActor.id}:`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${className}: CommandProcessor SUCCEEDED for "${commandString}" by ${mockActor.id}.`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${className}: Calling CommandOutcomeInterpreter based on CommandProcessor's success (actor: ${mockActor.id}).`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${className}: CommandOutcomeInterpreter processed. Received directive: '${invalidDirective}' for actor ${mockActor.id}.`));
        // This info log is from _handleTurnEnd
        expect(mockLogger.info).toHaveBeenCalledWith(`${className}: Ending turn for actor ${mockActor.id} (status: failure).`);
        expect(mockLogger.info).toHaveBeenCalledTimes(7); // Count of info logs after clearing


        // 6. Internal State Cleanup Check (Debug Logs):
        // These debug logs occur within _handleSubmittedCommand -> #_processValidatedCommand -> _handleTurnEnd
        // Order of debug logs after clearing:
        // 1. #_processValidatedCommand: `Processing validated command`
        // (Potentially `#clearTurnEndWaitingMechanisms` - if it logs)
        // 2. _handleTurnEnd -> #_unsubscribeFromCommands: `Unsubscribing from command input`
        // 3. _handleTurnEnd: `Notifying TurnEndPort`
        // 4. _handleTurnEnd: `TurnEndPort notified successfully`
        // 5. _handleTurnEnd -> #_cleanupTurnState: `Cleaning up primary active turn state` (THE ONE THAT FAILED)
        // 6. _handleTurnEnd -> #_cleanupTurnState: `Active turn state (currentActor) reset`
        // 7. _handleTurnEnd: `_handleTurnEnd sequence completed`

        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${className}: Processing validated command "${commandString}" for ${mockActor.id}.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${className}: Unsubscribing from command input for actor context '${mockActor.id}'.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Notifying TurnEndPort for actor ${mockActor.id}, success=false.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`TurnEndPort notified successfully for ${mockActor.id}.`));

        // --- CORRECTED LINE ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Cleaning up primary active turn state for actor ${mockActor.id}.`)
        );
        // --- END CORRECTED LINE ---
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${className}: Active turn state (currentActor) reset for ${mockActor.id}.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`_handleTurnEnd sequence completed for ${mockActor.id}.`)
        );
        // If #clearTurnEndWaitingMechanisms logs something when not awaiting, that would be another one.
        // Assuming it doesn't for now, or that the stringContaining is specific enough.
        // Count of specific debug logs expected after clearing:
        const expectedDebugCallCount = 8; // Based on the list above
        expect(mockLogger.debug).toHaveBeenCalledTimes(expectedDebugCallCount);


        // 7. Unsubscribe Called:
        // Check that _handleTurnEnd called unsubscribe
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1); // Unsubscribe is called once by _handleTurnEnd
    });
});

// --- FILE END ---