// src/tests/core/turnManager.test.js

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
        mockTurnOrderService.isEmpty.mockResolvedValue(true); // Default to empty queue
        mockTurnOrderService.getNextEntity.mockResolvedValue(null); // Default to no next entity
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
    });

    // --- Test cases will be added in subsequent tickets ---

    test('should exist and be a class', () => {
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

});