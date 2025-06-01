// ****** CORRECTED FILE ******
// src/tests/domUI/RendererBase.test.js
/**
 * @fileoverview Unit tests for the RendererBase abstract class.
 * @jest-environment jsdom
 */

import {beforeEach, afterEach, describe, expect, it, jest} from '@jest/globals';
import {RendererBase} from '../../src/domUI/index.js'; // Assumes index exports RendererBase
import DocumentContext from '../../src/domUI/documentContext.js';

// --- Mock Dependencies ---

// Define Interfaces using JSDoc for clarity in mocks (optional but good practice)
/** @typedef {import('../../core/interfaces/ILogger').ILogger} ILogger */
/** @typedef {import('../../src/interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../../src/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */

/** @returns {ILogger} */
const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

/** @returns {IValidatedEventDispatcher} */
const createMockVed = () => ({
    dispatchValidated: jest.fn(),
    // Add subscribe/unsubscribe if needed by base or derived classes during tests
    subscribe: jest.fn(() => ({unsubscribe: jest.fn()})),
});

/** @returns {IDocumentContext} */
const createRealDocContext = () => {
    if (typeof document === 'undefined') {
        throw new Error("JSDOM 'document' is not available. Ensure environment is 'jsdom'.");
    }
    // Ensure body exists for appending if needed later, though DocumentContext itself doesn't require it
    const rootElement = document.body || document.createElement('div');
    if (!document.body) {
        document.appendChild(rootElement);
    }
    return new DocumentContext(rootElement);
};

// --- Concrete Test Class ---
class ConcreteRenderer extends RendererBase {
    /**
     * @param {{logger: ILogger, documentContext: IDocumentContext, validatedEventDispatcher: IValidatedEventDispatcher}} deps
     */
    constructor(deps) {
        // --- FIX: Pass a single object map to super ---
        // The base constructor expects an object like: { logger, documentContext, validatedEventDispatcher }
        super(deps);
    }

    renderSomething() {
        // Access logger via this.logger (inherited and assigned in base)
        this.logger.info(`${this._logPrefix} Rendering something...`);
    }
}

// --- Test Suite ---

