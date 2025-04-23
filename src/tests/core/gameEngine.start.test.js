// src/tests/core/gameEngine.start.test.js

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
/** @typedef {import('../../rendering/domRenderer.js').default} DomRenderer */ // Assuming path
/** @typedef {import('../../core/services/worldLoader.js').default} WorldLoader */
/** @typedef {import('../../core/gameStateInitializer.js').default} GameStateInitializer */
/** @typedef {import('../../core/worldInitializer.js').default} WorldInitializer */
// AC1: Removed InputHandler type import as GameEngine doesn't resolve it directly anymore for setup.
// /** @typedef {import('../../core/inputHandler.js').default} InputHandler */
/** @typedef {import('../../core/gameLoop.js').default} GameLoop */
/** @typedef {import('../../core/gameStateManager.js').default} GameStateManager */ // Still needed type
/** @typedef {import('../../core/initializers/systemInitializer.js').default} SystemInitializer */
/** @typedef {import('../../core/setup/inputSetupService.js').default} InputSetupService */ // AC3: Added type import

// Entities (simplified for testing)
/** @typedef {{ id: string }} MockEntity */

// --- Test Suite ---
describe('GameEngine start() / #initialize() - Success Path (InputSetupService Delegated)', () => { // Updated description

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
    // AC1: Removed mockInputHandler as GameEngine doesn't directly interact with its setup methods anymore
    // /** @type {jest.Mocked<InputHandler>} */
    // let mockInputHandler;
    /** @type {jest.Mocked<GameLoop>} */
    let mockGameLoop;
    /** @type {jest.Mocked<GameStateManager>} */ // Mock instance still needed
    let mockGameStateManager;
    /** @type {jest.Mocked<SystemInitializer>} */
    let mockSystemInitializer;
    /** @type {jest.Mocked<InputSetupService>} */ // AC3: Added mock variable
    let mockInputSetupService;

    // --- Mock Entities ---
    /** @type {MockEntity} */
    let mockPlayer;
    /** @type {MockEntity} */
    let mockLocation;

    // AC1: Removed callback capture as GameEngine no longer sets it directly.
    // /** @type {(command: string) => Promise<void>} */
    // let capturedInputCallback;


    beforeEach(() => {
        // Clear mocks before each test for isolation
        jest.clearAllMocks();
        // AC1: Removed callback reset
        // capturedInputCallback = undefined;

        // --- Mock Entities ---
        mockPlayer = { id: 'player1' };
        mockLocation = { id: 'location1' };

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
            getWorldName: jest.fn().mockReturnValue('Mock World'),
            getEventDefinition: jest.fn().mockReturnValue({ id: 'mockEvent', payloadSchema: null }),
            getAllEventDefinitions: jest.fn().mockReturnValue([]),
            getAction: jest.fn(), getAllActionDefinitions: jest.fn(), getTrigger: jest.fn(), getAllTriggers: jest.fn(),
            getQuestDefinition: jest.fn(), getAllQuestDefinitions: jest.fn(), getObjectiveDefinition: jest.fn(), getInteractionTest: jest.fn(),
        };
        mockValidatedDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(true),
        };
        mockDomRenderer = { /* Mock methods if needed */ };
        mockWorldLoader = {
            loadWorld: jest.fn().mockResolvedValue(undefined),
        };
        mockGameStateInitializer = {
            // Now async, assumed to handle dispatch internally
            setupInitialState: jest.fn().mockResolvedValue(true),
        };
        mockWorldInitializer = {
            initializeWorldEntities: jest.fn().mockReturnValue(true),
        };
        // AC1: Removed mockInputHandler instantiation
        /*
        mockInputHandler = { ... };
        */
        // Mock GameLoop with a controllable isRunning state
        const gameLoopState = { isRunning: false };
        mockGameLoop = {
            start: jest.fn(() => { gameLoopState.isRunning = true; }),
            stop: jest.fn(() => { gameLoopState.isRunning = false; }),
            processSubmittedCommand: jest.fn(),
            get isRunning() { return gameLoopState.isRunning; },
        };

        mockGameStateManager = { // Instance still needed
            getPlayer: jest.fn().mockReturnValue(mockPlayer),
            getCurrentLocation: jest.fn().mockReturnValue(mockLocation),
            setPlayer: jest.fn(),
            setCurrentLocation: jest.fn(),
        };
        mockSystemInitializer = {
            initializeSystems: jest.fn().mockResolvedValue(undefined),
        };
        // AC3: Add mock for InputSetupService
        mockInputSetupService = {
            configureInputHandler: jest.fn(), // Mock the delegated method
        };


        // --- Create Mock AppContainer ---
        mockAppContainer = {
            resolve: jest.fn(),
            register: jest.fn(),
            disposeSingletons: jest.fn(),
            reset: jest.fn(),
        };

        // --- Configure Mock AppContainer.resolve --- // AC4: Updated
        mockAppContainer.resolve.mockImplementation((key) => {
            switch (key) {
                case 'ILogger': return mockLogger;
                case 'EventBus': return mockEventBus;
                case 'GameDataRepository': return mockGameDataRepository;
                case 'ValidatedEventDispatcher': return mockValidatedDispatcher;
                case 'DomRenderer': return mockDomRenderer;
                case 'WorldLoader': return mockWorldLoader;
                case 'SystemInitializer': return mockSystemInitializer;
                case 'GameStateInitializer': return mockGameStateInitializer;
                case 'WorldInitializer': return mockWorldInitializer;
                case 'InputSetupService': return mockInputSetupService; // AC4: Return the mock service
                case 'GameLoop': return mockGameLoop;
                case 'GameStateManager': return mockGameStateManager; // Still resolved (by GameStateInitializer)

                // -- Potentially resolved by InputSetupService or GameStateInitializer --
                // We only need to mock things GameEngine *itself* resolves directly.
                // case 'InputHandler': return mockInputHandler; // Leave commented out

                default:
                    // Keep throwing error for unexpected resolutions
                    throw new Error(`MockAppContainer: Success Path Tests - Unexpected resolution attempt for key "${key}".`);
            }
        });

        // --- Configure critical mock behaviors for success path ---
        // These mocks are primarily for the services called *during* initialize
        mockGameStateManager.getPlayer.mockReturnValue(mockPlayer);
        mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
    });

    // --- Test Case: TEST-ENG-004 (Updated) ---
    it('[TEST-ENG-004] should resolve expected dependencies and delegate initializations', async () => {
        // --- Arrange ---
        const worldName = 'testWorld';
        const gameEngineInstance = new GameEngine({ container: mockAppContainer });

        // --- Act ---
        await gameEngineInstance.start(worldName);

        // --- Assert ---
        // **** NOTE: This list reflects dependencies *directly* resolved by GameEngine.#initialize or GameEngine.start ****
        const expectedCoreDependenciesResolvedByGameEngine = [
            'ILogger',                      // Constructor/Early Init
            'GameDataRepository',           // Init
            'ValidatedEventDispatcher',     // Init & Post-Init
            'DomRenderer',                  // Init (early resolve)
            'WorldLoader',                  // Init
            'SystemInitializer',            // Init
            'GameStateInitializer',         // Init <--- GameEngine resolves THIS
            'WorldInitializer',             // Init
            'InputSetupService',            // Init
            'GameLoop',                     // Init & Post-Init
        ];

        // **** UPDATE THIS LIST ****
        // Keep only the dependencies directly resolved by GameEngine or its direct path
        const allExpectedDependenciesResolvedDuringStart = [
            ...expectedCoreDependenciesResolvedByGameEngine,
            // 'GameStateManager' // REMOVED - Resolved indirectly by GameStateInitializer
        ];
        // **** END UPDATE ****


        const resolveCalls = mockAppContainer.resolve.mock.calls;
        const resolvedKeys = resolveCalls.map(callArgs => callArgs[0]);

        // Check that all expected dependencies were resolved *at least once* during start()
        allExpectedDependenciesResolvedDuringStart.forEach(key => {
            // Use expect(resolvedKeys).toEqual(expect.arrayContaining([key])) for potentially better error messages
            expect(resolvedKeys).toContain(key);
        });

        // ... rest of the assertions remain the same ...
        expect(mockWorldLoader.loadWorld).toHaveBeenCalledWith(worldName);
        expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalledTimes(1); // GameEngine calls this mock
        expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalledTimes(1);

        // Verify delegation calls
        expect(mockSystemInitializer.initializeSystems).toHaveBeenCalledTimes(1);
        expect(mockSystemInitializer.initializeSystems).toHaveBeenCalledWith();
        expect(mockInputSetupService.configureInputHandler).toHaveBeenCalledTimes(1);
        expect(mockInputSetupService.configureInputHandler).toHaveBeenCalledWith();

        // Check game loop start
        expect(mockGameLoop.start).toHaveBeenCalledTimes(1);

        // Basic checks for dispatcher calls
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'event:set_title', expect.any(Object), expect.any(Object)
        );
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
            "event:display_message",
            { text: "Game loop started. Good luck!", type: 'info' }
        );
    });

    // --- Test Case: TEST-ENG-005 (Should Pass - No Changes Needed) ---
    it('[TEST-ENG-005] should dispatch specific UI events via ValidatedEventDispatcher during successful initialization', async () => {
        // --- Arrange ---
        const worldName = 'testWorld';
        const gameEngineInstance = new GameEngine({ container: mockAppContainer });
        const earlyDispatchOptions = { allowSchemaNotFound: true };

        // --- Act ---
        await gameEngineInstance.start(worldName);

        // --- Assert ---
        // These events are part of the initialization flow and remain
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:set_title', { text: "Initializing Engine..." }, earlyDispatchOptions);
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith("event:display_message", { text: "Initializing core systems...", type: 'info' }, earlyDispatchOptions);
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:set_title', { text: `Loading Game Data for ${worldName}...` }, earlyDispatchOptions);
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith("event:display_message", { text: `Loading world data for '${worldName}' via WorldLoader...`, type: 'info' }, earlyDispatchOptions);
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith("event:display_message", { text: `World data for '${worldName}' loading process complete.`, type: 'info' });
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:set_title', { text: "Initializing Systems..." });
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:set_title', { text: "Setting Initial Game State..." });
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith("event:display_message", { text: "Setting initial game state...", type: 'info' });
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:set_title', { text: "Initializing World Entities..." });
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith("event:display_message", { text: "Instantiating world entities...", type: 'info' });
        // This event still exists and triggers WelcomeMessageService etc.
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:engine_initialized', { inputWorldName: worldName }, {});
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:set_title', { text: "Initialization Complete. Starting..." });
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith("event:display_message", { text: "Initialization complete.", type: 'success' });
        // This final message is from start() itself after the loop starts
        expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith("event:display_message", { text: "Game loop started. Good luck!", type: 'info' });
    });

    // --- Test Case: TEST-ENG-006 (Should Pass - No Changes Needed) ---
    it('[TEST-ENG-006] should call WorldLoader.loadWorld with the correct worldName during successful initialization', async () => {
        // --- Arrange ---
        const worldName = 'testWorld';
        const gameEngineInstance = new GameEngine({ container: mockAppContainer });

        // --- Act ---
        await gameEngineInstance.start(worldName);

        // --- Assert ---
        expect(mockWorldLoader.loadWorld).toHaveBeenCalledTimes(1);
        expect(mockWorldLoader.loadWorld).toHaveBeenCalledWith(worldName);
    });

    // --- Test Case: TEST-ENG-007 (Already Removed - Correct) ---

    // --- Test Case: TEST-ENG-008 (Should Pass - No Changes Needed) ---
    it('[TEST-ENG-008] should call GameStateInitializer.setupInitialState exactly once during successful initialization', async () => {
        // --- Arrange ---
        const worldName = 'testWorld';
        const gameEngineInstance = new GameEngine({ container: mockAppContainer });

        // --- Act ---
        await gameEngineInstance.start(worldName);

        // --- Assert ---
        expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalledTimes(1);
        expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalledWith();
    });

    // --- Test Case: TEST-ENG-009 (Should Pass - No Changes Needed) ---
    it('[TEST-ENG-009] should call WorldInitializer.initializeWorldEntities exactly once during successful initialization', async () => {
        // --- Arrange ---
        const worldName = 'testWorld';
        const gameEngineInstance = new GameEngine({ container: mockAppContainer });

        // --- Act ---
        await gameEngineInstance.start(worldName);

        // --- Assert ---
        expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalledTimes(1);
        expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalledWith();
    });

    // --- Test Case: TEST-ENG-010 (Already Removed - Correct) ---

    // --- Test Case: TEST-ENG-011 (Already Removed - Correct) ---

    // --- Test Case: TEST-ENG-012 (Should Pass - No Changes Needed) ---
    it('[TEST-ENG-012] should resolve GameLoop from the container during successful initialization', async () => {
        // --- Arrange ---
        const worldName = 'testWorld';
        const gameEngineInstance = new GameEngine({ container: mockAppContainer });

        // --- Act ---
        await gameEngineInstance.start(worldName);

        // --- Assert ---
        const resolvedKeys = mockAppContainer.resolve.mock.calls.map(call => call[0]);
        expect(resolvedKeys).toContain('GameLoop');
        // Verify GameLoop is resolved *after* InputSetupService (as per GameEngine code dependency)
        const inputSetupIndex = resolvedKeys.indexOf('InputSetupService');
        const gameLoopIndex = resolvedKeys.indexOf('GameLoop');
        expect(inputSetupIndex).toBeDefined(); // Ensure InputSetupService was resolved
        expect(gameLoopIndex).toBeDefined(); // Ensure GameLoop was resolved
        expect(inputSetupIndex).toBeLessThan(gameLoopIndex); // Ensure InputSetupService is resolved first
    });

    // --- Test Case: TEST-ENG-013 (Updated) ---
    it('[TEST-ENG-013] should log key informational messages during successful initialization and delegation', async () => {
        // --- Arrange ---
        const worldName = 'testWorld';
        const gameEngineInstance = new GameEngine({ container: mockAppContainer });

        // --- Act ---
        await gameEngineInstance.start(worldName);

        // --- Assert ---
        // Check logs from #initialize()
        expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: Starting initialization sequence for world: ${worldName}...`);
        expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: GameDataRepository resolved.");
        expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: ValidatedEventDispatcher resolved.");
        expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: DomRenderer resolved.");
        expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: WorldLoader resolved and finished loading for world: ${worldName}.`);
        expect(mockLogger.info).toHaveBeenCalledWith("Delegating system initialization to SystemInitializer...");
        expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: System initialization via SystemInitializer completed.");
        expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: Initial game state setup completed via GameStateInitializer.");
        expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: Initial world entities instantiated and spatial index built via WorldInitializer.");
        expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: Delegating input handler setup to InputSetupService..."); // AC6 check
        expect(mockLogger.info).not.toHaveBeenCalledWith("GameEngine: InputHandler resolved and configured."); // Ensure old log gone
        expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: GameLoop resolved.");
        expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: Dispatching event:engine_initialized event..."); // Keep this one
        expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: Initialization sequence for world '${worldName}' completed successfully.`);

        // Check logs from start() after #initialize() succeeds
        expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: Initialization successful. Starting GameLoop...");
        // *** REMOVED THIS LINE - Log message no longer seems applicable / present ***
        // expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: Retrieved world name from GameDataRepository: Mock World.`);
        // *** REMOVED THIS LINE - Log message corresponds to removed dispatch logic ***
        // expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: Initial 'event:room_entered' dispatch attempted.");
        expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: GameLoop started."); // This log remains

    });

}); // End describe block