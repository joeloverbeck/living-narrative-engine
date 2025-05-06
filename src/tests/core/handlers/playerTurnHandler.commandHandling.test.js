// src/tests/core/handlers/playerTurnHandler.commandHandling.test.js

/**
 * @fileoverview Tests for PlayerTurnHandler command handling and subscription lifecycle.
 */
// *** REMOVED: jest.useFakeTimers(); ***

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler';
import TurnDirective from '../../../core/constants/turnDirectives';
import Entity from '../../../entities/entity'; // Assuming Entity class exists
import { TURN_ENDED_ID } from '../../../core/constants/eventIds'; // <<< ADDED: Import TURN_ENDED_ID

// --- Mock Dependencies ---
// (Mocks remain the same)
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), };
const mockActionDiscoverySystem = { getValidActions: jest.fn(), };
const mockCommandProcessor = { processCommand: jest.fn(), };
const mockWorldContext = { getLocationOfEntity: jest.fn(), };
const mockEntityManager = { getEntityInstance: jest.fn(), };
const mockGameDataRepository = { getActionDefinition: jest.fn(), };
const mockPromptOutputPort = { prompt: jest.fn(), };
const mockTurnEndPort = { notifyTurnEnded: jest.fn(), };
const mockPlayerPromptService = { prompt: jest.fn(), };
const mockCommandOutcomeInterpreter = { interpret: jest.fn(), };
const mockSafeEventDispatcher = { dispatchSafely: jest.fn(), subscribe: jest.fn(), };
let commandListenerCallback = null;
const mockUnsubscribeFn = jest.fn();
const mockCommandInputPort = { onCommand: jest.fn((listener) => { commandListenerCallback = listener; return mockUnsubscribeFn; }), };
const mockTurnEndedUnsubscribeFn = jest.fn(); // Separate mock for turn ended unsubscribe


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
        mockUnsubscribeFn.mockClear();
        mockTurnEndedUnsubscribeFn.mockClear(); // Clear this mock too
        mockCommandInputPort.onCommand.mockImplementation((listener) => {
            commandListenerCallback = listener;
            return mockUnsubscribeFn;
        });
        mockSafeEventDispatcher.subscribe.mockReset();

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
                // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
                await new Promise(process.nextTick);
            } catch(e) { /* ignore */ }
            handler = null;
        }
        player = null;
    });

    // --- Test Cases ---

    test('startTurn should subscribe to commands via CommandInputPort', async () => {
        await handler.startTurn(player);
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick); // Allow async ops in startTurn

        expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1);
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledWith(expect.any(Function));
        expect(commandListenerCallback).toBeInstanceOf(Function);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledWith(player);
        expect(mockUnsubscribeFn).not.toHaveBeenCalled();
    });

    test('startTurn should throw if CommandInputPort fails to return unsubscribe function', async () => {
        mockCommandInputPort.onCommand.mockReturnValueOnce(null);

        const expectedError = 'CommandInputPort.onCommand did not return a valid unsubscribe function.';
        await expect(handler.startTurn(player)).rejects.toThrow(expectedError);
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick); // Allow potential cleanup microtasks

        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${className}: Critical error during turn initiation for ${player.id}`), expect.any(Error));
        expect(mockPlayerPromptService.prompt).not.toHaveBeenCalled();
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, false);
    });

    test('Successful command processing (END_TURN_SUCCESS) should notify TurnEndPort and unsubscribe', async () => {
        const command = 'wait';
        const commandResult = {success: true, turnEnded: true, actionResult: {actionId: 'core:wait'}, message: 'Done.'};
        mockCommandProcessor.processCommand.mockResolvedValue(commandResult);
        mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.END_TURN_SUCCESS);

        let turnEndedEventCallback;
        mockSafeEventDispatcher.subscribe.mockImplementation((eventId, callback) => {
            if (eventId === TURN_ENDED_ID) {
                turnEndedEventCallback = callback;
            }
            return mockTurnEndedUnsubscribeFn;
        });

        await handler.startTurn(player);
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick);
        expect(commandListenerCallback).toBeInstanceOf(Function);

        await commandListenerCallback(command);
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick); // Allow _handleSubmittedCommand -> #waitForTurnEndEvent setup

        expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledWith(TURN_ENDED_ID, expect.any(Function));
        expect(turnEndedEventCallback).toBeDefined();

        if (turnEndedEventCallback) {
            turnEndedEventCallback({ entityId: player.id, success: true });
        }

        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        // Using two ticks might give nested promises a better chance to resolve
        await new Promise(process.nextTick);
        await new Promise(process.nextTick);

        // Assertions
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledTimes(1);
        expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(player, command);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledTimes(1);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(commandResult, player.id);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, true);
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
        expect(mockTurnEndedUnsubscribeFn).toHaveBeenCalledTimes(1);
    });

    test('Command processing leading to RE_PROMPT should re-prompt and NOT unsubscribe', async () => {
        const command = 'look';
        const commandResult = {success: true, turnEnded: false, actionResult: {actionId: 'core:look'}};
        mockCommandProcessor.processCommand.mockResolvedValue(commandResult);
        mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.RE_PROMPT);

        await handler.startTurn(player);
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick); // Complete startTurn
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);

        await commandListenerCallback(command);
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick); // Complete command handling

        expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(player, command);
        expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(commandResult, player.id);
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(2);
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
        expect(mockUnsubscribeFn).not.toHaveBeenCalled();
        expect(mockTurnEndedUnsubscribeFn).not.toHaveBeenCalled();
    });

    test('Command processing failure (DIRECT PROCESSOR FAILURE) should notify TurnEndPort (failure) and unsubscribe', async () => {
        const command = 'attack non_existent';
        const error = new Error("Target not found");
        const commandResult = {success: false, turnEnded: true, error: error};
        mockCommandProcessor.processCommand.mockResolvedValue(commandResult);

        await handler.startTurn(player);
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick);

        await commandListenerCallback(command);
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick);

        expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(player, command);
        expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, false);
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
    });


    test('Submitting an empty command should re-prompt and not unsubscribe', async () => {
        await handler.startTurn(player);
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick);
        mockPlayerPromptService.prompt.mockClear();

        await commandListenerCallback("  ");
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick);

        expect(mockCommandProcessor.processCommand).not.toHaveBeenCalled();
        expect(mockCommandOutcomeInterpreter.interpret).not.toHaveBeenCalled();
        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
        expect(mockUnsubscribeFn).not.toHaveBeenCalled();
    });

    test('destroy() called mid-turn should force turn end (failure), notify, and unsubscribe', async () => {
        await handler.startTurn(player);
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick);
        expect(mockCommandInputPort.onCommand).toHaveBeenCalledTimes(1);

        handler.destroy();
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick);

        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, false);
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Destroying handler. If turn for ${player.id} was active or awaited, forcing turn end (failure).`)
        );
    });

    test('destroy() called when no turn is active should not notify or error', async () => {
        handler.destroy();
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick);

        expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
        expect(mockUnsubscribeFn).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Destroying handler while turn for'));
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`No active turn or await context found during destruction. State cleared.`)
        );
    });

    test('Turn ending due to prompt failure should unsubscribe', async () => {
        const promptError = new Error("Display service unavailable");
        mockPlayerPromptService.prompt.mockRejectedValueOnce(promptError);

        await expect(handler.startTurn(player)).rejects.toThrow(promptError.message);
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick);

        expect(mockPlayerPromptService.prompt).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, false);
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${className}: PlayerPromptService threw an error during prompt`), promptError);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${className}: Critical error during turn initiation`), promptError);
    });

    test('Unsubscribe function error should be logged but not crash _handleTurnEnd', async () => {
        const command = 'wait';
        const commandResult = {success: true, turnEnded: true};
        mockCommandProcessor.processCommand.mockResolvedValue(commandResult);
        mockCommandOutcomeInterpreter.interpret.mockResolvedValue(TurnDirective.END_TURN_SUCCESS);
        const unsubError = new Error("Command unsubscribe failed");
        mockUnsubscribeFn.mockImplementation(() => {
            throw unsubError;
        });

        let turnEndedEventCallback;
        const mockTurnEndedUnsubscribe = jest.fn();
        mockSafeEventDispatcher.subscribe.mockImplementation((eventId, callback) => {
            if (eventId === TURN_ENDED_ID) {
                turnEndedEventCallback = callback;
            }
            return mockTurnEndedUnsubscribe;
        });

        await handler.startTurn(player);
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick);

        await commandListenerCallback(command);
        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick); // Allow #waitForTurnEndEvent setup

        expect(turnEndedEventCallback).toBeDefined();

        if (turnEndedEventCallback) {
            turnEndedEventCallback({ entityId: player.id, success: true });
        }

        // *** REVERTED: Use process.nextTick instead of runAllMicrotasks ***
        await new Promise(process.nextTick);
        await new Promise(process.nextTick);

        // Assertions
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
        expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(player.id, true);
        expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1); // Attempted (and threw)
        expect(mockTurnEndedUnsubscribe).toHaveBeenCalledTimes(1); // Turn ended unsubscribe called
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error calling command unsubscribe function'),
            unsubError
        );
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

});
