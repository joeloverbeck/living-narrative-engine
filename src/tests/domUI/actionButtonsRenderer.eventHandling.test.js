// src/tests/domUI/actionButtonsRenderer.eventHandling.test.js
import {ActionButtonsRenderer} from '../../domUI/index.js'; // Adjust path if needed
// DomElementFactory is not directly used if we mock its .button method, but keep import if other tests need it.
// import DomElementFactory from '../../domUI/domElementFactory';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

// --- Mock Dependencies ---
const mockLogger = {
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
};
const mockDocumentContext = {query: jest.fn(), create: jest.fn(),};
let capturedEventHandler = null;
const mockSubscription = {unsubscribe: jest.fn()};
const mockValidatedEventDispatcher = {
    subscribe: jest.fn((eventType, handler) => {
        if (eventType === 'textUI:update_available_actions') capturedEventHandler = handler;
        return mockSubscription;
    }),
    dispatchValidated: jest.fn().mockResolvedValue(true),
    listenerCount: jest.fn(), unsubscribe: jest.fn(),
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
            _reset: function () { // Renamed for clarity, called by main _resetMocks
                this._classes.clear();
                this.add.mockClear();
                this.remove.mockClear();
                this.contains.mockClear();
            }
        },
        _clickHandlers: [],
        _actionId: '', // To store data-action-id
        _disabled: false, // For sendButton state and general button state
        // Standard DOM properties
        get disabled() {
            return this._disabled;
        },
        set disabled(value) {
            this._disabled = !!value;
        },
        tagName: 'BUTTON', // Default tagName

        // Simulate click by invoking stored handlers
        _simulateClick: async function () {
            for (const handler of this._clickHandlers) {
                await handler();
            }
        },
        // Reset function for this specific mock instance
        _reset: function () {
            this.setAttribute.mockClear();
            this.getAttribute.mockClear();
            this.addEventListener.mockClear();
            this.classList._reset(); // Call classList's own reset
            this._clickHandlers = [];
            this.textContent = initialText; // Reset to initial or empty
            this._actionId = '';
            this._disabled = false;
            // Clear any dynamically stored attributes like title
            Object.keys(this)
                .filter(key => key.startsWith('_attr_'))
                .forEach(key => delete this[key]);
        }
    };

    // Default implementations for attribute methods
    mock.getAttribute.mockImplementation(attr => {
        if (attr === 'data-action-id') return mock._actionId;
        return mock[`_attr_${attr}`]; // Generic attribute storage
    });
    mock.setAttribute.mockImplementation((attr, value) => {
        if (attr === 'data-action-id') mock._actionId = value;
        mock[`_attr_${attr}`] = value; // Store any attribute
    });
    // Default implementation for addEventListener
    mock.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') {
            mock._clickHandlers.push(handler);
        }
    });

    return mock;
}

// Mock DomElementFactory to use our button mock factory
const mockDomElementFactory = {
    create: jest.fn(), // Still needed for constructor check
    button: jest.fn((text, className) => {
        const newButton = createButtonLikeMock(text);
        // If className needs to be applied, can do it here, e.g., newButton.classList.add(className)
        if (className) {
            className.split(' ').forEach(cls => newButton.classList.add(cls));
        }
        return newButton;
    })
};

// Mock Container Element (remains largely the same)
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

// Create mockSendButton using the same factory, then customize
const mockSendButton = createButtonLikeMock();
// mockSendButton.tagName is already 'BUTTON' from createButtonLikeMock
mockSendButton.disabled = true; // Initial state for send button
// If _reset needs special handling for sendButton's disabled state
const originalSendButtonReset = mockSendButton._reset;
mockSendButton._reset = function () {
    originalSendButtonReset.call(this);
    this.disabled = true; // Ensure it always resets to disabled
};


