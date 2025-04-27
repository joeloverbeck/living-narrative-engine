// tests/core/initializers/systemInitializer.initialization.test.js

import SystemInitializer from '../../../core/initializers/systemInitializer.js';
import AppContainer from '../../../core/appContainer.js';
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals"; // Adjust path as needed
// Assuming tokens are defined somewhere accessible if needed for real keys,
// but for mocks, simple strings often suffice.
// import { tokens } from '../../../src/core/tokens.js';

// --- Mocks ---

// Mock ILogger
const createMockLogger = () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
});

// Mock SystemLogicInterpreter (or any initializable system)
// We only care about the 'initialize' method for this test.
const createMockInitializableSystem = (name = 'MockSystem') => ({
    // Include a name property similar to how systemName is derived in SystemInitializer
    constructor: {name: name},
    initialize: jest.fn().mockResolvedValue(undefined), // Mock async initialize
});

// --- Test Suite ---

describe('SystemInitializer', () => {
    let container;
    let mockLogger;
    let systemInitializer;
    const INITIALIZATION_TAG = 'initializableSystem'; // Match the tag used

    beforeEach(() => {
        // Reset mocks and container before each test
        mockLogger = createMockLogger();
        container = new AppContainer(); // Use the real AppContainer
        // Mock console logging from AppContainer if it's noisy
        jest.spyOn(console, 'log').mockImplementation(() => {
        });
        jest.spyOn(console, 'debug').mockImplementation(() => {
        });
        jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        jest.spyOn(console, 'error').mockImplementation(() => {
        });

        // Instantiate the class under test
        systemInitializer = new SystemInitializer(container, mockLogger);
    });

    afterEach(() => {
        // Restore console mocks
        jest.restoreAllMocks();
    });

    it('should throw an error if AppContainer is missing', () => {
        expect(() => new SystemInitializer(null, mockLogger)).toThrow(
            'SystemInitializer requires an AppContainer instance.'
        );
    });

    it('should throw an error if ILogger is missing', () => {
        // Temporarily remove console.error spy to see the actual error output
        jest.spyOn(console, 'error').mockRestore();
        expect(() => new SystemInitializer(container, null)).toThrow(
            'SystemInitializer requires an ILogger instance.'
        );
        // Reinstate spy if needed for other tests
        jest.spyOn(console, 'error').mockImplementation(() => {
        });
    });

    it('should throw an error if AppContainer does not support resolveByTag', () => {
        const faultyContainer = {resolve: jest.fn()}; // Missing resolveByTag
        expect(() => new SystemInitializer(faultyContainer, mockLogger)).toThrow(
            "SystemInitializer requires an AppContainer instance that supports 'resolveByTag'."
        );
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('resolveByTag'));
    });


    it('should resolve services by tag and call initialize on tagged services', async () => {
        // Arrange
        const mockSystemLogicInterpreter = createMockInitializableSystem('MockSystemLogicInterpreter');
        const mockOtherSystem = createMockInitializableSystem('MockOtherSystem');

        // Register the mock SystemLogicInterpreter *with* the tag
        container.register(
            'mockInterpreter', // Key doesn't strictly matter for tag resolution here
            () => mockSystemLogicInterpreter,
            {tags: [INITIALIZATION_TAG], lifecycle: 'singleton'}
        );

        // Register another service *without* the tag
        container.register(
            'otherService',
            () => ({}), // Simple object, no initialize
            {lifecycle: 'singleton'}
        );

        // Register another service *with* the tag
        container.register(
            'mockOtherSystem',
            () => mockOtherSystem,
            {tags: [INITIALIZATION_TAG], lifecycle: 'singleton'}
        );


        // Act
        await systemInitializer.initializeAll();

        // Assert
        // Check if resolveByTag was called correctly (optional, but good practice)
        // We expect resolveByTag to be called internally by initializeAll
        // We can spy on the *instance* of the container
        const resolveByTagSpy = jest.spyOn(container, 'resolveByTag');
        await systemInitializer.initializeAll(); // Call again to check the spy

        expect(resolveByTagSpy).toHaveBeenCalledWith(INITIALIZATION_TAG);

        // Check that initialize was called on the tagged system
        expect(mockSystemLogicInterpreter.initialize).toHaveBeenCalledTimes(1); // Called once in the *second* initializeAll call
        expect(mockOtherSystem.initialize).toHaveBeenCalledTimes(1); // Also called once

        // Check logs (optional)
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Initializing system: MockSystemLogicInterpreter`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Initializing system: MockOtherSystem`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`System MockSystemLogicInterpreter initialized successfully.`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`System MockOtherSystem initialized successfully.`));
    });

    it('should not call initialize on services resolved by tag if they lack an initialize method', async () => {
        // Arrange
        const systemWithInitialize = createMockInitializableSystem('SystemWithInit');
        const systemWithoutInitialize = {constructor: {name: 'SystemWithoutInit'}}; // No initialize method

        container.register(
            'system1',
            () => systemWithInitialize,
            {tags: [INITIALIZATION_TAG]}
        );
        container.register(
            'system2',
            () => systemWithoutInitialize,
            {tags: [INITIALIZATION_TAG]}
        );

        // Act
        await systemInitializer.initializeAll();

        // Assert
        expect(systemWithInitialize.initialize).toHaveBeenCalledTimes(1);
        // Check logs for skipping
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Resolved system 'SystemWithoutInit' has no initialize() method`)
        );
    });

    it('should handle and log errors during individual system initialization without stopping others', async () => {
        // Arrange
        const system1 = createMockInitializableSystem('System1');
        const systemWithError = createMockInitializableSystem('SystemWithError');
        const system3 = createMockInitializableSystem('System3');

        const initError = new Error('Initialization failed!');
        systemWithError.initialize.mockRejectedValue(initError); // Make this one fail

        container.register('sys1', () => system1, {tags: [INITIALIZATION_TAG]});
        container.register('sysErr', () => systemWithError, {tags: [INITIALIZATION_TAG]});
        container.register('sys3', () => system3, {tags: [INITIALIZATION_TAG]});

        // Act
        // initializeAll should NOT throw here, as errors are caught internally
        await expect(systemInitializer.initializeAll()).resolves.toBeUndefined();

        // Assert
        expect(system1.initialize).toHaveBeenCalledTimes(1);
        expect(systemWithError.initialize).toHaveBeenCalledTimes(1); // It was called
        expect(system3.initialize).toHaveBeenCalledTimes(1);        // This one should still be called

        // Check that the error was logged
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Error during initialization of system 'SystemWithError'`),
            initError // Check that the original error object was passed for logging
        );
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`System System1 initialized successfully.`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`System System3 initialized successfully.`));
    });

    it('should handle case where resolveByTag returns an empty array', async () => {
        // Arrange
        // No systems registered with the tag

        // Act
        await systemInitializer.initializeAll();

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found 0 systems tagged with '${INITIALIZATION_TAG}'.`));
        expect(mockLogger.error).not.toHaveBeenCalled(); // No errors expected
    });

    it('should handle case where resolveByTag returns non-array (though AppContainer should return array)', async () => {
        // Arrange
        // Force resolveByTag to return something unexpected
        jest.spyOn(container, 'resolveByTag').mockResolvedValue(null); // Simulate unexpected return

        // Act
        await systemInitializer.initializeAll();

        // Assert
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`resolveByTag for tag '${INITIALIZATION_TAG}' did not return an array.`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Initialization loop for tagged systems completed.'));
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should re-throw error if container fails during resolveByTag', async () => {
        // Arrange
        const resolveError = new Error('Container resolve failed!');
        // Mock resolveByTag on the container *instance* to throw
        jest.spyOn(container, 'resolveByTag').mockRejectedValue(resolveError);

        // Act & Assert
        await expect(systemInitializer.initializeAll())
            .rejects.toThrow(`Failed to resolve initializable systems: ${resolveError.message}`);

        // Check logs
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Failed to resolve systems by tag '${INITIALIZATION_TAG}'`),
            resolveError
        );
    });
});