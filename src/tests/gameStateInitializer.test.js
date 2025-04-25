// src/tests/gameStateInitializer.test.js

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import GameStateInitializer from '../core/gameStateInitializer.js'; // Adjust path if needed
import { POSITION_COMPONENT_ID } from '../types/components.js'; // Adjust path if needed

// --- Mocks for Dependencies ---

// Mock EntityManager
const mockEntityManager = {
  createEntityInstance: jest.fn(),
  addComponent: jest.fn(), // Added for the case where position component needs adding
  // We don't need getEntityInstance or removeEntityInstance for *these* specific tests
};

// Mock GameStateManager
const mockGameStateManager = {
  setPlayer: jest.fn(),
  setCurrentLocation: jest.fn(),
  // getPlayer/getCurrentLocation aren't called by the initializer itself
};

// Mock GameDataRepository
const mockGameDataRepository = {
  getEntityDefinition: jest.fn(),
  getStartingPlayerId: jest.fn(),
  getStartingLocationId: jest.fn(),
};

// Mock ValidatedEventDispatcher
const mockValidatedDispatcher = {
  dispatchValidated: jest.fn(), // This will be our spy
};

// Mock ILogger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};

// --- Mock Entities and Components ---

// Mock Location Entity (simple)
const mockLocationEntity = { id: 'location_mock' };

// Mock Position Component (needs setLocation method if player has it)
const mockPlayerPositionComponent = {
  setLocation: jest.fn(),
  // Add any other properties/methods if the component implementation or usage requires them
};

// Mock Player Entity
// Note: We need to mock getComponentData and potentially addComponent based on GameStateInitializer's logic
const mockPlayerEntity = {
  id: 'player_mock',
  // Simulate component storage. In a real Entity, this might be more complex.
  _components: new Map(), // Use a private-like convention for internal mock state

  // Mock getComponentData - called first to check for PositionComponent
  getComponentData: jest.fn((componentId) => {
    return mockPlayerEntity._components.get(componentId);
  }),

  // Mock addComponent - Not directly called on Entity in the provided code,
  // EntityManager.addComponent is called instead if getComponentData fails.
  // We won't mock this directly on the player entity for now.

  // Helper to set up which components the mock player "has" for a test
  _setComponent: (componentId, componentInstance) => {
    mockPlayerEntity._components.set(componentId, componentInstance);
  },

  // Helper to clear mocks and internal state for the entity mock
  _clearMocksAndState: () => {
    mockPlayerEntity.getComponentData.mockClear();
    mockPlayerEntity._components.clear();
    // Clear mocks on associated component mocks if necessary
    mockPlayerPositionComponent.setLocation.mockClear();
  }
};


