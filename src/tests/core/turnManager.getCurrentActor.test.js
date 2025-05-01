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

// --- ADDED: Mock for ITurnHandlerResolver ---
const mockTurnHandlerResolver = {
    resolve: jest.fn(),
};

// --- ADDED: Mock Turn Handlers (needed for tests involving advanceTurn) ---
const mockPlayerHandler = {handleTurn: jest.fn().mockResolvedValue()}; // Simple mock handler
const mockAiHandler = {handleTurn: jest.fn().mockResolvedValue()}; // Simple mock handler

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
        jest.clearAllMocks(); // This clears all mocks, including the new ones

        // Reset mock EntityManager's internal state
        mockEntityManager._setActiveEntities([]); // Clear entities

        // Re-initialize basic mock configurations if needed (e.g., default return values)
        mockTurnOrderService.isEmpty.mockResolvedValue(true); // Default to empty queue initially
        mockTurnOrderService.getNextEntity.mockResolvedValue(null); // Default to no next entity
        mockTurnOrderService.startNewRound.mockResolvedValue(); // Default success
        mockTurnOrderService.clearCurrentRound.mockImplementation(() => {
        }); // Default synchronous clear
        mockDispatcher.dispatchValidated.mockResolvedValue(true); // Default successful dispatch

        // --- ADDED: Default mock behavior for resolver ---
        // By default, make resolve return a generic handler to avoid null errors in advanceTurn
        // Specific tests can override this if needed.
        mockTurnHandlerResolver.resolve.mockReturnValue(mockAiHandler);

        // Create fresh mock entities for each test run
        mockPlayerEntity = createMockEntity('player-1', true, true);
        mockAiEntity1 = createMockEntity('ai-1', true, false);
        mockAiEntity2 = createMockEntity('ai-2', true, false);

        // Instantiate TurnManager with ALL mocks, including the new one
        turnManager = new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver, // <<< ADDED Dependency
        });

        // Clear the initial "initialized" log call to avoid interference in specific tests
        // Note: jest.clearAllMocks() already clears calls, but we might want to keep
        // the initialization call visible in the first test. Let's keep this clear for now.
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
    });

    // --- Test cases will be added in subsequent tickets ---

    test('should exist and be a class', () => {
        // Re-instantiate for this specific test to check initialization log
        // Must include the new dependency here too!
        turnManager = new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver, // <<< ADDED Dependency
        });
        // Basic sanity check for the setup
        expect(TurnManager).toBeDefined();
        expect(turnManager).toBeInstanceOf(TurnManager);
        // The constructor call should have logged this
        expect(mockLogger.info).toHaveBeenCalledWith('TurnManager initialized successfully.');
    });

    // Example of how mock entities can be used later:
    test('mock entities should behave as configured', () => {
        // This test doesn't rely on TurnManager internals directly, just the helper
        expect(mockPlayerEntity.id).toBe('player-1');
        expect(mockPlayerEntity.hasComponent(ACTOR_COMPONENT_ID)).toBe(true);
        expect(mockPlayerEntity.hasComponent(PLAYER_COMPONENT_ID)).toBe(true);
        expect(mockPlayerEntity.hasComponent('some-other-component')).toBe(false);

        expect(mockAiEntity1.id).toBe('ai-1');
        expect(mockAiEntity1.hasComponent(ACTOR_COMPONENT_ID)).toBe(true);
        expect(mockAiEntity1.hasComponent(PLAYER_COMPONENT_ID)).toBe(false);
    });

    test('EntityManager mock allows setting active entities', () => {
        // This test doesn't rely on TurnManager internals directly, just the mock
        const entities = [mockPlayerEntity, mockAiEntity1];
        mockEntityManager._setActiveEntities(entities);
        expect(Array.from(mockEntityManager.activeEntities.values())).toEqual(entities);
        expect(mockEntityManager.activeEntities.get('player-1')).toBe(mockPlayerEntity);
    });

    // --- Tests for Sub-Ticket 2.1.6.4 ---
    describe('getCurrentActor()', () => {
        test('should return null initially', () => {
            // TurnManager is instantiated in beforeEach, currentActor starts as null
            expect(turnManager.getCurrentActor()).toBeNull();
        });

        // CORRECTED TEST (with resolver setup)
        test('should return the assigned actor after start and advanceTurn assigns one', async () => {
            const mockActor = createMockEntity('actor-test', true, false); // Use the helper

            // --- Setup mocks for start() -> advanceTurn() ---
            // 1. Make queue not empty initially (advanceTurn will get an actor)
            mockTurnOrderService.isEmpty.mockResolvedValue(false);
            // 2. Make getNextEntity return our mock actor
            mockTurnOrderService.getNextEntity.mockResolvedValue(mockActor);
            // 3. Ensure dispatcher succeeds (used by advanceTurn's error paths)
            mockDispatcher.dispatchValidated.mockResolvedValue(true);
            // 4. Configure resolver to return the AI handler for this AI actor
            mockTurnHandlerResolver.resolve.mockImplementation((actorType) => {
                expect(actorType).toBe('ai'); // Verify it's resolving for 'ai'
                return mockAiHandler;
            });
            // 5. Mock the AI handler's turn completion (it might call advanceTurn itself,
            //    but for *this* test, we only care that start->advanceTurn sets the actor)
            mockAiHandler.handleTurn.mockResolvedValue(); // Simulate successful turn

            // --- Execute ---
            await turnManager.start(); // Calls advanceTurn internally

            // --- Assert ---
            // Now the current actor should be set
            expect(turnManager.getCurrentActor()).toBe(mockActor);

            // Verify logs and calls
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() called.'); // From start() -> advanceTurn()
            expect(mockLogger.debug).toHaveBeenCalledWith('Queue not empty, retrieving next entity.');
            expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn for Entity: ${mockActor.id} <<<`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`Entity ${mockActor.id} identified as type: ai`);
            expect(mockTurnHandlerResolver.resolve).toHaveBeenCalledWith('ai');
            expect(mockLogger.debug).toHaveBeenCalledWith(`Calling handleTurn on ${mockAiHandler.constructor.name} for entity ${mockActor.id}`);
            expect(mockAiHandler.handleTurn).toHaveBeenCalledWith(mockActor);
            // Ensure the old event dispatch is NOT called (it's removed from turnManager.js)
            expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalledWith('ai:turn_start', expect.anything());
            expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalledWith('player:turn_start', expect.anything());

        });

        // CORRECTED TEST (with resolver setup)
        test('should return null after stop() is called', async () => {
            const mockActor = createMockEntity('actor-test-stop', true, false);

            // --- Setup to get TurnManager into a running state with an actor ---
            mockTurnOrderService.isEmpty.mockResolvedValue(false);
            mockTurnOrderService.getNextEntity.mockResolvedValue(mockActor);
            mockTurnOrderService.clearCurrentRound.mockImplementation(() => {
            }); // Mock clear for stop
            mockDispatcher.dispatchValidated.mockResolvedValue(true); // Ensure dispatch succeeds
            // Configure resolver and handler for the start phase
            mockTurnHandlerResolver.resolve.mockReturnValue(mockAiHandler);
            mockAiHandler.handleTurn.mockResolvedValue(); // Turn completes successfully

            // --- Execute ---
            await turnManager.start();

            // Sanity check: actor should be set *before* stop
            expect(turnManager.getCurrentActor()).toBe(mockActor);
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.'); // From start()
            expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn for Entity: ${mockActor.id} <<<`); // From advanceTurn()
            expect(mockAiHandler.handleTurn).toHaveBeenCalledTimes(1); // Ensure turn was handled

            // Clear mocks before stop to isolate stop's logging/calls
            jest.clearAllMocks(); // Use jest.clearAllMocks() for simplicity here

            // 2. Stop the manager
            await turnManager.stop();

            // --- Assert ---
            // 1. Current actor should now be null
            expect(turnManager.getCurrentActor()).toBeNull();
            // 2. Check the specific log message from stop()
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager stopped.');
            // 3. Ensure clearCurrentRound was called by stop()
            expect(mockTurnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);
            // 4. Ensure the "already stopped" message wasn't logged
            expect(mockLogger.info).not.toHaveBeenCalledWith('TurnManager.stop() called but manager is already stopped.');
            // 5. Ensure stop doesn't call resolve or handleTurn
            expect(mockTurnHandlerResolver.resolve).not.toHaveBeenCalled();
            expect(mockAiHandler.handleTurn).not.toHaveBeenCalled();

        });
    });
    // --- End Tests for Sub-Ticket 2.1.6.4 ---

});