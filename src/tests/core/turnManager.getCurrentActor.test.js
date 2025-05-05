// src/tests/core/turnManager.getCurrentActor.test.js
// --- FILE START (Entire file content, Corrected) ---

import TurnManager from '../../core/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../types/components.js';
import {afterEach, beforeEach, describe, expect, jest, test} from "@jest/globals";

// Mock dependencies
const mockTurnOrderService = {
    isEmpty: jest.fn(),
    startNewRound: jest.fn(),
    getNextEntity: jest.fn(),
    clearCurrentRound: jest.fn(),
};

const mockEntityManager = {
    get activeEntities() {
        // Ensure it returns an iterable (like a Map's values)
        return this._mockActiveEntities;
    },
    _mockActiveEntities: new Map(),
    getEntityInstance: jest.fn(), // Checked by constructor
    // Helper to set entities used in some tests
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

// Mock dispatcher with subscribe
const mockDispatcher = {
    dispatchValidated: jest.fn(),
    subscribe: jest.fn(), // Needs to be present
};

const mockTurnHandlerResolver = {
    resolveHandler: jest.fn(),
};

// Mock Turn Handlers - ADD startTurn and destroy
const mockPlayerHandler = {
    constructor: {name: 'MockPlayerHandler'},
    startTurn: jest.fn().mockResolvedValue(),
    destroy: jest.fn().mockResolvedValue(),
};
const mockAiHandler = {
    constructor: {name: 'MockAiHandler'},
    startTurn: jest.fn().mockResolvedValue(),
    destroy: jest.fn().mockResolvedValue(),
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
            return false;
        }),
    };
    return entity;
};

