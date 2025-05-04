// src/tests/domUI/actionButtonsRenderer.test.js
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

        // Store attributes for later checks if needed
        element._attributes = {};

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
                    await listener(); // Correctly await async listeners
                }
            }
        });

        // Spy on native methods we might want to check calls for
        jest.spyOn(element, 'setAttribute').mockImplementation((name, value) => {
            element._attributes[name] = value; // Store attribute value
        });
        // Add getAttribute mock to retrieve stored attributes
        element.getAttribute = jest.fn((name) => element._attributes[name]);
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
        jest.spyOn(mockVed, 'subscribe').mockReturnValue({unsubscribe: jest.fn()});
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

    describe('Button Click Simulation', () => {
        it('should dispatch validated core:submit_command event on button click', async () => {
            // --- UPDATED: Use AvailableAction object ---
            const actions = [{id: 'test:examine', command: 'examine'}];
            // --- END UPDATE ---

            // Ensure factory mock returns a clickable element with correct text
            const mockButton = createMockElement('button', '', ['action-button'], 'examine');
            // Reset factory mock for this test
            jest.spyOn(mockDomElementFactoryInstance, 'button').mockReturnValue(mockButton);

            const renderer = createRenderer();
            renderer.render(actions); // Render with the object

            // Button was created by the mock factory and appended
            expect(mockButton.click).toBeDefined(); // Ensure mock click exists

            await mockButton.click(); // Simulate click on the mock button

            expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockVed.dispatchValidated).toHaveBeenCalledWith('core:submit_command', {command: 'examine'});
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Event 'core:submit_command' for \"examine\" dispatched successfully."));
            // --- ADDED: Check that render didn't log a warning ---
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Skipping invalid"));
        });

        it('should log warning if dispatchValidated returns false', async () => {
            mockVed.dispatchValidated.mockResolvedValue(false); // Setup VED mock response

            // --- UPDATED: Use AvailableAction object ---
            const actions = [{id: 'test:inv', command: 'inventory'}];
            const mockButton = createMockElement('button', '', ['action-button'], 'inventory');
            // --- END UPDATE ---
            jest.spyOn(mockDomElementFactoryInstance, 'button').mockReturnValue(mockButton);

            const renderer = createRenderer();
            renderer.render(actions);

            await mockButton.click(); // Simulate click

            expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockVed.dispatchValidated).toHaveBeenCalledWith('core:submit_command', {command: 'inventory'});
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Event 'core:submit_command' for \"inventory\" was NOT dispatched"));
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining("dispatched successfully"));
        });

        it('should log error if dispatchValidated throws an error', async () => {
            const testError = new Error('Dispatch failed');
            mockVed.dispatchValidated.mockRejectedValue(testError); // Setup VED mock response

            // --- UPDATED: Use AvailableAction object ---
            const actions = [{id: 'test:help', command: 'help'}];
            const mockButton = createMockElement('button', '', ['action-button'], 'help');
            // --- END UPDATE ---
            jest.spyOn(mockDomElementFactoryInstance, 'button').mockReturnValue(mockButton);

            const renderer = createRenderer();
            renderer.render(actions);

            await mockButton.click(); // Simulate click

            expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockVed.dispatchValidated).toHaveBeenCalledWith('core:submit_command', {command: 'help'});
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Error occurred during dispatch of 'core:submit_command' for \"help\":"), testError);
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining("dispatched successfully"));
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("was NOT dispatched"));
        });

        it('should log warning and not dispatch if button textContent is empty at time of click', async () => {
            // --- UPDATED: Render a valid button first, then manipulate it ---
            const actions = [{id: 'test:action1', command: 'action1'}]; // Valid action object
            const mockButton = createMockElement('button', '', ['action-button'], 'action1');
            jest.spyOn(mockDomElementFactoryInstance, 'button').mockReturnValue(mockButton);

            const renderer = createRenderer();
            renderer.render(actions); // Render the button

            // Make sure render didn't skip it
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Skipping invalid"));
            expect(mockButton.textContent).toBe('action1');
            expect(mockButton.getAttribute('data-action-id')).toBe('test:action1');

            // NOW, manually clear the text content before clicking
            mockButton.textContent = '';
            expect(mockButton.textContent).toBe('');
            // --- END UPDATE ---

            await mockButton.click(); // Simulate click

            // --- UPDATED: Check for the correct warning from the click handler ---
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Action button clicked, but textContent is unexpectedly empty. ID: ${mockButton.getAttribute('data-action-id')}`));
            // --- END UPDATE ---
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
        });
    }); // End Button Click Simulation describe


    describe('VED Event Handling (textUI:update_available_actions)', () => {
        let updateActionsHandler;
        let mockSubscription;
        let rendererInstance;

        beforeEach(() => {
            // Capture the handler passed to subscribe
            mockSubscription = {unsubscribe: jest.fn()};
            // Reset the spy/mock implementation for subscribe specifically for this block
            jest.spyOn(mockVed, 'subscribe').mockImplementation((eventName, handler) => {
                if (eventName === 'textUI:update_available_actions') {
                    updateActionsHandler = handler; // Capture the handler
                }
                return mockSubscription; // Return the mock subscription object
            });

            rendererInstance = createRenderer(); // Create instance, which calls subscribe

            // Ensure handler was captured
            if (!updateActionsHandler) {
                throw new Error("Test setup failed: VED handler for 'textUI:update_available_actions' was not captured.");
            }
            // Clear mocks that might have been called during construction before the actual test call
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear(); // Clear debug logs from constructor
            jest.spyOn(rendererInstance, 'render'); // Spy on render AFTER instance creation
        });

        it('should call render with valid actions from payload', () => {
            // --- UPDATED: Use AvailableAction objects ---
            const payload = {
                actions: [
                    {id: 'core:go_n', command: 'north'},
                    {id: 'core:go_s', command: 'south'},
                    {id: 'core:examine', command: 'examine room'},
                ]
            };
            // --- END UPDATE ---
            const eventType = 'textUI:update_available_actions';

            updateActionsHandler(payload, eventType); // Call the captured handler

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received '${eventType}' event. Payload:`), payload);
            expect(rendererInstance.render).toHaveBeenCalledTimes(1);
            // --- UPDATED: Expect the same array of objects ---
            expect(rendererInstance.render).toHaveBeenCalledWith(payload.actions);
            // --- END UPDATE ---
            expect(mockLogger.warn).not.toHaveBeenCalled(); // No warning for valid payload
        });

        it('should call render with filtered valid action objects, logging a warning', () => {
            // --- UPDATED: Use a mix of valid/invalid objects and other types ---
            const payload = {
                actions: [
                    {id: 'core:go_n', command: 'north'},        // Valid
                    null,                                     // Invalid type
                    {id: 'core:go_s'},                          // Invalid object (missing command)
                    {command: 'examine'},                       // Invalid object (missing id)
                    {id: 'core:take', command: 'take sword'}, // Valid
                    123,                                      // Invalid type
                    {id: '', command: 'empty_id'},            // Invalid object (empty id)
                    {id: 'core:drop', command: '  '},         // Invalid object (empty command)
                    'a string',                               // Invalid type
                    {id: 'core:wait', command: 'wait'},         // Valid
                    undefined,                                // Invalid type
                ]
            };
            const eventType = 'textUI:update_available_actions';
            // Filtered list should only contain the valid objects
            const expectedFilteredActions = [
                {id: 'core:go_n', command: 'north'},
                {id: 'core:take', command: 'take sword'},
                {id: 'core:wait', command: 'wait'},
            ];
            // --- END UPDATE ---

            updateActionsHandler(payload, eventType);

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received '${eventType}' event. Payload:`), payload);
            // --- UPDATED: Check for the new warning message ---
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received 'textUI:update_available_actions' with some invalid items in the actions array. Only valid action objects will be rendered."), payload);
            // --- END UPDATE ---
            expect(rendererInstance.render).toHaveBeenCalledTimes(1);
            // --- UPDATED: Check for the correctly filtered objects ---
            expect(rendererInstance.render).toHaveBeenCalledWith(expectedFilteredActions);
            // --- END UPDATE ---
        });

        it('should call render with empty list and log warning if payload is invalid', () => {
            const eventType = 'textUI:update_available_actions';

            // Case 1: Null payload
            updateActionsHandler(null, eventType);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received invalid or incomplete payload for 'textUI:update_available_actions'. Clearing action buttons."), null);
            expect(rendererInstance.render).toHaveBeenCalledWith([]);
            rendererInstance.render.mockClear(); // Clear for next assertion
            mockLogger.warn.mockClear();

            // Case 2: Empty object
            updateActionsHandler({}, eventType);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received invalid or incomplete payload for 'textUI:update_available_actions'. Clearing action buttons."), {});
            expect(rendererInstance.render).toHaveBeenCalledWith([]);
            rendererInstance.render.mockClear(); // Clear for next assertion
            mockLogger.warn.mockClear();

            // Case 3: Actions property is not an array
            const invalidPayload3 = {actions: 'not-an-array'};
            updateActionsHandler(invalidPayload3, eventType);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received invalid or incomplete payload for 'textUI:update_available_actions'. Clearing action buttons."), invalidPayload3);
            expect(rendererInstance.render).toHaveBeenCalledWith([]);

            // Ensure render was called once for this last invalid case tested here
            expect(rendererInstance.render).toHaveBeenCalledTimes(1); // Because it was cleared after each call
        });
    }); // End VED Event Handling describe


    describe('dispose()', () => {
        it('should unsubscribe from VED event', () => {
            const mockSubscription = {unsubscribe: jest.fn()};
            // Ensure subscribe mock returns our specific subscription object for this test
            jest.spyOn(mockVed, 'subscribe').mockReturnValue(mockSubscription);
            const renderer = createRenderer(); // Create after setting up mock

            renderer.dispose();

            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.'));
        });

        it('should call base class dispose (logs message)', () => {
            const renderer = createRenderer();
            // Spy on the base class prototype if needed, otherwise check log
            const baseDisposeSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(renderer)), 'dispose');
            renderer.dispose();
            // Base class dispose logs "[ClassName] Disposing."
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[ActionButtonsRenderer] Disposing.'));
            expect(baseDisposeSpy).toHaveBeenCalled(); // Verify base class dispose was called
            baseDisposeSpy.mockRestore(); // Clean up spy
        });

        it('should handle multiple dispose calls gracefully', () => {
            const mockSubscription = {unsubscribe: jest.fn()};
            jest.spyOn(mockVed, 'subscribe').mockReturnValue(mockSubscription);
            const renderer = createRenderer();

            renderer.dispose();
            renderer.dispose(); // Call again

            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1); // Should only unsub once
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[ActionButtonsRenderer] Disposing.'));
        });
    }); // End dispose() describe

}); // End ActionButtonsRenderer describe