// tests/config/registrations/adapterRegistrations.test.js
// --- FILE START ---

import {describe, beforeEach, it, expect, jest} from '@jest/globals';
import {registerAdapters} from '../../../src/config/registrations/adapterRegistrations.js';
import {tokens} from '../../../src/config/tokens.js';

// --- JSDoc Type Imports ---
/** @typedef {import('../../../src/core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../src/core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../src/core/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeDispatcher */
/** @typedef {import('../../../src/core/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedDispatcher */
/** @typedef {ReturnType<typeof createMockContainer>} MockAppContainer */

// --- MOCK DEFINITIONS ---

// For EventBusTurnEndAdapter: constructor spy
jest.mock('../../../src/turns/adapters/eventBusTurnEndAdapter.js');

// For EventBusCommandInputGateway: auto-mock is often sufficient
jest.mock('../../../src/turns/adapters/eventBusCommandInputGateway.js');

// Spies for ConfigurableLLMAdapter and its dependencies
const mockClientApiKeyProviderConstructor = jest.fn();
const mockRetryHttpClientConstructor = jest.fn();
const mockLLMStrategyFactoryConstructor = jest.fn();
const mockLlmConfigLoaderConstructor = jest.fn(); // We will assert this is NOT called
const mockConfigurableLLMAdapterConstructor = jest.fn();
const mockConfigurableLLMAdapterInit = jest.fn().mockResolvedValue(undefined); // Will assert NOT called by this registration
const mockConfigurableLLMAdapterIsOperational = jest.fn().mockReturnValue(true);

jest.mock('../../../src/llms/clientApiKeyProvider.js', () => ({
    ClientApiKeyProvider: jest.fn().mockImplementation((...args) => {
        mockClientApiKeyProviderConstructor(...args);
        // Return a simple object mock that can be passed as a dependency
        return {getKey: jest.fn()};
    })
}));

jest.mock('../../../src/llms/retryHttpClient.js', () => ({
    RetryHttpClient: jest.fn().mockImplementation((...args) => {
        mockRetryHttpClientConstructor(...args);
        // Return a simple object mock
        return {request: jest.fn()};
    })
}));

jest.mock('../../../src/llms/LLMStrategyFactory.js', () => ({
    LLMStrategyFactory: jest.fn().mockImplementation((...args) => {
        mockLLMStrategyFactoryConstructor(...args);
        // Return a simple object mock
        return {getStrategy: jest.fn()};
    })
}));

// LlmConfigLoader is NOT expected to be constructed by registerAdapters anymore for ILLMAdapter's factory.
// So, its mock will primarily be used to check it's NOT called.
jest.mock('../../../src/llms/services/llmConfigLoader.js', () => ({
    LlmConfigLoader: jest.fn().mockImplementation((...args) => {
        mockLlmConfigLoaderConstructor(...args);
        return {
            loadConfigs: jest.fn().mockResolvedValue({llms: {}})
        };
    })
}));

jest.mock('../../../src/turns/adapters/configurableLLMAdapter.js', () => ({
    ConfigurableLLMAdapter: jest.fn().mockImplementation(function (...args) {
        mockConfigurableLLMAdapterConstructor(...args);
        this.deps = args[0]; // Store constructor args for inspection if needed
        // Mock methods that ConfigurableLLMAdapter instance would have
        this.init = mockConfigurableLLMAdapterInit;
        this.isOperational = mockConfigurableLLMAdapterIsOperational;
        this.isInitialized = jest.fn(); // Add other methods if needed by tests
        // ... other methods like getAIDecision, setActiveLlm etc. could be mocked here
    })
}));

// --- IMPORT MOCKED MODULES (and others) ---
import EventBusTurnEndAdapter from '../../../src/turns/adapters/eventBusTurnEndAdapter.js';
import {EventBusCommandInputGateway} from '../../../src/turns/adapters/eventBusCommandInputGateway.js';


