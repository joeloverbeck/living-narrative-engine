// tests/domUI/actionButtonsRenderer.render.test.js
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {JSDOM} from 'jsdom';
import {ActionButtonsRenderer} from '../../src/domUI/index.js';
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../src/services/consoleLogger.js';
import ValidatedEventDispatcher from '../../src/events/validatedEventDispatcher.js';

jest.mock('../../src/services/consoleLogger.js');
jest.mock('../../src/events/validatedEventDispatcher.js');
jest.mock('../../src/domUI/domElementFactory.js');

// Helper to create valid test action objects
const createValidTestAction = (id, name, command, description) => ({
    id: id,
    name: name || `Test Name for ${id}`,
    command: command || `test_command_for_${id}`,
    description: description || `Test description for ${id}.`,
});

describe('ActionButtonsRenderer', () => {
    let dom;
    let document;
    let docContext;
    let mockLogger;
    let mockVed;
    let mockDomElementFactoryInstance;
    let actionButtonsContainer;
    let mockSendButton;
    const CLASS_PREFIX = '[ActionButtonsRenderer]';

    const createMockElement = (tagName = 'div', id = '', classes = [], textContent = '') => {
        const element = document.createElement(tagName);
        if (id) element.id = id;
        const classArray = Array.isArray(classes) ? classes : String(classes).split(' ').filter(c => c);
        if (classArray.length > 0) element.classList.add(...classArray);
        element.textContent = textContent;

        element._attributes = {};
        element._listeners = {};

        element.addEventListener = jest.fn((event, cb) => {
            if (!element._listeners[event]) element._listeners[event] = [];
            element._listeners[event].push(cb);
        });
        element.removeEventListener = jest.fn();
        element.click = jest.fn(async () => {
            if (element._listeners['click']) {
                for (const listener of element._listeners['click']) await listener();
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
                get: () => isDisabled, set: (value) => {
                    isDisabled = !!value;
                }, configurable: true
            });
        }

        if (element.classList) {
            jest.spyOn(element.classList, 'add');
            jest.spyOn(element.classList, 'remove');
            jest.spyOn(element.classList, 'contains');
        }
        return element;
    };

    beforeEach(() => {
        dom = new JSDOM(`<!DOCTYPE html><html><body><div id="game-container"><div id="action-buttons"></div><button id="send-action-button"></button></div></body></html>`);
        document = dom.window.document;
        global.document = document;
        global.HTMLElement = dom.window.HTMLElement;
        global.HTMLButtonElement = dom.window.HTMLButtonElement;

        docContext = new DocumentContext(document);

        mockLogger = new ConsoleLogger();
        mockVed = new ValidatedEventDispatcher({});

        mockDomElementFactoryInstance = new DomElementFactory(docContext);
        jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
            const classes = cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter(c => c)) : [];
            const btn = createMockElement('button', '', classes, text);
            if (btn.tagName !== 'BUTTON') {
                Object.defineProperty(btn, 'tagName', {value: 'BUTTON', configurable: true});
            }
            return btn;
        });

        actionButtonsContainer = document.getElementById('action-buttons');
        mockSendButton = createMockElement('button', 'send-action-button');
        const originalSendButton = document.getElementById('send-action-button');
        if (originalSendButton && originalSendButton.parentNode) {
            originalSendButton.parentNode.replaceChild(mockSendButton, originalSendButton);
        } else {
            document.body.appendChild(mockSendButton);
        }

        if (!actionButtonsContainer) {
            throw new Error("Test setup failed: #action-buttons container not found in JSDOM.");
        }

        jest.spyOn(mockLogger, 'info');
        jest.spyOn(mockLogger, 'warn');
        jest.spyOn(mockLogger, 'error');
        jest.spyOn(mockLogger, 'debug');
        mockVed.subscribe.mockReturnValue({unsubscribe: jest.fn()});
        jest.spyOn(mockVed, 'dispatchValidated').mockResolvedValue(true);
        jest.spyOn(actionButtonsContainer, 'appendChild');
        jest.spyOn(actionButtonsContainer, 'removeChild');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (dom) dom.window.close();
        delete global.document;
        delete global.HTMLElement;
        delete global.HTMLButtonElement;
    });

    const createRenderer = (
        containerOverride = actionButtonsContainer,
        factoryOverride = mockDomElementFactoryInstance,
        sendButtonOverride = mockSendButton
    ) => {
        const testDocContext = new DocumentContext(document);
        return new ActionButtonsRenderer({
            logger: mockLogger,
            documentContext: testDocContext,
            validatedEventDispatcher: mockVed,
            domElementFactory: factoryOverride,
            actionButtonsContainer: containerOverride,
            sendButtonElement: sendButtonOverride,
        });
    };

    describe('render()', () => {
        it('should clear the container when rendering', () => {
            const oldButton = createMockElement('button', 'old-button', [], 'Old Button');
            actionButtonsContainer.appendChild(oldButton);
            expect(actionButtonsContainer.children.length).toBe(1);

            const renderer = createRenderer();
            const newActions = [
                createValidTestAction('test:look', 'Look Around', 'look', 'Look at your surroundings.'),
                createValidTestAction('test:go_n', 'Go North', 'go north', 'Move towards the north.')
            ];
            actionButtonsContainer.appendChild.mockClear();

            renderer.render(newActions);

            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
            const finalButtons = actionButtonsContainer.querySelectorAll('button.action-button');
            expect(finalButtons.length).toBe(2); // This will fail if querySelectorAll is not mocked or JSDOM doesn't update live
            // However, the primary check is removeChild and appendChild calls.
            // For robustness, it's better to check actionButtonsContainer.children.length after appendChild mocks.

            let containerText = '';
            // Assuming appendChild mock doesn't actually add to JSDOM, let's check what was intended to be added
            // If appendChild is a real JSDOM method (not spiedOn to prevent behavior), then this is fine.
            // Given jest.spyOn(actionButtonsContainer, 'appendChild'); it means the real method is called.
            actionButtonsContainer.childNodes.forEach(node => {
                if (node.tagName === 'BUTTON') containerText += node.textContent;
            });
            expect(containerText).not.toContain('Old Button');
            expect(containerText).toContain('look');
            expect(containerText).toContain('go north');

            expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(2);
        });

        it('should render nothing and log debug if actions list is empty', () => {
            const oldButton = createMockElement('button', 'old-button-empty-test', [], 'Old Button');
            actionButtonsContainer.appendChild(oldButton);
            actionButtonsContainer.appendChild.mockClear();
            const renderer = createRenderer();
            mockLogger.debug.mockClear();
            mockLogger.info.mockClear();

            renderer.render([]);

            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
            expect(actionButtonsContainer.children.length).toBe(0);
            expect(mockDomElementFactoryInstance.button).not.toHaveBeenCalled();

            // Check for the specific debug logs in the expected order and content
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `${CLASS_PREFIX} No actions to render, currentActorId cleared.`
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `${CLASS_PREFIX} render() called. Total actions received: 0. Selected action reset. Current actor for actions: None`
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `${CLASS_PREFIX} Action buttons container cleared, selected action reset, confirm button disabled.`
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `${CLASS_PREFIX} No actions provided to render, container remains empty. Confirm button remains disabled.`
            );
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringMatching(/Rendered \d+ action buttons/));
            expect(actionButtonsContainer.appendChild).not.toHaveBeenCalled();
        });

        it('should render buttons for each valid action object', () => {
            const actions = [
                createValidTestAction('test:look', 'Look Closely', 'look', 'Examine your surroundings.'),
                createValidTestAction('test:go_n', 'Move North', 'go north', 'Proceed to the north.'),
                createValidTestAction('test:talk', 'Talk to NPC', 'talk to npc', 'Initiate conversation.')
            ];
            const renderer = createRenderer();
            mockLogger.info.mockClear();
            actionButtonsContainer.appendChild.mockClear();
            mockDomElementFactoryInstance.button.mockClear();

            renderer.render(actions);

            expect(mockDomElementFactoryInstance.button).toHaveBeenCalledTimes(actions.length);
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(actions.length);
            expect(actionButtonsContainer.children.length).toBe(actions.length);

            actions.forEach((actionObject, index) => {
                expect(mockDomElementFactoryInstance.button).toHaveBeenCalledWith(actionObject.command.trim(), 'action-button');
                const renderedButton = actionButtonsContainer.children[index];
                expect(renderedButton).not.toBeNull();
                expect(renderedButton.tagName).toBe('BUTTON');
                expect(renderedButton.textContent).toBe(actionObject.command);
                expect(renderedButton.classList.contains('action-button')).toBe(true);

                const expectedTooltip = `${actionObject.name}\n\nDescription:\n${actionObject.description}`;
                expect(renderedButton.getAttribute('title')).toBe(expectedTooltip);
                expect(renderedButton.getAttribute('data-action-id')).toBe(actionObject.id);

                const mockButtonFromFactory = mockDomElementFactoryInstance.button.mock.results[index].value;
                expect(mockButtonFromFactory.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            });
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Rendered ${actions.length} action buttons. Selected action: none.`));
        });

        it('should skip invalid actions (e.g., missing name/command/description) and log warning', () => {
            const validAction1 = createValidTestAction('test:valid1', 'Valid One', 'do one', 'Description one.');
            const invalidActionNoName = {id: 'test:no_name', command: 'cmd_no_name', description: 'Desc no name'};
            const invalidActionNoCmd = {id: 'test:no_cmd', name: 'Name No Cmd', description: 'Desc no cmd'};
            const invalidActionNoDesc = {
                id: 'test:no_desc',
                name: 'Name No Desc',
                command: 'cmd_no_desc',
                description: ""
            }; // Ensure description is string for .trim()
            const actionEmptyCmd = createValidTestAction('test:empty_cmd', 'Empty Command Test', ' ', 'Valid desc for empty cmd');
            const actionEmptyName = createValidTestAction('test:empty_name', ' ', 'empty_name_cmd', 'Description for empty name');
            const actionEmptyDesc = createValidTestAction('test:empty_desc', 'Empty Desc Test', 'empty_desc_cmd', ' ');

            const actions = [
                validAction1,
                invalidActionNoName,
                invalidActionNoCmd,
                invalidActionNoDesc,
                actionEmptyCmd,
                actionEmptyName,
                actionEmptyDesc,
                null,
            ];

            const expectedRenderedActions = [validAction1];
            const expectedWarningsFromRenderLoop = 7; // null is not caught by these specific warnings, it's pre-filtered.

            const renderer = createRenderer();
            mockLogger.warn.mockClear();
            mockDomElementFactoryInstance.button.mockClear();
            actionButtonsContainer.appendChild.mockClear();

            renderer.render(actions);

            expect(mockDomElementFactoryInstance.button).toHaveBeenCalledTimes(expectedRenderedActions.length);
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(expectedRenderedActions.length);
            expect(actionButtonsContainer.children.length).toBe(expectedRenderedActions.length);
            expect(mockLogger.warn).toHaveBeenCalledTimes(expectedWarningsFromRenderLoop);

            expect(mockLogger.warn).toHaveBeenCalledWith(`${CLASS_PREFIX} Skipping invalid action object during render (missing or empty name for tooltip): `, {actionObject: invalidActionNoName});
            expect(mockLogger.warn).toHaveBeenCalledWith(`${CLASS_PREFIX} Skipping invalid action object during render (missing or empty command): `, {actionObject: invalidActionNoCmd});
            expect(mockLogger.warn).toHaveBeenCalledWith(`${CLASS_PREFIX} Skipping invalid action object during render (missing or empty description): `, {actionObject: invalidActionNoDesc});
            expect(mockLogger.warn).toHaveBeenCalledWith(`${CLASS_PREFIX} Skipping invalid action object during render (missing or empty command): `, {actionObject: actionEmptyCmd});
            expect(mockLogger.warn).toHaveBeenCalledWith(`${CLASS_PREFIX} Skipping invalid action object during render (missing or empty name for tooltip): `, {actionObject: actionEmptyName});
            expect(mockLogger.warn).toHaveBeenCalledWith(`${CLASS_PREFIX} Skipping invalid action object during render (missing or empty description): `, {actionObject: actionEmptyDesc});
        });


        it('should treat non-array actions argument as empty list, not log error, and clear container', () => {
            const oldButton = createMockElement('button', '', [], 'Old Button');
            actionButtonsContainer.appendChild(oldButton);
            actionButtonsContainer.appendChild.mockClear();
            const renderer = createRenderer();
            const testCases = ['not an array', null, undefined, {actions: []}];
            testCases.forEach(inputCase => {
                mockLogger.error.mockClear();
                mockLogger.debug.mockClear();
                actionButtonsContainer.removeChild.mockClear();
                mockDomElementFactoryInstance.button.mockClear();

                if (!actionButtonsContainer.contains(oldButton)) {
                    actionButtonsContainer.appendChild(oldButton);
                    actionButtonsContainer.appendChild.mockClear();
                }

                renderer.render(inputCase);
                expect(mockLogger.error).not.toHaveBeenCalled();
                if (actionButtonsContainer.contains(oldButton)) {
                    expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
                }
                expect(actionButtonsContainer.children.length).toBe(0);
                // This specific log includes "Current actor for actions: None" when actions are empty
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`${CLASS_PREFIX} render() called. Total actions received: 0. Selected action reset. Current actor for actions: None`)
                );
                expect(mockDomElementFactoryInstance.button).not.toHaveBeenCalled();
            });
        });

        it('should log error and skip if factory fails to create a button', () => {
            const actions = [
                createValidTestAction('test:look', 'Look', 'look', 'Look desc.'),
                createValidTestAction('test:fail', 'Fail Button', 'fail_command', 'Fail desc.'),
                createValidTestAction('test:go_n', 'Go North', 'go north', 'Go north desc.')
            ];
            const expectedFinalButtonCount = 2;

            mockDomElementFactoryInstance.button.mockReset(); // Reset to clear previous implementations or calls
            mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
                if (text === 'fail_command') return null;
                const classes = cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter(c => c)) : [];
                const btn = createMockElement('button', '', classes, text);
                // Ensure tagName is correctly reported for mock elements if not native JSDOM
                if (btn.tagName !== 'BUTTON') {
                    Object.defineProperty(btn, 'tagName', {value: 'BUTTON', configurable: true});
                }
                return btn;
            });

            const renderer = createRenderer();
            mockLogger.error.mockClear();
            mockLogger.info.mockClear();
            actionButtonsContainer.appendChild.mockClear();

            renderer.render(actions);

            expect(mockDomElementFactoryInstance.button).toHaveBeenCalledTimes(actions.length);
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(expectedFinalButtonCount);
            expect(actionButtonsContainer.children.length).toBe(expectedFinalButtonCount);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Failed to create button element for action: "fail_command" (ID: test:fail)`));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Rendered ${expectedFinalButtonCount} action buttons. Selected action: none.`));
        });
    });
});