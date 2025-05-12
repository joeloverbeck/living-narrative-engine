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
    createChildLogger: jest.fn(() => mockLogger()), // Return a new instance for child loggers if needed
});

const mockTurnOrderService = () => ({
    clearCurrentRound: jest.fn(async () => {
    }),
    isEmpty: jest.fn(async () => true), // Default changed for simplicity if most tests need it empty
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
    resolveHandler: jest.fn(async (actor) => new MockTurnHandler(actor)), // Returns a *new* instance each time
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
    let mockHandlerA; // Variable to store the specific handler instance resolved for actorA

    beforeEach(async () => {
        logger = mockLogger();
        turnOrderService = mockTurnOrderService();
        entityManager = mockEntityManager();
        dispatcher = mockValidatedEventDispatcher(); // Re-initialize to get fresh capturedSubscribeCallback
        turnHandlerResolver = mockTurnHandlerResolver();
        capturedSubscribeCallback = null; // Reset captured callback

        mockActorA = new MockEntity('actorA', [ACTOR_COMPONENT_ID]);
        entityManager.activeEntities.set(mockActorA.id, mockActorA);

        // Configure mocks for the setup phase (start -> advanceTurn)
        turnOrderService.isEmpty.mockResolvedValue(false); // Queue is NOT empty initially
        turnOrderService.getNextEntity.mockResolvedValue(mockActorA); // It returns actorA

        // Since resolveHandler creates a new MockTurnHandler, capture it for assertion
        turnHandlerResolver.resolveHandler.mockImplementationOnce(async (actor) => {
            mockHandlerA = new MockTurnHandler(actor); // Store the instance
            return mockHandlerA;
        });


        const validOptions = {
            turnOrderService,
            entityManager,
            logger,
            dispatcher,
            turnHandlerResolver,
        };
        turnManager = new TurnManager(validOptions);
        await turnManager.start(); // Start the manager, it should subscribe and process first turn for actorA

        // Verify state after start
        expect(turnManager.getCurrentActor()).toBe(mockActorA);
        expect(turnManager.getActiveTurnHandler()).toBe(mockHandlerA); // Check the stored instance
        expect(capturedSubscribeCallback).toBeInstanceOf(Function); // Ensure callback was captured
        expect(mockHandlerA.startTurn).toHaveBeenCalledWith(mockActorA); // Ensure startTurn was called

        // Clear mocks that were called during the setup phase IF NEEDED by subsequent tests
        // logger.info.mockClear();
        // logger.debug.mockClear();
        // turnOrderService.isEmpty.mockClear(); // Be careful clearing mocks used in multiple phases
        // turnOrderService.getNextEntity.mockClear();
        // mockHandlerA.startTurn.mockClear();
        // dispatcher.dispatchValidated.mockClear();

    });

    afterEach(async () => {
        if (turnManager && typeof turnManager.stop === 'function') { // Check if stop exists before calling
            // Check if instance exists and is 'running' conceptually before stopping
            // Accessing private #isRunning directly isn't possible, rely on stop's internal check
            await turnManager.stop();
        }
        jest.clearAllMocks(); // Clears all mocks after each test
    });

    test('Correctly handles TURN_ENDED_ID for the current actor', async () => {
        // Arrange: Set up mocks for the state *after* the event is handled
        turnOrderService.isEmpty.mockResolvedValue(true); // Next advanceTurn will find queue empty
        entityManager.activeEntities.clear(); // So it tries to stop because no actors are found

        const eventPayload = {entityId: mockActorA.id, success: true};

        // --- FIX: Clear logger info calls from setup phase ---
        logger.info.mockClear();
        // --- END FIX ---

        // Act: Simulate the event
        capturedSubscribeCallback({type: TURN_ENDED_ID, payload: eventPayload});

        // Assert: Check logs from the event handler itself
        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received '${TURN_ENDED_ID}' event for entity ${mockActorA.id}. Success: true. Current actor: ${mockActorA.id}`));
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Turn for current actor ${mockActorA.id} confirmed ended`));
        expect(mockHandlerA.destroy).toHaveBeenCalledTimes(1); // Check destroy was called

        // Assert: Wait for the scheduled advanceTurn and check its effects
        await new Promise(resolve => setTimeout(resolve, 0)); // Wait for setTimeout

        expect(turnOrderService.isEmpty).toHaveBeenCalledTimes(2); // Initial call during start, then after turn end
        // Verify the log message from advanceTurn when the queue is empty
        expect(logger.info).toHaveBeenCalledWith('Turn queue is empty. Preparing for new round or stopping.');
        // Verify the log message when it tries to start the new round (before finding no actors)
        expect(logger.info).toHaveBeenCalledWith('Attempting to start a new round.');
        // Verify it correctly identifies no actors and logs the error
        expect(logger.error).toHaveBeenCalledWith('Cannot start a new round: No active entities with an Actor component found.');
        // Verify stop was called (implicitly via mock checks in afterEach or explicit spy if needed)
    });

    test('Ignores TURN_ENDED_ID if manager is stopped', async () => {
        const destroyCallCountBeforeStop = mockHandlerA.destroy.mock.calls.length;
        await turnManager.stop(); // Stop the manager
        const destroyCallCountAfterStop = mockHandlerA.destroy.mock.calls.length;
        expect(destroyCallCountAfterStop).toBeGreaterThanOrEqual(destroyCallCountBeforeStop); // Stop might call destroy

        logger.debug.mockClear(); // Clear logs from stop()

        const eventPayload = {entityId: mockActorA.id, success: true};
        capturedSubscribeCallback({type: TURN_ENDED_ID, payload: eventPayload});

        // Assert event handler logs it's stopped
        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received '${TURN_ENDED_ID}' but manager is stopped. Ignoring.`));
        // Assert handler destroy wasn't called AGAIN by the event handler
        expect(mockHandlerA.destroy).toHaveBeenCalledTimes(destroyCallCountAfterStop);

        // isEmpty was called once during the initial start() in beforeEach.
        // stop() does not call isEmpty. The event handler, when stopped, also does not proceed to advanceTurn.
        expect(turnOrderService.isEmpty).toHaveBeenCalledTimes(1); // Only the initial call from start
    });

    test('Ignores TURN_ENDED_ID if event payload is missing', async () => {
        const destroyCallCountBeforeEvent = mockHandlerA.destroy.mock.calls.length;

        capturedSubscribeCallback({type: TURN_ENDED_ID, payload: null});

        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`Received '${TURN_ENDED_ID}' event but it has no payload. Ignoring. Event:`), expect.anything());

        // Ensure handler.destroy wasn't called by this specific event invocation
        expect(mockHandlerA.destroy).toHaveBeenCalledTimes(destroyCallCountBeforeEvent);
        // Only the initial isEmpty call during start should have happened
        expect(turnOrderService.isEmpty).toHaveBeenCalledTimes(1);
    });

    test('Ignores TURN_ENDED_ID if payload.entityId does not match currentActor.id', async () => {
        const mockActorB = new MockEntity('actorB');
        const eventPayload = {entityId: mockActorB.id, success: true};

        const destroyCallCountBeforeEvent = mockHandlerA.destroy.mock.calls.length;

        capturedSubscribeCallback({type: TURN_ENDED_ID, payload: eventPayload});

        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`Received '${TURN_ENDED_ID}' for entity ${mockActorB.id}, but current active actor is ${mockActorA.id}. This event will be IGNORED`));
        // Ensure handler.destroy wasn't called by this specific event invocation
        expect(mockHandlerA.destroy).toHaveBeenCalledTimes(destroyCallCountBeforeEvent);
        // Only the initial isEmpty call during start should have happened
        expect(turnOrderService.isEmpty).toHaveBeenCalledTimes(1);
    });

    test('TURN_ENDED_ID handler calls currentHandler.destroy() and handles its errors', async () => {
        // Arrange: Set up mocks for the state *after* the event is handled
        turnOrderService.isEmpty.mockResolvedValue(true); // For subsequent advanceTurn
        entityManager.activeEntities.clear(); // So advanceTurn stops

        const destroyError = new Error('Handler Destroy Failed in Event');
        // Make the stored handler instance reject its destroy call
        mockHandlerA.destroy.mockRejectedValueOnce(destroyError);

        const eventPayload = {entityId: mockActorA.id, success: true};

        // Act: Simulate the event
        capturedSubscribeCallback({type: TURN_ENDED_ID, payload: eventPayload});

        // Assert: Check destroy was called and error was logged
        // Allow promise microtasks (like the .catch for destroyError in handleTurnEndedEvent) to run
        await new Promise(resolve => process.nextTick(resolve)); // Or jest.runAllTicks() if using fake timers

        expect(mockHandlerA.destroy).toHaveBeenCalledTimes(1); // Called by the event handler
        expect(logger.error).toHaveBeenCalledWith(
            `Error destroying handler for ${mockActorA.id} after turn end: ${destroyError.message}`,
            destroyError
        );

        // Assert: advanceTurn should still be scheduled and run
        await new Promise(resolve => setTimeout(resolve, 0)); // Wait for setTimeout(advanceTurn, 0)
        expect(turnOrderService.isEmpty).toHaveBeenCalledTimes(2); // Initial + after event
        // Check logs from the advanceTurn call
        expect(logger.info).toHaveBeenCalledWith('Turn queue is empty. Preparing for new round or stopping.');
        expect(logger.info).toHaveBeenCalledWith('Attempting to start a new round.');
        expect(logger.error).toHaveBeenCalledWith('Cannot start a new round: No active entities with an Actor component found.');
    });

    test('TURN_ENDED_ID handler clears currentActor and currentHandler before scheduling advanceTurn', async () => {
        // Arrange: Set up mocks for the state *after* the event is handled
        turnOrderService.isEmpty.mockResolvedValue(true);
        entityManager.activeEntities.clear();

        const eventPayload = {entityId: mockActorA.id, success: true};

        // Check state before event
        expect(turnManager.getCurrentActor()).toBe(mockActorA);
        expect(turnManager.getActiveTurnHandler()).toBe(mockHandlerA);

        // Act: Simulate the event
        capturedSubscribeCallback({type: TURN_ENDED_ID, payload: eventPayload});

        // Assert: Check state immediately after event handler runs (before setTimeout completes)
        expect(turnManager.getCurrentActor()).toBeNull(); // Should be cleared
        expect(turnManager.getActiveTurnHandler()).toBeNull(); // Should be cleared
        expect(mockHandlerA.destroy).toHaveBeenCalled(); // Destroy should have been called

        // Assert: Check effects after scheduled advanceTurn runs
        await new Promise(resolve => setTimeout(resolve, 0)); // Wait for setTimeout
        expect(turnOrderService.isEmpty).toHaveBeenCalledTimes(2); // Start + after event
        expect(logger.info).toHaveBeenCalledWith('Turn queue is empty. Preparing for new round or stopping.');
        expect(logger.info).toHaveBeenCalledWith('Attempting to start a new round.');
    });
});

// --- FILE END ---