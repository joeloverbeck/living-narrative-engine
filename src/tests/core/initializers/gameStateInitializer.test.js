// src/tests/core/initializers/gameStateInitializer.test.js

import {jest, describe, it, expect, beforeEach} from '@jest/globals';
import GameStateInitializer from '../../../core/initializers/gameStateInitializer.js';
import {PLAYER_COMPONENT_ID, POSITION_COMPONENT_ID} from "../../../types/components.js";

// --- Mocks for Dependencies ---
const mockEntityManager = {
    createEntityInstance: jest.fn(),
    addComponent: jest.fn(),
};
// Define mockWorldContext (needed for constructor DI, even if methods aren't used)
const mockWorldContext = {
    // No methods needed based on current GameStateInitializer implementation,
    // but keep the object for the DI signature in the constructor.
};
// REMOVED: const mockGameStateManager = { ... }; // No longer needed
const mockGameDataRepository = {
    getEntityDefinition: jest.fn(),
    getStartingPlayerId: jest.fn(),
    getStartingLocationId: jest.fn(),
};
const mockvalidatedEventDispatcher = {
    dispatchValidated: jest.fn(), // This needs to resolve for fire-and-forget calls
};
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
};

// --- Mock Entities and Components ---
const mockLocationEntity = {id: 'location_mock'};
const mockPlayerPositionComponent = { /* No methods needed directly in this test */};
const mockPlayerEntity = {
    id: 'player_mock',
    _components: new Map(),
    _componentDefinitions: new Map(),
    hasComponent: jest.fn((componentId) => {
        // Default setup: has the player component
        return componentId === PLAYER_COMPONENT_ID;
    }),
    getComponentData: jest.fn((componentId) => {
        return mockPlayerEntity._components.get(componentId);
    }),
    // Helper methods for test setup (not part of real Entity)
    _setComponent: (componentId, componentInstance) => {
        mockPlayerEntity._components.set(componentId, componentInstance);
        mockPlayerEntity._componentDefinitions.set(componentId, {});
    },
    _setComponentDefinition: (componentId, definition = {}) => {
        mockPlayerEntity._componentDefinitions.set(componentId, definition);
    },
    _clearMocksAndState: () => {
        mockPlayerEntity.hasComponent.mockClear();
        mockPlayerEntity.getComponentData.mockClear();
        mockPlayerEntity._components.clear();
        mockPlayerEntity._componentDefinitions.clear();
        // Reset to default implementation for hasComponent
        mockPlayerEntity.hasComponent.mockImplementation((componentId) => componentId === PLAYER_COMPONENT_ID);
    }
};

