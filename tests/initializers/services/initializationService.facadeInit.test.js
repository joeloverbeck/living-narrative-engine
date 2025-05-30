// tests/initializers/services/initializationService.facadeInit.test.js
// ****** CORRECTED FILE ******

import InitializationService from '../../../src/initializers/services/initializationService.js';
import {tokens} from '../../../src/config/tokens.js';
import AppContainer from '../../../src/config/appContainer.js';
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
    dispatchValidated: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
};

const mockWorldLoader = {
    loadWorld: jest.fn().mockResolvedValue(true),
};

const mockSystemInitializer = {
    initializeAll: jest.fn().mockResolvedValue(true),
};

const mockWorldInitializer = {
    initializeWorldEntities: jest.fn().mockReturnValue(true),
    buildSpatialIndex: jest.fn(),
};

const mockInputSetupService = {
    configureInputHandler: jest.fn(),
};

class MockDomUiFacade {
    constructor() { /* Empty */
    }
}

// Updated mockLlmAdapterInstance setup
const mockLlmAdapterInstance = {
    init: jest.fn().mockImplementation(async () => {
        // Simulate successful init by updating internal mock states
        mockLlmAdapterInstance.isInitialized.mockReturnValue(true);
        mockLlmAdapterInstance.isOperational.mockReturnValue(true);
        return undefined;
    }),
    isInitialized: jest.fn().mockReturnValue(false), // Default to not initialized
    isOperational: jest.fn().mockReturnValue(false), // Default to not operational
};

const mockSchemaValidatorInstance = {
    validate: jest.fn().mockReturnValue({isValid: true, errors: null}),
    addSchema: jest.fn().mockResolvedValue(undefined),
    isSchemaLoaded: jest.fn().mockReturnValue(true),
    getValidator: jest.fn().mockReturnValue(() => ({isValid: true, errors: null})),
    removeSchema: jest.fn().mockReturnValue(true),
};

const mockConfigurationInstance = {
    getContentTypeSchemaId: jest.fn((typeName) => {
        if (typeName === 'llm-configs') {
            return 'http://example.com/schemas/llm-configs.schema.json';
        }
        return `http://example.com/schemas/${typeName}.schema.json`;
    }),
};

let container;
let initializationService;

