// src/tests/gameStateInitializer.test.js

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import GameStateInitializer from '../core/gameStateInitializer.js'; // Adjust path
import Entity from '../entities/entity.js'; // Adjust path
import { PositionComponent } from '../components/positionComponent.js'; // Adjust path

// --- Mocks ---
const mockEntityManager = {
    createEntityInstance: jest.fn(),
    // We don't need getEntityInstance or removeEntityInstance for this test
};

const mockGameStateManager = {
    setPlayer: jest.fn(),
    setCurrentLocation: jest.fn(),
    // getPlayer/getCurrentLocation aren't called by the initializer itself
};

const mockDataManager = {
    getEntityDefinition: jest.fn(),
    getStartingPlayerId: jest.fn(), // Add this mock
    getStartingLocationId: jest.fn(), // Add this mock
};

// Mock Entity and Components minimally
// Need mock addComponent and getComponent for the position logic
const mockPlayerEntity = {
    id: 'player_mock',
    components: new Map(),
    // --- MODIFIED MOCK getComponent ---
    getComponent: jest.fn((ComponentClass) => {
        // Look up the component instance using the Class as the key,
        // matching how it's added in the test setup.
        return mockPlayerEntity.components.get(ComponentClass);
    }),
    // Keep addComponent mock as it was, seems okay for the second test
    addComponent: jest.fn((key, data) => {
        if (key === 'Position') {
            const posComp = new PositionComponent(data);
            mockPlayerEntity.components.set(PositionComponent, posComp); // Store by Class key
        }
    }),
    // Helper to reset mocks on the entity itself
    _clearMocks: () => {
        // Clear calls and the map
        mockPlayerEntity.getComponent.mockClear();
        mockPlayerEntity.addComponent.mockClear();
        mockPlayerEntity.components.clear();
        // No need to reset the mock implementation itself if the main one is correct now
    }
};
const mockLocationEntity = { id: 'location_mock' };
const mockPlayerPositionComponent = {
    setLocation: jest.fn(),
};


// --- Test Suite ---
describe('GameStateInitializer', () => {
    const START_PLAYER_ID = 'test:player';
    const START_LOC_ID = 'test:start_room';
    let initializer;

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();
        mockPlayerEntity._clearMocks(); // Clear mocks on the entity itself

        // --- Configure Mock Return Values ---
        // DataManager: Assume definitions exist and starting IDs are available
        mockDataManager.getEntityDefinition.mockImplementation((id) => {
            if (id === START_PLAYER_ID || id === START_LOC_ID) {
                return { id: id, components: {} }; // Return a minimal valid definition
            }
            return undefined;
        });
        // --- ADD THIS ---
        mockDataManager.getStartingPlayerId.mockReturnValue(START_PLAYER_ID);
        mockDataManager.getStartingLocationId.mockReturnValue(START_LOC_ID);
        // --- END ADD ---

        // EntityManager: Return the mock entities when created
        mockEntityManager.createEntityInstance.mockImplementation((id) => {
            if (id === START_PLAYER_ID) return mockPlayerEntity;
            if (id === START_LOC_ID) return mockLocationEntity;
            return null;
        });

        // Instantiate the service with mocks
        // No longer pass starting IDs here, matching the constructor change
        initializer = new GameStateInitializer({
            entityManager: mockEntityManager,
            gameStateManager: mockGameStateManager,
            dataManager: mockDataManager,
            // Remove these lines if they were still present:
            // startingPlayerId: START_PLAYER_ID,
            // startingLocationId: START_LOC_ID,
        });
    });

    it('should successfully create player and location, set state, and place player', () => {
        // --- Arrange ---
        // Mock player having PositionComponent already
        mockPlayerEntity.components.set(PositionComponent, mockPlayerPositionComponent);

        // --- Act ---
        const success = initializer.setupInitialState();

        // --- Assert ---
        expect(success).toBe(true);

        // 1. Definitions retrieved?
        expect(mockDataManager.getEntityDefinition).toHaveBeenCalledWith(START_PLAYER_ID);
        expect(mockDataManager.getEntityDefinition).toHaveBeenCalledWith(START_LOC_ID);

        // 2. Entities created?
        expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(START_PLAYER_ID);
        expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(START_LOC_ID);

        // 3. GameState updated?
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(mockLocationEntity);

        // 4. Player position handled?
        expect(mockPlayerEntity.getComponent).toHaveBeenCalledWith(PositionComponent);
        expect(mockPlayerPositionComponent.setLocation).toHaveBeenCalledWith(mockLocationEntity.id, 0, 0);
        expect(mockPlayerEntity.addComponent).not.toHaveBeenCalled(); // Should not add if already exists
    });

    it('should add PositionComponent if player is missing it', () => {
        // --- Arrange ---
        // Ensure player starts without PositionComponent
        mockPlayerEntity.components.delete(PositionComponent);

        // --- Act ---
        const success = initializer.setupInitialState();

        // --- Assert ---
        expect(success).toBe(true);
        expect(mockPlayerEntity.getComponent).toHaveBeenCalledWith(PositionComponent);
        // Verify setLocation was NOT called on a non-existent component
        expect(mockPlayerPositionComponent.setLocation).not.toHaveBeenCalled();
        // Verify addComponent WAS called
        expect(mockPlayerEntity.addComponent).toHaveBeenCalledWith('Position', { locationId: mockLocationEntity.id, x: 0, y: 0 });
    });

    it('should return false and log error if player definition is missing', () => {
        // --- Arrange ---
        mockDataManager.getEntityDefinition.mockImplementation((id) => {
            if (id === START_LOC_ID) return { id: id, components: {} };
            return undefined; // Player def missing
        });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console output

        // --- Act ---
        const success = initializer.setupInitialState();

        // --- Assert ---
        expect(success).toBe(false);
        expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalled(); // Shouldn't get this far
        expect(mockGameStateManager.setPlayer).not.toHaveBeenCalled();
        expect(mockGameStateManager.setCurrentLocation).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("CRITICAL ERROR"), expect.any(Error));

        errorSpy.mockRestore();
    });

    it('should return false and log error if player instantiation fails', () => {
        // --- Arrange ---
        mockEntityManager.createEntityInstance.mockImplementation((id) => {
            if (id === START_PLAYER_ID) return null; // Simulate failure
            if (id === START_LOC_ID) return mockLocationEntity;
            return null;
        });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // --- Act ---
        const success = initializer.setupInitialState();

        // --- Assert ---
        expect(success).toBe(false);
        expect(mockGameStateManager.setPlayer).not.toHaveBeenCalled(); // Player shouldn't be set
        expect(mockGameStateManager.setCurrentLocation).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("CRITICAL ERROR"), expect.any(Error));

        errorSpy.mockRestore();
    });

    it('should return false and log error if location definition is missing', () => {
        // --- Arrange ---
        mockDataManager.getEntityDefinition.mockImplementation((id) => {
            if (id === START_PLAYER_ID) return { id: id, components: {} };
            return undefined; // Location def missing
        });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // --- Act ---
        const success = initializer.setupInitialState();

        // --- Assert ---
        expect(success).toBe(false);
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity); // Player might be set before failure
        expect(mockGameStateManager.setCurrentLocation).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("CRITICAL ERROR"), expect.any(Error));

        errorSpy.mockRestore();
    });

    // Add more tests for location instantiation failure, addComponent failure etc.
});