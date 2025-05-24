// tests/config/registrations/adapterRegistrations.test.js
// --- FILE START ---

import {describe, beforeEach, it, expect, jest} from '@jest/globals';
import {registerAdapters} from '../../../src/config/registrations/adapterRegistrations.js';
import {tokens} from '../../../src/config/tokens.js';

// --- JSDoc Type Imports ---
/** @typedef {import('../../../src/core/interfaces/coreServices.js').ILogger} ILogger */
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
const mockLlmConfigLoaderConstructor = jest.fn();
const mockConfigurableLLMAdapterConstructor = jest.fn();
const mockConfigurableLLMAdapterInit = jest.fn().mockResolvedValue(undefined);
const mockConfigurableLLMAdapterIsOperational = jest.fn().mockReturnValue(true);

jest.mock('../../../src/llms/clientApiKeyProvider.js', () => ({
    ClientApiKeyProvider: jest.fn().mockImplementation((...args) => {
        mockClientApiKeyProviderConstructor(...args);
        return {};
    })
}));

jest.mock('../../../src/llms/retryHttpClient.js', () => ({
    RetryHttpClient: jest.fn().mockImplementation((...args) => {
        mockRetryHttpClientConstructor(...args);
        return {};
    })
}));

jest.mock('../../../src/llms/LLMStrategyFactory.js', () => ({
    LLMStrategyFactory: jest.fn().mockImplementation((...args) => {
        mockLLMStrategyFactoryConstructor(...args);
        return {};
    })
}));

jest.mock('../../../src/services/llmConfigLoader.js', () => ({
    LlmConfigLoader: jest.fn().mockImplementation((...args) => {
        mockLlmConfigLoaderConstructor(...args);
        return {};
    })
}));

jest.mock('../../../src/turns/adapters/configurableLLMAdapter.js', () => ({
    ConfigurableLLMAdapter: jest.fn().mockImplementation(function (...args) {
        mockConfigurableLLMAdapterConstructor(...args);
        this.deps = args[0];
        this.init = mockConfigurableLLMAdapterInit;
        this.isOperational = mockConfigurableLLMAdapterIsOperational;
    })
}));

