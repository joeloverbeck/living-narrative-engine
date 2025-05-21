// src/tests/core/turnManager.advanceTurn.actorIdentification.test.js
// --- FILE START (Corrected) ---

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import TurnManager from '../../src/turns/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../src/constants/componentIds.js';
import {TURN_ENDED_ID} from "../../src/constants/eventIds.js";

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

const mockTurnHandler = { // This is a generic base mock
    constructor: {name: 'MockTurnHandler'},
    startTurn: jest.fn().mockResolvedValue(undefined),
    handleTurn: jest.fn().mockResolvedValue(undefined),
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
    let mockUnsubscribe;
    let capturedTurnEndedHandler;

    beforeEach(async () => {
        jest.clearAllMocks();
        capturedTurnEndedHandler = null;

        mockEntityManager.activeEntities = new Map();

        mockTurnOrderService.isEmpty.mockResolvedValue(false);
        mockTurnOrderService.getNextEntity.mockResolvedValue(createMockEntity('initial-actor-for-start'));

        mockDispatcher.dispatchValidated.mockClear().mockResolvedValue(true);
        mockUnsubscribe = jest.fn();
        mockDispatcher.subscribe.mockClear().mockImplementation((eventType, handler) => {
            if (eventType === TURN_ENDED_ID) {
                capturedTurnEndedHandler = handler;
            }
            return mockUnsubscribe;
        });
        mockTurnOrderService.clearCurrentRound.mockResolvedValue();

        // Reset the generic mockTurnHandler's methods
        mockTurnHandler.startTurn.mockClear().mockResolvedValue(undefined);
        mockTurnHandler.handleTurn.mockClear().mockResolvedValue(undefined);
        mockTurnHandler.destroy.mockClear().mockResolvedValue(undefined);
        // Set default resolution for the resolver to the generic mockTurnHandler
        mockTurnHandlerResolver.resolveHandler.mockClear().mockResolvedValue(mockTurnHandler);

        instance = new TurnManager({
            logger: mockLogger,
            dispatcher: mockDispatcher,
            entityManager: mockEntityManager,
            turnOrderService: mockTurnOrderService,
            turnHandlerResolver: mockTurnHandlerResolver
        });

        stopSpy = jest.spyOn(instance, 'stop').mockImplementation(async () => {
        });

        await instance.start();

        expect(capturedTurnEndedHandler).toBeInstanceOf(Function);

        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockDispatcher.dispatchValidated.mockClear();
        mockTurnOrderService.isEmpty.mockClear();
        mockTurnOrderService.getNextEntity.mockClear();
        mockTurnHandlerResolver.resolveHandler.mockClear();
        mockTurnHandler.startTurn.mockClear();

        mockTurnOrderService.isEmpty.mockResolvedValue(false);
        mockDispatcher.dispatchValidated.mockResolvedValue(true);
        // Default resolver for tests will use the generic mockTurnHandler unless overridden in a test
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler);
    });

    afterEach(async () => {
        if (instance) {
            if (instance.getCurrentActor() || stopSpy.mock.calls.length === 0) {
                await instance.stop();
            }
        }
        if (stopSpy) {
            stopSpy.mockRestore();
        }
        instance = null;
        capturedTurnEndedHandler = null;
        jest.useRealTimers();
    });


    test('Player actor identified: resolves handler, calls startTurn, dispatches event', async () => {
        jest.useFakeTimers();

        const playerActor = createMockEntity('player-1', true, true);
        const entityType = 'player';
        mockTurnOrderService.getNextEntity.mockResolvedValue(playerActor);
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler); // Ensure generic handler used

        await instance.advanceTurn();

        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn initiation for Entity: ${playerActor.id} (${entityType}) <<<`);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
            entityId: playerActor.id,
            entityType: entityType
        });
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(playerActor);
        expect(mockTurnHandler.startTurn).toHaveBeenCalledWith(playerActor); // Assert on the generic mockTurnHandler
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`TurnManager now WAITING for 'core:turn_ended' event.`));
        expect(stopSpy).not.toHaveBeenCalled();

        expect(capturedTurnEndedHandler).toBeInstanceOf(Function);
        capturedTurnEndedHandler({type: TURN_ENDED_ID, payload: {entityId: playerActor.id, success: true}});

        await jest.runAllTimersAsync();
        expect(mockTurnHandler.destroy).toHaveBeenCalledTimes(1); // Assert on the generic mockTurnHandler

        jest.useRealTimers();
    });

    test('AI actor identified: resolves handler, calls startTurn, dispatches event', async () => {
        jest.useFakeTimers();

        const aiActor = createMockEntity('ai-goblin', true, false);
        const entityType = 'ai';
        mockTurnOrderService.getNextEntity.mockResolvedValue(aiActor);
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler); // Ensure generic handler used

        await instance.advanceTurn();

        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn initiation for Entity: ${aiActor.id} (${entityType}) <<<`);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
            entityId: aiActor.id,
            entityType: entityType
        });
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(aiActor);
        expect(mockTurnHandler.startTurn).toHaveBeenCalledWith(aiActor); // Assert on the generic mockTurnHandler
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`TurnManager now WAITING for 'core:turn_ended' event.`));
        expect(stopSpy).not.toHaveBeenCalled();

        expect(capturedTurnEndedHandler).toBeInstanceOf(Function);
        capturedTurnEndedHandler({type: TURN_ENDED_ID, payload: {entityId: aiActor.id, success: true}});

        await jest.runAllTimersAsync();
        expect(mockTurnHandler.destroy).toHaveBeenCalledTimes(1); // Assert on the generic mockTurnHandler

        jest.useRealTimers();
    });

});
// --- FILE END ---