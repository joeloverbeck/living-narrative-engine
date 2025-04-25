// src/tests/core/gameEngine.start.postInit.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/appContainer.js'; // Needed for type checking and mock structure reference

// --- Type Imports for Mocks ---
// Core Services
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../rendering/domRenderer.js').default} DomRenderer */
/** @typedef {import('../../core/services/worldLoader.js').default} WorldLoader */
/** @typedef {import('../../core/gameStateInitializer.js').default} GameStateInitializer */
/** @typedef {import('../../core/worldInitializer.js').default} WorldInitializer */
// /** @typedef {import('../../core/inputHandler.js').default} InputHandler */ // No longer directly asserted in these tests (delegated)
/** @typedef {import('../../core/gameLoop.js').default} GameLoop */
/** @typedef {import('../../core/gameStateManager.js').default} GameStateManager */ // Still resolved during init, but not used directly by start post-init for dispatch
/** @typedef {import('../../core/initializers/systemInitializer.js').default} SystemInitializer */
// AC3: Add InputSetupService type import
/** @typedef {import('../../core/setup/inputSetupService.js').default} InputSetupService */

// Entities (simplified for testing)
/** @typedef {{ id: string }} MockEntity */

// --- Test Suite ---
// AC1: Identified test file
describe('GameEngine start() - Post-Initialization Success Logic', () => {

  // --- Mocks ---
  /** @type {jest.Mocked<AppContainer>} */
  let mockAppContainer;
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {jest.Mocked<EventBus>} */
  let mockEventBus;
  /** @type {jest.Mocked<GameDataRepository>} */
  let mockGameDataRepository;
  /** @type {jest.Mocked<ValidatedEventDispatcher>} */
  let mockValidatedDispatcher;
  /** @type {jest.Mocked<DomRenderer>} */
  let mockDomRenderer;
  /** @type {jest.Mocked<WorldLoader>} */
  let mockWorldLoader;
  /** @type {jest.Mocked<GameStateInitializer>} */
  let mockGameStateInitializer;
  /** @type {jest.Mocked<WorldInitializer>} */
  let mockWorldInitializer;
  // InputHandler mock still needed if GameEngine *could* resolve it elsewhere, but direct setup assertions removed
  /** @type {jest.Mocked<import('../../core/inputHandler.js').default>} */ // Explicit import for clarity
  let mockInputHandler;
  /** @type {jest.Mocked<GameLoop>} */
  let mockGameLoop;
  /** @type {jest.Mocked<GameStateManager>} */ // Mock remains needed as GameStateInitializer uses it during init
  let mockGameStateManager;
  /** @type {jest.Mocked<SystemInitializer>} */
  let mockSystemInitializer;
  // AC3: Add mock variable for InputSetupService
  /** @type {jest.Mocked<InputSetupService>} */
  let mockInputSetupService;

  // --- Mock Entities ---
  /** @type {MockEntity} */
  let mockPlayer;
  /** @type {MockEntity} */
  let mockLocation;

  // --- Shared Test Variables ---
  const inputWorldName = 'testInputWorld';

  // AC2: Located test setup
  beforeEach(() => {
    // Clear mocks before each test for isolation
    jest.clearAllMocks();

    // --- Mock Entities ---
    mockPlayer = { id: 'player123' };
    mockLocation = { id: 'loc_start' };

    // --- Create Mock Logger ---
    mockLogger = {
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    };

    // --- Create Mock Core Services ---
    mockEventBus = {
      subscribe: jest.fn(), unsubscribe: jest.fn(), dispatch: jest.fn(), listenerCount: jest.fn(),
    };
    mockGameDataRepository = {
      getStartingPlayerId: jest.fn().mockReturnValue(mockPlayer.id),
      getStartingLocationId: jest.fn().mockReturnValue(mockLocation.id),
      getEntityDefinition: jest.fn().mockImplementation((id) => ({ id, components: {} })),
      getAllEntityDefinitions: jest.fn().mockReturnValue([]),
      getAllLocationDefinitions: jest.fn().mockReturnValue([]),
      getAllItemDefinitions: jest.fn().mockReturnValue([]),
      getAllConnectionDefinitions: jest.fn().mockReturnValue([]),
      getAllBlockerDefinitions: jest.fn().mockReturnValue([]),
      getWorldName: jest.fn().mockReturnValue('DefaultMockWorldName'), // Needed for logging check
      getEventDefinition: jest.fn().mockReturnValue({ id: 'mockEvent', payloadSchema: null }),
      getAllEventDefinitions: jest.fn().mockReturnValue([]),
      getAction: jest.fn(), getAllActionDefinitions: jest.fn(), getTrigger: jest.fn(), getAllTriggers: jest.fn(),
      getQuestDefinition: jest.fn(), getAllQuestDefinitions: jest.fn(), getObjectiveDefinition: jest.fn(), getInteractionTest: jest.fn(),
    };
    mockValidatedDispatcher = {
      dispatchValidated: jest.fn().mockResolvedValue(true),
    };
    mockDomRenderer = { /* Minimal mock */ };
    mockWorldLoader = {
      loadWorld: jest.fn().mockResolvedValue(undefined), // Simulate success
    };
    mockGameStateInitializer = {
      // Simulate success, it's assumed GameStateInitializer now handles the room_entered dispatch internally
      setupInitialState: jest.fn().mockResolvedValue(true), // Now async
    };
    mockWorldInitializer = {
      initializeWorldEntities: jest.fn().mockReturnValue(true), // Simulate success
    };
    mockInputHandler = { // Still needed for resolution, just not for setup checks here
      setCommandCallback: jest.fn(),
      enable: jest.fn(), disable: jest.fn(), clear: jest.fn(),
    };
    mockGameLoop = {
      start: jest.fn(), stop: jest.fn(), processSubmittedCommand: jest.fn(), isRunning: false,
    };
    mockGameStateManager = { // Mock still needed as GameStateInitializer depends on it
      getPlayer: jest.fn().mockReturnValue(mockPlayer),
      getCurrentLocation: jest.fn().mockReturnValue(mockLocation),
      setPlayer: jest.fn(),
      setCurrentLocation: jest.fn(),
    };
    mockSystemInitializer = {
      initializeSystems: jest.fn().mockResolvedValue(undefined), // Simulate successful async initialization
    };
    // AC3: Create mock InputSetupService instance with a mocked method
    mockInputSetupService = {
      configureInputHandler: jest.fn(), // The method GameEngine will call
    };

    // --- Create Mock AppContainer ---
    mockAppContainer = {
      resolve: jest.fn(),
      register: jest.fn(),
      disposeSingletons: jest.fn(),
      reset: jest.fn(),
    };

    // --- Configure Mock AppContainer.resolve (Simulate resolution of needed dependencies) ---
    mockAppContainer.resolve.mockImplementation((key) => {
      // Core Services needed during init AND post-init checks/calls
      if (key === 'ILogger') return mockLogger;
      if (key === 'EventBus') return mockEventBus; // Potentially used by dispatcher/others
      if (key === 'GameDataRepository') return mockGameDataRepository;
      if (key === 'ValidatedEventDispatcher') return mockValidatedDispatcher;
      if (key === 'GameLoop') return mockGameLoop;
      if (key === 'GameStateManager') return mockGameStateManager; // Resolved by GameStateInitializer

      // Services primarily needed during init
      if (key === 'DomRenderer') return mockDomRenderer;
      if (key === 'WorldLoader') return mockWorldLoader;
      if (key === 'GameStateInitializer') return mockGameStateInitializer;
      if (key === 'WorldInitializer') return mockWorldInitializer;
      if (key === 'InputHandler') return mockInputHandler; // Resolved by InputSetupService internally
      if (key === 'SystemInitializer') return mockSystemInitializer;
      if (key === 'InputSetupService') return mockInputSetupService;

      // Default for unexpected resolutions in this context
      console.warn(`MockAppContainer (Post-Init Tests): Unexpected resolution attempt for key "${key}". Returning undefined.`);
      return undefined;
    });

    // Ensure mocks specific to new ACs are cleared
    mockInputSetupService.configureInputHandler.mockClear();
  });

  // --- Test Case: TEST-ENG-023 ---
  // REMOVED getWorldName specific welcome message logs, kept log related to retrieval for logging
  describe('[TEST-ENG-023] Logging & World Name Retrieval & Input Delegation', () => {
    it('should log successful init, delegate input setup', async () => {
      // --- Arrange ---
      const gameEngine = new GameEngine({ container: mockAppContainer });
      const mockRepoWorldName = 'RepoWorld';
      mockGameDataRepository.getWorldName.mockReturnValue(mockRepoWorldName);

      // Clear relevant mocks before Act
      mockLogger.info.mockClear();
      mockGameDataRepository.getWorldName.mockClear();
      mockSystemInitializer.initializeSystems.mockClear();
      mockInputSetupService.configureInputHandler.mockClear(); // Clear this specific mock too

      // --- Act ---
      await gameEngine.start(inputWorldName); // Let start run through the mocked successful init

      // --- Assert ---
      // Verify SystemInitializer was called during init
      expect(mockSystemInitializer.initializeSystems).toHaveBeenCalledTimes(1);

      // Verify delegation log and service call (happens during #initialize called by start)
      expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Delegating input handler setup to InputSetupService...');
      expect(mockInputSetupService.configureInputHandler).toHaveBeenCalledTimes(1);

      // Check post-init logs from start() method itself
      expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Initialization successful. Starting GameLoop...');

      // NOTE: getWorldName is NO LONGER called by start() itself post-init.
      expect(mockGameDataRepository.getWorldName).not.toHaveBeenCalled();

    });

    // Test remains valid for checking delegation even if world name retrieval is gone
    it('should log successful init, delegate input setup, even if repo.getWorldName would have returned null/undefined', async () => {
      // --- Arrange ---
      const gameEngine = new GameEngine({ container: mockAppContainer });
      mockGameDataRepository.getWorldName.mockReturnValue(null); // Simulate not found

      mockLogger.info.mockClear();
      mockGameDataRepository.getWorldName.mockClear();
      mockSystemInitializer.initializeSystems.mockClear();
      mockInputSetupService.configureInputHandler.mockClear();

      // --- Act ---
      await gameEngine.start(inputWorldName);

      // --- Assert ---
      expect(mockSystemInitializer.initializeSystems).toHaveBeenCalledTimes(1);

      // Verify delegation log and service call (happens during #initialize called by start)
      expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Delegating input handler setup to InputSetupService...');
      expect(mockInputSetupService.configureInputHandler).toHaveBeenCalledTimes(1);

      // Check post-init logs from start() method itself
      expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Initialization successful. Starting GameLoop...');
      // Verify repo was NOT called by start() post-init
      expect(mockGameDataRepository.getWorldName).not.toHaveBeenCalled();
    });
  });

  // --- Test Case: TEST-ENG-024 (REMOVED) ---
  // REASON: Verified welcome message dispatch logic no longer present in GameEngine.start.
  // describe('[TEST-ENG-024] Title/Welcome Dispatch (Repo Success)', () => { ... });

  // --- Test Case: TEST-ENG-025 (REMOVED) ---
  // REASON: Verified welcome message fallback dispatch logic no longer present in GameEngine.start.
  // describe('[TEST-ENG-025] Title/Welcome Dispatch (Repo Fallback)', () => { ... });

  // --- Test Case: TEST-ENG-026 ---
  // REVISED: Removed assertions about GameStateManager resolution/usage *by start()* post-init
  describe('[TEST-ENG-026] GameStateManager Interaction (Post-Init)', () => {
    it('should have completed initialization steps before checking post-init state', async () => {
      // --- Arrange ---
      const gameEngine = new GameEngine({ container: mockAppContainer });

      mockAppContainer.resolve.mockClear(); // Clear resolve calls from constructor/setup
      mockGameStateManager.getPlayer.mockClear();
      mockGameStateManager.getCurrentLocation.mockClear();
      mockSystemInitializer.initializeSystems.mockClear();
      mockInputSetupService.configureInputHandler.mockClear();


      // --- Act ---
      await gameEngine.start(inputWorldName);

      // --- Assert ---
      // Verify key initialization steps were called (implicitly required for post-init logic to run)
      expect(mockSystemInitializer.initializeSystems).toHaveBeenCalledTimes(1);
      expect(mockInputSetupService.configureInputHandler).toHaveBeenCalledTimes(1);
      expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalledTimes(1); // From initialize call

      // REMOVED Assertions:
      // GameEngine.start() no longer resolves GameStateManager or calls its methods
      // directly for the purpose of the initial room_entered dispatch post-initialization.
      // That responsibility is now within GameStateInitializer.setupInitialState.
      // expect(mockAppContainer.resolve).toHaveBeenCalledWith('GameStateManager'); // Removed
      // expect(mockGameStateManager.getPlayer).toHaveBeenCalledTimes(1); // Removed
      // expect(mockGameStateManager.getCurrentLocation).toHaveBeenCalledTimes(1); // Removed

      // Verify the state is such that the game loop *can* start (checked by other tests)
      expect(mockGameLoop.start).toHaveBeenCalled(); // From TEST-ENG-028 logic
    });
  });

  // --- Test Case: TEST-ENG-027 (REMOVED) ---
  // REASON: GameEngine.start() no longer dispatches event:room_entered.
  // describe('[TEST-ENG-027] event:room_entered Dispatch', () => { ... });

  // --- Test Case: TEST-ENG-028 ---
  // REMAINS VALID: Checks that start() calls gameLoop.start()
  describe('[TEST-ENG-028] GameLoop.start Call', () => {
    it('should call mockGameLoop.start exactly once', async () => {
      // --- Arrange ---
      const gameEngine = new GameEngine({ container: mockAppContainer });

      mockGameLoop.start.mockClear();
      mockSystemInitializer.initializeSystems.mockClear();
      mockInputSetupService.configureInputHandler.mockClear();

      // --- Act ---
      await gameEngine.start(inputWorldName);

      // --- Assert ---
      expect(mockSystemInitializer.initializeSystems).toHaveBeenCalledTimes(1);
      expect(mockInputSetupService.configureInputHandler).toHaveBeenCalledTimes(1);

      // Check call from start() method
      expect(mockGameLoop.start).toHaveBeenCalledTimes(1);
    });
  });

  // --- Test Case: TEST-ENG-029 ---
  // REMAINS VALID: Checks that start() dispatches the final "Game loop started" message
  describe('[TEST-ENG-029] Final Message Dispatch', () => {
    it('should dispatch the final "Game loop started" message', async () => {
      // --- Arrange ---
      const gameEngine = new GameEngine({ container: mockAppContainer });
      const expectedPayload = {
        text: 'Game loop started. Good luck!',
        type: 'info'
      };

      mockValidatedDispatcher.dispatchValidated.mockClear();
      mockSystemInitializer.initializeSystems.mockClear();
      mockInputSetupService.configureInputHandler.mockClear();

      // --- Act ---
      await gameEngine.start(inputWorldName);

      // --- Assert ---
      expect(mockSystemInitializer.initializeSystems).toHaveBeenCalledTimes(1);
      expect(mockInputSetupService.configureInputHandler).toHaveBeenCalledTimes(1);

      // Check if the specific final message was dispatched (from start() method)
      // This message IS still dispatched by start() after the loop starts.
      const dispatchCalls = mockValidatedDispatcher.dispatchValidated.mock.calls;
      const finalMessageCall = dispatchCalls.find(call =>
        call[0] === 'event:display_message' && call[1]?.text === expectedPayload.text && call[1]?.type === expectedPayload.type
      );
      expect(finalMessageCall).toBeDefined(); // Ensure the message was dispatched
    });
  });

  // AC7: Run Test Suite
  // To complete this step, you would run `npm test` (or your specific test command)
  // and verify that all tests in this file (and potentially other related files) pass.

}); // End describe block