// src/tests/core/handlers/playerTurnHandler.commandHandling.test.js

/**
 * @fileoverview Tests for PlayerTurnHandler command handling and subscription lifecycle.
 */
import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler';
import TurnDirective from '../../../core/constants/turnDirectives';
import Entity from '../../../entities/entity'; // Assuming Entity class exists

// --- Mock Dependencies ---
const mockLogger = {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
};
const mockActionDiscoverySystem = {getValidActions: jest.fn()};
const mockCommandProcessor = {processCommand: jest.fn()};
const mockWorldContext = {getLocationOfEntity: jest.fn()};
const mockEntityManager = {getEntityInstance: jest.fn()};
const mockGameDataRepository = {getActionDefinition: jest.fn()};
const mockPromptOutputPort = {prompt: jest.fn()};
const mockTurnEndPort = {notifyTurnEnded: jest.fn()};
const mockPlayerPromptService = {prompt: jest.fn()};
const mockCommandOutcomeInterpreter = {interpret: jest.fn()};
const mockSafeEventDispatcher = {dispatchSafely: jest.fn()};

// --- Mock Command Input Port ---
let commandListenerCallback = null; // To capture the listener passed to onCommand
const mockUnsubscribeFn = jest.fn();
const mockCommandInputPort = {
    onCommand: jest.fn((listener) => {
        commandListenerCallback = listener; // Capture the listener
        return mockUnsubscribeFn; // Return the mock unsubscribe function
    }),
};

// --- Helper ---
const createMockPlayer = (id = 'player-1') => new Entity(id, ['player', 'actor']);

