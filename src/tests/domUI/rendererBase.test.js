// src/tests/domUI/RendererBase.test.js
/**
 * @fileoverview Unit tests for the RendererBase abstract class.
 * @jest-environment jsdom
 */

import {describe, expect, it, jest} from '@jest/globals';
import {RendererBase} from '../../domUI/index.js';
import DocumentContext from '../../domUI/documentContext.js'; // Need a concrete implementation for testing

// --- Mock Dependencies ---

// Minimal mock ILogger
const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(), // Added debug for constructor log
});

// Minimal mock ValidatedEventDispatcher
const createMockVed = () => ({
    dispatchValidated: jest.fn(),
    // Add other methods if needed by future base class logic
});

// Real DocumentContext using JSDOM
const createRealDocContext = () => {
    // Ensure document is available in JSDOM environment
    if (typeof document === 'undefined') {
        throw new Error("JSDOM 'document' is not available. Ensure environment is 'jsdom'.");
    }
    return new DocumentContext(document.body); // Use JSDOM's document
};

// --- Concrete Test Class ---
// We need a concrete class extending RendererBase to test it
class ConcreteRenderer extends RendererBase {
    constructor(deps) {
        super(deps);
    }

    // Add a dummy method to make it concrete if needed, but constructor test is primary
    renderSomething() {
        this.logger.info(`${this._logPrefix} Rendering something...`);
    }
}

// --- Test Suite ---

describe('RendererBase', () => {
    let mockLogger;
    let mockVed;
    let docContext;
    let validDeps;

    beforeEach(() => {
        mockLogger = createMockLogger();
        mockVed = createMockVed();
        docContext = createRealDocContext(); // Use a real one for interface validation
        validDeps = {logger: mockLogger, ved: mockVed, docContext: docContext};
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // --- Constructor Tests ---
    describe('Constructor', () => {
        it('should successfully create an instance with valid dependencies', () => {
            expect(() => new ConcreteRenderer(validDeps)).not.toThrow();
            // Check if constructor logged initialization
            expect(mockLogger.debug).toHaveBeenCalledWith('[Ui::ConcreteRenderer] Initialized.');
        });

        it('should throw an error if logger is missing or invalid', () => {
            expect(() => new ConcreteRenderer({...validDeps, logger: null}))
                .toThrow('ConcreteRenderer requires a valid ILogger instance.');
            expect(() => new ConcreteRenderer({...validDeps, logger: {info: 'not a function'}}))
                .toThrow('ConcreteRenderer requires a valid ILogger instance.');
            expect(() => new ConcreteRenderer({...validDeps, logger: {}}))
                .toThrow('ConcreteRenderer requires a valid ILogger instance.');
        });

        it('should throw an error if ValidatedEventDispatcher is missing or invalid', () => {
            expect(() => new ConcreteRenderer({...validDeps, ved: null}))
                .toThrow('ConcreteRenderer requires a valid ValidatedEventDispatcher instance.');
            expect(() => new ConcreteRenderer({...validDeps, ved: {}}))
                .toThrow('ConcreteRenderer requires a valid ValidatedEventDispatcher instance.');
            expect(() => new ConcreteRenderer({...validDeps, ved: {dispatchValidated: 'not a function'}}))
                .toThrow('ConcreteRenderer requires a valid ValidatedEventDispatcher instance.');
        });

        it('should throw an error if DocumentContext is missing or invalid', () => {
            expect(() => new ConcreteRenderer({...validDeps, docContext: null}))
                .toThrow('ConcreteRenderer requires a valid IDocumentContext instance.');
            expect(() => new ConcreteRenderer({...validDeps, docContext: {}}))
                .toThrow('ConcreteRenderer requires a valid IDocumentContext instance.');
            // Test missing core methods
            expect(() => new ConcreteRenderer({...validDeps, docContext: {create: () => null}})) // Missing query
                .toThrow('ConcreteRenderer requires a valid IDocumentContext instance.');
            expect(() => new ConcreteRenderer({...validDeps, docContext: {query: () => null}})) // Missing create
                .toThrow('ConcreteRenderer requires a valid IDocumentContext instance.');
        });
    });

    // --- Getter Tests ---
    describe('Getters', () => {
        let instance;
        beforeEach(() => {
            instance = new ConcreteRenderer(validDeps);
        });

        it('should provide a protected getter for the logger', () => {
            expect(instance.logger).toBe(mockLogger);
        });

        it('should provide a protected getter for the ValidatedEventDispatcher', () => {
            expect(instance.ved).toBe(mockVed);
        });

        it('should provide a protected getter for the DocumentContext', () => {
            expect(instance.doc).toBe(docContext);
            // Verify it's a functional doc context
            expect(typeof instance.doc.query).toBe('function');
            expect(typeof instance.doc.create).toBe('function');
        });
    });

    // --- Log Prefix Helper Test ---
    describe('_logPrefix', () => {
        it('should generate the correct log prefix based on the concrete class name', () => {
            const instance = new ConcreteRenderer(validDeps);
            // Accessing protected members directly in tests is okay for verification
            expect(instance._logPrefix).toBe('[Ui::ConcreteRenderer]');
        });

        it('should work correctly for a different derived class name', () => {
            class AnotherRenderer extends RendererBase {
                constructor(deps) {
                    super(deps);
                }
            }

            const anotherInstance = new AnotherRenderer(validDeps);
            expect(anotherInstance._logPrefix).toBe('[Ui::AnotherRenderer]');
        });
    });
});