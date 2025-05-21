// src/tests/core/turnManager.base.test.js
// --- FILE START (Corrected) ---

import TurnManager from '../../../src/turns/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../../src/constants/componentIds.js';
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
    getEntityInstance: jest.fn(), // Checked by constructor
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

// *** FIXED: Added mock for the 'subscribe' method ***
const mockDispatcher = {
    dispatchValidated: jest.fn(),
    subscribe: jest.fn(() => jest.fn()), // Mock subscribe to return a mock unsubscribe function
};
// --- END FIXED ---


const mockTurnHandlerResolver = {
    resolveHandler: jest.fn(),
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

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Reset mock EntityManager's internal state
        mockEntityManager._setActiveEntities([]);

        // Re-initialize basic mock configurations
        mockTurnOrderService.isEmpty.mockResolvedValue(true);
        mockTurnOrderService.getNextEntity.mockResolvedValue(null);
        mockDispatcher.dispatchValidated.mockResolvedValue(true);
        // *** FIXED: Reset the new mock method too ***
        mockDispatcher.subscribe.mockClear();
        // Make sure the inner unsubscribe mock is also cleared/reset if needed,
        // though jest.clearAllMocks() might handle the return value mock.
        // If issues arise, you might need explicit reset logic for the returned function.
        mockTurnHandlerResolver.resolveHandler.mockClear();
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(null);


        // Create fresh mock entities
        mockPlayerEntity = createMockEntity('player-1', true, true);
        mockAiEntity1 = createMockEntity('ai-1', true, false);
        mockAiEntity2 = createMockEntity('ai-2', true, false);

        // *** FIXED: Instantiate TurnManager with the CORRECT dispatcher mock ***
        // Should no longer throw here
        turnManager = new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher, // Pass corrected dispatcher mock
            turnHandlerResolver: mockTurnHandlerResolver,
        });

        // Clear constructor log for cleaner test assertions below if needed
        mockLogger.info.mockClear();
    });

    // --- Basic Sanity / Setup Tests ---

    test('should exist and be a class', () => {
        // Re-instantiate to check constructor log specifically
        jest.clearAllMocks(); // Clear previous beforeEach logs
        const instance = new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher, // Pass corrected dispatcher mock
            turnHandlerResolver: mockTurnHandlerResolver,
        });

        expect(TurnManager).toBeDefined();
        expect(instance).toBeInstanceOf(TurnManager);
        // Check if constructor logging still occurs
        expect(mockLogger.info).toHaveBeenCalledWith('TurnManager initialized successfully.');
        expect(mockLogger.info).toHaveBeenCalledTimes(1); // Ensure only called once here
    });

    test('mock entities should behave as configured', () => {
        // This tests the helper, doesn't directly involve TurnManager instance much
        expect(mockPlayerEntity.id).toBe('player-1');
        expect(mockPlayerEntity.hasComponent(ACTOR_COMPONENT_ID)).toBe(true);
        expect(mockPlayerEntity.hasComponent(PLAYER_COMPONENT_ID)).toBe(true);
        expect(mockAiEntity1.hasComponent(PLAYER_COMPONENT_ID)).toBe(false);
    });

    test('EntityManager mock allows setting active entities', () => {
        // This tests the mock helper, doesn't directly involve TurnManager instance much
        const entities = [mockPlayerEntity, mockAiEntity1];
        mockEntityManager._setActiveEntities(entities);
        expect(Array.from(mockEntityManager.activeEntities.values())).toEqual(entities);
    });

    // Add more tests for start, stop, advanceTurn, etc. later

});
// --- FILE END ---