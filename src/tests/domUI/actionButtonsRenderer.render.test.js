// src/tests/domUI/actionButtonsRenderer.render.test.js
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
    const createMockElement = (tagName = 'div', id = '', classes = [], textContent = '') => {
        const element = document.createElement(tagName);
        if (id) element.id = id;
        const classArray = Array.isArray(classes) ? classes : String(classes).split(' ').filter(c => c);
        if (classArray.length > 0) {
            element.classList.add(...classArray);
        }
        element.textContent = textContent;

        element._attributes = {};
        element._listeners = {};

        element.addEventListener = jest.fn((event, cb) => {
            if (!element._listeners[event]) {
                element._listeners[event] = [];
            }
            element._listeners[event].push(cb);
        });
        element.removeEventListener = jest.fn();

        element.click = jest.fn(async () => {
            if (element._listeners['click']) {
                for (const listener of element._listeners['click']) {
                    await listener();
                }
            }
        });

        jest.spyOn(element, 'setAttribute').mockImplementation((name, value) => {
            element._attributes[name] = value;
        });
        element.getAttribute = jest.fn((name) => element._attributes[name]);
        jest.spyOn(element, 'remove');

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
        dom = new JSDOM(`<!DOCTYPE html><html><body><div id="game-container"><div id="action-buttons"></div><button id="send-action-button"></button></div></body></html>`);
        document = dom.window.document;
        global.document = document;
        global.HTMLElement = dom.window.HTMLElement;

        docContext = new DocumentContext();

        mockLogger = new ConsoleLogger();
        mockVed = new ValidatedEventDispatcher({
            eventBus: {subscribe: jest.fn(), unsubscribe: jest.fn(), dispatch: jest.fn().mockResolvedValue(undefined)},
            gameDataRepository: {getEventDefinition: jest.fn()},
            schemaValidator: {
                isSchemaLoaded: jest.fn().mockReturnValue(true),
                validate: jest.fn().mockReturnValue({isValid: true})
            },
            logger: mockLogger
        });

        mockDomElementFactoryInstance = new DomElementFactory(docContext);
        jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
            const classes = cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter(c => c)) : [];
            return createMockElement('button', '', classes, text);
        });

        actionButtonsContainer = document.getElementById('action-buttons');
        mockSendButton = createMockElement('button', 'send-action-button'); // Create mock send button

        if (!actionButtonsContainer) {
            throw new Error("Test setup failed: #action-buttons container not found in JSDOM.");
        }

        jest.spyOn(mockLogger, 'info');
        jest.spyOn(mockLogger, 'warn');
        jest.spyOn(mockLogger, 'error');
        jest.spyOn(mockLogger, 'debug');

        jest.spyOn(mockVed, 'subscribe').mockReturnValue({unsubscribe: jest.fn()});
        jest.spyOn(mockVed, 'dispatchValidated').mockResolvedValue(true);
        jest.spyOn(mockVed, 'unsubscribe');

        jest.spyOn(actionButtonsContainer, 'appendChild');
        jest.spyOn(actionButtonsContainer, 'removeChild');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete global.document;
        delete global.HTMLElement;
        if (document && document.body) {
            document.body.innerHTML = '';
        }
    });

    // Helper to create renderer, now includes sendButtonElement
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

    // --- Test Scenarios ---

    describe('render()', () => {
        it('should clear the container when rendering', () => {
            const oldButton = document.createElement('button');
            oldButton.id = 'old-button';
            oldButton.textContent = 'Old Button';
            actionButtonsContainer.appendChild(oldButton); // This is call #1 to the spy for this test

            expect(actionButtonsContainer.children.length).toBe(1);

            const renderer = createRenderer();
            const newActions = [
                {id: 'test:look', command: 'look'},
                {id: 'test:go_n', command: 'go north'}
            ];
            mockLogger.info.mockClear();

            // *** ADD THIS LINE TO CLEAR THE SPY'S CALL COUNT ***
            actionButtonsContainer.appendChild.mockClear();

            renderer.render(newActions); // This will call appendChild twice for newActions

            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
            const finalButtons = actionButtonsContainer.querySelectorAll('button');
            expect(finalButtons.length).toBe(2);
            expect(actionButtonsContainer.textContent).not.toContain('Old Button');
            expect(actionButtonsContainer.textContent).toContain('look');
            expect(actionButtonsContainer.textContent).toContain('go north');

            const lookButtonResult = mockDomElementFactoryInstance.button.mock.results.find(r => r.value.textContent === 'look');
            const goNorthButtonResult = mockDomElementFactoryInstance.button.mock.results.find(r => r.value.textContent === 'go north');
            expect(lookButtonResult).toBeDefined();
            expect(goNorthButtonResult).toBeDefined();
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledWith(lookButtonResult.value);
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledWith(goNorthButtonResult.value);
            // Now this assertion should pass, as it only counts calls after mockClear()
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(2);
        });

        it('should render nothing and log debug if actions list is empty', () => {
            const oldButton = document.createElement('button');
            oldButton.id = 'old-button-empty-test';
            oldButton.textContent = 'Old Button';
            actionButtonsContainer.appendChild(oldButton);
            actionButtonsContainer.appendChild.mockClear(); // Clear calls from setup

            const renderer = createRenderer();
            mockLogger.debug.mockClear(); // Clear constructor debug logs
            mockLogger.info.mockClear();  // Clear constructor info logs

            renderer.render([]);

            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
            expect(actionButtonsContainer.children.length).toBe(0);
            expect(mockDomElementFactoryInstance.button).not.toHaveBeenCalled();

            // Check the specific sequence of debug logs
            // 1. render() called...
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`${CLASS_PREFIX} render() called. Total actions received: 0. Selected action reset.`),
                {actions: []}
            );
            // 2. Action buttons container cleared...
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`${CLASS_PREFIX} Action buttons container cleared, selected action reset, confirm button disabled.`)
            );
            // 3. No actions provided to render...
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`${CLASS_PREFIX} No actions provided to render, container remains empty. Confirm button remains disabled.`)
            );

            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringMatching(/Rendered \d+ action buttons/));
            expect(actionButtonsContainer.appendChild).not.toHaveBeenCalled();
        });


        it('should render buttons for each valid action object', () => {
            const actions = [
                {id: 'test:look', command: 'look'},
                {id: 'test:go_n', command: 'go north'},
                {id: 'test:talk', command: 'talk to npc'}
            ];
            const renderer = createRenderer();
            mockLogger.info.mockClear(); // Clear constructor/setup logs
            mockLogger.debug.mockClear();
            actionButtonsContainer.appendChild.mockClear(); // Clear setup appends for this test


            renderer.render(actions);

            expect(mockDomElementFactoryInstance.button).toHaveBeenCalledTimes(actions.length);
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(actions.length);
            expect(actionButtonsContainer.children.length).toBe(actions.length);

            actions.forEach((actionObject, index) => {
                expect(mockDomElementFactoryInstance.button).toHaveBeenCalledWith(actionObject.command.trim(), 'action-button');
                const mockButton = mockDomElementFactoryInstance.button.mock.results[index].value;
                expect(mockButton).not.toBeNull();
                expect(mockButton.tagName).toBe('BUTTON');
                expect(mockButton.textContent).toBe(actionObject.command);
                expect(mockButton.classList.contains('action-button')).toBe(true);
                expect(mockButton.setAttribute).toHaveBeenCalledWith('title', `Select action: ${actionObject.command}`);
                expect(mockButton.setAttribute).toHaveBeenCalledWith('data-action-id', actionObject.id);
                expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
                expect(actionButtonsContainer.appendChild).toHaveBeenCalledWith(mockButton);
            });
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Rendered ${actionButtonsContainer.children.length} action buttons. Selected action: none.`));
        });

        it('should skip invalid actions (invalid objects, non-objects) and log warning', () => {
            const actions = [
                {id: 'test:look', command: 'look'},          // Valid
                null,
                {id: 'test:go_e'},
                {command: 'examine'},
                {id: 'test:take', command: '   '},
                123,
                {id: 'test:examine', command: 'examine chest'},// Valid
                '',
                {id: '', command: 'empty id'},
                {id: 'test:drop', command: 'drop key'},       // Valid
            ];
            const validActions = actions.filter(action =>
                action && typeof action === 'object' &&
                typeof action.id === 'string' && action.id.length > 0 &&
                typeof action.command === 'string' && action.command.trim().length > 0
            );
            const invalidActionCount = actions.length - validActions.length;

            const renderer = createRenderer();
            mockLogger.warn.mockClear();
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            actionButtonsContainer.appendChild.mockClear(); // Clear setup appends


            renderer.render(actions);

            expect(mockDomElementFactoryInstance.button).toHaveBeenCalledTimes(validActions.length);
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(validActions.length);
            expect(actionButtonsContainer.children.length).toBe(validActions.length);
            expect(mockLogger.warn).toHaveBeenCalledTimes(invalidActionCount);

            validActions.forEach((action) => {
                expect(mockDomElementFactoryInstance.button).toHaveBeenCalledWith(action.command.trim(), 'action-button');
                const mockButton = mockDomElementFactoryInstance.button.mock.results.find(r => r.value?.getAttribute('data-action-id') === action.id)?.value;
                expect(mockButton).toBeDefined();
                expect(actionButtonsContainer.appendChild).toHaveBeenCalledWith(mockButton);
            });

            const warningBase = `${CLASS_PREFIX} Skipping invalid action object during render: `;
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(warningBase), null);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(warningBase), {id: 'test:go_e'});
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(warningBase), {command: 'examine'});
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(warningBase), {
                id: 'test:take',
                command: '   '
            });
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(warningBase), 123);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(warningBase), '');
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(warningBase), {
                id: '',
                command: 'empty id'
            });

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Rendered ${validActions.length} action buttons. Selected action: none.`));
        });


        it('should treat non-array actions argument as empty list, not log error, and clear container', () => {
            const oldButton = document.createElement('button');
            oldButton.textContent = 'Old Button';
            actionButtonsContainer.appendChild(oldButton);
            actionButtonsContainer.appendChild.mockClear(); // Clear setup append

            const renderer = createRenderer();

            const testCases = [
                'not an array',
                null,
                undefined,
                {actions: []} // Object, not an array
            ];

            testCases.forEach(inputCase => {
                mockLogger.error.mockClear();
                mockLogger.debug.mockClear();
                mockLogger.info.mockClear();
                actionButtonsContainer.removeChild.mockClear();
                mockDomElementFactoryInstance.button.mockClear(); // Clear factory calls
                actionButtonsContainer.appendChild.mockClear(); // Clear appendChild calls before render


                // Ensure oldButton is present for removal check, if not already removed
                if (!actionButtonsContainer.contains(oldButton)) {
                    // If a previous iteration removed it, re-add and clear the append mock
                    actionButtonsContainer.appendChild(oldButton);
                    actionButtonsContainer.appendChild.mockClear();
                }


                renderer.render(inputCase);

                expect(mockLogger.error).not.toHaveBeenCalled();
                expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
                expect(actionButtonsContainer.children.length).toBe(0);

                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`${CLASS_PREFIX} render() called. Total actions received: 0. Selected action reset.`),
                    {actions: []}
                );
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`${CLASS_PREFIX} Action buttons container cleared, selected action reset, confirm button disabled.`)
                );
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`${CLASS_PREFIX} No actions provided to render, container remains empty. Confirm button remains disabled.`)
                );

                expect(mockDomElementFactoryInstance.button).not.toHaveBeenCalled();
                expect(actionButtonsContainer.appendChild).not.toHaveBeenCalled();
                expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringMatching(/Rendered \d+ action buttons/));
            });
        });

        it('should log error and skip if factory fails to create a button', () => {
            const actions = [
                {id: 'test:look', command: 'look'},
                {id: 'test:fail', command: 'fail_command'},
                {id: 'test:go_n', command: 'go north'}
            ];
            const expectedFinalButtonCount = 2;

            jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
                if (text === 'fail_command') return null;
                const classes = cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter(c => c)) : [];
                return createMockElement('button', '', classes, text);
            });

            const renderer = createRenderer();
            mockLogger.error.mockClear();
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();
            actionButtonsContainer.appendChild.mockClear(); // Clear setup appends


            renderer.render(actions);

            expect(mockDomElementFactoryInstance.button).toHaveBeenCalledTimes(actions.length);
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(expectedFinalButtonCount);
            expect(actionButtonsContainer.children.length).toBe(expectedFinalButtonCount);

            const lookButtonResult = mockDomElementFactoryInstance.button.mock.results.find(r => r.value?.textContent === 'look');
            const goNorthButtonResult = mockDomElementFactoryInstance.button.mock.results.find(r => r.value?.textContent === 'go north');
            expect(lookButtonResult).toBeDefined();
            expect(goNorthButtonResult).toBeDefined();

            expect(actionButtonsContainer.appendChild).toHaveBeenCalledWith(lookButtonResult.value);
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledWith(goNorthButtonResult.value);
            expect(actionButtonsContainer.appendChild).not.toHaveBeenCalledWith(null);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Failed to create button element for action: "fail_command" (ID: test:fail)`));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Rendered ${expectedFinalButtonCount} action buttons. Selected action: none.`));
        });

    }); // End render() describe
}); // End ActionButtonsRenderer describe