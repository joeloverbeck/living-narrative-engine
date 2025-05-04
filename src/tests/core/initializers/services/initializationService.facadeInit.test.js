// src/tests/core/initializers/services/initializationService.facadeInit.test.js
// ****** CORRECTED FILE ******

import InitializationService from '../../../../core/initializers/services/initializationService.js';
import {tokens} from '../../../../core/config/tokens.js'; // Correct import for tests
import AppContainer from '../../../../core/config/appContainer.js';
import ConsoleLogger from '../../../../core/services/consoleLogger.js';
import ValidatedEventDispatcher from '../../../../services/validatedEventDispatcher.js';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

// --- Mocks ---
const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

const mockEventDispatcher = {
    dispatch: jest.fn(),
    dispatchValidated: jest.fn().mockResolvedValue(undefined), // Default to success
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
};

const mockWorldLoader = {
    loadWorld: jest.fn().mockResolvedValue(true), // Default success
};

const mockSystemInitializer = {
    initializeAll: jest.fn().mockResolvedValue(true), // Default success
};

const mockWorldInitializer = {
    initializeWorldEntities: jest.fn().mockReturnValue(true), // Default success
    buildSpatialIndex: jest.fn(),
};

const mockInputSetupService = {
    configureInputHandler: jest.fn(), // Default success (no throw)
};

// Mock DomUiFacade (just need something resolveable)
class MockDomUiFacade {
    constructor() {
        // Basic constructor logic if needed for tests, often empty is fine
    }

    // Add mock methods if initializationService interacts with the facade instance directly
}

// --- Test Setup ---
let container;
let initializationService;

beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
    container = new AppContainer();

    // Register core dependencies
    container.register(tokens.ILogger, mockLogger);
    container.register(tokens.IValidatedEventDispatcher, mockEventDispatcher);

    // Register service-specific dependencies (mocks)
    container.register(tokens.WorldLoader, mockWorldLoader);
    container.register(tokens.SystemInitializer, mockSystemInitializer);
    container.register(tokens.WorldInitializer, mockWorldInitializer);
    container.register(tokens.InputSetupService, mockInputSetupService);

    // Register the *actual* DomUiFacade token with a mock implementation
    // *** FIX: Added empty dependencies array to mimic Registrar.single registration ***
    container.register(tokens.DomUiFacade, MockDomUiFacade, {
        lifecycle: 'singleton',
        dependencies: [] // Essential for AppContainer to recognize it as a Class
    });

    initializationService = new InitializationService({
        container,
        logger: mockLogger,
        validatedEventDispatcher: mockEventDispatcher,
    });
});

// --- Tests ---

