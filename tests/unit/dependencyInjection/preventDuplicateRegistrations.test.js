// tests/unit/dependencyInjection/preventDuplicateRegistrations.test.js
// --- FILE START ---

import { describe, it, expect, jest } from '@jest/globals';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

// Mock the async logger config loader to make the test synchronous and simpler.
// This avoids needing to mock file system fetches during the test.
jest.mock('../../../src/configuration/loggerConfigLoader.js', () => ({
    LoggerConfigLoader: jest.fn().mockImplementation(() => ({
        loadConfig: jest.fn().mockResolvedValue({ logLevel: 'INFO' }),
    })),
}));

/**
 * Creates a mock DI container that spies on registrations.
 * @returns A mock container object with `register`, `resolve`, `isRegistered` methods
 * and a `registrations` property to inspect calls.
 */
const createMockContainer = () => {
    const registrations = {};
    const resolvedInstances = new Map();

    const container = {
        registrations,
        register: jest.fn((key, factory, options) => {
            // Track every registration call for each token
            if (!registrations[key]) {
                registrations[key] = [];
            }
            registrations[key].push({ factory, options });

            // For the logger, we need to create and cache an instance so it can be resolved by other services during setup.
            if (key === tokens.ILogger) {
                const loggerInstance = {
                    debug: jest.fn(),
                    info: jest.fn(),
                    warn: jest.fn(),
                    error: jest.fn(),
                    setLogLevel: jest.fn(),
                };
                resolvedInstances.set(tokens.ILogger, loggerInstance);
            }
        }),
        resolve: jest.fn(key => {
            // The resolver needs to return a mock logger for the registration functions to work.
            if (resolvedInstances.has(key)) {
                return resolvedInstances.get(key);
            }
            // For other dependencies, return a generic mock function.
            return jest.fn();
        }),
        isRegistered: jest.fn(key => {
            return key in registrations;
        }),
    };
    return container;
};

describe('Dependency Injection Configuration', () => {
    it('should register each service token exactly once to avoid overwrites', () => {
        const mockContainer = createMockContainer();

        // Mock the essential UI elements required by the `configureContainer` function.
        const uiElements = {
            outputDiv: 'mock-div',
            inputElement: 'mock-input',
            titleElement: 'mock-title',
            document: 'mock-document',
        };

        // Execute the main container configuration function, which calls all the registration modules.
        configureContainer(mockContainer, uiElements);

        const allRegisteredTokens = Object.keys(mockContainer.registrations);
        const duplicates = [];

        // Iterate through all registered tokens and check their registration count.
        allRegisteredTokens.forEach(token => {
            const callCount = mockContainer.registrations[token].length;
            if (callCount > 1) {
                duplicates.push({ token, count: callCount });
            }
        });

        // The primary assertion: there should be no duplicate registrations.
        // We format the error message to be helpful if the test fails.
        expect(duplicates).toEqual([]);

        // You can also add more specific checks for the tokens that were previously causing issues.
        const problematicTokens = [
            tokens.PromptTextLoader,
            tokens.ModsLoader,
        ];

        problematicTokens.forEach(token => {
            // Ensure the problematic tokens exist in the registration map before checking count
            if (mockContainer.registrations[token]) {
                const registrationCount = mockContainer.registrations[token].length;
                expect(registrationCount).toBe(1);
            }
        });
    });
});