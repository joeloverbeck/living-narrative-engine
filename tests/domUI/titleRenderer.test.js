// src/tests/domUI/titleRenderer.test.js
import {beforeEach, describe, expect, it, jest} from '@jest/globals'; // Use if needed for mocking
import {TitleRenderer} from '../../src/domUI/titleRenderer.js'; // Adjust path as necessary

// Mock dependencies
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

const mockDocumentContext = {
    query: jest.fn(),
    create: jest.fn(),
};

const mockValidatedEventDispatcher = {
    subscribe: jest.fn(),
    dispatchValidated: jest.fn(),
};

// Helper to create mock elements with tagName property
const createMockElement = (tagName = 'DIV') => ({
    nodeType: 1, // ELEMENT_NODE
    tagName: tagName.toUpperCase(),
    textContent: '',
    // Add other properties/methods if needed by tests
});

describe('TitleRenderer', () => {
    let mockH1Element;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
        mockH1Element = createMockElement('H1');
        mockH1Element.textContent = 'Initial Title'; // Give it an initial value
    });

    // --- Constructor Tests ---

    it('should instantiate successfully with valid dependencies', () => {
        const renderer = new TitleRenderer({
            logger: mockLogger,
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            titleElement: mockH1Element,
        });
        expect(renderer).toBeInstanceOf(TitleRenderer);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[TitleRenderer] Initialized.'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[TitleRenderer] Attached to H1 element.'));
        expect(mockLogger.error).not.toHaveBeenCalled(); // Ensure no errors logged
    });

    it('should throw if titleElement is missing', () => {
        expect(() => {
            new TitleRenderer({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                titleElement: null, // Missing element
            });
        }).toThrow("'titleElement' dependency is missing or not a valid DOM element.");
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("missing or not a valid DOM element"));
    });

    it('should throw if titleElement is not an ELEMENT_NODE', () => {
        const notAnElement = {nodeType: 3, tagName: 'TEXT'}; // Text node example
        expect(() => {
            new TitleRenderer({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                titleElement: notAnElement,
            });
        }).toThrow("'titleElement' dependency is missing or not a valid DOM element.");
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("missing or not a valid DOM element"));
    });

    it('should throw if titleElement is not an H1 element', () => {
        const divElement = createMockElement('DIV');
        expect(() => {
            new TitleRenderer({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                titleElement: divElement,
            });
        }).toThrow("'titleElement' must be an H1 element, but received 'DIV'.");
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("must be an H1 element"), expect.any(Object));
    });

    // Test base class dependency validation (delegated, but good practice)
    it('should throw if logger is missing', () => {
        expect(() => {
            new TitleRenderer({
                logger: null, // Invalid logger
                documentContext: mockDocumentContext,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                titleElement: mockH1Element,
            });
        }).toThrow('TitleRenderer: Logger dependency is missing or invalid.');
    });

    it('should throw if documentContext is missing', () => {
        expect(() => {
            new TitleRenderer({
                logger: mockLogger,
                documentContext: null, // Invalid context
                validatedEventDispatcher: mockValidatedEventDispatcher,
                titleElement: mockH1Element,
            });
        }).toThrow('TitleRenderer: DocumentContext dependency is missing or invalid.');
    });

    it('should throw if validatedEventDispatcher is missing', () => {
        expect(() => {
            new TitleRenderer({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                validatedEventDispatcher: null, // Invalid dispatcher
                titleElement: mockH1Element,
            });
        }).toThrow('TitleRenderer: ValidatedEventDispatcher dependency is missing or invalid.');
    });


    // --- set(text) API Tests ---

    it('should set the textContent of the titleElement', () => {
        const renderer = new TitleRenderer({
            logger: mockLogger,
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            titleElement: mockH1Element,
        });
        const newTitle = 'New Game Title';

        renderer.set(newTitle);

        expect(mockH1Element.textContent).toBe(newTitle);
        expect(mockLogger.debug).toHaveBeenCalledWith(`[TitleRenderer] Title set to: "${newTitle}"`);
    });

    it('should handle setting an empty string', () => {
        const renderer = new TitleRenderer({
            logger: mockLogger,
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            titleElement: mockH1Element,
        });
        renderer.set('');
        expect(mockH1Element.textContent).toBe('');
        expect(mockLogger.debug).toHaveBeenCalledWith('[TitleRenderer] Title set to: ""');
    });

    it('should not update or log if the text is the same as the current title', () => {
        const currentTitle = 'Current Title';
        mockH1Element.textContent = currentTitle;
        const renderer = new TitleRenderer({
            logger: mockLogger,
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            titleElement: mockH1Element,
        });

        renderer.set(currentTitle); // Set the same title

        expect(mockH1Element.textContent).toBe(currentTitle); // Still the same
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[TitleRenderer] Initialized.'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[TitleRenderer] Attached to H1 element.'));
        // Check it logged the "skipping update" message
        expect(mockLogger.debug).toHaveBeenCalledWith(`[TitleRenderer] Title already set to: "${currentTitle}", skipping update.`);
        // Ensure it did NOT log the "Title set to" message again for this call
        expect(mockLogger.debug).not.toHaveBeenCalledWith(`[TitleRenderer] Title set to: "${currentTitle}"`);
    });


    it('should coerce non-string input to string and log a warning', () => {
        const renderer = new TitleRenderer({
            logger: mockLogger,
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            titleElement: mockH1Element,
        });
        renderer.set(123); // Pass a number
        expect(mockH1Element.textContent).toBe('123'); // Coerced to string
        expect(mockLogger.warn).toHaveBeenCalledWith('[TitleRenderer] Received non-string value in set():', 123);
        expect(mockLogger.debug).toHaveBeenCalledWith('[TitleRenderer] Title set to: "123"'); // Logged the update

        renderer.set(null); // Pass null
        expect(mockH1Element.textContent).toBe('null'); // Coerced to string
        expect(mockLogger.warn).toHaveBeenCalledWith('[TitleRenderer] Received non-string value in set():', null);
        expect(mockLogger.debug).toHaveBeenCalledWith('[TitleRenderer] Title set to: "null"');
    });

    // --- REMOVED Failing Test Case ---
    // it('should log an error if #titleElement becomes null unexpectedly (edge case)', () => {
    //     const renderer = new TitleRenderer({
    //         logger: mockLogger,
    //         documentContext: mockDocumentContext,
    //         validatedEventDispatcher: mockValidatedEventDispatcher,
    //         titleElement: mockH1Element,
    //     });
    //     // Simulate the element reference being lost after construction
    //     // This doesn't work for # private fields:
    //     // renderer['_TitleRenderer__titleElement'] = null;
    //
    //     renderer.set('Trying to set title');
    //
    //     // This assertion would fail because the private field isn't actually modified
    //     expect(mockLogger.error).toHaveBeenCalledWith('[TitleRenderer] Cannot set title, internal #titleElement reference is lost.');
    // });

    // --- dispose() Tests ---

    it('should call super.dispose and log disposal', () => {
        const renderer = new TitleRenderer({
            logger: mockLogger,
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            titleElement: mockH1Element,
        });
        renderer.dispose();
        // RendererBase's dispose calls logger.debug
        expect(mockLogger.debug).toHaveBeenCalledWith('[TitleRenderer] Disposing.');
    });
});