describe('TurnManager', () => {
    let turnManager;
    let mockPlayerEntity;
    let mockAiEntity1;
    let mockAiEntity2;
    let turnEndedUnsubscribeMock = jest.fn(); // Mock for unsubscribe return value

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Reset mock EntityManager's internal state
        mockEntityManager._setActiveEntities([]);

        // Re-initialize basic mock configurations
        mockTurnOrderService.isEmpty.mockResolvedValue(true);
        mockTurnOrderService.getNextEntity.mockResolvedValue(null);
        mockTurnOrderService.startNewRound.mockResolvedValue();
        mockTurnOrderService.clearCurrentRound.mockResolvedValue();
        mockDispatcher.dispatchValidated.mockReset().mockResolvedValue(true); // Reset and default success
        mockDispatcher.subscribe.mockReset().mockReturnValue(turnEndedUnsubscribeMock); // Mock subscribe return
        turnEndedUnsubscribeMock.mockClear(); // Clear the unsubscribe mock itself

        mockTurnHandlerResolver.resolveHandler.mockReset().mockResolvedValue(mockAiHandler); // Default reset and value
        mockPlayerHandler.startTurn.mockClear().mockResolvedValue(); // Clear handler mocks
        mockAiHandler.startTurn.mockClear().mockResolvedValue();
        mockPlayerHandler.destroy.mockClear().mockResolvedValue();
        mockAiHandler.destroy.mockClear().mockResolvedValue();


        // Create fresh mock entities
        mockPlayerEntity = createMockEntity('player-1', true, true);
        mockAiEntity1 = createMockEntity('ai-1', true, false);
        mockAiEntity2 = createMockEntity('ai-2', true, false);

        // Instantiate TurnManager
        turnManager = new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        });

        // Clear logs from the constructor call itself AFTER instantiation
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
    });

    afterEach(() => {
        // jest.restoreAllMocks(); // Can cause issues if mocks are shared/modified across tests unexpectedly. clearAllMocks is usually safer.
        turnManager = null; // Help GC
    });

    // --- Basic Setup Tests ---
    test('should exist and be a class', () => {
        // Re-instantiate here just to check constructor log in isolation if needed,
        // although beforeEach already does this.
        const instance = new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        });
        expect(TurnManager).toBeDefined();
        expect(instance).toBeInstanceOf(TurnManager);
        // Constructor log check (assuming logger wasn't cleared AFTER this specific instantiation)
        expect(mockLogger.info).toHaveBeenCalledWith('TurnManager initialized successfully.');
    });

    test('mock entities should behave as configured', () => {
        expect(mockPlayerEntity.id).toBe('player-1');
        expect(mockPlayerEntity.hasComponent(ACTOR_COMPONENT_ID)).toBe(true);
        expect(mockPlayerEntity.hasComponent(PLAYER_COMPONENT_ID)).toBe(true);
        expect(mockAiEntity1.hasComponent(PLAYER_COMPONENT_ID)).toBe(false);
    });

    test('EntityManager mock allows setting active entities', () => {
        const entities = [mockPlayerEntity, mockAiEntity1];
        mockEntityManager._setActiveEntities(entities);
        expect(Array.from(mockEntityManager.activeEntities.values())).toEqual(entities);
        expect(mockEntityManager.activeEntities.get('player-1')).toBe(mockPlayerEntity);
    });

    // --- Tests for getCurrentActor() ---
    describe('getCurrentActor()', () => {
        test('should return null initially', () => {
            expect(turnManager.getCurrentActor()).toBeNull();
        });

        test('should return the assigned actor after start and advanceTurn assigns one', async () => {
            const mockActor = createMockEntity('actor-test', true, false);
            const entityType = 'ai'; // Define expected type

            // --- Setup mocks for start() -> advanceTurn() path ---
            mockTurnOrderService.isEmpty.mockResolvedValue(false); // Queue not empty
            mockTurnOrderService.getNextEntity.mockResolvedValue(mockActor); // Return our actor
            // Configure resolver to return the AI handler WHEN called with this specific actor
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockAiHandler);

            // --- Execute ---
            await turnManager.start(); // Calls advanceTurn internally

            // --- Assert ---
            // The actor is set synchronously within advanceTurn before startTurn is called (async)
            expect(turnManager.getCurrentActor()).toBe(mockActor);

            // Verify logs and calls related to setting the actor and initiating the turn
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');
            expect(mockDispatcher.subscribe).toHaveBeenCalledTimes(1); // Called by start
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() initiating...');
            expect(mockLogger.debug).toHaveBeenCalledWith('Queue not empty, retrieving next entity.');
            expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
            // Check actor set log
            expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn initiation for Entity: ${mockActor.id} (${entityType}) <<<`);
            // Check core:turn_started event was dispatched
            expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
                entityId: mockActor.id,
                entityType: entityType
            });
            expect(mockLogger.debug).toHaveBeenCalledWith(`Resolving turn handler for entity ${mockActor.id}...`);
            expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(mockActor);
            // Check startTurn call
            expect(mockLogger.debug).toHaveBeenCalledWith(`Calling startTurn on ${mockAiHandler.constructor.name} for entity ${mockActor.id}`);
            expect(mockAiHandler.startTurn).toHaveBeenCalledWith(mockActor); // Check startTurn was called
            // Check log indicating waiting for event (since startTurn is not awaited)
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`TurnManager now WAITING for 'core:turn_ended' event.`));
        });

        // *** CORRECTED TEST CASE ***
        test('should return null after stop() is called', async () => {
            const mockActor = createMockEntity('actor-test-stop', true, false);

            // --- Setup TurnManager to be running with an actor ---
            mockTurnOrderService.isEmpty.mockResolvedValue(false); // Queue not empty
            mockTurnOrderService.getNextEntity.mockResolvedValue(mockActor); // Return actor
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockAiHandler); // Resolve handler

            await turnManager.start(); // Get the manager running and the actor assigned

            // --- Sanity checks: Verify state after start() ---
            expect(turnManager.getCurrentActor()).toBe(mockActor);
            expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledTimes(1); // Called once during start
            expect(mockAiHandler.startTurn).toHaveBeenCalledTimes(1); // Called once during start
            expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
                entityId: mockActor.id,
                entityType: 'ai'
            }); // Turn started event dispatched
            expect(mockDispatcher.subscribe).toHaveBeenCalledTimes(1); // Subscribed during start


            // --- Clear mocks BEFORE calling stop() to isolate stop()'s effects ---
            mockTurnHandlerResolver.resolveHandler.mockClear();
            mockAiHandler.startTurn.mockClear();
            mockDispatcher.dispatchValidated.mockClear();
            mockDispatcher.subscribe.mockClear(); // Clear subscribe calls if needed, though stop doesn't call it
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            turnEndedUnsubscribeMock.mockClear(); // Clear the unsubscribe function mock
            mockAiHandler.destroy.mockClear(); // Clear the destroy mock
            mockTurnOrderService.clearCurrentRound.mockClear(); // Clear this specific mock too


            // --- Execute Stop ---
            await turnManager.stop();

            // --- Assert results of stop() ---
            expect(turnManager.getCurrentActor()).toBeNull(); // Actor should be cleared
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager stopped.');
            expect(mockLogger.debug).toHaveBeenCalledWith('Turn order service current round cleared.');
            expect(mockTurnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1); // stop() calls clearCurrentRound
            expect(turnEndedUnsubscribeMock).toHaveBeenCalledTimes(1); // stop() calls the unsubscribe function
            expect(mockAiHandler.destroy).toHaveBeenCalledTimes(1); // stop() calls destroy on the active handler


            // --- Verify stop() DID NOT trigger NEW turn advancement actions ---
            expect(mockTurnHandlerResolver.resolveHandler).not.toHaveBeenCalled(); // Should NOT be called *again* by stop
            expect(mockAiHandler.startTurn).not.toHaveBeenCalled(); // Should NOT be called *again* by stop
            expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled(); // stop() doesn't dispatch events currently
        });
    });
    // --- End Tests for getCurrentActor() ---

});
// --- FILE END ---