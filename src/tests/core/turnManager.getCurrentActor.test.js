// src/tests/core/turnManager.getCurrentActor.test.js

import TurnManager from '../../core/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../types/components.js';
import {beforeEach, describe, expect, jest, test} from "@jest/globals";

// Mock dependencies
const mockTurnOrderService = {
    isEmpty: jest.fn(),
    startNewRound: jest.fn(),
    getNextEntity: jest.fn(),
    clearCurrentRound: jest.fn(),
    // Add any other methods TurnManager might directly call
};

const mockEntityManager = {
    // Mock activeEntities as a getter returning a Map
    get activeEntities() {
        return this._mockActiveEntities;
    },
    _mockActiveEntities: new Map(), // Internal map to hold mock entities
    getEntityInstance: jest.fn(), // Mock if TurnManager constructor uses it
    // Helper to easily set active entities for tests
    _setActiveEntities: function (entities) {
        this._mockActiveEntities.clear();
        entities.forEach(entity => this._mockActiveEntities.set(entity.id, entity));
    }
};

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

const mockDispatcher = {
    dispatchValidated: jest.fn(),
};

// Helper function to create basic mock entities
const createMockEntity = (id, isActor = false, isPlayer = false) => {
    const entity = {
        id: id,
        hasComponent: jest.fn((componentId) => {
            if (componentId === ACTOR_COMPONENT_ID) {
                return isActor;
            }
            if (componentId === PLAYER_COMPONENT_ID) {
                return isPlayer;
            }
            return false; // Default mock behavior
        }),
        // Add other properties or methods if TurnManager interacts with them directly
    };
    return entity;
};

describe('TurnManager', () => {
    let turnManager;
    let mockPlayerEntity;
    let mockAiEntity1;
    let mockAiEntity2;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Reset mock EntityManager's internal state
        mockEntityManager._setActiveEntities([]); // Clear entities

        // Re-initialize basic mock configurations if needed (e.g., default return values)
        mockTurnOrderService.isEmpty.mockResolvedValue(true); // Default to empty queue initially
        mockTurnOrderService.getNextEntity.mockResolvedValue(null); // Default to no next entity
        mockTurnOrderService.startNewRound.mockResolvedValue(); // Default success
        mockTurnOrderService.clearCurrentRound.mockImplementation(() => {
        }); // Default synchronous clear
        mockDispatcher.dispatchValidated.mockResolvedValue(true); // Default successful dispatch

        // Create fresh mock entities for each test run
        mockPlayerEntity = createMockEntity('player-1', true, true);
        mockAiEntity1 = createMockEntity('ai-1', true, false);
        mockAiEntity2 = createMockEntity('ai-2', true, false);

        // Instantiate TurnManager with mocks
        turnManager = new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
        });

        // Clear the initial "initialized" log call to avoid interference in specific tests
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
    });

    // --- Test cases will be added in subsequent tickets ---

    test('should exist and be a class', () => {
        // Re-instantiate for this specific test to check initialization log
        turnManager = new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
        });
        // Basic sanity check for the setup
        expect(TurnManager).toBeDefined();
        expect(turnManager).toBeInstanceOf(TurnManager);
        expect(mockLogger.info).toHaveBeenCalledWith('TurnManager initialized successfully.');
    });

    // Example of how mock entities can be used later:
    test('mock entities should behave as configured', () => {
        expect(mockPlayerEntity.id).toBe('player-1');
        expect(mockPlayerEntity.hasComponent(ACTOR_COMPONENT_ID)).toBe(true);
        expect(mockPlayerEntity.hasComponent(PLAYER_COMPONENT_ID)).toBe(true);
        expect(mockPlayerEntity.hasComponent('some-other-component')).toBe(false);

        expect(mockAiEntity1.id).toBe('ai-1');
        expect(mockAiEntity1.hasComponent(ACTOR_COMPONENT_ID)).toBe(true);
        expect(mockAiEntity1.hasComponent(PLAYER_COMPONENT_ID)).toBe(false);
    });

    test('EntityManager mock allows setting active entities', () => {
        const entities = [mockPlayerEntity, mockAiEntity1];
        mockEntityManager._setActiveEntities(entities);
        expect(Array.from(mockEntityManager.activeEntities.values())).toEqual(entities);
        expect(mockEntityManager.activeEntities.get('player-1')).toBe(mockPlayerEntity);
    });

    // --- Tests for Sub-Ticket 2.1.6.4 ---
    describe('getCurrentActor()', () => {
        test('should return null initially', () => {
            expect(turnManager.getCurrentActor()).toBeNull();
        });

        // CORRECTED TEST
        test('should return the assigned actor after start and advanceTurn assigns one', async () => {
            const mockActor = createMockEntity('actor-test', true, false); // Use the helper

            // Setup mocks for start() -> advanceTurn() to successfully assign an actor
            // 1. Make queue not empty
            mockTurnOrderService.isEmpty.mockResolvedValue(false);
            // 2. Make getNextEntity return our mock actor
            mockTurnOrderService.getNextEntity.mockResolvedValue(mockActor);
            // 3. Dispatch should succeed
            mockDispatcher.dispatchValidated.mockResolvedValue(true);

            // Start the manager, which calls advanceTurn
            await turnManager.start();

            // Now the current actor should be set via the internal logic
            expect(turnManager.getCurrentActor()).toBe(mockActor);
            // Optional: Check logs/events if needed
            expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn for Entity: ${mockActor.id} <<<`);
            expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('ai:turn_start', {entityId: mockActor.id});
        });

        // CORRECTED TEST
        test('should return null after stop() is called', async () => {
            const mockActor = createMockEntity('actor-test-stop', true, false);

            // --- Setup to get TurnManager into a running state with an actor ---
            // 1. Make queue not empty
            mockTurnOrderService.isEmpty.mockResolvedValue(false);
            // 2. Make getNextEntity return an actor
            mockTurnOrderService.getNextEntity.mockResolvedValue(mockActor);
            // 3. Mock clearCurrentRound which is called by stop
            mockTurnOrderService.clearCurrentRound.mockImplementation(() => {
                // Simulate the service clearing its state if necessary for other tests,
                // but TurnManager itself sets its #currentActor to null.
            });
            // 4. Dispatch should succeed
            mockDispatcher.dispatchValidated.mockResolvedValue(true);

            // --- Execute ---
            // 1. Start the manager (sets #isRunning=true, calls advanceTurn which sets #currentActor)
            await turnManager.start();

            // Sanity check: actor should be set *before* stop
            expect(turnManager.getCurrentActor()).toBe(mockActor);
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.'); // From start()
            expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn for Entity: ${mockActor.id} <<<`); // From advanceTurn()

            // Clear mocks before stop to isolate stop's logging
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockLogger.debug.mockClear();

            // 2. Stop the manager (sets #isRunning=false, #currentActor=null, calls clearCurrentRound)
            await turnManager.stop();

            // --- Assert ---
            // 1. Current actor should now be null
            expect(turnManager.getCurrentActor()).toBeNull();
            // 2. Check the specific log message from stop()
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager stopped.'); // Correct message
            // 3. Ensure clearCurrentRound was called
            expect(mockTurnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);
            // 4. Ensure the "already stopped" message wasn't logged
            expect(mockLogger.info).not.toHaveBeenCalledWith('TurnManager.stop() called but manager is already stopped.');

        });
    });
    // --- End Tests for Sub-Ticket 2.1.6.4 ---

});