// src/tests/core/turns/turnManager.lifecycle.test.js
// --- FILE START ---

import TurnManager from '../../../core/turns/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../../types/components.js';
import {TURN_ENDED_ID, TURN_STARTED_ID, SYSTEM_ERROR_OCCURRED_ID} from '../../../core/constants/eventIds.js';
import {beforeEach, describe, expect, jest, test, afterEach} from "@jest/globals";

// --- Mock Implementations (Copied from turnManager.initialization.test.js for brevity) ---

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
    startNewRound: jest.fn(async () => {
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
    resolveHandler: jest.fn(async (actor) => new MockTurnHandler(actor)),
});


// --- Test Suite ---

describe('TurnManager - Start and Stop Lifecycle', () => {
    let turnManager;
    let logger;
    let turnOrderService;
    let entityManager;
    let dispatcher;
    let turnHandlerResolver;
    let mockActor1;

    beforeEach(() => {
        logger = mockLogger();
        turnOrderService = mockTurnOrderService();
        entityManager = mockEntityManager();
        dispatcher = mockValidatedEventDispatcher();
        turnHandlerResolver = mockTurnHandlerResolver();

        mockActor1 = new MockEntity('actor1', [ACTOR_COMPONENT_ID]);
        entityManager.activeEntities.set(mockActor1.id, mockActor1); // Add one actor

        const validOptions = {
            turnOrderService,
            entityManager,
            logger,
            dispatcher,
            turnHandlerResolver,
        };
        turnManager = new TurnManager(validOptions);

        // Default successful mocks for start()
        turnOrderService.isEmpty.mockResolvedValue(false); // Queue is not empty
        turnOrderService.getNextEntity.mockResolvedValue(mockActor1);
        turnHandlerResolver.resolveHandler.mockResolvedValue(new MockTurnHandler(mockActor1));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('start() method success path', async () => {
        await turnManager.start();

        expect(logger.info).toHaveBeenCalledWith('Turn Manager started.');
        expect(dispatcher.subscribe).toHaveBeenCalledWith(TURN_ENDED_ID, expect.any(Function));
        // isRunning is internal, check effects:
        expect(turnOrderService.isEmpty).toHaveBeenCalled(); // advanceTurn called
        expect(turnOrderService.getNextEntity).toHaveBeenCalled();
        expect(turnHandlerResolver.resolveHandler).toHaveBeenCalledWith(mockActor1);
        expect(dispatcher.dispatchValidated).toHaveBeenCalledWith(TURN_STARTED_ID, {
            entityId: mockActor1.id,
            entityType: 'ai', // Default if not PLAYER_COMPONENT_ID
        });
        const activeHandler = turnManager.getActiveTurnHandler();
        expect(activeHandler.startTurn).toHaveBeenCalledWith(mockActor1);
    });

    test('start() method called when already running logs a warning and does nothing else', async () => {
        await turnManager.start(); // First start
        const initialSubscribeCallCount = dispatcher.subscribe.mock.calls.length;
        const initialAdvanceCallCount = turnOrderService.isEmpty.mock.calls.length;

        await turnManager.start(); // Second start

        expect(logger.warn).toHaveBeenCalledWith('TurnManager.start() called but manager is already running.');
        expect(dispatcher.subscribe).toHaveBeenCalledTimes(initialSubscribeCallCount);
        expect(turnOrderService.isEmpty).toHaveBeenCalledTimes(initialAdvanceCallCount); // advanceTurn should not be called again
    });

    test('stop() method success when running', async () => {
        await turnManager.start(); // Ensure it's running and handler might be set
        const activeHandler = turnManager.getActiveTurnHandler(); // Get the handler instance set by start()

        await turnManager.stop();

        expect(logger.info).toHaveBeenCalledWith('Turn Manager stopped.');
        expect(mockUnsubscribeFunction).toHaveBeenCalled(); // Check if the unsubscribe function returned by subscribe was called
        if (activeHandler) {
            expect(activeHandler.destroy).toHaveBeenCalled();
        }
        expect(turnManager.getCurrentActor()).toBeNull();
        expect(turnManager.getActiveTurnHandler()).toBeNull();
        expect(turnOrderService.clearCurrentRound).toHaveBeenCalled();
        // isRunning is internal, but stop should make it false
    });

    test('stop() method called when already stopped logs info and does nothing else', async () => {
        // Stop once if it was somehow started by default (it's not, but for robustness)
        if (turnManager._isRunning) { // Accessing internal for test setup check
            await turnManager.stop();
            logger.info.mockClear(); // Clear logs from this potential stop
        }

        await turnManager.stop(); // Call stop when it's definitely not running

        expect(logger.info).toHaveBeenCalledWith('TurnManager.stop() called but manager is already stopped.');
        expect(mockUnsubscribeFunction).not.toHaveBeenCalled();
        expect(turnOrderService.clearCurrentRound).not.toHaveBeenCalled();
    });

    describe('stop() and currentHandler.destroy() interaction', () => {
        let mockHandlerInstance;

        beforeEach(async () => {
            mockHandlerInstance = new MockTurnHandler(mockActor1);
            turnHandlerResolver.resolveHandler.mockResolvedValue(mockHandlerInstance);
            await turnManager.start(); // Start and set currentHandler
            // Ensure currentHandler is indeed set
            expect(turnManager.getActiveTurnHandler()).toBe(mockHandlerInstance);
        });

        test('stop() calls currentHandler.destroy() successfully', async () => {
            mockHandlerInstance.destroy.mockResolvedValue(undefined); // Ensure destroy resolves

            await turnManager.stop();

            expect(mockHandlerInstance.destroy).toHaveBeenCalledTimes(1);
            expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('Error calling destroy()'));
            expect(turnOrderService.clearCurrentRound).toHaveBeenCalled(); // Ensure stop continues
        });

        test('stop() calls currentHandler.destroy() and logs error if destroy fails', async () => {
            const destroyError = new Error('Handler Destroy Failed');
            mockHandlerInstance.destroy.mockRejectedValue(destroyError);

            await turnManager.stop();

            expect(mockHandlerInstance.destroy).toHaveBeenCalledTimes(1);
            expect(logger.error).toHaveBeenCalledWith(
                `Error calling destroy() on current handler during stop: ${destroyError.message}`,
                destroyError
            );
            expect(turnOrderService.clearCurrentRound).toHaveBeenCalled(); // Ensure stop still completes other tasks
            expect(turnManager.getCurrentActor()).toBeNull(); // Resources are still cleared
            expect(turnManager.getActiveTurnHandler()).toBeNull();
        });

        test('stop() proceeds if currentHandler has no destroy method', async () => {
            mockHandlerInstance.destroy = undefined; // Remove destroy method

            await turnManager.stop();

            expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('Error calling destroy()'));
            expect(logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Calling destroy() on current handler'));
            expect(turnOrderService.clearCurrentRound).toHaveBeenCalled();
        });

        test('stop() proceeds if currentHandler is null', async () => {
            // Manually nullify the handler after start, or ensure start fails to set one
            // For this test, let's assume start failed to set a handler or it was cleared
            turnManager._currentHandler = null; // Directly manipulate for test setup
            turnManager._currentActor = null;   // And actor for consistency

            await turnManager.stop(); // Calling stop when it was "running" but handler is null

            expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('Error calling destroy()'));
            expect(turnOrderService.clearCurrentRound).toHaveBeenCalled();
        });
    });
});

// --- FILE END ---