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

// <<< ADDED Mock for the new dependency >>>
const createMockCommandInputPort = () => ({
    onCommand: jest.fn(), // The crucial method checked in the constructor
});
// <<< END ADDED Mock >>>

const createMockPlayerPromptService = () => ({
    prompt: jest.fn(), // The crucial method
});

const createMockCommandOutcomeInterpreter = () => ({
    interpret: jest.fn(), // The crucial method
});

const createMockSafeEventDispatcher = () => ({
    dispatchSafely: jest.fn(), // The crucial method
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
    let mockCommandInputPort; // <<< ADDED variable declaration >>>
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
        mockCommandInputPort = createMockCommandInputPort(); // <<< ADDED instantiation >>>
        mockPlayerPromptService = createMockPlayerPromptService();
        mockCommandOutcomeInterpreter = createMockCommandOutcomeInterpreter();
        mockSafeEventDispatcher = createMockSafeEventDispatcher();

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
            commandInputPort: mockCommandInputPort, // <<< ADDED dependency here >>>
            playerPromptService: mockPlayerPromptService,
            commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
            safeEventDispatcher: mockSafeEventDispatcher,
        };

        // Clear console mocks if necessary (if you want to test console output specifically)
        // jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    // afterEach(() => {
    //     jest.restoreAllMocks(); // Restore console mocks if used
    // });

    it('should instantiate successfully with all valid dependencies', () => {
        // This test should now pass because commandInputPort is included
        expect(() => new PlayerTurnHandler(validDependencies)).not.toThrow();
        expect(mockLogger.debug).toHaveBeenCalledWith('PlayerTurnHandler initialized successfully with all dependencies.');
    });

    // --- Test individual dependency validations ---

    it('should throw if logger is missing or invalid', () => {
        const invalidDeps = {...validDependencies, logger: null};
        // The constructor uses console.error before throwing if logger itself is bad
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
        // Check if the logger was called *before* the throw (using the provided mockLogger)
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing actionDiscoverySystem (requires getValidActions).');

        const invalidDeps2 = {...validDependencies, actionDiscoverySystem: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing actionDiscoverySystem.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing actionDiscoverySystem (requires getValidActions).');
    });

    it('should throw if commandProcessor is missing or invalid', () => {
        const invalidDeps = {...validDependencies, commandProcessor: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing commandProcessor.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing commandProcessor (requires processCommand).');

        const invalidDeps2 = {...validDependencies, commandProcessor: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing commandProcessor.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing commandProcessor (requires processCommand).');
    });

    it('should throw if worldContext is missing or invalid', () => {
        const invalidDeps = {...validDependencies, worldContext: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing worldContext.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing worldContext (requires getLocationOfEntity).');

        const invalidDeps2 = {...validDependencies, worldContext: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing worldContext.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing worldContext (requires getLocationOfEntity).');
    });

    it('should throw if entityManager is missing or invalid', () => {
        const invalidDeps = {...validDependencies, entityManager: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing entityManager.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing entityManager (requires getEntityInstance).');

        const invalidDeps2 = {...validDependencies, entityManager: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing entityManager.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing entityManager (requires getEntityInstance).');
    });

    it('should throw if gameDataRepository is missing or invalid', () => {
        const invalidDeps = {...validDependencies, gameDataRepository: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing gameDataRepository.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing gameDataRepository (requires getActionDefinition).');

        const invalidDeps2 = {...validDependencies, gameDataRepository: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing gameDataRepository.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing gameDataRepository (requires getActionDefinition).');
    });

    it('should throw if promptOutputPort is missing or invalid', () => {
        const invalidDeps = {...validDependencies, promptOutputPort: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing promptOutputPort.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing promptOutputPort (requires prompt method).');

        const invalidDeps2 = {...validDependencies, promptOutputPort: {}}; // Missing 'prompt' method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing promptOutputPort.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing promptOutputPort (requires prompt method).');
    });

    it('should throw if turnEndPort is missing or invalid', () => {
        const invalidDeps = {...validDependencies, turnEndPort: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing turnEndPort.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing turnEndPort (requires notifyTurnEnded method).');

        const invalidDeps2 = {...validDependencies, turnEndPort: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing turnEndPort.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing turnEndPort (requires notifyTurnEnded method).');
    });

    // <<< ADDED Test for the new dependency >>>
    it('should throw if commandInputPort is missing or invalid', () => {
        const invalidDeps = {...validDependencies, commandInputPort: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing commandInputPort.');
        // Check the logger call which happens before throwing
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing commandInputPort (requires onCommand method).');

        const invalidDeps2 = {...validDependencies, commandInputPort: {}}; // Missing 'onCommand' method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing commandInputPort.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing commandInputPort (requires onCommand method).');
    });
    // <<< END ADDED Test >>>

    it('should throw if playerPromptService is missing or invalid', () => {
        const invalidDeps = {...validDependencies, playerPromptService: null};
        // This test should now throw the correct error
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing playerPromptService.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing playerPromptService (requires prompt method).');

        const invalidDeps2 = {...validDependencies, playerPromptService: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing playerPromptService.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing playerPromptService (requires prompt method).');
    });

    it('should throw if commandOutcomeInterpreter is missing or invalid', () => {
        const invalidDeps = {...validDependencies, commandOutcomeInterpreter: null};
        // This test should now throw the correct error
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing commandOutcomeInterpreter.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing commandOutcomeInterpreter (requires interpret method).');

        const invalidDeps2 = {...validDependencies, commandOutcomeInterpreter: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing commandOutcomeInterpreter.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing commandOutcomeInterpreter (requires interpret method).');
    });

    it('should throw if safeEventDispatcher is missing or invalid', () => {
        const invalidDeps = {...validDependencies, safeEventDispatcher: null};
        // This test should now throw the correct error
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing safeEventDispatcher.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing safeEventDispatcher (requires dispatchSafely method).');

        const invalidDeps2 = {...validDependencies, safeEventDispatcher: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing safeEventDispatcher.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing safeEventDispatcher (requires dispatchSafely method).');
    });

});

// --- FILE END ---