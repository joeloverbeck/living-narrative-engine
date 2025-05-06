// src/tests/core/handlers/playerTurnHandler.dependencies.test.js
// --- FILE START ---

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjust path as needed

// --- Mock Dependencies ---
const createMockLogger = () => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
});

const createMockActionDiscoverySystem = () => ({
    getValidActions: jest.fn(),
});

const createMockCommandProcessor = () => ({
    processCommand: jest.fn(),
});

const createMockWorldContext = () => ({
    getLocationOfEntity: jest.fn(),
    // Add other methods if constructor validation checks them
});

const createMockEntityManager = () => ({
    getEntityInstance: jest.fn(),
    // Add other methods if constructor validation checks them
});

const createMockGameDataRepository = () => ({
    getActionDefinition: jest.fn(),
    // Add other methods if constructor validation checks them
});

const createMockPromptOutputPort = () => ({
    prompt: jest.fn(), // The crucial method
});

const createMockTurnEndPort = () => ({
    notifyTurnEnded: jest.fn(), // The crucial method
});

const createMockCommandInputPort = () => ({
    onCommand: jest.fn(), // The crucial method checked in the constructor
});

const createMockPlayerPromptService = () => ({
    prompt: jest.fn(), // The crucial method
});

const createMockCommandOutcomeInterpreter = () => ({
    interpret: jest.fn(), // The crucial method
});

const createMockSafeEventDispatcher = () => ({
    dispatchSafely: jest.fn(), // The crucial method
    subscribe: jest.fn(),      // <<< CORRECTED: Added subscribe mock method
});

