// src/tests/core/turnManager.startStop.test.js
// --- FILE START (Entire file content as requested, with correction) ---

/**
 * @fileoverview TurnManager unit tests for start/stop functionality
 */
import TurnManager from '../../core/turnManager'; // Adjust path as needed
// Removed unused Entity import: import Entity from '../../entities/entity';
import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../types/components.js'; // Import component IDs


// --- Mock Dependencies ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(), // Keep if used elsewhere
};

const mockTurnOrderService = {
    startNewRound: jest.fn(),
    getNextEntity: jest.fn(),
    removeEntity: jest.fn(),
    clearCurrentRound: jest.fn(),
    getCurrentOrder: jest.fn(),
    isEmpty: jest.fn(),
    addEntity: jest.fn(),
};

// *** FIXED: Added missing subscribe method to mockDispatcher ***
const mockDispatcher = {
    dispatchValidated: jest.fn(),
    subscribe: jest.fn(), // <<< ADDED THIS LINE
};

const mockEntityManager = {
    // Ensure methods checked by constructor exist
    getEntityInstance: jest.fn(),
    // Mock activeEntities as needed by TurnManager (needs .values() returning an iterable)
    activeEntities: new Map(), // Use a Map to provide .values()
    // Keep other mocks if needed
    // getEntity: jest.fn(),
    // getEntitiesWithComponents: jest.fn(),
    // getAllEntities: jest.fn(),
};

