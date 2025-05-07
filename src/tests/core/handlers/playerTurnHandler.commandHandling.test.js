// src/tests/core/handlers/playerTurnHandler.commandHandling.test.js
// --- FILE START ---

/**
 * @fileoverview Tests for PlayerTurnHandler command handling and subscription lifecycle.
 */

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler';
import TurnDirective from '../../../core/constants/turnDirectives';
import Entity from '../../../entities/entity';
import {TURN_ENDED_ID} from '../../../core/constants/eventIds';

// --- Mock Dependencies ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),};
const mockActionDiscoverySystem = {getValidActions: jest.fn(),};
const mockCommandProcessor = {processCommand: jest.fn(),};
const mockWorldContext = {getLocationOfEntity: jest.fn(),};
const mockEntityManager = {getEntityInstance: jest.fn(),};
const mockGameDataRepository = {getActionDefinition: jest.fn(),};
const mockPromptOutputPort = {prompt: jest.fn(),};
const mockTurnEndPort = {notifyTurnEnded: jest.fn(),};
const mockPlayerPromptService = {prompt: jest.fn(),};
const mockCommandOutcomeInterpreter = {interpret: jest.fn(),};
const mockSafeEventDispatcher = {dispatchSafely: jest.fn(), subscribe: jest.fn(),};
let commandListenerCallback = null;
const mockUnsubscribeFn = jest.fn(); // For command input
const mockTurnEndedUnsubscribeFn = jest.fn(); // For TURN_ENDED_ID event

const mockCommandInputPort = {
    onCommand: jest.fn((listener) => {
        commandListenerCallback = listener;
        return mockUnsubscribeFn;
    }),
};

// --- Helper ---
const createMockPlayer = (id = 'player-1') => new Entity(id, ['player', 'actor']);

