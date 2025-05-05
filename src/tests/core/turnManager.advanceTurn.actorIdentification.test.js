// src/tests/core/turnManager.advanceTurn.actorIdentification.test.js
// --- FILE START (Corrected) ---

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import TurnManager from '../../core/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../types/components.js';
import {TURN_ENDED_ID} from "../../core/constants/eventIds.js";

// --- Mock Dependencies ---
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

const mockDispatcher = {
    dispatch: jest.fn(),
    dispatchValidated: jest.fn().mockResolvedValue(true),
    subscribe: jest.fn().mockReturnValue(jest.fn()), // Returns mock unsubscribe
};

const mockEntityManager = {
    activeEntities: new Map(),
    getEntityInstance: jest.fn(),
};

const mockTurnOrderService = {
    startNewRound: jest.fn(),
    getNextEntity: jest.fn(),
    isEmpty: jest.fn(),
    getCurrentOrder: jest.fn(),
    removeEntity: jest.fn(),
    addEntity: jest.fn(),
    clearCurrentRound: jest.fn(),
};

const mockTurnHandler = {
    constructor: {name: 'MockTurnHandler'},
    startTurn: jest.fn().mockResolvedValue(undefined),
    handleTurn: jest.fn().mockResolvedValue(undefined), // Keep if needed
    destroy: jest.fn().mockResolvedValue(undefined),
};

const mockTurnHandlerResolver = {
    resolveHandler: jest.fn(),
};
// --- END MOCKS ---

// Helper to create mock entities
const createMockEntity = (id, isActor = true, isPlayer = false) => ({
    id: id,
    hasComponent: jest.fn((componentId) => {
        if (componentId === ACTOR_COMPONENT_ID) return isActor;
        if (componentId === PLAYER_COMPONENT_ID) return isPlayer;
        return false;
    }),
});

// --- Test Suite ---

