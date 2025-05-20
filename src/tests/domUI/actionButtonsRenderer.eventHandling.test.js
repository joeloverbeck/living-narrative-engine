// src/tests/domUI/actionButtonsRenderer.eventHandling.test.js
import {ActionButtonsRenderer} from '../../domUI/index.js'; // Adjust path if needed
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

// --- Mock Dependencies ---
const mockLogger = {
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
};
const mockDocumentContext = {query: jest.fn(), create: jest.fn(),};
let capturedEventHandler = null; // To capture the handler passed to VED.subscribe

const mockUnsubscribeFn = jest.fn();

const mockValidatedEventDispatcher = {
    subscribe: jest.fn((eventType, handler) => {
        if (eventType === 'textUI:update_available_actions') capturedEventHandler = handler;
        return mockUnsubscribeFn;
    }),
    dispatchValidated: jest.fn().mockResolvedValue(true), // Default to success
    listenerCount: jest.fn(),
    unsubscribe: jest.fn(),
};

// Helper to create test action objects that are valid by default
const createValidTestAction = (id, name, command, description) => ({
    id: id,
    name: name || `Test Name for ${id}`, // Default non-empty name
    command: command || `test_command_for_${id}`, // Default non-empty command
    description: description || `Test description for ${id}.`, // Default non-empty description
});


// --- Centralized Mock Creation for Button-like Objects ---
function createButtonLikeMock(initialText = '') {
    const mock = {
        textContent: initialText,
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        addEventListener: jest.fn(),
        classList: {
            _classes: new Set(),
            add: jest.fn(function (cls) {
                this._classes.add(cls);
            }),
            remove: jest.fn(function (cls) {
                this._classes.delete(cls);
            }),
            contains: jest.fn(function (cls) {
                return this._classes.has(cls);
            }),
            _reset: function () {
                this._classes.clear();
                this.add.mockClear();
                this.remove.mockClear();
                this.contains.mockClear();
            }
        },
        _clickHandlers: [], _actionId: '', _disabled: false,
        get disabled() {
            return this._disabled;
        },
        set disabled(value) {
            this._disabled = !!value;
        },
        tagName: 'BUTTON',
        _simulateClick: async function () {
            for (const handler of this._clickHandlers) {
                await handler();
            }
        },
        _reset: function () {
            this.setAttribute.mockClear();
            this.getAttribute.mockClear();
            this.addEventListener.mockClear();
            this.classList._reset();
            this._clickHandlers = [];
            this.textContent = initialText;
            this._actionId = '';
            this._disabled = false;
            Object.keys(this).filter(key => key.startsWith('_attr_')).forEach(key => delete this[key]);
        }
    };
    mock.getAttribute.mockImplementation(attr => (attr === 'data-action-id' ? mock._actionId : mock[`_attr_${attr}`]));
    mock.setAttribute.mockImplementation((attr, value) => {
        if (attr === 'data-action-id') mock._actionId = value;
        mock[`_attr_${attr}`] = value;
    });
    mock.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') mock._clickHandlers.push(handler);
    });
    return mock;
}


const mockDomElementFactory = {
    create: jest.fn(),
    button: jest.fn((text, className) => {
        const newButton = createButtonLikeMock(text);
        if (className) className.split(' ').forEach(cls => newButton.classList.add(cls));
        return newButton;
    })
};

const mockContainer = {
    nodeType: 1, children: [], firstChild: null,
    appendChild: jest.fn(child => {
        mockContainer.children.push(child);
        mockContainer.firstChild = mockContainer.children[0];
    }),
    removeChild: jest.fn(child => {
        mockContainer.children = mockContainer.children.filter(c => c !== child);
        mockContainer.firstChild = mockContainer.children.length > 0 ? mockContainer.children[0] : null;
    }),
    querySelector: jest.fn(selector => {
        if (selector.startsWith('button.action-button.selected[data-action-id="')) {
            const idMatch = selector.match(/data-action-id="([^"]+)"/);
            if (idMatch && idMatch[1]) {
                const actionId = idMatch[1];
                return mockContainer.children.find(btn => btn._actionId === actionId && btn.classList.contains('selected'));
            }
        }
        return null;
    }),
    _reset: function () {
        this.children = [];
        this.firstChild = null;
        this.appendChild.mockClear();
        this.removeChild.mockClear();
        this.querySelector.mockClear();
    }
};

const mockSendButton = createButtonLikeMock();
mockSendButton.disabled = true;
const originalSendButtonReset = mockSendButton._reset;
mockSendButton._reset = function () {
    originalSendButtonReset.call(this);
    this.disabled = true;
};


