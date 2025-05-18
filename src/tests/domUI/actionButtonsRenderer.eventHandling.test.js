// src/tests/domUI/actionButtonsRenderer.eventHandling.test.js
import {ActionButtonsRenderer} from '../../domUI/index.js'; // Adjust path if needed
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

// --- Mock Dependencies ---
const mockLogger = {
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
};
// mockDocumentContext.query by default returns undefined for any selector
const mockDocumentContext = {query: jest.fn(), create: jest.fn(),};
let capturedEventHandler = null;

const mockUnsubscribeFn = jest.fn();

const mockValidatedEventDispatcher = {
    subscribe: jest.fn((eventType, handler) => {
        if (eventType === 'textUI:update_available_actions') capturedEventHandler = handler;
        return mockUnsubscribeFn;
    }),
    dispatchValidated: jest.fn().mockResolvedValue(true),
    listenerCount: jest.fn(),
    unsubscribe: jest.fn(),
};

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
        if (selector.startsWith('button[data-action-id="') && selector.endsWith('"]')) {
            const id = selector.substring('button[data-action-id="'.length, selector.length - '"]'.length);
            return mockContainer.children.find(btn => btn._actionId === id);
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
    mockUnsubscribeFn.mockClear();
    mockValidatedEventDispatcher.subscribe.mockClear();
    mockValidatedEventDispatcher.dispatchValidated.mockClear();
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
        containerOverride = mockContainer, factoryOverride = mockDomElementFactory, sendButtonOverride = mockSendButton
    ) => new ActionButtonsRenderer({
        logger: mockLogger, documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher, domElementFactory: factoryOverride,
        actionButtonsContainer: containerOverride, sendButtonElement: sendButtonOverride,
    });

    it('should throw error if logger is missing or invalid', () => {
        expect(() => new ActionButtonsRenderer({logger: null, /* other mocks */})).toThrow(/Logger dependency is missing or invalid/);
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
        // Also expect the speech input warning from constructor as mockDocumentContext.query returns undefined
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining("Speech input element ('#command-input') not found or unusable"),
            {queriedElement: undefined}
        );
    });

    describe('Event Handling (#handleUpdateActions)', () => {
        const eventType = 'textUI:update_available_actions';
        const warningBaseForInvalidStructure = `${CLASS_PREFIX} Received invalid or incomplete event object structure for '${eventType}'. Expected { type: '...', payload: { actions: [...] } }. Clearing action buttons.`;
        let instance;
        let renderSpy;

        beforeEach(() => {
            // mockLogger.warn is cleared by the main beforeEach.
            // createInstance will call the constructor, which logs the speech input warning.
            instance = createInstance();
            renderSpy = jest.spyOn(instance, 'render').mockImplementation(() => {
            });
            if (!capturedEventHandler && mockValidatedEventDispatcher.subscribe.mock.calls.length > 0) {
                const lastCallArgs = mockValidatedEventDispatcher.subscribe.mock.calls[mockValidatedEventDispatcher.subscribe.mock.calls.length - 1];
                if (lastCallArgs[0] === 'textUI:update_available_actions' && typeof lastCallArgs[1] === 'function') capturedEventHandler = lastCallArgs[1];
            }
            if (!capturedEventHandler) throw new Error("Test setup error: event handler not captured for #handleUpdateActions tests.");
        });

        it('should call render with valid actions when receiving a valid event object', () => {
            const validActions = [{id: 'core:wait', command: 'wait'}];
            const validEventObject = {type: eventType, payload: {actions: validActions}};

            // Clear warnings specifically for this test if constructor warning is already handled or not relevant to this test's core logic
            // However, for this fix, we'll assert based on existing calls.
            // mockLogger.warn.mockClear(); // Option: clear before action if only testing action's effect

            capturedEventHandler(validEventObject);
            expect(renderSpy).toHaveBeenCalledTimes(1);
            expect(renderSpy).toHaveBeenCalledWith(validActions);

            // MODIFIED: Expect only the constructor warning about speech input
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Speech input element ('#command-input') not found or unusable"),
                {queriedElement: undefined}
            );
        });

        it('should filter invalid actions from the nested array and call render with valid ones', () => {
            const mixedActions = [
                {id: 'core:go', command: 'go north'}, null, {id: 'core:look', command: ' look '},
                {id: '', command: 'invalid_id'}, {id: 'core:take', command: '   '},
                {id: 'core:inv', command: 'inventory'}
            ];
            const mixedEventObject = {type: eventType, payload: {actions: mixedActions}};
            const expectedValidActions = mixedActions.filter(a => a && typeof a === 'object' && typeof a.id === 'string' && a.id.length > 0 && typeof a.command === 'string' && a.command.trim().length > 0);
            capturedEventHandler(mixedEventObject);
            expect(renderSpy).toHaveBeenCalledWith(expectedValidActions);

            // Expect 2 warnings: 1 from constructor (speech input), 1 from this event handling logic
            expect(mockLogger.warn).toHaveBeenCalledTimes(2);
            const expectedWarningString = `${CLASS_PREFIX} Received '${eventType}' with some invalid items in the nested actions array. Only valid action objects will be rendered.`;
            expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningString, {originalEvent: mixedEventObject});
            // And ensure the constructor warning is also there
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Speech input element ('#command-input') not found or unusable"),
                {queriedElement: undefined}
            );
        });

        it('should call render with empty array for event object missing inner "payload"', () => {
            const invalidEventObject = {type: eventType};
            capturedEventHandler(invalidEventObject);
            expect(renderSpy).toHaveBeenCalledWith([]);

            // Expect 2 warnings: 1 from constructor (speech input), 1 from this event handling logic
            expect(mockLogger.warn).toHaveBeenCalledTimes(2);
            expect(mockLogger.warn).toHaveBeenCalledWith(warningBaseForInvalidStructure, {receivedObject: invalidEventObject});
            // And ensure the constructor warning is also there
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Speech input element ('#command-input') not found or unusable"),
                {queriedElement: undefined}
            );
        });
    });

    describe('Rendering Logic (render)', () => {
        let instance;
        beforeEach(() => {
            instance = createInstance();
        });

        it('should clear the container before rendering', () => {
            const d = createButtonLikeMock('dummy');
            mockContainer.appendChild(d);
            mockContainer.appendChild.mockClear();
            instance.render([{id: 'core:wait', command: 'wait'}]);
            expect(mockContainer.removeChild).toHaveBeenCalledWith(d);
            expect(mockContainer.appendChild).toHaveBeenCalledTimes(1);
        });
        it('should create and append buttons for each valid action', () => {
            const actions = [{id: 'core:wait', command: 'wait'}, {id: 'core:look', command: 'look around'}];
            instance.render(actions);
            expect(mockDomElementFactory.button).toHaveBeenCalledTimes(2);
            expect(mockContainer.appendChild).toHaveBeenCalledTimes(2);
            const btn1 = mockContainer.children[0];
            expect(btn1.textContent).toBe('wait');
            expect(btn1.setAttribute).toHaveBeenCalledWith('title', 'Select action: wait');
            expect(btn1.setAttribute).toHaveBeenCalledWith('data-action-id', 'core:wait');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Rendered 2 action buttons. Selected action: none.`));
        });
        it('should clear the container and render nothing if actions array is empty', () => {
            const d = createButtonLikeMock('dummy');
            mockContainer.appendChild(d);
            mockContainer.appendChild.mockClear();
            instance.render([]);
            expect(mockContainer.removeChild).toHaveBeenCalledWith(d);
            expect(mockContainer.appendChild).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} No actions provided to render`));
        });
        it('should treat non-array actions argument as empty list, not log error', () => {
            const d = createButtonLikeMock('dummy');
            mockContainer.appendChild(d);
            mockContainer.appendChild.mockClear();
            instance.render("not an array");
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockContainer.removeChild).toHaveBeenCalledWith(d);
            expect(mockContainer.children.length).toBe(0);
            expect(mockDomElementFactory.button).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} No actions provided to render`));
        });

        it('should skip rendering invalid action objects within the array and log warning', () => {
            const actions = [{id: 'core:valid', command: 'do valid'}, null, {id: 'core:final', command: 'last one'}];
            const expectedValidCount = 2;
            const expectedRenderWarningCount = 1; // Warnings from render itself for invalid items

            instance.render(actions);

            expect(mockDomElementFactory.button).toHaveBeenCalledTimes(expectedValidCount);

            // MODIFIED: Expect total warnings = constructor warning + render warnings
            expect(mockLogger.warn).toHaveBeenCalledTimes(expectedRenderWarningCount + 1);

            // Check for the render warning
            const expectedRenderWarningString = `${CLASS_PREFIX} Skipping invalid action object during render: `;
            expect(mockLogger.warn).toHaveBeenCalledWith(expectedRenderWarningString, {actionObject: null});

            // Check for the constructor warning (speech input)
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Speech input element ('#command-input') not found or unusable"),
                {queriedElement: undefined}
            );

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Rendered ${expectedValidCount} action buttons. Selected action: none.`));
        });
    });

    describe('Button Click Behavior', () => {
        let instance;
        beforeEach(() => {
            instance = createInstance();
        });
        it('should select action, enable send button, and log selection on action button click', async () => {
            const action = {id: 'test:examine', command: 'examine'};
            instance.render([action]);
            const btn = mockContainer.children[0];
            await btn._simulateClick();
            expect(instance.selectedAction).toEqual(action);
            expect(mockSendButton.disabled).toBe(false);
            expect(btn.classList.add).toHaveBeenCalledWith('selected');
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${action.command}'`));
        });
        it('should select action with trimmed command, not dispatch', async () => {
            const action = {id: 'core:spaced', command: '  spaced command  '};
            instance.render([action]);
            const btn = mockContainer.children[0];
            expect(btn.textContent).toBe('spaced command');
            await btn._simulateClick();
            expect(instance.selectedAction).toEqual(action);
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${action.command}'`));
        });
        it('should still select action if button textContent is empty (selection uses actionId)', async () => {
            const action = {id: 'core:empty', command: 'ValidCmd'};
            instance.render([action]);
            const btn = mockContainer.children[0];
            btn.textContent = ' ';
            await btn._simulateClick();
            expect(instance.selectedAction).toEqual(action);
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            // Check that the *only* warning is the constructor one (if any)
            // For this specific test, we only care that the button click itself doesn't add new warnings
            const constructorWarnCount = mockLogger.warn.mock.calls.filter(call => call[0].includes("Speech input element")).length;
            expect(mockLogger.warn).toHaveBeenCalledTimes(constructorWarnCount); // No NEW warnings
        });
        it('should NOT dispatch or log dispatch warnings if VED would return false (action button click)', async () => {
            mockValidatedEventDispatcher.dispatchValidated.mockResolvedValueOnce(false);
            const action = {id: 'core:fail', command: 'fail dispatch'};
            instance.render([action]);
            await mockContainer.children[0]._simulateClick();
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            const constructorWarnCount = mockLogger.warn.mock.calls.filter(call => call[0].includes("Speech input element")).length;
            expect(mockLogger.warn).toHaveBeenCalledTimes(constructorWarnCount); // No NEW warnings
        });
        it('should NOT dispatch or log dispatch errors if VED would throw (action button click)', async () => {
            mockValidatedEventDispatcher.dispatchValidated.mockRejectedValueOnce(new Error("Dispatch Failed!"));
            const action = {id: 'core:throw', command: 'throw error'};
            instance.render([action]);
            await mockContainer.children[0]._simulateClick();
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled(); // Assuming constructor doesn't log errors
        });
    });

    describe('Dispose Method', () => {
        beforeEach(() => {
            mockUnsubscribeFn.mockClear();
            mockValidatedEventDispatcher.subscribe.mockClear();
        });
        it('should unsubscribe from VED event', () => {
            const freshInstance = createInstance();
            expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(1);
            freshInstance.dispose();
            expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Disposing subscriptions.`));
        });
    });
});