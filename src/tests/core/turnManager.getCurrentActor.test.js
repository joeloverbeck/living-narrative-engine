// src/tests/core/turnManager.getCurrentActor.test.js
// --- FILE START (Corrected) ---

import TurnManager from '../../core/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../types/components.js';
import {beforeEach, describe, expect, jest, test} from "@jest/globals";

// Mock dependencies
const mockTurnOrderService = {
    isEmpty: jest.fn(),
    startNewRound: jest.fn(),
    getNextEntity: jest.fn(),
    clearCurrentRound: jest.fn(),
};

const mockEntityManager = {
    get activeEntities() {
        return this._mockActiveEntities;
    },
    _mockActiveEntities: new Map(),
    getEntityInstance: jest.fn(),
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

const mockTurnHandlerResolver = {
    resolveHandler: jest.fn(),
};

// Mock Turn Handlers (needed for tests involving advanceTurn)
const mockPlayerHandler = { constructor: { name: 'MockPlayerHandler' }, handleTurn: jest.fn().mockResolvedValue()}; // Added constructor name
const mockAiHandler = { constructor: { name: 'MockAiHandler' }, handleTurn: jest.fn().mockResolvedValue()}; // Added constructor name

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
        mockDispatcher.dispatchValidated.mockResolvedValue(true);

        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockAiHandler); // Default to AI handler
        mockPlayerHandler.handleTurn.mockClear().mockResolvedValue(); // Clear specific handler mocks
        mockAiHandler.handleTurn.mockClear().mockResolvedValue(); // Clear specific handler mocks

        // Create fresh mock entities
        mockPlayerEntity = createMockEntity('player-1', true, true);
        mockAiEntity1 = createMockEntity('ai-1', true, false);
        mockAiEntity2 = createMockEntity('ai-2', true, false);

        turnManager = new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        });

        // Clear logs from the constructor call itself
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
    });

    // --- Basic Setup Tests ---
    test('should exist and be a class', () => {
        // Re-instantiate here to specifically check the constructor log for this test
        const instance = new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        });
        expect(TurnManager).toBeDefined();
        expect(instance).toBeInstanceOf(TurnManager);
        // Constructor log check moved here
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
    });

    // --- Tests for getCurrentActor() ---
    describe('getCurrentActor()', () => {
        test('should return null initially', () => {
            // Instance created in beforeEach
            expect(turnManager.getCurrentActor()).toBeNull();
        });

        test('should return the assigned actor after start and advanceTurn assigns one', async () => {
            const mockActor = createMockEntity('actor-test', true, false);
            const entityType = 'ai'; // Define expected type for the log

            // --- Setup mocks for start() -> advanceTurn() ---
            mockTurnOrderService.isEmpty.mockResolvedValue(false);
            mockTurnOrderService.getNextEntity.mockResolvedValue(mockActor);
            mockDispatcher.dispatchValidated.mockResolvedValue(true); // Ensure dispatch mock is ready
            // Configure resolver to return the AI handler WHEN called with this specific actor
            mockTurnHandlerResolver.resolveHandler.mockImplementation(async (actor) => {
                expect(actor).toBe(mockActor); // Verify it receives the entity
                return mockAiHandler;
            });
            // Mock the AI handler's turn completion
            mockAiHandler.handleTurn.mockResolvedValue();

            // --- Execute ---
            await turnManager.start(); // Calls advanceTurn internally

            // --- Assert ---
            expect(turnManager.getCurrentActor()).toBe(mockActor); // Actor should be set

            // Verify logs and calls (using CORRECT method names/args)
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager started.');
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnManager.advanceTurn() called.');
            // --- FIX START: Check for the correct log format including entity type ---
            expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn for Entity: ${mockActor.id} (${entityType}) <<<`);
            // --- FIX END ---
            // Check core:turn_started event was dispatched
            expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
                entityId: mockActor.id,
                entityType: entityType
            });
            expect(mockLogger.debug).toHaveBeenCalledWith(`Resolving turn handler for entity ${mockActor.id}...`); // Log before resolve
            expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(mockActor); // Called with entity
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Calling handleTurn on ${mockAiHandler.constructor.name}`));
            expect(mockAiHandler.handleTurn).toHaveBeenCalledWith(mockActor); // Called with entity
            // Check handleTurn completion log
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`handleTurn promise resolved for ${mockAiHandler.constructor.name} for entity ${mockActor.id}`));
        });

        test('should return null after stop() is called', async () => {
            const mockActor = createMockEntity('actor-test-stop', true, false);
            const entityType = 'ai';

            // --- Setup to get TurnManager running ---
            mockTurnOrderService.isEmpty.mockResolvedValue(false);
            mockTurnOrderService.getNextEntity.mockResolvedValue(mockActor);
            mockTurnOrderService.clearCurrentRound.mockResolvedValue(); // Mock clear for stop
            mockDispatcher.dispatchValidated.mockResolvedValue(true); // Mock dispatch for start phase
            // Configure resolver and handler for the start phase
            mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockAiHandler);
            mockAiHandler.handleTurn.mockResolvedValue();

            await turnManager.start(); // Get an actor assigned

            // Sanity check
            expect(turnManager.getCurrentActor()).toBe(mockActor);
            // Check that start phase completed as expected
            expect(mockAiHandler.handleTurn).toHaveBeenCalledTimes(1);
            expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
                entityId: mockActor.id,
                entityType: entityType
            });


            // Clear mocks called during start/advanceTurn before testing stop
            jest.clearAllMocks();
            // Re-mock async methods needed for stop
            mockTurnOrderService.clearCurrentRound.mockResolvedValue();

            // --- Execute Stop ---
            await turnManager.stop();

            // --- Assert ---
            expect(turnManager.getCurrentActor()).toBeNull(); // Actor should be cleared
            expect(mockLogger.info).toHaveBeenCalledWith('Turn Manager stopped.'); // Check stop log
            expect(mockLogger.debug).toHaveBeenCalledWith('Turn order service current round cleared.'); // Check clear log
            expect(mockTurnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1); // Verify service call
            expect(mockTurnHandlerResolver.resolveHandler).not.toHaveBeenCalled(); // Stop shouldn't resolve
            expect(mockAiHandler.handleTurn).not.toHaveBeenCalled(); // Stop shouldn't handle turns
            expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled(); // Stop shouldn't dispatch events (currently)
        });
    });
    // --- End Tests for getCurrentActor() ---

});
// --- FILE END ---