// --- Test Suite ---
describe('GameStateInitializer', () => {
  const START_PLAYER_ID = 'test:player_start';
  const START_LOC_ID = 'test:location_start';
  let initializer;

  beforeEach(() => {
    // Reset all framework mocks and mock state before each test
    jest.clearAllMocks();
    mockPlayerEntity._clearMocksAndState(); // Clear player entity specific state/mocks

    // --- Configure Default Mock Return Values (Success Path) ---

    // GameDataRepository provides starting IDs
    mockGameDataRepository.getStartingPlayerId.mockReturnValue(START_PLAYER_ID);
    mockGameDataRepository.getStartingLocationId.mockReturnValue(START_LOC_ID);

    // GameDataRepository provides valid entity definitions
    mockGameDataRepository.getEntityDefinition.mockImplementation((id) => {
      if (id === START_PLAYER_ID || id === START_LOC_ID) {
        return { id: id, components: {} }; // Return a minimal valid definition
      }
      return undefined;
    });

    // EntityManager returns our mock entities when requested
    mockEntityManager.createEntityInstance.mockImplementation((id) => {
      if (id === START_PLAYER_ID) return mockPlayerEntity;
      if (id === START_LOC_ID) return mockLocationEntity;
      return null;
    });

    // EntityManager.addComponent succeeds by default (for the add component test path)
    mockEntityManager.addComponent.mockResolvedValue(undefined); // Simulate async success

    // Player entity "has" the position component by default in most success cases
    // We pass the *mock* component instance here
    mockPlayerEntity._setComponent(POSITION_COMPONENT_ID, mockPlayerPositionComponent);

    // Instantiate the service (System Under Test) with all mocks
    initializer = new GameStateInitializer({
      entityManager: mockEntityManager,
      gameStateManager: mockGameStateManager,
      gameDataRepository: mockGameDataRepository,
      validatedDispatcher: mockValidatedDispatcher, // Inject dispatcher mock
      logger: mockLogger, // Inject logger mock
    });

    // Verify constructor logging (optional but good)
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('GameStateInitializer: Instance created'));
    mockLogger.info.mockClear(); // Clear constructor log call for cleaner test assertions
  });

  // --- Test Success Case ---
  it('should setup state, dispatch event:room_entered, and log success', async () => {
    // Arrange: Default setup in beforeEach is sufficient for this success case
    // (Player has PositionComponent)

    // Act
    const success = await initializer.setupInitialState();

    // Assert
    expect(success).toBe(true); // Expect setup to succeed

    // Verify GameState changes
    expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity);
    expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(mockLocationEntity);

    // Verify player positioning (existing component path)
    expect(mockPlayerEntity.getComponentData).toHaveBeenCalledWith(POSITION_COMPONENT_ID);
    expect(mockPlayerPositionComponent.setLocation).toHaveBeenCalledWith(mockLocationEntity.id, 0, 0);
    expect(mockEntityManager.addComponent).not.toHaveBeenCalled(); // Should not be called

    // **** Verify Dispatch ****
    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
      'event:room_entered', // Event Name
      { // Payload structure and content
        playerId: mockPlayerEntity.id,
        newLocationId: mockLocationEntity.id,
        previousLocationId: null
      },
      {} // Default options
    );

    // **** Verify Logging ****
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Setting up initial game state'));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Using startingPlayerId: ${START_PLAYER_ID}, startingLocationId: ${START_LOC_ID}`));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Player entity '${mockPlayerEntity.id}' created and set`));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting location '${mockLocationEntity.id}' created and set`));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Updated player's position data"));
    // Specific logs around dispatch
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Dispatching initial event:room_entered...'));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Dispatching event:room_entered for player ${mockPlayerEntity.id} entering location ${mockLocationEntity.id}...`));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully dispatched initial event:room_entered for player ${mockPlayerEntity.id}.`));
    // Final success log
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    expect(mockLogger.error).not.toHaveBeenCalled(); // No errors logged
  });

  it('should setup state, add PositionComponent if missing, dispatch event, and log success', async () => {
    // Arrange: Override default - player *does not* have PositionComponent initially
    mockPlayerEntity._components.delete(POSITION_COMPONENT_ID);
    // Ensure getComponentData reflects this
    mockPlayerEntity.getComponentData.mockImplementation((componentId) => {
      return mockPlayerEntity._components.get(componentId); // Will return undefined for Position
    });

    // Act
    const success = await initializer.setupInitialState();

    // Assert
    expect(success).toBe(true); // Expect setup to succeed

    // Verify GameState changes
    expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity);
    expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(mockLocationEntity);

    // Verify player positioning (add component path)
    expect(mockPlayerEntity.getComponentData).toHaveBeenCalledWith(POSITION_COMPONENT_ID); // Called, returned undefined
    expect(mockPlayerPositionComponent.setLocation).not.toHaveBeenCalled(); // Not called on the separate mock instance
    expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1); // EntityManager used to add
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
      mockPlayerEntity.id,
      POSITION_COMPONENT_ID,
      { locationId: mockLocationEntity.id, x: 0, y: 0 }
    );

    // **** Verify Dispatch (should still happen) ****
    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
      'event:room_entered',
      {
        playerId: mockPlayerEntity.id,
        newLocationId: mockLocationEntity.id,
        previousLocationId: null
      },
      {}
    );

    // **** Verify Logging ****
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Setting up initial game state'));
    // Check for the specific logs related to adding the component
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Player '${mockPlayerEntity.id}' missing position data or setLocation method. Attempting to add component.`));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Added position component via EntityManager to player '${mockPlayerEntity.id}'`));
    // Check dispatch logs still occurred
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Dispatching initial event:room_entered...'));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully dispatched initial event:room_entered for player ${mockPlayerEntity.id}.`));
    // Final success log
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
    expect(mockLogger.error).not.toHaveBeenCalled();
  });


  // --- Test Failure Cases ---

  it('should return false, log error, and NOT dispatch if startingPlayerId is missing', async () => {
    // Arrange: Configure repository mock to fail
    mockGameDataRepository.getStartingPlayerId.mockReturnValue(null);

    // Act
    const success = await initializer.setupInitialState();

    // Assert
    expect(success).toBe(false); // Expect setup to fail

    // **** Verify Dispatch NOT Called ****
    expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();

    // **** Verify Logging ****
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Setting up initial game state'));
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL ERROR'),
      expect.any(Error) // Check that an Error object was passed
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to retrieve startingPlayerId'),
      expect.any(Error)
    );
    // Ensure success/dispatch logs are NOT present
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
  });

  it('should return false, log error, and NOT dispatch if startingLocationId is missing', async () => {
    // Arrange: Configure repository mock to fail
    mockGameDataRepository.getStartingLocationId.mockReturnValue(null);

    // Act
    const success = await initializer.setupInitialState();

    // Assert
    expect(success).toBe(false); // Expect setup to fail

    // **** Verify Dispatch NOT Called ****
    expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();

    // **** Verify Logging ****
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Setting up initial game state'));
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL ERROR'),
      expect.any(Error)
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to retrieve startingLocationId'),
      expect.any(Error)
    );
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
  });


  it('should return false, log error, and NOT dispatch if player entity instantiation fails', async () => {
    // Arrange: Configure EntityManager mock to fail for player
    mockEntityManager.createEntityInstance.mockImplementation((id) => {
      if (id === START_PLAYER_ID) return null; // Fail player creation
      if (id === START_LOC_ID) return mockLocationEntity;
      return null;
    });

    // Act
    const success = await initializer.setupInitialState();

    // Assert
    expect(success).toBe(false); // Expect setup to fail
    expect(mockGameStateManager.setPlayer).not.toHaveBeenCalled(); // Player wasn't set

    // **** Verify Dispatch NOT Called ****
    expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();

    // **** Verify Logging ****
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Setting up initial game state'));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Using startingPlayerId: ${START_PLAYER_ID}, startingLocationId: ${START_LOC_ID}`));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Instantiating player entity '${START_PLAYER_ID}'...`));
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL ERROR'),
      expect.any(Error)
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(`Failed to instantiate player entity '${START_PLAYER_ID}'`),
      expect.any(Error)
    );
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
  });

  it('should return false, log error, and NOT dispatch if location entity instantiation fails', async () => {
    // Arrange: Configure EntityManager mock to fail for location
    mockEntityManager.createEntityInstance.mockImplementation((id) => {
      if (id === START_PLAYER_ID) return mockPlayerEntity;
      if (id === START_LOC_ID) return null; // Fail location creation
      return null;
    });

    // Act
    const success = await initializer.setupInitialState();

    // Assert
    expect(success).toBe(false); // Expect setup to fail
    expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity); // Player was set before failure
    expect(mockGameStateManager.setCurrentLocation).not.toHaveBeenCalled(); // Location wasn't set

    // **** Verify Dispatch NOT Called ****
    expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();

    // **** Verify Logging ****
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Player entity '${mockPlayerEntity.id}' created and set`));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Instantiating location entity '${START_LOC_ID}'...`));
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL ERROR'),
      expect.any(Error)
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(`Failed to instantiate starting location entity '${START_LOC_ID}'`),
      expect.any(Error)
    );
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
  });

  it('should return false, log error, and NOT dispatch if adding position component via EntityManager fails', async () => {
    // Arrange: Player doesn't have component, and EntityManager.addComponent throws error
    mockPlayerEntity._components.delete(POSITION_COMPONENT_ID);
    mockPlayerEntity.getComponentData.mockImplementation((componentId) => {
      return mockPlayerEntity._components.get(componentId);
    });
    const addCompError = new Error('EntityManager failed to add component');
    mockEntityManager.addComponent.mockRejectedValue(addCompError); // Simulate async failure

    // Act
    const success = await initializer.setupInitialState();

    // Assert
    expect(success).toBe(false); // Expect setup to fail

    // Player/Location setup likely happened
    expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity);
    expect(mockGameStateManager.setCurrentLocation).toHaveBeenCalledWith(mockLocationEntity);

    // Attempt to add component was made
    expect(mockEntityManager.addComponent).toHaveBeenCalledWith(mockPlayerEntity.id, POSITION_COMPONENT_ID, expect.any(Object));

    // **** Verify Dispatch NOT Called ****
    expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();

    // **** Verify Logging ****
    // Specific log for the addComponent failure path
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(`Failed to add position data via EntityManager to player '${mockPlayerEntity.id}'`),
      addCompError // Check the specific error was logged
    );
    // The outer catch block log
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(`CRITICAL ERROR during initial game state setup: Could not set player's initial position in ${mockLocationEntity.id}`),
      expect.any(Error) // The error caught will be the one wrapping the addCompError
    );
    // Should be 2 error calls total in this specific failure
    expect(mockLogger.error).toHaveBeenCalledTimes(2);

    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('setupInitialState method completed successfully'));
  });

  // Add more specific failure tests if needed (e.g., definition checks fail)
  it('should return false, log error, and NOT dispatch if player definition is missing', async () => {
    // Arrange: Configure repository mock to fail definition lookup
    mockGameDataRepository.getEntityDefinition.mockImplementation((id) => {
      if (id === START_LOC_ID) return { id: id, components: {} };
      return undefined; // Player definition missing
    });

    // Act
    const success = await initializer.setupInitialState();

    // Assert
    expect(success).toBe(false); // Expect setup to fail
    expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalled(); // Shouldn't try to create entities

    // **** Verify Dispatch NOT Called ****
    expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();

    // **** Verify Logging ****
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL ERROR'),
      expect.any(Error)
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(`Player definition '${START_PLAYER_ID}' (from manifest) not found`),
      expect.any(Error)
    );
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
  });

  it('should return false, log error, and NOT dispatch if location definition is missing', async () => {
    // Arrange: Configure repository mock to fail definition lookup for location
    mockGameDataRepository.getEntityDefinition.mockImplementation((id) => {
      if (id === START_PLAYER_ID) return { id: id, components: {} };
      return undefined; // Location definition missing
    });

    // Act
    const success = await initializer.setupInitialState();

    // Assert
    expect(success).toBe(false); // Expect setup to fail
    expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(START_PLAYER_ID); // Player created
    expect(mockGameStateManager.setPlayer).toHaveBeenCalledWith(mockPlayerEntity); // Player set
    expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalledWith(START_LOC_ID); // Location not created

    // **** Verify Dispatch NOT Called ****
    expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();

    // **** Verify Logging ****
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL ERROR'),
      expect.any(Error)
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(`Starting location definition '${START_LOC_ID}' (from manifest) not found`),
      expect.any(Error)
    );
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully dispatched'));
  });

});