// Mock ITurnHandlerResolver with the correct method name
const mockTurnHandlerResolver = {
    resolveHandler: jest.fn(),
};

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
describe('TurnManager', () => {
    let instance;
    let advanceTurnSpy;
    let turnEndedUnsubscribeMock = jest.fn(); // Mock for the unsubscribe function

    beforeEach(() => {
        jest.clearAllMocks();
        // Ensure activeEntities is a fresh Map for each test
        mockEntityManager.activeEntities = new Map();
        // Reset mock states
        mockTurnOrderService.clearCurrentRound.mockReset().mockResolvedValue(undefined); // Default success
        mockTurnHandlerResolver.resolveHandler.mockReset(); // Reset the correct mock method
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(null); // Default implementation
        mockDispatcher.subscribe.mockReset().mockReturnValue(turnEndedUnsubscribeMock); // Return the unsubscribe mock
        mockDispatcher.dispatchValidated.mockReset().mockResolvedValue(undefined); // Default success for dispatch
        turnEndedUnsubscribeMock.mockClear(); // Clear unsubscribe mock calls


        // Instantiate with the corrected mock dispatcher
        instance = new TurnManager({
            logger: mockLogger,
            turnOrderService: mockTurnOrderService,
            dispatcher: mockDispatcher, // <<< PASS CORRECTED MOCK
            entityManager: mockEntityManager,
            turnHandlerResolver: mockTurnHandlerResolver,
        });

        // Spy on advanceTurn AFTER instantiation
        // Default mock implementation is successful advanceTurn
        advanceTurnSpy = jest.spyOn(instance, 'advanceTurn').mockImplementation(async () => {
            mockLogger.debug('Mocked advanceTurn called (default success)');
            return Promise.resolve();
        });

        // Clear constructor logs if desired
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
    });

    afterEach(() => {
        // Restore any spied methods
        if (advanceTurnSpy) {
            advanceTurnSpy.mockRestore();
        }
        // Help GC
        instance = null;
        jest.useRealTimers(); // Ensure real timers are restored if fake ones were used
    });

    // --- Tests ---

    describe('constructor', () => {
        test('should create an instance with dependencies and log initialization', () => {
            // Clear mocks specifically for this test's instantiation check
            jest.clearAllMocks();
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(null); // Ensure mock is valid
            mockDispatcher.subscribe.mockReturnValue(turnEndedUnsubscribeMock); // Ensure subscribe returns mock

            const localInstance = new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: mockDispatcher, // Pass valid mock dispatcher
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver, // Pass valid mock resolver
            });
            expect(localInstance).toBeInstanceOf(TurnManager);
            expect(localInstance.getCurrentActor()).toBeNull();
            // Check the constructor log message
            expect(mockLogger.info).toHaveBeenCalledWith('TurnManager initialized successfully.');
            expect(mockLogger.info).toHaveBeenCalledTimes(1); // Ensure it's called exactly once during instantiation
        });

        // Test dependency validation failures
        test('should throw error if turnOrderService is invalid', () => {
            mockDispatcher.subscribe.mockReturnValue(turnEndedUnsubscribeMock); // Need valid dispatcher for this test
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(null); // Need valid resolver
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: {}, // Invalid
                dispatcher: mockDispatcher,
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver,
            })).toThrow('TurnManager requires a valid ITurnOrderService instance.');
        });
        test('should throw error if entityManager is invalid', () => {
            mockDispatcher.subscribe.mockReturnValue(turnEndedUnsubscribeMock); // Need valid dispatcher
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(null); // Need valid resolver
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: mockDispatcher,
                entityManager: {}, // Invalid
                turnHandlerResolver: mockTurnHandlerResolver,
            })).toThrow('TurnManager requires a valid EntityManager instance.');
        });
        test('should throw error if logger is invalid', () => {
            mockDispatcher.subscribe.mockReturnValue(turnEndedUnsubscribeMock); // Need valid dispatcher
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(null); // Need valid resolver
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            expect(() => new TurnManager({
                logger: {}, // Invalid
                turnOrderService: mockTurnOrderService,
                dispatcher: mockDispatcher,
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver,
            })).toThrow('TurnManager requires a valid ILogger instance.');
            consoleErrorSpy.mockRestore();
        });

        // Test specifically for dispatcher invalidity
        test('should throw error if dispatcher is invalid', () => {
            const expectedErrorMsgRegex = /requires a valid IValidatedEventDispatcher instance \(with dispatchValidated and subscribe methods\)/;
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(null); // Need valid resolver

            // Case 1: Missing dispatchValidated
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: {subscribe: jest.fn()}, // Invalid (missing dispatchValidated)
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver,
            })).toThrow(expectedErrorMsgRegex);

            // Case 2: Missing subscribe
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: {dispatchValidated: jest.fn()}, // Invalid (missing subscribe)
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver,
            })).toThrow(expectedErrorMsgRegex);

            // Case 3: dispatchValidated is not a function
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: {dispatchValidated: "not a function", subscribe: jest.fn()}, // Invalid type
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver,
            })).toThrow(expectedErrorMsgRegex);

            // Case 4: subscribe is not a function
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: {dispatchValidated: jest.fn(), subscribe: "not a function"}, // Invalid type
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver,
            })).toThrow(expectedErrorMsgRegex);
        });

        // Test specifically for turnHandlerResolver invalidity
        test('should throw error if turnHandlerResolver is invalid', () => {
            mockDispatcher.subscribe.mockReturnValue(turnEndedUnsubscribeMock); // Need valid dispatcher
            const expectedErrorMsgRegex = /requires a valid ITurnHandlerResolver instance \(with resolveHandler method\)/;

            // Case 1: Missing resolveHandler
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: mockDispatcher,
                entityManager: mockEntityManager,
                turnHandlerResolver: {}, // Invalid: missing resolveHandler
            })).toThrow(expectedErrorMsgRegex);

            // Case 2: resolveHandler is not a function
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: mockDispatcher,
                entityManager: mockEntityManager,
                turnHandlerResolver: {resolveHandler: "not a function"}, // Invalid: wrong type
            })).toThrow(expectedErrorMsgRegex);
        });
    });

    describe('getCurrentActor()', () => {
        test('should return null if no actor is current', () => {
            // Instance created fresh in beforeEach, #currentActor should be null
            expect(instance.getCurrentActor()).toBeNull();
        });
        // Add a test case where an actor IS current? Needs advanceTurn interaction.
    });

    describe('start()', () => {
        test('successful call: should log info, subscribe, and call advanceTurn', async () => {
            await instance.start();
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');
            // Check subscription happened
            expect(mockDispatcher.subscribe).toHaveBeenCalledTimes(1);
            expect(mockDispatcher.subscribe).toHaveBeenCalledWith(
                'core:turn_ended', // Assuming this is the constant TURN_ENDED_EVENT_TYPE
                expect.any(Function) // Check that a handler function was passed
            );
            // Check the spy that mocks advanceTurn
            expect(advanceTurnSpy).toHaveBeenCalledTimes(1);
        });

        test('when already running: should log warning and not call advanceTurn or subscribe again', async () => {
            await instance.start(); // First call sets #isRunning to true and subscribes
            // Clear mocks from the first call
            mockLogger.warn.mockClear();
            advanceTurnSpy.mockClear();
            mockDispatcher.subscribe.mockClear();

            await instance.start(); // Second call

            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith('TurnManager.start() called but manager is already running.');
            expect(advanceTurnSpy).not.toHaveBeenCalled(); // Should not call advanceTurn again
            expect(mockDispatcher.subscribe).not.toHaveBeenCalled(); // Should not subscribe again
        });
    });

    describe('stop()', () => {
        // Mock handler with destroy method for relevant tests
        let mockHandlerInstance;
        beforeEach(() => {
            // Recreate mock handler instance for each test in this describe block
            mockHandlerInstance = {
                startTurn: jest.fn().mockResolvedValue(undefined),
                destroy: jest.fn().mockResolvedValue(undefined),
            };
        });

        test('successful call (when running): should reset state, clear round, unsubscribe, and log', async () => {
            // Setup: Start the manager to set #isRunning = true and subscribe
            await instance.start();
            advanceTurnSpy.mockClear(); // Clear spy calls from start()
            mockDispatcher.subscribe.mockClear(); // Clear subscribe calls from start()
            turnEndedUnsubscribeMock.mockClear();

            // Reset mocks that stop interacts with for clean assertion
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            mockTurnOrderService.clearCurrentRound.mockClear().mockResolvedValue(undefined); // Ensure success

            // Act: Call stop
            await instance.stop();

            // Assert: #currentActor becomes null (verified via getter)
            expect(instance.getCurrentActor()).toBeNull();
            // Assert #isRunning becomes false (verified indirectly by next test or re-start)
            expect(mockTurnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager stopped.');
            expect(mockLogger.debug).toHaveBeenCalledWith('Turn order service current round cleared.');
            // Assert unsubscribe was called
            expect(turnEndedUnsubscribeMock).toHaveBeenCalledTimes(1);
        });

        test('successful call (when running with active handler): should call handler.destroy', async () => {
            // Arrange: Use real advanceTurn to set a current handler
            advanceTurnSpy.mockRestore(); // Use real advanceTurn
            const actor = createMockEntity('actor-destroy-test');
            mockTurnOrderService.isEmpty.mockResolvedValue(false);
            mockTurnOrderService.getNextEntity.mockResolvedValue(actor);
            // *** Ensure the correct mockHandlerInstance (from this scope's beforeEach) is resolved ***
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockHandlerInstance);

            // Mock handler.startTurn to resolve immediately so advanceTurn finishes quickly
            mockHandlerInstance.startTurn.mockResolvedValue(undefined);

            await instance.start(); // This will call advanceTurn, resolve, store handler, call startTurn

            // Verify handler was set (optional, good sanity check)
            expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(actor);
            expect(mockHandlerInstance.startTurn).toHaveBeenCalledWith(actor); // Verify startTurn was called


            // Clear mocks before stop
            mockLogger.debug.mockClear();
            mockHandlerInstance.destroy.mockClear(); // Clear the specific handler instance mock
            turnEndedUnsubscribeMock.mockClear();

            // Act: Stop the manager
            await instance.stop();

            // Assert: destroy was called on the handler
            expect(mockHandlerInstance.destroy).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Calling destroy() on current handler'));
            expect(turnEndedUnsubscribeMock).toHaveBeenCalledTimes(1); // Ensure unsubscribe still happens
        });

        test('handles error during handler.destroy but still stops', async () => {
            // Arrange: Use real advanceTurn, set a handler that throws on destroy
            advanceTurnSpy.mockRestore(); // Use real advanceTurn
            const actor = createMockEntity('actor-destroy-fail');
            const destroyError = new Error("Handler destroy failed");
            // *** Ensure the correct mockHandlerInstance is used and configured to reject ***
            mockHandlerInstance.destroy.mockRejectedValueOnce(destroyError);

            mockTurnOrderService.isEmpty.mockResolvedValue(false);
            mockTurnOrderService.getNextEntity.mockResolvedValue(actor);
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockHandlerInstance);
            // Mock handler.startTurn to resolve immediately
            mockHandlerInstance.startTurn.mockResolvedValue(undefined);

            await instance.start(); // Start and set the handler

            // Clear mocks before stop
            mockLogger.error.mockClear();
            mockLogger.info.mockClear();
            mockTurnOrderService.clearCurrentRound.mockClear();
            turnEndedUnsubscribeMock.mockClear();

            // Act: Stop the manager
            await instance.stop();

            // Assert: Error was logged, but stop completed
            expect(mockHandlerInstance.destroy).toHaveBeenCalledTimes(1); // Check destroy was called
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error calling destroy() on current handler during stop'), destroyError);
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager stopped.'); // Stop should still complete
            expect(instance.getCurrentActor()).toBeNull(); // State should still reset
            expect(mockTurnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1); // Clear round should still be called
            expect(turnEndedUnsubscribeMock).toHaveBeenCalledTimes(1); // Unsubscribe should still be called
        });


        test('when already stopped: should log info and do nothing else', async () => {
            // Instance starts in stopped state (#isRunning is false)
            mockLogger.info.mockClear();
            mockTurnOrderService.clearCurrentRound.mockClear();
            turnEndedUnsubscribeMock.mockClear();

            await instance.stop(); // Call stop when already stopped

            expect(mockLogger.info).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnManager.stop() called but manager is already stopped.');
            expect(mockTurnOrderService.clearCurrentRound).not.toHaveBeenCalled();
            expect(turnEndedUnsubscribeMock).not.toHaveBeenCalled(); // Should not try to unsubscribe again
            expect(instance.getCurrentActor()).toBeNull();
        });

        test('handles error during clearCurrentRound but still stops and unsubscribes', async () => {
            // Setup: Start the manager
            await instance.start(); // Uses default successful advanceTurn mock
            advanceTurnSpy.mockClear();
            turnEndedUnsubscribeMock.mockClear();

            const clearError = new Error('Clear failed');
            mockTurnOrderService.clearCurrentRound.mockRejectedValueOnce(clearError); // Make clear fail
            mockLogger.error.mockClear();
            mockLogger.info.mockClear();

            // Act: Call stop - should resolve even if clearCurrentRound fails
            await expect(instance.stop()).resolves.toBeUndefined();

            // Assert error logging and stop completion
            expect(mockTurnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1); // Ensure clear was called
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error calling turnOrderService.clearCurrentRound() during stop:', clearError
            );
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager stopped.');
            expect(turnEndedUnsubscribeMock).toHaveBeenCalledTimes(1); // Unsubscribe should still happen
            // Assert internal state was reset despite the error
            expect(instance.getCurrentActor()).toBeNull();

            // Assert #isRunning is false (try starting again)
            mockLogger.info.mockClear(); // Clear before re-start
            mockDispatcher.subscribe.mockClear(); // Clear subscribe mock too
            // No need to restore/re-spy advanceTurn here, the default mock from beforeEach is still active
            await instance.start();
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.'); // Should succeed
            expect(mockDispatcher.subscribe).toHaveBeenCalledTimes(1); // Should re-subscribe
            expect(advanceTurnSpy).toHaveBeenCalledTimes(1); // advanceTurn called by the second start
        });


        // --- REVISED TEST CASE: Stop called mid-turn (using real timers/async logic) ---
        test('stop() called after advanceTurn initiated a turn correctly resets state', async () => {
            // Arrange
            jest.useRealTimers();
            advanceTurnSpy.mockRestore(); // Use the real advanceTurn

            const actor = createMockEntity('actor-mid-stop', true, false);
            // *** Use the mockHandlerInstance from this scope's beforeEach ***
            const mockHandler = mockHandlerInstance;

            mockTurnOrderService.isEmpty.mockResolvedValue(false);
            mockTurnOrderService.getNextEntity.mockResolvedValue(actor);
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockHandler);
            mockTurnOrderService.clearCurrentRound.mockResolvedValue();
            mockDispatcher.dispatchValidated.mockResolvedValue();

            // Act (Part 1): Start the manager. Real advanceTurn runs.
            instance.start(); // Don't await, let it run in background

            // Give JS event loop a chance to process async advanceTurn
            await new Promise(resolve => setTimeout(resolve, 50));

            // Assertions after advanceTurn initiated:
            expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
            expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(actor);
            expect(mockHandler.startTurn).toHaveBeenCalledWith(actor);
            expect(instance.getCurrentActor()).toBe(actor);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("TurnManager now WAITING for 'core:turn_ended' event"));
            expect(mockDispatcher.subscribe).toHaveBeenCalledTimes(1);

            // Clear mocks before stop()
            turnEndedUnsubscribeMock.mockClear();
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            mockHandler.destroy.mockClear(); // Clear destroy mock
            mockTurnOrderService.clearCurrentRound.mockClear();

            // Act (Part 2): Call stop() while 'waiting'
            await instance.stop();

            // Assert: State after stop()
            expect(instance.getCurrentActor()).toBeNull();
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager stopped.');
            expect(mockTurnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);
            expect(turnEndedUnsubscribeMock).toHaveBeenCalledTimes(1);
            expect(mockHandler.destroy).toHaveBeenCalledTimes(1); // Destroy should have been called

            // Assert: #isRunning is false by starting again
            mockLogger.warn.mockClear();
            mockLogger.info.mockClear();
            mockDispatcher.subscribe.mockClear();
            advanceTurnSpy = jest.spyOn(instance, 'advanceTurn').mockResolvedValue(); // Re-mock advanceTurn
            await instance.start();
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('already running'));
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');
            expect(advanceTurnSpy).toHaveBeenCalledTimes(1); // Called by second start
            expect(mockDispatcher.subscribe).toHaveBeenCalledTimes(1); // Re-subscribed

        }, 10000); // Timeout for async operations
    });

});
// --- FILE END ---