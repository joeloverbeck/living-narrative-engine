// src/tests/domUI/domElementFactory.test.js
/**
 * @fileoverview Unit tests for DomElementFactory using Jest and JSDOM.
 * @jest-environment jsdom
 */

import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import DocumentContext from '../../domUI/documentContext.js'; // Use the real DocumentContext
import DomElementFactory from '../../domUI/domElementFactory.js';

describe('DomElementFactory', () => {
    let docContext;
    let factory;

    beforeEach(() => {
        // Reset JSDOM body for clean slate
        document.body.innerHTML = '';
        // Create a real DocumentContext using JSDOM's global document
        docContext = new DocumentContext(document.body); // Pass root for consistency
        factory = new DomElementFactory(docContext);
    });

    // Test constructor robustness
    it('should handle invalid DocumentContext during construction', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        const invalidFactory = new DomElementFactory(null); // Pass invalid context
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[DomElementFactory] Invalid IDocumentContext provided.'));

        // Attempting to use the factory should return null
        expect(invalidFactory.div()).toBeNull();
        errorSpy.mockRestore();
    });

    // Test div() helper
    describe('div()', () => {
        it('should create a basic div element', () => {
            const el = factory.div();
            expect(el).toBeInstanceOf(HTMLDivElement);
            expect(el.tagName).toBe('DIV');
            expect(el.classList.length).toBe(0);
        });

        it('should create a div with a single class', () => {
            const el = factory.div('my-div');
            expect(el).toBeInstanceOf(HTMLDivElement);
            expect(el.classList.contains('my-div')).toBe(true);
            expect(el.classList.length).toBe(1);
        });

        it('should create a div with multiple classes from an array', () => {
            const el = factory.div(['class1', 'class2']);
            expect(el).toBeInstanceOf(HTMLDivElement);
            expect(el.classList.contains('class1')).toBe(true);
            expect(el.classList.contains('class2')).toBe(true);
            expect(el.classList.length).toBe(2);
        });

        it('should create a div with multiple classes from a space-separated string', () => {
            const el = factory.div('class1 class2 class3');
            expect(el).toBeInstanceOf(HTMLDivElement);
            expect(el.classList.contains('class1')).toBe(true);
            expect(el.classList.contains('class2')).toBe(true);
            expect(el.classList.contains('class3')).toBe(true);
            expect(el.classList.length).toBe(3);
        });

        it('should handle null or empty class input gracefully', () => {
            const el1 = factory.div(null);
            expect(el1.classList.length).toBe(0);
            const el2 = factory.div([]);
            expect(el2.classList.length).toBe(0);
            const el3 = factory.div('');
            expect(el3.classList.length).toBe(0);
        });
    });

    // Test button() helper
    describe('button()', () => {
        it('should create a basic button element', () => {
            const el = factory.button();
            expect(el).toBeInstanceOf(HTMLButtonElement);
            expect(el.tagName).toBe('BUTTON');
            expect(el.textContent).toBe('');
            expect(el.classList.length).toBe(0);
        });

        it('should create a button with text content', () => {
            const el = factory.button('Click Me');
            expect(el).toBeInstanceOf(HTMLButtonElement);
            expect(el.textContent).toBe('Click Me');
        });

        it('should create a button with text and a single class', () => {
            const el = factory.button('Submit', 'btn-primary');
            expect(el).toBeInstanceOf(HTMLButtonElement);
            expect(el.textContent).toBe('Submit');
            expect(el.classList.contains('btn-primary')).toBe(true);
            expect(el.classList.length).toBe(1);
        });

        it('should create a button with text and multiple classes', () => {
            const el = factory.button('Cancel', ['btn', 'btn-secondary']);
            expect(el).toBeInstanceOf(HTMLButtonElement);
            expect(el.textContent).toBe('Cancel');
            expect(el.classList.contains('btn')).toBe(true);
            expect(el.classList.contains('btn-secondary')).toBe(true);
            expect(el.classList.length).toBe(2);
        });
    });

    // Test ul() helper
    describe('ul()', () => {
        it('should create a basic ul element', () => {
            const el = factory.ul();
            expect(el).toBeInstanceOf(HTMLUListElement);
            expect(el.tagName).toBe('UL');
            expect(el.id).toBe('');
            expect(el.classList.length).toBe(0);
        });

        it('should create a ul with an id', () => {
            const el = factory.ul('my-list');
            expect(el).toBeInstanceOf(HTMLUListElement);
            expect(el.id).toBe('my-list');
        });

        it('should create a ul with classes', () => {
            const el = factory.ul(null, ['list', 'items']);
            expect(el).toBeInstanceOf(HTMLUListElement);
            expect(el.classList.contains('list')).toBe(true);
            expect(el.classList.contains('items')).toBe(true);
            expect(el.classList.length).toBe(2);
        });

        it('should create a ul with both id and classes', () => {
            const el = factory.ul('inventory-list', 'panel-list');
            expect(el).toBeInstanceOf(HTMLUListElement);
            expect(el.id).toBe('inventory-list');
            expect(el.classList.contains('panel-list')).toBe(true);
            expect(el.classList.length).toBe(1);
        });
    });

    // Test li() helper
    describe('li()', () => {
        it('should create a basic li element', () => {
            const el = factory.li();
            expect(el).toBeInstanceOf(HTMLLIElement);
            expect(el.tagName).toBe('LI');
            expect(el.textContent).toBe('');
            expect(el.classList.length).toBe(0);
        });

        it('should create an li with classes', () => {
            const el = factory.li(['item', 'selected']);
            expect(el).toBeInstanceOf(HTMLLIElement);
            expect(el.classList.contains('item')).toBe(true);
            expect(el.classList.contains('selected')).toBe(true);
            expect(el.classList.length).toBe(2);
        });

        it('should create an li with text content', () => {
            const el = factory.li(null, 'Item 1');
            expect(el).toBeInstanceOf(HTMLLIElement);
            expect(el.textContent).toBe('Item 1');
        });

        it('should create an li with both classes and text', () => {
            const el = factory.li('list-item', 'Hello');
            expect(el).toBeInstanceOf(HTMLLIElement);
            expect(el.classList.contains('list-item')).toBe(true);
            expect(el.textContent).toBe('Hello');
        });
    });

    // Test span() helper
    describe('span()', () => {
        it('should create a basic span element', () => {
            const el = factory.span();
            expect(el).toBeInstanceOf(HTMLSpanElement);
            expect(el.tagName).toBe('SPAN');
            expect(el.textContent).toBe('');
            expect(el.classList.length).toBe(0);
        });

        it('should create a span with classes', () => {
            const el = factory.span(['label', 'highlight']);
            expect(el).toBeInstanceOf(HTMLSpanElement);
            expect(el.classList.contains('label')).toBe(true);
            expect(el.classList.contains('highlight')).toBe(true);
            expect(el.classList.length).toBe(2);
        });

        it('should create a span with text content', () => {
            const el = factory.span(null, 'Important');
            expect(el).toBeInstanceOf(HTMLSpanElement);
            expect(el.textContent).toBe('Important');
        });

        it('should create a span with both classes and text', () => {
            const el = factory.span('item-name', 'Sword');
            expect(el).toBeInstanceOf(HTMLSpanElement);
            expect(el.classList.contains('item-name')).toBe(true);
            expect(el.textContent).toBe('Sword');
        });
    });

    // Test p() helper
    describe('p()', () => {
        it('should create a basic p element', () => {
            const el = factory.p();
            expect(el).toBeInstanceOf(HTMLParagraphElement);
            expect(el.tagName).toBe('P');
            expect(el.textContent).toBe('');
            expect(el.classList.length).toBe(0);
        });

        it('should create a p with classes', () => {
            const el = factory.p(['message', 'error']);
            expect(el).toBeInstanceOf(HTMLParagraphElement);
            expect(el.classList.contains('message')).toBe(true);
            expect(el.classList.contains('error')).toBe(true);
            expect(el.classList.length).toBe(2);
        });

        it('should create a p with text content', () => {
            const el = factory.p(null, 'This is a paragraph.');
            expect(el).toBeInstanceOf(HTMLParagraphElement);
            expect(el.textContent).toBe('This is a paragraph.');
        });

        it('should create a p with both classes and text', () => {
            const el = factory.p('description', 'You see a dusty trail.');
            expect(el).toBeInstanceOf(HTMLParagraphElement);
            expect(el.classList.contains('description')).toBe(true);
            expect(el.textContent).toBe('You see a dusty trail.');
        });
    });

    // Test h3() helper
    describe('h3()', () => {
        it('should create a basic h3 element', () => {
            const el = factory.h3();
            expect(el).toBeInstanceOf(HTMLHeadingElement);
            expect(el.tagName).toBe('H3');
            expect(el.textContent).toBe('');
            expect(el.classList.length).toBe(0);
        });

        it('should create an h3 with classes', () => {
            const el = factory.h3(['title', 'section-header']);
            expect(el).toBeInstanceOf(HTMLHeadingElement);
            expect(el.classList.contains('title')).toBe(true);
            expect(el.classList.contains('section-header')).toBe(true);
            expect(el.classList.length).toBe(2);
        });

        it('should create an h3 with text content', () => {
            const el = factory.h3(null, 'Inventory');
            expect(el).toBeInstanceOf(HTMLHeadingElement);
            expect(el.textContent).toBe('Inventory');
        });

        it('should create an h3 with both classes and text', () => {
            const el = factory.h3('panel-title', 'Settings');
            expect(el).toBeInstanceOf(HTMLHeadingElement);
            expect(el.classList.contains('panel-title')).toBe(true);
            expect(el.textContent).toBe('Settings');
        });
    });

    // Test img() helper
    describe('img()', () => {
        it('should create an img element with src and alt', () => {
            const el = factory.img('path/to/icon.png', 'Item Icon');
            expect(el).toBeInstanceOf(HTMLImageElement);
            expect(el.tagName).toBe('IMG');
            expect(el.src).toContain('path/to/icon.png'); // JSDOM might add base URL
            expect(el.alt).toBe('Item Icon');
            expect(el.classList.length).toBe(0);
        });

        it('should create an img with src, alt, and classes', () => {
            const el = factory.img('path/to/avatar.jpg', 'User Avatar', ['avatar', 'rounded']);
            expect(el).toBeInstanceOf(HTMLImageElement);
            expect(el.src).toContain('path/to/avatar.jpg');
            expect(el.alt).toBe('User Avatar');
            expect(el.classList.contains('avatar')).toBe(true);
            expect(el.classList.contains('rounded')).toBe(true);
            expect(el.classList.length).toBe(2);
        });
    });

    // Test generic create() helper
    describe('create()', () => {
        it('should create an element with specified tag', () => {
            const el = factory.create('section');
            expect(el).toBeInstanceOf(HTMLElement); // Generic HTMLElement for section
            expect(el.tagName).toBe('SECTION');
        });

        it('should create an element with id', () => {
            const el = factory.create('article', {id: 'main-content'});
            expect(el.id).toBe('main-content');
        });

        it('should create an element with classes', () => {
            const el = factory.create('div', {cls: ['container', 'fluid']});
            expect(el.classList.contains('container')).toBe(true);
            expect(el.classList.contains('fluid')).toBe(true);
        });

        it('should create an element with text content', () => {
            const el = factory.create('h2', {text: 'Chapter 1'});
            expect(el.textContent).toBe('Chapter 1');
        });

        it('should create an element with attributes', () => {
            const el = factory.create('input', {
                attrs: {
                    type: 'text',
                    placeholder: 'Enter name',
                    'data-testid': 'name-input'
                }
            });
            expect(el).toBeInstanceOf(HTMLInputElement);
            expect(el.getAttribute('type')).toBe('text');
            expect(el.getAttribute('placeholder')).toBe('Enter name');
            expect(el.getAttribute('data-testid')).toBe('name-input');
        });

        it('should create an element with all options combined', () => {
            const el = factory.create('a', {
                id: 'link-1',
                cls: 'external-link important',
                text: 'Visit Site',
                attrs: {href: 'https://example.com', target: '_blank'}
            });
            expect(el).toBeInstanceOf(HTMLAnchorElement);
            expect(el.id).toBe('link-1');
            expect(el.classList.contains('external-link')).toBe(true);
            expect(el.classList.contains('important')).toBe(true);
            expect(el.textContent).toBe('Visit Site');
            expect(el.getAttribute('href')).toBe('https://example.com');
            expect(el.getAttribute('target')).toBe('_blank');
        });

        it('should not set null or undefined attributes', () => {
            const el = factory.create('div', {attrs: {'defined': 'yes', 'is-null': null, 'is-undefined': undefined}});
            expect(el.hasAttribute('defined')).toBe(true);
            expect(el.getAttribute('defined')).toBe('yes');
            expect(el.hasAttribute('is-null')).toBe(false);
            expect(el.hasAttribute('is-undefined')).toBe(false);
        });

        it('should return null if document context fails creation', () => {
            // Mock the document context's create method to return null
            jest.spyOn(docContext, 'create').mockReturnValueOnce(null);
            const el = factory.create('div');
            expect(el).toBeNull();
        });
    });

    // Test return null when context is invalid
    it('should return null from helpers if factory was constructed with invalid context', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        const invalidFactory = new DomElementFactory(null); // Invalid context

        expect(invalidFactory.div()).toBeNull();
        expect(invalidFactory.button()).toBeNull();
        expect(invalidFactory.ul()).toBeNull();
        expect(invalidFactory.li()).toBeNull();
        expect(invalidFactory.span()).toBeNull();
        expect(invalidFactory.p()).toBeNull();
        expect(invalidFactory.h3()).toBeNull();
        expect(invalidFactory.img('src', 'alt')).toBeNull();
        expect(invalidFactory.create('div')).toBeNull();

        errorSpy.mockRestore();
    });
});