// src/tests/core/turns/turnManager.lifecycle.test.js
// --- FILE START ---

import TurnManager from '../../src/turns/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../src/constants/componentIds.js';
import {TURN_ENDED_ID, TURN_STARTED_ID, SYSTEM_ERROR_OCCURRED_ID} from '../../src/constants/eventIds.js';
import {beforeEach, describe, expect, jest, test, afterEach} from "@jest/globals";

// --- Mock Implementations (Keep as before) ---

class MockEntity {
    constructor(id, components = []) {
        this.id = id || `entity-${Math.random().toString(36).substr(2, 9)}`;
        this.name = id;
        this.components = new Map(components.map(c => [c.componentId || c, {}]));
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
    clearCurrentRound: jest.fn().mockResolvedValue(undefined),
    isEmpty: jest.fn().mockResolvedValue(true),
    startNewRound: jest.fn().mockResolvedValue(undefined),
    getNextEntity: jest.fn().mockResolvedValue(null),
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    peekNextEntity: jest.fn().mockResolvedValue(null),
    getCurrentOrder: jest.fn(() => []),
    size: jest.fn(() => 0),
});

const mockEntityManager = () => ({
    getEntityInstance: jest.fn((id) => new MockEntity(id)),
    activeEntities: new Map(),
    getEntitiesWithComponents: jest.fn(() => []),
    _setActiveEntities: function (entities) {
        this.activeEntities = new Map(entities.map(e => [e.id, e]));
        this.getEntitiesWithComponents.mockImplementation((componentId) =>
            Array.from(this.activeEntities.values()).filter(entity => entity.hasComponent(componentId))
        );
    }
});

let mockUnsubscribeFunction;
const mockValidatedEventDispatcher = () => {
    mockUnsubscribeFunction = jest.fn();
    return {
        dispatchValidated: jest.fn().mockResolvedValue(true),
        subscribe: jest.fn((eventName, callback) => mockUnsubscribeFunction),
        unsubscribe: jest.fn(),
    };
};

let mockHandlerInstances = new Map();

class MockTurnHandler {
    constructor(actor) {
        this.actor = actor;
        this.startTurn = jest.fn().mockResolvedValue(undefined);
        this.destroy = jest.fn().mockResolvedValue(undefined);
        this.signalNormalApparentTermination = jest.fn();
        mockHandlerInstances.set(actor?.id, this); // Use actor?.id safely
    }
}

const mockTurnHandlerResolver = () => ({
    resolveHandler: jest.fn(async (actor) => new MockTurnHandler(actor)),
});

// --- Test Suite ---

