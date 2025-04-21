// src/tests/gameStateInitializer.test.js

import {jest, describe, it, expect, beforeEach} from '@jest/globals';
import GameStateInitializer from '../core/gameStateInitializer.js'; // Adjust path if needed
// Assuming Entity is not directly needed for mocking, but keep if used elsewhere
// import Entity from '../entities/entity.js';
// Assuming PositionComponent class itself isn't needed directly for mocking method calls
// import { PositionComponent } from '../components/positionComponent.js';
import {POSITION_COMPONENT_ID} from '../types/components.js'; // Adjust path if needed

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

const mockGameDataRepository = {
    getEntityDefinition: jest.fn(),
    getStartingPlayerId: jest.fn(),
    getStartingLocationId: jest.fn(),
};

// Mock Location Entity (simple)
const mockLocationEntity = {id: 'location_mock'};

// Mock Position Component (needs setLocation method)
const mockPlayerPositionComponent = {
    setLocation: jest.fn(),
    // Add any other properties/methods if the component implementation or usage requires them
};

// Mock Player Entity (Corrected)
const mockPlayerEntity = {
    id: 'player_mock',
    components: new Map(), // Stores component instances, keyed by component ID string

    // Mock getComponentData - This is what GameStateInitializer calls
    getComponentData: jest.fn((componentId) => {
        // Return the component instance associated with the string ID
        return mockPlayerEntity.components.get(componentId);
    }),

    // Mock addComponent - This is what GameStateInitializer calls if getComponentData returns falsy
    addComponent: jest.fn((componentId, data) => {
        // Simulate adding the component instance to the map
        if (componentId === POSITION_COMPONENT_ID) {
            // Use the existing mock component instance for simplicity in testing setLocation later if needed,
            // or create a new one if the test requires isolation. Here we add *a* position component.
            // We create a *new* simple mock here to better reflect adding something new.
            const newPosComp = {
                // Copy data if the real component constructor uses it
                ...data,
                // Add mock methods if needed, like setLocation, though it's not called *after* adding in the current logic
                setLocation: jest.fn(),
            };
            mockPlayerEntity.components.set(componentId, newPosComp);
            // Return the newly added component instance if the real method does
            return newPosComp;
        }
        // Handle other component types if necessary for other tests
    }),

    // Optional: Keep getComponent if other parts of your system use it by Class.
    // If GameStateInitializer *only* uses getComponentData, this isn't strictly needed for *these* tests.
    getComponent: jest.fn((/* ComponentClass */) => {
        // If needed, implement lookup by Class. For these tests, it seems unused by the SUT.
        console.warn("mockPlayerEntity.getComponent called - ensure mock implementation is correct if required.");
        // Find component instance based on class type (more complex lookup)
        for (let comp of mockPlayerEntity.components.values()) {
            // This requires component instances to somehow know their class,
            // or a more complex map structure like Map<Class, Instance>.
            // For now, returning undefined as it's not hit by the tested code.
        }
        return undefined;
    }),

    // Helper to reset mocks on the entity itself and its components
    _clearMocks: () => {
        mockPlayerEntity.getComponentData.mockClear();
        mockPlayerEntity.addComponent.mockClear();
        mockPlayerEntity.getComponent.mockClear(); // Clear this too if kept
        mockPlayerEntity.components.clear();
        // Also clear mocks on any component instances used across tests
        mockPlayerPositionComponent.setLocation.mockClear();
    }
};


