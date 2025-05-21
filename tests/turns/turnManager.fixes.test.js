// src/tests/core/turnManager.fixes.test.js
// --- FILE START (Corrected) ---
import {jest, describe, beforeEach, afterEach, it, expect} from '@jest/globals';
import TurnManager from '../../src/turns/turnManager.js';
import {TURN_ENDED_ID} from "../../src/constants/eventIds.js";
import {ACTOR_COMPONENT_ID} from '../../src/constants/componentIds.js';


// Mock Entity structure
const mockEntity = (id) => ({
    id,
    hasComponent: jest.fn().mockReturnValue(false),
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

    beforeEach(() => {
        jest.useFakeTimers();

        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        const dispatcherHandlers = {};
        mockDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(undefined),
            subscribe: jest.fn((eventType, handler) => {
                if (!dispatcherHandlers[eventType]) {
                    dispatcherHandlers[eventType] = [];
                }
                dispatcherHandlers[eventType].push(handler);
                const unsubscribe = jest.fn(() => {
                    const index = dispatcherHandlers[eventType].indexOf(handler);
                    if (index > -1) {
                        dispatcherHandlers[eventType].splice(index, 1);
                    }
                });
                return unsubscribe;
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

        mockTurnOrderService = {
            clearCurrentRound: jest.fn().mockResolvedValue(undefined),
            isEmpty: jest.fn().mockResolvedValue(true), // Default: queue is empty for general tests
            getNextEntity: jest.fn().mockResolvedValue(mockActor1), // Default next entity if queue not empty
            startNewRound: jest.fn().mockImplementation(async () => {
                // CRITICAL FIX for recursion: When a new round starts,
                // simulate queue becoming non-empty for the *next* isEmpty check.
                mockTurnOrderService.isEmpty.mockReturnValue(Promise.resolve(false));
                // And ensure getNextEntity will return an actor for this new round's first turn.
                // Use mockReturnValueOnce if getNextEntity should behave differently later.
                mockTurnOrderService.getNextEntity.mockReturnValueOnce(Promise.resolve(mockActor1));
                return Promise.resolve(undefined);
            }),
        };

        mockEntityManager = {
            getEntityInstance: jest.fn(),
            activeEntities: new Map([['actor1', mockActor1]]),
        };
        mockActor1.hasComponent.mockImplementation(componentId => componentId === ACTOR_COMPONENT_ID);

        mockResolvedHandler = {
            startTurn: jest.fn().mockResolvedValue(undefined),
            destroy: jest.fn().mockResolvedValue(undefined),
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
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
        mockDispatcher._clearHandlers && mockDispatcher._clearHandlers();
    });

    describe('Event Handling for core:turn_ended', () => {
        beforeEach(async () => {
            // For this specific describe block, ensure the queue is NOT empty initially.
            mockTurnOrderService.isEmpty.mockResolvedValue(false);
            mockTurnOrderService.getNextEntity.mockResolvedValue(mockActor1); // Ensure getNextEntity is primed

            await turnManager.start();

            expect(turnManager.getCurrentActor()).toBe(mockActor1);
            expect(mockDispatcher.subscribe).toHaveBeenCalledWith(TURN_ENDED_ID, expect.any(Function));
            expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(mockActor1);
        });

        it('should not process core:turn_ended by advancing turn if manager is not running', async () => {
            await turnManager.stop(); // Stop the manager
            // Clear mocks that might have been called during start or before stop
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear(); // Also clear debug if it might be relevant
            mockTurnOrderService.getNextEntity.mockClear(); // Clear call counts

            const getNextEntityCallCountBeforeEvent = mockTurnOrderService.getNextEntity.mock.calls.length; // Should be 0

            const turnEndedEvent = {type: TURN_ENDED_ID, payload: {entityId: 'actor1', success: true}};
            mockDispatcher._triggerEvent(TURN_ENDED_ID, turnEndedEvent); // This calls #handleTurnEndedEvent

            // Check that the "Advancing turn..." log specifically does NOT happen
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Advancing turn...'));
            // Ensure advanceTurn was not called
            expect(mockTurnOrderService.getNextEntity.mock.calls.length).toBe(getNextEntityCallCountBeforeEvent);
        });

        it('should call destroy on the resolved currentHandler when turn ends successfully', async () => {
            expect(mockResolvedHandler.destroy).not.toHaveBeenCalled(); // Ensure not called yet
            const turnEndedEvent = {type: TURN_ENDED_ID, payload: {entityId: 'actor1', success: true}};
            mockDispatcher._triggerEvent(TURN_ENDED_ID, turnEndedEvent); // This triggers #handleTurnEndedEvent

            // The destroy call is asynchronous (Promise.resolve) within #handleTurnEndedEvent's setTimeout block.
            // We need to ensure timers and promises resolve.
            jest.runAllTimers(); // Flushes the setTimeout in #handleTurnEndedEvent
            await Promise.resolve(); // Flushes microtasks queue, including the Promise.resolve around destroy

            expect(mockResolvedHandler.destroy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Constructor and Start/Stop', () => {
        it('should throw error if dispatcher is missing subscribe method', () => {
            const invalidDispatcher = {dispatchValidated: jest.fn()};
            expect(() => new TurnManager({
                logger: mockLogger,
                dispatcher: invalidDispatcher,
                turnOrderService: mockTurnOrderService,
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver,
            })).toThrow('TurnManager requires a valid IValidatedEventDispatcher instance (with dispatchValidated and subscribe methods).');
        });

        // This test should now pass due to the corrected mock for mockTurnOrderService.startNewRound
        it('start should subscribe to TURN_ENDED_ID', async () => {
            // This test uses the default mockTurnOrderService setup from the outer beforeEach,
            // where isEmpty is initially true, to test the new round logic path.
            await turnManager.start();
            expect(mockDispatcher.subscribe).toHaveBeenCalledWith(TURN_ENDED_ID, expect.any(Function));
        });

        it('stop should unsubscribe from TURN_ENDED_ID', async () => {
            // Reset isEmpty to true for this specific test if it could have been changed by others,
            // though the main beforeEach should handle this.
            mockTurnOrderService.isEmpty.mockResolvedValue(true);
            // mockActor1.hasComponent is already set up to use ACTOR_COMPONENT_ID

            await turnManager.start(); // This will use the recursion-breaking mock

            const subscribeCall = mockDispatcher.subscribe.mock.calls.find(call => call[0] === TURN_ENDED_ID);
            expect(subscribeCall).toBeDefined();
            const unsubscribeFn = mockDispatcher.subscribe.mock.results[mockDispatcher.subscribe.mock.calls.indexOf(subscribeCall)].value;

            expect(unsubscribeFn).not.toHaveBeenCalled();

            await turnManager.stop();
            expect(unsubscribeFn).toHaveBeenCalledTimes(1);
        });
    });
});
// --- FILE END ---