// --- Test Suite ---
describe('PlayerTurnHandler - Command Handling & Subscription', () => {
    let handler;
    let player;
    const className = PlayerTurnHandler.name; // For log messages

    beforeEach(() => {
        jest.clearAllMocks();
        commandListenerCallback = null; // Reset captured listener
        player = createMockPlayer();

        // Default successful prompt
        mockPlayerPromptService.prompt.mockResolvedValue(undefined);
        // Default successful turn end notification
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue(undefined);
        // Default working unsubscribe function
        mockUnsubscribeFn.mockClear(); // Ensure clean state
        mockCommandInputPort.onCommand.mockImplementation((listener) => { // Reset impl if changed
            commandListenerCallback = listener;
            return mockUnsubscribeFn;
        });


        handler = new PlayerTurnHandler({
            logger: mockLogger,
            actionDiscoverySystem: mockActionDiscoverySystem,
            commandProcessor: mockCommandProcessor,
            worldContext: mockWorldContext,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
            promptOutputPort: mockPromptOutputPort, // Still needed for PlayerPromptService potentially
            turnEndPort: mockTurnEndPort,
            commandInputPort: mockCommandInputPort, // <<< Inject mock
            playerPromptService: mockPlayerPromptService,
            commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
            safeEventDispatcher: mockSafeEventDispatcher,
        });
    });

    afterEach(() => {
        handler = null;
        player = null;
    });

    // --- Test Cases ---

    test('startTurn should subscribe to commands via CommandInputPort', async () => {
        await handler.startTurn(player);

        expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1);
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledWith(expect.any(Function));
        expect(commandListenerCallback).toBeInstanceOf(Function); // Ensure listener was captured
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(player); // Verify prompt still happens
        expect(mockUnsubscribeFn).not.toHaveBeenCalled(); // Not called yet
    });

    test('startTurn should throw if CommandInputPort fails to return unsubscribe function', async () => {
        mockCommandInputPort.onCommand.mockReturnValueOnce(null); // Simulate failure

        const expectedError = 'CommandInputPort.onCommand did not return a valid unsubscribe function.';
        await expect(handler.startTurn(player)).rejects.toThrow(expectedError);

        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${className}: Critical error during turn initiation for ${player.id}`), expect.any(Error));
        expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled(); // Should fail before prompt
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1); // Should signal failure
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, false); // Turn ended failure
    });

    test('Successful command processing (END_TURN_SUCCESS) should notify TurnEndPort and unsubscribe', async () => {
        const command = 'wait';
        const commandResult = {success: true, turnEnded: true, actionResult: {actionId: 'core:wait'}, message: 'Done.'};

        // Setup mocks for successful turn end
        mockCommandProcessor.processCommand.mockResolvedValue(commandResult);
        mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.END_TURN_SUCCESS);

        // Action 1: Start the turn (subscribes)
        await handler.startTurn(player);
        expect(commandListenerCallback).toBeInstanceOf(Function); // Verify listener is ready

        // Action 2: Simulate command input by calling the captured listener
        await commandListenerCallback(command);

        // Assertions
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledTimes(1);
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(player, command);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledTimes(1);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(commandResult, player.id);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, true); // Success = true
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1); // Crucial: verify unsubscribe
    });

    test('Command processing leading to RE_PROMPT should re-prompt and NOT unsubscribe', async () => {
        const command = 'look';
        const commandResult = {success: true, turnEnded: false, actionResult: {actionId: 'core:look'}};

        // Setup mocks for re-prompt
        mockCommandProcessor.processCommand.mockResolvedValue(commandResult);
        mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.RE_PROMPT);
        // mockPlayerPromptService.prompt is set to succeed in beforeEach

        // Action 1: Start the turn
        await handler.startTurn(player);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Initial prompt

        // Action 2: Simulate command input
        await commandListenerCallback(command);

        // Assertions
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(player, command);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(commandResult, player.id);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(2); // Called again
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled(); // Turn did not end
        expect(mockUnsubscribeFn).not.toHaveBeenCalled(); // Listener should remain active
    });

    test('Command processing failure (END_TURN_FAILURE) should notify TurnEndPort (failure) and unsubscribe', async () => {
        const command = 'attack non_existent';
        const error = new Error("Target not found");
        const commandResult = {success: false, turnEnded: true, error: error};

        // Setup mocks for turn end failure
        mockCommandProcessor.processCommand.mockResolvedValue(commandResult);
        mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.END_TURN_FAILURE);

        // Action 1: Start the turn
        await handler.startTurn(player);

        // Action 2: Simulate command input
        await commandListenerCallback(command);

        // Assertions
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(player, command);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(commandResult, player.id);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, false); // Success = false
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1); // Unsubscribed on failure
    });

    test('Submitting an empty command should re-prompt and not unsubscribe', async () => {
        // Action 1: Start the turn
        await handler.startTurn(player);
        mockPlayerPromptService.prompt.mockClear(); // Clear initial prompt call

        // Action 2: Simulate empty command input
        await commandListenerCallback("  "); // Empty string / whitespace

        // Assertions
        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled(); // Processor not called
        expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled(); // Interpreter not called
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Called again to re-prompt
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled(); // Turn did not end
        expect(mockUnsubscribeFn).not.toHaveBeenCalled(); // Listener should remain active
    });

    test('destroy() called mid-turn should force turn end (failure), notify, and unsubscribe', async () => {
        // Action 1: Start the turn
        await handler.startTurn(player);
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1);

        // Action 2: Call destroy
        handler.destroy();

        // Assertions
        // _handleTurnEnd is called internally by destroy
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        // It should signal failure because the turn was interrupted
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, false);
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1); // Should be called by destroy or _handleTurnEnd within destroy
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Destroying handler while turn for ${player.id} was active`));
    });

    test('destroy() called when no turn is active should not notify or error', async () => {
        // Handler is created, but startTurn is never called
        // <<< REMOVED check for handler.getCurrentActor() >>>

        // Action: Call destroy
        handler.destroy();

        // Assertions
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
        expect(mockUnsubscribeFn).not.toHaveBeenCalled(); // Unsubscribe shouldn't be called as it was never set
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Destroying handler while turn for'));
        // <<< ADDED check for specific debug log >>>
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No active turn found during destruction'));
    });

    test('Turn ending due to prompt failure should unsubscribe', async () => {
        const promptError = new Error("Display service unavailable");
        mockPlayerPromptService.prompt.mockRejectedValueOnce(promptError); // Make initial prompt fail

        // Action: Start the turn (which will fail during prompt)
        // We expect startTurn itself TO THROW because #_promptPlayerForAction re-throws now
        // <<< MODIFIED to expect rejection >>>
        await expect(handler.startTurn(player)).rejects.toThrow(promptError.message);

        // Assertions
        // The error is caught inside startTurn, _handleTurnEnd is called, and the error is re-thrown.
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Prompt was attempted
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, false); // Signal failure
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1); // Unsubscribe should still be called by _handleTurnEnd
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${className}: PlayerPromptService threw an error during prompt`), promptError); // Log from #_prompt...
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${className}: Critical error during turn initiation`), promptError); // Log from startTurn catch
    });


    test('Unsubscribe function error should be logged but not crash _handleTurnEnd', async () => {
        const command = 'wait';
        const commandResult = {success: true, turnEnded: true};
        mockCommandProcessor.processCommand.mockResolvedValue(commandResult);
        mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.END_TURN_SUCCESS);
        const unsubError = new Error("VED unsubscribe failed");
        mockUnsubscribeFn.mockImplementation(() => {
            throw unsubError;
        }); // Make unsubscribe throw

        // Action 1: Start turn
        await handler.startTurn(player);

        // Action 2: Simulate command leading to turn end
        await commandListenerCallback(command);

        // Assertions
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1); // Notify should still happen
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, true);
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1); // Attempted unsubscribe
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error calling command unsubscribe function'),
            unsubError
        );
        // <<< REMOVED check for handler.getCurrentActor() >>>
        // We cannot directly check if #currentActor became null, but the fact that
        // notifyTurnEnded was called and the test didn't hang implies _handleTurnEnd completed.
    });

});