// --- IMPORT MOCKED MODULES (and others) ---
import EventBusTurnEndAdapter from '../../../src/turns/adapters/eventBusTurnEndAdapter.js';
import {EventBusCommandInputGateway} from '../../../src/turns/adapters/eventBusCommandInputGateway.js';
// Note: ClientApiKeyProvider etc. are already available as mocks due to jest.mock above.
// We can refer to the mock constructor directly (e.g., ClientApiKeyProvider) for assertions.
// No need to re-import them separately here if we use the spies like mockClientApiKeyProviderConstructor.

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
                const instance = factoryOrValue(container);
                resolvedInstances.set(token, instance);
                container._factoriesInvoked.add(token);
                return instance;
            } else if (options?.lifecycle === 'singleton') {
                if (resolvedInstances.has(token)) {
                    return resolvedInstances.get(token);
                }
                let instance;
                if (typeof factoryOrValue === 'function' && factoryOrValue.prototype && factoryOrValue.prototype.constructor === factoryOrValue) {
                    instance = new factoryOrValue();
                } else if (typeof factoryOrValue === 'function') {
                    instance = factoryOrValue();
                } else {
                    instance = factoryOrValue;
                }
                resolvedInstances.set(token, instance);
                return instance;
            }
            if (typeof factoryOrValue === 'function' && factoryOrValue.prototype && factoryOrValue.prototype.constructor === factoryOrValue) {
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
    let mockLogger; // jest.Mocked is JSDoc sugar, not functional in JS
    /** @type {ISafeDispatcher} */
    let mockSafeEventDispatcher;
    /** @type {IValidatedDispatcher} */
    let mockValidatedEventDispatcher;

    beforeEach(() => {
        jest.clearAllMocks();

        mockClientApiKeyProviderConstructor.mockClear();
        mockRetryHttpClientConstructor.mockClear();
        mockLLMStrategyFactoryConstructor.mockClear();
        mockLlmConfigLoaderConstructor.mockClear();
        mockConfigurableLLMAdapterConstructor.mockClear();
        mockConfigurableLLMAdapterInit.mockClear();
        mockConfigurableLLMAdapterIsOperational.mockClear();

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

        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
    });

    it('should register EventBusTurnEndAdapter with ISafeEventDispatcher if available, and logger', () => {
        mockContainer.register(tokens.ISafeEventDispatcher, mockSafeEventDispatcher, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockValidatedEventDispatcher, {lifecycle: 'singleton'});

        registerAdapters(mockContainer);
        mockContainer.resolve(tokens.ITurnEndPort); // This invokes the factory defined in registerAdapters

        expect(EventBusTurnEndAdapter).toHaveBeenCalledTimes(1);
        // EventBusTurnEndAdapter is a mock constructor. Access its calls.
        const constructorArgs = EventBusTurnEndAdapter.mock.calls[0][0];
        expect(constructorArgs.safeEventDispatcher).toBe(mockSafeEventDispatcher);
        expect(constructorArgs.validatedEventDispatcher).toBe(mockValidatedEventDispatcher);
        expect(constructorArgs.logger).toBe(mockLogger);
        expect(mockLogger.info).toHaveBeenCalledWith('Adapter Registrations: Starting...');
        expect(mockLogger.debug).toHaveBeenCalledWith(`Adapter Registration: Registered EventBusTurnEndAdapter as ${tokens.ITurnEndPort}.`);
    });

    it('should register EventBusTurnEndAdapter with IValidatedEventDispatcher (and logger) if ISafeEventDispatcher is NOT available', () => {
        const originalResolve = mockContainer.resolve.bind(mockContainer);
        mockContainer.resolve = jest.fn((token) => {
            if (token === tokens.ISafeEventDispatcher) return null;
            if (token === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
            if (token === tokens.ILogger) return mockLogger;
            return originalResolve(token);
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
        const originalResolve = mockContainer.resolve.bind(mockContainer);
        mockContainer.resolve = jest.fn((token) => {
            if (token === tokens.ISafeEventDispatcher) return null;
            if (token === tokens.IValidatedEventDispatcher) return null;
            if (token === tokens.ILogger) return mockLogger;
            return originalResolve(token);
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
        // EventBusCommandInputGateway is a mock constructor here (from the top-level jest.mock)
        expect(EventBusCommandInputGateway.mock.calls[0][0]).toEqual({validatedEventDispatcher: mockValidatedEventDispatcher});
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(
            `Adapter Registration: Registered EventBusCommandInputGateway as ${tokens.ICommandInputPort}`
        ));
    });

    it('should pass the resolved logger to ConfigurableLLMAdapter and its dependencies', () => {
        // Import the actual ConfigurableLLMAdapter to get its (mocked) instance methods
        const {ConfigurableLLMAdapter} = require('../../../src/turns/adapters/configurableLLMAdapter.js');

        registerAdapters(mockContainer);
        const llmAdapterInstance = mockContainer.resolve(tokens.ILLMAdapter);

        expect(mockClientApiKeyProviderConstructor).toHaveBeenCalledWith(expect.objectContaining({logger: mockLogger}));
        expect(mockRetryHttpClientConstructor).toHaveBeenCalledWith(expect.objectContaining({logger: mockLogger}));
        expect(mockLLMStrategyFactoryConstructor).toHaveBeenCalledWith(expect.objectContaining({
            logger: mockLogger,
            httpClient: expect.any(Object)
        }));
        expect(mockLlmConfigLoaderConstructor).toHaveBeenCalledWith(expect.objectContaining({logger: mockLogger}));

        expect(mockConfigurableLLMAdapterConstructor).toHaveBeenCalledTimes(1);
        const adapterConstructorArgs = mockConfigurableLLMAdapterConstructor.mock.calls[0][0];
        expect(adapterConstructorArgs.logger).toBe(mockLogger);
        expect(adapterConstructorArgs.environmentContext).toBeDefined();
        expect(adapterConstructorArgs.apiKeyProvider).toBeInstanceOf(Object);
        expect(adapterConstructorArgs.llmStrategyFactory).toBeInstanceOf(Object);

        // llmAdapterInstance is an instance of the mocked ConfigurableLLMAdapter
        // Its methods 'init' and 'isOperational' are the spies we defined:
        // mockConfigurableLLMAdapterInit and mockConfigurableLLMAdapterIsOperational
        expect(llmAdapterInstance.init).toBe(mockConfigurableLLMAdapterInit);
        expect(llmAdapterInstance.isOperational).toBe(mockConfigurableLLMAdapterIsOperational);

        expect(mockConfigurableLLMAdapterInit).toHaveBeenCalledTimes(1);
        expect(mockConfigurableLLMAdapterInit).toHaveBeenCalledWith(expect.objectContaining({
            llmConfigLoader: expect.any(Object)
        }));
    });
});
// --- FILE END ---