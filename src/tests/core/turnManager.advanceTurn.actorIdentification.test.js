// src/tests/core/turnManager.advanceTurn.actorIdentification.test.js

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import TurnManager from '../../core/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../types/components.js'; // Ensure both are imported

// --- Mock Dependencies ---
// Reusing the standard mock setup

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

// --- Test Suite ---

describe('TurnManager: advanceTurn() - Actor Identification & Signaling (Queue Not Empty)', () => {
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

        // Spy on stop to verify calls (though not expected in these specific tests)
        stopSpy = jest.spyOn(instance, 'stop');
        stopSpy.mockImplementation(async () => {
            mockLogger.debug('Mocked instance.stop() called.');
        });

        // --- Set instance to running state ---
        // Spy on advanceTurn BEFORE calling start, prevent its execution during start()
        initialAdvanceTurnSpy = jest.spyOn(instance, 'advanceTurn');
        initialAdvanceTurnSpy.mockImplementationOnce(async () => {
            mockLogger.debug('advanceTurn call during start() suppressed by mock.');
        });

        await instance.start(); // This sets #isRunning to true

        // Restore the original advanceTurn method AFTER start() is done
        initialAdvanceTurnSpy.mockRestore(); // Restore immediately

        // Clear mocks that might have been called during start() or the suppressed advanceTurn
        mockLogger.info.mockClear(); // Clear "Turn Manager started." log
        mockLogger.debug.mockClear();
        mockDispatcher.dispatchValidated.mockClear();
        mockTurnOrderService.isEmpty.mockClear();
        mockTurnOrderService.getNextEntity.mockClear(); // Important if suppress mock called it


        // Re-apply default isEmpty mock for the actual tests in this describe block
        mockTurnOrderService.isEmpty.mockResolvedValue(false);
        // Ensure dispatchValidated mock is clean and defaults to success for these tests
        mockDispatcher.dispatchValidated.mockClear();
        mockDispatcher.dispatchValidated.mockResolvedValue(true);

    });

    afterEach(() => {
        if (stopSpy) stopSpy.mockRestore();
        // initialAdvanceTurnSpy is restored within beforeEach
        instance = null; // Help garbage collection
    });

    // --- Test Cases for Sub-Ticket 2.1.6.7 ---

    test('Player actor identified: logs debug, dispatches player:turn_start', async () => {
        // Arrange
        const playerActor = {
            id: 'player-1',
            hasComponent: jest.fn((componentId) => {
                if (componentId === PLAYER_COMPONENT_ID) return true;
                if (componentId === ACTOR_COMPONENT_ID) return true; // Assume player is also an actor
                return false;
            })
        };
        mockTurnOrderService.getNextEntity.mockResolvedValue(playerActor);

        // Act
        await instance.advanceTurn();

        // Assert
        // 1. Check queue was confirmed not empty
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        // 2. Check next entity was retrieved
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        // 3. Verify hasComponent was called to check for player
        expect(playerActor.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
        // 4. Verify specific debug log for player identification
        expect(mockLogger.debug).toHaveBeenCalledWith(`Entity ${playerActor.id} is player-controlled.`);
        // 5. Verify correct event dispatched for player
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'player:turn_start',
            {entityId: playerActor.id}
        );
        // 6. Verify final debug log confirming dispatch
        expect(mockLogger.debug).toHaveBeenCalledWith(
            // Use stringContaining for robustness against exact phrasing changes
            expect.stringContaining(`Dispatched 'player:turn_start' event for player entity: ${playerActor.id}`)
        );
        // 7. Ensure the AI log was NOT called
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('is AI-controlled'));
        // 8. Ensure stop was not called
        expect(stopSpy).not.toHaveBeenCalled();
    });

    test('AI actor identified: logs info, dispatches ai:turn_start', async () => {
        // Arrange
        const aiActor = {
            id: 'ai-goblin',
            hasComponent: jest.fn((componentId) => {
                if (componentId === PLAYER_COMPONENT_ID) return false; // Not a player
                if (componentId === ACTOR_COMPONENT_ID) return true;   // Is an actor
                return false;
            })
        };
        mockTurnOrderService.getNextEntity.mockResolvedValue(aiActor);

        // Act
        await instance.advanceTurn();

        // Assert
        // 1. Check queue was confirmed not empty
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        // 2. Check next entity was retrieved
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        // 3. Verify hasComponent was called to check for player
        expect(aiActor.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
        // 4. Verify specific info log for AI identification
        expect(mockLogger.info).toHaveBeenCalledWith(`Entity ${aiActor.id} is AI-controlled.`);
        // 5. Verify correct event dispatched for AI
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'ai:turn_start',
            {entityId: aiActor.id}
        );
        // 6. Verify final debug log confirming dispatch
        expect(mockLogger.debug).toHaveBeenCalledWith(
            // Use stringContaining for robustness
            expect.stringContaining(`Dispatched 'ai:turn_start' event for AI entity: ${aiActor.id}`)
        );
        // 7. Ensure the Player log was NOT called
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('is player-controlled'));
        // 8. Ensure stop was not called
        expect(stopSpy).not.toHaveBeenCalled();
    });

    // CORRECTED: Test handling of dispatch rejection
    test('Handles dispatchValidated rejection gracefully (error propagates)', async () => {
        // Arrange
        const aiActor = {
            id: 'ai-reject-dispatch',
            hasComponent: jest.fn(() => false) // Simulate AI
        };
        mockTurnOrderService.getNextEntity.mockResolvedValue(aiActor);
        const dispatchError = new Error("Dispatch failed");
        // *** CORRECTION: Mock the promise to REJECT ***
        mockDispatcher.dispatchValidated.mockRejectedValue(dispatchError);

        // Act & Assert: Expect the advanceTurn call itself to reject
        await expect(instance.advanceTurn()).rejects.toThrow(dispatchError);

        // Assert side effects *before* the rejection point
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('ai:turn_start', {entityId: aiActor.id});

        // Assert side effects that should NOT have happened due to the rejection
        // The debug log after dispatch should not be reached
        expect(mockLogger.debug).not.toHaveBeenCalledWith(
            expect.stringContaining(`Dispatched 'ai:turn_start' event`)
        );
        // TurnManager doesn't currently catch this specific error, so no error log expected from it
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Should not stop the manager just because dispatch failed
        expect(stopSpy).not.toHaveBeenCalled();
    });


});