// src/tests/core/handlers/playerTurnHandler.processValidatedCommand.endTurnFailure.test.js
// --- FILE START (Entire file content as requested) ---

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Module to Test ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjusted path
import TurnDirective from '../../../core/constants/turnDirectives.js'; // Adjusted path

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
describe('PlayerTurnHandler: #_processValidatedCommand - END_TURN_FAILURE Path', () => {
    /** @type {PlayerTurnHandler} */
    let handler;
    const mockActor = {id: 'player-1', name: 'FailureActor'};
    const mockFailureError = new Error('Action failed validation');
    const mockCommandResult = {success: false, turnEnded: true, error: mockFailureError, message: "Attack failed!"}; // Added message for clarity
    const className = PlayerTurnHandler.name; // For logs

    beforeEach(() => {
        // Reset all mocks before each test run
        jest.clearAllMocks();
        // <<< Reset added mocks >>>
        mockUnsubscribeFn.mockClear();
        mockCommandInputPort.onCommand.mockClear();

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
            commandInputPort: mockCommandInputPort, // <<< ADDED Dependency
            playerPromptService: mockPlayerPromptService,
            commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
            safeEventDispatcher: mockSafeEventDispatcher,
        });
    });

    afterEach(async () => { // Make async
        // Ensure graceful cleanup
        if (handler && typeof handler.destroy === 'function') {
            try {
                handler.destroy();
                await new Promise(process.nextTick); // Allow potential async in destroy
            } catch (e) {
                // Suppress errors during cleanup
            } finally {
                handler = null; // Help garbage collection
            }
        }
    });


    it('should process command, interpret as failure, notify TurnEndPort with failure, and allow a new turn', async () => {
        // --- Setup ---
        // Mocks configured in beforeEach

        // 1. Start a turn and wait for initiation
        await handler.startTurn(mockActor);

        // 2. Allow the initial async prompt call within startTurn to complete
        await new Promise(process.nextTick);

        // Ensure initial prompt was called before proceeding (sanity check)
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(mockActor);

        // Clear prompt mocks to specifically check for re-prompt calls later
        mockPlayerPromptService.prompt.mockClear();

        // --- Steps ---
        const commandString = 'attack invalid'; // Command string content matters for processor mock call

        // Call the method under test indirectly via _handleSubmittedCommand.
        // This triggers #_processValidatedCommand -> interpret -> END_TURN_FAILURE -> _handleTurnEnd
        // <<< UPDATED: Pass string directly >>>
        const handleCommandCall = handler._handleSubmittedCommand(commandString);
        // Expect it to resolve void as the failure directive is handled internally
        await expect(handleCommandCall).resolves.toBeUndefined();


        // --- Assertions (Part 1 - First Turn Outcome) ---

        // 1. Processor Call:
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledTimes(1);
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(mockActor, commandString);

        // 2. Interpreter Call:
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledTimes(1);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(mockCommandResult, mockActor.id);

        // 3. Turn End Port Call:
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(mockActor.id, false); // false for failure

        // 4. Unsubscribe called
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);

        // 5. No Re-Prompt:
        expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled(); // Ensure no *additional* prompt calls occurred

        // 6. Logging: Check failure log from _handleTurnEnd
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `${className}: Turn for ${mockActor.id} ended with failure. Reason: ${mockFailureError.message}`
        );


        // --- Assertions (Part 2 - Verify State Reset Allows New Turn) ---

        // 7. Internal State Reset Verification:
        // Attempt to start a new turn. If #currentActor wasn't reset to null by _handleTurnEnd/_cleanupTurnState,
        // this call would throw an error ("turn already in progress").
        const secondActor = {id: 'player-2', name: 'SecondActor'};
        // Ensure prompt mock is ready for the *next* turn initiation
        mockPlayerPromptService.prompt.mockResolvedValueOnce(undefined); // Configure for second turn start
        mockCommandInputPort.onCommand.mockClear(); // Clear previous subscription call
        mockUnsubscribeFn.mockClear(); // Clear previous unsubscribe call


        await expect(async () => {
            await handler.startTurn(secondActor);
            await new Promise(process.nextTick); // Allow the async operations within startTurn (like prompt call) to start/settle
        }).not.toThrow(); // Assert that starting the second turn does NOT throw

        // Verify the prompt was called for the *second* actor, confirming the handler accepted the new turn
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Only once since the last clear/reset
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(secondActor);
        // Verify subscription happened for the second turn
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1);


    });
});

// --- FILE END ---