// --- Test Suite ---
describe('GameStateInitializer', () => {
    const START_PLAYER_ID = 'test:player_start';
    const START_LOC_ID = 'test:location_start';
    let initializer;

    beforeEach(() => {
        jest.clearAllMocks();
        mockPlayerEntity._clearMocksAndState(); // Clear player entity mock state

        // --- Default Success Mock Setup ---
        mockGameDataRepository.getStartingPlayerId.mockReturnValue(START_PLAYER_ID);
        mockGameDataRepository.getStartingLocationId.mockReturnValue(START_LOC_ID);

        mockGameDataRepository.getEntityDefinition.mockImplementation((id) => {
            // Provide a minimal definition if needed by createEntityInstance logic (though we mock the instance directly)
            if (id === START_PLAYER_ID || id === START_LOC_ID) {
                return {id: id, components: {[PLAYER_COMPONENT_ID]: {}}};
            }
            return undefined;
        });

        mockEntityManager.createEntityInstance.mockImplementation((id) => {
            if (id === START_PLAYER_ID) return mockPlayerEntity;
            if (id === START_LOC_ID) return mockLocationEntity;
            return null; // Default to null if ID doesn't match
        });

        // Default success for adding components (will be called twice in success case)
        mockEntityManager.addComponent.mockResolvedValue(undefined);

        // Crucial: Mock dispatchValidated to resolve promises for fire-and-forget calls
        mockvalidatedEventDispatcher.dispatchValidated.mockResolvedValue(undefined);

        // REMOVED: Reset GameStateManager mocks for rollback checks

        // Instantiate with the correct dependency name: worldContext
        initializer = new GameStateInitializer({
            entityManager: mockEntityManager,
            worldContext: mockWorldContext, // Pass the mockWorldContext
            gameDataRepository: mockGameDataRepository,
            validatedEventDispatcher: mockvalidatedEventDispatcher,
            logger: mockLogger,
        });
    });

    // --- Test Success Case ---
    it('should setup state, add components via EntityManager, dispatch event:room_entered, and log success', async () => {
        const success = await initializer.setupInitialState();

        // --- Verify State Changes ---
        expect(success).toBe(true);
        // REMOVED: No worldContext state setters to check

        // --- Verify Interactions ---
        expect(mockGameDataRepository.getStartingPlayerId).toHaveBeenCalledTimes(1);
        expect(mockGameDataRepository.getStartingLocationId).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(START_PLAYER_ID);
        expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(START_LOC_ID);
        expect(mockPlayerEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID); // Check player component verification

        // --- Verify Component Additions ---
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(2); // Called for current_actor and position
        // 1. core:current_actor
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
            mockPlayerEntity.id,
            'core:current_actor',
            {} // Empty data object
        );
        // 2. core:position
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
            mockPlayerEntity.id,
            POSITION_COMPONENT_ID,
            {locationId: mockLocationEntity.id, x: 0, y: 0} // Exact position data
        );


        // --- Verify Event Dispatch ---
        // Check that the specific 'event:room_entered' was dispatched
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'event:room_entered',
            {playerId: mockPlayerEntity.id, newLocationId: mockLocationEntity.id, previousLocationId: null},
            {allowSchemaNotFound: true}
        );
        // Check that the lifecycle events were also dispatched
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:started', {}, {allowSchemaNotFound: true}
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:completed',
            {playerId: mockPlayerEntity.id, locationId: mockLocationEntity.id},
            {allowSchemaNotFound: true}
        );


        // --- Verify Logging ---
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Setting up initial game state'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting IDs retrieved: Player=${START_PLAYER_ID}, Location=${START_LOC_ID}`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully instantiated player entity: ${mockPlayerEntity.id}`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Marked player entity ${mockPlayerEntity.id} as core:current_actor`)); // New log
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully instantiated starting location entity: ${mockLocationEntity.id}`));
        // REMOVED Log: No longer setting state in WorldContext/GameStateManager
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Ensuring player '${mockPlayerEntity.id}' is positioned in starting location '${mockLocationEntity.id}'`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully set/updated position component for player '${mockPlayerEntity.id}' to location '${mockLocationEntity.id}' via EntityManager`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Dispatching initial event:room_entered for player ${mockPlayerEntity.id} entering location ${mockLocationEntity.id}...`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully dispatched initial event:room_entered for player ${mockPlayerEntity.id}.`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
        expect(mockLogger.error).not.toHaveBeenCalled(); // No errors expected
        // Check warning was NOT called (because player HAS the component by default)
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining(`lacks the '${PLAYER_COMPONENT_ID}' component`));
        // REMOVED Rollback Log Check
    });

    // --- Test Warning Case ---
    it('should log a warning if the instantiated player lacks the player component but still succeed', async () => {
        // Arrange: Make the mock player entity LACK the player component
        mockPlayerEntity.hasComponent.mockImplementation((componentId) => {
            return componentId !== PLAYER_COMPONENT_ID; // Return false only for the player component
        });

        // Act
        const success = await initializer.setupInitialState();

        // Assert
        expect(success).toBe(true); // Should still succeed overall
        expect(mockPlayerEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);

        // --- Verify Warning Log ---
        expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Exactly one warning
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `Instantiated entity '${mockPlayerEntity.id}' designated as starting player, but it lacks the '${PLAYER_COMPONENT_ID}' component.`
        );

        // --- Verify Other Actions Still Occurred ---
        // REMOVED: No worldContext state setters
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(2); // Actor + Position still added
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(mockPlayerEntity.id, 'core:current_actor', {});
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(mockPlayerEntity.id, POSITION_COMPONENT_ID, expect.anything());
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('event:room_entered', expect.anything(), expect.anything()); // Room entered still dispatched

        // --- Verify Logging (Success path, despite warning) ---
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
        expect(mockLogger.error).not.toHaveBeenCalled(); // No errors expected
        // REMOVED Rollback Log Check
    });


    // --- Test Failure Cases ---

    it('should return false, log errors, and NOT dispatch room_entered if startingPlayerId is missing', async () => {
        // Arrange: Simulate missing player ID
        mockGameDataRepository.getStartingPlayerId.mockReturnValue(null);
        const expectedErrorMsg = "Missing starting player ID in game data.";

        // Act
        const success = await initializer.setupInitialState();

        // Assert
        expect(success).toBe(false);

        // --- Verify No State Setters Called ---
        // REMOVED Rollback Checks: No state to roll back

        // --- Verify Dispatch: Allow lifecycle events, forbid room_entered ---
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:started', {}, {allowSchemaNotFound: true}
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:failed',
            expect.objectContaining({error: expectedErrorMsg}),
            {allowSchemaNotFound: true}
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'event:room_entered', expect.anything(), expect.anything()
        );

        // --- Verify Logging ---
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Setting up initial game state'));
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        expect(mockLogger.error).toHaveBeenCalledWith(
            "GameStateInitializer: Failed to retrieve starting player ID from the repository/manifest. Cannot initialize game state."
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error)
        );
        // REMOVED Rollback Log Check
        // expect(mockLogger.warn).not.toHaveBeenCalled(); // Warning is no longer logged

        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });

    it('should return false, log errors, and NOT dispatch room_entered if startingLocationId is missing', async () => {
        // Arrange: Simulate missing location ID
        mockGameDataRepository.getStartingLocationId.mockReturnValue(null);
        const expectedErrorMsg = "Missing starting location ID in game data.";

        // Act
        const success = await initializer.setupInitialState();

        // Assert
        expect(success).toBe(false);
        // REMOVED Rollback Checks
        // --- Verify Dispatch: Allow lifecycle events, forbid room_entered ---
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:started', {}, {allowSchemaNotFound: true}
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:failed',
            expect.objectContaining({error: expectedErrorMsg}),
            {allowSchemaNotFound: true}
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'event:room_entered', expect.anything(), expect.anything()
        );
        // --- Verify Logging ---
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        expect(mockLogger.error).toHaveBeenCalledWith(
            "GameStateInitializer: Failed to retrieve starting location ID from the repository/manifest. Cannot initialize game state."
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error)
        );
        // REMOVED Rollback Log Check
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });


    it('should return false, log errors, and NOT dispatch room_entered if player entity instantiation fails', async () => {
        // Arrange: Configure EntityManager mock to fail player creation
        mockEntityManager.createEntityInstance.mockImplementation((id) => {
            if (id === START_PLAYER_ID) return null;
            if (id === START_LOC_ID) return mockLocationEntity;
            return null;
        });
        const expectedErrorMsg = `Failed to instantiate starting player entity '${START_PLAYER_ID}'.`;

        // Act
        const success = await initializer.setupInitialState();

        // Assert
        expect(success).toBe(false);
        // REMOVED Rollback Checks
        // --- Verify Dispatch ---
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:started', {}, {allowSchemaNotFound: true}
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:failed',
            expect.objectContaining({error: expectedErrorMsg}),
            {allowSchemaNotFound: true}
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'event:room_entered', expect.anything(), expect.anything()
        );
        // --- Verify Logging ---
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        expect(mockLogger.error).toHaveBeenCalledWith(
            `GameStateInitializer: EntityManager failed to create instance for starting player ID: ${START_PLAYER_ID}. Check if definition exists and is valid.`
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error)
        );
        // REMOVED Rollback Log Check
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });

    it('should return false, log errors, and NOT dispatch room_entered if adding actor component fails', async () => {
        // Arrange: Fail adding the 'core:current_actor' component
        const addActorCompError = new Error("Failed to add actor component");
        mockEntityManager.addComponent.mockImplementation(async (entityId, componentId, data) => {
            if (componentId === 'core:current_actor') {
                throw addActorCompError;
            }
            return undefined; // Succeed for other components (like position)
        });
        const expectedErrorMsg = `Could not mark player '${mockPlayerEntity.id}' as the current actor.`;


        // Act
        const success = await initializer.setupInitialState();

        // Assert
        expect(success).toBe(false);
        // --- Verify addComponent calls ---
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(mockPlayerEntity.id, 'core:current_actor', {});
        expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(mockPlayerEntity.id, POSITION_COMPONENT_ID, expect.anything()); // Position shouldn't be added if actor fails

        // --- Verify Dispatch ---
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:started', {}, {allowSchemaNotFound: true}
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:failed',
            expect.objectContaining({error: expectedErrorMsg}),
            {allowSchemaNotFound: true}
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'event:room_entered', expect.anything(), expect.anything()
        );
        // --- Verify Logging ---
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        expect(mockLogger.error).toHaveBeenCalledWith(
            `GameStateInitializer: Failed to add 'core:current_actor' component via EntityManager for player '${mockPlayerEntity.id}': ${addActorCompError.message}`,
            addActorCompError
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error)
        );
        // REMOVED Rollback Log Check
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });


    it('should return false, log errors, and NOT dispatch room_entered if location entity instantiation fails', async () => {
        // Arrange: Configure EntityManager mock to fail location creation
        mockEntityManager.createEntityInstance.mockImplementation((id) => {
            if (id === START_PLAYER_ID) return mockPlayerEntity;
            if (id === START_LOC_ID) return null;
            return null;
        });
        const expectedErrorMsg = `Failed to instantiate starting location entity '${START_LOC_ID}'.`;

        // Act
        const success = await initializer.setupInitialState();

        // Assert
        expect(success).toBe(false);
        // REMOVED Rollback Checks
        // --- Verify Dispatch ---
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:started', {}, {allowSchemaNotFound: true}
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:failed',
            expect.objectContaining({error: expectedErrorMsg}),
            {allowSchemaNotFound: true}
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'event:room_entered', expect.anything(), expect.anything()
        );
        // --- Verify Logging ---
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully instantiated player entity: ${mockPlayerEntity.id}`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Marked player entity ${mockPlayerEntity.id} as core:current_actor`)); // Actor marking happens before location instantiation
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Instantiating starting location entity with ID: ${START_LOC_ID}...`));
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        expect(mockLogger.error).toHaveBeenCalledWith(
            `GameStateInitializer: EntityManager failed to create instance for starting location ID: ${START_LOC_ID}. Check if definition exists and is valid.`
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error)
        );
        // REMOVED Rollback Log Check
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });

    it('should return false, log errors, and NOT dispatch room_entered if adding position component via EntityManager fails', async () => {
        // Arrange: Fail adding the POSITION component
        const addPosCompError = new Error('EntityManager failed to add position component');
        mockEntityManager.addComponent.mockImplementation(async (entityId, componentId, data) => {
            if (componentId === POSITION_COMPONENT_ID) {
                throw addPosCompError;
            }
            // Succeed for actor component
            if (componentId === 'core:current_actor') {
                return undefined;
            }
            return undefined;
        });
        const expectedErrorMsg = `Could not set player's initial position in starting location '${mockLocationEntity.id}'.`;

        // Act
        const success = await initializer.setupInitialState();

        // Assert
        expect(success).toBe(false);
        // REMOVED Rollback Checks: No state to roll back

        // --- Verify Attempt to Add Components ---
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(2); // Attempted both actor and position
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(mockPlayerEntity.id, 'core:current_actor', {}); // Actor add succeeded
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
            mockPlayerEntity.id,
            POSITION_COMPONENT_ID,
            {locationId: mockLocationEntity.id, x: 0, y: 0} // Position add failed
        );

        // --- Verify Dispatch: Allow lifecycle events, forbid room_entered ---
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:started', {}, {allowSchemaNotFound: true}
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:failed',
            expect.objectContaining({error: expectedErrorMsg}),
            {allowSchemaNotFound: true}
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'event:room_entered', expect.anything(), expect.anything()
        );

        // --- Verify Logging ---
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        expect(mockLogger.error).toHaveBeenCalledWith(
            `GameStateInitializer: Failed to add/update position component via EntityManager for player '${mockPlayerEntity.id}' in location '${mockLocationEntity.id}': ${addPosCompError.message}`,
            addPosCompError
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error)
        );
        // REMOVED Rollback Log Check
        // expect(mockLogger.warn).not.toHaveBeenCalled(); // Warning is no longer logged

        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });
});