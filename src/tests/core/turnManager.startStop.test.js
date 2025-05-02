// src/tests/core/turnManager.startStop.test.js
// --- FILE START (Corrected) ---

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

const mockDispatcher = {
    dispatchValidated: jest.fn(),
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

// *** FIXED: Mock ITurnHandlerResolver with the CORRECT method name ***
const mockTurnHandlerResolver = {
    resolveHandler: jest.fn(), // <<< CORRECTED METHOD NAME
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

    beforeEach(() => {
        jest.clearAllMocks();
        // Ensure activeEntities is a fresh Map for each test
        mockEntityManager.activeEntities = new Map();
        // Reset mock states
        mockTurnOrderService.clearCurrentRound.mockReset().mockResolvedValue(undefined); // Default success
        mockTurnHandlerResolver.resolveHandler.mockReset(); // Reset the correct mock method
        // Default implementation for the mock - adjust if needed per test group
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(null);

        // *** FIXED: Instantiate with the CORRECT mock resolver ***
        // This should now pass the constructor validation
        instance = new TurnManager({
            logger: mockLogger,
            turnOrderService: mockTurnOrderService,
            dispatcher: mockDispatcher,
            entityManager: mockEntityManager,
            turnHandlerResolver: mockTurnHandlerResolver, // <<< PASS CORRECTED MOCK
        });

        // Spy on advanceTurn AFTER instantiation
        advanceTurnSpy = jest.spyOn(instance, 'advanceTurn').mockImplementation(async () => {
            mockLogger.debug('Mocked advanceTurn called'); // Log mock call
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
    });

    // --- Tests ---

    describe('constructor', () => {
        test('should create an instance with dependencies and log initialization', () => {
            // Clear mocks specifically for this test's instantiation check
            jest.clearAllMocks();
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(null); // Ensure mock is valid for this instance

            // *** FIXED: Pass the CORRECT mock resolver ***
            const localInstance = new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: mockDispatcher,
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver, // Pass valid mock
            });
            expect(localInstance).toBeInstanceOf(TurnManager);
            expect(localInstance.getCurrentActor()).toBeNull();
            expect(mockLogger.info).toHaveBeenCalledWith('TurnManager initialized successfully.');
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
        });

        // *** FIXED: Pass the CORRECT mock resolver in all constructor error tests ***
        test('should throw error if turnOrderService is invalid', () => {
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: {}, // Invalid
                dispatcher: mockDispatcher,
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver, // Pass valid resolver
            })).toThrow('TurnManager requires a valid ITurnOrderService instance.');
        });
        test('should throw error if entityManager is invalid', () => {
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: mockDispatcher,
                entityManager: {}, // Invalid
                turnHandlerResolver: mockTurnHandlerResolver, // Pass valid resolver
            })).toThrow('TurnManager requires a valid EntityManager instance.');
        });
        test('should throw error if logger is invalid', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            expect(() => new TurnManager({
                logger: {}, // Invalid
                turnOrderService: mockTurnOrderService,
                dispatcher: mockDispatcher,
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver, // Pass valid resolver
            })).toThrow('TurnManager requires a valid ILogger instance.');
            consoleErrorSpy.mockRestore();
        });
        test('should throw error if dispatcher is invalid', () => {
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: {}, // Invalid
                entityManager: mockEntityManager,
                turnHandlerResolver: mockTurnHandlerResolver, // Pass valid resolver
            })).toThrow('TurnManager requires a valid IValidatedEventDispatcher instance.');
        });

        // *** FIXED: Test specifically for turnHandlerResolver invalidity ***
        test('should throw error if turnHandlerResolver is invalid', () => {
            const expectedErrorMsgRegex = /requires a valid ITurnHandlerResolver instance \(with resolveHandler method\)/;
            // Test case 1: Passing an empty object (missing resolveHandler)
            expect(() => new TurnManager({
                logger: mockLogger,
                turnOrderService: mockTurnOrderService,
                dispatcher: mockDispatcher,
                entityManager: mockEntityManager,
                turnHandlerResolver: {}, // Invalid: missing resolveHandler
            })).toThrow(expectedErrorMsgRegex);

            // Test case 2: Passing an object with wrong property type
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
    });

    describe('start()', () => {
        test('successful call: should log info and call advanceTurn', async () => {
            await instance.start();
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');
            // Check the spy that mocks advanceTurn
            expect(advanceTurnSpy).toHaveBeenCalledTimes(1);
        });

        test('when already running: should log warning and not call advanceTurn again', async () => {
            await instance.start(); // First call sets #isRunning to true
            // Clear mocks from the first call
            mockLogger.warn.mockClear();
            advanceTurnSpy.mockClear();

            await instance.start(); // Second call

            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith('TurnManager.start() called but manager is already running.');
            expect(advanceTurnSpy).not.toHaveBeenCalled(); // Should not call advanceTurn again
        });
    });

    describe('stop()', () => {
        test('successful call (when running): should reset state, clear round, and log', async () => {
            // Setup: Start the manager to set #isRunning = true
            await instance.start();
            advanceTurnSpy.mockClear(); // Clear spy calls from start()

            // Reset mocks that stop interacts with for clean assertion
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            mockTurnOrderService.clearCurrentRound.mockClear();
            mockTurnOrderService.clearCurrentRound.mockResolvedValue(undefined); // Ensure success

            // Act: Call stop
            await instance.stop();

            // Assert: #currentActor becomes null (verified via getter)
            expect(instance.getCurrentActor()).toBeNull();
            // Assert #isRunning becomes false (verified indirectly by next test or re-start)
            // We can check #isRunning directly if the test framework allows access, otherwise infer
            expect(mockTurnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager stopped.');
            expect(mockLogger.debug).toHaveBeenCalledWith('Turn order service current round cleared.');
        });

        test('when already stopped: should log info and do nothing else', async () => {
            // Instance starts in stopped state (#isRunning is false)
            mockLogger.info.mockClear();
            mockTurnOrderService.clearCurrentRound.mockClear();

            await instance.stop(); // Call stop when already stopped

            expect(mockLogger.info).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnManager.stop() called but manager is already stopped.');
            expect(mockTurnOrderService.clearCurrentRound).not.toHaveBeenCalled();
            expect(instance.getCurrentActor()).toBeNull();
        });

        test('handles error during clearCurrentRound but still stops', async () => {
            // Setup: Start the manager
            await instance.start();
            advanceTurnSpy.mockClear();

            const clearError = new Error('Clear failed');
            mockTurnOrderService.clearCurrentRound.mockRejectedValueOnce(clearError); // Make clear fail
            mockLogger.error.mockClear();
            mockLogger.info.mockClear();

            // Act: Call stop - should resolve even if clearCurrentRound fails
            await expect(instance.stop()).resolves.toBeUndefined();

            // Assert error logging and stop completion
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error calling turnOrderService.clearCurrentRound() during stop:', clearError
            );
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager stopped.');
            // Assert internal state was reset despite the error
            expect(instance.getCurrentActor()).toBeNull();
            // Assert #isRunning is false (try starting again)
            mockLogger.info.mockClear(); // Clear before re-start
            await instance.start();
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.'); // Should succeed
        });

        // --- NEW TEST CASE: Stop called mid-turn ---
        // --- REVISED TEST CASE: Stop called mid-turn ---
        test('stop() called during advanceTurn processing sets state correctly', async () => {
            // Arrange
            jest.useRealTimers(); // Use real timers for this complex async interaction initially
                                  // If issues persist, can try fake timers with careful advancement.
            advanceTurnSpy.mockRestore(); // Use the real advanceTurn

            const actor = createMockEntity('actor-mid-stop', true, false);

            // Promise to control when the mock turn handler completes
            let resolveHandleTurnCompletion;
            const handleTurnCompletionPromise = new Promise(resolve => {
                resolveHandleTurnCompletion = resolve;
            });

            // Promise to signal when the mock turn handler has been entered
            let resolveHandleTurnEntry;
            const handleTurnEntryPromise = new Promise(resolve => {
                resolveHandleTurnEntry = resolve;
            });

            let handleTurnCalled = false;
            const mockHandler = {
                handleTurn: jest.fn().mockImplementation(async (entity) => {
                    handleTurnCalled = true;
                    mockLogger.debug(`Mock handleTurn entered for ${entity.id}`);
                    resolveHandleTurnEntry(); // Signal that handleTurn has been entered
                    await handleTurnCompletionPromise; // Wait for external signal to complete
                    mockLogger.debug(`Mock handleTurn resolved for ${entity.id}`);
                })
            };

            mockTurnOrderService.isEmpty.mockResolvedValue(false);
            mockTurnOrderService.getNextEntity.mockResolvedValue(actor);
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockHandler);
            mockTurnOrderService.clearCurrentRound.mockResolvedValue(); // For stop() call

            // Act (Part 1): Start the manager, triggering advanceTurn. Don't await completion yet.
            const startPromise = instance.start();

            // Wait specifically until the mock handleTurn function is entered
            await handleTurnEntryPromise;

            // Verify advanceTurn has progressed to calling the handler
            expect(instance.getCurrentActor()).toBe(actor);
            expect(handleTurnCalled).toBe(true);
            expect(mockHandler.handleTurn).toHaveBeenCalledWith(actor);
            mockLogger.debug('State verified: handleTurn has been called.');

            // Act (Part 2): Now call stop() while handleTurn is "blocked"
            await instance.stop();
            mockLogger.debug('instance.stop() completed.');

            // Assert: Check state immediately after stop() completes
            expect(instance.getCurrentActor()).toBeNull(); // Should be reset by stop()
            // Check internal state #isRunning implicitly via re-start or directly if accessible
            // expect(instance.#isRunning).toBe(false); // If accessible
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager stopped.');
            expect(mockTurnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);

            // Assert that #isRunning is now false by trying to start again
            mockLogger.warn.mockClear();
            mockLogger.info.mockClear();
            // Re-mock advanceTurn for simplicity in this assertion part
            advanceTurnSpy = jest.spyOn(instance, 'advanceTurn').mockResolvedValue();
            await instance.start(); // Should succeed because stop() set #isRunning = false
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('already running'));
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.'); // Successful start
            expect(advanceTurnSpy).toHaveBeenCalled(); // advanceTurn called on re-start

            // Clean up: Resolve the blocked handleTurn promise.
            // This allows the original async call chain from start() to complete cleanly.
            resolveHandleTurnCompletion();
            try {
                // Wait for the original start promise to resolve (or reject) now that handleTurn is unblocked.
                // This prevents Jest potentially warning about unterminated async operations.
                await startPromise;
                mockLogger.debug('Original startPromise settled after test completion.');
            } catch (e) {
                // Log if the original advanceTurn loop threw an error after being unblocked.
                // This might happen depending on how interruption is handled internally,
                // but the test's primary goal (testing stop()) has already been asserted.
                mockLogger.debug(`Original startPromise settled (threw: ${e.message}) after test completion.`);
            }

        }, 10000); // Increase timeout slightly just in case, adjust as needed
    });

});
// --- FILE END ---