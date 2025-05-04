// src/tests/domUI/actionButtonsRenderer.test.js
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {JSDOM} from 'jsdom';
// Import from specific file for clarity
import {ActionButtonsRenderer} from '../../domUI/index.js';
import DocumentContext from '../../domUI/documentContext.js';
import DomElementFactory from '../../domUI/domElementFactory.js';
import ConsoleLogger from '../../core/services/consoleLogger.js';
import ValidatedEventDispatcher from '../../services/validatedEventDispatcher.js';

// Mock dependencies
jest.mock('../../core/services/consoleLogger');
jest.mock('../../services/validatedEventDispatcher');
// We need the factory instance, but want to mock its methods
jest.mock('../../domUI/domElementFactory');

describe('ActionButtonsRenderer', () => {
    let dom;
    let document;
    let docContext;
    let mockLogger;
    let mockVed;
    let mockDomElementFactory;
    let actionButtonsContainer; // The specific container for this renderer

    // --- Mock Elements ---
    const createMockElement = (tagName = 'div', id = '', classes = [], textContent = '') => {
        const element = document.createElement(tagName);
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

        // Spy on native methods
        jest.spyOn(element, 'setAttribute');
        jest.spyOn(element, 'appendChild');
        jest.spyOn(element, 'append');
        jest.spyOn(element, 'removeChild');
        jest.spyOn(element, 'remove');

        // Keep firstChild getter mock
        Object.defineProperty(element, 'firstChild', {
            get: jest.fn(() => element.childNodes[0] || null),
            configurable: true
        });

        // Simulate click
        element.click = jest.fn(async () => {
            if (element._listeners['click']) {
                for (const listener of element._listeners['click']) {
                    await listener();
                }
            }
        });
        return element;
    };

    beforeEach(() => {
        // Reset DOM with the *correct* ID for the container
        dom = new JSDOM(`<!DOCTYPE html><html><body><div id="game-container"><div id="action-buttons"></div></div></body></html>`);
        document = dom.window.document;
        docContext = new DocumentContext(document.body); // Use the new document

        mockLogger = new ConsoleLogger();
        mockVed = new ValidatedEventDispatcher(null, mockLogger);
        mockDomElementFactory = new DomElementFactory(docContext);
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

        // VED spies
        jest.spyOn(mockVed, 'subscribe').mockReturnValue({unsubscribe: jest.fn()});
        jest.spyOn(mockVed, 'dispatchValidated').mockResolvedValue(true);

        // DomElementFactory spy
        jest.spyOn(mockDomElementFactory, 'button').mockImplementation((text, cls) => {
            const classes = cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter(c => c)) : [];
            return createMockElement('button', '', classes, text);
        });

        // Spy on container's methods
        jest.spyOn(actionButtonsContainer, 'appendChild');
        jest.spyOn(actionButtonsContainer, 'removeChild');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (document && document.body) {
            document.body.innerHTML = '';
        }
    });

    // Helper to create renderer
    const createRenderer = (containerOverride = actionButtonsContainer, factoryOverride = mockDomElementFactory) => {
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

        // This test covers the exact failure mode: passing null (result of failed query)
        it('should throw if actionButtonsContainer is missing (null) or not a valid DOM element', () => {
            // Test passing null (simulates failed query in registration)
            expect(() => createRenderer(null)).toThrow(/'actionButtonsContainer' dependency is missing or not a valid DOM element/);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("[ActionButtonsRenderer] 'actionButtonsContainer' dependency is missing or not a valid DOM element."), {receivedElement: null});
            mockLogger.error.mockClear(); // Clear mock for next assertion

            // Test passing an invalid node type (e.g., text node)
            const textNode = new JSDOM().window.document.createTextNode('text');
            expect(() => createRenderer(textNode)).toThrow(/'actionButtonsContainer' dependency is missing or not a valid DOM element/);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("[ActionButtonsRenderer] 'actionButtonsContainer' dependency is missing or not a valid DOM element."), {receivedElement: textNode});
        });

        it('should throw if domElementFactory is missing or invalid', () => {
            expect(() => createRenderer(actionButtonsContainer, null)).toThrow(/'domElementFactory' dependency is missing or invalid/);
            expect(() => createRenderer(actionButtonsContainer, {})).toThrow(/'domElementFactory' dependency is missing or invalid/);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("[ActionButtonsRenderer] 'domElementFactory' dependency is missing or invalid."));
        });

        it('should subscribe to VED event event:update_available_actions', () => {
            createRenderer();
            expect(mockVed.subscribe).toHaveBeenCalledTimes(1);
            expect(mockVed.subscribe).toHaveBeenCalledWith('event:update_available_actions', expect.any(Function));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Subscribed to VED event 'event:update_available_actions'."));
        });
    });

    describe('render()', () => {
        it('should clear the container when rendering', () => {
            const oldButton = document.createElement('button');
            oldButton.textContent = 'Old Button';
            actionButtonsContainer.appendChild(oldButton);
            expect(actionButtonsContainer.children.length).toBe(1);
            expect(actionButtonsContainer.textContent).toContain('Old Button');

            const renderer = createRenderer();
            renderer.render(['look', 'go north']);

            // Verify removeChild was called on the old button (or similar clearing mechanism)
            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
            // Verify new state
            expect(actionButtonsContainer.children.length).toBe(2);
            expect(actionButtonsContainer.textContent).not.toContain('Old Button');
            expect(actionButtonsContainer.textContent).toContain('look');
            expect(actionButtonsContainer.textContent).toContain('go north');
        });

        it('should render nothing and log debug if actions list is empty', () => {
            const oldButton = document.createElement('button');
            oldButton.textContent = 'Old Button';
            actionButtonsContainer.appendChild(oldButton);
            expect(actionButtonsContainer.children.length).toBe(1);

            const renderer = createRenderer();
            renderer.render([]);

            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
            expect(actionButtonsContainer.children.length).toBe(0);
            expect(mockDomElementFactory.button).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No actions provided, container cleared.'));
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringMatching(/Rendered \d+ action buttons/));
        });

        it('should render buttons for each valid action string', () => {
            const actions = ['look', 'go north', 'talk to npc'];
            const renderer = createRenderer();
            renderer.render(actions);

            expect(mockDomElementFactory.button).toHaveBeenCalledTimes(actions.length);
            expect(actionButtonsContainer.children.length).toBe(actions.length);
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(actions.length); // Check appendChild calls

            actions.forEach((action, index) => {
                expect(mockDomElementFactory.button).toHaveBeenCalledWith(action.trim(), 'action-button');
                const button = actionButtonsContainer.children[index];
                expect(button).not.toBeNull();
                expect(button.tagName).toBe('BUTTON');
                expect(button.textContent).toBe(action);
                expect(button.classList.contains('action-button')).toBe(true);
                expect(button.setAttribute).toHaveBeenCalledWith('title', `Click to ${action}`);
                expect(button.addEventListener).toHaveBeenCalledWith('click', expect.any(Function)); // Check listener attachment
            });
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Rendered ${actions.length} action buttons.`));
        });

        it('should skip invalid actions (non-string, empty/whitespace) and log warning', () => {
            const actions = ['look', null, 'go east', '', '   ', 123, 'examine chest'];
            const validActions = ['look', 'go east', 'examine chest'];
            const renderer = createRenderer();
            renderer.render(actions);

            expect(mockDomElementFactory.button).toHaveBeenCalledTimes(validActions.length);
            expect(actionButtonsContainer.children.length).toBe(validActions.length);
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(validActions.length); // Check append calls match valid count
            expect(mockLogger.warn).toHaveBeenCalledTimes(4); // Four invalid items

            validActions.forEach((action) => {
                expect(mockDomElementFactory.button).toHaveBeenCalledWith(action.trim(), 'action-button');
                const renderedButton = Array.from(actionButtonsContainer.children).find(btn => btn.textContent === action);
                expect(renderedButton).toBeDefined();
            });

            // Verify specific warnings
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid or empty action string in list: "null"'));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid or empty action string in list: ""'));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid or empty action string in list: "   "'));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid or empty action string in list: "123"'));

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Rendered ${validActions.length} action buttons.`));
        });

        it('should log error and clear container if actions argument is not an array', () => {
            const oldButton = document.createElement('button');
            oldButton.textContent = 'Old Button';
            actionButtonsContainer.appendChild(oldButton);
            expect(actionButtonsContainer.children.length).toBe(1);

            const renderer = createRenderer();

            renderer.render('not an array');
            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
            expect(actionButtonsContainer.children.length).toBe(0); // Container should be cleared
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid actions argument received. Expected array, got:'), 'not an array');
            expect(mockDomElementFactory.button).not.toHaveBeenCalled(); // No buttons should be created

            // Reset for next invalid type
            mockLogger.error.mockClear();
            actionButtonsContainer.appendChild(oldButton); // Put back for clearing check
            actionButtonsContainer.removeChild.mockClear();

            renderer.render(null);
            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
            expect(actionButtonsContainer.children.length).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid actions argument received. Expected array, got:'), null);

            // Reset for next invalid type
            mockLogger.error.mockClear();
            actionButtonsContainer.appendChild(oldButton);
            actionButtonsContainer.removeChild.mockClear();


            renderer.render(undefined);
            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
            expect(actionButtonsContainer.children.length).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid actions argument received. Expected array, got:'), undefined);

            // Reset for next invalid type
            mockLogger.error.mockClear();
            actionButtonsContainer.appendChild(oldButton);
            actionButtonsContainer.removeChild.mockClear();


            renderer.render({actions: []}); // Object is not an array
            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
            expect(actionButtonsContainer.children.length).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid actions argument received. Expected array, got:'), {actions: []});
        });

        it('should log error and skip if factory fails to create a button', () => {
            const actions = ['look', 'fail', 'go north'];
            mockDomElementFactory.button.mockImplementation((text, cls) => {
                if (text === 'fail') return null;
                const classes = cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter(c => c)) : [];
                return createMockElement('button', '', classes, text); // Use mock element creation
            });

            const renderer = createRenderer();
            renderer.render(actions);

            expect(mockDomElementFactory.button).toHaveBeenCalledTimes(actions.length); // Factory attempted for all
            expect(actionButtonsContainer.children.length).toBe(2); // Only 2 succeeded
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(2); // Appended only 2
            expect(actionButtonsContainer.textContent).toContain('look');
            expect(actionButtonsContainer.textContent).toContain('go north');
            expect(actionButtonsContainer.textContent).not.toContain('fail');
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create button element for action: "fail"'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Rendered 2 action buttons.`));
        });
    });

    describe('Button Click Simulation', () => {
        it('should dispatch validated command:submit event on button click', async () => {
            const actions = ['examine'];
            const renderer = createRenderer();
            renderer.render(actions);

            const button = actionButtonsContainer.querySelector('button');
            expect(button).not.toBeNull();
            expect(button.click).toBeDefined(); // Ensure mock click exists

            await button.click(); // Simulate click

            expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockVed.dispatchValidated).toHaveBeenCalledWith('command:submit', {command: 'examine'});
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Event 'command:submit' for \"examine\" dispatched successfully."));
        });

        it('should log warning if dispatchValidated returns false', async () => {
            mockVed.dispatchValidated.mockResolvedValue(false); // Setup VED mock response

            const actions = ['inventory'];
            const renderer = createRenderer();
            renderer.render(actions);
            const button = actionButtonsContainer.querySelector('button');
            expect(button).not.toBeNull();

            await button.click(); // Simulate click

            expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockVed.dispatchValidated).toHaveBeenCalledWith('command:submit', {command: 'inventory'});
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Event 'command:submit' for \"inventory\" was NOT dispatched"));
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining("dispatched successfully"));
        });

        it('should log error if dispatchValidated throws an error', async () => {
            const testError = new Error('Dispatch failed');
            mockVed.dispatchValidated.mockRejectedValue(testError); // Setup VED mock response

            const actions = ['help'];
            const renderer = createRenderer();
            renderer.render(actions);
            const button = actionButtonsContainer.querySelector('button');
            expect(button).not.toBeNull();

            await button.click(); // Simulate click

            expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockVed.dispatchValidated).toHaveBeenCalledWith('command:submit', {command: 'help'});
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Error occurred during dispatch of 'command:submit' for \"help\":"), testError);
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining("dispatched successfully"));
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("was NOT dispatched"));
        });

        it('should log warning and not dispatch if button textContent is empty at time of click', async () => {
            const renderer = createRenderer();
            // Use the mock factory to return a button with initially empty text
            mockDomElementFactory.button.mockReturnValueOnce(createMockElement('button', '', ['action-button'], ''));

            renderer.render(['action1']); // Render one button, which will be the empty one

            const button = actionButtonsContainer.querySelector('button');
            expect(button).not.toBeNull();
            expect(button.textContent).toBe('');

            await button.click(); // Simulate click

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Action button clicked, but textContent is unexpectedly empty."));
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
        });
    });

    describe('VED Event Handling (event:update_available_actions)', () => {
        let updateActionsHandler;
        let mockSubscription;
        let rendererInstance;

        beforeEach(() => {
            // Capture the handler passed to subscribe
            mockSubscription = {unsubscribe: jest.fn()};
            mockVed.subscribe.mockImplementation((eventName, handler) => {
                if (eventName === 'event:update_available_actions') {
                    updateActionsHandler = handler; // Capture the handler
                }
                return mockSubscription;
            });
            rendererInstance = createRenderer(); // Create instance, which calls subscribe
            // Ensure handler was captured
            if (!updateActionsHandler) {
                throw new Error("Test setup failed: VED handler for 'event:update_available_actions' was not captured.");
            }
            // Clear mocks that might have been called during construction before the actual test call
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear(); // Clear debug logs from constructor
        });

        it('should call render with valid actions from payload', () => {
            jest.spyOn(rendererInstance, 'render'); // Spy on the render method of the instance
            const payload = {actions: ['north', 'south', 'east', 'west']};
            const eventType = 'event:update_available_actions';

            updateActionsHandler(payload, eventType); // Call the captured handler

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received '${eventType}' event. Payload:`), payload);
            expect(rendererInstance.render).toHaveBeenCalledTimes(1);
            expect(rendererInstance.render).toHaveBeenCalledWith(payload.actions);
            expect(mockLogger.warn).not.toHaveBeenCalled(); // No warning for valid payload
        });

        it('should call render with filtered string actions if payload contains non-strings, logging a warning', () => {
            jest.spyOn(rendererInstance, 'render');
            const payload = {actions: ['north', null, 'south', 123, '', '  ', 'west', undefined]};
            const eventType = 'event:update_available_actions';
            // Filter logic in handler keeps only strings
            const expectedFilteredActions = ['north', 'south', '', '  ', 'west'];

            updateActionsHandler(payload, eventType);

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received '${eventType}' event. Payload:`), payload);
            // Check that the warning about non-string items was logged *before* render is checked
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Received \'event:update_available_actions\' with some non-string items in the actions array. Only string actions will be rendered.'), payload);
            // Check render call
            expect(rendererInstance.render).toHaveBeenCalledTimes(1);
            expect(rendererInstance.render).toHaveBeenCalledWith(expectedFilteredActions);
        });

        it('should call render with empty list and log warning if payload is invalid', () => {
            jest.spyOn(rendererInstance, 'render');
            const eventType = 'event:update_available_actions';

            updateActionsHandler(null, eventType); // Null payload
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received invalid or incomplete payload for 'event:update_available_actions'. Clearing action buttons."), null);
            expect(rendererInstance.render).toHaveBeenCalledWith([]);


            rendererInstance.render.mockClear(); // Reset mocks for next case
            mockLogger.warn.mockClear();

            updateActionsHandler({}, eventType); // Missing 'actions' property
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received invalid or incomplete payload for 'event:update_available_actions'. Clearing action buttons."), {});
            expect(rendererInstance.render).toHaveBeenCalledWith([]);

            rendererInstance.render.mockClear();
            mockLogger.warn.mockClear();

            updateActionsHandler({actions: 'not-an-array'}, eventType); // 'actions' not an array
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received invalid or incomplete payload for 'event:update_available_actions'. Clearing action buttons."), {actions: 'not-an-array'});
            expect(rendererInstance.render).toHaveBeenCalledWith([]);

            // Verify render was called 3 times in total for the invalid cases
            expect(rendererInstance.render).toHaveBeenCalledTimes(1); // (Cleared after each check) -> should be 1 per check
        });
    });

    describe('dispose()', () => {
        it('should unsubscribe from VED event', () => {
            const mockSubscription = {unsubscribe: jest.fn()};
            mockVed.subscribe.mockReturnValue(mockSubscription); // Ensure subscribe returns our mock
            const renderer = createRenderer(); // Create after setting up mock

            renderer.dispose();

            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.'));
        });

        it('should call base class dispose (logs message)', () => {
            const renderer = createRenderer();
            // Mock or spy on the base class's dispose if needed, but here we check the log
            renderer.dispose();
            // Base class dispose logs "[ClassName] Disposing."
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[ActionButtonsRenderer] Disposing.'));
        });

        it('should handle multiple dispose calls gracefully', () => {
            const mockSubscription = {unsubscribe: jest.fn()};
            mockVed.subscribe.mockReturnValue(mockSubscription);
            const renderer = createRenderer();

            renderer.dispose();
            renderer.dispose(); // Call again

            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1); // Should only unsub once
            // Check logs were called, potentially multiple times is okay if harmless
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[ActionButtonsRenderer] Disposing.'));
            // Could add expect(mockLogger.debug).toHaveBeenCalledTimes(2) for each log if strictness is needed
        });

        it('should clear internal subscriptions array', () => {
            const mockSubscription = {unsubscribe: jest.fn()};
            mockVed.subscribe.mockReturnValue(mockSubscription);
            const renderer = createRenderer();
            // Access private member for verification (common in JS testing)
            expect(renderer['_ActionButtonsRenderer#subscriptions']).toHaveLength(1);

            renderer.dispose();

            expect(renderer['_ActionButtonsRenderer#subscriptions']).toHaveLength(0); // Array should be cleared
        });
    });
});