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
// Updated to use IEntityManager for the type hint of the mock
/** @typedef {import('../../core/interfaces/IEntityManager.js').IEntityManager} IEntityManager */


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
    /** @type {jest.Mocked<IEntityManager>} */ // Updated mock type
    let mockEntityManager;


    beforeEach(() => {
        jest.clearAllMocks();

        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        mockPlaytimeTracker = {
            // Methods called by GameEngine constructor or its subsequent logic if successful
            getTotalPlaytime: jest.fn().mockReturnValue(0), // For potential future use
            reset: jest.fn(), // Called by startNewGame, not directly by constructor logic path shown
            startSession: jest.fn(), // Called by startNewGame
            endSessionAndAccumulate: jest.fn(), // Called by stop
            setAccumulatedPlaytime: jest.fn() // For potential future use
        };
        mockGamePersistenceService = {
            saveGame: jest.fn(),
            loadAndRestoreGame: jest.fn()
        };
        mockEntityManager = { // This mock will be returned for IEntityManager
            clearAll: jest.fn(), // Called by startNewGame, not directly by constructor logic path shown
            // Add any other methods if constructor were to use them post-resolution
            activeEntities: new Map(),
            getEntitiesWithComponent: jest.fn(),
            addComponent: jest.fn()
        };

        mockAppContainer = {
            resolve: jest.fn(),
            register: jest.fn(),
            disposeSingletons: jest.fn(),
            reset: jest.fn(),
        };

        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) return mockLogger;
            if (key === tokens.PlaytimeTracker) return mockPlaytimeTracker;
            if (key === tokens.GamePersistenceService) return mockGamePersistenceService;
            // VVVVVV MODIFIED VVVVVV
            if (key === tokens.IEntityManager) return mockEntityManager; // GameEngine constructor now asks for IEntityManager
            // ^^^^^^ MODIFIED ^^^^^^
            console.warn(`MockAppContainer (Constructor Test): Unexpected resolution attempt for token: ${String(key)}`);
            return undefined;
        });
    });

    it('[TEST-ENG-001] should successfully instantiate and resolve its core dependencies', () => {
        let gameEngineInstance;
        let constructorError = null;
        try {
            gameEngineInstance = new GameEngine({container: mockAppContainer});
        } catch (error) {
            constructorError = error;
        }

        expect(constructorError).toBeNull();
        expect(gameEngineInstance).toBeInstanceOf(GameEngine);

        expect(mockAppContainer.resolve).toHaveBeenCalledTimes(4); // ILogger, IEntityManager, PlaytimeTracker, GamePersistenceService
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.PlaytimeTracker);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.GamePersistenceService);
        // VVVVVV MODIFIED ASSERTION VVVVVV
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
        // ^^^^^^ MODIFIED ASSERTION ^^^^^^

        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine Constructor: GamePersistenceService resolved successfully.');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Instance created. Ready to start.');
        expect(mockLogger.info).toHaveBeenCalledTimes(2); // GPS success + Instance created

        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('[TEST-ENG-003] should fall back to console logging if ILogger cannot be resolved, but still attempt to resolve other services', () => {
        const iLoggerResolutionError = new Error('Simulated ILogger resolution failure.');
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) {
                throw iLoggerResolutionError;
            }
            if (key === tokens.PlaytimeTracker) return mockPlaytimeTracker;
            if (key === tokens.GamePersistenceService) return mockGamePersistenceService;
            // VVVVVV MODIFIED VVVVVV
            if (key === tokens.IEntityManager) return mockEntityManager; // Provide IEntityManager
            // ^^^^^^ MODIFIED ^^^^^^
            console.warn(`MockAppContainer (ILogger Fail Test): Unexpected resolution attempt for token: ${String(key)}`);
            return undefined;
        });

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {
        });
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        }); // For GameEngine's own error if deps fail

        let gameEngineInstance;
        let constructorError = null;

        try {
            gameEngineInstance = new GameEngine({container: mockAppContainer});
        } catch (error) {
            constructorError = error;
        }

        expect(constructorError).toBeNull(); // Because IEntityManager is now mocked, constructor should pass
        expect(gameEngineInstance).toBeInstanceOf(GameEngine);

        expect(mockAppContainer.resolve).toHaveBeenCalledTimes(4); // ILogger (attempted), IEntityManager, PlaytimeTracker, GamePersistenceService
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.PlaytimeTracker);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.GamePersistenceService);
        // VVVVVV MODIFIED ASSERTION VVVVVV
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
        // ^^^^^^ MODIFIED ASSERTION ^^^^^^

        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'GameEngine Constructor: Could not resolve ILogger. Falling back to console for initial error logging.',
            iLoggerResolutionError
        );

        expect(consoleInfoSpy).toHaveBeenCalledWith('GameEngine Constructor: GamePersistenceService resolved successfully.');
        expect(consoleInfoSpy).toHaveBeenCalledWith('GameEngine: Instance created. Ready to start.');
        expect(consoleInfoSpy).toHaveBeenCalledTimes(2);


        expect(mockLogger.info).not.toHaveBeenCalled(); // Original logger's methods shouldn't be called
        expect(mockLogger.warn).not.toHaveBeenCalled();
        // GameEngine's own logger.error (which would be console.error here) shouldn't be called for ILogger failure itself,
        // but would be for other critical deps if they failed (they don't in this specific test path now).
        expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('IEntityManager failed to resolve'));


        consoleWarnSpy.mockRestore();
        consoleInfoSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    it('[TEST-ENG-002] should throw an error if container option is null', () => {
        const options = {container: null};
        const expectedErrorMessage = 'GameEngine requires a valid AppContainer instance.';
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        expect(() => {
            new GameEngine(options);
        }).toThrow(new Error(expectedErrorMessage));
        expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMessage);
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
        consoleErrorSpy.mockClear();

        expect(() => {
            new GameEngine(optionsUndefined);
        }).toThrow(new Error(expectedErrorMessage));
        expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMessage);
        consoleErrorSpy.mockRestore();
    });

});