// --- Reset Mocks Before Each Test ---
beforeEach(() => {
    jest.clearAllMocks(); // Clears call counts etc. for all top-level mocks

    mockContainer._reset();
    mockSendButton._reset(); // Call the instance's own reset method
    // Individual buttons created by mockDomElementFactory.button will be fresh each time they are made.
    // If any are persisted across tests (they shouldn't be), they would need their own _reset.

    capturedEventHandler = null;

    // It's good practice to also clear the factory's main method if its call count is asserted
    mockDomElementFactory.button.mockClear();
    // Clear create as well for constructor tests
    mockDomElementFactory.create.mockClear();
});

// --- Test Suite ---
describe('ActionButtonsRenderer', () => {

    const CLASS_PREFIX = '[ActionButtonsRenderer]';

    // Helper function to create instance with standard mocks
    const createInstance = (
        containerOverride = mockContainer,
        factoryOverride = mockDomElementFactory,
        sendButtonOverride = mockSendButton
    ) => {
        return new ActionButtonsRenderer({
            logger: mockLogger,
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: factoryOverride,
            actionButtonsContainer: containerOverride,
            sendButtonElement: sendButtonOverride,
        });
    };

    // --- Constructor Tests ---
    it('should throw error if logger is missing or invalid', () => {
        expect(() => new ActionButtonsRenderer({
            logger: null, documentContext: mockDocumentContext,
            validatedEventDispatcher: mockValidatedEventDispatcher, domElementFactory: mockDomElementFactory,
            actionButtonsContainer: mockContainer, sendButtonElement: mockSendButton,
        })).toThrow(/Logger dependency is missing or invalid/);
    });

    it('should throw error if actionButtonsContainer is missing or not an element', () => {
        const expectedErrorString = `${CLASS_PREFIX} 'actionButtonsContainer' dependency is missing or not a valid DOM element.`;
        expect(() => createInstance(null)).toThrow(expectedErrorString);
        expect(() => createInstance({nodeType: 3})).toThrow(expectedErrorString); // Text node
        expect(() => createInstance({})).toThrow(expectedErrorString); // Plain object
    });

    it('should throw error if domElementFactory is missing or invalid', () => {
        const expectedErrorString = `${CLASS_PREFIX} 'domElementFactory' dependency is missing or invalid.`;
        expect(() => createInstance(mockContainer, null)).toThrow(expectedErrorString);
        // Test with factory missing 'create' method (which is checked by constructor)
        expect(() => createInstance(mockContainer, {button: jest.fn()})).toThrow(expectedErrorString);
        // The following case should NOT throw, as constructor only checks for .create
        // expect(() => createInstance(mockContainer, {create: jest.fn()})).toThrow(expectedErrorString);
    });

    it('should subscribe to "textUI:update_available_actions" on construction', () => {
        createInstance();
        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(1);
        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
            'textUI:update_available_actions', expect.any(Function)
        );
        expect(capturedEventHandler).toBeInstanceOf(Function);
    });

    // --- Event Handling (#handleUpdateActions via simulated dispatch) ---
    describe('Event Handling (#handleUpdateActions)', () => {
        const eventType = 'textUI:update_available_actions';
        const warningBase = `${CLASS_PREFIX} Received invalid or incomplete event object structure for '${eventType}'. Expected { type: '...', payload: { actions: [...] } }. Clearing action buttons. Received object:`;
        let instance;
        let renderSpy;

        beforeEach(() => {
            instance = createInstance();
            renderSpy = jest.spyOn(instance, 'render').mockImplementation(() => {
            }); // Spy on actual instance method
            if (!capturedEventHandler) throw new Error("Test setup error: event handler not captured");
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.info.mockClear();
            mockContainer._reset();
        });

        it('should call render with valid actions when receiving a valid event object', () => {
            const validActions = [{id: 'core:wait', command: 'wait'}];
            const validEventObject = {type: eventType, payload: {actions: validActions}};
            capturedEventHandler(validEventObject);
            expect(renderSpy).toHaveBeenCalledTimes(1);
            expect(renderSpy).toHaveBeenCalledWith(validActions);
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Received event object for '${eventType}'`), validEventObject);
        });

        it('should filter invalid actions from the nested array and call render with valid ones', () => {
            const mixedActions = [
                {id: 'core:go', command: 'go north'}, null, {id: 'core:look', command: ' look '},
                {id: '', command: 'invalid_id'}, {id: 'core:take', command: '   '},
                {id: 'core:inv', command: 'inventory'}
            ];
            const mixedEventObject = {type: eventType, payload: {actions: mixedActions}};
            const expectedValidActions = mixedActions.filter(action =>
                action && typeof action === 'object' && typeof action.id === 'string' && action.id.length > 0 &&
                typeof action.command === 'string' && action.command.trim().length > 0
            );
            capturedEventHandler(mixedEventObject);
            expect(renderSpy).toHaveBeenCalledWith(expectedValidActions);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`${CLASS_PREFIX} Received '${eventType}' with some invalid items`), mixedEventObject
            );
        });

        it('should call render with empty array for event object missing inner "payload"', () => {
            const invalidEventObject = {type: eventType};
            capturedEventHandler(invalidEventObject);
            expect(renderSpy).toHaveBeenCalledWith([]);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(warningBase), invalidEventObject);
        });
    });

    // --- Rendering Logic (Direct call to render) ---
    describe('Rendering Logic (render)', () => {
        let instance;
        beforeEach(() => {
            instance = createInstance();
            mockLogger.debug.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockLogger.info.mockClear();
            mockContainer._reset();
            mockDomElementFactory.button.mockClear(); // Clear factory calls
        });

        it('should clear the container before rendering', () => {
            const dummyDiv = createButtonLikeMock('dummy'); // Use factory for consistency
            mockContainer.appendChild(dummyDiv);
            mockContainer.appendChild.mockClear();
            instance.render([{id: 'core:wait', command: 'wait'}]);
            expect(mockContainer.removeChild).toHaveBeenCalledWith(dummyDiv);
            expect(mockContainer.appendChild).toHaveBeenCalledTimes(1);
        });

        it('should create and append buttons for each valid action', () => {
            const actions = [{id: 'core:wait', command: 'wait'}, {id: 'core:look', command: 'look around'}];
            instance.render(actions);
            expect(mockDomElementFactory.button).toHaveBeenCalledTimes(2);
            expect(mockContainer.appendChild).toHaveBeenCalledTimes(2);
            const firstButtonMock = mockContainer.children[0];
            expect(firstButtonMock.textContent).toBe('wait');
            expect(firstButtonMock.setAttribute).toHaveBeenCalledWith('title', 'Select action: wait');
            expect(firstButtonMock.setAttribute).toHaveBeenCalledWith('data-action-id', 'core:wait');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Rendered 2 action buttons. Selected action: none.`));
        });

        it('should clear the container and render nothing if actions array is empty', () => {
            const dummyDiv = createButtonLikeMock('dummy');
            mockContainer.appendChild(dummyDiv);
            mockContainer.appendChild.mockClear();
            instance.render([]);
            expect(mockContainer.removeChild).toHaveBeenCalledWith(dummyDiv);
            expect(mockContainer.appendChild).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} No actions provided to render, container remains empty. Confirm button remains disabled.`));
        });

        it('should treat non-array actions argument as empty list, not log error', () => {
            const dummyDiv = createButtonLikeMock('dummy');
            mockContainer.appendChild(dummyDiv); // Add something to be cleared
            mockContainer.appendChild.mockClear(); // Clear this setup call for appendChild
            instance.render("not an array");
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockContainer.removeChild).toHaveBeenCalledWith(dummyDiv); // Check that clearContainer was effective
            expect(mockContainer.children.length).toBe(0);
            expect(mockDomElementFactory.button).not.toHaveBeenCalled(); // No buttons should be created
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} No actions provided to render, container remains empty. Confirm button remains disabled.`));
        });

        it('should skip rendering invalid action objects within the array and log warning', () => {
            const actions = [{id: 'core:valid', command: 'do valid'}, null, {id: 'core:final', command: 'last one'}];
            const expectedValidCount = 2;
            const expectedInvalidCount = 1;
            instance.render(actions);
            expect(mockDomElementFactory.button).toHaveBeenCalledTimes(expectedValidCount);
            expect(mockLogger.warn).toHaveBeenCalledTimes(expectedInvalidCount);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Skipping invalid action object during render: `), null);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Rendered ${expectedValidCount} action buttons. Selected action: none.`));
        });
    });

    // --- Button Click Behavior ---
    describe('Button Click Behavior', () => {
        let instance;
        beforeEach(() => {
            instance = createInstance();
            mockLogger.debug.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockLogger.info.mockClear();
            mockValidatedEventDispatcher.dispatchValidated.mockClear();
            mockDomElementFactory.button.mockClear();
            mockContainer._reset();
            mockSendButton._reset(); // Ensure send button is reset
        });

        it('should select action, enable send button, and log selection on action button click', async () => {
            const actionToSelect = {id: 'test:examine', command: 'examine'};
            instance.render([actionToSelect]);
            const buttonMock = mockContainer.children[0];
            await buttonMock._simulateClick();
            expect(instance.selectedAction).toEqual(actionToSelect);
            expect(mockSendButton.disabled).toBe(false);
            expect(buttonMock.classList.add).toHaveBeenCalledWith('selected');
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${actionToSelect.command}'`));
        });

        it('should select action with trimmed command, not dispatch', async () => {
            const action = {id: 'core:spaced', command: '  spaced command  '};
            const expectedTrimmedCommand = 'spaced command'; // This is what buttonText becomes
            instance.render([action]);
            const buttonMock = mockContainer.children[0];
            expect(buttonMock.textContent).toBe(expectedTrimmedCommand);
            await buttonMock._simulateClick();
            expect(instance.selectedAction).toEqual(action);
            expect(mockSendButton.disabled).toBe(false);
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            // *** CORRECTED: Log uses the original command from selectedAction object ***
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action selected: '${action.command}'`));
        });

        it('should still select action if button textContent is empty (selection uses actionId)', async () => {
            const action = {id: 'core:empty', command: 'ValidCmd'};
            instance.render([action]);
            const buttonMock = mockContainer.children[0];
            buttonMock.textContent = ' '; // Manually make it empty
            await buttonMock._simulateClick();
            expect(instance.selectedAction).toEqual(action);
            expect(mockSendButton.disabled).toBe(false);
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("textContent is unexpectedly empty"));
        });

        it('should NOT dispatch or log dispatch warnings if VED would return false (action button click)', async () => {
            mockValidatedEventDispatcher.dispatchValidated.mockResolvedValueOnce(false);
            const action = {id: 'core:fail', command: 'fail dispatch'};
            instance.render([action]);
            const buttonMock = mockContainer.children[0];
            await buttonMock._simulateClick();
            expect(instance.selectedAction).toEqual(action);
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("was NOT dispatched"));
        });

        it('should NOT dispatch or log dispatch errors if VED would throw (action button click)', async () => {
            const testError = new Error("Dispatch Failed!");
            mockValidatedEventDispatcher.dispatchValidated.mockRejectedValueOnce(testError);
            const action = {id: 'core:throw', command: 'throw error'};
            instance.render([action]);
            const buttonMock = mockContainer.children[0];
            await buttonMock._simulateClick();
            expect(instance.selectedAction).toEqual(action);
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining("Error occurred during dispatch"));
        });
    });

    // --- Dispose Method ---
    describe('Dispose Method', () => {
        beforeEach(() => {
            mockLogger.debug.mockClear();
            mockSubscription.unsubscribe.mockClear();
            // Clear subscribe calls on VED specifically for this describe block if needed
            mockValidatedEventDispatcher.subscribe.mockClear();
        });
        it('should unsubscribe from VED event', () => {
            const freshInstance = createInstance(); // Creates instance, which subscribes

            expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(1); // From this instance

            freshInstance.dispose();
            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Disposing subscriptions.`));
        });
    });
});