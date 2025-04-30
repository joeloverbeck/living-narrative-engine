// src/tests/core/initializers/gameStateInitializer.test.js

import {jest, describe, it, expect, beforeEach} from '@jest/globals';
import GameStateInitializer from '../../../core/initializers/gameStateInitializer.js';
import {PLAYER_COMPONENT_ID, POSITION_COMPONENT_ID} from "../../../types/components.js";

// --- Mocks for Dependencies ---
const mockEntityManager = {
    createEntityInstance: jest.fn(),
    addComponent: jest.fn(),
};
const mockGameStateManager = {
    setPlayer: jest.fn(),
    setCurrentLocation: jest.fn(),
    getPlayer: jest.fn(() => null), // Mock initial state for rollback testing
    getCurrentLocation: jest.fn(() => null), // Mock initial state for rollback testing
};
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
const mockPlayerPositionComponent = { /* No methods needed directly in this test */ };
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

        mockEntityManager.addComponent.mockResolvedValue(undefined); // Default success for adding component

        // Crucial: Mock dispatchValidated to resolve promises for fire-and-forget calls
        mockvalidatedEventDispatcher.dispatchValidated.mockResolvedValue(undefined);

        // Reset GameStateManager mocks for rollback checks
        mockGameStateManager.getPlayer.mockReturnValue(null);
        mockGameStateManager.getCurrentLocation.mockReturnValue(null);

        initializer = new GameStateInitializer({
            entityManager: mockEntityManager,
            gameStateManager: mockGameStateManager,
            gameDataRepository: mockGameDataRepository,
            validatedEventDispatcher: mockvalidatedEventDispatcher,
            logger: mockLogger,
        });
    });

    // --- Test Success Case ---
    it('should setup state, set position via EntityManager, dispatch event:room_entered, and log success', async () => {
        const success = await initializer.setupInitialState();

        // --- Verify State Changes ---
        expect(success).toBe(true);
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(mockLocationEntity);

        // --- Verify Interactions ---
        expect(mockGameDataRepository.getStartingPlayerId).toHaveBeenCalledTimes(1);
        expect(mockGameDataRepository.getStartingLocationId).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(START_PLAYER_ID);
        expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(START_LOC_ID);
        expect(mockPlayerEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID); // Check player component verification
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
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
            'initialization:game_state_initializer:started', {}, { allowSchemaNotFound: true }
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:completed',
            { playerId: mockPlayerEntity.id, locationId: mockLocationEntity.id },
            { allowSchemaNotFound: true }
        );


        // --- Verify Logging ---
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Setting up initial game state'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting IDs retrieved: Player=${START_PLAYER_ID}, Location=${START_LOC_ID}`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully instantiated player entity: ${mockPlayerEntity.id}`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully instantiated starting location entity: ${mockLocationEntity.id}`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Player '${mockPlayerEntity.id}' and Location '${mockLocationEntity.id}' set in GameStateManager`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Ensuring player '${mockPlayerEntity.id}' is positioned in starting location '${mockLocationEntity.id}'`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully set/updated position component for player '${mockPlayerEntity.id}' to location '${mockLocationEntity.id}' via EntityManager`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Dispatching initial event:room_entered for player ${mockPlayerEntity.id} entering location ${mockLocationEntity.id}...`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully dispatched initial event:room_entered for player ${mockPlayerEntity.id}.`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
        expect(mockLogger.error).not.toHaveBeenCalled(); // No errors expected
        // Check warning was NOT called (because player HAS the component by default)
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining(`lacks the '${PLAYER_COMPONENT_ID}' component`));
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Rolled back')); // No rollback expected
    });

    // --- Test Warning Case ---
    it('should log a warning if the instantiated player lacks the player component', async () => {
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
            // Use exact string matching based on the corrected implementation
            `Instantiated entity '${mockPlayerEntity.id}' designated as starting player, but it lacks the '${PLAYER_COMPONENT_ID}' component.`
        );

        // --- Verify Other Actions Still Occurred ---
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(mockLocationEntity);
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1); // Position still added
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('event:room_entered', expect.anything(), expect.anything()); // Room entered still dispatched

        // --- Verify Logging (Success path, despite warning) ---
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
        expect(mockLogger.error).not.toHaveBeenCalled(); // No errors expected
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Rolled back')); // No rollback expected
    });


    // --- Test Failure Cases ---

    it('should return false, log errors, and NOT dispatch room_entered if startingPlayerId is missing', async () => {
        // Arrange: Simulate missing player ID
        mockGameDataRepository.getStartingPlayerId.mockReturnValue(null);
        const expectedErrorMsg = "Missing starting player ID in game data."; // Matches the error thrown

        // Act
        const success = await initializer.setupInitialState();

        // Assert
        expect(success).toBe(false); // Expect setup to fail

        // --- Verify Core State NOT Set (or rolled back) ---
        // Check rollback occurred by verifying setPlayer/Location were called with null
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(null);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(null);
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledTimes(1); // Only called during rollback
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledTimes(1); // Only called during rollback


        // --- Verify Dispatch: Allow lifecycle events, forbid room_entered ---
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:started', {}, { allowSchemaNotFound: true }
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:failed',
            expect.objectContaining({ error: expectedErrorMsg }), // Check the error message in the payload
            { allowSchemaNotFound: true }
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'event:room_entered', // Specifically check that room_entered was NOT called
            expect.anything(),
            expect.anything()
        );

        // --- Verify Logging ---
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Setting up initial game state'));
        // Expect TWO error calls: 1 specific, 1 generic critical
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        // 1. Specific log before throw
        expect(mockLogger.error).toHaveBeenCalledWith(
            "GameStateInitializer: Failed to retrieve starting player ID from the repository/manifest. Cannot initialize game state."
        );
        // 2. Generic log from catch block
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error) // Check that an Error object was passed
        );
        // Check rollback warning
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Rolled back GameStateManager state'));
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);

        // Verify success logs NOT called
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });

    it('should return false, log errors, and NOT dispatch room_entered if startingLocationId is missing', async () => {
        // Arrange: Simulate missing location ID
        mockGameDataRepository.getStartingLocationId.mockReturnValue(null);
        const expectedErrorMsg = "Missing starting location ID in game data."; // Matches the error thrown

        // Act
        const success = await initializer.setupInitialState();

        // Assert
        expect(success).toBe(false);

        // --- Verify Core State NOT Set (or rolled back) ---
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(null);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(null);
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledTimes(1);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledTimes(1);


        // --- Verify Dispatch: Allow lifecycle events, forbid room_entered ---
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:started', {}, { allowSchemaNotFound: true }
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:failed',
            expect.objectContaining({ error: expectedErrorMsg }),
            { allowSchemaNotFound: true }
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'event:room_entered', expect.anything(), expect.anything()
        );

        // --- Verify Logging ---
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Setting up initial game state'));
        // --- REMOVED INCORRECT ASSERTION ---
        // The log "Starting IDs retrieved..." doesn't happen if location ID is missing
        // expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting IDs retrieved: Player=${START_PLAYER_ID}`));
        // Expect TWO error calls: 1 specific, 1 generic critical
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        // 1. Specific log before throw
        expect(mockLogger.error).toHaveBeenCalledWith(
            "GameStateInitializer: Failed to retrieve starting location ID from the repository/manifest. Cannot initialize game state."
        );
        // 2. Generic log from catch block
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error)
        );
        // Check rollback warning
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Rolled back GameStateManager state'));
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);

        // Verify success logs NOT called
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });


    it('should return false, log errors, and NOT dispatch room_entered if player entity instantiation fails', async () => {
        // Arrange: Configure EntityManager mock to fail player creation
        mockEntityManager.createEntityInstance.mockImplementation((id) => {
            if (id === START_PLAYER_ID) return null; // Fail player creation
            if (id === START_LOC_ID) return mockLocationEntity; // Location would be created (though rollback happens)
            return null;
        });
        const expectedErrorMsg = `Failed to instantiate starting player entity '${START_PLAYER_ID}'.`; // Matches error thrown

        // Act
        const success = await initializer.setupInitialState();

        // Assert
        expect(success).toBe(false);

        // --- Verify Core State NOT Set (or rolled back) ---
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(null);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(null);
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledTimes(1);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledTimes(1);


        // --- Verify Dispatch: Allow lifecycle events, forbid room_entered ---
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:started', {}, { allowSchemaNotFound: true }
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:failed',
            expect.objectContaining({ error: expectedErrorMsg }),
            { allowSchemaNotFound: true }
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'event:room_entered', expect.anything(), expect.anything()
        );

        // --- Verify Logging ---
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Setting up initial game state'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting IDs retrieved: Player=${START_PLAYER_ID}, Location=${START_LOC_ID}`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Instantiating starting player entity with ID: ${START_PLAYER_ID}...`));
        // Expect TWO error calls: 1 specific, 1 generic critical
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        // 1. Specific log before throw
        expect(mockLogger.error).toHaveBeenCalledWith(
            `GameStateInitializer: EntityManager failed to create instance for starting player ID: ${START_PLAYER_ID}. Check if definition exists and is valid.`
        );
        // 2. Generic log from catch block
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error)
        );
        // Check rollback warning
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Rolled back GameStateManager state'));
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);

        // Verify success logs NOT called
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });

    it('should return false, log errors, and NOT dispatch room_entered if location entity instantiation fails', async () => {
        // Arrange: Configure EntityManager mock to fail location creation
        mockEntityManager.createEntityInstance.mockImplementation((id) => {
            if (id === START_PLAYER_ID) return mockPlayerEntity; // Player created successfully
            if (id === START_LOC_ID) return null; // Fail location creation
            return null;
        });
        const expectedErrorMsg = `Failed to instantiate starting location entity '${START_LOC_ID}'.`; // Matches error thrown

        // Act
        const success = await initializer.setupInitialState();

        // Assert
        expect(success).toBe(false);

        // --- Verify Core State NOT Set (or rolled back) ---
        // Player *was NOT* set initially because the error occurred before setPlayer was called
        // --- REMOVED INCORRECT ASSERTION ---
        // expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity); // Called before rollback
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(null); // Called during rollback
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(null); // Only called during rollback
        // --- ADJUSTED TIMES CALLED ---
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledTimes(1); // Rollback only
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledTimes(1); // Rollback only

        // --- Verify Dispatch: Allow lifecycle events, forbid room_entered ---
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:started', {}, { allowSchemaNotFound: true }
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:failed',
            expect.objectContaining({ error: expectedErrorMsg }),
            { allowSchemaNotFound: true }
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'event:room_entered', expect.anything(), expect.anything()
        );

        // --- Verify Logging ---
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully instantiated player entity: ${mockPlayerEntity.id}`)); // Player succeeded
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Instantiating starting location entity with ID: ${START_LOC_ID}...`));
        // Expect TWO error calls: 1 specific, 1 generic critical
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        // 1. Specific log before throw
        expect(mockLogger.error).toHaveBeenCalledWith(
            `GameStateInitializer: EntityManager failed to create instance for starting location ID: ${START_LOC_ID}. Check if definition exists and is valid.`
        );
        // 2. Generic log from catch block
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error)
        );
        // Check rollback warning
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Rolled back GameStateManager state'));
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);

        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });

    it('should return false, log errors, and NOT dispatch room_entered if adding/updating position component via EntityManager fails', async () => {
        // Arrange: EntityManager.addComponent throws error
        const addCompError = new Error('EntityManager failed to add/update component');
        mockEntityManager.addComponent.mockRejectedValue(addCompError); // Simulate async failure
        const expectedErrorMsg = `Could not set player's initial position in starting location '${mockLocationEntity.id}'.`; // Matches error thrown

        // Act
        const success = await initializer.setupInitialState();

        // Assert
        expect(success).toBe(false);

        // --- Verify Core State NOT Set (or rolled back) ---
        // Player/Location set initially, but rolled back
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(mockLocationEntity);
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(null);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(null);
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledTimes(2);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledTimes(2);


        // --- Verify Attempt to Add Component ---
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
            mockPlayerEntity.id,
            POSITION_COMPONENT_ID,
            { locationId: mockLocationEntity.id, x: 0, y: 0 }
        );
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);

        // --- Verify Dispatch: Allow lifecycle events, forbid room_entered ---
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:started', {}, { allowSchemaNotFound: true }
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:game_state_initializer:failed',
            expect.objectContaining({ error: expectedErrorMsg }), // Check correct error in payload
            { allowSchemaNotFound: true }
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'event:room_entered', expect.anything(), expect.anything()
        );

        // --- Verify Logging ---
        // Expect TWO error calls: Specific addComponent failure, and the generic catch-all
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        // 1. Specific log for the addComponent failure path (logged *with* original error)
        expect(mockLogger.error).toHaveBeenCalledWith(
            `GameStateInitializer: Failed to add/update position component via EntityManager for player '${mockPlayerEntity.id}' in location '${mockLocationEntity.id}': ${addCompError.message}`,
            addCompError // Check the specific error was logged
        );
        // 2. The error message logged by the *outer* catch block (logged *with* the re-thrown error)
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error) // The error caught will contain the expectedErrorMsg
        );
        // Check rollback warning
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Rolled back GameStateManager state'));
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);


        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched')); // 'event:room_entered' dispatch log
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });
});