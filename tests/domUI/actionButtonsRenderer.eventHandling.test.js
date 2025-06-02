// tests/domUI/actionButtonsRenderer.eventHandling.test.js
import {ActionButtonsRenderer} from '../../src/domUI';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

// --- Mock Dependencies ---
// Standard Mocks (re-initialized in global beforeEach)
let mockLogger;
let mockDocumentContext;
let capturedEventHandler;
let mockUnsubscribeFn;
let mockValidatedEventDispatcher;
let mockDomElementFactory;
let mockContainer;
let mockSendButton;
let mockSpeechInput;


// Helper to create test action objects
const createValidTestAction = (id, name, command, description) => ({
    id: id,
    name: name || `Test Name for ${id}`,
    command: command || `test_command_for_${id}`,
    description: description || `Test description for ${id}.`,
});

// Helper to create mock DOM elements
function createButtonLikeMock(initialText = '') {
    const mock = {
        nodeType: 1, // Indicates this is an Element node
        textContent: initialText,
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        classList: {
            _classes: new Set(),
            add: jest.fn(function (...classesToAdd) { classesToAdd.forEach(cls => this._classes.add(cls)); }),
            remove: jest.fn(function (cls) { this._classes.delete(cls); }),
            contains: jest.fn(function (cls) { return this._classes.has(cls); }),
            _reset: function () {
                this._classes.clear();
                this.add.mockClear();
                this.remove.mockClear();
                this.contains.mockClear();
            }
        },
        _clickHandlers: [],
        _actionId: '',
        _disabled: false,
        get disabled() { return this._disabled; },
        set disabled(value) { this._disabled = !!value; },
        tagName: 'BUTTON',
        parentNode: null,
        remove: jest.fn(function() {
            if (this.parentNode && this.parentNode.removeChild) {
                this.parentNode.removeChild(this);
            }
        }),
        _simulateClick: async function () {
            for (const handler of this._clickHandlers) {
                await handler();
            }
        },
        _reset: function () {
            this.setAttribute.mockClear();
            this.getAttribute.mockClear();
            this.addEventListener.mockClear();
            this.removeEventListener.mockClear();
            this.classList._reset();
            this._clickHandlers = [];
            this.textContent = initialText;
            this._actionId = '';
            this._disabled = false;
            this.remove.mockClear();
            this.parentNode = null;
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

// Global beforeEach to set up fresh mocks for every test
beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
        debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
    };

    mockDocumentContext = {
        query: jest.fn(),
        create: jest.fn(),
    };

    capturedEventHandler = null;
    mockUnsubscribeFn = jest.fn();

    mockValidatedEventDispatcher = {
        subscribe: jest.fn((eventType, handler) => {
            if (eventType === 'textUI:update_available_actions') {
                capturedEventHandler = handler;
            }
            return mockUnsubscribeFn;
        }),
        dispatchValidated: jest.fn().mockResolvedValue(true),
        listenerCount: jest.fn(),
        unsubscribe: jest.fn(),
    };

    mockDomElementFactory = {
        create: jest.fn(tagName => {
            const el = createButtonLikeMock();
            el.tagName = tagName.toUpperCase();
            return el;
        }),
        button: jest.fn((text, className) => {
            const newButton = createButtonLikeMock(text);
            if (className) newButton.classList.add(...className.split(' ').filter(c => c));
            return newButton;
        })
    };

    mockContainer = {
        nodeType: 1,
        children: [],
        firstChild: null,
        appendChild: jest.fn(function(child) {
            this.children.push(child);
            this.firstChild = this.children[0];
            child.parentNode = this;
        }),
        removeChild: jest.fn(function(child) {
            this.children = this.children.filter(c => c !== child);
            this.firstChild = this.children.length > 0 ? this.children[0] : null;
            if (child) child.parentNode = null;
        }),
        querySelectorAll: jest.fn(selector => {
            if (selector === 'button.action-button') {
                return mockContainer.children.filter(c => c.tagName === 'BUTTON' && c.classList.contains('action-button'));
            }
            return [];
        }),
        querySelector: jest.fn(selector => {
            // Handle: button.action-button[data-action-id="..."] (without .selected)
            let idMatch = selector.match(/^button\.action-button\[data-action-id="([^"]+)"\]$/);
            if (idMatch && idMatch[1]) {
                const actionId = idMatch[1];
                return mockContainer.children.find(btn =>
                    btn && typeof btn.getAttribute === 'function' && btn.getAttribute('data-action-id') === actionId &&
                    btn.classList && btn.classList.contains('action-button')
                );
            }

            // Handle: button.action-button.selected[data-action-id="..."] (with .selected - for click handler finding previous)
            idMatch = selector.match(/button\.action-button\.selected\[data-action-id="([^"]+)"/);
            if (idMatch && idMatch[1]) {
                const actionId = idMatch[1];
                return mockContainer.children.find(btn =>
                    btn && typeof btn.getAttribute === 'function' && btn.getAttribute('data-action-id') === actionId &&
                    btn.classList && btn.classList.contains('action-button') && btn.classList.contains('selected')
                );
            }
            return null;
        }),
        _reset: function () {
            this.children = [];
            this.firstChild = null;
            this.appendChild.mockClear();
            this.removeChild.mockClear();
            this.querySelector.mockClear();
            this.querySelectorAll.mockClear();
        }
    };

    mockSendButton = createButtonLikeMock('Send');
    const originalSendButtonReset = mockSendButton._reset;
    mockSendButton._reset = function() {
        originalSendButtonReset.call(this);
        this.disabled = true; // Default to disabled
    };

    mockSpeechInput = createButtonLikeMock('');
    mockSpeechInput.tagName = 'INPUT';
    mockSpeechInput.value = '';
    const originalSpeechInputReset = mockSpeechInput._reset;
    mockSpeechInput._reset = function() {
        originalSpeechInputReset.call(this);
        this.value = '';
    };

    mockContainer._reset();
    mockSendButton._reset();
    mockSpeechInput._reset();
});


