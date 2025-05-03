// src/tests/domUI/actionButtonsRenderer.test.js
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {JSDOM} from 'jsdom';
// Import from specific file for clarity
import {ActionButtonsRenderer} from '../../domUI/actionButtonsRenderer.js';
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
        dom = new JSDOM(`<!DOCTYPE html><html><body><div id="game-container"><div id="action-buttons"></div></div></body></html>`);
        document = dom.window.document;
        docContext = new DocumentContext(document.body);

        mockLogger = new ConsoleLogger();
        mockVed = new ValidatedEventDispatcher(null, mockLogger);
        mockDomElementFactory = new DomElementFactory(docContext);
        actionButtonsContainer = document.getElementById('action-buttons');

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

        it('should throw if actionButtonsContainer is missing or invalid', () => {
            expect(() => createRenderer(null)).toThrow(/'actionButtonsContainer' dependency is missing or not a valid DOM element/);
            const textNode = new JSDOM().window.document.createTextNode('text');
            expect(() => createRenderer(textNode)).toThrow(/'actionButtonsContainer' dependency is missing or not a valid DOM element/);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("[ActionButtonsRenderer] 'actionButtonsContainer' dependency is missing or not a valid DOM element."), expect.anything());
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

            actions.forEach((action, index) => {
                expect(mockDomElementFactory.button).toHaveBeenCalledWith(action.trim(), 'action-button');
                const button = actionButtonsContainer.children[index];
                expect(button).not.toBeNull();
                expect(button.tagName).toBe('BUTTON');
                expect(button.textContent).toBe(action);
                expect(button.classList.contains('action-button')).toBe(true);
                expect(button.setAttribute).toHaveBeenCalledWith('title', `Click to ${action}`);
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
            expect(mockLogger.warn).toHaveBeenCalledTimes(4);

            validActions.forEach((action) => {
                expect(mockDomElementFactory.button).toHaveBeenCalledWith(action.trim(), 'action-button');
                const renderedButton = Array.from(actionButtonsContainer.children).find(btn => btn.textContent === action);
                expect(renderedButton).toBeDefined();
            });

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
            expect(actionButtonsContainer.children.length).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid actions argument received. Expected array, got:'), 'not an array');
            expect(mockDomElementFactory.button).not.toHaveBeenCalled();

            mockLogger.error.mockClear();
            actionButtonsContainer.appendChild(oldButton);

            renderer.render(null);
            expect(actionButtonsContainer.children.length).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid actions argument received. Expected array, got:'), null);

            mockLogger.error.mockClear();
            actionButtonsContainer.appendChild(oldButton);

            renderer.render(undefined);
            expect(actionButtonsContainer.children.length).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid actions argument received. Expected array, got:'), undefined);

            mockLogger.error.mockClear();
            actionButtonsContainer.appendChild(oldButton);

            renderer.render({actions: []});
            expect(actionButtonsContainer.children.length).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid actions argument received. Expected array, got:'), {actions: []});
        });

        it('should log error and skip if factory fails to create a button', () => {
            const actions = ['look', 'fail', 'go north'];
            mockDomElementFactory.button.mockImplementation((text, cls) => {
                if (text === 'fail') return null;
                const classes = cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter(c => c)) : [];
                return createMockElement('button', '', classes, text);
            });

            const renderer = createRenderer();
            renderer.render(actions);

            expect(mockDomElementFactory.button).toHaveBeenCalledTimes(actions.length);
            expect(actionButtonsContainer.children.length).toBe(2);
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
            expect(button.click).toBeDefined();

            await button.click();

            expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockVed.dispatchValidated).toHaveBeenCalledWith('command:submit', {command: 'examine'});
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Event 'command:submit' for \"examine\" dispatched successfully."));
        });

        it('should log warning if dispatchValidated returns false', async () => {
            mockVed.dispatchValidated.mockResolvedValue(false);

            const actions = ['inventory'];
            const renderer = createRenderer();
            renderer.render(actions);
            const button = actionButtonsContainer.querySelector('button');
            expect(button).not.toBeNull();

            await button.click();

            expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockVed.dispatchValidated).toHaveBeenCalledWith('command:submit', {command: 'inventory'});
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Event 'command:submit' for \"inventory\" was NOT dispatched"));
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining("dispatched successfully"));
        });

        it('should log error if dispatchValidated throws an error', async () => {
            const testError = new Error('Dispatch failed');
            mockVed.dispatchValidated.mockRejectedValue(testError);

            const actions = ['help'];
            const renderer = createRenderer();
            renderer.render(actions);
            const button = actionButtonsContainer.querySelector('button');
            expect(button).not.toBeNull();

            await button.click();

            expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockVed.dispatchValidated).toHaveBeenCalledWith('command:submit', {command: 'help'});
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Error occurred during dispatch of 'command:submit' for \"help\":"), testError);
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining("dispatched successfully"));
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("was NOT dispatched"));
        });

        it('should log warning and not dispatch if button textContent is empty', async () => {
            const renderer = createRenderer();
            mockDomElementFactory.button.mockReturnValueOnce(createMockElement('button', '', ['action-button'], ''));

            renderer.render(['will be replaced']);

            const button = actionButtonsContainer.querySelector('button');
            expect(button).not.toBeNull();
            expect(button.textContent).toBe('');

            await button.click();

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Action button clicked, but textContent is unexpectedly empty."));
            expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
        });
    });

    describe('VED Event Handling (event:update_available_actions)', () => {
        let updateActionsHandler;
        let mockSubscription;
        let rendererInstance;

        beforeEach(() => {
            mockSubscription = {unsubscribe: jest.fn()};
            mockVed.subscribe.mockImplementation((eventName, handler) => {
                if (eventName === 'event:update_available_actions') {
                    updateActionsHandler = handler;
                }
                return mockSubscription;
            });
            rendererInstance = createRenderer();
            // Clear mocks that might have been called during construction before the actual test call
            mockLogger.warn.mockClear();
        });

        it('should call render with valid actions from payload', () => {
            jest.spyOn(rendererInstance, 'render');
            const payload = {actions: ['north', 'south', 'east', 'west']};

            updateActionsHandler(payload, 'event:update_available_actions');

            expect(rendererInstance.render).toHaveBeenCalledTimes(1);
            expect(rendererInstance.render).toHaveBeenCalledWith(payload.actions);
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should call render with filtered actions if payload contains non-strings', () => {
            jest.spyOn(rendererInstance, 'render');
            const payload = {actions: ['north', null, 'south', 123, '', '  ', 'west']};
            // --- FIX: Correct expected array based on handler's filtering ---
            const expectedFilteredActions = ['north', 'south', '', '  ', 'west'];

            updateActionsHandler(payload, 'event:update_available_actions');

            expect(rendererInstance.render).toHaveBeenCalledTimes(1);
            expect(rendererInstance.render).toHaveBeenCalledWith(expectedFilteredActions);
            // Check that the warning about non-string items was logged
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Received \'event:update_available_actions\' with some non-string items'), payload);
        });

        it('should call render with empty list if payload is invalid', () => {
            jest.spyOn(rendererInstance, 'render');

            updateActionsHandler(null, 'event:update_available_actions'); // Null payload
            expect(rendererInstance.render).toHaveBeenCalledWith([]);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received invalid or incomplete payload for 'event:update_available_actions'. Clearing action buttons."), null);

            // Clear mocks for next check within the same test
            rendererInstance.render.mockClear();
            mockLogger.warn.mockClear();

            updateActionsHandler({}, 'event:update_available_actions'); // Missing 'actions'
            expect(rendererInstance.render).toHaveBeenCalledWith([]);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received invalid or incomplete payload for 'event:update_available_actions'. Clearing action buttons."), {});

            rendererInstance.render.mockClear();
            mockLogger.warn.mockClear();

            updateActionsHandler({actions: 'not-an-array'}, 'event:update_available_actions'); // 'actions' not an array
            expect(rendererInstance.render).toHaveBeenCalledWith([]);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received invalid or incomplete payload for 'event:update_available_actions'. Clearing action buttons."), {actions: 'not-an-array'});

            // Check total calls if needed, though individual checks are often clearer
            // expect(rendererInstance.render).toHaveBeenCalledTimes(3);
        });
    });

    describe('dispose()', () => {
        it('should unsubscribe from VED event', () => {
            const mockSubscription = {unsubscribe: jest.fn()};
            mockVed.subscribe.mockReturnValue(mockSubscription);
            const renderer = createRenderer();

            renderer.dispose();

            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.'));
        });

        it('should call base class dispose', () => {
            const renderer = createRenderer();
            renderer.dispose();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[ActionButtonsRenderer] Disposing.'));
        });

        it('should handle multiple calls gracefully', () => {
            const mockSubscription = {unsubscribe: jest.fn()};
            mockVed.subscribe.mockReturnValue(mockSubscription);
            const renderer = createRenderer();

            renderer.dispose();
            renderer.dispose();

            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[ActionButtonsRenderer] Disposing.'));
        });
    });
});