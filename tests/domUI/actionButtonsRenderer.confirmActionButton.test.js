// tests/domUI/actionButtonsRenderer.confirmActionButton.test.js

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import { ActionButtonsRenderer } from '../../src/domUI';
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../src/logging/consoleLogger.js';
import ValidatedEventDispatcher from '../../src/events/validatedEventDispatcher.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../src/constants/eventIds.js';

jest.mock('../../src/logging/consoleLogger.js');
jest.mock('../../src/events/validatedEventDispatcher.js');
jest.mock('../../src/domUI/domElementFactory.js');

describe('ActionButtonsRenderer', () => {
  let dom;
  let currentDocument;
  let docContext;
  let mockLogger;
  let mockVed;
  let mockDomElementFactoryInstance;
  let actionButtonsContainer; // This is the actual HTMLElement
  let globalMockSendButton;
  let commandInputElement;

  const CLASS_PREFIX = '[ActionButtonsRenderer]';
  const MOCK_ACTOR_ID = 'test-actor-id';

  const createTestAction = (id, name, command, description) => ({
    id,
    name,
    command,
    description,
  });

  const createMockElement = (
    sourceDoc,
    tagName = 'div',
    id = '',
    classesParam = [],
    textContent = ''
  ) => {
    const element = sourceDoc.createElement(tagName);
    if (id) element.id = id;
    element.textContent = textContent;

    if (element.classList) {
      jest.spyOn(element.classList, 'add');
      jest.spyOn(element.classList, 'remove');
      jest.spyOn(element.classList, 'contains');
      jest.spyOn(element.classList, 'toggle');
    } else {
      element.classList = {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn().mockReturnValue(false),
        toggle: jest.fn(),
        length: 0,
        toString: () => '',
      };
    }

    if (classesParam && classesParam.length > 0) {
      element.classList.add(...classesParam);
    }

    element._attributes = {};
    element._listeners = {};

    element.addEventListener = jest.fn((event, cb) => {
      if (!element._listeners[event]) element._listeners[event] = [];
      element._listeners[event].push(cb);
    });
    element.removeEventListener = jest.fn((name, cb) => {
      if (element._listeners && element._listeners[name]) {
        element._listeners[name] = element._listeners[name].filter(
          (fn) => fn !== cb
        );
      }
    });
    element.click = jest.fn(async () => {
      const listeners = element._listeners
        ? element._listeners['click'] || []
        : [];
      for (const listener of listeners) {
        await listener();
      }
    });

    const originalSetAttribute = element.setAttribute.bind(element);
    jest.spyOn(element, 'setAttribute').mockImplementation((name, value) => {
      originalSetAttribute(name, value);
      element._attributes[name] = value;
    });

    const originalGetAttribute = element.getAttribute.bind(element);
    jest.spyOn(element, 'getAttribute').mockImplementation((name) => {
      if (name === 'data-action-id' && name in element._attributes)
        return element._attributes[name];
      if (
        name in element._attributes &&
        !(name === 'class' || name === 'style')
      )
        return element._attributes[name];
      return originalGetAttribute(name);
    });

    const originalRemoveAttribute = element.removeAttribute.bind(element);
    jest.spyOn(element, 'removeAttribute').mockImplementation((name) => {
      originalRemoveAttribute(name);
      delete element._attributes[name];
    });

    jest.spyOn(element, 'remove');

    if (tagName === 'button' || tagName === 'input') {
      let isDisabled = false;
      Object.defineProperty(element, 'disabled', {
        get: () => isDisabled,
        set: (value) => {
          isDisabled = !!value;
          if (isDisabled) originalSetAttribute('disabled', '');
          else originalRemoveAttribute('disabled');
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
      element.type = 'text';
    }
    return element;
  };

  // Define createRendererUnderTest in the scope of the outer 'describe'
  const createRendererUnderTest = (rendererConfig = {}, customDocContext) => {
    const defaults = {
      logger: mockLogger,
      documentContext: customDocContext || docContext,
      validatedEventDispatcher: mockVed,
      domElementFactory: mockDomElementFactoryInstance,
      actionButtonsContainerSelector: '#action-buttons',
    };
    return new ActionButtonsRenderer({ ...defaults, ...rendererConfig });
  };

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
            <div id="game-container">
                <div id="action-buttons"></div>
                <button id="player-confirm-turn-button"></button>
                <input type="text" id="speech-input" />
            </div>
        </body></html>`);
    currentDocument = dom.window.document;
    global.document = currentDocument;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;
    global.HTMLInputElement = dom.window.HTMLInputElement;

    jest.clearAllMocks(); // Clear all mocks at the beginning

    // Initialize mocks that createRendererUnderTest might depend on
    docContext = new DocumentContext(currentDocument);
    mockLogger = new ConsoleLogger(); // New instance for each test
    mockVed = new ValidatedEventDispatcher({}); // New instance for each test
    mockDomElementFactoryInstance = new DomElementFactory(docContext); // New instance

    // Mock implementations for factory and VED
    mockVed.subscribe.mockReturnValue({ unsubscribe: jest.fn() });
    mockVed.dispatchValidated.mockResolvedValue(true); // Default to success
    mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
      const classesArray = Array.isArray(cls)
        ? cls
        : cls
          ? cls.split(' ').filter((c) => c)
          : [];
      return createMockElement(
        currentDocument,
        'button',
        '',
        classesArray,
        text
      );
    });
    mockDomElementFactoryInstance.create.mockImplementation((tagName) =>
      currentDocument.createElement(tagName)
    );

    actionButtonsContainer = currentDocument.getElementById('action-buttons');
    if (!actionButtonsContainer) {
      throw new Error(
        'Critical Test Setup Failed: #action-buttons container not found in JSDOM.'
      );
    }
    jest.spyOn(actionButtonsContainer, 'appendChild');
    jest.spyOn(actionButtonsContainer, 'removeChild');

    const sendButtonOriginal = currentDocument.getElementById(
      'player-confirm-turn-button'
    );
    globalMockSendButton = createMockElement(
      currentDocument,
      'button',
      'player-confirm-turn-button'
    );
    if (sendButtonOriginal && sendButtonOriginal.parentNode) {
      sendButtonOriginal.parentNode.replaceChild(
        globalMockSendButton,
        sendButtonOriginal
      );
    } else {
      currentDocument.body.appendChild(globalMockSendButton);
    }

    const commandInputOriginal = currentDocument.getElementById('speech-input');
    commandInputElement = createMockElement(
      currentDocument,
      'input',
      'speech-input',
      [],
      ''
    );
    commandInputElement.type = 'text';
    if (commandInputOriginal && commandInputOriginal.parentNode) {
      commandInputOriginal.parentNode.replaceChild(
        commandInputElement,
        commandInputOriginal
      );
    } else {
      currentDocument.body.appendChild(commandInputElement);
    }
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
      dom = null;
    }
    currentDocument = null;
  });

  describe('Confirm Action Button (#handleSendAction)', () => {
    const actionToSubmit = createTestAction(
      'core:submit_me',
      'Submit Action',
      'Submit This',
      'This action will be submitted for testing.'
    );
    const actions = [actionToSubmit];
    let rendererForDescribeBlock;
    let actionButtonInstance;
    let specificTestDocContext;

    beforeEach(async () => {
      actionButtonInstance = undefined;
      specificTestDocContext = {
        ...docContext,
        query: jest.fn((selector) => {
          if (selector === '#speech-input') return commandInputElement;
          if (selector === '#player-confirm-turn-button')
            return globalMockSendButton;
          if (selector === '#action-buttons') return actionButtonsContainer;
          return currentDocument.querySelector(selector);
        }),
        getElementById: jest.fn((id) => {
          if (id === 'speech-input') return commandInputElement;
          if (id === 'player-confirm-turn-button') return globalMockSendButton;
          if (id === 'action-buttons') return actionButtonsContainer;
          return currentDocument.getElementById(id);
        }),
        create: jest.fn((tagName) => currentDocument.createElement(tagName)),
      };

      mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
        const classesArray = Array.isArray(cls)
          ? cls
          : cls
            ? cls.split(' ').filter((c) => c)
            : [];
        const btn = createMockElement(
          currentDocument,
          'button',
          '',
          classesArray,
          text
        );
        if (text === actionToSubmit.command) {
          actionButtonInstance = btn;
          btn.setAttribute('data-action-id', actionToSubmit.id);
        } else {
          const otherAction = actions.find((a) => a.command === text);
          if (otherAction) btn.setAttribute('data-action-id', otherAction.id);
        }
        return btn;
      });

      rendererForDescribeBlock = createRendererUnderTest(
        {},
        specificTestDocContext
      );

      if (
        typeof rendererForDescribeBlock._setTestCurrentActorId === 'function'
      ) {
        rendererForDescribeBlock._setTestCurrentActorId(MOCK_ACTOR_ID);
      } else {
        const updatePayload = { actorId: MOCK_ACTOR_ID, actions: actions };
        await rendererForDescribeBlock._handleUpdateActions({
          type: 'textUI:update_available_actions',
          payload: updatePayload,
        });
      }

      if (
        !rendererForDescribeBlock.availableActions ||
        rendererForDescribeBlock.availableActions.length === 0
      ) {
        rendererForDescribeBlock.availableActions = actions;
        await rendererForDescribeBlock.refreshList();
      }

      if (!actionButtonInstance) {
        console.error(
          'Action button instance for command',
          actionToSubmit.command,
          'was not created. Check renderer logic and action data.',
          actions
        );
        throw new Error(
          `Test setup error: actionButtonInstance for command '${actionToSubmit.command}' was not created. Ensure the action passes validation in #handleUpdateActions and is rendered.`
        );
      }

      ['info', 'error', 'debug', 'warn'].forEach((level) =>
        mockLogger[level].mockClear()
      );
      mockVed.dispatchValidated.mockClear();
      if (actionButtonInstance && actionButtonInstance.classList) {
        actionButtonInstance.classList.add.mockClear();
        actionButtonInstance.classList.remove.mockClear();
      }

      await actionButtonInstance.click();

      expect(rendererForDescribeBlock.selectedAction).toEqual(actionToSubmit);
      expect(globalMockSendButton.disabled).toBe(false);
      expect(actionButtonInstance.classList.add).toHaveBeenCalledWith(
        'selected'
      );

      ['info', 'error', 'debug', 'warn'].forEach((level) =>
        mockLogger[level].mockClear()
      );
      mockVed.dispatchValidated.mockClear();
      if (actionButtonInstance && actionButtonInstance.classList) {
        actionButtonInstance.classList.add.mockClear();
        actionButtonInstance.classList.remove.mockClear();
      }
    });

    it('should dispatch event with actionId and speech, clear speech, deselect, and disable send button on successful dispatch', async () => {
      commandInputElement.value = 'Player says this';
      mockVed.dispatchValidated.mockResolvedValue(true);

      await globalMockSendButton.click();

      expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
      expect(mockVed.dispatchValidated).toHaveBeenCalledWith(
        PLAYER_TURN_SUBMITTED_ID,
        {
          submittedByActorId: MOCK_ACTOR_ID,
          actionId: actionToSubmit.id,
          speech: 'Player says this',
        }
      );

      // SUT log: `${this._logPrefix} Event '${PLAYER_TURN_SUBMITTED_ID}' dispatched for action '${actionId}' by actor '${this.#currentActorId}'.`
      expect(mockLogger.debug).toHaveBeenCalledWith(
        // Ensuring the test matches the actual log format from SUT
        `${CLASS_PREFIX} Event '${PLAYER_TURN_SUBMITTED_ID}' dispatched for action '${actionToSubmit.id}' by actor '${MOCK_ACTOR_ID}'.`
      );
      expect(commandInputElement.value).toBe('');
      expect(rendererForDescribeBlock.selectedAction).toBeNull();
      expect(globalMockSendButton.disabled).toBe(true);

      if (
        actionButtonInstance &&
        actionButtonInstance.classList &&
        actionButtonInstance.classList.remove
      ) {
        expect(actionButtonInstance.classList.remove).toHaveBeenCalledWith(
          'selected'
        );
      } else {
        throw new Error(
          'actionButtonInstance or its classList.remove spy is not defined for assertion.'
        );
      }
    });

    it('should dispatch event with speech: null if speech input is empty', async () => {
      commandInputElement.value = '';
      mockVed.dispatchValidated.mockResolvedValue(true);
      await globalMockSendButton.click();
      expect(mockVed.dispatchValidated).toHaveBeenCalledWith(
        PLAYER_TURN_SUBMITTED_ID,
        {
          submittedByActorId: MOCK_ACTOR_ID,
          actionId: actionToSubmit.id,
          speech: null,
        }
      );
      expect(commandInputElement.value).toBe('');
    });

    it('should dispatch event with speech: null and log warning if speech input element is missing post-construction', async () => {
      const testSpecificSendButtonId = 'test-send-button-for-missing-speech';
      const testSpecificSendButton = createMockElement(
        currentDocument,
        'button',
        testSpecificSendButtonId
      );
      currentDocument.body.appendChild(testSpecificSendButton);

      const localDocContextNoSpeech = {
        ...specificTestDocContext,
        query: (selector) => {
          if (selector === '#speech-input') return null;
          if (selector === `#${testSpecificSendButtonId}`)
            return testSpecificSendButton;
          if (selector === '#action-buttons') return actionButtonsContainer;
          return currentDocument.querySelector(selector);
        },
        getElementById: (id) => {
          if (id === 'speech-input') return null;
          if (id === testSpecificSendButtonId) return testSpecificSendButton;
          return currentDocument.getElementById(id);
        },
      };

      const rendererForThisTest = createRendererUnderTest(
        {
          sendButtonSelector: `#${testSpecificSendButtonId}`,
        },
        localDocContextNoSpeech
      );

      if (typeof rendererForThisTest._setTestCurrentActorId === 'function') {
        rendererForThisTest._setTestCurrentActorId(MOCK_ACTOR_ID);
      } else {
        await rendererForThisTest._handleUpdateActions({
          type: 'textUI:update_available_actions',
          payload: { actorId: MOCK_ACTOR_ID, actions: [] },
        });
      }
      rendererForThisTest.selectedAction = actionToSubmit;

      if (rendererForThisTest.elements.sendButtonElement) {
        rendererForThisTest.elements.sendButtonElement.disabled = false;
      } else {
        throw new Error(
          `Test setup error: rendererForThisTest.elements.sendButtonElement not found using selector #${testSpecificSendButtonId}`
        );
      }

      mockLogger.warn.mockClear();
      mockLogger.debug.mockClear(); // Clear debug as well
      mockVed.dispatchValidated.mockClear().mockResolvedValue(true);

      await testSpecificSendButton.click();

      expect(mockVed.dispatchValidated).toHaveBeenCalledWith(
        PLAYER_TURN_SUBMITTED_ID,
        {
          submittedByActorId: MOCK_ACTOR_ID,
          actionId: actionToSubmit.id,
          speech: null,
        }
      );

      // SUT logs a debug message when speech input is not found:
      // this.logger.debug(`${this._logPrefix} No speech input element available.`);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${CLASS_PREFIX} No speech input element available.`
      );
      // Ensure no unexpected warnings related to speech input are logged
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining(
          "Speech input element (selector: '#speech-input') not found"
        )
      );

      currentDocument.body.removeChild(testSpecificSendButton);
    });

    it('should log error and not change UI state if dispatchValidated returns false', async () => {
      commandInputElement.value = 'Test speech';
      mockVed.dispatchValidated.mockResolvedValue(false);

      if (
        actionButtonInstance &&
        actionButtonInstance.classList &&
        actionButtonInstance.classList.remove
      ) {
        actionButtonInstance.classList.remove.mockClear();
      } else if (!actionButtonInstance) {
        throw new Error(
          'actionButtonInstance is not defined. Check test setup.'
        );
      }

      await globalMockSendButton.click();

      expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);

      // SUT log: `${this._logPrefix} Failed to dispatch '${PLAYER_TURN_SUBMITTED_ID}' for action '${actionId}'.`
      const expectedErrorPayload = {
        payload: {
          submittedByActorId: MOCK_ACTOR_ID,
          actionId: actionToSubmit.id,
          speech: 'Test speech',
        },
      };
      expect(mockLogger.error).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Failed to dispatch '${PLAYER_TURN_SUBMITTED_ID}' for action '${actionToSubmit.id}'.`,
        expectedErrorPayload
      );
      expect(commandInputElement.value).toBe('Test speech');
      expect(rendererForDescribeBlock.selectedAction).toEqual(actionToSubmit);
      expect(globalMockSendButton.disabled).toBe(false);

      if (
        actionButtonInstance &&
        actionButtonInstance.classList &&
        actionButtonInstance.classList.remove
      ) {
        expect(actionButtonInstance.classList.remove).not.toHaveBeenCalled();
      }
    });

    it('should log error and not change UI state if dispatchValidated throws an error', async () => {
      commandInputElement.value = 'Test speech again';
      const dispatchError = new Error('Network Error');
      mockVed.dispatchValidated.mockRejectedValue(dispatchError);

      if (
        actionButtonInstance &&
        actionButtonInstance.classList &&
        actionButtonInstance.classList.remove
      ) {
        actionButtonInstance.classList.remove.mockClear();
      } else if (!actionButtonInstance) {
        throw new Error(
          'actionButtonInstance is not defined. Check test setup.'
        );
      }

      await globalMockSendButton.click();

      expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
      // SUT log: `${this._logPrefix} Exception during dispatchValidated for '${PLAYER_TURN_SUBMITTED_ID}'.`
      const expectedErrorContext = {
        error: dispatchError,
        payload: {
          submittedByActorId: MOCK_ACTOR_ID,
          actionId: actionToSubmit.id,
          speech: 'Test speech again',
        },
      };
      expect(mockLogger.error).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Exception during dispatchValidated for '${PLAYER_TURN_SUBMITTED_ID}'.`,
        expectedErrorContext
      );
      expect(commandInputElement.value).toBe('Test speech again');
      expect(rendererForDescribeBlock.selectedAction).toEqual(actionToSubmit);
      expect(globalMockSendButton.disabled).toBe(false);

      if (
        actionButtonInstance &&
        actionButtonInstance.classList &&
        actionButtonInstance.classList.remove
      ) {
        expect(actionButtonInstance.classList.remove).not.toHaveBeenCalled();
      }
    });

    it('should do nothing and log warning if no action is selected when send button clicked', async () => {
      rendererForDescribeBlock.selectedAction = null;
      globalMockSendButton.disabled = false;

      await globalMockSendButton.click();

      expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
      // SUT log: `${this._logPrefix} 'Confirm Action' clicked, but no action is selected.`
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} 'Confirm Action' clicked, but no action is selected.`
      );
      expect(globalMockSendButton.disabled).toBe(true);
    });

    it('should log error if sendButtonElement is somehow null during #handleSendAction', async () => {
      expect(rendererForDescribeBlock.selectedAction).toEqual(actionToSubmit);
      globalMockSendButton.disabled = false;

      rendererForDescribeBlock.elements.sendButtonElement = null;

      await globalMockSendButton.click();

      // SUT log: `${this._logPrefix} #handleSendAction called, but sendButtonElement is null.`
      expect(mockLogger.error).toHaveBeenCalledWith(
        `${CLASS_PREFIX} #handleSendAction called, but sendButtonElement is null.`
      );
      expect(mockVed.dispatchValidated).not.toHaveBeenCalled();
    });
  });
});