// --- Test Suite ---
describe('GameStateInitializer', () => {
    const START_PLAYER_ID = 'test:player';
    const START_LOC_ID = 'test:start_room';
    let initializer;

    beforeEach(() => {
        // Reset all framework mocks before each test
        jest.clearAllMocks();
        // Reset our custom entity mock state
        mockPlayerEntity._clearMocks();

        // --- Configure Mock Return Values ---
        // GameDataRepository provides starting IDs
        mockGameDataRepository.getStartingPlayerId.mockReturnValue(START_PLAYER_ID);
        mockGameDataRepository.getStartingLocationId.mockReturnValue(START_LOC_ID);
        // GameDataRepository provides entity definitions (minimal)
        mockGameDataRepository.getEntityDefinition.mockImplementation((id) => {
            if (id === START_PLAYER_ID || id === START_LOC_ID) {
                return {id: id, components: {}}; // Return a minimal valid definition
            }
            return undefined;
        });

        // EntityManager returns our mock entities when requested
        mockEntityManager.createEntityInstance.mockImplementation((id) => {
            if (id === START_PLAYER_ID) return mockPlayerEntity;
            if (id === START_LOC_ID) return mockLocationEntity;
            return null; // Simulate failure for other IDs if needed
        });

        // Instantiate the service (System Under Test) with mocks
        initializer = new GameStateInitializer({
            entityManager: mockEntityManager,
            gameStateManager: mockGameStateManager,
            gameDataRepository: mockGameDataRepository,
        });
    });

    it('should successfully create player and location, set state, and place player', () => {
        // --- Arrange ---
        // Mock that the player *already has* a PositionComponent.
        // Store it using the ID string as the key. Use the shared mock component instance.
        mockPlayerEntity.components.set(POSITION_COMPONENT_ID, mockPlayerPositionComponent);

        // --- Act ---
        const success = initializer.setupInitialState();

        // --- Assert ---
        expect(success).toBe(true); // Expect setup to succeed

        // 1. Starting IDs retrieved?
        expect(mockGameDataRepository.getStartingPlayerId).toHaveBeenCalledTimes(1);
        expect(mockGameDataRepository.getStartingLocationId).toHaveBeenCalledTimes(1);

        // 2. Definitions retrieved?
        expect(mockGameDataRepository.getEntityDefinition).toHaveBeenCalledWith(START_PLAYER_ID);
        expect(mockGameDataRepository.getEntityDefinition).toHaveBeenCalledWith(START_LOC_ID);

        // 3. Entities created via EntityManager?
        expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(START_PLAYER_ID);
        expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(START_LOC_ID);

        // 4. GameState updated via GameStateManager?
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(mockLocationEntity);

        // 5. Player position handled?
        // -> Check if getComponentData was called for Position
        expect(mockPlayerEntity.getComponentData).toHaveBeenCalledWith(POSITION_COMPONENT_ID);
        // -> Check if setLocation was called on the *existing* component
        expect(mockPlayerPositionComponent.setLocation).toHaveBeenCalledWith(mockLocationEntity.id, 0, 0);
        // -> Check that addComponent was *not* called because the component existed
        expect(mockPlayerEntity.addComponent).not.toHaveBeenCalled();
    });

    it('should add PositionComponent if player is missing it', () => {
        // --- Arrange ---
        // Ensure player starts *without* PositionComponent
        // (This should be the default state after _clearMocks, but explicit deletion is clearer)
        mockPlayerEntity.components.delete(POSITION_COMPONENT_ID);

        // --- Act ---
        const success = initializer.setupInitialState();

        // --- Assert ---
        expect(success).toBe(true); // Expect setup to succeed

        // 1. GameState updated? (Should still happen)
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(mockLocationEntity);

        // 2. Player position handled?
        // -> Check if getComponentData was called (it should return undefined/null)
        expect(mockPlayerEntity.getComponentData).toHaveBeenCalledWith(POSITION_COMPONENT_ID);

        // -> Check that addComponent WAS called because the component was missing
        expect(mockPlayerEntity.addComponent).toHaveBeenCalledWith(POSITION_COMPONENT_ID, {
            locationId: mockLocationEntity.id,
            x: 0,
            y: 0
        });

        // -> Check that setLocation was NOT called on the shared mock component instance
        //    (because getComponentData returned falsy initially). The logic currently
        //    adds the component but doesn't then immediately call setLocation on it.
        expect(mockPlayerPositionComponent.setLocation).not.toHaveBeenCalled();

        // -> Optional: Verify the component was actually added to the mock map
        expect(mockPlayerEntity.components.has(POSITION_COMPONENT_ID)).toBe(true);
        // -> Optional: Verify the added component has the correct initial data (if your addComponent mock sets it)
        const addedComp = mockPlayerEntity.components.get(POSITION_COMPONENT_ID);
        expect(addedComp).toBeDefined();
        // If addComponent mock populates properties based on data:
        // expect(addedComp.locationId).toBe(mockLocationEntity.id);
        // expect(addedComp.x).toBe(0);
        // expect(addedComp.y).toBe(0);

    });

    it('should return false and log error if player definition is missing', () => {
        // --- Arrange ---
        mockGameDataRepository.getEntityDefinition.mockImplementation((id) => {
            if (id === START_LOC_ID) return {id: id, components: {}};
            return undefined; // Player def missing
        });
        // Suppress console.error during this test
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });

        // --- Act ---
        const success = initializer.setupInitialState();

        // --- Assert ---
        expect(success).toBe(false); // Expect setup to fail
        expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalled(); // Shouldn't try to create entities
        expect(mockGameStateManager.setPlayer).not.toHaveBeenCalled();
        expect(mockGameStateManager.setCurrentLocation).not.toHaveBeenCalled();
        // Check that a critical error was logged
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("CRITICAL ERROR"), expect.any(Error));
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`Player definition '${START_PLAYER_ID}'`), expect.any(Error));


        errorSpy.mockRestore(); // Restore console.error
    });

    it('should return false and log error if player instantiation fails', () => {
        // --- Arrange ---
        mockEntityManager.createEntityInstance.mockImplementation((id) => {
            if (id === START_PLAYER_ID) return null; // Simulate EntityManager failure
            if (id === START_LOC_ID) return mockLocationEntity;
            return null;
        });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });

        // --- Act ---
        const success = initializer.setupInitialState();

        // --- Assert ---
        expect(success).toBe(false); // Expect setup to fail
        // Player creation was attempted
        expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(START_PLAYER_ID);
        // Location creation might or might not be attempted depending on exact flow after player failure
        // Based on current code, it stops after player fails.
        expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalledWith(START_LOC_ID);

        expect(mockGameStateManager.setPlayer).not.toHaveBeenCalled(); // Player shouldn't be set
        expect(mockGameStateManager.setCurrentLocation).not.toHaveBeenCalled(); // Location shouldn't be set
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("CRITICAL ERROR"), expect.any(Error));
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`Failed to instantiate player entity '${START_PLAYER_ID}'`), expect.any(Error));


        errorSpy.mockRestore();
    });

    it('should return false and log error if location definition is missing', () => {
        // --- Arrange ---
        mockGameDataRepository.getEntityDefinition.mockImplementation((id) => {
            if (id === START_PLAYER_ID) return {id: id, components: {}};
            return undefined; // Location def missing
        });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });

        // --- Act ---
        const success = initializer.setupInitialState();

        // --- Assert ---
        expect(success).toBe(false); // Expect setup to fail

        // Player creation and setting likely succeeded before the location failure
        expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(START_PLAYER_ID);
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity);

        // Location definition retrieval was attempted
        expect(mockGameDataRepository.getEntityDefinition).toHaveBeenCalledWith(START_LOC_ID);
        // Location creation was not attempted
        expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalledWith(START_LOC_ID);
        expect(mockGameStateManager.setCurrentLocation).not.toHaveBeenCalled();

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("CRITICAL ERROR"), expect.any(Error));
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`Starting location definition '${START_LOC_ID}'`), expect.any(Error));


        errorSpy.mockRestore();
    });

    it('should return false and log error if location instantiation fails', () => {
        // --- Arrange ---
        mockEntityManager.createEntityInstance.mockImplementation((id) => {
            if (id === START_PLAYER_ID) return mockPlayerEntity;
            if (id === START_LOC_ID) return null; // Simulate EntityManager failure for location
            return null;
        });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });

        // --- Act ---
        const success = initializer.setupInitialState();

        // --- Assert ---
        expect(success).toBe(false); // Expect setup to fail

        // Player creation and setting likely succeeded
        expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(START_PLAYER_ID);
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity);

        // Location creation was attempted
        expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(START_LOC_ID);
        // Location setting failed
        expect(mockGameStateManager.setCurrentLocation).not.toHaveBeenCalled();

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("CRITICAL ERROR"), expect.any(Error));
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`Failed to instantiate starting location entity '${START_LOC_ID}'`), expect.any(Error));

        errorSpy.mockRestore();
    });

    // Add more tests if needed, e.g., failure during addComponent
    it('should return false and log error if adding position component fails', () => {
        // --- Arrange ---
        // Ensure player starts without PositionComponent
        mockPlayerEntity.components.delete(POSITION_COMPONENT_ID);
        // Make addComponent throw an error
        const addComponentError = new Error("Failed to add component via mock");
        mockPlayerEntity.addComponent.mockImplementation((componentId, data) => {
            if (componentId === POSITION_COMPONENT_ID) {
                throw addComponentError;
            }
        });

        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });


        // --- Act ---
        const success = initializer.setupInitialState();


        // --- Assert ---
        expect(success).toBe(false); // Expect setup to fail

        // Player/Location setup likely happened
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(mockLocationEntity);

        // Checks leading up to addComponent happened
        expect(mockPlayerEntity.getComponentData).toHaveBeenCalledWith(POSITION_COMPONENT_ID);
        expect(mockPlayerEntity.addComponent).toHaveBeenCalledWith(POSITION_COMPONENT_ID, expect.any(Object));

        // Critical error logged, and specific addComponent error logged
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("CRITICAL ERROR"), expect.any(Error));
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`Failed to add position data to player '${mockPlayerEntity.id}'`), addComponentError);
        // The outer catch block should also log the "Could not set player's initial position" error message
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`Could not set player's initial position in ${mockLocationEntity.id}`), expect.any(Error));


        errorSpy.mockRestore();
    });

});