// --- Mock Custom DI Container ---
const createMockContainer = () => {
    const registrations = new Map();
    const resolvedInstances = new Map();

    const container = {
        _registrations: registrations,
        _resolvedInstances: resolvedInstances,
        _factoriesInvoked: new Set(),

        register: jest.fn((token, factoryOrValue, options = {}) => {
            registrations.set(token, {factoryOrValue, options, tokenString: String(token)});
            resolvedInstances.delete(token);
        }),

        resolve: jest.fn((token) => {
            const registration = registrations.get(token);
            if (!registration) {
                const registeredTokens = Array.from(registrations.keys()).map(String).join(', ');
                throw new Error(`Mock Resolve Error: Token not registered: ${String(token)}. Registered: [${registeredTokens}]`);
            }

            const {factoryOrValue, options} = registration;

            if (options?.lifecycle === 'singletonFactory') {
                if (resolvedInstances.has(token)) {
                    return resolvedInstances.get(token);
                }
                if (typeof factoryOrValue !== 'function') {
                    throw new Error(`Mock Resolve Error: singletonFactory for ${String(token)} is not a function.`);
                }
                const instance = factoryOrValue(container); // Pass container to factory
                resolvedInstances.set(token, instance);
                container._factoriesInvoked.add(token);
                return instance;
            } else if (options?.lifecycle === 'singleton') {
                if (resolvedInstances.has(token)) {
                    return resolvedInstances.get(token);
                }
                let instance;
                if (typeof factoryOrValue === 'function' && factoryOrValue.prototype && typeof factoryOrValue.prototype.constructor === 'function' && factoryOrValue.name === factoryOrValue.prototype.constructor.name) {
                    instance = new factoryOrValue(); // Simplistic new for classes not needing deps here
                } else if (typeof factoryOrValue === 'function') {
                    instance = factoryOrValue(container); // Pass container to factory
                } else {
                    instance = factoryOrValue;
                }
                resolvedInstances.set(token, instance);
                return instance;
            }
            // Default to transient: if it's a class, instantiate it. If it's a factory function, call it.
            if (typeof factoryOrValue === 'function' && factoryOrValue.prototype && typeof factoryOrValue.prototype.constructor === 'function' && factoryOrValue.name === factoryOrValue.prototype.constructor.name) {
                return new factoryOrValue();
            } else if (typeof factoryOrValue === 'function') {
                return factoryOrValue(container);
            }
            return factoryOrValue;
        }),
        isRegistered: jest.fn((token) => registrations.has(token)),
        clearRegistrations: () => {
            registrations.clear();
            resolvedInstances.clear();
            container._factoriesInvoked.clear();
            container.resolve.mockClear();
            container.register.mockClear();
        }
    };
    return container;
};


