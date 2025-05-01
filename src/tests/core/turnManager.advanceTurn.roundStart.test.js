// src/tests/core/turnManager.advanceTurn.roundStart.test.js

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import TurnManager from '../../core/turnManager.js';
import {ACTOR_COMPONENT_ID} from '../../types/components.js';

// Mocks for dependencies
const mockLogger = {
    debug: jest.fn((...args) => {
    }), // Keep simple implementation
    info: jest.fn((...args) => {
    }),
    warn: jest.fn((...args) => {
    }),
    error: jest.fn((...args) => {
    }),
};

const mockDispatcher = {
    dispatch: jest.fn(),
    dispatchValidated: jest.fn(),
};

// Ensure EntityManager mock has activeEntities
const mockEntityManager = {
    activeEntities: new Map(),     // <<< Ensure this is present
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
    isEmpty: jest.fn(),
    getCurrentOrder: jest.fn(),
    removeEntity: jest.fn(),
    addEntity: jest.fn(),
    clearCurrentRound: jest.fn(),
};

// --- ADDED: Mock for the new dependency ---
const mockTurnHandlerResolver = {
    resolve: jest.fn(), // Needs a resolve method as checked by the constructor
};
// --- END ADDED ---

// Mock Entity class minimally
const mockEntity = (id, isActor) => ({
    id: id,
    hasComponent: jest.fn((componentId) => componentId === ACTOR_COMPONENT_ID ? isActor : false),
});

