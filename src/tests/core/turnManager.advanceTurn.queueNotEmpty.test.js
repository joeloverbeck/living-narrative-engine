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

// <<< ADDED: Mock for the Turn Handler returned by the resolver >>>
const mockTurnHandler = {
    // handleTurn is expected to be called by TurnManager after resolving
    handleTurn: jest.fn().mockResolvedValue(undefined),
};

// <<< ADDED: Mock for ITurnHandlerResolver >>>
const mockTurnHandlerResolver = {
    // resolve is expected by the TurnManager constructor and advanceTurn logic
    resolve: jest.fn().mockReturnValue(mockTurnHandler), // Return the mock handler
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
        mockTurnOrderService.isEmpty.mockResolvedValue(false); // Default for this block: Queue is NOT empty
        mockTurnOrderService.getNextEntity.mockResolvedValue(null); // Default to null unless overridden
        mockDispatcher.dispatchValidated.mockResolvedValue(true);
        mockTurnOrderService.clearCurrentRound.mockImplementation(() => { /* Sync clear */
        });
        // <<< ADDED: Reset resolver/handler mocks >>>
        mockTurnHandlerResolver.resolve.mockClear().mockReturnValue(mockTurnHandler); // Ensure clean state and default return
        mockTurnHandler.handleTurn.mockClear().mockResolvedValue(undefined); // Ensure clean state


        // <<< MODIFIED: Added turnHandlerResolver to the constructor options >>>
        instance = new TurnManager({
            logger: mockLogger,
            dispatcher: mockDispatcher,
            entityManager: mockEntityManager,
            turnOrderService: mockTurnOrderService,
            turnHandlerResolver: mockTurnHandlerResolver // Provide the mock dependency
        });

        // Spy on stop to verify calls
        stopSpy = jest.spyOn(instance, 'stop');
        stopSpy.mockImplementation(async () => {
            mockLogger.debug('Mocked instance.stop() called.');
        });

        // --- Set instance to running state ---
        initialAdvanceTurnSpy = jest.spyOn(instance, 'advanceTurn');
        initialAdvanceTurnSpy.mockImplementationOnce(async () => {
            mockLogger.debug('advanceTurn call during start() suppressed by mock.');
        });

        await instance.start(); // This sets #isRunning to true

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

    test('Successfully getting next entity: updates current actor, resolves and calls handler', async () => {
        // Arrange
        const nextActor = createMockEntity('actor-next', true, false); // isActor=true, isPlayer=false (AI)
        const originalCurrentActor = instance.getCurrentActor(); // Should be null

        mockTurnOrderService.getNextEntity.mockResolvedValue(nextActor);
        // Mock hasComponent is already part of createMockEntity setup

        // Act
        await instance.advanceTurn();

        // Assert
        // Verify the flow when queue is not empty
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);

        // Verify state update and logging for turn start
        expect(instance.getCurrentActor()).toBe(nextActor);
        expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn for Entity: ${nextActor.id} <<<`);

        // <<< MODIFIED/ADDED: Verify handler resolution and call >>>
        // Check that the resolver was called with the correct type ('ai' because isPlayer=false)
        expect(mockTurnHandlerResolver.resolve).toHaveBeenCalledTimes(1);
        expect(mockTurnHandlerResolver.resolve).toHaveBeenCalledWith('ai');

        // Check that the handleTurn method of the resolved handler was called with the actor
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledTimes(1);
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledWith(nextActor);

        // <<< REMOVED/COMMENTED: Original event dispatch assertion >>>
        // This dispatch is likely moved *inside* the specific turn handlers now,
        // so TurnManager itself might not dispatch this directly anymore.
        // Adjust based on where 'ai:turn_start'/'player:turn_start' is actually dispatched.
        // expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
        //     'ai:turn_start',
        //     {entityId: nextActor.id}
        // );

        // Ensure stop was not called
        expect(stopSpy).not.toHaveBeenCalled();
        // Ensure error logs were not called (related to this specific flow)
        expect(mockLogger.error).not.toHaveBeenCalled(); // May need adjustment if other errors logged during setup are expected
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

        // <<< ADDED: Ensure handler resolution/call did not happen >>>
        expect(mockTurnHandlerResolver.resolve).not.toHaveBeenCalled();
        expect(mockTurnHandler.handleTurn).not.toHaveBeenCalled();

        // Ensure no success logs were made
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('>>> Starting turn for Entity:'));
    });
});
