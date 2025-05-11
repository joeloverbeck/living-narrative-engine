// src/tests/core/turns/turnManager.roundLifecycle.test.js
// --- FILE START ---

import TurnManager from '../../../core/turns/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../../types/components.js';
import {TURN_ENDED_ID, TURN_STARTED_ID, SYSTEM_ERROR_OCCURRED_ID} from '../../../core/constants/eventIds.js';
import {beforeEach, describe, expect, jest, test, afterEach} from "@jest/globals";

// --- Mock Implementations (Reusing from previous files) ---

class MockEntity {
    constructor(id, components = []) {
        this.id = id || `entity-${Math.random().toString(36).substr(2, 9)}`;
        this.components = new Map(components.map(c => [c, {}]));
        this.hasComponent = jest.fn((componentId) => this.components.has(componentId));
        this.getComponent = jest.fn((componentId) => this.components.get(componentId));
    }
}

const mockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    createChildLogger: jest.fn(() => mockLogger()),
});

const mockTurnOrderService = () => ({
    clearCurrentRound: jest.fn(async () => {
    }),
    isEmpty: jest.fn(async () => true),
    startNewRound: jest.fn(async (actors, strategy) => {
    }), // Modified to accept args
    getNextEntity: jest.fn(async () => null),
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    peekNextEntity: jest.fn(async () => null),
    getCurrentOrder: jest.fn(() => []),
    size: jest.fn(() => 0),
});

const mockEntityManager = () => ({
    getEntityInstance: jest.fn((id) => new MockEntity(id)),
    activeEntities: new Map(),
    getEntitiesWithComponents: jest.fn(() => []),
    createEntity: jest.fn(),
    destroyEntity: jest.fn(),
});

let mockUnsubscribeFunction;
const mockValidatedEventDispatcher = () => {
    mockUnsubscribeFunction = jest.fn();
    return {
        dispatchValidated: jest.fn(async (eventName, payload) => true),
        subscribe: jest.fn((eventName, callback) => mockUnsubscribeFunction),
        unsubscribe: jest.fn(),
    };
};

class MockTurnHandler {
    constructor(actor) {
        this.actor = actor;
        this.startTurn = jest.fn(async (currentActor) => {
        });
        this.destroy = jest.fn(async () => { // Make destroy a Jest mock function
        });
        this.signalNormalApparentTermination = jest.fn();
    }
}

const mockTurnHandlerResolver = () => ({
    resolveHandler: jest.fn(async (actor) => new MockTurnHandler(actor)),
});

// --- Test Suite ---