// --- Test Suite ---
describe('PlayerTurnHandler - Command Handling & Subscription', () => {
    let handler;
    let player;
    const className = PlayerTurnHandler.name;

    beforeEach(() => {
        jest.clearAllMocks();
        commandListenerCallback = null;
        player = createMockPlayer();

        mockPlayerPromptService.prompt.mockResolvedValue(undefined);
        mockTurnEndPort.notifyTurnEnded.mockResolvedValue(undefined);
        mockSafeEventDispatcher.subscribe.mockImplementation((eventId, callback) => {
            if (eventId === TURN_ENDED_ID) {
                // Store the callback if needed by a specific test that simulates event firing
                // but reset it for each test or ensure test logic is self-contained.
            }
            return mockTurnEndedUnsubscribeFn; // Return the specific mock for turn ended
        });
        mockCommandInputPort.onCommand.mockImplementation((listener) => {
            commandListenerCallback = listener;
            return mockUnsubscribeFn;
        }); // Ensure this is reset if modified by a test

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

    afterEach(async () => {
        if (handler) {
            try {
                handler.destroy();
                await new Promise(process.nextTick);
            } catch (e) { /* ignore */
            }
            handler = null;
        }
        player = null;
    });

    // --- Test Cases ---

    test('startTurn should subscribe to commands via CommandInputPort', async () => {
        await handler.startTurn(player);
        await new Promise(process.nextTick);

        expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1);
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledWith(expect.any(Function));
        expect(commandListenerCallback).toBeInstanceOf(Function);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(player);
        expect(mockUnsubscribeFn).not.toHaveBeenCalled();
    });

    test('startTurn should throw if CommandInputPort fails to return unsubscribe function', async () => {
        mockCommandInputPort.onCommand.mockReturnValueOnce(null); // Simulate failure

        const expectedErrorMsg = 'CommandInputPort.onCommand did not return a valid unsubscribe function.';
        await expect(handler.startTurn(player)).rejects.toThrow(expectedErrorMsg);
        await new Promise(process.nextTick); // Allow microtasks like _handleTurnEnd

        // Check that critical error is logged and turn end is notified
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`${className}: Critical error during turn initiation for ${player.id}: ${expectedErrorMsg}`),
            expect.any(Error)
        );
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        // The error passed to _handleTurnEnd will be the one from the throw.
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, false);
        expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled(); // Prompt shouldn't be called if subscription fails first
    });


    test('Successful command processing (END_TURN_SUCCESS) should notify TurnEndPort and unsubscribe', async () => {
        const command = 'wait';
        const commandResult = {success: true, turnEnded: false}; // turnEnded: false from CommandProcessor is typical for success
        mockCommandProcessor.processCommand.mockResolvedValue(commandResult);
        mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.END_TURN_SUCCESS);

        await handler.startTurn(player);
        await new Promise(process.nextTick);
        expect(commandListenerCallback).toBeInstanceOf(Function);

        await commandListenerCallback(command);
        await new Promise(process.nextTick); // Allow _handleSubmittedCommand to run
        await new Promise(process.nextTick); // Allow _handleTurnEnd microtasks

        // Assertions
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledTimes(1);
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(player, command);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledTimes(1);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(commandResult, player.id);

        // Since END_TURN_SUCCESS directive leads to direct _handleTurnEnd,
        // we should NOT expect subscription to TURN_ENDED_ID.
        expect(mockSafeEventDispatcher.subscribe).not.toHaveBeenCalledWith(TURN_ENDED_ID, expect.any(Function));

        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, true); // true because END_TURN_SUCCESS
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1); // Command input unsubscribed
        expect(mockTurnEndedUnsubscribeFn).not.toHaveBeenCalled(); // No event subscription to unsubscribe from
    });

    test('Command processing failure (DIRECT PROCESSOR FAILURE) should notify TurnEndPort (failure) and unsubscribe', async () => {
        const command = 'attack non_existent';
        const error = new Error("Target not found");
        // CommandProcessor itself indicates turn should end due to this failure
        const commandResult = {success: false, turnEnded: true, error: error.message, internalError: error.message};
        mockCommandProcessor.processCommand.mockResolvedValue(commandResult);

        await handler.startTurn(player);
        await new Promise(process.nextTick);
        expect(commandListenerCallback).toBeInstanceOf(Function);

        await commandListenerCallback(command);
        await new Promise(process.nextTick);
        await new Promise(process.nextTick);


        expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(player, command);
        expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled(); // Bypassed
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, false); // Failure
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1); // Command input unsubscribed
    });


    test('Submitting an empty command should re-prompt and not unsubscribe', async () => {
        await handler.startTurn(player);
        await new Promise(process.nextTick);
        mockPlayerPromptService.prompt.mockClear(); // Clear initial prompt call from startTurn

        await commandListenerCallback("  "); // Submit empty command
        await new Promise(process.nextTick);

        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();
        expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1); // Re-prompted
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
        expect(mockUnsubscribeFn).not.toHaveBeenCalled(); // Still subscribed
    });

    test('destroy() called mid-turn should force turn end (failure), notify, and unsubscribe', async () => {
        await handler.startTurn(player); // Turn is now active for 'player'
        await new Promise(process.nextTick);
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1);
        expect(commandListenerCallback).toBeInstanceOf(Function); // Ensure listener is set

        handler.destroy();
        await new Promise(process.nextTick); // Allow destroy to complete

        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, false); // false for failure
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1); // Command input unsubscribed
        expect(mockLogger.warn).toHaveBeenCalledWith(
            // Test the specific log message for this scenario
            `${className}: Destroying handler. If turn for ${player.id} was active or awaited, forcing turn end (failure).`
        );
    });


    test('destroy() called when no turn is active should not notify or error', async () => {
        // Handler is created, but startTurn is not called.
        handler.destroy();
        await new Promise(process.nextTick);

        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
        expect(mockUnsubscribeFn).not.toHaveBeenCalled(); // No command listener was set
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('forcing turn end'));
        // Check for the specific debug log when no context is active
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `${className}: Handler destroyed. No specific actor context was active or awaited at time of destruction. State cleared.`
        );
    });

    test('Turn ending due to prompt failure should unsubscribe', async () => {
        const promptError = new Error("Display service unavailable");
        mockPlayerPromptService.prompt.mockRejectedValueOnce(promptError);

        // Expect startTurn to reject because #_promptPlayerForAction re-throws
        await expect(handler.startTurn(player)).rejects.toThrow(promptError);
        await new Promise(process.nextTick); // Allow microtasks from _handleTurnEnd

        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, false); // False due to error
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1); // Command input unsubscribed

        // Check logs from both #_promptPlayerForAction and startTurn's catch block
        expect(mockLogger.error).toHaveBeenCalledWith(
            // UPDATED: Include the word "actor" in the expected string
            expect.stringContaining(`${className}: PlayerPromptService threw an error during prompt for actor ${player.id}: ${promptError.message}`),
            promptError
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`${className}: Critical error during turn initiation for ${player.id}: ${promptError.message}`),
            promptError
        );
    });


    test('Unsubscribe function error should be logged but not crash _handleTurnEnd', async () => {
        const command = 'wait';
        const commandResult = {success: true, turnEnded: false};
        mockCommandProcessor.processCommand.mockResolvedValue(commandResult);
        mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.END_TURN_SUCCESS);

        const unsubError = new Error("Command unsubscribe failed");
        mockUnsubscribeFn.mockImplementation(() => { // This is for commandInputPort.onCommand's unsubscribe
            throw unsubError;
        });

        await handler.startTurn(player);
        await new Promise(process.nextTick);
        expect(commandListenerCallback).toBeInstanceOf(Function);

        // This will lead to END_TURN_SUCCESS -> _handleTurnEnd -> _unsubscribeFromCommands
        await commandListenerCallback(command);
        await new Promise(process.nextTick); // For _handleSubmittedCommand
        await new Promise(process.nextTick); // For _handleTurnEnd and its async calls

        // Assertions
        expect(mockSafeEventDispatcher.subscribe).not.toHaveBeenCalledWith(TURN_ENDED_ID, expect.any(Function)); // No TURN_ENDED_ID sub
        expect(mockTurnEndedUnsubscribeFn).not.toHaveBeenCalled(); // So no unsub from it either

        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, true); // Turn ended "successfully" per directive

        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1); // Attempted (and threw)

        expect(mockLogger.error).toHaveBeenCalledTimes(1); // Only one error expected
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`${className}: Error calling command unsubscribe function: ${unsubError.message}`),
            unsubError
        );
    });

});
// --- FILE END ---