// src/tests/core/handlers/playerTurnHandler.dependencies.test.js
// --- FILE START (Corrected Test File using Jest) ---

// Import the class to test
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjust path as needed
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

// --- Mock Dependencies ---
// Create basic mocks for all dependencies required by the constructor
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

const mockActionDiscoverySystem = {
    getValidActions: jest.fn(),
};

const mockValidatedEventDispatcher = {
    dispatchValidated: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
};

const mockCommandProcessor = {
    processCommand: jest.fn(),
};

// Correct Mock for WorldContext (previously methods were misplaced on mockGameStateManager)
const mockWorldContext = {
    getLocationOfEntity: jest.fn(),
    getCurrentLocation: jest.fn(),
};

// Mock for EntityManager (Correct method name is getEntityInstance)
const mockEntityManager = {
    getEntityInstance: jest.fn(),
    // Include the OLD wrong name only for testing purposes if needed, but primarily focus on the correct one
    getEntity: jest.fn(),
};

const mockGameDataRepository = {
    getActionDefinition: jest.fn(),
};

// --- Test Suite for Constructor Dependency Validation ---
describe('PlayerTurnHandler Constructor Dependency Validation', () => {

    // Helper function to get a set of default valid dependencies
    const getValidDependencies = () => ({
        logger: mockLogger,
        actionDiscoverySystem: mockActionDiscoverySystem,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        commandProcessor: mockCommandProcessor,
        worldContext: mockWorldContext, // Correctly provide worldContext
        entityManager: mockEntityManager,
        gameDataRepository: mockGameDataRepository,
        // gameStateManager is NOT a direct dependency of the constructor
    });

    // Reset mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mocks to a basic valid state
        mockValidatedEventDispatcher.subscribe.mockImplementation(() => {
        }); // Ensure subscribe doesn't throw by default
        mockValidatedEventDispatcher.dispatchValidated.mockResolvedValue(undefined);
        mockCommandProcessor.processCommand.mockResolvedValue({success: true, turnEnded: true});
        mockActionDiscoverySystem.getValidActions.mockResolvedValue([]);
        // Setup mocks for worldContext methods (moved from mockGameStateManager)
        mockWorldContext.getLocationOfEntity.mockResolvedValue({id: 'location-1'});
        mockWorldContext.getCurrentLocation.mockReturnValue({id: 'location-1'});
        mockEntityManager.getEntityInstance.mockReturnValue({id: 'entity-1'});
        mockGameDataRepository.getActionDefinition.mockReturnValue({id: 'action-def-1'}); // Example valid return
    });

    it('should instantiate successfully with all valid dependencies', () => {
        // Arrange: All dependencies are valid mock objects
        const dependencies = getValidDependencies();

        // Act & Assert: Should not throw an error
        expect(() => new PlayerTurnHandler(dependencies)).not.toThrow();

        // Assert: Should subscribe to the command event during construction
        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(1);
        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
            'command:submit',
            expect.any(Function) // Check that some function was passed as listener
        );
    });

    // --- Test Cases for Invalid Dependencies ---

    it('should throw if logger is missing or invalid', () => {
        const invalidDeps = {...getValidDependencies(), logger: null};
        const invalidDeps2 = {...getValidDependencies(), logger: {info: jest.fn()}}; // Missing error method

        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing logger dependency.');
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing logger dependency.');
    });

    it('should throw if actionDiscoverySystem is missing or invalid', () => {
        const invalidDeps = {...getValidDependencies(), actionDiscoverySystem: null};
        const invalidDeps2 = {...getValidDependencies(), actionDiscoverySystem: {}}; // Missing getValidActions

        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing actionDiscoverySystem.');
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing actionDiscoverySystem.');
    });

    it('should throw if validatedEventDispatcher is missing or invalid', () => {
        const invalidDeps = {...getValidDependencies(), validatedEventDispatcher: null};
        const invalidDeps2 = {
            ...getValidDependencies(),
            validatedEventDispatcher: {dispatchValidated: jest.fn(), subscribe: jest.fn()}
        }; // Missing unsubscribe

        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing validatedEventDispatcher.');
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing validatedEventDispatcher.');
    });

    it('should throw if commandProcessor is missing or invalid', () => {
        const invalidDeps = {...getValidDependencies(), commandProcessor: null};
        const invalidDeps2 = {...getValidDependencies(), commandProcessor: {}}; // Missing processCommand

        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing commandProcessor.');
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing commandProcessor.');
    });

    // Add test for worldContext (this was the root cause of failures)
    it('should throw if worldContext is missing or invalid', () => {
        const invalidDeps = {...getValidDependencies(), worldContext: null};
        const invalidDeps2 = {...getValidDependencies(), worldContext: {getCurrentLocation: jest.fn()}}; // Missing getLocationOfEntity
        const invalidDeps3 = {...getValidDependencies(), worldContext: {getLocationOfEntity: jest.fn()}}; // Missing getCurrentLocation

        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing worldContext.');
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing worldContext.');
        expect(() => new PlayerTurnHandler(invalidDeps3))
            .toThrow('PlayerTurnHandler: Invalid or missing worldContext.');
    });

    // Removed test for gameStateManager as it's not a direct constructor dependency.
    // it('should throw if gameStateManager is missing or invalid (missing methods)', () => { ... });

    // --- Tests Specifically for EntityManager Validation ---

    it('should throw if entityManager is missing', () => {
        const invalidDeps = {...getValidDependencies(), entityManager: null};

        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing entityManager.');
    });

    it('should throw if entityManager is invalid (missing getEntityInstance method)', () => {
        const invalidEntityManager = {someOtherMethod: jest.fn(), getEntity: jest.fn()}; // Missing getEntityInstance
        const invalidDeps = {...getValidDependencies(), entityManager: invalidEntityManager};

        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing entityManager.');
    });

    it('should NOT throw if entityManager provides getEntityInstance (even if it also has getEntity)', () => {
        const validEntityManagerWithExtra = {
            getEntityInstance: jest.fn().mockReturnValue({id: 'entity-1'}),
            getEntity: jest.fn(), // Has the old method too, but shouldn't matter
        };
        const validDeps = {...getValidDependencies(), entityManager: validEntityManagerWithExtra};

        expect(() => new PlayerTurnHandler(validDeps)).not.toThrow();
    });

    // --- End EntityManager Specific Tests ---

    it('should throw if gameDataRepository is missing or invalid', () => {
        const invalidDeps = {...getValidDependencies(), gameDataRepository: null};
        const invalidDeps2 = {...getValidDependencies(), gameDataRepository: {}}; // Missing getActionDefinition

        expect(() => new PlayerTurnHandler(invalidDeps))
            .toThrow('PlayerTurnHandler: Invalid or missing gameDataRepository.');
        expect(() => new PlayerTurnHandler(invalidDeps2))
            .toThrow('PlayerTurnHandler: Invalid or missing gameDataRepository.');
    });

    it('should throw if VED subscription fails during construction', () => {
        // Arrange: Make the subscribe method throw an error
        const subscriptionError = new Error("VED Subscription Failed!");
        mockValidatedEventDispatcher.subscribe.mockImplementation(() => {
            throw subscriptionError;
        });
        const dependencies = getValidDependencies();

        // Act & Assert: Check for the specific error thrown by the constructor's catch block
        expect(() => new PlayerTurnHandler(dependencies))
            .toThrow("PlayerTurnHandler: Failed to subscribe to VED event 'command:submit'.");

        // Assert: Logger should have been called before the subscription attempt failed
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Failed to subscribe to command:submit via VED'),
            subscriptionError // Check that the original error was logged
        );
    });
});

// --- FILE END ---