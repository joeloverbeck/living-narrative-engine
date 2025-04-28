// src/tests/gameStateInitializer.test.js

import {jest, describe, it, expect, beforeEach} from '@jest/globals';
import GameStateInitializer from '../core/gameStateInitializer.js';
import {PLAYER_COMPONENT_ID, POSITION_COMPONENT_ID} from "../types/components.js"; // Adjust path if needed

// --- Mocks for Dependencies ---

// Mock EntityManager
const mockEntityManager = {
    createEntityInstance: jest.fn(),
    addComponent: jest.fn(),
};

// Mock GameStateManager
const mockGameStateManager = {
    setPlayer: jest.fn(),
    setCurrentLocation: jest.fn(),
};

// Mock GameDataRepository
const mockGameDataRepository = {
    getEntityDefinition: jest.fn(),
    getStartingPlayerId: jest.fn(),
    getStartingLocationId: jest.fn(),
};

// Mock ValidatedEventDispatcher
const mockvalidatedEventDispatcher = {
    dispatchValidated: jest.fn(),
};

// Mock ILogger
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
};

// --- Mock Entities and Components ---

const mockLocationEntity = {id: 'location_mock'};

const mockPlayerPositionComponent = {
    setLocation: jest.fn(),
};

const mockPlayerEntity = {
    id: 'player_mock',
    _components: new Map(),
    _componentDefinitions: new Map(),
    hasComponent: jest.fn((componentId) => {
        return componentId === PLAYER_COMPONENT_ID;
    }),
    getComponentData: jest.fn((componentId) => {
        return mockPlayerEntity._components.get(componentId);
    }),
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
        mockPlayerEntity.hasComponent.mockImplementation((componentId) => componentId === PLAYER_COMPONENT_ID);
        mockPlayerPositionComponent.setLocation.mockClear();
    }
};


