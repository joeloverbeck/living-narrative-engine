// src/tests/domUI/RendererBase.test.js
/**
 * @fileoverview Unit tests for the RendererBase abstract class.
 * @jest-environment jsdom
 */

import {beforeEach, afterEach, describe, expect, it, jest} from '@jest/globals';
import {RendererBase} from '../../domUI/index.js';
import DocumentContext from '../../domUI/documentContext.js';

// --- Mock Dependencies ---

const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

const createMockVed = () => ({
    dispatchValidated: jest.fn(),
});

const createRealDocContext = () => {
    if (typeof document === 'undefined') {
        throw new Error("JSDOM 'document' is not available. Ensure environment is 'jsdom'.");
    }
    const rootElement = document.body || document.createElement('div');
    if (!document.body) {
        document.appendChild(rootElement);
    }
    return new DocumentContext(rootElement);
};

// --- Concrete Test Class ---
class ConcreteRenderer extends RendererBase {
    /**
     * @param {{logger: ILogger, docContext: IDocumentContext, ved: IValidatedEventDispatcher}} deps
     */
    constructor(deps) {
        super(deps.logger, deps.docContext, deps.ved);
    }

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
        docContext = createRealDocContext();
        validDeps = {logger: mockLogger, ved: mockVed, docContext: docContext};
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
            expect(() => new ConcreteRenderer(validDeps)).not.toThrow();
            const instance = new ConcreteRenderer(validDeps);
            expect(mockLogger.debug).toHaveBeenCalledWith('[ConcreteRenderer] Initialized.');
        });

        it('should throw an error if logger is missing or invalid', () => {
            // --- FIX: Update expected error messages ---
            expect(() => new ConcreteRenderer({...validDeps, logger: null}))
                .toThrow('ConcreteRenderer: Logger dependency is missing or invalid.'); // Added " or invalid"
            expect(() => new ConcreteRenderer({...validDeps, logger: undefined}))
                .toThrow('ConcreteRenderer: Logger dependency is missing or invalid.'); // Added " or invalid"
            // Test case for invalid type (missing debug function)
            expect(() => new ConcreteRenderer({...validDeps, logger: {info: jest.fn()}}))
                .toThrow('ConcreteRenderer: Logger dependency is missing or invalid.'); // Added " or invalid"
        });

        it('should throw an error if ValidatedEventDispatcher is missing or invalid', () => {
            // --- FIX: Update expected error messages ---
            expect(() => new ConcreteRenderer({...validDeps, ved: null}))
                .toThrow('ConcreteRenderer: ValidatedEventDispatcher dependency is missing or invalid.'); // Added " or invalid"
            expect(() => new ConcreteRenderer({...validDeps, ved: undefined}))
                .toThrow('ConcreteRenderer: ValidatedEventDispatcher dependency is missing or invalid.'); // Added " or invalid"
            // Test case for invalid type (missing dispatchValidated function)
            expect(() => new ConcreteRenderer({...validDeps, ved: {someOtherFunc: jest.fn()}}))
                .toThrow('ConcreteRenderer: ValidatedEventDispatcher dependency is missing or invalid.'); // Added " or invalid"
        });

        it('should throw an error if DocumentContext is missing or invalid', () => {
            // --- FIX: Update expected error messages ---
            expect(() => new ConcreteRenderer({...validDeps, docContext: null}))
                .toThrow('ConcreteRenderer: DocumentContext dependency is missing or invalid.'); // Added " or invalid"
            expect(() => new ConcreteRenderer({...validDeps, docContext: undefined}))
                .toThrow('ConcreteRenderer: DocumentContext dependency is missing or invalid.'); // Added " or invalid"
            // Test case for invalid type (missing query function)
            expect(() => new ConcreteRenderer({...validDeps, docContext: {create: jest.fn()}}))
                .toThrow('ConcreteRenderer: DocumentContext dependency is missing or invalid.'); // Added " or invalid"
            // Test case for invalid type (missing create function)
            expect(() => new ConcreteRenderer({...validDeps, docContext: {query: jest.fn()}}))
                .toThrow('ConcreteRenderer: DocumentContext dependency is missing or invalid.'); // Added " or invalid"
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
            expect(typeof instance.doc.query).toBe('function');
            expect(typeof instance.doc.create).toBe('function');
        });
    });

    // --- Log Prefix Helper Test ---
    describe('_logPrefix', () => {
        it('should generate the correct log prefix based on the concrete class name', () => {
            // Instance creation calls the constructor, which logs.
            const instance = new ConcreteRenderer(validDeps);
            // Check the log message that uses the prefix.
            expect(mockLogger.debug).toHaveBeenCalledWith('[ConcreteRenderer] Initialized.');
        });

        it('should work correctly for a different derived class name', () => {
            class AnotherRenderer extends RendererBase {
                /**
                 * @param {{logger: ILogger, docContext: IDocumentContext, ved: IValidatedEventDispatcher}} deps
                 */
                constructor(deps) {
                    super(deps.logger, deps.docContext, deps.ved);
                }
            }

            // Instance creation calls the constructor, which logs.
            const anotherInstance = new AnotherRenderer(validDeps);
            // Check the log message that uses the prefix for the different class name.
            expect(mockLogger.debug).toHaveBeenCalledWith('[AnotherRenderer] Initialized.');
        });
    });
});