// --- Test Suite ---
describe('PlayerTurnHandler', () => {
    let mockLogger;
    let mockActionDiscoverySystem;
    let mockCommandProcessor;
    let mockWorldContext;
    let mockEntityManager;
    let mockGameDataRepository;
    let mockPromptOutputPort;
    let mockTurnEndPort;
    let mockCommandInputPort;
    let mockPlayerPromptService;
    let mockCommandOutcomeInterpreter;
    let mockSafeEventDispatcher;
    let validDependencies;

    beforeEach(() => {
        // Reset mocks before each test
        mockLogger = createMockLogger();
        mockActionDiscoverySystem = createMockActionDiscoverySystem();
        mockCommandProcessor = createMockCommandProcessor();
        mockWorldContext = createMockWorldContext();
        mockEntityManager = createMockEntityManager();
        mockGameDataRepository = createMockGameDataRepository();
        mockPromptOutputPort = createMockPromptOutputPort();
        mockTurnEndPort = createMockTurnEndPort();
        mockCommandInputPort = createMockCommandInputPort();
        mockPlayerPromptService = createMockPlayerPromptService();
        mockCommandOutcomeInterpreter = createMockCommandOutcomeInterpreter();
        mockSafeEventDispatcher = createMockSafeEventDispatcher(); // Will now include subscribe

        // Create a baseline set of valid dependencies
        validDependencies = {
            logger: mockLogger,
            actionDiscoverySystem: mockActionDiscoverySystem,
            commandProcessor: mockCommandProcessor,
            worldContext: mockWorldContext,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
            promptOutputPort: mockPromptOutputPort,
            turnEndPort: mockTurnEndPort,
            commandInputPort: mockCommandInputPort,
            playerPromptService: mockPlayerPromptService,
            commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
            safeEventDispatcher: mockSafeEventDispatcher,
        };
    });

    it('should instantiate successfully with all valid dependencies', () => {
        expect(() => new PlayerTurnHandler(validDependencies)).not.toThrow();
        expect(mockLogger.debug).toHaveBeenCalledWith('PlayerTurnHandler initialized successfully with all dependencies.');
    });

    // --- Test individual dependency validations ---

    it('should throw if logger is missing or invalid', () => {
        const invalidDeps = {...validDependencies, logger: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing logger dependency.');

        const invalidDeps2 = {...validDependencies, logger: {}}; // Missing 'error' method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing logger dependency.');
    });

    it('should throw if actionDiscoverySystem is missing or invalid', () => {
        const invalidDeps = {...validDependencies, actionDiscoverySystem: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing actionDiscoverySystem.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing actionDiscoverySystem (requires getValidActions).');

        const invalidDeps2 = {...validDependencies, actionDiscoverySystem: {}};
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing actionDiscoverySystem.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing actionDiscoverySystem (requires getValidActions).');
    });

    it('should throw if commandProcessor is missing or invalid', () => {
        const invalidDeps = {...validDependencies, commandProcessor: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing commandProcessor.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing commandProcessor (requires processCommand).');

        const invalidDeps2 = {...validDependencies, commandProcessor: {}};
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing commandProcessor.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing commandProcessor (requires processCommand).');
    });

    it('should throw if worldContext is missing or invalid', () => {
        const invalidDeps = {...validDependencies, worldContext: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing worldContext.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing worldContext (requires getLocationOfEntity).');

        const invalidDeps2 = {...validDependencies, worldContext: {}};
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing worldContext.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing worldContext (requires getLocationOfEntity).');
    });

    it('should throw if entityManager is missing or invalid', () => {
        const invalidDeps = {...validDependencies, entityManager: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing entityManager.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing entityManager (requires getEntityInstance).');

        const invalidDeps2 = {...validDependencies, entityManager: {}};
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing entityManager.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing entityManager (requires getEntityInstance).');
    });

    it('should throw if gameDataRepository is missing or invalid', () => {
        const invalidDeps = {...validDependencies, gameDataRepository: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing gameDataRepository.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing gameDataRepository (requires getActionDefinition).');

        const invalidDeps2 = {...validDependencies, gameDataRepository: {}};
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing gameDataRepository.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing gameDataRepository (requires getActionDefinition).');
    });

    it('should throw if promptOutputPort is missing or invalid', () => {
        const invalidDeps = {...validDependencies, promptOutputPort: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing promptOutputPort.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing promptOutputPort (requires prompt method).');

        const invalidDeps2 = {...validDependencies, promptOutputPort: {}};
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing promptOutputPort.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing promptOutputPort (requires prompt method).');
    });

    it('should throw if turnEndPort is missing or invalid', () => {
        const invalidDeps = {...validDependencies, turnEndPort: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing turnEndPort.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing turnEndPort (requires notifyTurnEnded method).');

        const invalidDeps2 = {...validDependencies, turnEndPort: {}};
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing turnEndPort.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing turnEndPort (requires notifyTurnEnded method).');
    });

    it('should throw if commandInputPort is missing or invalid', () => {
        const invalidDeps = {...validDependencies, commandInputPort: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing commandInputPort.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing commandInputPort (requires onCommand method).');

        const invalidDeps2 = {...validDependencies, commandInputPort: {}};
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing commandInputPort.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing commandInputPort (requires onCommand method).');
    });

    it('should throw if playerPromptService is missing or invalid', () => {
        const invalidDeps = {...validDependencies, playerPromptService: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing playerPromptService.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing playerPromptService (requires prompt method).');

        const invalidDeps2 = {...validDependencies, playerPromptService: {}};
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing playerPromptService.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing playerPromptService (requires prompt method).');
    });

    it('should throw if commandOutcomeInterpreter is missing or invalid', () => {
        const invalidDeps = {...validDependencies, commandOutcomeInterpreter: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing commandOutcomeInterpreter.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing commandOutcomeInterpreter (requires interpret method).');

        const invalidDeps2 = {...validDependencies, commandOutcomeInterpreter: {}};
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing commandOutcomeInterpreter.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing commandOutcomeInterpreter (requires interpret method).');
    });

    it('should throw if safeEventDispatcher is missing or invalid', () => {
        const expectedLoggedErrorMessage = 'PlayerTurnHandler Constructor: Invalid or missing safeEventDispatcher (requires dispatchSafely and subscribe methods).'; // <<< CORRECTED
        const expectedThrownErrorMessage = 'PlayerTurnHandler: Invalid or missing safeEventDispatcher.';

        const invalidDeps = {...validDependencies, safeEventDispatcher: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow(expectedThrownErrorMessage);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedLoggedErrorMessage);

        // Test with missing 'dispatchSafely' but 'subscribe' present
        const invalidDeps2 = {...validDependencies, safeEventDispatcher: { subscribe: jest.fn() }};
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow(expectedThrownErrorMessage);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedLoggedErrorMessage);

        // Test with 'dispatchSafely' present but missing 'subscribe'
        const invalidDeps3 = {...validDependencies, safeEventDispatcher: { dispatchSafely: jest.fn() }};
        expect(() => new PlayerTurnHandler(invalidDeps3))
            .toThrow(expectedThrownErrorMessage);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedLoggedErrorMessage);

        // Test with an empty object
        const invalidDeps4 = {...validDependencies, safeEventDispatcher: {}};
        expect(() => new PlayerTurnHandler(invalidDeps4))
            .toThrow(expectedThrownErrorMessage);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedLoggedErrorMessage);
    });

});

// --- FILE END ---