describe('TurnManager - Lifecycle (Start/Stop)', () => {
    let turnManager;
    let logger;
    let turnOrderService;
    let entityManager;
    let dispatcher;
    let turnHandlerResolver;
    let advanceTurnSpy;

    beforeEach(() => {
        jest.useRealTimers();
        mockHandlerInstances.clear();

        logger = mockLogger();
        turnOrderService = mockTurnOrderService();
        entityManager = mockEntityManager();
        dispatcher = mockValidatedEventDispatcher();
        turnHandlerResolver = mockTurnHandlerResolver();

        const validOptions = {
            turnOrderService,
            entityManager,
            logger,
            dispatcher,
            turnHandlerResolver,
        };
        turnManager = new TurnManager(validOptions);

        // Default: Mock advanceTurn to isolate start/stop logic
        advanceTurnSpy = jest.spyOn(turnManager, 'advanceTurn').mockResolvedValue(undefined);

        logger.info.mockClear(); // Clear constructor log
    });

    afterEach(() => {
        advanceTurnSpy.mockRestore(); // Restore original advanceTurn
        jest.clearAllMocks(); // General cleanup
        turnManager = null;
    });

    // --- start() Tests (Largely Unchanged) ---
    describe('start()', () => {
        // These tests rely on the mocked advanceTurnSpy

        it('should set running state, subscribe to TURN_ENDED_ID, call advanceTurn, and log success', async () => {
            await turnManager.start();
            expect(logger.info).toHaveBeenCalledWith('Turn Manager started.');
            expect(dispatcher.subscribe).toHaveBeenCalledTimes(1);
            expect(dispatcher.subscribe).toHaveBeenCalledWith(TURN_ENDED_ID, expect.any(Function));
            expect(advanceTurnSpy).toHaveBeenCalledTimes(1);
        });

        it('should log warning and do nothing else if called when already running', async () => {
            await turnManager.start();
            logger.warn.mockClear();
            dispatcher.subscribe.mockClear();
            advanceTurnSpy.mockClear();
            await turnManager.start();
            expect(logger.warn).toHaveBeenCalledWith('TurnManager.start() called but manager is already running.');
            expect(dispatcher.subscribe).not.toHaveBeenCalled();
            expect(advanceTurnSpy).not.toHaveBeenCalled();
        });

        it('should handle subscription failure gracefully (invalid return value)', async () => {
            dispatcher.subscribe.mockReturnValue(null);
            const stopSpy = jest.spyOn(turnManager, 'stop');
            await turnManager.start();
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`CRITICAL: Failed to subscribe to ${TURN_ENDED_ID}`), expect.any(Error));
            expect(dispatcher.dispatchValidated).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, expect.objectContaining({details: expect.stringContaining('Subscription function did not return an unsubscribe callback')}));
            expect(stopSpy).toHaveBeenCalledTimes(1);
            stopSpy.mockRestore();
        });

        it('should handle subscription failure gracefully (subscribe throws)', async () => {
            const subscribeError = new Error("Dispatcher connection failed");
            dispatcher.subscribe.mockImplementation(() => {
                throw subscribeError;
            });
            const stopSpy = jest.spyOn(turnManager, 'stop');
            await turnManager.start();
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`CRITICAL: Failed to subscribe to ${TURN_ENDED_ID}`), subscribeError);
            expect(dispatcher.dispatchValidated).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, expect.objectContaining({details: subscribeError.message}));
            expect(stopSpy).toHaveBeenCalledTimes(1);
            stopSpy.mockRestore();
        });
    });

    // --- stop() Tests ---
    describe('stop()', () => {

        // --- Tests requiring specific setup (active handler) ---
        describe('when stopped with an active handler', () => {
            let mockActor;
            let handlerInstance;

            // ** REVISED beforeEach: Use real advanceTurn to set state **
            beforeEach(async () => {
                mockActor = new MockEntity('actor-for-stop', [ACTOR_COMPONENT_ID]);
                entityManager._setActiveEntities([mockActor]);

                // Use real advanceTurn for setup
                advanceTurnSpy.mockRestore(); // Use original method
                turnOrderService.isEmpty.mockResolvedValue(false);
                turnOrderService.getNextEntity.mockResolvedValue(mockActor);
                // Ensure resolveHandler returns a known instance
                turnHandlerResolver.resolveHandler.mockImplementation(async (actor) => {
                    // Use the handlerInstance scoped to this block
                    handlerInstance = new MockTurnHandler(actor);
                    return handlerInstance;
                });

                // Start the manager - this WILL call the real advanceTurn
                await turnManager.start();

                // Verify setup state AFTER start/advanceTurn completed
                expect(turnManager.getCurrentActor()).toBe(mockActor);
                expect(turnManager.getActiveTurnHandler()).toBe(handlerInstance);
                expect(handlerInstance.startTurn).toHaveBeenCalledWith(mockActor);
                expect(dispatcher.subscribe).toHaveBeenCalledTimes(1); // Called by start()

                // ** Targeted Mock Clearing **
                // Clear calls made during setup phase *before* the actual test runs stop()
                logger.info.mockClear();
                logger.debug.mockClear();
                logger.error.mockClear();
                handlerInstance.startTurn.mockClear(); // Clear calls from setup
                handlerInstance.destroy.mockClear();   // Clear destroy calls before test
                dispatcher.subscribe.mockClear();      // Clear subscribe calls from setup
                mockUnsubscribeFunction.mockClear();   // Clear the unsubscribe mock itself
                turnOrderService.clearCurrentRound.mockClear();

                // Re-mock advanceTurn for subsequent calls IF needed (usually not needed for stop tests)
                advanceTurnSpy = jest.spyOn(turnManager, 'advanceTurn').mockResolvedValue(undefined);
            });

            it('should clear running state, unsubscribe, destroy handler, clear actor/handler, clear round, and log success', async () => {
                // Pre-checks (state reliably set by beforeEach)
                expect(turnManager.getCurrentActor()).toBe(mockActor);
                expect(turnManager.getActiveTurnHandler()).toBe(handlerInstance);

                await turnManager.stop();

                // Check Logs
                expect(logger.info).toHaveBeenCalledWith('Turn Manager stopped.');
                // Check the specific debug log content if needed:
                expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Calling destroy() on current handler'));
                expect(logger.debug).toHaveBeenCalledWith('Turn order service current round cleared.');
                // Check Unsubscribe Call
                expect(mockUnsubscribeFunction).toHaveBeenCalledTimes(1);
                // Check Handler Destroy Call
                expect(handlerInstance.destroy).toHaveBeenCalledTimes(1);
                // Check TurnOrderService Call
                expect(turnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);
                // Check State Cleared
                expect(turnManager.getCurrentActor()).toBeNull();
                expect(turnManager.getActiveTurnHandler()).toBeNull();
            });

            it('should log error and continue if handler.destroy() fails', async () => {
                const destroyError = new Error("Handler explosion on destroy");
                handlerInstance.destroy.mockRejectedValueOnce(destroyError);

                await turnManager.stop();

                expect(handlerInstance.destroy).toHaveBeenCalledTimes(1);
                expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Error calling destroy() on current handler during stop`), destroyError);
                // Check stop still completed
                expect(mockUnsubscribeFunction).toHaveBeenCalledTimes(1);
                expect(turnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);
                expect(turnManager.getCurrentActor()).toBeNull();
                expect(turnManager.getActiveTurnHandler()).toBeNull();
                expect(logger.info).toHaveBeenCalledWith('Turn Manager stopped.');
            });

            it('should proceed if currentHandler has no destroy method', async () => {
                handlerInstance.destroy = undefined; // Remove method

                await turnManager.stop();

                expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('Error calling destroy()'));
                expect(logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Calling destroy() on current handler'));
                // Check other actions
                expect(mockUnsubscribeFunction).toHaveBeenCalledTimes(1);
                expect(turnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);
                expect(logger.info).toHaveBeenCalledWith('Turn Manager stopped.');
            });

            it('should correctly reset state when stopped shortly after starting a turn', async () => {
                // The state is already set by the beforeEach here

                // Pre-checks
                expect(turnManager.getCurrentActor()).toBe(mockActor);
                expect(turnManager.getActiveTurnHandler()).toBe(handlerInstance);

                // Act
                await turnManager.stop();

                // Assert state after stop
                expect(turnManager.getCurrentActor()).toBeNull();
                expect(turnManager.getActiveTurnHandler()).toBeNull();
                expect(logger.info).toHaveBeenCalledWith('Turn Manager stopped.');
                expect(turnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);
                expect(mockUnsubscribeFunction).toHaveBeenCalledTimes(1);
                expect(handlerInstance.destroy).toHaveBeenCalledTimes(1);

                // Assert can restart
                logger.warn.mockClear();
                logger.info.mockClear();
                dispatcher.subscribe.mockClear();
                // advanceTurnSpy is already mocked again by nested beforeEach's clear phase
                await turnManager.start();
                expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('already running'));
                expect(logger.info).toHaveBeenCalledWith('Turn Manager started.');
                expect(advanceTurnSpy).toHaveBeenCalledTimes(1); // From second start
                expect(dispatcher.subscribe).toHaveBeenCalledTimes(1); // From second start
            });

        }); // End describe 'when stopped with an active handler'

        // --- Tests not requiring specific handler state ---

        it('should log info and do nothing else if called when already stopped', async () => {
            // Start and stop once to ensure it's stopped
            await turnManager.start(); // Uses mocked advanceTurn
            await turnManager.stop();

            // Clear mocks
            logger.info.mockClear();
            mockUnsubscribeFunction.mockClear();
            turnOrderService.clearCurrentRound.mockClear();

            await turnManager.stop(); // Call stop again

            expect(logger.info).toHaveBeenCalledWith('TurnManager.stop() called but manager is already stopped.');
            expect(mockUnsubscribeFunction).not.toHaveBeenCalled();
            expect(turnOrderService.clearCurrentRound).not.toHaveBeenCalled();
        });

        it('should proceed if currentHandler is null', async () => {
            // Setup: Start the manager, relying on mocked advanceTurn to NOT set a handler
            await turnManager.start();
            expect(turnManager.getCurrentActor()).toBeNull(); // Verify handler wasn't set
            expect(turnManager.getActiveTurnHandler()).toBeNull();

            // Clear logs before stop
            logger.debug.mockClear();
            logger.error.mockClear();
            mockUnsubscribeFunction.mockClear();
            turnOrderService.clearCurrentRound.mockClear();
            logger.info.mockClear();


            await turnManager.stop();

            // Assertions
            expect(logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Calling destroy() on current handler'));
            expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('Error calling destroy()'));
            expect(mockUnsubscribeFunction).toHaveBeenCalledTimes(1);
            expect(turnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);
            expect(logger.info).toHaveBeenCalledWith('Turn Manager stopped.');
        });

        it('should log error and continue if unsubscribe function throws', async () => {
            // Setup: Start the manager
            await turnManager.start();
            // Make unsubscribe throw
            const unsubscribeError = new Error("Dispatcher failed to unsubscribe");
            mockUnsubscribeFunction.mockImplementation(() => {
                throw unsubscribeError;
            });

            // Clear mocks before stop
            logger.error.mockClear();
            turnOrderService.clearCurrentRound.mockClear();
            logger.info.mockClear();
            // Clear unsubscribe mock calls specifically
            mockUnsubscribeFunction.mockClear();


            await turnManager.stop();

            // Assertions
            expect(mockUnsubscribeFunction).toHaveBeenCalledTimes(1); // Should still be called
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Error calling unsubscribe function for ${TURN_ENDED_ID}`), unsubscribeError);
            expect(turnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1); // Should still clear round
            expect(turnManager.getCurrentActor()).toBeNull();
            expect(logger.info).toHaveBeenCalledWith('Turn Manager stopped.');
        });

        it('should log error and continue if turnOrderService.clearCurrentRound fails', async () => {
            // Setup: Start the manager
            await turnManager.start();
            // Make clearCurrentRound fail
            const clearError = new Error("Failed to clear turn order");
            turnOrderService.clearCurrentRound.mockRejectedValueOnce(clearError);

            // Clear mocks before stop
            logger.error.mockClear();
            mockUnsubscribeFunction.mockClear();
            logger.info.mockClear();
            turnOrderService.clearCurrentRound.mockClear();


            await turnManager.stop();

            // Assertions
            expect(turnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1); // Should still be called
            expect(logger.error).toHaveBeenCalledWith('Error calling turnOrderService.clearCurrentRound() during stop:', clearError);
            expect(mockUnsubscribeFunction).toHaveBeenCalledTimes(1); // Should still unsubscribe
            expect(turnManager.getCurrentActor()).toBeNull();
            expect(logger.info).toHaveBeenCalledWith('Turn Manager stopped.');
        });

    }); // End describe stop()
});
// --- FILE END ---