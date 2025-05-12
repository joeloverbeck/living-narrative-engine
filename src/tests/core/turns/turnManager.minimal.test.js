// src/tests/core/turnManager.fixes.test.js
// --- FILE START (Corrected) ---
import {jest, describe, beforeEach, afterEach, it, expect} from '@jest/globals';
import TurnManager from '../../../core/turns/turnManager.js';
import {TURN_ENDED_ID, SYSTEM_ERROR_OCCURRED_ID} from "../../../core/constants/eventIds.js"; // Added SYSTEM_ERROR_OCCURRED_ID
import {ACTOR_COMPONENT_ID} from '../../../types/components.js';


// Mock Entity structure
const mockEntity = (id) => ({
    id,
    hasComponent: jest.fn().mockReturnValue(false), // Default to false, override in specific tests
});


describe('TurnManager', () => {
    let turnManager;
    let mockLogger;
    let mockDispatcher;
    let mockTurnOrderService;
    let mockEntityManager;
    let mockTurnHandlerResolver;
    let mockActor1;
    let mockResolvedHandler;
    let unsubscribeTurnEndedSpy; // To hold the spy for the unsubscribe function

    beforeEach(() => {
        jest.useFakeTimers();

        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        const dispatcherHandlers = {};
        unsubscribeTurnEndedSpy = jest.fn(); // Initialize the spy for the unsubscribe function

        mockDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(undefined),
            subscribe: jest.fn((eventType, handler) => {
                if (!dispatcherHandlers[eventType]) {
                    dispatcherHandlers[eventType] = [];
                }
                dispatcherHandlers[eventType].push(handler);
                // For TURN_ENDED_ID, return the specific spy, otherwise a generic jest.fn()
                return eventType === TURN_ENDED_ID ? unsubscribeTurnEndedSpy : jest.fn();
            }),
            _triggerEvent: (eventType, eventObject) => {
                if (dispatcherHandlers[eventType]) {
                    dispatcherHandlers[eventType].forEach(h => h(eventObject));
                }
            },
            _clearHandlers: () => {
                for (const key in dispatcherHandlers) {
                    delete dispatcherHandlers[key];
                }
            }
        };

        mockActor1 = mockEntity('actor1');
        // Ensure actor1 is recognized as an actor
        mockActor1.hasComponent.mockImplementation(componentId => componentId === ACTOR_COMPONENT_ID);


        mockTurnOrderService = {
            clearCurrentRound: jest.fn().mockResolvedValue(undefined),
            isEmpty: jest.fn().mockResolvedValue(true), // Default: queue is empty
            getNextEntity: jest.fn().mockResolvedValue(mockActor1),
            startNewRound: jest.fn().mockImplementation(async () => {
                mockTurnOrderService.isEmpty.mockResolvedValueOnce(false); // Next isEmpty is false
                mockTurnOrderService.getNextEntity.mockResolvedValueOnce(mockActor1); // Next entity
                return Promise.resolve(undefined);
            }),
        };

        mockEntityManager = {
            getEntityInstance: jest.fn(),
            activeEntities: new Map([['actor1', mockActor1]]), // Default with actor1
        };


        mockResolvedHandler = {
            startTurn: jest.fn().mockResolvedValue(undefined),
            destroy: jest.fn().mockResolvedValue(undefined),
            signalNormalApparentTermination: jest.fn(), // Ensure this exists on the mock
        };
        mockTurnHandlerResolver = {
            resolveHandler: jest.fn().mockResolvedValue(mockResolvedHandler),
        };

        turnManager = new TurnManager({
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            turnHandlerResolver: mockTurnHandlerResolver,
        });

        // Clear logs that might have been called during constructor
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers(); // Use clearAllTimers to reset both fake timers and their pending queues
        if (mockDispatcher._clearHandlers) mockDispatcher._clearHandlers();
    });

    describe('Event Handling for core:turn_ended', () => {
        beforeEach(async () => {
            // For this specific describe block, ensure the queue is NOT empty initially for start()
            mockTurnOrderService.isEmpty.mockResolvedValue(false);
            // getNextEntity is already primed to return mockActor1 from the outer beforeEach
            // resolveHandler is already primed to return mockResolvedHandler

            await turnManager.start(); // This will call advanceTurn which sets up actor1's turn

            // Assertions for successful setup
            expect(turnManager.getCurrentActor()).toBe(mockActor1);
            expect(mockDispatcher.subscribe).toHaveBeenCalledWith(TURN_ENDED_ID, expect.any(Function));
            expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(mockActor1);
            expect(mockResolvedHandler.startTurn).toHaveBeenCalledWith(mockActor1);

            // Clear logs from the start() and initial advanceTurn()
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            // Clear specific mock call counts if necessary, e.g., for getNextEntity
            mockTurnOrderService.getNextEntity.mockClear(); // Clear calls from initial advanceTurn
        });

        it('should correctly process core:turn_ended event when entityId matches current actor', async () => {
            const initialAdvanceTurnCallCount = mockTurnOrderService.getNextEntity.mock.calls.length; // Should be 0 here

            // --- FIX: Clear info log before triggering event ---
            mockLogger.info.mockClear();

            const turnEndedEvent = {type: TURN_ENDED_ID, payload: {entityId: 'actor1', success: true}};
            mockDispatcher._triggerEvent(TURN_ENDED_ID, turnEndedEvent);

            expect(mockLogger.info).toHaveBeenCalledWith(`Turn for current actor actor1 confirmed ended (Internal Status from Event: Success=true). Advancing turn...`);

            jest.runAllTimers(); // Advance timers to execute the setTimeout(advanceTurn, 0)
            await Promise.resolve(); // Ensure all microtasks spawned by advanceTurn complete

            // getNextEntity is called by the advanceTurn scheduled by the event handler
            expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(initialAdvanceTurnCallCount + 1);
        });

        it('should correctly process core:turn_ended event when success is not specified', async () => {
            const initialAdvanceTurnCallCount = mockTurnOrderService.getNextEntity.mock.calls.length; // Should be 0

            // --- FIX: Clear info log before triggering event ---
            mockLogger.info.mockClear();

            const turnEndedEvent = {type: TURN_ENDED_ID, payload: {entityId: 'actor1'}}; // success is undefined
            mockDispatcher._triggerEvent(TURN_ENDED_ID, turnEndedEvent);

            expect(mockLogger.info).toHaveBeenCalledWith(`Turn for current actor actor1 confirmed ended (Internal Status from Event: Success=N/A). Advancing turn...`);

            jest.runAllTimers();
            await Promise.resolve();

            expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(initialAdvanceTurnCallCount + 1);
        });

        it('should log a warning and not advance turn if core:turn_ended event entityId does not match current actor', async () => {
            const initialAdvanceTurnCallCount = mockTurnOrderService.getNextEntity.mock.calls.length;
            const turnEndedEvent = {type: TURN_ENDED_ID, payload: {entityId: 'someOtherActor', success: true}};

            mockDispatcher._triggerEvent(TURN_ENDED_ID, turnEndedEvent);

            expect(mockLogger.warn).toHaveBeenCalledWith(`Received '${TURN_ENDED_ID}' for entity someOtherActor, but current active actor is actor1. This event will be IGNORED by TurnManager's primary turn cycling logic.`);

            jest.runAllTimers();
            await Promise.resolve();

            expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(initialAdvanceTurnCallCount); // Not called again
        });

        it('should log a warning if core:turn_ended event has no payload', async () => {
            const initialAdvanceTurnCallCount = mockTurnOrderService.getNextEntity.mock.calls.length;
            const malformedEvent = {type: TURN_ENDED_ID}; // No payload

            mockDispatcher._triggerEvent(TURN_ENDED_ID, malformedEvent);

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Received '${TURN_ENDED_ID}' event but it has no payload. Ignoring. Event:`), malformedEvent);

            jest.runAllTimers();
            await Promise.resolve();

            expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(initialAdvanceTurnCallCount);
        });

        it('should log a warning and not advance if core:turn_ended event payload has no entityId', async () => {
            const initialAdvanceTurnCallCount = mockTurnOrderService.getNextEntity.mock.calls.length;
            // Payload exists, but entityId is missing (undefined)
            const malformedPayloadEvent = {type: TURN_ENDED_ID, payload: {success: true}};

            mockDispatcher._triggerEvent(TURN_ENDED_ID, malformedPayloadEvent);

            // The debug log in #handleTurnEndedEvent will show "entity undefined"
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received '${TURN_ENDED_ID}' event for entity undefined. Success: true. Current actor: actor1`));
            // The warning log will indicate it's ignored because 'undefined' !== 'actor1'
            expect(mockLogger.warn).toHaveBeenCalledWith(`Received '${TURN_ENDED_ID}' for entity undefined, but current active actor is actor1. This event will be IGNORED by TurnManager's primary turn cycling logic.`);

            jest.runAllTimers();
            await Promise.resolve();

            expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(initialAdvanceTurnCallCount);
        });

        it('should not process core:turn_ended by advancing turn if manager is not running', async () => {
            await turnManager.stop(); // Stop the manager

            mockLogger.info.mockClear(); // Clear logs from stop operation
            mockLogger.debug.mockClear();
            const getNextEntityCallCountBeforeEvent = mockTurnOrderService.getNextEntity.mock.calls.length;

            const turnEndedEvent = {type: TURN_ENDED_ID, payload: {entityId: 'actor1', success: true}};
            mockDispatcher._triggerEvent(TURN_ENDED_ID, turnEndedEvent);

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received '${TURN_ENDED_ID}' but manager is stopped. Ignoring.`));
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Advancing turn...'));
            expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(getNextEntityCallCountBeforeEvent);
        });

        it('should call destroy on the resolved currentHandler when turn ends successfully', async () => {
            expect(mockResolvedHandler.destroy).not.toHaveBeenCalled();

            const turnEndedEvent = {type: TURN_ENDED_ID, payload: {entityId: 'actor1', success: true}};
            mockDispatcher._triggerEvent(TURN_ENDED_ID, turnEndedEvent);

            jest.runAllTimers();
            await Promise.resolve(); // Let promise in #handleTurnEndedEvent's setTimeout resolve

            expect(mockResolvedHandler.destroy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Constructor and Start/Stop', () => {
        it('should throw error if dispatcher is missing subscribe method', () => {
            const invalidDispatcher = {dispatchValidated: jest.fn()}; // Missing subscribe
            expect(() => new TurnManager({
                logger: mockLogger,
                dispatcher: invalidDispatcher,
                turnOrderService: mockTurnOrderService,
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver,
            })).toThrow('TurnManager requires a valid IValidatedEventDispatcher instance (with dispatchValidated and subscribe methods).');
        });

        it('start should subscribe to TURN_ENDED_ID', async () => {
            // Uses mocks from outer beforeEach; start is called.
            // Ensure isEmpty is false for the initial advanceTurn in start to proceed with a turn.
            mockTurnOrderService.isEmpty.mockResolvedValue(false);
            mockTurnOrderService.getNextEntity.mockResolvedValue(mockActor1);

            await turnManager.start();
            expect(mockDispatcher.subscribe).toHaveBeenCalledWith(TURN_ENDED_ID, expect.any(Function));
        });

        it('stop should unsubscribe from TURN_ENDED_ID', async () => {
            mockTurnOrderService.isEmpty.mockResolvedValue(false); // To ensure start proceeds
            mockTurnOrderService.getNextEntity.mockResolvedValue(mockActor1);

            await turnManager.start(); // Subscribes

            expect(unsubscribeTurnEndedSpy).not.toHaveBeenCalled(); // Unsubscribe spy specific to TURN_ENDED_ID

            await turnManager.stop(); // Unsubscribes
            expect(unsubscribeTurnEndedSpy).toHaveBeenCalledTimes(1);
        });
    });
});
// --- FILE END ---