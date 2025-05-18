// src/tests/domUI/actionButtonsRenderer.constructor.test.js
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {JSDOM} from 'jsdom';
// Import from specific file for clarity
import {ActionButtonsRenderer} from '../../domUI/index.js'; // Using index import
import DocumentContext from '../../domUI/documentContext.js';
import DomElementFactory from '../../domUI/domElementFactory.js';
import ConsoleLogger from '../../core/services/consoleLogger.js';
import ValidatedEventDispatcher from '../../services/validatedEventDispatcher.js';

// Mock dependencies
jest.mock('../../core/services/consoleLogger');
jest.mock('../../services/validatedEventDispatcher');
// Mock the factory module itself for constructor tests, but we'll use real instances later
jest.mock('../../domUI/domElementFactory');


describe('ActionButtonsRenderer', () => {
    let dom;
    let document;
    let docContext;
    let mockLogger;
    let mockVed;
    let mockDomElementFactoryInstance; // To hold instance used in most tests
    let actionButtonsContainer; // The specific container for this renderer

    // --- Mock Elements ---
    // Creates a mock element with spied methods, letting JSDOM handle implementation
    const createMockElement = (tagName = 'div', id = '', classes = [], textContent = '') => {
        const element = document.createElement(tagName); // Use JSDOM's createElement
        if (id) element.id = id;
        const classArray = Array.isArray(classes) ? classes : String(classes).split(' ').filter(c => c);
        if (classArray.length > 0) {
            element.classList.add(...classArray);
        }
        element.textContent = textContent;

        // Event listener mock store
        element._listeners = {};
        element.addEventListener = jest.fn((event, cb) => {
            if (!element._listeners[event]) {
                element._listeners[event] = [];
            }
            element._listeners[event].push(cb);
        });
        element.removeEventListener = jest.fn(); // Add basic mock

        // Simulate click
        element.click = jest.fn(async () => {
            if (element._listeners['click']) {
                for (const listener of element._listeners['click']) {
                    await listener();
                }
            }
        });

        // Spy on native methods we might want to check calls for
        jest.spyOn(element, 'setAttribute');
        jest.spyOn(element, 'remove');

        return element;
    };


    beforeEach(() => {
        // Reset DOM with the *correct* ID for the container
        dom = new JSDOM(`<!DOCTYPE html><html><body><div id="game-container"><div id="action-buttons"></div></div></body></html>`);
        document = dom.window.document;
        global.document = document; // Ensure global document is set for DocumentContext
        global.HTMLElement = dom.window.HTMLElement; // Ensure global HTMLElement is set

        docContext = new DocumentContext(); // Let it pick up global.document

        mockLogger = new ConsoleLogger();
        // Ensure VED mock has necessary methods if not fully mocked elsewhere
        mockVed = new ValidatedEventDispatcher({
            eventBus: {subscribe: jest.fn(), unsubscribe: jest.fn(), dispatch: jest.fn().mockResolvedValue(undefined)}, // Basic EventBus mock
            gameDataRepository: {getEventDefinition: jest.fn()}, // Mock needed methods
            schemaValidator: {
                isSchemaLoaded: jest.fn().mockReturnValue(true),
                validate: jest.fn().mockReturnValue({isValid: true})
            }, // Mock needed methods
            logger: mockLogger // Use the mocked logger
        });

        // Create an *actual* factory instance for most tests, using the real constructor
        // Keep the module mock for the specific constructor failure test
        mockDomElementFactoryInstance = new DomElementFactory(docContext);
        // Spy on the 'button' method of this *instance* for render tests
        jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
            const classes = cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter(c => c)) : [];
            // Use our extended mock creator to get elements with spied methods
            return createMockElement('button', '', classes, text);
        });


        actionButtonsContainer = document.getElementById('action-buttons'); // Get the correct element

        // Ensure container exists before spying
        if (!actionButtonsContainer) {
            throw new Error("Test setup failed: #action-buttons container not found in JSDOM.");
        }

        // Logger spies
        jest.spyOn(mockLogger, 'info').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'warn').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'error').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'debug').mockImplementation(() => {
        });

        // VED spies (re-apply spies on the potentially new mock instance)
        // MODIFIED: mockVed.subscribe should return a jest.fn() directly (the UnsubscribeFn)
        jest.spyOn(mockVed, 'subscribe').mockReturnValue(jest.fn());
        jest.spyOn(mockVed, 'dispatchValidated').mockResolvedValue(true);
        jest.spyOn(mockVed, 'unsubscribe'); // Spy on unsubscribe as well


        // Spy on container's methods we want to track calls for, but DO NOT mock implementation
        jest.spyOn(actionButtonsContainer, 'appendChild');
        jest.spyOn(actionButtonsContainer, 'removeChild'); // Spy only, let JSDOM handle removal
    });

    afterEach(() => {
        jest.restoreAllMocks();
        // Clean up JSDOM globals if necessary
        delete global.document;
        delete global.HTMLElement;
        if (document && document.body) {
            document.body.innerHTML = ''; // Clear body
        }
    });

    // Helper to create renderer
    const createRenderer = (containerOverride = actionButtonsContainer, factoryOverride = mockDomElementFactoryInstance) => {
        // Default to the spied instance, allow overriding for specific tests
        return new ActionButtonsRenderer({
            logger: mockLogger,
            documentContext: docContext,
            validatedEventDispatcher: mockVed,
            domElementFactory: factoryOverride,
            actionButtonsContainer: containerOverride,
        });
    };

    // --- Test Scenarios ---

    describe('Constructor', () => {
        it('should create successfully with valid dependencies', () => {
            expect(() => createRenderer()).not.toThrow();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[ActionButtonsRenderer] Initialized.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attached to action buttons container element:'), actionButtonsContainer);
        });

        it('should throw if actionButtonsContainer is missing (null) or not a valid DOM element', () => {
            expect(() => createRenderer(null)).toThrow(/'actionButtonsContainer' dependency is missing or not a valid DOM element/);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("[ActionButtonsRenderer] 'actionButtonsContainer' dependency is missing or not a valid DOM element."), {receivedElement: null});
            mockLogger.error.mockClear(); // Clear mock for the next assertion on the same mock

            const textNode = dom.window.document.createTextNode('text'); // Use current test's JSDOM
            expect(() => createRenderer(textNode)).toThrow(/'actionButtonsContainer' dependency is missing or not a valid DOM element/);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("[ActionButtonsRenderer] 'actionButtonsContainer' dependency is missing or not a valid DOM element."), {receivedElement: textNode});
        });

        it('should throw if domElementFactory is missing or invalid', () => {
            const expectedErrorMessage = "[ActionButtonsRenderer] 'domElementFactory' dependency is missing or invalid (must have create and button methods).";

            // Test passing null directly as the factory dependency
            expect(() => createRenderer(actionButtonsContainer, null))
                .toThrow(expectedErrorMessage);

            // Test passing an empty object directly (which lacks the 'create' and 'button' methods)
            expect(() => createRenderer(actionButtonsContainer, {}))
                .toThrow(expectedErrorMessage);

            // Ensure the logger was called twice
            expect(mockLogger.error).toHaveBeenCalledTimes(2);

            // Check the arguments of the first call to mockLogger.error
            expect(mockLogger.error).toHaveBeenNthCalledWith(
                1, // Call number
                expectedErrorMessage, // Expected first argument (the error message string)
                {receivedFactory: null} // Expected second argument (details object)
            );

            // Check the arguments of the second call to mockLogger.error
            expect(mockLogger.error).toHaveBeenNthCalledWith(
                2, // Call number
                expectedErrorMessage, // Expected first argument (the error message string)
                {receivedFactory: {}} // Expected second argument (details object)
            );
        });


        it('should subscribe to VED event textUI:update_available_actions', () => {
            createRenderer(); // This will call the constructor
            expect(mockVed.subscribe).toHaveBeenCalledTimes(1);
            expect(mockVed.subscribe).toHaveBeenCalledWith('textUI:update_available_actions', expect.any(Function));
            // This assertion should now pass
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Subscribed to VED event 'textUI:update_available_actions'."));
        });
    }); // End Constructor describe

}); // End ActionButtonsRenderer describe