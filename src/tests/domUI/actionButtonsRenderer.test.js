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
    let mockSendButton; // Mock for the "Confirm Action" button
    const CLASS_PREFIX = '[ActionButtonsRenderer]'; // Define prefix for easier use in expects

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

        // Mock 'disabled' property for buttons
        let isDisabled = false;
        if (tagName === 'button') {
            Object.defineProperty(element, 'disabled', {
                get: () => isDisabled,
                set: (value) => {
                    isDisabled = !!value;
                },
                configurable: true
            });
        }
        // Mock classList for buttons (or any element needing it)
        // Ensure classList itself is the real one from JSDOM element
        const actualClassList = element.classList;
        // Spy on methods of the actual classList instance
        jest.spyOn(actualClassList, 'add');
        jest.spyOn(actualClassList, 'remove');
        jest.spyOn(actualClassList, 'contains');
        // Make the element's classList property return the spied actualClassList
        Object.defineProperty(element, 'classList', {
            get: () => actualClassList,
            configurable: true
        });


        return element;
    };


    beforeEach(() => {
        // Reset DOM with the *correct* ID for the container
        dom = new JSDOM(`<!DOCTYPE html><html><body><div id="game-container"><div id="action-buttons"></div><button id="send-action-button"></button></div></body></html>`);
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
        // Use createMockElement for mockSendButton to ensure it has all mocked properties/methods
        mockSendButton = createMockElement('button', 'send-action-button');
        // The line below, if uncommented, would put it in JSDOM, but we pass it directly.
        // document.body.appendChild(mockSendButton);


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
    const createRenderer = (
        containerOverride = actionButtonsContainer,
        factoryOverride = mockDomElementFactoryInstance,
        sendButtonOverride = mockSendButton // Add sendButtonOverride
    ) => {
        return new ActionButtonsRenderer({
            logger: mockLogger,
            documentContext: docContext,
            validatedEventDispatcher: mockVed,
            domElementFactory: factoryOverride,
            actionButtonsContainer: containerOverride,
            sendButtonElement: sendButtonOverride, // Pass the send button
        });
    };

    describe('Button Click Simulation', () => {
        // THIS TEST IS RENAMED AND REWRITTEN
        it('should select action, enable send button, and log selection on action button click', async () => {
            const actionToSelect = {id: 'test:examine', command: 'examine'};
            const actions = [actionToSelect, {id: 'test:go_north', command: 'go north'}];

            const mockExamineButton = createMockElement('button', '', ['action-button'], 'examine');
            // The renderer's click handler's closure will capture the actionId from when the button was created.
            // The factory mock ensures the correct button instance is associated.
            // The renderer also sets 'data-action-id', which our spy on setAttribute would catch.

            jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
                let btn;
                if (text === 'examine') {
                    btn = mockExamineButton; // Use the specific mock instance
                } else {
                    btn = createMockElement('button', '', cls ? cls.split(' ') : [], text);
                }
                // Simulate renderer setting data-action-id
                const actionForButton = actions.find(a => a.command === text);
                if (actionForButton) {
                    btn.setAttribute('data-action-id', actionForButton.id);
                }
                return btn;
            });

            const renderer = createRenderer(); // mockSendButton is passed by default
            // Constructor should set sendButtonElement.disabled = true
            expect(renderer.sendButtonElement.disabled).toBe(true);

            renderer.render(actions);

            // Check that the factory was asked to create the button
            expect(mockDomElementFactoryInstance.button).toHaveBeenCalledWith(actionToSelect.command, 'action-button');
            // Check that our specific mock button had setAttribute called by the factory spy
            expect(mockExamineButton.setAttribute).toHaveBeenCalledWith('data-action-id', actionToSelect.id);


            await mockExamineButton.click(); // Simulate click on the mock button representing "examine"

            // 1. Check selectedAction
            expect(renderer.selectedAction).toEqual(actionToSelect);

            // 2. Check send button is enabled
            expect(renderer.sendButtonElement.disabled).toBe(false);

            // 3. Check VED was NOT called for dispatch
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();

            // 4. Check for selection log message
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${actionToSelect.command}' (ID: ${actionToSelect.id})`));

            // 5. Check button has 'selected' class
            expect(mockExamineButton.classList.add).toHaveBeenCalledWith('selected');


            // 6. Check that render didn't log a warning for invalid actions
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Skipping invalid"));
        });

        it('should update selection and button states when a different action is clicked', async () => {
            const action1 = {id: 'test:action1', command: 'Action 1'};
            const action2 = {id: 'test:action2', command: 'Action 2'};
            const actions = [action1, action2];

            const mockButton1 = createMockElement('button', '', ['action-button'], action1.command);
            const mockButton2 = createMockElement('button', '', ['action-button'], action2.command);

            jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
                let btn;
                let actionId;
                if (text === action1.command) {
                    btn = mockButton1;
                    actionId = action1.id;
                } else if (text === action2.command) {
                    btn = mockButton2;
                    actionId = action2.id;
                } else {
                    btn = createMockElement('button', '', cls ? cls.split(' ') : [], text);
                    actionId = `generic:${text}`;
                }
                btn.setAttribute('data-action-id', actionId); // Renderer sets this
                return btn;
            });

            const renderer = createRenderer();
            renderer.render(actions);

            // Click first button
            await mockButton1.click();
            expect(renderer.selectedAction).toEqual(action1);
            expect(mockButton1.classList.add).toHaveBeenCalledWith('selected');
            expect(renderer.sendButtonElement.disabled).toBe(false);
            mockButton1.classList.add.mockClear(); // Clear for next check

            // Click second button
            await mockButton2.click();
            expect(renderer.selectedAction).toEqual(action2);
            expect(mockButton1.classList.remove).toHaveBeenCalledWith('selected'); // Old one deselected
            expect(mockButton2.classList.add).toHaveBeenCalledWith('selected'); // New one selected
            expect(renderer.sendButtonElement.disabled).toBe(false); // Still enabled
        });

        it('should deselect action if the same selected action button is clicked again', async () => {
            const actionToSelect = {id: 'test:examine', command: 'examine'};
            const actions = [actionToSelect];
            const mockExamineButton = createMockElement('button', '', ['action-button'], 'examine');

            jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
                mockExamineButton.setAttribute('data-action-id', actionToSelect.id);
                return mockExamineButton;
            });

            const renderer = createRenderer();
            renderer.render(actions);

            // First click: select
            await mockExamineButton.click();
            expect(renderer.selectedAction).toEqual(actionToSelect);
            expect(mockExamineButton.classList.add).toHaveBeenCalledWith('selected');
            expect(renderer.sendButtonElement.disabled).toBe(false);
            // Reset mock for classList.remove for the next check
            mockExamineButton.classList.remove.mockClear();


            // Second click: deselect
            await mockExamineButton.click();
            expect(renderer.selectedAction).toBeNull();
            expect(mockExamineButton.classList.remove).toHaveBeenCalledWith('selected');
            expect(renderer.sendButtonElement.disabled).toBe(true); // Send button disabled
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action deselected: '${actionToSelect.command}'`));
        });


        it('should NOT dispatch, and only log selection, if dispatchValidated would return false (action button click)', async () => {
            // This test's name reflects that it's testing the action button's click,
            // not a subsequent confirm button click.
            mockVed.dispatchValidated.mockResolvedValue(false); // Setup VED mock response

            const action = {id: 'test:inv', command: 'inventory'};
            const actions = [action];
            const mockButton = createMockElement('button', '', ['action-button'], action.command);
            jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
                mockButton.setAttribute('data-action-id', action.id);
                return mockButton;
            });


            const renderer = createRenderer(); // mockSendButton is passed
            renderer.render(actions);
            expect(renderer.sendButtonElement.disabled).toBe(true); // Initially

            await mockButton.click(); // Simulate click on action button

            // 1. Action button click should select, not dispatch.
            expect(renderer.selectedAction).toEqual(actions[0]);
            expect(renderer.sendButtonElement.disabled).toBe(false); // Should be enabled
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled(); // Dispatch does NOT happen here

            // 2. The original assertions for this test title are now invalid for an action button click.
            // This test title "should log warning if dispatchValidated returns false"
            // implies that a dispatch attempt was made by the component being tested (action button).
            // This test would now be relevant for the *Confirm Action button's* click handler.
            // For now, we'll assert no dispatch and no related warnings/errors from dispatch from THIS click.
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("was NOT dispatched"));

            // 3. It WILL log the selection info
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${actions[0].command}'`));
            // Ensure no "dispatched successfully" log either
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining("dispatched successfully"));
        });

        it('should NOT dispatch, and only log selection, if dispatchValidated would throw (action button click)', async () => {
            // This test's name reflects that it's testing the action button's click.
            const testError = new Error('Dispatch failed');
            mockVed.dispatchValidated.mockRejectedValue(testError); // Setup VED mock response

            const action = {id: 'test:help', command: 'help'};
            const actions = [action];
            const mockButton = createMockElement('button', '', ['action-button'], action.command);
            jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
                mockButton.setAttribute('data-action-id', action.id);
                return mockButton;
            });


            const renderer = createRenderer(); // mockSendButton is passed
            renderer.render(actions);
            expect(renderer.sendButtonElement.disabled).toBe(true); // Initially

            await mockButton.click(); // Simulate click on action button

            // 1. Action button click should select, not dispatch.
            expect(renderer.selectedAction).toEqual(actions[0]);
            expect(renderer.sendButtonElement.disabled).toBe(false); // Should be enabled
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled(); // Dispatch does NOT happen here

            // 2. Similar to the above test, the original assertions are now invalid for an action button click.
            // This would be for the *Confirm Action button's* click handler.
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining("Error occurred during dispatch"), testError);
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("was NOT dispatched"));


            // 3. It WILL log the selection info
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${actions[0].command}'`));
            // Ensure no "dispatched successfully" log either
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining("dispatched successfully"));
        });

        it('should select action and not dispatch, even if button textContent is empty at time of click (selection based on actionId)', async () => {
            const actionId = 'test:action1';
            const initialCommand = 'action1';
            const action = {id: actionId, command: initialCommand};
            const actions = [action];
            const mockButton = createMockElement('button', '', ['action-button'], initialCommand);

            jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
                if (text === initialCommand) {
                    mockButton.setAttribute('data-action-id', actionId); // Renderer sets this
                    return mockButton;
                }
                const genericBtn = createMockElement('button', '', cls ? cls.split(' ') : [], text);
                genericBtn.setAttribute('data-action-id', `generic:${text}`);
                return genericBtn;
            });


            const renderer = createRenderer(); // mockSendButton is passed
            renderer.render(actions);

            // Sanity checks after render
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Skipping invalid"));
            expect(mockButton.textContent).toBe(initialCommand);
            expect(mockButton.getAttribute('data-action-id')).toBe(actionId);
            expect(renderer.sendButtonElement.disabled).toBe(true);


            // Manually clear the text content of the DOM element AFTER rendering.
            // The current click handler in ActionButtonsRenderer retrieves the action object
            // from `this.availableActions` using `actionId`, then uses `actionObject.command`.
            // It does NOT re-read `button.textContent` to get the command at click time.
            mockButton.textContent = ''; // This change is only to the mock DOM element state
            expect(mockButton.textContent).toBe('');


            await mockButton.click(); // Simulate click

            // The specific warning:
            // `${CLASS_PREFIX} Action button clicked, but its textContent is unexpectedly empty or whitespace. ID: ${actionId}`
            // is NO LONGER PRESENT in the ActionButtonsRenderer's click handler for action buttons.
            // The handler will find `clickedActionObjectInListener` using `actionId`.
            // If found, it will use `clickedActionObjectInListener.command` (which is 'action1').
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining(`Action button clicked, but its textContent is unexpectedly empty or whitespace. ID: ${actionId}`)
            );

            // Check that no dispatch occurred (which is standard for action button clicks now)
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();

            // The action SHOULD still be selected because it's found in `availableActions` via `actionId`
            // and its `command` property ('action1') is used for selection logic.
            expect(renderer.selectedAction).toEqual(action);
            expect(renderer.sendButtonElement.disabled).toBe(false); // Send button enabled
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${initialCommand}'`));

            // The constructor warning about sendButtonElement should not appear as it's provided.
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining("'sendButtonElement' (Confirm Action button) was not provided")
            );
        });
    }); // End Button Click Simulation describe


    describe('VED Event Handling (textUI:update_available_actions)', () => {
        let updateActionsHandler;
        let mockSubscription;
        let rendererInstance;
        const eventType = 'textUI:update_available_actions'; // Define constant

        beforeEach(() => {
            // Capture the handler passed to subscribe
            mockSubscription = {unsubscribe: jest.fn()};
            // Reset the spy/mock implementation for subscribe specifically for this block
            jest.spyOn(mockVed, 'subscribe').mockImplementation((name, handler) => {
                if (name === eventType) {
                    updateActionsHandler = handler; // Capture the handler
                }
                return mockSubscription; // Return the mock subscription object
            });

            rendererInstance = createRenderer(); // Create instance, which calls subscribe (passes mockSendButton)

            // Ensure handler was captured
            if (!updateActionsHandler) {
                throw new Error(`Test setup failed: VED handler for '${eventType}' was not captured.`);
            }
            // Clear mocks that might have been called during construction before the actual test call
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear(); // Clear debug logs from constructor
            mockLogger.info.mockClear();
            jest.spyOn(rendererInstance, 'render'); // Spy on render AFTER instance creation
        });

        it('should call render with valid actions from payload', () => {
            const innerPayload = {
                actions: [
                    {id: 'core:go_n', command: 'north'},
                    {id: 'core:go_s', command: 'south'},
                    {id: 'core:examine', command: 'examine room'},
                ]
            };
            const eventObject = {type: eventType, payload: innerPayload};

            updateActionsHandler(eventObject);

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Received event object for '${eventType}'. Event Object:`), eventObject);
            expect(rendererInstance.render).toHaveBeenCalledTimes(1);
            expect(rendererInstance.render).toHaveBeenCalledWith(innerPayload.actions);
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should call render with filtered valid action objects, logging a warning', () => {
            const innerPayload = {
                actions: [
                    {id: 'core:go_n', command: 'north'},        // Valid
                    null,
                    {id: 'core:go_s'},
                    {command: 'examine'},
                    {id: 'core:take', command: 'take sword'}, // Valid
                    123,
                    {id: '', command: 'empty_id'},
                    {id: 'core:drop', command: '  '},
                    'a string',
                    {id: 'core:wait', command: 'wait'},         // Valid
                    undefined,
                ]
            };
            const eventObject = {type: eventType, payload: innerPayload};
            const expectedFilteredActions = [
                {id: 'core:go_n', command: 'north'},
                {id: 'core:take', command: 'take sword'},
                {id: 'core:wait', command: 'wait'},
            ];

            updateActionsHandler(eventObject);

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Received event object for '${eventType}'. Event Object:`), eventObject);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Received '${eventType}' with some invalid items in the nested actions array. Only valid action objects will be rendered. Original event object:`), eventObject);
            expect(rendererInstance.render).toHaveBeenCalledTimes(1);
            expect(rendererInstance.render).toHaveBeenCalledWith(expectedFilteredActions);
        });

        it('should call render with empty list and log warning if payload is invalid', () => {
            const expectedEmptyActions = [];
            const expectedWarningBase = `${CLASS_PREFIX} Received invalid or incomplete event object structure for '${eventType}'. Expected { type: '...', payload: { actions: [...] } }. Clearing action buttons. Received object:`;

            const testCases = [
                null, // Case 1
                {},   // Case 2
                {type: eventType, payload: {}}, // Case 3
                {type: eventType, payload: {actions: 'not-an-array'}}, // Case 4
                {type: eventType} // Case 5
            ];

            testCases.forEach((inputCase, index) => {
                updateActionsHandler(inputCase);
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(expectedWarningBase), inputCase);
                expect(rendererInstance.render).toHaveBeenCalledWith(expectedEmptyActions);
                rendererInstance.render.mockClear();
                mockLogger.warn.mockClear();
            });
            // Check total calls after loop for the last case to ensure it ran
            expect(rendererInstance.render).toHaveBeenCalledTimes(0); // Been cleared each time
        });
    }); // End VED Event Handling describe


    describe('dispose()', () => {
        it('should unsubscribe from VED event', () => {
            const mockSubscription = {unsubscribe: jest.fn()};
            jest.spyOn(mockVed, 'subscribe').mockReturnValue(mockSubscription);
            const renderer = createRenderer();

            renderer.dispose();

            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Disposing subscriptions.`));
        });

        it('should call base class dispose (logs message)', () => {
            const renderer = createRenderer();
            const baseDisposeSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(renderer)), 'dispose');
            renderer.dispose();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[ActionButtonsRenderer] Disposing.'));
            expect(baseDisposeSpy).toHaveBeenCalled();
            baseDisposeSpy.mockRestore();
        });

        it('should handle multiple dispose calls gracefully', () => {
            const mockSubscription = {unsubscribe: jest.fn()};
            jest.spyOn(mockVed, 'subscribe').mockReturnValue(mockSubscription);
            const renderer = createRenderer();

            renderer.dispose();
            renderer.dispose();

            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Disposing subscriptions.`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[ActionButtonsRenderer] Disposing.'));
        });
    }); // End dispose() describe

}); // End ActionButtonsRenderer describe