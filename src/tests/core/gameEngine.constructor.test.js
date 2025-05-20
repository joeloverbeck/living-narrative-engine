// src/tests/core/gameEngine.constructor.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/config/appContainer.js'; // Needed for type checking and mock structure reference
import {tokens} from '../../core/config/tokens.js'; // Import tokens

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../services/playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../../services/gamePersistenceService.js').default} GamePersistenceService */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */


// --- Test Suite ---
describe('GameEngine Constructor', () => {

    /** @type {jest.Mocked<AppContainer>} */
    let mockAppContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<PlaytimeTracker>} */
    let mockPlaytimeTracker;
    /** @type {jest.Mocked<GamePersistenceService>} */
    let mockGamePersistenceService;
    /** @type {jest.Mocked<IDataRegistry>} */
    let mockDataRegistry;
    /** @type {jest.Mocked<EntityManager>} */
    let mockEntityManager;


    beforeEach(() => {
        jest.clearAllMocks();

        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        // Mock actual services resolved by constructor
        mockPlaytimeTracker = {start: jest.fn(), stop: jest.fn(), getTotalPlaytime: jest.fn(), reset: jest.fn()};
        mockGamePersistenceService = {saveGame: jest.fn(), loadGame: jest.fn()}; // Add methods if needed
        mockDataRegistry = {getEntityDefinition: jest.fn(), getLoadedModManifests: jest.fn()};
        mockEntityManager = {activeEntities: new Map(), getEntitiesWithComponent: jest.fn(), clearAll: jest.fn()};

        mockAppContainer = {
            resolve: jest.fn(),
            register: jest.fn(),
            disposeSingletons: jest.fn(),
            reset: jest.fn(),
        };

        // Updated mockImplementation to reflect actual constructor dependencies
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) return mockLogger;
            if (key === tokens.PlaytimeTracker) return mockPlaytimeTracker;
            if (key === tokens.GamePersistenceService) return mockGamePersistenceService;
            if (key === tokens.IDataRegistry) return mockDataRegistry;
            if (key === tokens.EntityManager) return mockEntityManager;
            // If a token is requested that isn't one of these, it might indicate an issue
            // or an unhandled dependency in the test setup.
            // For constructor tests, we primarily care about these 5.
            console.warn(`MockAppContainer (Constructor Test): Unexpected resolution for ${String(key)}`);
            return undefined;
        });
    });

    it('[TEST-ENG-001] should successfully instantiate and resolve its core dependencies', () => { // Updated test description
        let gameEngineInstance;
        let constructorError = null;
        try {
            gameEngineInstance = new GameEngine({container: mockAppContainer});
        } catch (error) {
            constructorError = error;
        }

        expect(constructorError).toBeNull(); // Should not throw if all critical dependencies are met
        expect(gameEngineInstance).toBeInstanceOf(GameEngine);

        // Constructor resolves 5 services
        expect(mockAppContainer.resolve).toHaveBeenCalledTimes(5);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.PlaytimeTracker);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.GamePersistenceService);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.IDataRegistry);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.EntityManager);

        // Check logger calls from successful instantiation
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine Constructor: GamePersistenceService resolved successfully.');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Instance created. Ready to start.');
        expect(mockLogger.info).toHaveBeenCalledTimes(2); // Adjust if more info logs are added for successful resolutions

        expect(mockLogger.warn).not.toHaveBeenCalled();
        // GameEngine constructor will throw if PlaytimeTracker or GamePersistenceService fails to resolve.
        // It only warns for IDataRegistry and EntityManager.
    });

    it('[TEST-ENG-003] should fall back to console logging if ILogger cannot be resolved, but still attempt to resolve other services', () => { // Updated test description
        const iLoggerResolutionError = new Error('Simulated ILogger resolution failure.');
        // GamePersistenceService is critical, so we'll let it resolve for this test,
        // but PlaytimeTracker is also critical. For this test, we are focusing on ILogger fallback.
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) {
                throw iLoggerResolutionError;
            }
            // These are critical and will throw if they fail, GameEngine handles this.
            // For this specific test, we assume they resolve, or the test would be about them.
            if (key === tokens.PlaytimeTracker) return mockPlaytimeTracker;
            if (key === tokens.GamePersistenceService) return mockGamePersistenceService;
            // These will only warn if they fail
            if (key === tokens.IDataRegistry) return mockDataRegistry;
            if (key === tokens.EntityManager) return mockEntityManager;
            return undefined;
        });

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {
        });
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        }); // GameEngine uses logger.error for critical fails

        let gameEngineInstance;
        let constructorError = null;

        try {
            gameEngineInstance = new GameEngine({container: mockAppContainer});
        } catch (error) {
            constructorError = error;
        }

        // Even if ILogger fails, the constructor might still throw if PlaytimeTracker or GamePersistenceService resolution fails *after* ILogger.
        // Given the current GameEngine code, if PlaytimeTracker resolves and GamePersistenceService resolves, it shouldn't throw.
        // The test name suggests it's about ILogger fallback, implying other criticals might succeed.
        expect(constructorError).toBeNull(); // Assuming PlaytimeTracker and GamePersistenceService DO resolve for this test.
        expect(gameEngineInstance).toBeInstanceOf(GameEngine);

        // All 5 services are still attempted to be resolved
        expect(mockAppContainer.resolve).toHaveBeenCalledTimes(5);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ILogger); // Attempted
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.PlaytimeTracker);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.GamePersistenceService);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.IDataRegistry);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.EntityManager);

        expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // For ILogger fallback
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'GameEngine Constructor: Could not resolve ILogger dependency. Falling back to console.',
            iLoggerResolutionError
        );

        // The internal #logger is now console, so console.info is called.
        // One for GamePersistenceService resolved, one for "Instance created".
        expect(consoleInfoSpy).toHaveBeenCalledTimes(2);
        expect(consoleInfoSpy).toHaveBeenCalledWith('GameEngine Constructor: GamePersistenceService resolved successfully.');
        expect(consoleInfoSpy).toHaveBeenCalledWith('GameEngine: Instance created. Ready to start.');

        // The actual mockLogger (if it existed) wouldn't be used.
        expect(mockLogger.info).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled(); // No other critical errors expected for *this* specific scenario

        consoleWarnSpy.mockRestore();
        consoleInfoSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    it('[TEST-ENG-002] should throw an error if container option is null', () => {
        const options = {container: null};
        const expectedErrorMessage = 'GameEngine requires a valid AppContainer instance.';
        // Spy on console.error to suppress it during this expected failure
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        expect(() => {
            new GameEngine(options);
        }).toThrow(new Error(expectedErrorMessage));
        expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMessage); // Check that GameEngine itself logged the error
        consoleErrorSpy.mockRestore();
    });

    it('[TEST-ENG-002] should throw an error if container option is missing or undefined', () => {
        const optionsMissing = {};
        const optionsUndefined = {container: undefined};
        const expectedErrorMessage = 'GameEngine requires a valid AppContainer instance.';
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });

        expect(() => {
            new GameEngine(optionsMissing);
        }).toThrow(new Error(expectedErrorMessage));
        expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMessage);
        consoleErrorSpy.mockClear(); // Clear for the next assertion

        expect(() => {
            new GameEngine(optionsUndefined);
        }).toThrow(new Error(expectedErrorMessage));
        expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMessage);
        consoleErrorSpy.mockRestore();
    });

});