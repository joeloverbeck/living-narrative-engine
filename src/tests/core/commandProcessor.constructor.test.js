// src/tests/core/commandProcessor.constructor.test.js
// --- FILE START (Corrected Test File) ---

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import CommandProcessor from '../../core/commandProcessor.js';
// Import Entity for type checking if needed, although mocks are primary
// import Entity from '../entities/entity.js';

// --- Mock Dependencies ---
// Using jest.fn() creates mock functions for all required methods

const mockCommandParser = {
    parse: jest.fn(),
};

const mockActionExecutor = {
    executeAction: jest.fn(),
};

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

const mockValidatedEventDispatcher = {
    dispatchValidated: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
};

// ****** START #7 Change: Update mockWorldContext definition ******
const mockWorldContext = {
    // getCurrentLocation: jest.fn(), // Removed old method
    getLocationOfEntity: jest.fn(), // Added new method
    getPlayer: jest.fn(), // Keep other potentially relevant methods
};
// ****** END #7 Change ******

const mockEntityManager = {
    getEntityInstance: jest.fn(),
    addComponent: jest.fn(),
};

const mockGameDataRepository = {
    getActionDefinition: jest.fn(),
};

// Helper function to create a full set of valid mocks for options
const createValidMocks = () => ({
    commandParser: {...mockCommandParser, parse: jest.fn()},
    actionExecutor: {...mockActionExecutor, executeAction: jest.fn()},
    logger: {...mockLogger, info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()},
    validatedEventDispatcher: {...mockValidatedEventDispatcher, dispatchValidated: jest.fn()},
    // ****** START #7 Change: Update mock return in helper ******
    worldContext: {...mockWorldContext, getLocationOfEntity: jest.fn(), getPlayer: jest.fn()}, // Ensure new method is mocked
    // ****** END #7 Change ******
    entityManager: {...mockEntityManager, getEntityInstance: jest.fn(), addComponent: jest.fn()},
    gameDataRepository: {...mockGameDataRepository, getActionDefinition: jest.fn()},
});


describe('CommandProcessor', () => {
    // No need for commandProcessor instance here as we are testing the constructor itself

    // --- Constructor Tests ---
    describe('constructor', () => {
        // Test logger first, as it's needed for other error logs
        it('should throw an error if logger is null or missing methods', () => {
            const invalidOptions = [
                null,
                undefined,
                {},
                {logger: {}},
                {logger: {info: jest.fn(), error: jest.fn(), debug: jest.fn() /* missing warn */}},
            ];
            invalidOptions.forEach(opts => {
                // Create a base set of *potentially* valid mocks, but ensure logger is invalid
                const baseMocks = createValidMocks(); // Get a set with the correct structure otherwise
                let options;
                if (opts === null || opts === undefined) {
                    // Handle cases where the entire options object might be invalid
                    options = {...baseMocks, logger: null}; // Need to explicitly set logger to null/invalid
                } else {
                    options = {...baseMocks, ...opts}; // Merge, opts might override logger
                }
                // If opts didn't provide a logger, ensure it's null for the test
                if (!opts || !opts.logger) options.logger = null;

                expect(() => new CommandProcessor(options)).toThrow(/ILogger instance/);
            });
        });

        // Test other dependencies - these assume a valid logger is passed
        it('should throw an error if commandParser is null or missing parse method', () => {
            const invalidOptions = [
                {commandParser: null},
                {commandParser: {}},
                {commandParser: {someOtherMethod: jest.fn()}},
            ];
            invalidOptions.forEach(opts => {
                const options = {...createValidMocks(), ...opts}; // Base mocks are valid
                expect(() => new CommandProcessor(options)).toThrow(/ICommandParser instance/);
            });
        });

        it('should throw an error if actionExecutor is null or missing executeAction method', () => {
            const invalidOptions = [
                {actionExecutor: null},
                {actionExecutor: {}},
            ];
            invalidOptions.forEach(opts => {
                const options = {...createValidMocks(), ...opts};
                expect(() => new CommandProcessor(options)).toThrow(/IActionExecutor instance/);
            });
        });

        it('should throw an error if validatedEventDispatcher is null or missing dispatchValidated method', () => {
            const invalidOptions = [
                {validatedEventDispatcher: null},
                {validatedEventDispatcher: {}},
            ];
            invalidOptions.forEach(opts => {
                const options = {...createValidMocks(), ...opts};
                expect(() => new CommandProcessor(options)).toThrow(/IValidatedEventDispatcher instance/);
            });
        });

        // ****** START #7 Change: Update test for worldContext validation ******
        it('should throw an error if worldContext is null or missing getLocationOfEntity method', () => {
            // Test cases the constructor actually validates
            const invalidOptions = [
                {worldContext: null}, // Constructor checks for null
                {worldContext: {}},   // Constructor checks for missing getLocationOfEntity
                {worldContext: {getPlayer: jest.fn() /* missing getLocationOfEntity */}} // Also covers missing method
            ];
            invalidOptions.forEach(opts => {
                const options = {...createValidMocks(), ...opts}; // Base mocks are valid
                // Use the specific error message for worldContext validation failure
                expect(() => new CommandProcessor(options)).toThrow(/IWorldContext instance \(with getLocationOfEntity method\)/);
            });
        });
        // ****** END #7 Change ******

        it('should throw an error if entityManager is null or missing required methods', () => {
            const invalidOptions = [
                {entityManager: null},
                {entityManager: {}},
                // Check for specific methods mentioned in the error message
                {entityManager: {getEntityInstance: jest.fn() /* missing addComponent */}},
                {entityManager: {addComponent: jest.fn() /* missing getEntityInstance */}},
            ];
            invalidOptions.forEach(opts => {
                const options = {...createValidMocks(), ...opts};
                expect(() => new CommandProcessor(options)).toThrow(/EntityManager instance/);
            });
        });

        it('should throw an error if gameDataRepository is null or missing getActionDefinition method', () => {
            const invalidOptions = [
                {gameDataRepository: null},
                {gameDataRepository: {}},
                // Add specific missing method if needed, constructor checks getActionDefinition
                {gameDataRepository: {someOtherMethod: jest.fn()}},
            ];
            invalidOptions.forEach(opts => {
                const options = {...createValidMocks(), ...opts};
                expect(() => new CommandProcessor(options)).toThrow(/GameDataRepository instance/);
            });
        });

        it('should successfully instantiate with all valid dependencies', () => {
            // Arrange: Create a valid set of mocks using the corrected helper
            const validMocks = createValidMocks();

            // Act & Assert: Expect no error during instantiation
            expect(() => new CommandProcessor(validMocks)).not.toThrow();

            // Assert: Check if logger.info was called during successful construction
            // Need a fresh instance as the mock might be shared if not careful
            const freshValidMocks = createValidMocks();
            new CommandProcessor(freshValidMocks); // Instantiate again
            expect(freshValidMocks.logger.info).toHaveBeenCalledWith("CommandProcessor: Instance created and dependencies validated.");
        });
    });


}); // End describe('CommandProcessor')
// --- FILE END ---