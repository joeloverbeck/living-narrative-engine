// src/tests/core/turnManager.startStop.test.js
// --- FILE START (Entire file content as requested) ---

/**
 * @fileoverview TurnManager unit tests for start/stop functionality
 */
import TurnManager from '../../core/turnManager'; // Adjust path as needed
import Entity from '../../entities/entity'; // Adjust path as needed
import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';

// --- Mock Dependencies ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
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

const mockDispatcher = {
    dispatchValidated: jest.fn(),
};

const mockEntityManager = {
    getEntity: jest.fn(),
    getEntityInstance: jest.fn(),
    getEntitiesWithComponents: jest.fn(),
    getAllEntities: jest.fn(),
    activeEntities: {values: jest.fn(() => [])}
};

// <<< ADDED: Mock for the new dependency >>>
const mockTurnHandlerResolver = {
    resolve: jest.fn(),
    // Add any other methods if TurnManager interacts with them, but 'resolve' is the minimum needed for validation.
};

// --- Test Suite ---
describe('TurnManager', () => {
    let instance;
    let advanceTurnSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        mockEntityManager.activeEntities.values.mockReturnValue([]);

        // <<< MODIFIED: Pass the mock turnHandlerResolver >>>
        instance = new TurnManager({
            logger: mockLogger,
            turnOrderService: mockTurnOrderService,
            dispatcher: mockDispatcher,
            entityManager: mockEntityManager,
            turnHandlerResolver: mockTurnHandlerResolver, // <<< ADDED HERE
        });

        // Spy on the advanceTurn method (ensure this happens *after* instantiation)
        // Mock implementation needed because the actual advanceTurn now uses turnHandlerResolver
        advanceTurnSpy = jest.spyOn(instance, 'advanceTurn').mockImplementation(async () => {
            // Basic mock, doesn't need complex logic for start/stop tests
            return Promise.resolve();
        });
    });

    afterEach(() => {
        if (advanceTurnSpy) {
            advanceTurnSpy.mockRestore();
        }
    });

    // --- Tests ---

    describe('constructor', () => {
        test('should create an instance with dependencies and log initialization', () => {
            // Clear mocks specifically for this test's instantiation check
            jest.clearAllMocks();
            // <<< MODIFIED: Pass the mock turnHandlerResolver >>>
            const localInstance = new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: mockDispatcher,
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver, // <<< ADDED HERE
            });
            expect(localInstance).toBeInstanceOf(TurnManager);
            expect(localInstance.getCurrentActor()).toBeNull();
            // Check the log message from this specific instance creation
            expect(mockLogger.info).toHaveBeenCalledWith('TurnManager initialized successfully.');
            // Ensure it was called only once during this specific instantiation
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
        });

        // <<< MODIFIED: Pass the mock turnHandlerResolver to these tests >>>
        test('should throw error if turnOrderService is invalid', () => {
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: {}, // Intentionally invalid
                dispatcher: mockDispatcher,
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver, // <<< ADDED HERE
            })).toThrow('TurnManager requires a valid ITurnOrderService instance.');
        });
        test('should throw error if entityManager is invalid', () => {
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: mockDispatcher,
                entityManager: {}, // Intentionally invalid
                turnHandlerResolver: mockTurnHandlerResolver, // <<< ADDED HERE
            })).toThrow('TurnManager requires a valid EntityManager instance.');
        });
        test('should throw error if logger is invalid', () => {
            expect(() => new TurnManager({
                logger: {}, // Intentionally invalid
                turnOrderService: mockTurnOrderService,
                dispatcher: mockDispatcher,
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver, // <<< ADDED HERE
            })).toThrow('TurnManager requires a valid ILogger instance.');
        });
        test('should throw error if dispatcher is invalid', () => {
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: {}, // Intentionally invalid
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver, // <<< ADDED HERE
            })).toThrow('TurnManager requires a valid IValidatedEventDispatcher instance.');
        });
        // <<< ADDED: Test specifically for turnHandlerResolver invalidity >>>
        test('should throw error if turnHandlerResolver is invalid', () => {
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: mockDispatcher,
                entityManager: mockEntityManager,
                turnHandlerResolver: {}, // Intentionally invalid
            })).toThrow('TurnManager requires a valid ITurnHandlerResolver instance.');

            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: mockDispatcher,
                entityManager: mockEntityManager,
                turnHandlerResolver: {
                    someOtherMethod: () => {
                    }
                }, // Missing 'resolve' method
            })).toThrow('TurnManager requires a valid ITurnHandlerResolver instance.');
        });
    });

    describe('getCurrentActor()', () => {
        // REMOVED the test 'should return the current actor when set'
        // because we cannot reliably set the private field from the test.

        test('should return null if no actor is current', () => {
            // Instance is created fresh in beforeEach, #currentActor should be null
            expect(instance.getCurrentActor()).toBeNull();
        });
    });


    describe('start()', () => {
        // These tests should now work correctly as the instance is created properly
        test('successful call: should log info and call advanceTurn', async () => {
            await instance.start();
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');
            expect(advanceTurnSpy).toHaveBeenCalledTimes(1);

            // Idempotency check (requires clearing mocks after first start)
            mockLogger.warn.mockClear();
            advanceTurnSpy.mockClear(); // Clear spy calls
            await instance.start(); // Call start again
            expect(mockLogger.warn).toHaveBeenCalledWith('TurnManager.start() called but manager is already running.');
            expect(advanceTurnSpy).not.toHaveBeenCalled(); // Should not be called again
        });

        test('when already running: should log warning and not call advanceTurn again', async () => {
            await instance.start(); // First call
            // Clear mocks for second call check
            mockLogger.warn.mockClear();
            mockLogger.info.mockClear();
            advanceTurnSpy.mockClear();

            await instance.start(); // Second call
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith('TurnManager.start() called but manager is already running.');
            expect(advanceTurnSpy).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalledWith('Turn Manager started.');
        });
    });

    describe('stop()', () => {

        test('successful call (when running): should reset state, clear round, and log', async () => {
            // Setup: Start the manager
            await instance.start();
            advanceTurnSpy.mockClear(); // Clear spy calls from start()

            // --- Artificial state setup for testing stop ---
            // We can't directly set #currentActor easily, so we rely on the fact
            // that #isRunning becomes true after start() and becomes false after stop().
            // We also test the calls to logger and turnOrderService.
            // --- End artificial state setup ---

            // Reset mocks that stop interacts with
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            mockTurnOrderService.clearCurrentRound.mockClear();
            // Ensure clearCurrentRound resolves successfully for this test case
            mockTurnOrderService.clearCurrentRound.mockResolvedValue(undefined);

            // Call stop
            await instance.stop();

            // Assert: #currentActor becomes null (verify by reading the actual private field via getter)
            expect(instance.getCurrentActor()).toBeNull();

            // Assert other stop behaviors
            expect(mockTurnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager stopped.');
            expect(mockLogger.debug).toHaveBeenCalledWith('Turn order service current round cleared.');

            // Idempotency check (requires clearing mocks after first stop)
            mockLogger.info.mockClear();
            mockTurnOrderService.clearCurrentRound.mockClear();
            await instance.stop(); // Call stop again
            expect(mockLogger.info).toHaveBeenCalledWith('TurnManager.stop() called but manager is already stopped.');
            expect(mockTurnOrderService.clearCurrentRound).not.toHaveBeenCalled();
            expect(instance.getCurrentActor()).toBeNull(); // Still null
        });

        test('when already stopped: should log info and do nothing else', async () => {
            // Instance starts in stopped state
            expect(instance.getCurrentActor()).toBeNull(); // Initial state check
            mockLogger.info.mockClear();
            mockTurnOrderService.clearCurrentRound.mockClear();

            await instance.stop(); // Call stop when already stopped

            expect(mockLogger.info).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnManager.stop() called but manager is already stopped.');
            expect(mockTurnOrderService.clearCurrentRound).not.toHaveBeenCalled();
            expect(instance.getCurrentActor()).toBeNull();

            // Check again
            mockLogger.info.mockClear();
            await instance.stop();
            expect(mockLogger.info).toHaveBeenCalledWith('TurnManager.stop() called but manager is already stopped.');
        });

        test('handles error during clearCurrentRound but still stops', async () => {
            // Setup: Start the manager
            await instance.start();
            advanceTurnSpy.mockClear(); // Clear spy calls from start()

            // --- Artificial state setup ---
            // Again, rely on #isRunning state change and mock behavior.
            // --- End artificial state setup ---

            const clearError = new Error('Clear failed');
            mockTurnOrderService.clearCurrentRound.mockRejectedValueOnce(clearError); // Make clear fail
            mockLogger.error.mockClear();
            mockLogger.info.mockClear();

            // Call stop - it should resolve even if clearCurrentRound fails
            await expect(instance.stop()).resolves.toBeUndefined();

            // Assert error logging and stop completion
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error calling turnOrderService.clearCurrentRound() during stop:', clearError
            );
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager stopped.');
            // Assert internal state was reset despite the error
            expect(instance.getCurrentActor()).toBeNull();

            // Assert it's *actually* stopped by trying to start again
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            advanceTurnSpy.mockClear(); // Clear spy again before next start
            await instance.start();
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');
            expect(advanceTurnSpy).toHaveBeenCalledTimes(1); // Should call advanceTurn on successful start
            expect(mockLogger.warn).not.toHaveBeenCalled(); // Should not warn about already running
        });
    });

});
// --- FILE END ---