describe('TurnManager - Round Lifecycle and Turn Advancement', () => {
    let turnManager;
    let logger;
    let turnOrderService;
    let entityManager;
    let dispatcher;
    let turnHandlerResolver;

    let mockActor1, mockActor2, mockPlayerActor;

    beforeEach(() => {
        logger = mockLogger();
        turnOrderService = mockTurnOrderService();
        entityManager = mockEntityManager();
        dispatcher = mockValidatedEventDispatcher();
        turnHandlerResolver = mockTurnHandlerResolver();

        mockActor1 = new MockEntity('actor1', [ACTOR_COMPONENT_ID]);
        mockActor2 = new MockEntity('actor2', [ACTOR_COMPONENT_ID]);
        mockPlayerActor = new MockEntity('player1', [ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID]);

        const validOptions = {
            turnOrderService,
            entityManager,
            logger,
            dispatcher,
            turnHandlerResolver,
        };
        turnManager = new TurnManager(validOptions);

        // Reset activeEntities for each test to avoid interference
        entityManager.activeEntities = new Map();
    });

    afterEach(() => {
        jest.clearAllMocks();
        // Ensure manager is stopped to prevent test interference if a test fails to stop it.
        if (turnManager && turnManager._isRunning) { // Check internal flag for test purposes
            return turnManager.stop();
        }
        return Promise.resolve();
    });

    test('Starts a new round when queue is empty and active actors exist', async () => {
        entityManager.activeEntities.set(mockActor1.id, mockActor1);
        entityManager.activeEntities.set(mockPlayerActor.id, mockPlayerActor);

        // Mock return value for the first call to isEmpty, then for the recursive call
        turnOrderService.isEmpty.mockResolvedValueOnce(true) // Initial call: queue is empty
            .mockResolvedValueOnce(false); // After new round: queue not empty

        turnOrderService.getNextEntity.mockResolvedValueOnce(mockPlayerActor); // First entity of new round
        turnHandlerResolver.resolveHandler.mockResolvedValueOnce(new MockTurnHandler(mockPlayerActor));

        await turnManager.start();

        expect(logger.info).toHaveBeenCalledWith('Turn Manager started.');
        expect(logger.info).toHaveBeenCalledWith('Turn queue is empty. Attempting to start a new round.');
        expect(entityManager.activeEntities.size).toBe(2); // Verify entities were set up
        expect(turnOrderService.startNewRound).toHaveBeenCalledWith(
            expect.arrayContaining([mockActor1, mockPlayerActor]),
            'round-robin' // Default strategy
        );
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully started a new round with 2 actors'));
        expect(logger.debug).toHaveBeenCalledWith('New round started, recursively calling advanceTurn() to process the first turn.');

        expect(turnOrderService.getNextEntity).toHaveBeenCalledTimes(1); // Called once for the first turn of new round
        expect(turnHandlerResolver.resolveHandler).toHaveBeenCalledWith(mockPlayerActor);
        expect(dispatcher.dispatchValidated).toHaveBeenCalledWith(TURN_STARTED_ID, {
            entityId: mockPlayerActor.id,
            entityType: 'player',
        });
        expect(turnManager.getActiveTurnHandler().startTurn).toHaveBeenCalledWith(mockPlayerActor);
    });

    test('Fails to start a new round and stops if no active actors are found', async () => {
        turnOrderService.isEmpty.mockResolvedValue(true); // Queue is always empty
        // entityManager.activeEntities is already empty by default in beforeEach

        await turnManager.start();

        expect(logger.info).toHaveBeenCalledWith('Turn Manager started.');
        expect(logger.info).toHaveBeenCalledWith('Turn queue is empty. Attempting to start a new round.');
        expect(logger.error).toHaveBeenCalledWith('Cannot start a new round: No active entities with an Actor component found.');
        expect(dispatcher.dispatchValidated).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
            message: 'System Error: No active actors found to start a round. Stopping game.',
            type: 'error',
            details: 'Cannot start a new round: No active entities with an Actor component found.'
        });
        expect(logger.info).toHaveBeenCalledWith('Turn Manager stopped.');
        // Check that stop() was effectively called (e.g., unsubscribe)
        expect(mockUnsubscribeFunction).toHaveBeenCalled();
    });

    test('Advances turn when queue is not empty', async () => {
        turnOrderService.isEmpty.mockResolvedValue(false);
        turnOrderService.getNextEntity.mockResolvedValue(mockActor1);
        const handlerInstance = new MockTurnHandler(mockActor1);
        turnHandlerResolver.resolveHandler.mockResolvedValue(handlerInstance);

        await turnManager.start(); // This will call advanceTurn

        expect(logger.debug).toHaveBeenCalledWith('Queue not empty, retrieving next entity.');
        expect(turnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        expect(turnManager.getCurrentActor()).toBe(mockActor1);
        expect(turnHandlerResolver.resolveHandler).toHaveBeenCalledWith(mockActor1);
        expect(turnManager.getActiveTurnHandler()).toBe(handlerInstance);
        expect(dispatcher.dispatchValidated).toHaveBeenCalledWith(TURN_STARTED_ID, {
            entityId: mockActor1.id,
            entityType: 'ai', // mockActor1 has no PLAYER_COMPONENT_ID by default
        });
        expect(handlerInstance.startTurn).toHaveBeenCalledWith(mockActor1);
        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(`TurnManager now WAITING for '${TURN_ENDED_ID}' event.`));
    });

    test('advanceTurn does nothing if manager is not running', async () => {
        // Ensure manager is not running (it's not by default after instantiation)
        await turnManager.advanceTurn(); // Manually call advanceTurn (it's private, so test via start/stop or effect)
        // For this test, we can assume we could call it if needed or test through start not calling it.
        // Let's test its effect: if start() is not called, advanceTurn inside start won't run.
        // Or, if we could call it directly:
        turnManager._isRunning = false; // Force not running state for direct call test
        await turnManager.advanceTurn();

        expect(logger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() called while manager is not running. Returning.');
        expect(turnOrderService.isEmpty).not.toHaveBeenCalled(); // Core logic of advanceTurn skipped
    });

    test('Clears previous actor/handler before advancing to a new turn', async () => {
        // First turn
        turnOrderService.isEmpty.mockResolvedValue(false);
        turnOrderService.getNextEntity.mockResolvedValueOnce(mockActor1);
        const handler1 = new MockTurnHandler(mockActor1); // Capture handler1
        turnHandlerResolver.resolveHandler.mockResolvedValueOnce(handler1);

        await turnManager.start();
        expect(turnManager.getCurrentActor()).toBe(mockActor1);
        expect(turnManager.getActiveTurnHandler()).toBe(handler1);

        // Simulate turn end for mockActor1
        const turnEndCallback = dispatcher.subscribe.mock.calls.find(call => call[0] === TURN_ENDED_ID)[1];

        // Prepare for second turn
        turnOrderService.isEmpty.mockResolvedValue(false); // Still not empty
        turnOrderService.getNextEntity.mockResolvedValueOnce(mockActor2); // Next actor
        const handler2 = new MockTurnHandler(mockActor2);
        turnHandlerResolver.resolveHandler.mockResolvedValueOnce(handler2);

        // Trigger turn end, which will eventually call advanceTurn again
        await turnEndCallback({payload: {entityId: mockActor1.id, success: true}});

        // Need to allow setTimeout(0) in #handleTurnEndedEvent to execute
        await new Promise(resolve => setTimeout(resolve, 0));

        // Verify that the first handler's destroy method was called as part of cleanup
        expect(handler1.destroy).toHaveBeenCalled();

        // The specific log "Clearing previous actor..." from advanceTurn is not expected in this normal flow
        // because #currentActor is nulled in #handleTurnEndedEvent *before* advanceTurn is called.
        // That log is for specific interruption cases where advanceTurn is called while an actor is still "current".
        // expect(logger.debug).toHaveBeenCalledWith(`Clearing previous actor ${mockActor1.id} and handler before advancing.`);

        // Check that the new actor and handler are active
        expect(turnManager.getCurrentActor()).toBe(mockActor2);
        expect(turnManager.getActiveTurnHandler()).toBe(handler2);
    });

});

// --- FILE END ---