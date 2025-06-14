// tests/domUI/actionButtonsRenderer.test.js

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
// Import from specific file for clarity
import { ActionButtonsRenderer } from '../../src/domUI'; // Using index import
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../src/logging/consoleLogger.js';
import ValidatedEventDispatcher from '../../src/events/validatedEventDispatcher.js';

// Mock dependencies
jest.mock('../../src/logging/consoleLogger.js');
jest.mock('../../src/events/validatedEventDispatcher.js');
jest.mock('../../src/domUI/domElementFactory.js');

describe('ActionButtonsRenderer', () => {
  let dom;
  let document;
  let docContext;
  let mockLogger;
  let mockVed;
  let mockDomElementFactoryInstance;
  let actionButtonsContainerElement; // Element for reference
  let mockSendButton; // mockSendButton holds the reference to the button in the DOM
  let commandInputElement;

  const CLASS_PREFIX = '[ActionButtonsRenderer]';
  const UPDATE_ACTIONS_EVENT_TYPE = 'core:update_available_actions';

  // Selectors used in the tests and SUT defaults
  const ACTION_BUTTONS_CONTAINER_SELECTOR = '#action-buttons';
  const SEND_BUTTON_SELECTOR = '#player-confirm-turn-button';
  const SPEECH_INPUT_SELECTOR = '#speech-input';

  /**
   * CORRECTED: Creates a valid ActionComposite object for testing.
   * The original `createTestAction` created objects that are now invalid.
   *
   * @param index
   * @param actionId
   * @param commandString
   * @param description
   * @param params
   */
  const createTestComposite = (
    index,
    actionId,
    commandString,
    description,
    params = {}
  ) => ({
    index,
    actionId,
    commandString,
    description,
    params,
  });

  const createMockElement = (
    sourceDocument,
    tagName = 'div',
    id = '',
    classes = [],
    textContent = ''
  ) => {
    const element = sourceDocument.createElement(tagName);
    if (id) element.id = id;
    const classArray = Array.isArray(classes)
      ? classes
      : String(classes)
          .split(' ')
          .filter((c) => c);
    classArray.forEach((cls) => element.classList.add(cls));
    element.textContent = textContent;
    element._attributes = {};
    element._listeners = {};
    jest.spyOn(element, 'addEventListener').mockImplementation((event, cb) => {
      element._listeners[event] = element._listeners[event] || [];
      element._listeners[event].push(cb);
    });
    jest
      .spyOn(element, 'removeEventListener')
      .mockImplementation((name, cb) => {
        if (element._listeners[name]) {
          element._listeners[name] = element._listeners[name].filter(
            (fn) => fn !== cb
          );
        }
      });
    const originalClick =
      typeof element.click === 'function'
        ? element.click.bind(element)
        : () => {};
    element.click = jest.fn(async () => {
      originalClick();
      if (element._listeners['click']) {
        for (const listener of element._listeners['click']) await listener();
      }
    });
    const originalSetAttribute = element.setAttribute.bind(element);
    jest.spyOn(element, 'setAttribute').mockImplementation((name, value) => {
      originalSetAttribute(name, value);
      element._attributes[name] = value;
    });
    jest.spyOn(element, 'getAttribute');
    jest.spyOn(element, 'remove');
    if (tagName === 'button' || tagName === 'input') {
      let isDisabled = false;
      Object.defineProperty(element, 'disabled', {
        get: () => isDisabled,
        set: (value) => {
          isDisabled = !!value;
          if (isDisabled) originalSetAttribute('disabled', '');
          else element.removeAttribute('disabled');
        },
        configurable: true,
      });
    }
    if (tagName === 'input') {
      let currentValue = textContent || '';
      Object.defineProperty(element, 'value', {
        get: () => currentValue,
        set: (val) => {
          currentValue = String(val);
        },
        configurable: true,
      });
      if (!Object.prototype.hasOwnProperty.call(element, 'type'))
        Object.defineProperty(element, 'type', {
          value: 'text',
          writable: true,
          configurable: true,
        });
    }
    jest.spyOn(element.classList, 'add');
    jest.spyOn(element.classList, 'remove');
    jest.spyOn(element.classList, 'contains');
    return element;
  };

  beforeEach(() => {
    dom = new JSDOM(
      `<!DOCTYPE html><html><body><div id="game-container"><div id="action-buttons"></div><button id="player-confirm-turn-button"></button><input type="text" id="speech-input" /></div></body></html>`
    );
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;
    global.HTMLInputElement = dom.window.HTMLInputElement;
    docContext = new DocumentContext(document);
    actionButtonsContainerElement = document.getElementById('action-buttons');
    const sendButtonElemOriginal = document.getElementById(
      'player-confirm-turn-button'
    );
    const speechInputElemOriginal = document.getElementById('speech-input');
    if (
      !actionButtonsContainerElement ||
      !sendButtonElemOriginal ||
      !speechInputElemOriginal
    )
      throw new Error('Test setup failed: Essential JSDOM elements not found.');

    mockSendButton = createMockElement(
      document,
      'button',
      'player-confirm-turn-button'
    ); // User's original variable name
    sendButtonElemOriginal.parentNode.replaceChild(
      mockSendButton,
      sendButtonElemOriginal
    );

    commandInputElement = createMockElement(document, 'input', 'speech-input');
    commandInputElement.type = 'text';
    speechInputElemOriginal.parentNode.replaceChild(
      commandInputElement,
      speechInputElemOriginal
    );

    mockLogger = new ConsoleLogger();
    mockVed = new ValidatedEventDispatcher({}); // Assuming ValidatedEventDispatcher constructor takes an empty object or its deps are mocked if it throws

    mockDomElementFactoryInstance = new DomElementFactory(docContext); // DomElementFactory is mocked via jest.mock
    // Its methods (e.g., .button, .create) are jest.fn() by default.
    // Provide default implementations for methods used by SUT if not test-specific.
    mockDomElementFactoryInstance.button.mockImplementation((text, cls) =>
      createMockElement(
        document,
        'button',
        '',
        cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter((c) => c)) : [],
        text
      )
    );
    mockDomElementFactoryInstance.create.mockImplementation((tagName) =>
      document.createElement(tagName)
    );

    const actualUnsubscribeFn = jest.fn();
    mockVed.subscribe.mockReturnValue(actualUnsubscribeFn);
    mockVed.dispatch.mockResolvedValue(true);

    if (actionButtonsContainerElement) {
      // Guard for safety, though it should exist
      jest.spyOn(actionButtonsContainerElement, 'appendChild');
      jest.spyOn(actionButtonsContainerElement, 'removeChild');
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (document && document.body) document.body.innerHTML = '';
    // Clean up globals
    delete global.document;
    delete global.window;
    delete global.HTMLElement;
    delete global.HTMLButtonElement;
    delete global.HTMLInputElement;
  });

  const createRenderer = (config = {}) => {
    const defaults = {
      logger: mockLogger,
      documentContext: docContext,
      validatedEventDispatcher: mockVed,
      domElementFactory: mockDomElementFactoryInstance,
      actionButtonsContainerSelector: ACTION_BUTTONS_CONTAINER_SELECTOR,
      sendButtonSelector: SEND_BUTTON_SELECTOR,
      speechInputSelector: SPEECH_INPUT_SELECTOR,
    };
    return new ActionButtonsRenderer({ ...defaults, ...config });
  };

  describe('Constructor', () => {
    it('should initialize and subscribe to VED events', () => {
      const renderer = createRenderer();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `${CLASS_PREFIX} List container element successfully bound:`
        ),
        actionButtonsContainerElement
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `${CLASS_PREFIX} 'Confirm Action' button listener added via _addDomListener.`
        )
      );

      expect(renderer.elements.sendButtonElement).toBeDefined();
      expect(renderer.elements.sendButtonElement.disabled).toBe(true);

      expect(mockVed.subscribe).toHaveBeenCalledWith(
        UPDATE_ACTIONS_EVENT_TYPE,
        expect.any(Function)
      );
    });

    it('should throw if actionButtonsContainer (resolved from selector) is missing or invalid', () => {
      const emptyDom = new JSDOM();
      const mockLocalDocContext = new DocumentContext(emptyDom.window.document);
      jest
        .spyOn(mockLocalDocContext, 'query')
        .mockImplementation((selector) => {
          if (selector === ACTION_BUTTONS_CONTAINER_SELECTOR) return null;
          if (selector === SEND_BUTTON_SELECTOR)
            return emptyDom.window.document.createElement('button');
          if (selector === SPEECH_INPUT_SELECTOR)
            return emptyDom.window.document.createElement('input');
          return null;
        });

      const factoryForThisTest = new DomElementFactory(mockLocalDocContext);

      const expectedErrorMessage = `${CLASS_PREFIX} 'listContainerElement' is not defined or not found in the DOM. This element is required for BaseListDisplayComponent. Ensure it's specified in elementsConfig.`;

      expect(() =>
        createRenderer({
          documentContext: mockLocalDocContext,
          domElementFactory: factoryForThisTest,
        })
      ).toThrow(
        new RegExp(expectedErrorMessage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(expectedErrorMessage),
        expect.objectContaining({
          elementsConfigReceived: expect.objectContaining({
            listContainerElement: {
              selector: ACTION_BUTTONS_CONTAINER_SELECTOR,
              required: true,
            },
          }),
          resolvedElements: expect.objectContaining({
            listContainerElement: null,
          }),
        })
      );
    });

    it('should warn if sendButtonElement (resolved from selector) is not found', () => {
      const localJSDOM = new JSDOM(
        `<html><body><div id="action-buttons"></div><input type="text" id="speech-input"/></body></html>`
      );
      const localDocument = localJSDOM.window.document;
      const localContainer = localDocument.getElementById('action-buttons');
      const localSpeechInput = localDocument.getElementById('speech-input');

      const localCtx = new DocumentContext(localDocument);
      jest.spyOn(localCtx, 'query').mockImplementation((selector) => {
        if (selector === ACTION_BUTTONS_CONTAINER_SELECTOR)
          return localContainer;
        if (selector === SEND_BUTTON_SELECTOR) return null;
        if (selector === SPEECH_INPUT_SELECTOR) return localSpeechInput;
        return localDocument.querySelector(selector);
      });

      const factoryMock = new DomElementFactory(localCtx);

      createRenderer({
        documentContext: localCtx,
        domElementFactory: factoryMock,
      });

      const expectedWarningMsg = `${CLASS_PREFIX} 'Confirm Action' button (selector: '${SEND_BUTTON_SELECTOR}') not found or not a button. Send functionality will be unavailable.`;
      expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningMsg);
    });

    it('should warn if speech input element (resolved from selector) is not found', () => {
      const domNoInput = new JSDOM(
        `<!DOCTYPE html><html><body><div id="action-buttons"></div><button id="player-confirm-turn-button"></button></body></html>`
      );
      const localDocument = domNoInput.window.document;
      const localActionButtonsContainer =
        localDocument.getElementById('action-buttons');
      const localSendButton = localDocument.getElementById(
        'player-confirm-turn-button'
      );

      const localDocCtx = new DocumentContext(localDocument);
      jest.spyOn(localDocCtx, 'query').mockImplementation((selector) => {
        if (selector === ACTION_BUTTONS_CONTAINER_SELECTOR)
          return localActionButtonsContainer;
        if (selector === SEND_BUTTON_SELECTOR) return localSendButton;
        if (selector === SPEECH_INPUT_SELECTOR) return null;
        return localDocument.querySelector(selector);
      });

      const localDomElementFactory = new DomElementFactory(localDocCtx);

      createRenderer({
        documentContext: localDocCtx,
        domElementFactory: localDomElementFactory,
      });
      const expectedWarningMsg = `${CLASS_PREFIX} Speech input element (selector: '${SPEECH_INPUT_SELECTOR}') not found or not an input. Speech input will be unavailable.`;
      expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningMsg);
    });
  });

  describe('VED Event Handling (core:update_available_actions)', () => {
    let rendererInstance;
    let capturedUpdateActionsHandler;

    beforeEach(() => {
      const mockSubscriptionUnsubscribe = jest.fn();
      mockVed.subscribe.mockReset().mockImplementation((eventName, handler) => {
        if (eventName === UPDATE_ACTIONS_EVENT_TYPE) {
          capturedUpdateActionsHandler = handler;
        }
        return mockSubscriptionUnsubscribe;
      });

      mockLogger.warn.mockClear();
      rendererInstance = createRenderer();

      if (typeof capturedUpdateActionsHandler !== 'function') {
        throw new Error(
          `Test setup for VED Event Handling failed: VED handler for '${UPDATE_ACTIONS_EVENT_TYPE}' was not captured for this test run.`
        );
      }
      jest.spyOn(rendererInstance, 'renderList');
    });

    it('should call renderList with valid actions from payload and set currentActorId', async () => {
      const testActorId = 'player-test-actor-valid';
      const validAction = createTestComposite(
        1,
        'core:go_n',
        'Go North',
        'Move northwards.'
      );
      const innerPayload = { actorId: testActorId, actions: [validAction] };
      const eventObject = {
        type: UPDATE_ACTIONS_EVENT_TYPE,
        payload: innerPayload,
      };

      mockLogger.warn.mockClear();
      mockLogger.debug.mockClear();
      rendererInstance.renderList.mockClear();

      await capturedUpdateActionsHandler(eventObject);

      expect(rendererInstance.renderList).toHaveBeenCalled();
      expect(rendererInstance.availableActions).toEqual([validAction]);
      expect(rendererInstance._getTestCurrentActorId()).toBe(testActorId);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should call renderList with filtered valid action objects, logging a warning, and set currentActorId', async () => {
      const testActorId = 'player-test-actor-filter';
      const validAction1 = createTestComposite(
        1,
        'core:go_n',
        'Go North',
        'Move northwards.'
      );
      const validAction2 = createTestComposite(
        2,
        'valid:action',
        'Do Valid Thing',
        'This is a valid description.'
      );

      // CORRECTED: Invalid composites now test the SUT's actual validation rules
      const invalid_missingActionId = {
        index: 3,
        commandString: 'cmd',
        description: 'desc',
        params: {},
      };
      const invalid_nullParams = {
        index: 4,
        actionId: 'a:id',
        commandString: 'cmd',
        description: 'desc',
        params: null,
      };
      const invalid_badIndex = {
        index: 0,
        actionId: 'a:id2',
        commandString: 'cmd2',
        description: 'desc2',
        params: {},
      };

      const innerPayload = {
        actorId: testActorId,
        actions: [
          validAction1,
          null,
          validAction2,
          invalid_missingActionId,
          invalid_nullParams,
          invalid_badIndex,
        ],
      };
      const eventObject = {
        type: UPDATE_ACTIONS_EVENT_TYPE,
        payload: innerPayload,
      };
      const expectedFiltered = [validAction1, validAction2];

      mockLogger.warn.mockClear();
      mockLogger.debug.mockClear();
      rendererInstance.renderList.mockClear();

      await capturedUpdateActionsHandler(eventObject);

      expect(rendererInstance.renderList).toHaveBeenCalled();
      expect(rendererInstance.availableActions).toEqual(expectedFiltered);
      expect(rendererInstance._getTestCurrentActorId()).toBe(testActorId);

      // Check for the generic warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Received '${UPDATE_ACTIONS_EVENT_TYPE}' with some invalid items. Only valid composites will be rendered.`
      );

      // Check for specific warnings (CORRECTED: using { composite: ... })
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Invalid action composite found in payload:`,
        { composite: null }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Invalid action composite found in payload:`,
        { composite: invalid_missingActionId }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Invalid action composite found in payload:`,
        { composite: invalid_nullParams }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Invalid action composite found in payload:`,
        { composite: invalid_badIndex }
      );
    });

    it('should call renderList with empty list and log warning if payload is invalid (e.g. missing actorId)', async () => {
      const testCases = [
        null,
        {},
        { type: UPDATE_ACTIONS_EVENT_TYPE, payload: {} },
        { type: UPDATE_ACTIONS_EVENT_TYPE, payload: { actions: 'invalid' } },
        {
          type: UPDATE_ACTIONS_EVENT_TYPE,
          payload: { actorId: 'player123', actions: 'invalid' },
        },
        {
          type: UPDATE_ACTIONS_EVENT_TYPE,
          // Missing actorId
          payload: { actions: [createTestComposite(1, 'id', 'c', 'd')] },
        },
      ];

      for (const inputCase of testCases) {
        rendererInstance.renderList.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.debug.mockClear();

        const initialActorId = 'some-previous-actor';
        const initialActions = [
          createTestComposite(1, 'initial:id', 'initial_cmd', 'Initial Desc'),
        ];

        // Set a valid initial state
        await capturedUpdateActionsHandler({
          type: UPDATE_ACTIONS_EVENT_TYPE,
          payload: { actorId: initialActorId, actions: initialActions },
        });
        expect(rendererInstance._getTestCurrentActorId()).toBe(initialActorId);

        // Clear mocks before testing the invalid case
        rendererInstance.renderList.mockClear();
        mockLogger.warn.mockClear();

        // Now, send the invalid payload
        await capturedUpdateActionsHandler(inputCase);

        const eventTypeForLog =
          inputCase && typeof inputCase.type === 'string'
            ? inputCase.type
            : UPDATE_ACTIONS_EVENT_TYPE;
        const expectedWarningMsg = `${CLASS_PREFIX} Received invalid or incomplete event for '${eventTypeForLog}'. Clearing actions.`;

        expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarningMsg, {
          receivedObject: inputCase,
        });
        expect(rendererInstance.renderList).toHaveBeenCalled();
        expect(rendererInstance.availableActions).toEqual([]);
        expect(rendererInstance._getTestCurrentActorId()).toBeNull();
      }
    });
  });
});
