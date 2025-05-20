// src/tests/core/gameEngine.constructor.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/config/appContainer.js'; // Needed for type checking and mock structure reference
import {tokens} from '../../core/config/tokens.js'; // Import tokens

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
// Mock types for other services resolved in constructor
/** @typedef {import('../../core/interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */


// --- Test Suite ---
describe('GameEngine Constructor', () => {

    /** @type {jest.Mocked<AppContainer>} */
    let mockAppContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    // Mocks for other services that GameEngine constructor tries to resolve
    /** @type {jest.Mocked<ISaveLoadService>} */
    let mockSaveLoadService;
    /** @type {jest.Mocked<IDataRegistry>} */
    let mockDataRegistry;
    /** @type {jest.Mocked<EntityManager>} */
    let mockEntityManager;


    beforeEach(() => {
        jest.clearAllMocks();

        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        mockSaveLoadService = {saveManualGame: jest.fn(), listManualSaveSlots: jest.fn()};
        mockDataRegistry = {getEntityDefinition: jest.fn(), getLoadedModManifests: jest.fn()};
        mockEntityManager = {activeEntities: new Map(), getEntitiesWithComponent: jest.fn()};

        mockAppContainer = {
            resolve: jest.fn(),
            register: jest.fn(),
            disposeSingletons: jest.fn(),
            reset: jest.fn(),
        };

        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) return mockLogger;
            if (key === tokens.ISaveLoadService) return mockSaveLoadService;
            if (key === tokens.IDataRegistry) return mockDataRegistry;
            if (key === tokens.EntityManager) return mockEntityManager;
            return undefined;
        });
    });

    it('[TEST-ENG-001] should successfully instantiate and resolve ILogger', () => {
        const gameEngineInstance = new GameEngine({container: mockAppContainer});

        expect(gameEngineInstance).toBeInstanceOf(GameEngine);

        expect(mockAppContainer.resolve).toHaveBeenCalledTimes(4);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ISaveLoadService);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.IDataRegistry);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.EntityManager);

        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Instance created. Ready to start.');

        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('[TEST-ENG-003] should fall back to console logging if ILogger cannot be resolved', () => {
        const resolutionError = new Error('Simulated ILogger resolution failure.');
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) {
                throw resolutionError;
            }
            if (key === tokens.ISaveLoadService) return mockSaveLoadService;
            if (key === tokens.IDataRegistry) return mockDataRegistry;
            if (key === tokens.EntityManager) return mockEntityManager;
            return undefined;
        });

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {
        });

        let gameEngineInstance;
        let constructorError = null;

        try {
            gameEngineInstance = new GameEngine({container: mockAppContainer});
        } catch (error) {
            constructorError = error;
        }

        expect(constructorError).toBeNull();
        expect(gameEngineInstance).toBeInstanceOf(GameEngine);

        expect(mockAppContainer.resolve).toHaveBeenCalledTimes(4);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ISaveLoadService);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.IDataRegistry);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.EntityManager);

        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'GameEngine Constructor: Could not resolve ILogger dependency. Falling back to console.', // <<< CORRECTED MESSAGE
            resolutionError
        );

        expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
        expect(consoleInfoSpy).toHaveBeenCalledWith('GameEngine: Instance created. Ready to start.');

        expect(mockLogger.info).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();

        consoleWarnSpy.mockRestore();
        consoleInfoSpy.mockRestore();
    });

    it('[TEST-ENG-002] should throw an error if container option is null', () => {
        const options = {container: null};
        const expectedErrorMessage = 'GameEngine requires a valid AppContainer instance.';
        expect(() => {
            new GameEngine(options);
        }).toThrow(new Error(expectedErrorMessage));
    });

    it('[TEST-ENG-002] should throw an error if container option is missing or undefined', () => {
        const optionsMissing = {};
        const optionsUndefined = {container: undefined};
        const expectedErrorMessage = 'GameEngine requires a valid AppContainer instance.';
        expect(() => {
            new GameEngine(optionsMissing);
        }).toThrow(new Error(expectedErrorMessage));
        expect(() => {
            new GameEngine(optionsUndefined);
        }).toThrow(new Error(expectedErrorMessage));
    });

});