beforeEach(() => {
    jest.clearAllMocks();
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockDocumentContext.query.mockClear();
    mockDocumentContext.create.mockClear();
    mockDocumentContext.query.mockReturnValue(undefined);
    mockUnsubscribeFn.mockClear();
    mockValidatedEventDispatcher.subscribe.mockClear();
    mockValidatedEventDispatcher.dispatchValidated.mockClear().mockResolvedValue(true);
    mockValidatedEventDispatcher.listenerCount.mockClear();
    mockValidatedEventDispatcher.unsubscribe.mockClear();
    mockContainer._reset();
    mockSendButton._reset();
    capturedEventHandler = null;
    mockDomElementFactory.button.mockClear();
    mockDomElementFactory.create.mockClear();
});

describe('ActionButtonsRenderer', () => {
    const CLASS_PREFIX = '[ActionButtonsRenderer]';
    const createInstance = (
        containerOverride = mockContainer, factoryOverride = mockDomElementFactory, sendButtonOverride = mockSendButton, docContextOverride = {} // Changed default to empty object
    ) => {
        const finalDocContext = {
            query: jest.fn(selector => { // Default query mock
                if (selector === '#player-confirm-turn-button' && sendButtonOverride === null) return null;
                if (selector === '#speech-input') return undefined;
                return undefined; // Default to undefined for other queries
            }),
            create: jest.fn(tagName => { // Default create mock
                // A very basic mock element if needed by constructor/other parts not directly tested for element creation
                const mockEl = createButtonLikeMock();
                mockEl.tagName = tagName.toUpperCase();
                return mockEl;
            }),
            ...mockDocumentContext, // Spread base mockDocumentContext if it has other methods
            ...docContextOverride // Apply specific overrides for a test
        };

        return new ActionButtonsRenderer({
            logger: mockLogger,
            documentContext: finalDocContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: factoryOverride,
            actionButtonsContainer: containerOverride,
            sendButtonElement: sendButtonOverride,
        });
    };


    it('should throw error if logger is missing or invalid', () => {
        expect(() => new ActionButtonsRenderer({
            logger: null,
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: mockDomElementFactory,
            actionButtonsContainer: mockContainer,
            sendButtonElement: mockSendButton
        }))
            .toThrow(/Logger dependency is missing or invalid/);
    });
    it('should throw error if actionButtonsContainer is missing or not an element', () => {
        const err = `${CLASS_PREFIX} 'actionButtonsContainer' dependency is missing or not a valid DOM element.`;
        expect(() => createInstance(null)).toThrow(err);
        expect(() => createInstance({nodeType: 3})).toThrow(err);
        expect(() => createInstance({})).toThrow(err);
    });
    it('should throw error if domElementFactory is missing or invalid', () => {
        const err = `${CLASS_PREFIX} 'domElementFactory' dependency is missing or invalid (must have create and button methods).`;
        expect(() => createInstance(mockContainer, null)).toThrow(err);
        expect(() => createInstance(mockContainer, {button: jest.fn()})).toThrow(err);
    });
    it('should subscribe to "textUI:update_available_actions" on construction', () => {
        createInstance();
        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(1);
        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith('textUI:update_available_actions', expect.any(Function));
        expect(capturedEventHandler).toBeInstanceOf(Function);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Subscribed to VED event 'textUI:update_available_actions'."));
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining("Speech input element ('#speech-input') not found or unusable"),
            {queriedElement: undefined}
        );
    });

    describe('Event Handling (#handleUpdateActions)', () => {
        const eventType = 'textUI:update_available_actions';
        const warningBaseForInvalidStructure = `${CLASS_PREFIX} Received invalid or incomplete event object structure for '${eventType}'. Expected { type: '...', payload: { actions: [...] } }. Clearing action buttons.`;
        let instance;
        let renderSpy;

        beforeEach(() => {
            instance = createInstance();
            renderSpy = jest.spyOn(instance, 'render').mockImplementation(() => {
            });
            if (!capturedEventHandler) { // Ensure handler is captured
                const callArgs = mockValidatedEventDispatcher.subscribe.mock.calls.find(call => call[0] === 'textUI:update_available_actions');
                if (callArgs && typeof callArgs[1] === 'function') capturedEventHandler = callArgs[1];
                else throw new Error("Test setup error: event handler not captured for #handleUpdateActions tests.");
            }
            mockLogger.warn.mockClear();
        });

        it('should call render with valid actions when receiving a valid event object', () => {
            const validActions = [createValidTestAction('core:wait', 'Wait', 'wait', 'Passes the turn.')];
            const validEventObject = {type: eventType, payload: {actions: validActions}};
            capturedEventHandler(validEventObject);
            expect(renderSpy).toHaveBeenCalledTimes(1);
            expect(renderSpy).toHaveBeenCalledWith(validActions);
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should filter invalid actions from the nested array and call render with valid ones', () => {
            const validAction1 = createValidTestAction('core:go', 'Go North', 'go north', 'Move north.');
            const validAction2 = createValidTestAction('core:inv', 'Inventory', 'inventory', 'Open inventory.');
            // Create actions that will be invalid based on the renderer's filter
            const actionMissingDesc = {id: 'core:look', name: 'Look', command: 'look'}; // No description
            const actionEmptyName = {
                id: 'core:empty_name',
                name: ' ',
                command: 'empty name cmd',
                description: 'Valid desc.'
            }; // Empty name
            const actionEmptyCmd = createValidTestAction('core:empty_cmd', 'Empty Cmd Name', ' ', 'Valid desc for empty cmd'); // Empty command
            const actionMissingId = {name: 'No ID', command: 'no_id_cmd', description: 'Desc for no ID'}; // Missing ID

            const mixedActions = [
                validAction1,
                null,
                actionMissingDesc,
                validAction2,
                actionEmptyName,
                actionMissingId,
                actionEmptyCmd
            ];
            const mixedEventObject = {type: eventType, payload: {actions: mixedActions}};
            // Define expectedValidActions based on the renderer's actual filter logic
            const expectedValidActions = [validAction1, validAction2];

            capturedEventHandler(mixedEventObject);
            expect(renderSpy).toHaveBeenCalledWith(expectedValidActions);

            const expectedWarningString = `${CLASS_PREFIX} Received '${eventType}' with some invalid items in the nested actions array. Only valid action objects will be rendered.`;
            expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningString, {originalEvent: mixedEventObject});

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid action object found in payload"), {action: null});
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid action object found in payload"), {action: actionMissingDesc});
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid action object found in payload"), {action: actionEmptyName});
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid action object found in payload"), {action: actionMissingId});
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid action object found in payload"), {action: actionEmptyCmd});
        });

        it('should call render with empty array for event object missing inner "payload"', () => {
            const invalidEventObject = {type: eventType};
            capturedEventHandler(invalidEventObject);
            expect(renderSpy).toHaveBeenCalledWith([]);
            expect(mockLogger.warn).toHaveBeenCalledWith(warningBaseForInvalidStructure, {receivedObject: invalidEventObject});
        });
    });

    describe('Rendering Logic (render)', () => {
        let instance;
        beforeEach(() => {
            instance = createInstance();
            mockLogger.warn.mockClear(); // Clear constructor warnings for render-specific tests
        });

        it('should clear the container before rendering', () => {
            const d = createButtonLikeMock('dummy');
            mockContainer.appendChild(d);
            mockContainer.appendChild.mockClear();
            mockContainer.removeChild.mockClear();
            const action = createValidTestAction('core:wait', 'Wait', 'wait', 'Desc1');
            instance.render([action]);
            expect(mockContainer.removeChild).toHaveBeenCalledWith(d);
            expect(mockContainer.appendChild).toHaveBeenCalledTimes(1);
        });

        it('should create and append buttons for each valid action', () => {
            const actions = [
                createValidTestAction('core:wait', 'Wait Action', 'wait command', 'Wait description.'),
                createValidTestAction('core:look', 'Look Action', 'look command', 'Look description.')
            ];
            instance.render(actions);
            expect(mockDomElementFactory.button).toHaveBeenCalledTimes(2);
            expect(mockContainer.appendChild).toHaveBeenCalledTimes(2);

            const btn1Mock = mockContainer.children[0];
            expect(btn1Mock.textContent).toBe('wait command');
            expect(btn1Mock.setAttribute).toHaveBeenCalledWith('title', 'Wait Action\n\nDescription:\nWait description.');
            expect(btn1Mock.setAttribute).toHaveBeenCalledWith('data-action-id', 'core:wait');

            const btn2Mock = mockContainer.children[1];
            expect(btn2Mock.textContent).toBe('look command');
            expect(btn2Mock.setAttribute).toHaveBeenCalledWith('title', 'Look Action\n\nDescription:\nLook description.');
            expect(btn2Mock.setAttribute).toHaveBeenCalledWith('data-action-id', 'core:look');

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Rendered 2 action buttons. Selected action: none.`));
        });

        it('should clear the container and render nothing if actions array is empty', () => {
            const d = createButtonLikeMock('dummy');
            mockContainer.appendChild(d);
            mockContainer.appendChild.mockClear();
            mockContainer.removeChild.mockClear();
            instance.render([]);
            expect(mockContainer.removeChild).toHaveBeenCalledWith(d);
            expect(mockContainer.appendChild).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} No actions provided to render`));
        });

        it('should treat non-array actions argument as empty list, not log error', () => {
            const d = createButtonLikeMock('dummy');
            mockContainer.appendChild(d);
            mockContainer.appendChild.mockClear();
            mockContainer.removeChild.mockClear();
            instance.render("not an array");
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockContainer.removeChild).toHaveBeenCalledWith(d);
            expect(mockContainer.children.length).toBe(0);
            expect(mockDomElementFactory.button).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} No actions provided to render`));
        });

        it('should skip rendering invalid action objects within the array and log warning', () => {
            const validAction1 = createValidTestAction('core:valid', 'Valid Action', 'do valid', 'Valid desc.');
            const actionMissingName = {id: 'core:no_name', command: 'no_name_cmd', description: 'Desc here'}; // Missing name
            const actionEmptyCommand = createValidTestAction('core:empty_cmd', 'Empty Cmd Name', ' ', 'Valid desc for empty cmd'); // Empty command

            // Note: `null` items in the array are handled by `Array.isArray(actions) ? actions : []`
            // and then `availableActions.forEach`. If `availableActions` contains `null`,
            // the first `if (!actionObject ...)` guard in the loop will catch it.
            // The renderer's `#handleUpdateActions` filter is stricter and would remove `null` beforehand
            // if the actions came from an event. Here, `render` is called directly.
            const actions = [validAction1, actionMissingName, actionEmptyCommand];
            const expectedValidButtonCount = 1; // Only validAction1

            instance.render(actions);

            expect(mockDomElementFactory.button).toHaveBeenCalledTimes(expectedValidButtonCount);

            // Warnings from the render loop:
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${CLASS_PREFIX} Skipping invalid action object during render (missing or empty name for tooltip): `,
                {actionObject: actionMissingName}
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${CLASS_PREFIX} Skipping invalid action object during render (missing or empty command): `,
                {actionObject: actionEmptyCommand}
            );
            expect(mockLogger.warn).toHaveBeenCalledTimes(2); // Only the 2 warnings from the render loop

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Rendered ${expectedValidButtonCount} action buttons. Selected action: none.`));
        });
    });

    describe('Button Click Behavior', () => {
        let instance;
        beforeEach(() => {
            instance = createInstance();
            mockLogger.warn.mockClear(); // Clear constructor warnings
        });

        it('should select action, enable send button, and log selection on action button click', async () => {
            const action = createValidTestAction('test:examine', 'Examine', 'examine item', 'Examine description.');
            instance.render([action]);
            const btn = mockContainer.children[0];
            expect(btn).toBeDefined();
            await btn._simulateClick();
            expect(instance.selectedAction).toEqual(action);
            expect(mockSendButton.disabled).toBe(false);
            expect(btn.classList.add).toHaveBeenCalledWith('selected');
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${action.name}'`));
        });

        it('should select action with trimmed command, not dispatch', async () => {
            const action = createValidTestAction('core:spaced', 'Spaced Name', '  spaced command  ', 'Spaced desc.');
            instance.render([action]);
            const btn = mockContainer.children[0];
            expect(btn).toBeDefined();
            expect(btn.textContent).toBe('spaced command');
            await btn._simulateClick();
            expect(instance.selectedAction).toEqual(action);
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${action.name}'`));
        });

        it('should still select action if button textContent is empty (selection uses actionId)', async () => {
            const action = createValidTestAction('core:empty', 'EmptyCmdName', 'ValidButtonText', 'Valid desc.');
            instance.render([action]);
            const btn = mockContainer.children[0];
            expect(btn).toBeDefined();
            btn.textContent = ' '; // Simulate external modification
            await btn._simulateClick();
            expect(instance.selectedAction).toEqual(action);
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should NOT dispatch or log dispatch warnings if VED would return false (action button click)', async () => {
            mockValidatedEventDispatcher.dispatchValidated.mockResolvedValueOnce(false);
            const action = createValidTestAction('core:fail', 'Fail Act', 'fail dispatch', 'Fail desc.');
            instance.render([action]);
            const btn = mockContainer.children[0];
            expect(btn).toBeDefined();
            await btn._simulateClick(); // Selects the action
            expect(instance.selectedAction).toEqual(action);
            // Note: Action button click itself DOES NOT dispatch. This test might be misinterpreting.
            // It tests the selection part. The dispatch part is for mockSendButton.
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should NOT dispatch or log dispatch errors if VED would throw (action button click)', async () => {
            mockValidatedEventDispatcher.dispatchValidated.mockRejectedValueOnce(new Error("Dispatch Failed!"));
            const action = createValidTestAction('core:throw', 'Throw Act', 'throw error', 'Throw desc.');
            instance.render([action]);
            const btn = mockContainer.children[0];
            expect(btn).toBeDefined();
            await btn._simulateClick(); // Selects
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });

    describe('Dispose Method', () => {
        beforeEach(() => {
            mockUnsubscribeFn.mockClear();
        });
        it('should unsubscribe from VED event', () => {
            const freshInstance = createInstance(); // This calls subscribe
            expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(1);
            freshInstance.dispose();
            expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Disposing subscriptions.`));
        });
    });
});