describe('TurnManager: advanceTurn() - Actor Identification & Handling (Queue Not Empty)', () => {
    let instance;
    let stopSpy;
    let initialAdvanceTurnSpy;
    let mockUnsubscribe;
    let capturedTurnEndedHandler; // <<< To capture the handler function

    beforeEach(async () => {
        jest.clearAllMocks();
        capturedTurnEndedHandler = null; // Reset captured handler

        // --- Reset Mocks ---
        mockEntityManager.activeEntities = new Map();
        mockTurnOrderService.isEmpty.mockResolvedValue(false);
        mockTurnOrderService.getNextEntity.mockResolvedValue(null);
        mockDispatcher.dispatchValidated.mockClear().mockResolvedValue(true);
        mockUnsubscribe = jest.fn();
        // Capture the handler passed to subscribe
        mockDispatcher.subscribe.mockClear().mockImplementation((eventType, handler) => {
            if (eventType === TURN_ENDED_ID) {
                capturedTurnEndedHandler = handler; // Capture the handler
            }
            return mockUnsubscribe; // Return the mock unsubscribe function
        });
        mockTurnOrderService.clearCurrentRound.mockResolvedValue();

        mockTurnHandler.startTurn.mockClear().mockResolvedValue(undefined);
        mockTurnHandler.handleTurn.mockClear().mockResolvedValue(undefined);
        mockTurnHandler.destroy.mockClear().mockResolvedValue(undefined);
        mockTurnHandlerResolver.resolveHandler.mockClear().mockResolvedValue(mockTurnHandler);

        // --- Instantiate TurnManager ---
        instance = new TurnManager({
            logger: mockLogger,
            dispatcher: mockDispatcher,
            entityManager: mockEntityManager,
            turnOrderService: mockTurnOrderService,
            turnHandlerResolver: mockTurnHandlerResolver
        });

        stopSpy = jest.spyOn(instance, 'stop').mockImplementation(async () => {
        });

        // --- Start instance (this calls subscribe and captures the handler) ---
        initialAdvanceTurnSpy = jest.spyOn(instance, 'advanceTurn').mockImplementationOnce(async () => {
        });
        await instance.start();
        initialAdvanceTurnSpy.mockRestore();

        // Expect that the handler was captured during start()
        expect(capturedTurnEndedHandler).toBeInstanceOf(Function);

        // --- Clear mocks called during setup ---
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockDispatcher.dispatchValidated.mockClear();
        mockTurnOrderService.isEmpty.mockClear();
        mockTurnOrderService.getNextEntity.mockClear();
        mockTurnHandlerResolver.resolveHandler.mockClear();
        mockTurnHandler.startTurn.mockClear();
        mockTurnHandler.handleTurn.mockClear();
        mockTurnHandler.destroy.mockClear();

        // Re-apply default mocks needed post-setup
        mockTurnOrderService.isEmpty.mockResolvedValue(false);
        mockDispatcher.dispatchValidated.mockResolvedValue(true);
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler);
        mockTurnHandler.startTurn.mockResolvedValue(undefined);
    });

    afterEach(async () => {
        // Ensure stop is called to potentially trigger unsubscribe
        if (instance && instance['#isRunning']) {
            await instance.stop();
        } else if (stopSpy) {
            stopSpy.mockRestore();
        }
        instance = null;
        capturedTurnEndedHandler = null;
        // Ensure timers are restored if a test fails before useRealTimers
        jest.useRealTimers();
    });

    // --- Test Cases ---

    test('Player actor identified: resolves handler, calls startTurn, dispatches event', async () => {
        // --- FIX: Enable fake timers for this test ---
        jest.useFakeTimers();
        // --- END FIX ---

        // Arrange
        const playerActor = createMockEntity('player-1', true, true);
        const entityType = 'player';
        mockTurnOrderService.getNextEntity.mockResolvedValue(playerActor);

        // Act
        await instance.advanceTurn(); // Initiates the turn

        // Assert initial actions
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn initiation for Entity: ${playerActor.id} (${entityType}) <<<`);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
            entityId: playerActor.id,
            entityType: entityType
        });
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(playerActor);
        expect(mockTurnHandler.startTurn).toHaveBeenCalledWith(playerActor);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Turn initiation for ${playerActor.id} started via ${mockTurnHandler.constructor.name}. TurnManager now WAITING for 'core:turn_ended' event.`));
        expect(stopSpy).not.toHaveBeenCalled();

        // Simulate the turn ending by calling the captured handler
        expect(capturedTurnEndedHandler).toBeInstanceOf(Function);
        capturedTurnEndedHandler({entityId: playerActor.id, success: true});

        // Advance timers to process the setTimeout in the handler
        await jest.runAllTimersAsync(); // <<< This should now work
        expect(mockTurnHandler.destroy).toHaveBeenCalledTimes(1); // Check handler cleanup

        // --- FIX: Disable fake timers ---
        jest.useRealTimers();
        // --- END FIX ---
    });

    test('AI actor identified: resolves handler, calls startTurn, dispatches event', async () => {
        // --- FIX: Enable fake timers for this test ---
        jest.useFakeTimers();
        // --- END FIX ---

        // Arrange
        const aiActor = createMockEntity('ai-goblin', true, false);
        const entityType = 'ai';
        mockTurnOrderService.getNextEntity.mockResolvedValue(aiActor);

        // Act
        await instance.advanceTurn();

        // Assert initial actions
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn initiation for Entity: ${aiActor.id} (${entityType}) <<<`);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
            entityId: aiActor.id,
            entityType: entityType
        });
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(aiActor);
        expect(mockTurnHandler.startTurn).toHaveBeenCalledWith(aiActor);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Turn initiation for ${aiActor.id} started via ${mockTurnHandler.constructor.name}. TurnManager now WAITING for 'core:turn_ended' event.`));
        expect(stopSpy).not.toHaveBeenCalled();

        // Simulate the turn ending by calling the captured handler
        expect(capturedTurnEndedHandler).toBeInstanceOf(Function);
        capturedTurnEndedHandler({entityId: aiActor.id, success: true});

        // Advance timers to process the setTimeout in the handler
        await jest.runAllTimersAsync(); // <<< This should now work
        expect(mockTurnHandler.destroy).toHaveBeenCalledTimes(1);

        // --- FIX: Disable fake timers ---
        jest.useRealTimers();
        // --- END FIX ---
    });

    test('Handles startTurn initiation rejection gracefully (error logged, dispatches error, advances turn)', async () => {
        // Arrange
        const aiActor = createMockEntity('ai-reject-start', true, false);
        mockTurnOrderService.getNextEntity.mockResolvedValue(aiActor);
        const handlerError = new Error("StartTurn action failed during initiation");
        const expectedLogMsg = `Error during handler.startTurn() initiation for entity ${aiActor.id} (${mockTurnHandler.constructor.name}): ${handlerError.message}`;
        const expectedDispatchDetails = `Error initiating turn for ${aiActor.id}.`;

        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler);
        mockTurnHandler.startTurn.mockRejectedValue(handlerError);

        const advanceTurnRecurseSpy = jest.spyOn(instance, 'advanceTurn');
        // Use fake timers AND spy on global.setTimeout
        jest.useFakeTimers();
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

        // Act
        await instance.advanceTurn();

        // Assert startTurn called and rejected
        expect(mockTurnHandler.startTurn).toHaveBeenCalledWith(aiActor);

        // Assert error logging and dispatch
        expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg, handlerError);
        // The #dispatchSystemError helper extracts the error message for details
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:system_error_occurred', {
            message: expectedDispatchDetails,
            type: 'error',
            details: handlerError.message // Expecting the raw error message here
        });
        expect(mockLogger.warn).toHaveBeenCalledWith(`Manually advancing turn after startTurn initiation failure for ${aiActor.id}.`);

        // Assert on the setTimeout spy
        expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
        expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 0);

        // Fast-forward timers
        jest.runOnlyPendingTimers();

        // Assert advanceTurn was called again
        expect(advanceTurnRecurseSpy).toHaveBeenCalledTimes(2); // Initial + recursive
        expect(stopSpy).not.toHaveBeenCalled();

        // Cleanup spy and timers
        setTimeoutSpy.mockRestore();
        jest.useRealTimers();
        advanceTurnRecurseSpy.mockRestore();
    });

    test('Handles resolver failure gracefully (critical error logged, dispatches error, stops)', async () => {
        // Arrange
        const playerActor = createMockEntity('player-no-resolver', true, true);
        const entityType = 'player'; // <<< Added for turn_started check
        mockTurnOrderService.getNextEntity.mockResolvedValue(playerActor);
        const resolveError = new Error("Cannot resolve handler");

        mockTurnHandlerResolver.resolveHandler.mockRejectedValue(resolveError);

        const advanceTurnRecurseSpy = jest.spyOn(instance, 'advanceTurn');
        // No fake timers needed here

        // Act
        await instance.advanceTurn();

        // Assert resolution attempted
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(playerActor);
        expect(mockTurnHandler.startTurn).not.toHaveBeenCalled();

        // Assert critical error logging, dispatch, and stop
        // 1. Logger gets the prefixed message
        const expectedLogMsg = `CRITICAL Error during turn advancement logic (before handler initiation): ${resolveError.message}`;
        expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg, resolveError);

        // 2. Dispatcher gets turn_started before the error happens
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
            entityId: playerActor.id, entityType: entityType
        });

        // 3. Dispatcher gets system_error_occurred with the raw error message in details
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:system_error_occurred', {
            message: 'System Error during turn advancement. Stopping game.',
            type: 'error',
            // --- CORRECTION START ---
            details: resolveError.message // Expect the raw message as per #dispatchSystemError logic
            // --- CORRECTION END ---
        });

        // 4. Stop is called
        expect(stopSpy).toHaveBeenCalledTimes(1);

        // advanceTurn should NOT have been called recursively in this critical path
        expect(advanceTurnRecurseSpy).toHaveBeenCalledTimes(1);

        // Clean up spy
        advanceTurnRecurseSpy.mockRestore();
    });

});
// --- FILE END ---