describe('Adapter Registrations - registerAdapters', () => {
    /** @type {MockAppContainer} */
    let mockContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {ISafeDispatcher} */
    let mockSafeEventDispatcher;
    /** @type {IValidatedDispatcher} */
    let mockValidatedEventDispatcher;
    /** @type {jest.Mocked<ISchemaValidator>} */
    let mockSchemaValidator; // Keep for completeness, though not directly used by this corrected test much
    /** @type {jest.Mocked<IConfiguration>} */
    let mockConfiguration; // Keep for completeness

    beforeEach(() => {
        jest.clearAllMocks();

        mockContainer = createMockContainer();

        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        mockSafeEventDispatcher = {
            dispatchSafely: jest.fn(),
        };

        mockValidatedEventDispatcher = {
            dispatchValidated: jest.fn(),
            subscribe: jest.fn(),
            unsubscribe: jest.fn(),
        };

        mockSchemaValidator = {
            addSchema: jest.fn().mockResolvedValue(undefined),
            removeSchema: jest.fn().mockReturnValue(true),
            getValidator: jest.fn().mockReturnValue(() => ({isValid: true, errors: null})),
            isSchemaLoaded: jest.fn().mockReturnValue(true),
            validate: jest.fn().mockReturnValue({isValid: true, errors: null}),
        };

        mockConfiguration = {
            getBaseDataPath: jest.fn().mockReturnValue('./data'),
            getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
            getContentBasePath: jest.fn().mockReturnValue('content_type'),
            getWorldBasePath: jest.fn().mockReturnValue('worlds'),
            getRuleBasePath: jest.fn().mockReturnValue('rules'),
            getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
            getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
            getModsBasePath: jest.fn().mockReturnValue('mods'),
            getSchemaFiles: jest.fn().mockReturnValue([]),
            getContentTypeSchemaId: jest.fn((typeName) => {
                if (typeName === 'llm-configs') {
                    return 'http://example.com/schemas/llm-configs.schema.json';
                }
                return undefined;
            }),
            getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/rule.schema.json'),
        };

        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ISchemaValidator, mockSchemaValidator, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IConfiguration, mockConfiguration, {lifecycle: 'singleton'});
    });

    it('should register EventBusTurnEndAdapter with ISafeEventDispatcher if available, and logger', () => {
        mockContainer.register(tokens.ISafeEventDispatcher, mockSafeEventDispatcher, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});

        registerAdapters(mockContainer);
        mockContainer.resolve(tokens.ITurnEndPort);

        expect(EventBusTurnEndAdapter).toHaveBeenCalledTimes(1);
        const constructorArgs = EventBusTurnEndAdapter.mock.calls[0][0];
        expect(constructorArgs.safeEventDispatcher).toBe(mockSafeEventDispatcher);
        expect(constructorArgs.validatedEventDispatcher).toBe(mockValidatedEventDispatcher);
        expect(constructorArgs.logger).toBe(mockLogger);
        expect(mockLogger.info).toHaveBeenCalledWith('Adapter Registrations: Starting...');
        expect(mockLogger.debug).toHaveBeenCalledWith(`Adapter Registration: Registered EventBusTurnEndAdapter as ${tokens.ITurnEndPort}.`);
    });

    it('should register EventBusTurnEndAdapter with IValidatedEventDispatcher (and logger) if ISafeEventDispatcher is NOT available', () => {
        const originalResolve = mockContainer.resolve;
        mockContainer.resolve = jest.fn((token) => {
            if (token === tokens.ISafeEventDispatcher) return null;
            return originalResolve.call(mockContainer, token);
        });
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});

        registerAdapters(mockContainer);
        mockContainer.resolve(tokens.ITurnEndPort);

        expect(EventBusTurnEndAdapter).toHaveBeenCalledTimes(1);
        const constructorArgs = EventBusTurnEndAdapter.mock.calls[0][0];
        expect(constructorArgs.safeEventDispatcher).toBeNull();
        expect(constructorArgs.validatedEventDispatcher).toBe(mockValidatedEventDispatcher);
        expect(constructorArgs.logger).toBe(mockLogger);
    });

    it('should throw an error during resolution if neither dispatcher is available for EventBusTurnEndAdapter', () => {
        const originalResolve = mockContainer.resolve;
        mockContainer.resolve = jest.fn((token) => {
            if (token === tokens.ISafeEventDispatcher) return null;
            if (token === tokens.IValidatedEventDispatcher) return null;
            return originalResolve.call(mockContainer, token);
        });

        expect(() => {
            registerAdapters(mockContainer);
            mockContainer.resolve(tokens.ITurnEndPort);
        }).toThrow('Missing dispatcher dependency for EventBusTurnEndAdapter');

        expect(mockLogger.error).toHaveBeenCalledWith(
            `Adapter Registration: Failed to resolve either ${tokens.ISafeEventDispatcher} or ${tokens.IValidatedEventDispatcher} for ${tokens.ITurnEndPort}.`
        );
        expect(EventBusTurnEndAdapter).not.toHaveBeenCalled();
    });


    it('should correctly register EventBusCommandInputGateway', () => {
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});
        registerAdapters(mockContainer);
        mockContainer.resolve(tokens.ICommandInputPort);

        expect(EventBusCommandInputGateway).toHaveBeenCalledTimes(1);
        expect(EventBusCommandInputGateway.mock.calls[0][0]).toEqual({validatedEventDispatcher: mockValidatedEventDispatcher});
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(
            `Adapter Registration: Registered EventBusCommandInputGateway as ${tokens.ICommandInputPort}`
        ));
    });

    // VVVVVV THIS IS THE CORRECTED TEST VVVVVV
    it('should pass the resolved logger to ConfigurableLLMAdapter and its direct dependencies during its registration', () => {
        registerAdapters(mockContainer);
        const llmAdapterInstance = mockContainer.resolve(tokens.ILLMAdapter); // This invokes the factory for ILLMAdapter

        // Assertions for dependencies of components created directly within registerAdapters

        // ClientApiKeyProvider is instantiated inside registerAdapters
        expect(mockClientApiKeyProviderConstructor).toHaveBeenCalledTimes(1);
        expect(mockClientApiKeyProviderConstructor).toHaveBeenCalledWith(expect.objectContaining({logger: mockLogger}));

        // RetryHttpClient is instantiated inside registerAdapters
        expect(mockRetryHttpClientConstructor).toHaveBeenCalledTimes(1);
        expect(mockRetryHttpClientConstructor).toHaveBeenCalledWith(expect.objectContaining({logger: mockLogger}));

        // LLMStrategyFactory is instantiated inside registerAdapters
        expect(mockLLMStrategyFactoryConstructor).toHaveBeenCalledTimes(1);
        expect(mockLLMStrategyFactoryConstructor).toHaveBeenCalledWith(expect.objectContaining({
            logger: mockLogger,
            httpClient: expect.any(Object) // This is the instance from mockRetryHttpClientConstructor
        }));

        // ConfigurableLLMAdapter constructor is called when its factory is invoked
        expect(mockConfigurableLLMAdapterConstructor).toHaveBeenCalledTimes(1);
        const adapterConstructorArgs = mockConfigurableLLMAdapterConstructor.mock.calls[0][0];
        expect(adapterConstructorArgs.logger).toBe(mockLogger); // Because the factory resolves ILogger
        expect(adapterConstructorArgs.environmentContext).toBeDefined(); // EnvironmentContext is created in registerAdapters
        expect(adapterConstructorArgs.apiKeyProvider).toEqual(expect.any(Object)); // Instance from mockClientApiKeyProviderConstructor
        expect(adapterConstructorArgs.llmStrategyFactory).toEqual(expect.any(Object)); // Instance from mockLLMStrategyFactoryConstructor

        // Assert that LlmConfigLoader is NOT constructed by registerAdapters's ILLMAdapter factory
        expect(mockLlmConfigLoaderConstructor).not.toHaveBeenCalled();

        // Assert that ConfigurableLLMAdapter.init is NOT called directly by the factory in registerAdapters
        expect(mockConfigurableLLMAdapterInit).not.toHaveBeenCalled();

        // Verify the adapter instance from the factory has the mock methods (verifies the mock structure)
        // This confirms that the factory returned an instance of our mocked ConfigurableLLMAdapter
        expect(llmAdapterInstance.init).toBe(mockConfigurableLLMAdapterInit);
        expect(llmAdapterInstance.isOperational).toBe(mockConfigurableLLMAdapterIsOperational);
    });
    // ^^^^^^ THIS IS THE CORRECTED TEST ^^^^^^
});
// --- FILE END ---