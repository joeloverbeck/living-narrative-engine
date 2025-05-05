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
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing actionDiscoverySystem'));

        const invalidDeps2 = {...validDependencies, actionDiscoverySystem: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing actionDiscoverySystem.');
    });

    it('should throw if commandProcessor is missing or invalid', () => {
        const invalidDeps = {...validDependencies, commandProcessor: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing commandProcessor.');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing commandProcessor'));

        const invalidDeps2 = {...validDependencies, commandProcessor: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing commandProcessor.');
    });

    it('should throw if worldContext is missing or invalid', () => {
        const invalidDeps = {...validDependencies, worldContext: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing worldContext.');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing worldContext'));

        const invalidDeps2 = {...validDependencies, worldContext: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing worldContext.');
    });

    it('should throw if entityManager is missing or invalid', () => {
        const invalidDeps = {...validDependencies, entityManager: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing entityManager.');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing entityManager'));

        const invalidDeps2 = {...validDependencies, entityManager: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing entityManager.');
    });

    it('should throw if gameDataRepository is missing or invalid', () => {
        const invalidDeps = {...validDependencies, gameDataRepository: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing gameDataRepository.');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing gameDataRepository'));

        const invalidDeps2 = {...validDependencies, gameDataRepository: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing gameDataRepository.');
    });

    // *** Test for the original error cause ***
    it('should throw if promptOutputPort is missing or invalid', () => {
        const invalidDeps = {...validDependencies, promptOutputPort: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing promptOutputPort.');
        // Check if the logger was called *before* the throw
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing promptOutputPort (requires prompt method).');

        const invalidDeps2 = {...validDependencies, promptOutputPort: {}}; // Missing 'prompt' method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing promptOutputPort.');
        expect(mockLogger.error).toHaveBeenCalledWith('PlayerTurnHandler Constructor: Invalid or missing promptOutputPort (requires prompt method).');
    });
    // *** End test for original error ***

    it('should throw if turnEndPort is missing or invalid', () => {
        const invalidDeps = {...validDependencies, turnEndPort: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing turnEndPort.');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing turnEndPort'));

        const invalidDeps2 = {...validDependencies, turnEndPort: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing turnEndPort.');
    });

    it('should throw if playerPromptService is missing or invalid', () => {
        const invalidDeps = {...validDependencies, playerPromptService: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing playerPromptService.');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing playerPromptService'));

        const invalidDeps2 = {...validDependencies, playerPromptService: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing playerPromptService.');
    });

    it('should throw if commandOutcomeInterpreter is missing or invalid', () => {
        const invalidDeps = {...validDependencies, commandOutcomeInterpreter: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing commandOutcomeInterpreter.');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing commandOutcomeInterpreter'));

        const invalidDeps2 = {...validDependencies, commandOutcomeInterpreter: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing commandOutcomeInterpreter.');
    });

    it('should throw if safeEventDispatcher is missing or invalid', () => {
        const invalidDeps = {...validDependencies, safeEventDispatcher: null};
        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing safeEventDispatcher.');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing safeEventDispatcher'));

        const invalidDeps2 = {...validDependencies, safeEventDispatcher: {}}; // Missing method
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing safeEventDispatcher.');
    });

});

// --- FILE END ---