beforeEach(() => {
    jest.clearAllMocks();
    container = new AppContainer();

    container.register(tokens.ILogger, mockLogger);
    container.register(tokens.IValidatedEventDispatcher, mockEventDispatcher);
    container.register(tokens.WorldLoader, mockWorldLoader);
    container.register(tokens.SystemInitializer, mockSystemInitializer);
    container.register(tokens.WorldInitializer, mockWorldInitializer);
    container.register(tokens.InputSetupService, mockInputSetupService);
    container.register(tokens.DomUiFacade, MockDomUiFacade, {
        lifecycle: 'singleton',
        dependencies: []
    });

    // Reset mocks for ILLMAdapter for each test to ensure clean state
    mockLlmAdapterInstance.init.mockImplementation(async () => {
        mockLlmAdapterInstance.isInitialized.mockReturnValue(true);
        mockLlmAdapterInstance.isOperational.mockReturnValue(true);
        return undefined;
    });
    mockLlmAdapterInstance.isInitialized.mockReturnValue(false);
    mockLlmAdapterInstance.isOperational.mockReturnValue(false);

    container.register(tokens.ILLMAdapter, mockLlmAdapterInstance);
    container.register(tokens.ISchemaValidator, mockSchemaValidatorInstance);
    container.register(tokens.IConfiguration, mockConfigurationInstance);

    initializationService = new InitializationService({
        container,
        logger: mockLogger,
        validatedEventDispatcher: mockEventDispatcher,
    });
});

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
            expect(result.error).toBeInstanceOf(TypeError);
            expect(result.error.message).toContain('requires a valid non-empty worldName');
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('requires a valid non-empty worldName'));
        });

        it('should call core initialization steps in order, including ILLMAdapter init', async () => {
            await initializationService.runInitializationSequence(testWorldName);

            expect(mockWorldLoader.loadWorld).toHaveBeenCalledWith(testWorldName);
            expect(mockLlmAdapterInstance.init).toHaveBeenCalledTimes(1);
            // After successful init, these should have been called by the service to log status
            expect(mockLlmAdapterInstance.isOperational).toHaveBeenCalled();


            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalled();
            expect(mockInputSetupService.configureInputHandler).toHaveBeenCalled();

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting runInitializationSequence for world: ${testWorldName}`));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('World data loaded successfully for world:'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Attempting to initialize ConfigurableLLMAdapter...'));
            // Check based on the default successful mock of init and isOperational
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('ConfigurableLLMAdapter initialized successfully and is operational.'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('SystemInitializer resolved. Initializing tagged systems...'));
        });

        it('should resolve DomUiFacade using the correct token from tokens.js', async () => {
            const resolveSpy = jest.spyOn(container, 'resolve');
            await initializationService.runInitializationSequence(testWorldName);
            expect(resolveSpy).toHaveBeenCalledWith(tokens.DomUiFacade);
            // Check that no UNEXPECTED errors were logged during this specific successful path.
            // Errors related to adapter init if it failed would be caught by other tests.
            const errorCalls = mockLogger.error.mock.calls.filter(
                call => !call[0].includes("InitializationService: CRITICAL error during ConfigurableLLMAdapter.init()") // Allow this specific error if testing failure path
            );
            //This test is for a successful path of DomUiFacade resolution, so no general errors.
            //If ILLMAdapter init fails in a way not covered by specific ILLMAdapter error tests, it might show here.
            //For this test, let's assume ILLMAdapter init is successful.
            if (mockLlmAdapterInstance.init.mock.results[0]?.type === 'return' &&
                mockLlmAdapterInstance.isOperational()) {
                expect(mockLogger.error).not.toHaveBeenCalled();
            }


            resolveSpy.mockRestore();
        });

        it('should return success object on successful completion', async () => {
            const result = await initializationService.runInitializationSequence(testWorldName);
            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });

        const testError = new Error('Test Initialization Step Failed');

        it('should return failure and log error if WorldLoader fails', async () => {
            mockWorldLoader.loadWorld.mockRejectedValueOnce(testError);
            const result = await initializationService.runInitializationSequence(testWorldName);
            expect(result.success).toBe(false);
            expect(result.error).toBe(testError);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR'), testError);
        });

        // Test for when ILLMAdapter.init throws an error
        it('should log CRITICAL error if ILLMAdapter.init throws, but sequence continues', async () => {
            const adapterInitError = new Error("Adapter init genuinely failed/threw");
            mockLlmAdapterInstance.isInitialized.mockReturnValue(false); // Ensure init is attempted
            mockLlmAdapterInstance.init.mockRejectedValueOnce(adapterInitError);
            // isOperational will remain false (its default in beforeEach)

            const result = await initializationService.runInitializationSequence(testWorldName);

            expect(mockLlmAdapterInstance.init).toHaveBeenCalledTimes(1);
            expect(result.success).toBe(true); // As per current design, overall sequence continues
            expect(mockLogger.error).toHaveBeenCalledWith(
                `InitializationService: CRITICAL error during ConfigurableLLMAdapter.init(): ${adapterInitError.message}`,
                expect.objectContaining({ errorName: adapterInitError.name })
            );
            // The "NOT OPERATIONAL" warning is not logged from the 'else' branch if init throws.
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining('ConfigurableLLMAdapter.init() completed BUT THE ADAPTER IS NOT OPERATIONAL.')
            );
        });

        // Test for when ILLMAdapter.init succeeds but isOperational is false
        it('should log WARNING if ILLMAdapter.init succeeds but adapter is not operational', async () => {
            mockLlmAdapterInstance.isInitialized.mockReturnValue(false); // Ensure init is attempted
            mockLlmAdapterInstance.init.mockImplementation(async () => {
                mockLlmAdapterInstance.isInitialized.mockReturnValue(true); // Init completed
                mockLlmAdapterInstance.isOperational.mockReturnValue(false); // But not operational
                return undefined;
            });

            const result = await initializationService.runInitializationSequence(testWorldName);

            expect(mockLlmAdapterInstance.init).toHaveBeenCalledTimes(1);
            expect(result.success).toBe(true);
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('CRITICAL error during ConfigurableLLMAdapter.init()'));
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'InitializationService: ConfigurableLLMAdapter.init() completed BUT THE ADAPTER IS NOT OPERATIONAL. Check adapter-specific logs (e.g., LlmConfigLoader errors).'
            );
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
            const uiError = new Error('Failed to resolve UI Facade');
            const originalResolve = container.resolve;
            const resolveSpy = jest.spyOn(container, 'resolve').mockImplementation((token) => {
                if (token === tokens.DomUiFacade) {
                    throw uiError;
                }
                return originalResolve.call(container, token);
            });

            // Clear previous error logs that might have occurred from adapter init during a successful general setup
            mockLogger.error.mockClear();

            const result = await initializationService.runInitializationSequence(testWorldName);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Failed to resolve DomUiFacade. UI might not function correctly if it was expected.'),
                uiError
            );
            expect(result.success).toBe(true);
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
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(dispatchError);

            await initializationService.runInitializationSequence(testWorldName);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to dispatch UI error events'), dispatchError);
        });
    });
});