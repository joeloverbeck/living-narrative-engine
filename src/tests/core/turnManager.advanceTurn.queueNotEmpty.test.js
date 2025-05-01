// src/tests/core/turnManager.advanceTurn.queueNotEmpty.test.js

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import TurnManager from '../../core/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../types/components.js'; // Include necessary component IDs

// --- Mock Dependencies ---
// Reusing the mock setup from other TurnManager test files for consistency

const mockLogger = {
    debug: jest.fn((...args) => { /* console.log('DEBUG:', ...args); */
    }),
    info: jest.fn((...args) => { /* console.log('INFO:', ...args); */
    }),
    warn: jest.fn((...args) => { /* console.log('WARN:', ...args); */
    }),
    error: jest.fn((...args) => { /* console.error('ERROR:', ...args); */
    }),
};

const mockDispatcher = {
    dispatch: jest.fn(),
    dispatchValidated: jest.fn().mockResolvedValue(true), // Default success
};

// Ensure EntityManager mock has activeEntities
const mockEntityManager = {
    activeEntities: new Map(),
    getEntityInstance: jest.fn(), // Checked by constructor
    entities: new Map(),
    getEntity: jest.fn(),
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    getAllEntities: jest.fn(),
};

const mockTurnOrderService = {
    startNewRound: jest.fn(),
    getNextEntity: jest.fn(),
    isEmpty: jest.fn(), // Will be mocked per describe block/test
    getCurrentOrder: jest.fn(),
    removeEntity: jest.fn(),
    addEntity: jest.fn(),
    clearCurrentRound: jest.fn(),
};

// Mock Entity class minimally - include hasComponent for later tests
const createMockEntity = (id, isActor = true, isPlayer = false) => ({
    id: id,
    hasComponent: jest.fn((componentId) => {
        if (componentId === ACTOR_COMPONENT_ID) return isActor;
        if (componentId === PLAYER_COMPONENT_ID) return isPlayer;
        return false;
    }),
    // Add other methods/properties if needed by TurnManager logic being tested
});


// --- Test Suite ---

describe('TurnManager: advanceTurn() - Turn Advancement (Queue Not Empty)', () => {
    let instance;
    let stopSpy;
    let initialAdvanceTurnSpy; // To manage the advanceTurn call from start()

    beforeEach(async () => {
        jest.clearAllMocks();

        // Reset mock state
        mockEntityManager.activeEntities = new Map();
        // Default for this block: Queue is NOT empty
        mockTurnOrderService.isEmpty.mockResolvedValue(false);
        // Reset other mocks to avoid test leakage
        mockTurnOrderService.getNextEntity.mockResolvedValue(null); // Default to null unless overridden
        mockDispatcher.dispatchValidated.mockResolvedValue(true);
        mockTurnOrderService.clearCurrentRound.mockImplementation(() => { /* Sync clear */
        });


        instance = new TurnManager({
            logger: mockLogger,
            dispatcher: mockDispatcher,
            entityManager: mockEntityManager,
            turnOrderService: mockTurnOrderService
        });

        // Spy on stop to verify calls
        stopSpy = jest.spyOn(instance, 'stop');
        stopSpy.mockImplementation(async () => {
            // Minimal mock to prevent actual stop logic affecting tests,
            // but allows tracking calls. We test stop() behavior elsewhere.
            mockLogger.debug('Mocked instance.stop() called.');
            // Simulate internal state change if needed by subsequent assertions
            // instance['_TurnManager_isRunning'] = false; // Avoid private access
            // instance['_TurnManager_currentActor'] = null;
        });

        // --- Set instance to running state ---
        // Spy on advanceTurn BEFORE calling start, prevent its execution during start()
        initialAdvanceTurnSpy = jest.spyOn(instance, 'advanceTurn');
        initialAdvanceTurnSpy.mockImplementationOnce(async () => {
            mockLogger.debug('advanceTurn call during start() suppressed by mock.');
        });

        await instance.start(); // This sets #isRunning to true

        // Restore the original advanceTurn method AFTER start() is done
        initialAdvanceTurnSpy.mockRestore();

        // Clear mocks that might have been called during start()
        mockLogger.info.mockClear(); // Clear "Turn Manager started." log
        mockLogger.debug.mockClear();
        mockDispatcher.dispatchValidated.mockClear();
        mockTurnOrderService.isEmpty.mockClear(); // Clear any check from suppressed advanceTurn

        // Re-apply default isEmpty mock for the actual tests
        mockTurnOrderService.isEmpty.mockResolvedValue(false);

    });

    afterEach(() => {
        if (stopSpy) stopSpy.mockRestore();
        if (initialAdvanceTurnSpy) initialAdvanceTurnSpy.mockRestore(); // Ensure restore if test fails early
        instance = null; // Help garbage collection
    });

    // --- Test Cases ---

    test('Successfully getting next entity: updates current actor and logs turn start', async () => {
        // Arrange
        const nextActor = createMockEntity('actor-next', true); // isActor=true by default
        const originalCurrentActor = instance.getCurrentActor(); // Should be null

        mockTurnOrderService.getNextEntity.mockResolvedValue(nextActor);
        // Mock hasComponent for PLAYER_COMPONENT_ID needed by the logic after getting the entity
        nextActor.hasComponent.mockImplementation((componentId) => {
            if (componentId === ACTOR_COMPONENT_ID) return true;
            if (componentId === PLAYER_COMPONENT_ID) return false; // Simulate AI actor
            return false;
        });


        // Act
        await instance.advanceTurn();

        // Assert
        // Verify the flow when queue is not empty
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);

        // Verify state update and logging
        expect(instance.getCurrentActor()).toBe(nextActor);
        expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn for Entity: ${nextActor.id} <<<`);

        // Verify event dispatching (basic check, detailed event tests are separate)
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'ai:turn_start', // Since we mocked hasComponent(PLAYER...) to false
            {entityId: nextActor.id}
        );

        // Ensure stop was not called
        expect(stopSpy).not.toHaveBeenCalled();
        // Ensure error logs were not called
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('getNextEntity() returns null/undefined unexpectedly: logs error, dispatches message, stops manager', async () => {
        // Arrange
        const originalCurrentActor = instance.getCurrentActor(); // Store pre-call state (should be null)
        mockTurnOrderService.getNextEntity.mockResolvedValue(null); // Simulate unexpected null return

        // Act
        await instance.advanceTurn();

        // Assert
        // Verify the initial checks
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);

        // Verify error handling
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            'Turn order inconsistency: getNextEntity() returned null/undefined when queue was not empty.'
        );
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'textUI:display_message',
            {
                text: 'Internal Error: Turn order inconsistency detected. Stopping manager.',
                type: 'error'
            }
        );

        // Verify manager stop was triggered
        expect(stopSpy).toHaveBeenCalledTimes(1);

        // Verify current actor state was not changed
        expect(instance.getCurrentActor()).toBe(originalCurrentActor); // Should remain null

        // Ensure no success logs were made
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('>>> Starting turn for Entity:'));
    });
});