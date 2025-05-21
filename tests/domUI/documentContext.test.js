// src/tests/domUI/DocumentContext.test.js
/**
 * @fileoverview Unit tests for the DocumentContext class using Jest's JSDOM environment.
 */

import DocumentContext from '../../src/domUI/documentContext.js';
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";

describe('DocumentContext', () => {
    // We will use the global document/window provided by Jest's JSDOM environment
    let window;
    let document;

    // Setup the DOM environment before each test using Jest's global document
    beforeEach(() => {
        // Assign Jest's JSDOM globals
        window = global.window;
        document = global.document;

        // Set up the basic HTML structure needed for the tests within Jest's document body.
        document.body.innerHTML = '<div id="app-root"><span class="existing-span"></span></div>';

        // Re-assign globals from the current window object just in case
        global.HTMLElement = window.HTMLElement;
        global.Element = window.Element;
        global.Node = window.Node;
        global.Document = window.Document; // Ensure Document constructor is available globally
    });

    // Clean up the DOM after each test
    afterEach(() => {
        document.body.innerHTML = ''; // Clear body content

        // Restore mocks after each test
        jest.restoreAllMocks();
    });

    // --- Test Suite: Fallback to Global Document ---
    describe('when initialized without a root element', () => {
        it('should use the global document for querying', () => {
            const directCheck = global.document.getElementById('app-root');
            expect(directCheck).not.toBeNull();
            expect(directCheck.tagName).toBe('DIV');

            const docContext = new DocumentContext(); // No argument relies on global.document check
            expect(docContext.document).toBe(global.document);

            const contextDirectQueryResult = docContext.document?.querySelector('#app-root');
            expect(contextDirectQueryResult).not.toBeNull(); // Verify context's document works

            const queriedElement = docContext.query('#app-root');
            expect(queriedElement).not.toBeNull();
            expect(queriedElement).toBeInstanceOf(global.window.HTMLDivElement);
            expect(queriedElement?.id).toBe('app-root');
            expect(queriedElement?.ownerDocument).toBe(global.document);
        });

        it('should use the global document for creating elements', () => {
            const docContext = new DocumentContext();
            const newParagraph = docContext.create('p');
            expect(newParagraph).toBeInstanceOf(global.window.HTMLParagraphElement);
            expect(newParagraph?.tagName).toBe('P');
            expect(newParagraph?.ownerDocument).toBe(global.document);
        });

        it('should return null when querying for a non-existent element', () => {
            const docContext = new DocumentContext();
            const result = docContext.query('#this-id-does-not-exist');
            expect(result).toBeNull();
        });

        it('should handle invalid selectors gracefully during query and return null', () => {
            const docContext = new DocumentContext();
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });

            const result = docContext.query('[invalid-selector');
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should expose the global document via the document getter', () => {
            const docContext = new DocumentContext();
            expect(docContext.document).toBe(global.document);
        });
    });

    // --- Test Suite: Using Root Element's ownerDocument ---
    describe('when initialized with a root element', () => {
        let rootElement;

        beforeEach(() => {
            // Element is created in the main beforeEach block
            rootElement = global.document.getElementById('app-root');
            if (!rootElement) {
                throw new Error('Test setup failed: Could not find #app-root in Jest\'s global document.');
            }
        });

        it("should use the root element's ownerDocument for querying", () => {
            const docContext = new DocumentContext(rootElement);
            expect(docContext.document).toBe(global.document); // Should resolve to the ownerDocument

            const queriedSpan = docContext.query('.existing-span');
            expect(queriedSpan).toBeInstanceOf(global.window.HTMLSpanElement);
            expect(queriedSpan?.className).toBe('existing-span');
            expect(queriedSpan?.ownerDocument).toBe(rootElement.ownerDocument);
            expect(queriedSpan?.ownerDocument).toBe(global.document);
        });

        it("should use the root element's ownerDocument for creating elements", () => {
            const docContext = new DocumentContext(rootElement);
            expect(docContext.document).toBe(global.document);

            const newButton = docContext.create('button');
            expect(newButton).toBeInstanceOf(global.window.HTMLButtonElement);
            expect(newButton?.tagName).toBe('BUTTON');
            expect(newButton?.ownerDocument).toBe(rootElement.ownerDocument);
            expect(newButton?.ownerDocument).toBe(global.document);
        });

        it('should still return null when querying for a non-existent element', () => {
            const docContext = new DocumentContext(rootElement);
            const result = docContext.query('.non-existent-class');
            expect(result).toBeNull();
        });

        it("should expose the root's ownerDocument via the document getter", () => {
            const docContext = new DocumentContext(rootElement);
            expect(docContext.document).toBe(rootElement.ownerDocument);
            expect(docContext.document).toBe(global.document);
        });
    });

    // --- NEW Test Suite: Passing Document Directly ---
    describe('when initialized with the document object directly', () => {
        it('should use the passed document for querying', () => {
            // Pass Jest's global document directly
            const docContext = new DocumentContext(document);
            expect(docContext.document).toBe(document); // Check it stored the passed document

            const queriedElement = docContext.query('#app-root');
            expect(queriedElement).not.toBeNull();
            expect(queriedElement).toBeInstanceOf(window.HTMLDivElement); // Use window from beforeEach
            expect(queriedElement?.id).toBe('app-root');
            expect(queriedElement?.ownerDocument).toBe(document);
        });

        it('should use the passed document for creating elements', () => {
            const docContext = new DocumentContext(document);
            expect(docContext.document).toBe(document);

            const newDiv = docContext.create('div');
            expect(newDiv).toBeInstanceOf(window.HTMLDivElement);
            expect(newDiv?.tagName).toBe('DIV');
            expect(newDiv?.ownerDocument).toBe(document);
        });

        it('should expose the passed document via the document getter', () => {
            const docContext = new DocumentContext(document);
            expect(docContext.document).toBe(document);
        });

        it('should still return null when querying for a non-existent element', () => {
            const docContext = new DocumentContext(document);
            const result = docContext.query('#non-existent-id-passed-doc');
            expect(result).toBeNull();
        });

        it('should handle invalid selectors gracefully during query and return null', () => {
            const docContext = new DocumentContext(document);
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });

            const result = docContext.query('>invalid');
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should handle create errors gracefully', () => {
            const docContext = new DocumentContext(document);
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });

            // Attempt to create an invalid element tag name
            const result = docContext.create('<invalid-tag>');
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });
    // --- End NEW Test Suite ---

});