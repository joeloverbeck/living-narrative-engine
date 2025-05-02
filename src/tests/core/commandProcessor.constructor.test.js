// src/tests/core/commandProcessor.constructor.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
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
    // Add subscribe/unsubscribe if needed for future tests, not strictly required by CommandProcessor constructor/processCommand
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
};

const mockGameStateManager = {
    getCurrentLocation: jest.fn(),
    getPlayer: jest.fn(),
    // Add other methods if needed by actions invoked through CommandProcessor
};

const mockEntityManager = {
    getEntityInstance: jest.fn(),
    addComponent: jest.fn(),
    // Add other methods like removeComponent, hasComponent, getComponentData if needed by actions
};

const mockGameDataRepository = {
    getActionDefinition: jest.fn(),
    // Add other methods like getEntityDefinition, etc. if needed by actions
};

// Helper function to create a full set of valid mocks for options
const createValidMocks = () => ({
    commandParser: { ...mockCommandParser, parse: jest.fn() },
    actionExecutor: { ...mockActionExecutor, executeAction: jest.fn() },
    logger: { ...mockLogger, info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    validatedEventDispatcher: { ...mockValidatedEventDispatcher, dispatchValidated: jest.fn() },
    gameStateManager: { ...mockGameStateManager, getCurrentLocation: jest.fn(), getPlayer: jest.fn() },
    entityManager: { ...mockEntityManager, getEntityInstance: jest.fn(), addComponent: jest.fn() },
    gameDataRepository: { ...mockGameDataRepository, getActionDefinition: jest.fn() },
});


describe('CommandProcessor', () => {
    let commandProcessor;
    let mocks;

    beforeEach(() => {
        // Reset mocks before each test
        mocks = createValidMocks();
        // Instantiate CommandProcessor with valid mocks by default
        commandProcessor = new CommandProcessor(mocks);
    });

    // --- Constructor Tests ---
    describe('constructor', () => {
        it('should throw an error if logger is null or missing methods', () => {
            const invalidOptions = [
                null,
                undefined,
                {},
                { logger: {} },
                { logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() /* missing warn */ } },
            ];
            invalidOptions.forEach(opts => {
                // Ensure logger is explicitly invalid in cases where opts is an object
                const options = opts && typeof opts === 'object' ? { ...createValidMocks(), ...opts } : createValidMocks();
                if (!opts || !opts.logger) options.logger = opts?.logger ?? null; // Ensure logger is invalid

                expect(() => new CommandProcessor(options)).toThrow(/ILogger instance/);
            });
        });

        // Test other dependencies based on the logger being valid first
        it('should throw an error if commandParser is null or missing parse method', () => {
            const invalidOptions = [
                { commandParser: null },
                { commandParser: {} },
                { commandParser: { someOtherMethod: jest.fn() } },
            ];
            invalidOptions.forEach(opts => {
                const options = { ...createValidMocks(), ...opts };
                expect(() => new CommandProcessor(options)).toThrow(/ICommandParser instance/);
            });
        });

        it('should throw an error if actionExecutor is null or missing executeAction method', () => {
            const invalidOptions = [
                { actionExecutor: null },
                { actionExecutor: {} },
            ];
            invalidOptions.forEach(opts => {
                const options = { ...createValidMocks(), ...opts };
                expect(() => new CommandProcessor(options)).toThrow(/IActionExecutor instance/);
            });
        });

        it('should throw an error if validatedEventDispatcher is null or missing dispatchValidated method', () => {
            const invalidOptions = [
                { validatedEventDispatcher: null },
                { validatedEventDispatcher: {} },
            ];
            invalidOptions.forEach(opts => {
                const options = { ...createValidMocks(), ...opts };
                expect(() => new CommandProcessor(options)).toThrow(/IValidatedEventDispatcher instance/);
            });
        });

        it('should throw an error if gameStateManager is null or missing required methods', () => {
            const invalidOptions = [
                { gameStateManager: null },
                { gameStateManager: {} },
                { gameStateManager: { getCurrentLocation: jest.fn() /* missing getPlayer */ } },
                { gameStateManager: { getPlayer: jest.fn() /* missing getCurrentLocation */ } },
            ];
            invalidOptions.forEach(opts => {
                const options = { ...createValidMocks(), ...opts };
                expect(() => new CommandProcessor(options)).toThrow(/IGameStateManager instance/);
            });
        });

        it('should throw an error if entityManager is null or missing required methods', () => {
            const invalidOptions = [
                { entityManager: null },
                { entityManager: {} },
                { entityManager: { getEntityInstance: jest.fn() /* missing addComponent */ } },
                { entityManager: { addComponent: jest.fn() /* missing getEntityInstance */ } },
            ];
            invalidOptions.forEach(opts => {
                const options = { ...createValidMocks(), ...opts };
                // Note: The error message mentions 'relevant methods', adjust if exact methods are critical
                expect(() => new CommandProcessor(options)).toThrow(/EntityManager instance/);
            });
        });

        it('should throw an error if gameDataRepository is null or missing getActionDefinition method', () => {
            const invalidOptions = [
                { gameDataRepository: null },
                { gameDataRepository: {} },
            ];
            invalidOptions.forEach(opts => {
                const options = { ...createValidMocks(), ...opts };
                // Note: The error message mentions 'getActionDefinition, etc.', adjust if needed
                expect(() => new CommandProcessor(options)).toThrow(/GameDataRepository instance/);
            });
        });

        it('should successfully instantiate with all valid dependencies', () => {
            expect(() => new CommandProcessor(createValidMocks())).not.toThrow();
            // Check if logger.info was called during successful construction
            const validMocks = createValidMocks();
            new CommandProcessor(validMocks);
            expect(validMocks.logger.info).toHaveBeenCalledWith("CommandProcessor: Instance created and dependencies validated.");
        });
    });


}); // End describe('CommandProcessor')