// src/tests/core/turns/turnManager.roundLifecycle.test.js
// --- FILE START ---

import TurnManager from '../../src/turns/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../src/constants/componentIds.js';
import {TURN_ENDED_ID, TURN_STARTED_ID, SYSTEM_ERROR_OCCURRED_ID} from '../../src/constants/eventIds.js';
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
    }),
    getNextEntity: jest.fn(async () => null), // Default mock implementation
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
        this.destroy = jest.fn(async () => {
        });
        this.signalNormalApparentTermination = jest.fn();
    }
}

const mockTurnHandlerResolver = () => ({
    resolveHandler: jest.fn(async (actor) => new MockTurnHandler(actor)), // Default mock implementation
});

// --- Test Suite ---

describe('TurnManager - Round Lifecycle and Turn Advancement', () => {
    let turnManager;
    let logger;
    let turnOrderService;
    let entityManager;
    let dispatcher;
    let turnHandlerResolver;
    let stopSpy;

    let mockActor1, mockActor2, mockPlayerActor;

    beforeEach(() => {
        jest.useFakeTimers();

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
        entityManager.activeEntities = new Map();
        stopSpy = jest.spyOn(turnManager, 'stop');

        logger.info.mockClear();
        logger.debug.mockClear();
        logger.warn.mockClear();
        logger.error.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
        if (turnManager && turnManager['#isRunning']) {
            return turnManager.stop();
        }
        return Promise.resolve();
    });

    test('Starts a new round when queue is empty and active actors exist', async () => {
        entityManager.activeEntities.set(mockActor1.id, mockActor1);
        entityManager.activeEntities.set(mockPlayerActor.id, mockPlayerActor);

        turnOrderService.isEmpty.mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
        turnOrderService.getNextEntity.mockResolvedValueOnce(mockPlayerActor);
        const mockHandlerInstance = new MockTurnHandler(mockPlayerActor);
        turnHandlerResolver.resolveHandler.mockResolvedValueOnce(mockHandlerInstance);

        await turnManager.start();
        jest.runAllTimers();
        await Promise.resolve();

        expect(logger.info).toHaveBeenCalledWith('Turn Manager started.');
        expect(logger.info).toHaveBeenCalledWith('Turn queue is empty. Preparing for new round or stopping.');
        expect(logger.info).toHaveBeenCalledWith('Attempting to start a new round.');
        expect(entityManager.activeEntities.size).toBe(2);
        expect(turnOrderService.startNewRound).toHaveBeenCalledWith(
            expect.arrayContaining([mockActor1, mockPlayerActor]),
            'round-robin'
        );
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully started a new round with 2 actors'));
        expect(logger.debug).toHaveBeenCalledWith('New round started, recursively calling advanceTurn() to process the first turn.');
        expect(turnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        expect(turnHandlerResolver.resolveHandler).toHaveBeenCalledWith(mockPlayerActor);
        expect(dispatcher.dispatchValidated).toHaveBeenCalledWith(TURN_STARTED_ID, {
            entityId: mockPlayerActor.id,
            entityType: 'player',
        });
        expect(mockHandlerInstance.startTurn).toHaveBeenCalledWith(mockPlayerActor);
    });

    test('Fails to start a new round and stops if no active actors are found', async () => {
        turnOrderService.isEmpty.mockResolvedValue(true);

        await turnManager.start();
        jest.runAllTimers();
        await Promise.resolve();

        expect(logger.info).toHaveBeenCalledWith('Turn Manager started.');
        expect(logger.info).toHaveBeenCalledWith('Turn queue is empty. Preparing for new round or stopping.');
        expect(logger.info).toHaveBeenCalledWith('Attempting to start a new round.');
        expect(logger.error).toHaveBeenCalledWith('Cannot start a new round: No active entities with an Actor component found.');
        expect(dispatcher.dispatchValidated).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
            message: 'System Error: No active actors found to start a round. Stopping game.',
            type: 'error',
            details: 'Cannot start a new round: No active entities with an Actor component found.'
        });
        expect(logger.info).toHaveBeenCalledWith('Turn Manager stopped.');
        expect(mockUnsubscribeFunction).toHaveBeenCalled();
        expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('Advances turn when queue is not empty', async () => {
        turnOrderService.isEmpty.mockResolvedValue(false);
        turnOrderService.getNextEntity.mockResolvedValue(mockActor1);
        const handlerInstance = new MockTurnHandler(mockActor1);
        turnHandlerResolver.resolveHandler.mockResolvedValue(handlerInstance);

        await turnManager.start();
        jest.runAllTimers();
        await Promise.resolve();

        expect(logger.debug).toHaveBeenCalledWith('Queue not empty, retrieving next entity.');
        expect(turnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        expect(turnManager.getCurrentActor()).toBe(mockActor1);
        expect(turnHandlerResolver.resolveHandler).toHaveBeenCalledWith(mockActor1);
        expect(turnManager.getActiveTurnHandler()).toBe(handlerInstance);
        expect(dispatcher.dispatchValidated).toHaveBeenCalledWith(TURN_STARTED_ID, {
            entityId: mockActor1.id,
            entityType: 'ai',
        });
        expect(handlerInstance.startTurn).toHaveBeenCalledWith(mockActor1);
        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(`TurnManager now WAITING for '${TURN_ENDED_ID}' event.`));
    });

    test('advanceTurn does nothing if manager is not running', async () => {
        await turnManager.advanceTurn();
        expect(logger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() called while manager is not running. Returning.');
        expect(turnOrderService.isEmpty).not.toHaveBeenCalled();
    });
});

// --- FILE END ---