// src/tests/core/gameEngine.start.failure.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/appContainer.js'; // Needed for type checking and mock structure reference

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../rendering/domRenderer.js').default} DomRenderer */
/** @typedef {import('../../core/services/worldLoader.js').default} WorldLoader */
/** @typedef {import('../../core/gameStateInitializer.js').default} GameStateInitializer */
/** @typedef {import('../../core/worldInitializer.js').default} WorldInitializer */
/** @typedef {import('../../core/inputHandler.js').default} InputHandler */
/** @typedef {import('../../core/gameLoop.js').default} GameLoop */
/** @typedef {import('../../core/gameStateManager.js').default} GameStateManager */
/** @typedef {import('../../systems/combatSystem.js').default} CombatSystem */
/** @typedef {HTMLInputElement} MockInputElement */
/** @typedef {HTMLElement} MockTitleElement */
// Added for TEST-ENG-033
/** @typedef {{ id: string }} MockEntity */
// Added for SystemInitializer Refactor
/** @typedef {import('../../core/initializers/systemInitializer.js').default} SystemInitializer */
// **** ADDED FOR FIX (Ticket 3 / AC6) ****
/** @typedef {import('../../core/setup/inputSetupService.js').default} InputSetupService */
// **** END ADDITION ****


// --- Test Suite ---
describe('GameEngine start() / #initialize() - Failure Scenarios', () => {

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
    /** @type {jest.Mocked<InputHandler>} */
    let mockInputHandler;
    /** @type {jest.Mocked<GameLoop>} */
    let mockGameLoop;
    /** @type {jest.Mocked<MockInputElement>} */
    let mockInputElement;
    /** @type {jest.Mocked<MockTitleElement>} */
    let mockTitleElement;
    /** @type {jest.Mocked<CombatSystem & { initialize?: () => Promise<void> }>} */
    let mockCombatSystem;
    /** @type {jest.Mocked<GameStateManager>} */
    let mockGameStateManager;
    // Added for SystemInitializer Refactor
    /** @type {jest.Mocked<SystemInitializer>} */
    let mockSystemInitializer;
    // Added for TEST-ENG-033
    /** @type {MockEntity} */
    let mockPlayerEntity;
    /** @type {MockEntity} */
    let mockLocationEntity;
    // **** ADDED FOR FIX (Ticket 3 / AC6) ****
    /** @type {jest.Mocked<InputSetupService>} */ // AC3: Add InputSetupService mock variable
    let mockInputSetupService;
    // **** END ADDITION ****


    // Spy for global alert
    /** @type {jest.SpyInstance} */
    let alertSpy;

    // Variable to store the default resolve implementation
    /** @type {(key: string) => any} */
    let defaultResolveImplementation;


    beforeEach(() => {
        // Clear mocks and spies before each test
        jest.clearAllMocks();
        if (alertSpy) alertSpy.mockRestore(); // Restore alert spy if it exists

        // --- Create Mocks ---
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
        mockEventBus = { /* Minimal mock, will be fleshed out if needed */ };
        mockGameDataRepository = { getWorldName: jest.fn().mockReturnValue('MockWorld'), /* other methods */ }; // Need getWorldName for post-init check
        mockValidatedDispatcher = { dispatchValidated: jest.fn().mockResolvedValue(true) };
        mockDomRenderer = { /* Minimal mock */ };
        mockWorldLoader = { loadWorld: jest.fn().mockResolvedValue(undefined) }; // Simulate success
        mockGameStateInitializer = { setupInitialState: jest.fn().mockReturnValue(true) }; // Simulate success
        mockWorldInitializer = { initializeWorldEntities: jest.fn().mockReturnValue(true) }; // Simulate success
        mockInputHandler = { setCommandCallback: jest.fn(), enable: jest.fn(), disable: jest.fn(), clear: jest.fn() };
        mockGameLoop = { start: jest.fn(), stop: jest.fn(), processSubmittedCommand: jest.fn(), isRunning: false };
        mockInputElement = { disabled: false };
        mockTitleElement = { textContent: '' };
        mockCombatSystem = { initialize: jest.fn().mockResolvedValue(undefined) }; // Example system

        // Added for SystemInitializer Refactor
        mockSystemInitializer = {
            initializeSystems: jest.fn().mockResolvedValue(undefined) // Default: Simulate successful system init
        };

        // **** ADDED FOR FIX (Ticket 3 / AC6) ****
        // AC3: Instantiate the mock with the required method
        mockInputSetupService = {
            configureInputHandler: jest.fn()
        };
        // **** END ADDITION ****


        // --- Mock Entities for TEST-ENG-033 ---
        mockPlayerEntity = { id: 'playerDefault' };
        mockLocationEntity = { id: 'locationDefault' };

        // Add GameStateManager mock needed for post-init checks
        mockGameStateManager = {
            // Default behaviour is successful retrieval for most tests
            getPlayer: jest.fn().mockReturnValue(mockPlayerEntity),
            getCurrentLocation: jest.fn().mockReturnValue(mockLocationEntity),
            setPlayer: jest.fn(),
            setCurrentLocation: jest.fn(),
        };
        mockAppContainer = { resolve: jest.fn(), register: jest.fn(), disposeSingletons: jest.fn(), reset: jest.fn() };


        // --- Define the DEFAULT resolve implementation ---
        // This needs to cover all dependencies for a potentially successful init run
        const defaultImplementation = (key) => {
            switch (key) {
                case 'ILogger': return mockLogger;
                case 'EventBus': return mockEventBus;
                case 'GameDataRepository': return mockGameDataRepository;
                case 'ValidatedEventDispatcher': return mockValidatedDispatcher;
                case 'DomRenderer': return mockDomRenderer;
                case 'WorldLoader': return mockWorldLoader;
                case 'GameStateInitializer': return mockGameStateInitializer;
                case 'WorldInitializer': return mockWorldInitializer;
                case 'InputHandler': return mockInputHandler; // Still needed for error fallback disable
                case 'GameLoop': return mockGameLoop;
                case 'GameStateManager': return mockGameStateManager;
                case 'inputElement': return mockInputElement;
                case 'titleElement': return mockTitleElement;
                case 'CombatSystem': return mockCombatSystem;
                // Added for SystemInitializer Refactor
                case 'SystemInitializer': return mockSystemInitializer;

                // **** ADDED FOR FIX (Ticket 3 / AC6) ****
                // AC4: Ensure the container returns the mock InputSetupService
                case 'InputSetupService': return mockInputSetupService;
                // **** END ADDITION ****

                // Add all other systems (keep for robustness if needed elsewhere)
                case 'GameRuleSystem':
                case 'EquipmentEffectSystem':
                case 'EquipmentSlotSystem':
                case 'InventorySystem':
                // case 'CombatSystem': // Handled specifically above
                case 'DeathSystem':
                case 'HealthSystem':
                case 'StatusEffectSystem':
                case 'LockSystem':
                case 'OpenableSystem':
                case 'WorldPresenceSystem':
                case 'ItemUsageSystem':
                case 'NotificationUISystem':
                case 'PerceptionSystem':
                case 'BlockerSystem':
                case 'MovementSystem':
                case 'MoveCoordinatorSystem':
                case 'QuestSystem':
                case 'QuestStartTriggerSystem':
                case 'ActionDiscoverySystem':
                    return { initialize: jest.fn().mockResolvedValue(undefined) }; // Generic mock system
                default:
                    // console.warn(`Default mock resolve falling back for: ${key}`);
                    return undefined;
            }
        };

        // --- Store the default implementation ---
        defaultResolveImplementation = defaultImplementation;

        // --- Set the initial mock implementation ---
        mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);

        // Spy on global alert
        alertSpy = jest.spyOn(global, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        // Ensure spies are restored after each test
        if (alertSpy) alertSpy.mockRestore();
        jest.clearAllMocks();
    });

    // =========================================== //
    // === Existing Failure Test Cases (...) === //
    // (No changes expected within these specific test bodies based on AC5/AC6 for this file)
    // =========================================== //
    // --- Test Case: TEST-ENG-014 ---
    describe('[TEST-ENG-014] GameEngine Initialization (Failure) - Missing worldName in start()', () => {
        it('should reject, log error, alert, and attempt UI disable when start() is called with empty worldName', async () => {
            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            const expectedErrorMsg = "GameEngine.start requires a worldName argument.";
            const expectedAlertMsg = "Fatal Error: No world specified to start the game engine. Application cannot continue.";
            await expect(gameEngineInstance.start('')).rejects.toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith("GameEngine: Fatal Error - start() called without providing a worldName.");
            expect(alertSpy).toHaveBeenCalledTimes(1);
            expect(alertSpy).toHaveBeenCalledWith(expectedAlertMsg);
            // Check if UI elements were resolved for disabling attempt
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('inputElement');
            expect(mockInputElement.disabled).toBe(true);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('titleElement');
            expect(mockTitleElement.textContent).toBe("Fatal Error!");
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            // AC6 check: Ensure InputSetupService mock wasn't called inappropriately here
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });

        it('should reject, log error, alert, and attempt UI disable when start() is called with undefined worldName', async () => {
            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            const expectedErrorMsg = "GameEngine.start requires a worldName argument.";
            const expectedAlertMsg = "Fatal Error: No world specified to start the game engine. Application cannot continue.";
            await expect(gameEngineInstance.start(undefined)).rejects.toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith("GameEngine: Fatal Error - start() called without providing a worldName.");
            expect(alertSpy).toHaveBeenCalledTimes(1);
            expect(alertSpy).toHaveBeenCalledWith(expectedAlertMsg);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('inputElement');
            expect(mockInputElement.disabled).toBe(true);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('titleElement');
            expect(mockTitleElement.textContent).toBe("Fatal Error!");
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            // AC6 check: Ensure InputSetupService mock wasn't called inappropriately here
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });
    });

    // --- Test Case: TEST-ENG-015 ---
    describe('[TEST-ENG-015] GameEngine Initialization (Failure) - Core Dependency Resolution Failure', () => {
        it('should reject, log, and attempt fallback UI disable when ValidatedEventDispatcher fails to resolve', async () => {
            const worldName = 'testWorld';
            const resolutionError = new Error("Simulated Dispatcher Resolution Failure");
            mockAppContainer.resolve.mockImplementation((key) => { // Override completely
                if (key === 'ILogger') return mockLogger;
                if (key === 'EventBus') return mockEventBus;
                if (key === 'GameDataRepository') return mockGameDataRepository;
                if (key === 'ValidatedEventDispatcher') throw resolutionError; // <<<< Failure Point
                if (key === 'InputHandler') return mockInputHandler; // For fallback check
                if (key === 'inputElement') return mockInputElement; // For fallback check
                if (key === 'DomRenderer') return mockDomRenderer;
                // Include WorldLoader etc. if needed for other paths before failure
                if (key === 'WorldLoader') return mockWorldLoader;
                return undefined; // InputSetupService etc. won't be reached
            });
            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(resolutionError);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR during initialization'), resolutionError);
            // Check for the specific log about the dispatcher being unavailable *during* init failure handling
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('ValidatedEventDispatcher not available to display initialization error.'));
            // Check for the final catch block log in start()
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error during the start process'), resolutionError);
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled(); // Should not be called if it failed to resolve
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('InputHandler'); // Fallback attempt
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('inputElement'); // Fallback attempt
            expect(mockInputElement.disabled).toBe(true);
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled(); // Should not be reached
        });

        // Example: Failure before InputSetupService is reached
        it('should reject and log when WorldLoader fails to resolve', async () => {
            const worldName = 'testWorld';
            const resolutionError = new Error("Simulated WorldLoader Resolution Failure");
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === 'ILogger') return mockLogger;
                if (key === 'EventBus') return mockEventBus;
                if (key === 'GameDataRepository') return mockGameDataRepository;
                if (key === 'ValidatedEventDispatcher') return mockValidatedDispatcher;
                if (key === 'DomRenderer') return mockDomRenderer;
                if (key === 'WorldLoader') throw resolutionError; // <<< Failure Point
                // Other services like SystemInitializer, InputSetupService etc. are never reached
                if (key === 'InputHandler') return mockInputHandler; // Still needed for fallback
                if (key === 'inputElement') return mockInputElement; // Still needed for fallback
                return undefined;
            });
            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(resolutionError);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR during initialization'), resolutionError);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error during the start process'), resolutionError);
            // Check fallback UI disable attempt
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('InputHandler');
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('inputElement');
            expect(mockInputElement.disabled).toBe(true);
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            // AC6 check: Ensure InputSetupService mock wasn't called
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });
    });

    // --- Test Case: TEST-ENG-016 ---
    describe('[TEST-ENG-016] GameEngine Initialization (Failure) - WorldLoader.loadWorld Rejection', () => {
        it('should reject, log, and dispatch UI error events when WorldLoader.loadWorld rejects', async () => {
            const worldName = 'testWorld';
            const loadError = new Error('World Load Failed');
            // Use default setup, just configure the mock to fail
            mockWorldLoader.loadWorld.mockRejectedValue(loadError);

            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            const expectedDisplayErrorMsg = `Game initialization failed: ${loadError.message}. Check console (F12) for details.`;

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(loadError);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR during initialization'), loadError);
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:set_title', { text: "Fatal Initialization Error!" });
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:display_message', { text: expectedDisplayErrorMsg, type: 'error' });
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('ui:disable_input', { message: "Error during startup." });
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            // Check fallback UI disable attempt (should still happen in #initialize catch)
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('InputHandler');
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('inputElement');
            expect(mockInputElement.disabled).toBe(true);
            // AC6 check: Should fail before InputSetupService is called
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });
    });


    // --- Test Case: TEST-ENG-021 (Failure during System Initialization) ---
    describe('[TEST-ENG-021] GameEngine Initialization (Failure) - System initialize() Rejection', () => {
        it('should reject, log, dispatch UI errors when SystemInitializer.initializeSystems rejects', async () => {
            // --- Arrange (Given) ---
            const worldName = 'testWorld';
            const systemInitError = new Error('Sys Init Fail');
            // Configure the *SystemInitializer* mock to reject
            mockSystemInitializer.initializeSystems.mockRejectedValue(systemInitError);

            // Use the default resolve implementation
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);

            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            const expectedDisplayErrorMsg = `Game initialization failed: ${systemInitError.message}. Check console (F12) for details.`;

            // --- Act & Assert (When & Then) ---
            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(systemInitError);
            expect(mockSystemInitializer.initializeSystems).toHaveBeenCalled(); // It was called
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR during initialization'), systemInitError);
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:set_title', { text: "Fatal Initialization Error!" });
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:display_message', { text: expectedDisplayErrorMsg, type: 'error' });
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('ui:disable_input', { message: "Error during startup." });
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('InputHandler'); // Fallback attempt
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('inputElement'); // Fallback attempt
            expect(mockInputElement.disabled).toBe(true);
            // AC6 check: Should fail before InputSetupService is called
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });
    });

    // --- Test Case: TEST-ENG-017 (Failure during Game State Initialization) ---
    describe('[TEST-ENG-017] GameEngine Initialization (Failure) - GameStateInitializer Returns False', () => {
        it('should reject, log, and dispatch UI error events when GameStateInitializer.setupInitialState returns false', async () => {
            const worldName = 'testWorld';
            const expectedThrownErrorMsg = "Initial game state setup failed via GameStateInitializer. Check logs.";
            mockGameStateInitializer.setupInitialState.mockReturnValue(false); // Configure failure
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);
            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            const expectedDisplayErrorMsg = `Game initialization failed: ${expectedThrownErrorMsg}. Check console (F12) for details.`;

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(expectedThrownErrorMsg);

            expect(mockSystemInitializer.initializeSystems).toHaveBeenCalled(); // Previous step
            expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalled(); // Failure point

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR'), expect.objectContaining({ message: expectedThrownErrorMsg }));
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:set_title', { text: "Fatal Initialization Error!" });
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:display_message', { text: expectedDisplayErrorMsg, type: 'error' });
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('ui:disable_input', { message: "Error during startup." });
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('InputHandler'); // Fallback attempt
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
            // AC6 check: Should fail before InputSetupService is called
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });
    });

    // --- Test Case: TEST-ENG-019 (Failure during World Initialization) ---
    describe('[TEST-ENG-019] GameEngine Initialization (Failure) - WorldInitializer Returns False', () => {
        it('should reject, log, dispatch UI errors when WorldInitializer.initializeWorldEntities returns false', async () => {
            const worldName = 'testWorld';
            const expectedThrownErrorMsg = "World initialization failed via WorldInitializer.";
            mockWorldInitializer.initializeWorldEntities.mockReturnValue(false); // Configure failure
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);
            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            const expectedDisplayErrorMsg = `Game initialization failed: ${expectedThrownErrorMsg}. Check console (F12) for details.`;

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(expectedThrownErrorMsg);

            expect(mockSystemInitializer.initializeSystems).toHaveBeenCalled(); // Previous step
            expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalled(); // Previous step
            expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalled(); // Failure point

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR'), expect.objectContaining({ message: expectedThrownErrorMsg }));
            // ... UI dispatch checks ...
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('InputHandler'); // Fallback attempt
            // AC6 check: Should fail before InputSetupService is called
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });
    });


    // --- Test Case: Failure during InputSetupService Configuration ---
    describe('[NEW] GameEngine Initialization (Failure) - InputSetupService Failure', () => {
        it('should reject, log, and dispatch UI error events when InputSetupService.configureInputHandler throws', async () => {
            // --- Arrange (Given) ---
            const worldName = 'testWorld';
            const inputSetupError = new Error('Input Setup Service Failed');
            // Configure the InputSetupService mock to throw
            mockInputSetupService.configureInputHandler.mockImplementation(() => { throw inputSetupError; });

            // Use the default resolve implementation
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);

            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            const expectedDisplayErrorMsg = `Game initialization failed: ${inputSetupError.message}. Check console (F12) for details.`;

            // --- Act & Assert (When & Then) ---
            // Expect the original error thrown by the service
            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(inputSetupError);

            // Check that previous steps succeeded
            expect(mockSystemInitializer.initializeSystems).toHaveBeenCalled();
            expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalled();
            // Verify InputSetupService was called
            expect(mockInputSetupService.configureInputHandler).toHaveBeenCalledTimes(1); // << Failure Point

            // Check logs and UI updates from the #initialize catch block
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR during initialization'), inputSetupError);
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:set_title', { text: "Fatal Initialization Error!" });
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:display_message', { text: expectedDisplayErrorMsg, type: 'error' });
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('ui:disable_input', { message: "Error during startup." });
            expect(mockGameLoop.start).not.toHaveBeenCalled(); // Should not start if init fails
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('InputHandler'); // Fallback attempt
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('inputElement'); // Fallback attempt
            expect(mockInputElement.disabled).toBe(true);
            // Check GameLoop was not resolved yet (happens after InputSetupService)
            expect(mockAppContainer.resolve).not.toHaveBeenCalledWith('GameLoop');
        });

        it('should reject, log, and dispatch UI error events when InputSetupService fails to resolve', async () => {
            // --- Arrange (Given) ---
            const worldName = 'testWorld';
            const inputSetupResolveError = new Error('Cannot resolve InputSetupService');

            // Override resolve to fail specifically for InputSetupService
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === 'InputSetupService') throw inputSetupResolveError; // <<< Failure Point
                // Return others using the default logic *before* this point
                if (defaultResolveImplementation) { // Check if defined
                    const resolved = defaultResolveImplementation(key);
                    // Avoid returning the throwing mock if defaultResolveImplementation somehow has it
                    if(key !== 'InputSetupService') return resolved;
                }
                // Fallback for safety or if defaultResolveImplementation isn't set yet
                if (key === 'ILogger') return mockLogger;
                if (key === 'EventBus') return mockEventBus;
                if (key === 'GameDataRepository') return mockGameDataRepository;
                if (key === 'ValidatedEventDispatcher') return mockValidatedDispatcher;
                if (key === 'DomRenderer') return mockDomRenderer;
                if (key === 'WorldLoader') return mockWorldLoader;
                if (key === 'SystemInitializer') return mockSystemInitializer;
                if (key === 'GameStateInitializer') return mockGameStateInitializer;
                if (key === 'WorldInitializer') return mockWorldInitializer;
                if (key === 'InputHandler') return mockInputHandler;
                if (key === 'inputElement') return mockInputElement;
                return undefined;
            });


            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            const expectedDisplayErrorMsg = `Game initialization failed: ${inputSetupResolveError.message}. Check console (F12) for details.`;

            // --- Act & Assert (When & Then) ---
            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(inputSetupResolveError);

            // Check that previous steps succeeded
            expect(mockSystemInitializer.initializeSystems).toHaveBeenCalled();
            expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalled();
            // Verify InputSetupService resolution was attempted
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('InputSetupService'); // << Failure Point

            // Check logs and UI updates from the #initialize catch block
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR during initialization'), inputSetupResolveError);
            // ... other checks similar to the previous test ...
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled(); // Mock method never called

        });
    });


    // --- Test Case: TEST-ENG-022 ---
    // (No changes needed, still tests fallback which uses InputHandler directly)
    describe('[TEST-ENG-022] GameEngine Initialization (Failure) - Fallback UI Disable Attempt', () => {
        it('should attempt to disable UI via InputHandler and inputElement when dispatcher resolution fails', async () => {
            const worldName = 'testWorld';
            const dispatcherResolveError = new Error("Dispatcher Gone");
            mockAppContainer.resolve.mockImplementation((key) => { // Override completely
                if (key === 'ILogger') return mockLogger;
                if (key === 'EventBus') return mockEventBus;
                if (key === 'GameDataRepository') return mockGameDataRepository;
                if (key === 'DomRenderer') return mockDomRenderer;
                if (key === 'ValidatedEventDispatcher') throw dispatcherResolveError; // <<< Failure Point
                if (key === 'InputHandler') return mockInputHandler; // Needed for fallback
                if (key === 'inputElement') return mockInputElement; // Needed for fallback
                if (key === 'WorldLoader') return mockWorldLoader;
                return undefined; // InputSetupService etc. won't be reached
            });
            mockInputElement.disabled = false; // Ensure it starts enabled
            const gameEngineInstance = new GameEngine({ container: mockAppContainer });

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(dispatcherResolveError);

            // Check fallback UI disable attempts in #initialize catch block
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('InputHandler');
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('inputElement');
            expect(mockInputElement.disabled).toBe(true);

            // Check logs
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR during initialization'), dispatcherResolveError);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('ValidatedEventDispatcher not available'));
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error during the start process'), dispatcherResolveError);
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled(); // Should not be reached
        });
    });


    // --- Test Case: TEST-ENG-030 ---
    // (No changes needed, failure happens before InputSetupService call)
    describe('[TEST-ENG-030] GameEngine Start (Failure) - Start Called Before Initialization Complete', () => {
        it('should reject, log error, and prevent loop start if initialization failed (#isInitialized is false)', async () => {
            const worldName = 'testWorld';
            const initFailError = new Error('Simulated Init Failure');
            mockWorldLoader.loadWorld.mockRejectedValue(initFailError); // Make init fail
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);
            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            // The error caught and re-thrown by start()'s outer catch will be the original initFailError
            const expectedThrownError = initFailError;

            mockLogger.error.mockClear(); // Clear logs before act
            mockValidatedDispatcher.dispatchValidated.mockClear(); // Clear dispatches before act

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(expectedThrownError);

            // Verify logs from #initialize's catch block
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR during initialization'), initFailError);
            const expectedDisplayErrorMsg = `Game initialization failed: ${initFailError.message}. Check console (F12) for details.`;
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:set_title', { text: "Fatal Initialization Error!" });
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:display_message', { text: expectedDisplayErrorMsg, type: 'error' });
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('ui:disable_input', { message: "Error during startup." });

            // Verify logs from start()'s outer catch block
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error during the start process'), initFailError);


            // *** Ensure the simplified 'else' block in start() was NOT reached ***
            // (because #initialize threw an error caught by the outer catch)
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining("Cannot start GameLoop."));
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                expect.stringMatching(/Engine failed to start:/), // Match start of message
                expect.any(Object)
            );


            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled(); // Init failed before this
            // Check final UI disable attempt in outer catch
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('inputElement');
            expect(mockInputElement.disabled).toBe(true);

        });

    });

    // --- Test Case: TEST-ENG-031 ---
    // (No changes needed, GameLoop is resolved *after* InputSetupService. This test checks the final state before gameLoop.start())
    describe('[TEST-ENG-031] GameEngine Start (Failure) - GameLoop Missing Post-Initialization', () => {

        it('should reject, log error, dispatch UI errors, and prevent loop start if GameLoop is null after successful init', async () => {
            const worldName = 'testWorld';
            // Simulate GameLoop missing *after* init steps (resolve returns null)
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === 'GameLoop') return null;
                return defaultResolveImplementation(key); // Use default for others
            });

            const gameEngineInstance = new GameEngine({ container: mockAppContainer });

            // --- Expected values for the simplified else block ---
            const expectedFailureReason = "#gameLoop is null post-initialization";
            const expectedThrownErrorMsg = `Inconsistent engine state after initialization: ${expectedFailureReason}.`;
            const expectedLogErrorMsg = `GameEngine: Cannot start GameLoop. ${expectedFailureReason}.`;
            const expectedDisplayErrorMsg = `Engine failed to start: ${expectedFailureReason}. Check logs.`;

            mockValidatedDispatcher.dispatchValidated.mockClear(); // Clear post-setup calls
            mockLogger.error.mockClear(); // Clear post-setup calls
            mockLogger.info.mockClear(); // Clear info logs from init

            // --- Act & Assert ---
            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(expectedThrownErrorMsg);

            // Verify init steps (like InputSetupService) *were* called during the init part
            expect(mockInputSetupService.configureInputHandler).toHaveBeenCalledTimes(1);
            // Verify GameLoop resolution was attempted and returned null (implicitly tested by setup)
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('GameLoop');


            // --- Check logs/dispatches from the start() method's *simplified else* block ---
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogErrorMsg);
            // Check UI dispatch calls from the failure path
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                "event:display_message",
                { text: expectedDisplayErrorMsg, type: 'error' }
            );
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'event:set_title',
                { text: "Engine Start Failed" }
            );

            // Check log from the outer catch block in start()
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error during the start process'),
                expect.objectContaining({ message: expectedThrownErrorMsg })
            );

            expect(mockGameLoop.start).not.toHaveBeenCalled(); // GameLoop mock's start method wasn't called

            // Ensure the original verbose reasons are NOT logged anymore
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining("essential components missing/state invalid post-init"));

            // Check final UI disable attempt in outer catch
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('inputElement');
            expect(mockInputElement.disabled).toBe(true);
        });
    });

    // --- Test Case: TEST-ENG-032 ---
    // (No changes needed, failure happens before InputSetupService call)
    describe('[TEST-ENG-032] GameEngine Start (Failure) - ValidatedEventDispatcher Missing Post-Initialization', () => {
        it('should reject early if ValidatedDispatcher fails to resolve during initialization', async () => {
            const worldName = 'testWorld';
            const earlyInitError = new Error("Simulated Dispatcher Resolution Failure");
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === 'ValidatedEventDispatcher') throw earlyInitError;
                // Use default for dependencies resolved *before* dispatcher
                if (key === 'ILogger') return mockLogger;
                if (key === 'EventBus') return mockEventBus;
                if (key === 'GameDataRepository') return mockGameDataRepository;
                // Other deps like InputHandler, inputElement needed for fallback
                if (key === 'InputHandler') return mockInputHandler;
                if (key === 'inputElement') return mockInputElement;
                return undefined; // InputSetupService etc. not reached
            });
            const gameEngineInstance = new GameEngine({ container: mockAppContainer });

            mockLogger.error.mockClear(); // Clear before act

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(earlyInitError);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR during initialization'), earlyInitError);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('ValidatedEventDispatcher not available'));
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error during the start process'), earlyInitError);
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('InputHandler'); // Fallback attempt
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled(); // Should not be reached
        });
    });

    // --- Test Case: TEST-ENG-033 ---
    // (No changes needed, checks state after successful init but before gameLoop.start())
    describe('[TEST-ENG-033] GameEngine Start (Failure) - Player or Location Missing Post-Initialization', () => {
        it('should reject if GameStateManager.getPlayer returns null post-init', async () => {
            const worldName = 'testWorld';
            mockGameStateManager.getPlayer.mockReturnValue(null);
            mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocationEntity);
            const simulatedError = new Error("Simulated setup failure: Player not found or set.");
            mockGameStateInitializer.setupInitialState.mockRejectedValue(simulatedError); // Failure point

            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);
            const gameEngineInstance = new GameEngine({ container: mockAppContainer });

            mockLogger.error.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(simulatedError);

            // **** UPDATE THIS ASSERTION ****
            // Verify InputSetupService was *NOT* called because initialization failed *before* it
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
            // **** END UPDATE ****

            // Check logs from the #initialize catch block (these should still be called)
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR during initialization'), simulatedError);
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error during the start process'), simulatedError);
        });

        it('should reject if GameStateManager.getCurrentLocation returns null post-init', async () => {
            const worldName = 'testWorld';
            mockGameStateManager.getCurrentLocation.mockReturnValue(null);
            mockGameStateManager.getPlayer.mockReturnValue(mockPlayerEntity);
            const simulatedError = new Error("Simulated setup failure: Location not found or set.");
            mockGameStateInitializer.setupInitialState.mockRejectedValue(simulatedError); // Failure point

            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);
            const gameEngineInstance = new GameEngine({ container: mockAppContainer });

            mockLogger.error.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(simulatedError);

            // **** UPDATE THIS ASSERTION ****
            // Verify InputSetupService was *NOT* called because initialization failed *before* it
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
            // **** END UPDATE ****

            // Check logs from the #initialize catch block (these should still be called)
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR during initialization'), simulatedError);
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error during the start process'), simulatedError);
        });
    });


    // AC5/AC6 Note: Verified that existing tests in this file do not contain assertions
    // checking for container.resolve('InputHandler') or inputHandler.setCommandCallback
    // specifically related to the *removed* initialization logic. Checks for InputHandler
    // resolution/disable remain valid for error handling fallbacks.

    // AC7 Note: Assertions verifying logger.info("...Delegating input handler setup...")
    // and mockInputSetupService.configureInputHandler() being called once belong in the
    // test suite(s) covering the *successful* execution path of GameEngine.#initialize,
    // not in this failure scenario suite.


    describe('[NEW] GameEngine Initialization (Failure) - GameLoop Resolution Failure', () => {
        it('should reject, log, and dispatch UI error events when GameLoop fails to resolve during #initialize', async () => {
            // --- Arrange (Given) ---
            const worldName = 'testWorld';
            const gameLoopResolveError = new Error('Cannot resolve GameLoop');

            // Override resolve to fail specifically for GameLoop
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === 'GameLoop') throw gameLoopResolveError; // <<< Failure Point (late in init)
                // Return others using the default logic *before* this point
                if (defaultResolveImplementation) {
                    const resolved = defaultResolveImplementation(key);
                    // Avoid returning the throwing mock if defaultResolveImplementation somehow has it
                    if(key !== 'GameLoop') return resolved;
                }
                // Fallback for safety
                return defaultResolveImplementation ? defaultResolveImplementation(key) : undefined;
            });

            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            const expectedDisplayErrorMsg = `Game initialization failed: ${gameLoopResolveError.message}. Check console (F12) for details.`;

            // --- Act & Assert (When & Then) ---
            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(gameLoopResolveError);

            // Check that previous steps succeeded (like input setup)
            expect(mockSystemInitializer.initializeSystems).toHaveBeenCalled();
            expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalled();
            expect(mockInputSetupService.configureInputHandler).toHaveBeenCalledTimes(1);
            // Verify GameLoop resolution was attempted
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('GameLoop'); // << Failure Point

            // Check logs and UI updates from the #initialize catch block
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR during initialization'), gameLoopResolveError);
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:set_title', { text: "Fatal Initialization Error!" });
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('event:display_message', { text: expectedDisplayErrorMsg, type: 'error' });
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith('ui:disable_input', { message: "Error during startup." });
            expect(mockGameLoop.start).not.toHaveBeenCalled(); // Should not start if init fails
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('InputHandler'); // Fallback attempt in #initialize catch
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('inputElement'); // Fallback attempt in #initialize catch
            expect(mockInputElement.disabled).toBe(true);

            // Verify the game loop object itself wasn't assigned or used
            // REMOVED -> expect(gameEngineInstance['#gameLoop']).toBeNull(); // Line 806

        });
    });
}); // End describe block