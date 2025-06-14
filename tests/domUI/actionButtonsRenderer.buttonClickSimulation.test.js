// tests/domUI/actionButtonsRenderer.buttonClickSimulation.test.js

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
import { PLAYER_TURN_SUBMITTED_ID } from '../../src/constants/eventIds';

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
   * Creates a valid ActionComposite object for testing.
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

    mockSendButton = createMockElement(
      document,
      'button',
      'player-confirm-turn-button'
    );
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
    mockVed = new ValidatedEventDispatcher({});

    mockDomElementFactoryInstance = new DomElementFactory(docContext);
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
      jest.spyOn(actionButtonsContainerElement, 'appendChild');
      jest.spyOn(actionButtonsContainerElement, 'removeChild');
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (document && document.body) document.body.innerHTML = '';
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

  describe('Button Click Simulation (Action Buttons)', () => {
    let renderer;
    let simulateUpdateActionsEventForCurrentRenderer;

    beforeEach(() => {
      const actualUnsubscribeFn = jest.fn();
      mockVed.subscribe.mockReset().mockReturnValue(actualUnsubscribeFn);
      renderer = createRenderer();
      simulateUpdateActionsEventForCurrentRenderer = async (
        actorId,
        actions
      ) => {
        const subscribeCall = mockVed.subscribe.mock.calls.find(
          (call) => call[0] === UPDATE_ACTIONS_EVENT_TYPE
        );
        if (subscribeCall && typeof subscribeCall[1] === 'function') {
          const handler = subscribeCall[1];
          await handler({
            type: UPDATE_ACTIONS_EVENT_TYPE,
            payload: { actorId, actions },
          });
        } else {
          throw new Error(
            'Button Click Sim: Could not find registered handler for core:update_available_actions for the current renderer instance.'
          );
        }
      };
    });

    it('should select action, enable send button, and log selection on action button click', async () => {
      const actionToSelect = createTestComposite(
        1,
        'test:examine',
        'examine item',
        'Examines the item closely.'
      );
      const actions = [
        actionToSelect,
        createTestComposite(
          2,
          'test:go_north',
          'go north',
          'Moves your character to the north.'
        ),
      ];
      const testActorId = 'player1';
      let mockExamineButton;

      mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
        const btn = createMockElement(
          document,
          'button',
          '',
          cls ? cls.split(' ') : [],
          text
        );
        if (text === actionToSelect.commandString) {
          mockExamineButton = btn;
        }
        return btn;
      });

      await simulateUpdateActionsEventForCurrentRenderer(testActorId, actions);
      expect(mockExamineButton).toBeDefined();
      if (!mockExamineButton) return;

      expect(renderer.elements.sendButtonElement.disabled).toBe(true);
      await mockExamineButton.click();
      expect(renderer.selectedAction).toEqual(actionToSelect);
      expect(renderer.elements.sendButtonElement.disabled).toBe(false);
      expect(mockVed.dispatch).not.toHaveBeenCalled();
      expect(mockExamineButton.classList.add).toHaveBeenCalledWith('selected');
    });

    it('should update selection and button states when a different action is clicked', async () => {
      const action1 = createTestComposite(
        1,
        'test:action1',
        'Perform Action 1',
        'Description for Action 1.'
      );
      const action2 = createTestComposite(
        2,
        'test:action2',
        'Perform Action 2',
        'Description for Action 2.'
      );
      const actions = [action1, action2];
      const testActorId = 'player1';
      let mockButton1, mockButton2;

      mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
        const btn = createMockElement(
          document,
          'button',
          '',
          cls ? cls.split(' ') : [],
          text
        );
        if (text === action1.commandString) mockButton1 = btn;
        else if (text === action2.commandString) mockButton2 = btn;
        return btn;
      });
      await simulateUpdateActionsEventForCurrentRenderer(testActorId, actions);
      expect(mockButton1).toBeDefined();
      expect(mockButton2).toBeDefined();
      if (!mockButton1 || !mockButton2) return;

      await mockButton1.click();
      expect(renderer.selectedAction).toEqual(action1);
      expect(mockButton1.classList.add).toHaveBeenCalledWith('selected');
      expect(renderer.elements.sendButtonElement.disabled).toBe(false);
      mockButton1.classList.add.mockClear();

      await mockButton2.click();
      expect(renderer.selectedAction).toEqual(action2);
      expect(mockButton1.classList.remove).toHaveBeenCalledWith('selected');
      expect(mockButton2.classList.add).toHaveBeenCalledWith('selected');
      expect(renderer.elements.sendButtonElement.disabled).toBe(false);
    });

    it('should deselect action if the same selected action button is clicked again', async () => {
      const actionToSelect = createTestComposite(
        1,
        'test:examine',
        'examine test object',
        'Detailed examination.'
      );
      const actions = [actionToSelect];
      const testActorId = 'player1';
      let mockExamineButton;
      mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
        const btn = createMockElement(
          document,
          'button',
          '',
          cls ? cls.split(' ') : [],
          text
        );
        if (text === actionToSelect.commandString) mockExamineButton = btn;
        return btn;
      });

      await simulateUpdateActionsEventForCurrentRenderer(testActorId, actions);
      expect(mockExamineButton).toBeDefined();
      if (!mockExamineButton) return;
      await mockExamineButton.click(); // First click - select
      expect(renderer.selectedAction).toEqual(actionToSelect);
      expect(mockExamineButton.classList.add).toHaveBeenCalledWith('selected');
      expect(renderer.elements.sendButtonElement.disabled).toBe(false);

      mockExamineButton.classList.remove.mockClear(); // Clear remove mock before second click

      await mockExamineButton.click(); // Second click - deselect
      expect(renderer.selectedAction).toBeNull();
      expect(mockExamineButton.classList.remove).toHaveBeenCalledWith(
        'selected'
      );
      expect(renderer.elements.sendButtonElement.disabled).toBe(true);
    });

    it('should call dispatch, then log error, when dispatch returns false (send button click)', async () => {
      mockVed.dispatch.mockResolvedValue(false);
      const action = createTestComposite(
        1,
        'test:inv',
        'open inventory',
        'Opens the player inventory.'
      );
      const actions = [action];
      const testActorId = 'player-inventory';
      let mockActionButton;
      mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
        const btn = createMockElement(
          document,
          'button',
          '',
          cls ? cls.split(' ') : [],
          text
        );
        if (text === action.commandString) mockActionButton = btn;
        return btn;
      });

      await simulateUpdateActionsEventForCurrentRenderer(testActorId, actions);
      expect(mockActionButton).toBeDefined();
      if (!mockActionButton) return;

      await mockActionButton.click(); // Select the action
      expect(renderer.selectedAction).toEqual(action);
      expect(renderer.elements.sendButtonElement.disabled).toBe(false);

      await mockSendButton.click(); // Click the main send button (from global setup)

      expect(mockVed.dispatch).toHaveBeenCalledWith(
        PLAYER_TURN_SUBMITTED_ID,
        expect.objectContaining({
          submittedByActorId: testActorId,
          chosenIndex: action.index,
        })
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `${CLASS_PREFIX} Failed to dispatch '${PLAYER_TURN_SUBMITTED_ID}' for action index '${action.index}'.`
        ),
        expect.objectContaining({ payload: expect.anything() })
      );
      expect(renderer.selectedAction).toEqual(action);
      expect(renderer.elements.sendButtonElement.disabled).toBe(false);
    });

    it('should call dispatch, then log error, when dispatch throws (send button click)', async () => {
      const testError = new Error('Dispatch failed');
      mockVed.dispatch.mockRejectedValue(testError);
      const action = createTestComposite(
        1,
        'test:help',
        'get help',
        'Displays help information.'
      );
      const actions = [action];
      const testActorId = 'player-help';
      let mockActionButton;
      mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
        const btn = createMockElement(
          document,
          'button',
          '',
          cls ? cls.split(' ') : [],
          text
        );
        if (text === action.commandString) mockActionButton = btn;
        return btn;
      });

      await simulateUpdateActionsEventForCurrentRenderer(testActorId, actions);
      expect(mockActionButton).toBeDefined();
      if (!mockActionButton) return;

      await mockActionButton.click(); // Select the action
      expect(renderer.selectedAction).toEqual(action);
      expect(renderer.elements.sendButtonElement.disabled).toBe(false);

      await mockSendButton.click(); // Click the main send button

      expect(mockVed.dispatch).toHaveBeenCalledWith(
        PLAYER_TURN_SUBMITTED_ID,
        expect.objectContaining({
          submittedByActorId: testActorId,
          chosenIndex: action.index,
        })
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `${CLASS_PREFIX} Exception during dispatch for '${PLAYER_TURN_SUBMITTED_ID}'.`
        ),
        expect.objectContaining({
          error: testError,
          payload: expect.anything(),
        })
      );
      expect(renderer.selectedAction).toEqual(action);
      expect(renderer.elements.sendButtonElement.disabled).toBe(false);
    });

    it('should select action and not dispatch, even if button textContent is empty at time of click (selection based on actionId)', async () => {
      const actionId = 'test:action1';
      const initialCommand = 'action1 command';
      const action = createTestComposite(
        1,
        actionId,
        initialCommand,
        'Desc for action1'
      );
      const actions = [action];
      const testActorId = 'player1';
      let mockActionButton;
      mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
        const btn = createMockElement(
          document,
          'button',
          '',
          cls ? cls.split(' ') : [],
          text
        );
        if (text === initialCommand) {
          mockActionButton = btn;
        }
        return btn;
      });

      await simulateUpdateActionsEventForCurrentRenderer(testActorId, actions);
      expect(mockActionButton).toBeDefined();
      if (!mockActionButton) return;

      expect(mockActionButton.textContent).toBe(initialCommand);
      expect(mockActionButton.getAttribute('data-action-index')).toBe('1');
      expect(renderer.elements.sendButtonElement.disabled).toBe(true);

      mockActionButton.textContent = ''; // Simulate text content change
      await mockActionButton.click(); // Click the action button itself

      expect(mockVed.dispatch).not.toHaveBeenCalled();
      expect(renderer.selectedAction).toEqual(action);
      expect(renderer.elements.sendButtonElement.disabled).toBe(false);
    });
  });
});
