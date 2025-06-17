// tests/domUI/actionButtonsRenderer.eventHandling.test.js
import { ActionButtonsRenderer } from '../../src/domUI';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

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

// Helper to create test action composite objects
const createValidActionComposite = (
  index,
  actionId,
  commandString,
  description,
  params = {}
) => ({
  index,
  actionId: actionId || `core:action${index}`,
  commandString: commandString || `Command ${index}`,
  description: description || `Description for action ${index}.`,
  params,
});

/**
 *
 * @param initialText
 */
function createButtonLikeMock(initialText = '') {
  const mock = {
    nodeType: 1, // Indicates this is an Element node
    textContent: initialText,
    title: '',
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    classList: {
      _classes: new Set(),
      add: jest.fn(function (...classesToAdd) {
        classesToAdd.forEach((cls) => this._classes.add(cls));
      }),
      remove: jest.fn(function (cls) {
        this._classes.delete(cls);
      }),
      contains: jest.fn(function (cls) {
        return this._classes.has(cls);
      }),
      toggle: jest.fn(function (cls, force) {
        if (force === undefined) {
          if (this._classes.has(cls)) {
            this._classes.delete(cls);
            return false;
          }
          this._classes.add(cls);
          return true;
        }
        if (force) {
          this._classes.add(cls);
          return true;
        }
        this._classes.delete(cls);
        return false;
      }),
      _reset: function () {
        this._classes.clear();
        this.add.mockClear();
        this.remove.mockClear();
        this.contains.mockClear();
        this.toggle.mockClear();
      },
    },
    _clickHandlers: [],
    _actionIndex: null,
    _disabled: false,
    get disabled() {
      return this._disabled;
    },
    set disabled(value) {
      this._disabled = !!value;
    },
    tagName: 'BUTTON',
    parentNode: null,
    remove: jest.fn(function () {
      if (this.parentNode && this.parentNode.removeChild) {
        this.parentNode.removeChild(this);
      }
    }),
    _simulateClick: async function () {
      for (const handler of this._clickHandlers) {
        await handler();
      }
    },
    focus: jest.fn(),
    _reset: function () {
      this.setAttribute.mockClear();
      this.getAttribute.mockClear();
      this.addEventListener.mockClear();
      this.removeEventListener.mockClear();
      this.classList._reset();
      this._clickHandlers = [];
      this.textContent = initialText;
      this._actionIndex = null;
      this._disabled = false;
      this.remove.mockClear();
      this.parentNode = null;
      this.title = '';
      this.focus.mockClear();
      Object.keys(this)
        .filter((key) => key.startsWith('_attr_'))
        .forEach((key) => delete this[key]);
    },
  };
  mock.getAttribute.mockImplementation((attr) => {
    if (attr === 'data-action-index') return mock._actionIndex;
    return mock[`_attr_${attr}`];
  });
  mock.setAttribute.mockImplementation((attr, value) => {
    if (attr === 'data-action-index') mock._actionIndex = value;
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
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  mockDocumentContext = {
    query: jest.fn(),
    create: jest.fn(),
  };

  capturedEventHandler = null;
  mockUnsubscribeFn = jest.fn();

  mockValidatedEventDispatcher = {
    subscribe: jest.fn((eventType, handler) => {
      if (eventType === 'core:update_available_actions') {
        capturedEventHandler = handler;
      }
      return mockUnsubscribeFn;
    }),
    dispatch: jest.fn().mockResolvedValue(true),
    listenerCount: jest.fn(),
    unsubscribe: jest.fn(),
  };

  mockDomElementFactory = {
    create: jest.fn((tagName) => {
      const el = createButtonLikeMock();
      el.tagName = tagName.toUpperCase();
      return el;
    }),
    button: jest.fn((text, className) => {
      const newButton = createButtonLikeMock(text);
      if (className)
        newButton.classList.add(...className.split(' ').filter((c) => c));
      return newButton;
    }),
  };

  mockContainer = {
    nodeType: 1,
    children: [],
    firstChild: null,
    classList: {
      _classes: new Set(),
      add: jest.fn(function (...cls) {
        cls.forEach((c) => this._classes.add(c));
      }),
      remove: jest.fn(function (cls) {
        this._classes.delete(cls);
      }),
      contains: jest.fn(function (cls) {
        return this._classes.has(cls);
      }),
      _reset() {
        this._classes.clear();
        this.add.mockClear();
        this.remove.mockClear();
        this.contains.mockClear();
      },
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    appendChild: jest.fn(function (child) {
      this.children.push(child);
      this.firstChild = this.children[0];
      child.parentNode = this;
    }),
    removeChild: jest.fn(function (child) {
      this.children = this.children.filter((c) => c !== child);
      this.firstChild = this.children.length > 0 ? this.children[0] : null;
      if (child) child.parentNode = null;
    }),
    querySelectorAll: jest.fn((selector) => {
      if (selector === 'button.action-button' || selector === '[role="radio"]') {
        return mockContainer.children.filter(
          (c) => c.tagName === 'BUTTON' && c.classList.contains('action-button')
        );
      }
      return [];
    }),
    querySelector: jest.fn((selector) => {
      // Handle: button.action-button(.selected)[data-action-index="..."]
      const match = selector.match(
        /button\.action-button(?<selected>\.selected)?\[data-action-index="(?<index>[^"]+)"\]/
      );
      if (match?.groups) {
        const { selected, index } = match.groups;
        return mockContainer.children.find((btn) => {
          if (
            !btn ||
            !btn.classList ||
            typeof btn.getAttribute !== 'function'
          ) {
            return false;
          }
          const hasIndex = btn.getAttribute('data-action-index') == index; // Use == for loose comparison as attribute is string
          const hasSelected = selected
            ? btn.classList.contains('selected')
            : true;
          return hasIndex && hasSelected;
        });
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
      this.classList._reset();
      this.addEventListener.mockClear();
      this.removeEventListener.mockClear();
    },
  };

  mockSendButton = createButtonLikeMock('Send');
  const originalSendButtonReset = mockSendButton._reset;
  mockSendButton._reset = function () {
    originalSendButtonReset.call(this);
    this.disabled = true; // Default to disabled
  };

  mockSpeechInput = createButtonLikeMock('');
  mockSpeechInput.tagName = 'INPUT';
  mockSpeechInput.value = '';
  const originalSpeechInputReset = mockSpeechInput._reset;
  mockSpeechInput._reset = function () {
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

  const createInstance = ({
    containerElement = mockContainer,
    sendButtonElement = mockSendButton,
    speechInputElement = mockSpeechInput,
    domFactory = mockDomElementFactory,
    docContextOverrides = {},
    logger = mockLogger,
    ved = mockValidatedEventDispatcher,
    actionButtonsContainerSelector = '#test-action-buttons-selector',
    sendButtonSelector = '#test-send-button-selector',
    speechInputSelector = '#test-speech-input-selector',
    autoRefresh = false,
  } = {}) => {
    const currentTestDocContext = {
      query: jest.fn((selector) => {
        if (selector === actionButtonsContainerSelector)
          return containerElement;
        if (selector === sendButtonSelector) return sendButtonElement;
        if (selector === speechInputSelector) return speechInputElement;
        if (docContextOverrides.query)
          return docContextOverrides.query(selector);
        return undefined;
      }),
      create:
        docContextOverrides.create ||
        jest.fn((tagName) => {
          const mockEl = createButtonLikeMock(); // Use our mock creator
          mockEl.tagName = tagName.toUpperCase();
          return mockEl;
        }),
      ...docContextOverrides,
    };

    return new ActionButtonsRenderer({
      logger: logger,
      documentContext: currentTestDocContext,
      validatedEventDispatcher: ved,
      domElementFactory: domFactory,
      actionButtonsContainerSelector: actionButtonsContainerSelector,
      sendButtonSelector: sendButtonSelector,
      speechInputSelector: speechInputSelector,
      autoRefresh,
    });
  };

  it('should throw error if logger is missing or invalid', () => {
    const validDocContext = {
      query: jest.fn((selector) => {
        if (selector === '#valid-selector') return mockContainer;
        if (selector === '#player-confirm-turn-button') return mockSendButton; // Default selector
        return undefined;
      }),
      create: jest.fn(),
    };
    expect(
      () =>
        new ActionButtonsRenderer({
          logger: null,
          documentContext: validDocContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          domElementFactory: mockDomElementFactory,
          actionButtonsContainerSelector: '#valid-selector',
        })
    ).toThrow(/Logger dependency is missing or invalid/);
  });

  it('should construct even if domElementFactory is missing', () => {
    const validDocContext = {
      query: jest.fn((selector) => {
        if (selector === '#valid-selector') return mockContainer;
        if (selector === '#player-confirm-turn-button') return mockSendButton;
        return undefined;
      }),
      create: jest.fn(),
    };
    expect(
      () =>
        new ActionButtonsRenderer({
          logger: mockLogger,
          documentContext: validDocContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          domElementFactory: null,
          actionButtonsContainerSelector: '#valid-selector',
        })
    ).not.toThrow();
  });

  it('should throw if actionButtonsContainerSelector is missing or not a string', () => {
    const expectedError =
      /'actionButtonsContainerSelector' is required and must be a non-empty string/;
    const baseConfig = {
      logger: mockLogger,
      documentContext: { query: jest.fn(), create: jest.fn() },
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
    };
    expect(
      () =>
        new ActionButtonsRenderer({
          ...baseConfig,
          actionButtonsContainerSelector: null,
        })
    ).toThrow(expectedError);
    expect(
      () =>
        new ActionButtonsRenderer({
          ...baseConfig,
          actionButtonsContainerSelector: {},
        })
    ).toThrow(expectedError);
    expect(() => new ActionButtonsRenderer({ ...baseConfig })).toThrow(
      expectedError
    );
  });

  it('should subscribe to "core:update_available_actions" on construction', () => {
    createInstance();
    expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
      'core:update_available_actions',
      expect.any(Function)
    );
    expect(capturedEventHandler).toBeInstanceOf(Function);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `${CLASS_PREFIX} Subscribed to VED event 'core:update_available_actions' via _subscribe.`
      )
    );
  });

  describe('Event Handling (#handleUpdateActions)', () => {
    const eventType = 'core:update_available_actions';
    let instance;
    let refreshListSpy;

    beforeEach(() => {
      instance = createInstance();
      refreshListSpy = jest
        .spyOn(instance, 'refreshList')
        .mockResolvedValue(undefined); // Prevent actual rendering for these specific tests
      if (!capturedEventHandler) {
        throw new Error('Test setup error: event handler not captured.');
      }
    });

    it('should set availableActions and call refreshList with valid actions from event', async () => {
      const validComposites = [createValidActionComposite(1, 'core:wait')];
      const validEventObject = {
        type: eventType,
        payload: { actorId: MOCK_ACTOR_ID, actions: validComposites },
      };
      await capturedEventHandler(validEventObject);
      expect(instance.availableActions).toEqual(validComposites);
      expect(instance.selectedAction).toBeNull();
      expect(refreshListSpy).toHaveBeenCalled();
    });

    it('should filter invalid actions, set valid ones, and call refreshList', async () => {
      const validComposite = createValidActionComposite(1, 'core:go');
      const invalidComposite = {
        index: 2,
        actionId: null, // Invalid actionId
        commandString: 'cmd',
        description: 'desc',
        params: {},
      };
      const mixedComposites = [validComposite, invalidComposite];
      const eventObject = {
        type: eventType,
        payload: { actorId: MOCK_ACTOR_ID, actions: mixedComposites },
      };
      await capturedEventHandler(eventObject);
      expect(instance.availableActions).toEqual([validComposite]);
      expect(refreshListSpy).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Invalid action composite found in payload:`,
        { composite: invalidComposite }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Received '${eventType}' with some invalid items. Only valid composites will be rendered.`
      );
    });

    it('should clear actions and call refreshList for event object missing inner "payload"', async () => {
      const invalidEventObject = { type: eventType }; // Missing payload
      await capturedEventHandler(invalidEventObject);
      expect(instance.availableActions).toEqual([]);
      expect(refreshListSpy).toHaveBeenCalled();
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
      const testComposites = [createValidActionComposite(1)];
      instance.availableActions = testComposites;
      expect(instance._getListItemsData()).toBe(testComposites);
    });

    it('_renderListItem should create a button for a valid composite and attach click listener', () => {
      const composite = createValidActionComposite(
        1,
        'core:action1',
        'Do the thing',
        'This is the description.'
      );
      const button = instance._renderListItem(composite);
      expect(mockDomElementFactory.button).toHaveBeenCalledWith(
        'Do the thing',
        'action-button'
      );
      expect(button).toBeDefined();
      expect(button.title).toBe('This is the description.');
      expect(button.setAttribute).toHaveBeenCalledWith('role', 'radio');
      expect(button.setAttribute).toHaveBeenCalledWith(
        'data-action-index',
        '1'
      );
      expect(button.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
    });

    it('_renderListItem should return null and log warning for invalid composites (e.g., missing commandString)', () => {
      const invalidComposite = {
        index: 1,
        actionId: 'no-cmd',
        // commandString is missing
        description: 'Valid Desc',
        params: {},
      };
      const button = instance._renderListItem(invalidComposite);
      expect(button).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Skipping invalid action composite in _renderListItem: `,
        { actionComposite: invalidComposite }
      );
    });

    it('_getEmptyListMessage should return "No actions available."', () => {
      expect(instance._getEmptyListMessage()).toBe('No actions available.');
    });

    it('_onListRendered should log info and update send button state', () => {
      instance.elements.listContainerElement = mockContainer;

      const composite = createValidActionComposite(
        1,
        'act1',
        'act1Cmd',
        'Act1Desc'
      );
      instance.availableActions = [composite];

      const mockActionButton = mockDomElementFactory.button(
        composite.commandString,
        'action-button'
      );
      mockActionButton.setAttribute(
        'data-action-index',
        composite.index.toString()
      );
      mockContainer.children = [mockActionButton];

      // Scenario 1: No action selected
      const spy = jest.spyOn(instance, '_onItemSelected');
      instance.selectedAction = null;
      instance._onListRendered(instance.availableActions, mockContainer);
      expect(mockSendButton.disabled).toBe(true);
      expect(spy).toHaveBeenCalledWith(null, null);
      expect(mockContainer.classList.add).toHaveBeenCalledWith(
        'actions-fade-in'
      );

      mockLogger.debug.mockClear();

      // Scenario 2: Action is selected
      instance.selectedAction = instance.availableActions[0];
      spy.mockClear();
      instance._onListRendered(instance.availableActions, mockContainer);

      expect(mockSendButton.disabled).toBe(false);
      expect(mockActionButton.classList.contains('selected')).toBe(true);
      expect(spy).not.toHaveBeenCalledWith(null, null);
      expect(mockContainer.classList.add).toHaveBeenCalledWith(
        'actions-fade-in'
      );
    });
  });

  describe('Dispose Method', () => {
    it('should unsubscribe from VED event and perform cleanup', () => {
      const instanceToDispose = createInstance();
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(1);

      instanceToDispose.dispose();

      expect(mockUnsubscribeFn).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `${CLASS_PREFIX} Unsubscribing 1 VED event subscriptions.`
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Disposing ActionButtonsRenderer.`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Cleared listContainerElement content during dispose.`
      );
    });
  });
});