describe('TurnManager: advanceTurn() - Round Start (Queue Empty)', () => {
    let instance;
    let stopSpy;

    beforeEach(() => {
        jest.clearAllMocks(); // This should clear mocks including mockTurnHandlerResolver.resolve

        // Reset mock state
        mockEntityManager.activeEntities = new Map();

        instance = new TurnManager({
            logger: mockLogger,
            dispatcher: mockDispatcher,
            entityManager: mockEntityManager,
            turnOrderService: mockTurnOrderService,
            turnHandlerResolver: mockTurnHandlerResolver // <<< ADDED: Pass the mock resolver
        });

        // REMOVED: instance['_TurnManager_isRunning'] = true; // Let start() handle this

        stopSpy = jest.spyOn(instance, 'stop');
        stopSpy.mockImplementation(async () => {
            mockLogger.debug('Mocked instance.stop() called.');
            // Simulate the state change if absolutely necessary for other tests,
            // but ideally test behavior without relying on implementation details.
        });
    });

    afterEach(() => {
        if (stopSpy) stopSpy.mockRestore();
        instance = null;
    });

    // --- Test Cases ---

    test('advanceTurn() does nothing with a debug log if not running', async () => {
        // Arrange: Instance is created but start() is NOT called
        // instance #isRunning should be false by default

        // Act
        await instance.advanceTurn(); // Call directly

        // Assert
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('advanceTurn() called while manager is not running')
        );
        expect(mockTurnOrderService.isEmpty).not.toHaveBeenCalled();
        expect(stopSpy).not.toHaveBeenCalled();
    });

    test('No active actors found: logs error, dispatches message, and stops', async () => {
        // Arrange
        const nonActorEntity = mockEntity('nonActor1', false);
        const entitiesMap = new Map([['nonActor1', nonActorEntity]]);
        mockEntityManager.activeEntities = entitiesMap;
        mockTurnOrderService.isEmpty.mockResolvedValueOnce(true);

        // Act: Call start() which calls advanceTurn()
        await instance.start();

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.'); // From start()
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() called.'); // From advanceTurn()
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            'Cannot start a new round: No active entities with an Actor component found.'
        );
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'textUI:display_message',
            {
                text: 'System Error: No active actors found to start a round. Stopping.',
                type: 'error'
            }
        );
        expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('No active actors found (empty map): logs error, dispatches message, and stops', async () => {
        // Arrange
        mockEntityManager.activeEntities = new Map(); // Empty map
        mockTurnOrderService.isEmpty.mockResolvedValueOnce(true);

        // Act: Call start()
        await instance.start();

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() called.');
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            'Cannot start a new round: No active entities with an Actor component found.'
        );
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'textUI:display_message',
            {
                text: 'System Error: No active actors found to start a round. Stopping.',
                type: 'error'
            }
        );
        expect(stopSpy).toHaveBeenCalledTimes(1);
    });


    test('Actors found, successful round start: logs info, calls startNewRound, and recurses', async () => {
        // Arrange
        const actor1 = mockEntity('actor1', true);
        const actor2 = mockEntity('actor2', true);
        const nonActor = mockEntity('nonActor', false);
        const entitiesMap = new Map([
            ['actor1', actor1],
            ['nonActor', nonActor],
            ['actor2', actor2],
        ]);
        mockEntityManager.activeEntities = entitiesMap;
        mockTurnOrderService.startNewRound.mockResolvedValue(undefined); // Success
        mockTurnOrderService.isEmpty.mockResolvedValueOnce(true); // For the first call within start -> advanceTurn

        // Spy on advanceTurn BEFORE calling start
        const advanceTurnSpy = jest.spyOn(instance, 'advanceTurn');
        let callCount = 0;
        advanceTurnSpy.mockImplementation(async () => {
            callCount++;
            mockLogger.debug(`advanceTurn spy called (call #${callCount})`); // Log spy calls
            if (callCount === 1) {
                // First call is triggered by start(), execute original logic
                // Use Reflect.apply to call the original method on the instance
                await Reflect.apply(TurnManager.prototype.advanceTurn, instance, []);
            } else if (callCount === 2) {
                // Second call is the recursion, stop it
                mockLogger.debug(`Mocked advanceTurn call #${callCount} to prevent infinite loop`);
                // IMPORTANT: Since the second call is mocked *not* to execute real logic,
                // we don't expect mockTurnHandlerResolver.resolve to be called here.
            }
            // No further calls expected/handled by this mock
        });


        // Act: Call start(), which triggers the first advanceTurn call
        await instance.start();

        // Assert
        // Check logs from start() itself
        expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');

        // Check logs/calls from the FIRST (real) advanceTurn execution
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() called.');
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Found 2 actors to start the round: ${actor1.id}, ${actor2.id}`)
        );
        expect(mockTurnOrderService.startNewRound).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith(
            expect.arrayContaining([actor1, actor2]), 'round-robin'
        );
        const actualActorsArg = mockTurnOrderService.startNewRound.mock.calls[0][0];
        expect(actualActorsArg).toHaveLength(2);
        expect(actualActorsArg).toContain(actor1);
        expect(actualActorsArg).toContain(actor2);
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Successfully started a new round with 2 actors using the 'round-robin' strategy.`)
        );
        // Check the log indicating recursion was about to happen
        expect(mockLogger.debug).toHaveBeenCalledWith('New round started, recursively calling advanceTurn() to process the first turn.');

        // Check the SPY was called twice (once by start, once by recursion which was caught)
        expect(advanceTurnSpy).toHaveBeenCalledTimes(2);
        // Check the log from the spy catching the second call
        expect(mockLogger.debug).toHaveBeenCalledWith('Mocked advanceTurn call #2 to prevent infinite loop');

        // Ensure stop wasn't called
        expect(stopSpy).not.toHaveBeenCalled();

        // Ensure the resolver wasn't called because we mocked the recursive call
        expect(mockTurnHandlerResolver.resolve).not.toHaveBeenCalled();

        // Restore spy created within this test
        advanceTurnSpy.mockRestore();
    });

    test('Error during startNewRound: logs error, dispatches message, and stops', async () => {
        // Arrange
        const actor1 = mockEntity('actor1', true);
        const entitiesMap = new Map([['actor1', actor1]]);
        mockEntityManager.activeEntities = entitiesMap;
        const queueError = new Error('Queue init failed');
        mockTurnOrderService.startNewRound.mockRejectedValueOnce(queueError);
        mockTurnOrderService.isEmpty.mockResolvedValueOnce(true);

        // Act: Call start()
        await instance.start();

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() called.');
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        // Check relevant info log before the error
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found 1 actors to start the round: ${actor1.id}`));
        // Check startNewRound was called before it threw
        expect(mockTurnOrderService.startNewRound).toHaveBeenCalledTimes(1);
        // Check error handling
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Error starting new round: ${queueError.message}`),
            queueError
        );
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'textUI:display_message',
            {
                text: expect.stringContaining(`System Error: Failed to start a new round. Stopping. Details: ${queueError.message}`),
                type: 'error'
            }
        );
        expect(stopSpy).toHaveBeenCalledTimes(1);

        // Ensure the resolver wasn't called because the error happened before turn delegation
        expect(mockTurnHandlerResolver.resolve).not.toHaveBeenCalled();
    });
});