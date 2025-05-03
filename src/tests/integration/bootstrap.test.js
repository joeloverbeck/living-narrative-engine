// Filename: src/tests/integration/bootstrap.test.js
// ****** CORRECTED FILE ******

import {describe, it, expect, beforeEach, jest} from '@jest/globals';

// --- Core Components Under Test ---
import AppContainer from '../../core/config/appContainer.js';
import {configureContainer} from '../../core/config/containerConfig.js';
import {tokens} from '../../core/config/tokens.js';
import SystemInitializer from '../../core/initializers/systemInitializer.js'; // Need the class for type checking
import {INITIALIZABLE} from '../../core/config/tags.js'; // Need the tag for SystemInitializer context

describe('Application Bootstrap Integration Test', () => {
    let container;
    let mockOutputDiv;
    let mockInputElement;
    let mockTitleElement;

    beforeEach(() => {
        // 1. Create mock DOM elements needed by configureContainer
        // Using actual elements ensures type compatibility if constructors check instanceof
        mockOutputDiv = document.createElement('div');
        mockInputElement = document.createElement('input');
        // VVVVVV CORRECTED LINE VVVVVV
        mockTitleElement = document.createElement('h1'); // Changed from 'div' to 'h1'
        // ^^^^^^ CORRECTED LINE ^^^^^^

        // 2. Create a fresh AppContainer instance for each test
        container = new AppContainer();

        // 3. Configure the container - This is the core action being tested indirectly
        // We wrap this in a try/catch *only* for the first basic test,
        // otherwise, we let errors propagate to fail the relevant test case.
        // configureContainer itself populates the 'container' instance.
    });

    it('should configure the container without throwing immediate errors', () => {
        // Assertion: configureContainer runs successfully.
        expect(() => {
            configureContainer(container, {
                outputDiv: mockOutputDiv,
                inputElement: mockInputElement,
                titleElement: mockTitleElement,
            });
        }).not.toThrow();

        // Optional: Basic check if logger got registered (it's the first one)
        expect(() => container.resolve(tokens.ILogger)).not.toThrow();
        const logger = container.resolve(tokens.ILogger);
        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe('function');
    });

    it('should be able to resolve all registered services defined in tokens', () => {
        // --- Arrange ---
        // Configure the container first
        configureContainer(container, {
            outputDiv: mockOutputDiv,
            inputElement: mockInputElement,
            titleElement: mockTitleElement,
        });

        const allTokenKeys = Object.keys(tokens);
        const allTokenValues = Object.values(tokens);

        // Basic sanity check
        expect(allTokenKeys.length).toBeGreaterThan(50); // Ensure tokens loaded
        expect(allTokenValues.length).toEqual(allTokenKeys.length);

        // --- Act & Assert ---
        // Iterate through every token value (the actual DI keys)
        for (const token of allTokenValues) {
            // Use expect().not.toThrow() around the resolution attempt.
            // This verifies that the factory function associated with the token
            // can execute successfully and resolve its own dependencies.
            expect(() => {
                const resolvedInstance = container.resolve(token);
                // Optional: Add a basic check that something was resolved
                expect(resolvedInstance).toBeDefined();
            }).not.toThrow(`Failed to resolve token: "${token}"`);

            // Log progress during test development/debugging (optional)
            // console.log(`Successfully resolved token: ${token}`);
        }
    });

    it('should resolve SystemInitializer and execute initializeAll without critical errors', async () => {
        // --- Arrange ---
        // Configure the container first
        configureContainer(container, {
            outputDiv: mockOutputDiv,
            inputElement: mockInputElement,
            titleElement: mockTitleElement,
        });

        // --- Act & Assert ---
        // Verify that the SystemInitializer itself can be resolved
        let systemInitializer;
        expect(() => {
            systemInitializer = container.resolve(tokens.SystemInitializer);
        }).not.toThrow('Failed to resolve SystemInitializer');

        expect(systemInitializer).toBeInstanceOf(SystemInitializer);

        // Verify that calling initializeAll (which resolves tagged services) runs
        // It might log errors for individual systems (handled by SystemInitializer),
        // but it shouldn't throw a critical error itself unless resolveByTag fails.
        await expect(systemInitializer.initializeAll())
            .resolves // Check that the promise resolves (doesn't reject)
            .toBeUndefined(); // initializeAll returns void (Promise<void>)
    });

    // THIS TEST SHOULD NOW PASS
    it('should resolve multiple INITIALIZABLE services via SystemInitializer', async () => {
        // --- Arrange ---
        // Spy on the container's resolveByTag method *before* configuration
        // Note: Spying on the prototype if direct instance spying is problematic
        // We need to spy on the actual instance's method AFTER the instance is created
        container = new AppContainer(); // Create container first
        const resolveByTagSpy = jest.spyOn(container, 'resolveByTag'); // Spy on the instance method

        // Configure the container
        configureContainer(container, {
            outputDiv: mockOutputDiv,
            inputElement: mockInputElement,
            titleElement: mockTitleElement, // Now passes the correct h1 element
        });

        // Resolve the initializer *after* configuration
        const systemInitializer = container.resolve(tokens.SystemInitializer);

        // --- Act ---
        // This call should no longer throw the DomRenderer error
        await systemInitializer.initializeAll();

        // --- Assert ---
        // Check that resolveByTag was called *by the initializer* with the correct tag
        expect(resolveByTagSpy).toHaveBeenCalledWith(INITIALIZABLE[0]); // INITIALIZABLE is defined as ['initializableSystem']

        // Restore the spy
        resolveByTagSpy.mockRestore();

        // Optional: Check if a few specific initializable tokens were resolved (implicitly by initializeAll)
        // This relies on initializeAll not throwing and the services being singletons.
        // Resolve them *after* initializeAll has run.
        expect(() => container.resolve(tokens.GameRuleSystem)).not.toThrow();
        // This resolution was previously failing due to the DomRenderer dependency issue
        expect(() => container.resolve(tokens.SystemLogicInterpreter)).not.toThrow();
        // Add more checks for key initializable systems if desired
    });
});