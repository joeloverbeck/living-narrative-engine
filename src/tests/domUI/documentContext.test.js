// src/tests/domUI/DocumentContext.test.js
/**
 * @fileoverview Unit tests for the DocumentContext class using Jest's JSDOM environment.
 */

import DocumentContext from '../../domUI/documentContext.js';
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
        // The afterEach block would normally handle clearing content from the previous test run.
        document.body.innerHTML = '<div id="app-root"><span class="existing-span"></span></div>';

        // Re-assign globals from the current window object just in case (though likely redundant)
        global.HTMLElement = window.HTMLElement;
        global.Element = window.Element;
        global.Node = window.Node;
    });

    // Clean up the DOM after each test - Currently disabled as it didn't prevent the crash
    afterEach(() => {
        // --- DOM CLEANUP COMMENTED OUT FOR DEBUGGING THE CRASH ---
        // while (document.body.firstChild) {
        //     document.body.removeChild(document.body.firstChild);
        // }
        // --- END COMMENTED OUT SECTION ---

        // Restore mocks after each test
        jest.restoreAllMocks();
    });

    // --- Test Suite: Fallback to Global Document ---
    describe('when initialized without a root element', () => {
        it('should use the global document for querying', () => {
            const directCheck = global.document.getElementById('app-root');
            expect(directCheck).not.toBeNull();
            expect(directCheck.tagName).toBe('DIV');

            const docContext = new DocumentContext();
            expect(docContext.document).toBe(global.document);

            const contextDirectQueryResult = docContext.document?.querySelector('#app-root');

            const queriedElement = docContext.query('#app-root');

            expect(queriedElement).not.toBeNull();
            expect(queriedElement).toBeDefined();
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
            // Ensure the element exists for this test, resetting if necessary due to disabled cleanup
            if (!global.document.getElementById('app-root')) {
                document.body.innerHTML = '<div id="app-root"><span class="existing-span"></span></div>';
            }
            rootElement = global.document.getElementById('app-root');
            if (!rootElement) {
                throw new Error('Test setup failed: Could not find #app-root in Jest\'s global document even after reset.');
            }
        });

        it("should use the root element's ownerDocument for querying", () => {
            const docContext = new DocumentContext(rootElement);
            expect(docContext.document).toBe(global.document);

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

});