describe('InitializationService', () => {
    describe('constructor', () => {
        it('should instantiate correctly with valid dependencies', () => {
            expect(initializationService).toBeInstanceOf(InitializationService);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Instance created successfully'));
        });

        it('should throw if container is missing', () => {
            expect(() => new InitializationService({
                logger: mockLogger,
                validatedEventDispatcher: mockEventDispatcher
            })).toThrow(/Missing required dependency 'container'/);
        });

        it('should throw if logger is missing or invalid', () => {
            expect(() => new InitializationService({
                container,
                validatedEventDispatcher: mockEventDispatcher
            })).toThrow(/Missing or invalid required dependency 'logger'/);
            expect(() => new InitializationService({
                container,
                logger: {},
                validatedEventDispatcher: mockEventDispatcher
            })).toThrow(/Missing or invalid required dependency 'logger'/);
        });

        it('should throw if validatedEventDispatcher is missing or invalid', () => {
            expect(() => new InitializationService({
                container,
                logger: mockLogger
            })).toThrow(/Missing or invalid required dependency 'validatedEventDispatcher'/);
            expect(() => new InitializationService({
                container,
                logger: mockLogger,
                validatedEventDispatcher: {}
            })).toThrow(/Missing or invalid required dependency 'validatedEventDispatcher'/);
        });
    });

    describe('runInitializationSequence', () => {
        const testWorldName = 'testWorld';

        it('should return failure if worldName is invalid', async () => {
            const result = await initializationService.runInitializationSequence('');
            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error.message).toContain('requires a valid non-empty worldName');
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('requires a valid non-empty worldName'));
        });

        it('should call core initialization steps in order', async () => {
            await initializationService.runInitializationSequence(testWorldName);

            // Verify mocks were called
            expect(mockWorldLoader.loadWorld).toHaveBeenCalledWith(testWorldName);
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalled();
            expect(mockInputSetupService.configureInputHandler).toHaveBeenCalled();

            // Check logging (basic check for flow)
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting runInitializationSequence for world: ${testWorldName}`));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('WorldLoader resolved. Loading world data...'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`World data loaded successfully for world: ${testWorldName}`));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('SystemInitializer resolved. Initializing tagged systems...'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Tagged system initialization complete.'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('WorldInitializer resolved. Initializing world entities...'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Initial world entities instantiated and spatial index built.'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('InputSetupService resolved. Configuring input handler...'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Input handler configured.'));
            // Ensure the success log is now called after fixing the registration
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('DomUiFacade resolved, UI components instantiated.')); // Check UI resolve log
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Initialization sequence for world '${testWorldName}' completed successfully`));
        });

        // *** NEW TEST CASE (Modified Registration Above) ***
        it('should resolve DomUiFacade using the correct token from tokens.js', async () => {
            // Spy on the actual container's resolve method
            const resolveSpy = jest.spyOn(container, 'resolve');

            await initializationService.runInitializationSequence(testWorldName);

            // Check if resolve was called with the specific token for DomUiFacade
            expect(resolveSpy).toHaveBeenCalledWith(tokens.DomUiFacade);

            // Ensure the overall sequence succeeded (meaning no error occurred during facade resolution)
            expect(mockLogger.error).not.toHaveBeenCalled(); // No errors should be logged

            resolveSpy.mockRestore(); // Clean up the spy
        });
        // *** END NEW TEST CASE ***


        it('should return success object on successful completion', async () => {
            const result = await initializationService.runInitializationSequence(testWorldName);
            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });

        // --- Error Handling Tests ---

        const testError = new Error('Test Initialization Step Failed');

        it('should return failure and log error if WorldLoader fails', async () => {
            mockWorldLoader.loadWorld.mockRejectedValueOnce(testError);
            const result = await initializationService.runInitializationSequence(testWorldName);
            expect(result.success).toBe(false);
            expect(result.error).toBe(testError);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR'), testError);
        });

        it('should return failure and log error if SystemInitializer fails', async () => {
            mockSystemInitializer.initializeAll.mockRejectedValueOnce(testError);
            const result = await initializationService.runInitializationSequence(testWorldName);
            expect(result.success).toBe(false);
            expect(result.error).toBe(testError);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR'), testError);
        });

        it('should return failure and log error if WorldInitializer fails', async () => {
            mockWorldInitializer.initializeWorldEntities.mockImplementationOnce(() => {
                throw testError;
            });
            const result = await initializationService.runInitializationSequence(testWorldName);
            expect(result.success).toBe(false);
            expect(result.error).toBe(testError);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR'), testError);
        });

        it('should return failure and log error if InputSetupService fails', async () => {
            mockInputSetupService.configureInputHandler.mockImplementationOnce(() => {
                throw testError;
            });
            const result = await initializationService.runInitializationSequence(testWorldName);
            expect(result.success).toBe(false);
            expect(result.error).toBe(testError);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR'), testError);
        });

        it('should log error but potentially succeed if DomUiFacade resolution fails (optional)', async () => {
            // Simulate container failing to resolve DomUiFacade
            const uiError = new Error('Failed to resolve UI Facade');
            const resolveSpy = jest.spyOn(container, 'resolve');
            resolveSpy.mockImplementation((token) => {
                // Original implementation reference
                const originalResolve = AppContainer.prototype.resolve;

                if (token === tokens.DomUiFacade) {
                    throw uiError;
                }
                // Call the original resolve for other tokens bound to the current container instance
                return originalResolve.call(container, token);
            });

            const result = await initializationService.runInitializationSequence(testWorldName);

            // Check that the specific error was logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to resolve DomUiFacade'),
                uiError
            );

            // Sequence continues despite UI error as per current service logic
            expect(result.success).toBe(true);
            // Ensure no *other* critical error was logged
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR'), expect.anything());

            resolveSpy.mockRestore();
        });


        it('should dispatch failed event on any critical error', async () => {
            mockSystemInitializer.initializeAll.mockRejectedValueOnce(testError);
            await initializationService.runInitializationSequence(testWorldName);
            expect(mockEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:initialization_service:failed',
                expect.objectContaining({
                    worldName: testWorldName,
                    error: testError.message,
                    stack: testError.stack,
                }),
                {allowSchemaNotFound: true}
            );
        });

        it('should dispatch UI error events on critical error', async () => {
            mockWorldLoader.loadWorld.mockRejectedValueOnce(testError);
            await initializationService.runInitializationSequence(testWorldName);
            expect(mockEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'ui:show_fatal_error',
                expect.objectContaining({
                    title: 'Fatal Initialization Error',
                    message: expect.stringContaining(`Reason: ${testError.message}`),
                    details: testError.stack,
                })
            );
            expect(mockEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'textUI:disable_input',
                expect.objectContaining({
                    message: expect.stringContaining('Fatal error during initialization'),
                })
            );
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Dispatched ui:show_fatal_error and textUI:disable_input events.'));
        });

        it('should log error if dispatching UI error events fails after critical error', async () => {
            const dispatchError = new Error('Dispatch Failed');
            mockWorldLoader.loadWorld.mockRejectedValueOnce(testError);
            mockEventDispatcher.dispatchValidated
                .mockResolvedValueOnce(undefined) // started event
                .mockResolvedValueOnce(undefined) // failed event
                .mockRejectedValueOnce(dispatchError); // show_fatal_error fails

            await initializationService.runInitializationSequence(testWorldName);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to dispatch UI error events'), dispatchError);
        });
    });
});