// --- Test Suite ---
describe('GameStateInitializer', () => {
    const START_PLAYER_ID = 'test:player_start';
    const START_LOC_ID = 'test:location_start';
    let initializer;

    beforeEach(() => {
        jest.clearAllMocks();
        mockPlayerEntity._clearMocksAndState();

        mockGameDataRepository.getStartingPlayerId.mockReturnValue(START_PLAYER_ID);
        mockGameDataRepository.getStartingLocationId.mockReturnValue(START_LOC_ID);

        mockGameDataRepository.getEntityDefinition.mockImplementation((id) => {
            if (id === START_PLAYER_ID || id === START_LOC_ID) {
                return {id: id, components: {[PLAYER_COMPONENT_ID]: {}}};
            }
            return undefined;
        });

        mockEntityManager.createEntityInstance.mockImplementation((id) => {
            if (id === START_PLAYER_ID) {
                return mockPlayerEntity;
            }
            if (id === START_LOC_ID) return mockLocationEntity;
            return null;
        });

        mockEntityManager.addComponent.mockResolvedValue(undefined);
        mockvalidatedEventDispatcher.dispatchValidated.mockResolvedValue(undefined);

        initializer = new GameStateInitializer({
            entityManager: mockEntityManager,
            gameStateManager: mockGameStateManager,
            gameDataRepository: mockGameDataRepository,
            validatedEventDispatcher: mockvalidatedEventDispatcher,
            logger: mockLogger,
        });

        mockLogger.info.mockClear();
    });

    // --- Test Success Case ---
    it('should setup state, set position via EntityManager, dispatch event:room_entered, and log success', async () => {
        const success = await initializer.setupInitialState();

        expect(success).toBe(true);
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(mockLocationEntity);
        expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(START_PLAYER_ID);
        expect(mockPlayerEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
            mockPlayerEntity.id,
            POSITION_COMPONENT_ID,
            {locationId: mockLocationEntity.id, x: 0, y: 0}
        );
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'event:room_entered',
            {playerId: mockPlayerEntity.id, newLocationId: mockLocationEntity.id, previousLocationId: null},
            {allowSchemaNotFound: true}
        );
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Setting up initial game state'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Retrieved startingPlayerId: ${START_PLAYER_ID}, startingLocationId: ${START_LOC_ID}`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully instantiated player entity: ${mockPlayerEntity.id}`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully instantiated starting location entity: ${mockLocationEntity.id}`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Player '${mockPlayerEntity.id}' and Location '${mockLocationEntity.id}' set in GameStateManager`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Ensuring player '${mockPlayerEntity.id}' is positioned in starting location '${mockLocationEntity.id}'`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully set/updated position component for player '${mockPlayerEntity.id}' to location '${mockLocationEntity.id}' via EntityManager`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Dispatching initial event:room_entered for player ${mockPlayerEntity.id} entering location ${mockLocationEntity.id}...`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully dispatched initial event:room_entered for player ${mockPlayerEntity.id}.`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining(`lacks the '${PLAYER_COMPONENT_ID}' component`));
    });

    // --- Test Warning Case ---
    it('should log a warning if the instantiated player lacks the player component', async () => {
        mockPlayerEntity.hasComponent.mockReturnValue(false);

        const success = await initializer.setupInitialState();

        expect(success).toBe(true);
        expect(mockPlayerEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Instantiated entity '${mockPlayerEntity.id}' designated as starting player, but it lacks the '${PLAYER_COMPONENT_ID}' component.`)
        );
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
        expect(mockLogger.error).not.toHaveBeenCalled();
    });


    // --- Test Failure Cases ---

    it('should return false, log errors, and NOT dispatch if startingPlayerId is missing', async () => {
        mockGameDataRepository.getStartingPlayerId.mockReturnValue(null);
        const expectedErrorMsg = "Missing starting player ID in game data.";

        const success = await initializer.setupInitialState();

        expect(success).toBe(false);
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Setting up initial game state'));
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        expect(mockLogger.error).toHaveBeenCalledWith(
            "GameStateInitializer: Failed to retrieve starting player ID from the repository/manifest. Cannot initialize game state."
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error)
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Rolled back GameStateManager state'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });

    it('should return false, log errors, and NOT dispatch if startingLocationId is missing', async () => {
        mockGameDataRepository.getStartingLocationId.mockReturnValue(null);
        const expectedErrorMsg = "Missing starting location ID in game data.";

        const success = await initializer.setupInitialState();

        expect(success).toBe(false);
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Setting up initial game state'));
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        expect(mockLogger.error).toHaveBeenCalledWith(
            "GameStateInitializer: Failed to retrieve starting location ID from the repository/manifest. Cannot initialize game state."
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error)
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Rolled back GameStateManager state'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });


    it('should return false, log errors, and NOT dispatch if player entity instantiation fails', async () => {
        mockEntityManager.createEntityInstance.mockImplementation((id) => {
            if (id === START_PLAYER_ID) return null;
            if (id === START_LOC_ID) return mockLocationEntity;
            return null;
        });
        const expectedErrorMsg = `Failed to instantiate starting player entity '${START_PLAYER_ID}'.`;

        const success = await initializer.setupInitialState();

        expect(success).toBe(false);
        expect(mockGameStateManager.setPlayer).not.toHaveBeenCalledWith(mockPlayerEntity);
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Setting up initial game state'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Retrieved startingPlayerId: ${START_PLAYER_ID}, startingLocationId: ${START_LOC_ID}`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Instantiating starting player entity with ID: ${START_PLAYER_ID}...`));
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        expect(mockLogger.error).toHaveBeenCalledWith(
            `GameStateInitializer: EntityManager failed to create instance for starting player ID: ${START_PLAYER_ID}. Check if definition exists and is valid.`
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error)
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Rolled back GameStateManager state'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });

    it('should return false, log errors, and NOT dispatch if location entity instantiation fails', async () => {
        // Arrange: Configure EntityManager mock to fail for location
        mockEntityManager.createEntityInstance.mockImplementation((id) => {
            if (id === START_PLAYER_ID) return mockPlayerEntity;
            if (id === START_LOC_ID) return null; // Fail location creation
            return null;
        });
        const expectedErrorMsg = `Failed to instantiate starting location entity '${START_LOC_ID}'.`;

        // Act
        const success = await initializer.setupInitialState();

        // Assert
        expect(success).toBe(false); // Expect setup to fail

        // **** Corrected Assertion ****
        // Location wasn't successfully set with mockLocationEntity, but rollback sets it to null
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(null);
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledTimes(1); // Ensure it was only called during rollback

        // **** Verify Dispatch NOT Called ****
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();

        // **** Verify Logging ****
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully instantiated player entity: ${mockPlayerEntity.id}`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Instantiating starting location entity with ID: ${START_LOC_ID}...`));
        // **** Expect TWO error calls ****
        expect(mockLogger.error).toHaveBeenCalledTimes(2); // Corrected expectation
        // 1. Specific error (logged without error object)
        expect(mockLogger.error).toHaveBeenCalledWith(
            `GameStateInitializer: EntityManager failed to create instance for starting location ID: ${START_LOC_ID}. Check if definition exists and is valid.`
            // No second arg for this specific log in the code
        );
        // 2. Generic error (logged with error object)
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error)
        );
        // Check for rollback log (will have set player=null, location=null)
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Rolled back GameStateManager state'));

        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });

    it('should return false, log errors, and NOT dispatch if adding/updating position component via EntityManager fails', async () => {
        // Arrange: EntityManager.addComponent throws error
        const addCompError = new Error('EntityManager failed to add/update component');
        mockEntityManager.addComponent.mockRejectedValue(addCompError); // Simulate async failure
        const expectedErrorMsg = `Could not set player's initial position in starting location '${mockLocationEntity.id}'.`;

        // Act
        const success = await initializer.setupInitialState();

        // Assert
        expect(success).toBe(false); // Expect setup to fail

        // Player/Location setup likely happened before failure, but rollback clears them
        expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity); // Still check pre-rollback state here
        expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(mockLocationEntity); // Still check pre-rollback state here

        // Attempt to add component was made
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(mockPlayerEntity.id, POSITION_COMPONENT_ID, expect.any(Object));

        // **** Verify Dispatch NOT Called ****
        expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();

        // **** Verify Logging ****
        // Expect TWO error calls: Specific addComponent failure, and the generic catch-all for the re-thrown error
        expect(mockLogger.error).toHaveBeenCalledTimes(2);

        // 1. Specific log for the addComponent failure path (inside its own catch, logged with original error)
        expect(mockLogger.error).toHaveBeenCalledWith(
            `GameStateInitializer: Failed to add/update position component via EntityManager for player '${mockPlayerEntity.id}' in location '${mockLocationEntity.id}': ${addCompError.message}`,
            addCompError // Check the specific error was logged
        );
        // 2. The error message logged by the *outer* catch block (catches the re-thrown error)
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL ERROR during initial game state setup: ${expectedErrorMsg}`),
            expect.any(Error) // The error caught will be the re-thrown one wrapping the addCompError reason
        );

        // Check for rollback log
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Rolled back GameStateManager state'));

        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    });

});