describe('RendererBase', () => {
    /** @type {ILogger} */
    let mockLogger;
    /** @type {IValidatedEventDispatcher} */
    let mockVed;
    /** @type {IDocumentContext} */
    let docContext;
    /** @type {{logger: ILogger, documentContext: IDocumentContext, validatedEventDispatcher: IValidatedEventDispatcher}} */
    let validDeps;

    beforeEach(() => {
        mockLogger = createMockLogger();
        mockVed = createMockVed();
        docContext = createRealDocContext();
        // --- FIX: Use consistent key names matching RendererBase constructor signature ---
        validDeps = {
            logger: mockLogger,
            documentContext: docContext,
            validatedEventDispatcher: mockVed
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (document && document.body) {
            document.body.innerHTML = '';
        }
    });

    // --- Constructor Tests ---
    describe('Constructor', () => {
        it('should successfully create an instance with valid dependencies', () => {
            // --- FIX: Constructor call is now correct ---
            expect(() => new ConcreteRenderer(validDeps)).not.toThrow();
            const instance = new ConcreteRenderer(validDeps);
            // Check initialization log (uses _logPrefix which depends on class name)
            expect(mockLogger.debug).toHaveBeenCalledWith('[ConcreteRenderer] Initialized.');
        });

        it('should throw an error if logger is missing or invalid', () => {
            // --- FIX: Error message comes from RendererBase validation now, not destructuring ---
            expect(() => new ConcreteRenderer({...validDeps, logger: null}))
                .toThrow('ConcreteRenderer: Logger dependency is missing or invalid.');
            expect(() => new ConcreteRenderer({...validDeps, logger: undefined}))
                .toThrow('ConcreteRenderer: Logger dependency is missing or invalid.');
            // Test case for invalid type (missing debug function)
            expect(() => new ConcreteRenderer({...validDeps, logger: {info: jest.fn()}}))
                .toThrow('ConcreteRenderer: Logger dependency is missing or invalid.');
        });

        it('should throw an error if ValidatedEventDispatcher is missing or invalid', () => {
            // --- FIX: Use correct key 'validatedEventDispatcher' ---
            // --- FIX: Test should now correctly isolate this failure ---
            expect(() => new ConcreteRenderer({...validDeps, validatedEventDispatcher: null}))
                .toThrow('ConcreteRenderer: ValidatedEventDispatcher dependency is missing or invalid.');
            expect(() => new ConcreteRenderer({...validDeps, validatedEventDispatcher: undefined}))
                .toThrow('ConcreteRenderer: ValidatedEventDispatcher dependency is missing or invalid.');
            // Test case for invalid type (missing dispatchValidated function)
            expect(() => new ConcreteRenderer({...validDeps, validatedEventDispatcher: {someOtherFunc: jest.fn()}}))
                .toThrow('ConcreteRenderer: ValidatedEventDispatcher dependency is missing or invalid.');
        });

        it('should throw an error if DocumentContext is missing or invalid', () => {
            // --- FIX: Use correct key 'documentContext' ---
            // --- FIX: Test should now correctly isolate this failure ---
            expect(() => new ConcreteRenderer({...validDeps, documentContext: null}))
                .toThrow('ConcreteRenderer: DocumentContext dependency is missing or invalid.');
            expect(() => new ConcreteRenderer({...validDeps, documentContext: undefined}))
                .toThrow('ConcreteRenderer: DocumentContext dependency is missing or invalid.');
            // Test case for invalid type (missing query function)
            expect(() => new ConcreteRenderer({...validDeps, documentContext: {create: jest.fn()}}))
                .toThrow('ConcreteRenderer: DocumentContext dependency is missing or invalid.');
            // Test case for invalid type (missing create function)
            expect(() => new ConcreteRenderer({...validDeps, documentContext: {query: jest.fn()}}))
                .toThrow('ConcreteRenderer: DocumentContext dependency is missing or invalid.');
        });

        it("should throw an error if 'RendererBase' is instantiated directly", () => {
            // Need to temporarily bypass the constructor check in the test
            // This is tricky because the check happens *before* dependency validation
            // We can test it by trying to call the constructor directly, if possible,
            // or acknowledge this might be hard to test directly without altering the class.
            // A common way is to expect `new RendererBase(...)` to throw.
            // Since it expects an object, we provide a minimal valid-looking one.
            expect(() => new RendererBase(validDeps))
                .toThrow("Abstract class 'RendererBase' cannot be instantiated directly.");
        });
    });

    // --- Getter/Property Access Tests ---
    describe('Protected Property Access', () => { // Renamed from Getters as they are direct properties now
        /** @type {ConcreteRenderer} */
        let instance;
        beforeEach(() => {
            // --- FIX: Instance creation should now succeed ---
            instance = new ConcreteRenderer(validDeps);
        });

        it('should provide access to the logger', () => {
            // --- FIX: Access the 'logger' property ---
            expect(instance.logger).toBe(mockLogger);
        });

        it('should provide access to the ValidatedEventDispatcher', () => {
            // --- FIX: Access the 'validatedEventDispatcher' property ---
            expect(instance.validatedEventDispatcher).toBe(mockVed);
        });

        it('should provide access to the DocumentContext', () => {
            // --- FIX: Access the 'documentContext' property ---
            expect(instance.documentContext).toBe(docContext);
            // --- FIX: Check methods on the correct property ---
            expect(typeof instance.documentContext.query).toBe('function');
            expect(typeof instance.documentContext.create).toBe('function');
        });
    });

    // --- Log Prefix Helper Test ---
    describe('_logPrefix', () => {
        it('should generate the correct log prefix based on the concrete class name', () => {
            // --- FIX: Instance creation should now succeed ---
            const instance = new ConcreteRenderer(validDeps);
            // Check the log message that uses the prefix during initialization.
            expect(mockLogger.debug).toHaveBeenCalledWith('[ConcreteRenderer] Initialized.');
            // Optionally call a method that uses the prefix
            instance.renderSomething();
            expect(mockLogger.info).toHaveBeenCalledWith('[ConcreteRenderer] Rendering something...');
            // Test the property directly if needed (though testing its *use* is better)
            expect(instance._logPrefix).toBe('[ConcreteRenderer]');
        });

        it('should work correctly for a different derived class name', () => {
            class AnotherRenderer extends RendererBase {
                /**
                 * @param {{logger: ILogger, documentContext: IDocumentContext, validatedEventDispatcher: IValidatedEventDispatcher}} deps
                 */
                constructor(deps) {
                    // --- FIX: Pass a single object map to super ---
                    super(deps);
                }
            }

            // --- FIX: Instance creation should now succeed ---
            const anotherInstance = new AnotherRenderer(validDeps);
            // Check the log message that uses the prefix for the different class name.
            expect(mockLogger.debug).toHaveBeenCalledWith('[AnotherRenderer] Initialized.');
            // Test the property directly if needed
            expect(anotherInstance._logPrefix).toBe('[AnotherRenderer]');
        });
    });

    // --- Dispose Method Test ---
    describe('dispose', () => {
        it('should log disposal message', () => {
            const instance = new ConcreteRenderer(validDeps);
            instance.dispose();
            expect(mockLogger.debug).toHaveBeenCalledWith('[ConcreteRenderer] Disposing.');
        });

        // Add more tests here if dispose method gains more functionality
        // e.g., unsubscribing from events if the base class handled subscriptions.
    });
});