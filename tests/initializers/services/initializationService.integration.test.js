// src/tests/core/initializers/services/initializationService.integration.test.js

import AppContainer from '../../../src/config/appContainer.js';
import InitializationService from '../../../src/initializers/services/initializationService.js'; // Adjust path if needed
import {registerOrchestration} from '../../../src/config/registrations/orchestrationRegistrations.js'; // Function under test (partially)
import {tokens} from '../../../src/config/tokens.js';
import {beforeEach, describe, expect, it, jest, afterEach} from "@jest/globals"; // Added afterEach

// --- Mocks ---
// Mock minimal ILogger
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// Mock minimal IValidatedEventDispatcher
const mockValidatedEventDispatcher = {
    dispatchValidated: jest.fn().mockResolvedValue(undefined), // Mock the async method
};

// --- Test Suite ---
describe('InitializationService Integration with AppContainer', () => {
    let container;

    beforeEach(() => {
        // Create a fresh container for each test
        container = new AppContainer();

        // Reset mocks before each test (clears calls from previous tests)
        jest.clearAllMocks();

        // --- Pre-register Dependencies ---
        // InitializationService's factory *needs* these to be registered first.
        container.register(tokens.ILogger, () => mockLogger, {lifecycle: 'singleton'});
        container.register(tokens.IValidatedEventDispatcher, () => mockValidatedEventDispatcher, {lifecycle: 'singleton'});

        // We *could* also mock and register GameLoop etc. if testing ShutdownService,
        // but for this specific bug in InitializationService, only its direct dependencies are needed.
    });

    afterEach(() => {
        if (container) { // Ensure container exists before trying to reset
            container.reset(); // Clean up container registrations and instances
        }
    });

    it('should resolve InitializationService without throwing "key undefined" error after fix', () => {
        // --- Arrange ---
        // Run the registration function that defines the InitializationService factory.
        registerOrchestration(container);

        // --- Act & Assert ---
        // Attempt to resolve the service. THIS is the step that previously failed.
        let resolvedService = null;
        expect(() => {
            resolvedService = container.resolve(tokens.IInitializationService);
        }).not.toThrow(/AppContainer: No service registered for key "undefined"/); // Check it doesn't throw the SPECIFIC error

        // Further check: ensure we actually got an instance
        expect(resolvedService).toBeDefined();
        expect(resolvedService).toBeInstanceOf(InitializationService);
    });

    it('should inject and use the logger dependency during construction', () => {
        // --- Arrange ---
        // Register the service using the orchestration logic. This will cause some logs.
        registerOrchestration(container);

        // <<< --- ADDED: Clear mock history after arrangement --- >>>
        // Clear any calls made to the logger during registration setup.
        mockLogger.info.mockClear();
        // You could also clear other mockLogger methods if needed:
        // mockLogger.debug.mockClear();
        // mockLogger.warn.mockClear();
        // mockLogger.error.mockClear();

        // --- Act ---
        // Resolve the service. This triggers the constructor, which should log.
        const resolvedService = container.resolve(tokens.IInitializationService);

        // --- Assert ---
        // Verify the service is created
        expect(resolvedService).toBeInstanceOf(InitializationService);

        // Verify that the constructor used the injected logger *exactly once* since mockClear()
        // Based on: this.#logger.info('InitializationService: Instance created successfully with dependencies.');
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith('InitializationService: Instance created successfully with dependencies.');

        // Note: Directly testing the injection of #validatedEventDispatcher and #container
        // via the constructor is not straightforward without accessing private fields.
        // To test them, you would typically call a method on `resolvedService`
        // (e.g., `runInitializationSequence`) that *uses* those dependencies,
        // and then assert that the corresponding mock methods were called
        // (e.g., `mockValidatedEventDispatcher.dispatchValidated`).
    });

});