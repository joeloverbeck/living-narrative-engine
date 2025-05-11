// src/tests/core/turns/turnManager.eventHandling.test.js
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
    }),
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
let capturedSubscribeCallback; // To capture the callback passed to dispatcher.subscribe

const mockValidatedEventDispatcher = () => {
    mockUnsubscribeFunction = jest.fn();
    return {
        dispatchValidated: jest.fn(async (eventName, payload) => true),
        subscribe: jest.fn((eventName, callback) => {
            if (eventName === TURN_ENDED_ID) {
                capturedSubscribeCallback = callback;
            }
            return mockUnsubscribeFunction;
        }),
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
    resolveHandler: jest.fn(async (actor) => new MockTurnHandler(actor)),
});

// --- Test Suite ---

describe('TurnManager - Event Handling (TURN_ENDED_ID)', () => {
    let turnManager;
    let logger;
    let turnOrderService;
    let entityManager;
    let dispatcher;
    let turnHandlerResolver;
    let mockActorA;
    let mockHandlerA;

    beforeEach(async () => {
        logger = mockLogger();
        turnOrderService = mockTurnOrderService();
        entityManager = mockEntityManager();
        dispatcher = mockValidatedEventDispatcher(); // Re-initialize to get fresh capturedSubscribeCallback
        turnHandlerResolver = mockTurnHandlerResolver();
        capturedSubscribeCallback = null; // Reset captured callback

        mockActorA = new MockEntity('actorA', [ACTOR_COMPONENT_ID]);
        entityManager.activeEntities.set(mockActorA.id, mockActorA);

        // Ensure mockHandlerA is fresh for each test, especially its jest.fn properties
        mockHandlerA = new MockTurnHandler(mockActorA);
        turnHandlerResolver.resolveHandler.mockResolvedValue(mockHandlerA);

        turnOrderService.isEmpty.mockResolvedValue(false);
        turnOrderService.getNextEntity.mockResolvedValue(mockActorA);

        const validOptions = {
            turnOrderService,
            entityManager,
            logger,
            dispatcher,
            turnHandlerResolver,
        };
        turnManager = new TurnManager(validOptions);
        await turnManager.start(); // Start the manager, it should subscribe and process first turn for actorA

        // Verify that currentActor is actorA
        expect(turnManager.getCurrentActor()).toBe(mockActorA);
        expect(turnManager.getActiveTurnHandler()).toBe(mockHandlerA);
        expect(capturedSubscribeCallback).toBeInstanceOf(Function); // Ensure callback was captured
    });

    afterEach(async () => {
        jest.clearAllMocks(); // Clears all mocks, so individual mock.destroy.mockClear() might not be strictly needed if this is comprehensive
        if (turnManager && turnManager._isRunning) { // Use a conceptual _isRunning, actual property is #isRunning (private)
            await turnManager.stop();
        }
    });

    test('Correctly handles TURN_ENDED_ID for the current actor', async () => {
        turnOrderService.isEmpty.mockResolvedValue(true); // Next advanceTurn will find queue empty
        entityManager.activeEntities.clear(); // So it tries to stop

        const eventPayload = {entityId: mockActorA.id, success: true};
        capturedSubscribeCallback({type: TURN_ENDED_ID, payload: eventPayload});

        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received '${TURN_ENDED_ID}' event for entity ${mockActorA.id}. Success: true. Current actor: ${mockActorA.id}`));
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Turn for current actor ${mockActorA.id} confirmed ended`));
        expect(mockHandlerA.destroy).toHaveBeenCalled();

        // advanceTurn is called via setTimeout, so we need to wait for it
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(turnOrderService.isEmpty).toHaveBeenCalledTimes(2); // Initial call during start, then after turn end
        expect(logger.info).toHaveBeenCalledWith('Turn queue is empty. Attempting to start a new round.'); // From the advanceTurn call
    });

    test('Ignores TURN_ENDED_ID if manager is stopped', async () => {
        // turnManager.start() in beforeEach would have set up a current handler.
        // stop() will call destroy on it.
        await turnManager.stop(); // Stop the manager
        logger.debug.mockClear(); // Clear previous debug logs from stop() or earlier

        // Crucially, clear the destroy mock *after* stop() has potentially called it.
        // We want to ensure the event handler *itself* doesn't call it again.
        mockHandlerA.destroy.mockClear();


        const eventPayload = {entityId: mockActorA.id, success: true};
        capturedSubscribeCallback({type: TURN_ENDED_ID, payload: eventPayload});

        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received '${TURN_ENDED_ID}' but manager is stopped. Ignoring.`));
        expect(mockHandlerA.destroy).not.toHaveBeenCalled(); // Now this checks if the event handler called it

        // isEmpty was called once during the initial start() in beforeEach.
        // stop() does not call isEmpty. The event handler, when stopped, also does not proceed to advanceTurn.
        expect(turnOrderService.isEmpty).toHaveBeenCalledTimes(1);
    });

    test('Ignores TURN_ENDED_ID if event payload is missing', async () => {
        const destroyCallCountBeforeEvent = mockHandlerA.destroy.mock.calls.length;

        capturedSubscribeCallback({type: TURN_ENDED_ID, payload: null});

        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`Received '${TURN_ENDED_ID}' event but it has no payload. Ignoring. Event:`), expect.anything());

        // Ensure handler.destroy wasn't called by this specific event invocation
        expect(mockHandlerA.destroy).toHaveBeenCalledTimes(destroyCallCountBeforeEvent);
        expect(turnOrderService.isEmpty).toHaveBeenCalledTimes(1); // No further advanceTurn triggered
    });

    test('Ignores TURN_ENDED_ID if payload.entityId does not match currentActor.id', async () => {
        const mockActorB = new MockEntity('actorB');
        const eventPayload = {entityId: mockActorB.id, success: true};

        const destroyCallCountBeforeEvent = mockHandlerA.destroy.mock.calls.length;

        capturedSubscribeCallback({type: TURN_ENDED_ID, payload: eventPayload});

        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`Received '${TURN_ENDED_ID}' for entity ${mockActorB.id}, but current active actor is ${mockActorA.id}. This event will be IGNORED`));
        expect(mockHandlerA.destroy).toHaveBeenCalledTimes(destroyCallCountBeforeEvent);
        expect(turnOrderService.isEmpty).toHaveBeenCalledTimes(1);
    });

    test('TURN_ENDED_ID handler calls currentHandler.destroy() and handles its errors', async () => {
        turnOrderService.isEmpty.mockResolvedValue(true); // For subsequent advanceTurn
        entityManager.activeEntities.clear();

        const destroyError = new Error('Handler Destroy Failed in Event');
        // Ensure this mock is fresh for the destroy call within this event handler
        mockHandlerA.destroy.mockRejectedValueOnce(destroyError);

        const eventPayload = {entityId: mockActorA.id, success: true};
        capturedSubscribeCallback({type: TURN_ENDED_ID, payload: eventPayload});

        // Allow promise microtasks (like the .catch for destroyError) to run
        await new Promise(resolve => process.nextTick(resolve));

        expect(mockHandlerA.destroy).toHaveBeenCalledTimes(1); // Called by the event handler
        expect(logger.error).toHaveBeenCalledWith(
            `Error destroying handler for ${mockActorA.id} after turn end: ${destroyError.message}`,
            destroyError
        );

        // advanceTurn should still be scheduled
        await new Promise(resolve => setTimeout(resolve, 0)); // Wait for setTimeout(advanceTurn, 0)
        expect(turnOrderService.isEmpty).toHaveBeenCalledTimes(2); // Initial + after event
    });

    test('TURN_ENDED_ID handler clears currentActor and currentHandler before scheduling advanceTurn', async () => {
        turnOrderService.isEmpty.mockResolvedValue(true);
        entityManager.activeEntities.clear();

        const eventPayload = {entityId: mockActorA.id, success: true};

        expect(turnManager.getCurrentActor()).toBe(mockActorA);
        expect(turnManager.getActiveTurnHandler()).toBe(mockHandlerA);

        capturedSubscribeCallback({type: TURN_ENDED_ID, payload: eventPayload});

        expect(turnManager.getCurrentActor()).toBeNull();
        expect(turnManager.getActiveTurnHandler()).toBeNull();
        expect(mockHandlerA.destroy).toHaveBeenCalled();

        await new Promise(resolve => setTimeout(resolve, 0));
        expect(turnOrderService.isEmpty).toHaveBeenCalledTimes(2);
    });
});

// --- FILE END ---