describe('ActionButtonsRenderer', () => {
    const CLASS_PREFIX = '[ActionButtonsRenderer]';
    const MOCK_ACTOR_ID = 'test-actor-id';

    const createInstance = (
        {
            containerElement = mockContainer,
            sendButtonElement = mockSendButton,
            speechInputElement = mockSpeechInput,
            domFactory = mockDomElementFactory,
            docContextOverrides = {},
            logger = mockLogger,
            ved = mockValidatedEventDispatcher,
            actionButtonsContainerSelector = '#test-action-buttons-selector',
            sendButtonSelector = '#test-send-button-selector',
            speechInputSelector = '#test-speech-input-selector'
        } = {}
    ) => {
        const currentTestDocContext = {
            query: jest.fn(selector => {
                if (selector === actionButtonsContainerSelector) return containerElement;
                if (selector === sendButtonSelector) return sendButtonElement;
                if (selector === speechInputSelector) return speechInputElement;
                if (docContextOverrides.query) return docContextOverrides.query(selector);
                return undefined;
            }),
            create: (docContextOverrides.create || jest.fn(tagName => {
                const mockEl = createButtonLikeMock(); // Use our mock creator
                mockEl.tagName = tagName.toUpperCase();
                return mockEl;
            })),
            ...docContextOverrides
        };

        return new ActionButtonsRenderer({
            logger: logger,
            documentContext: currentTestDocContext,
            validatedEventDispatcher: ved,
            domElementFactory: domFactory,
            actionButtonsContainerSelector: actionButtonsContainerSelector,
            sendButtonSelector: sendButtonSelector,
            speechInputSelector: speechInputSelector,
        });
    };

    it('should throw error if logger is missing or invalid', () => {
        const validDocContext = {
            query: jest.fn(selector => {
                if (selector === '#valid-selector') return mockContainer;
                if (selector === '#player-confirm-turn-button') return mockSendButton; // Default selector
                return undefined;
            }),
            create: jest.fn()
        };
        expect(() => new ActionButtonsRenderer({
            logger: null,
            documentContext: validDocContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: mockDomElementFactory,
            actionButtonsContainerSelector: '#valid-selector',
        })).toThrow(/Logger dependency is missing or invalid/);
    });

    it('should throw error if domElementFactory is missing', () => {
        const errPattern = /'domElementFactory' dependency is missing/;
        const validDocContext = {
            query: jest.fn(selector => {
                if (selector === '#valid-selector') return mockContainer;
                if (selector === '#player-confirm-turn-button') return mockSendButton;
                return undefined;
            }),
            create: jest.fn()
        };
        expect(() => new ActionButtonsRenderer({
            logger: mockLogger,
            documentContext: validDocContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: null,
            actionButtonsContainerSelector: '#valid-selector',
        })).toThrow(errPattern);
    });

    it('should throw if actionButtonsContainerSelector is missing or not a string', () => {
        const expectedError = /'actionButtonsContainerSelector' is required and must be a non-empty string/;
        const baseConfig = {
            logger: mockLogger,
            documentContext: { query: jest.fn(), create: jest.fn() },
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: mockDomElementFactory,
        };
        expect(() => new ActionButtonsRenderer({ ...baseConfig, actionButtonsContainerSelector: null })).toThrow(expectedError);
        expect(() => new ActionButtonsRenderer({ ...baseConfig, actionButtonsContainerSelector: {} })).toThrow(expectedError);
        expect(() => new ActionButtonsRenderer({ ...baseConfig })).toThrow(expectedError);
    });

    it('should subscribe to "textUI:update_available_actions" on construction', () => {
        createInstance();
        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith('textUI:update_available_actions', expect.any(Function));
        expect(capturedEventHandler).toBeInstanceOf(Function);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Subscribed to VED event 'textUI:update_available_actions' via _addSubscription.`));
    });

    describe('Event Handling (#handleUpdateActions)', () => {
        const eventType = 'textUI:update_available_actions';
        let instance;
        let refreshListSpy;

        beforeEach(() => {
            instance = createInstance();
            refreshListSpy = jest.spyOn(instance, 'refreshList').mockResolvedValue(undefined); // Prevent actual rendering for these specific tests
            if (!capturedEventHandler) {
                throw new Error("Test setup error: event handler not captured.");
            }
        });

        it('should set availableActions and call refreshList with valid actions from event', async () => {
            const validActions = [createValidTestAction('core:wait')];
            const validEventObject = {type: eventType, payload: {actorId: MOCK_ACTOR_ID, actions: validActions}};
            await capturedEventHandler(validEventObject); // SUT's #handleUpdateActions is async due to refreshList
            expect(instance.availableActions).toEqual(validActions);
            expect(instance.selectedAction).toBeNull();
            expect(refreshListSpy).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith(`${CLASS_PREFIX} Actions received for actor ID: ${MOCK_ACTOR_ID}`);
        });

        it('should filter invalid actions, set valid ones, and call refreshList', async () => {
            const validAction = createValidTestAction('core:go');
            const invalidAction = { id: 'bad', name: null, command: 'cmd', description: 'desc' }; // missing name
            const mixedActions = [validAction, invalidAction];
            const eventObject = { type: eventType, payload: { actorId: MOCK_ACTOR_ID, actions: mixedActions }};
            await capturedEventHandler(eventObject);
            expect(instance.availableActions).toEqual([validAction]); // Only valid action
            expect(refreshListSpy).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${CLASS_PREFIX} Invalid action object found in payload:`, {action: invalidAction}
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${CLASS_PREFIX} Received '${eventType}' with some invalid items. Only valid actions will be rendered.`
            );
        });

        it('should clear actions and call refreshList for event object missing inner "payload"', async () => {
            const invalidEventObject = { type: eventType }; // Missing payload
            await capturedEventHandler(invalidEventObject);
            expect(instance.availableActions).toEqual([]);
            expect(refreshListSpy).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${CLASS_PREFIX} Received invalid or incomplete event for '${eventType}'. Clearing actions.`,
                { receivedObject: invalidEventObject }
            );
        });
    });

    describe('Rendering Logic (BaseListDisplayComponent method usage)', () => {
        let instance;
        beforeEach(() => {
            instance = createInstance();
        });

        it('_getListItemsData should return instance.availableActions', () => {
            const testActions = [createValidTestAction('act1')];
            instance.availableActions = testActions;
            expect(instance._getListItemsData()).toBe(testActions);
        });

        it('_renderListItem should create a button for a valid action and attach click listener', () => {
            const action = createValidTestAction('core:action1', 'Action One', 'cmd1', 'Desc1');
            const button = instance._renderListItem(action, 0); // instance uses mockDomElementFactory
            expect(mockDomElementFactory.button).toHaveBeenCalledWith('cmd1', 'action-button');
            expect(button).toBeDefined();
            expect(button.setAttribute).toHaveBeenCalledWith('title', 'Action One\n\nDescription:\nDesc1');
            expect(button.setAttribute).toHaveBeenCalledWith('data-action-id', 'core:action1');
            expect(button.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('_renderListItem should return null and log warning for invalid actions (e.g., missing command)', () => {
            const invalidAction = { id: 'no-cmd', name: 'No Command Name', description: 'Valid Desc' }; // Missing command
            const button = instance._renderListItem(invalidAction, 0);
            expect(button).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${CLASS_PREFIX} Skipping invalid action object (missing command):`, {actionObject: invalidAction}
            );
        });

        it('_getEmptyListMessage should return "No actions available."', () => {
            expect(instance._getEmptyListMessage()).toBe("No actions available.");
        });

        it('_onListRendered should log info and update send button state', () => {
            // This test directly invokes _onListRendered.
            // It assumes the list container (mockContainer) is already populated externally or by a previous render.
            // We manually set up mockContainer to simulate this state.
            instance.elements.listContainerElement = mockContainer; // Ensure instance uses our mockContainer

            const action = createValidTestAction('act1', 'Action1Name', 'act1Cmd', 'Act1Desc');
            instance.availableActions = [action];

            const mockActionButton = mockDomElementFactory.button(action.command, 'action-button');
            mockActionButton.setAttribute('data-action-id', action.id);
            mockContainer.children = [mockActionButton]; // Manually place the button in the container for querySelector

            // Scenario 1: No action selected
            instance.selectedAction = null;
            instance._onListRendered(instance.availableActions, mockContainer); // Pass available actions and container
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Rendered 1 action buttons. Selected action: none.`));
            expect(mockSendButton.disabled).toBe(true);

            mockLogger.info.mockClear(); // Clear for next part of the test

            // Scenario 2: Action is selected
            instance.selectedAction = instance.availableActions[0]; // Select the action

            // Clear any previous calls to classList.add on this specific mock button (e.g., from its creation)
            mockActionButton.classList.add.mockClear();

            instance._onListRendered(instance.availableActions, mockContainer); // Call SUT method

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Rendered 1 action buttons. Selected action: '${action.name}'`));
            expect(mockSendButton.disabled).toBe(false);
            expect(mockActionButton.classList.add).toHaveBeenCalledWith('selected'); // Check if selected class is added
        });
    });

    describe('Dispose Method', () => {
        it('should unsubscribe from VED event and perform cleanup', () => {
            const instanceToDispose = createInstance();
            expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(1); // From construction

            instanceToDispose.dispose();

            expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1); // VED unsubscribe called
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Unsubscribing 1 VED event subscriptions.`));
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_PREFIX} Disposing ActionButtonsRenderer.`);
            // Check if listContainerElement content is cleared (mockContainer.removeChild should be called if it had children)
            // This depends on whether refreshList was called and populated it before dispose.
            // A simpler check might be that the logger message for clearing is present.
            expect(mockLogger.debug).toHaveBeenCalledWith(`${CLASS_PREFIX} Cleared listContainerElement content during dispose.`);
            expect(mockLogger.info).toHaveBeenCalledWith(`${CLASS_PREFIX} ActionButtonsRenderer disposed.`);
            // Check if DOM listeners on sendButtonElement were removed (if it existed)
            // This is handled by super.dispose() and relies on _addDomListener being used.
        });
    });
});