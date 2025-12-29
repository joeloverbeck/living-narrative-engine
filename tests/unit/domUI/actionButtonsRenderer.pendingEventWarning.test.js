// tests/unit/domUI/actionButtonsRenderer.pendingEventWarning.test.js

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import { ActionButtonsRenderer } from '../../../src/domUI';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../../src/constants/eventIds.js';

jest.mock('../../../src/logging/consoleLogger.js');
jest.mock('../../../src/events/validatedEventDispatcher.js');
jest.mock('../../../src/domUI/domElementFactory.js');

describe('ActionButtonsRenderer - Pending Event Warning', () => {
  let dom;
  let currentDocument;
  let docContext;
  let mockLogger;
  let mockVed;
  let mockDomElementFactoryInstance;
  let actionButtonsContainer;
  let globalMockSendButton;
  let perceptibleEventMessage;
  let perceptibleEventStatus;

  const MOCK_ACTOR_ID = 'test-actor-id';

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
    }

    if (classesParam && classesParam.length > 0) {
      element.classList.add(...classesParam);
    }

    element._listeners = {};

    element.addEventListener = jest.fn((event, cb) => {
      if (!element._listeners[event]) element._listeners[event] = [];
      element._listeners[event].push(cb);
    });

    element.click = jest.fn(async () => {
      const listeners = element._listeners
        ? element._listeners['click'] || []
        : [];
      for (const listener of listeners) {
        await listener();
      }
    });

    if (tagName === 'button' || tagName === 'input') {
      let isDisabled = false;
      Object.defineProperty(element, 'disabled', {
        get: () => isDisabled,
        set: (value) => {
          isDisabled = !!value;
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

  const mockActionCategorizationService = {
    extractNamespace: jest.fn().mockImplementation((actionId) => {
      return actionId.split(':')[0] || 'core';
    }),
    shouldUseGrouping: jest.fn().mockReturnValue(false),
    groupActionsByNamespace: jest.fn().mockReturnValue(new Map()),
    getSortedNamespaces: jest.fn().mockReturnValue([]),
    formatNamespaceDisplayName: jest.fn().mockImplementation((namespace) => {
      return namespace.toUpperCase();
    }),
    shouldShowCounts: jest.fn(() => false),
  };

  const createRendererUnderTest = (rendererConfig = {}) => {
    const defaults = {
      logger: mockLogger,
      documentContext: docContext,
      validatedEventDispatcher: mockVed,
      domElementFactory: mockDomElementFactoryInstance,
      actionButtonsContainerSelector: '#action-buttons',
      sendButtonSelector: '#player-confirm-turn-button',
      speechInputSelector: '#speech-input',
      actionCategorizationService: mockActionCategorizationService,
    };
    return new ActionButtonsRenderer({ ...defaults, ...rendererConfig });
  };

  beforeEach(() => {
    jest.useFakeTimers();

    // DOM now includes the perceptible event elements
    dom = new JSDOM(`<!DOCTYPE html><html><body>
            <div id="game-container">
                <div id="action-buttons"></div>
                <button id="player-confirm-turn-button"></button>
                <input type="text" id="speech-input" />
                <textarea id="perceptible-event-message"></textarea>
                <div id="perceptible-event-status" class="status-message-area"></div>
            </div>
        </body></html>`);
    currentDocument = dom.window.document;
    global.document = currentDocument;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;
    global.HTMLInputElement = dom.window.HTMLInputElement;

    docContext = new DocumentContext(currentDocument);
    mockLogger = new ConsoleLogger();
    mockVed = new ValidatedEventDispatcher({});
    mockDomElementFactoryInstance = new DomElementFactory(docContext);

    mockVed.subscribe.mockReturnValue({ unsubscribe: jest.fn() });
    mockVed.dispatch.mockResolvedValue(true);
    mockDomElementFactoryInstance.button.mockImplementation((text, cls) =>
      createMockElement(
        currentDocument,
        'button',
        '',
        Array.isArray(cls) ? cls : cls ? cls.split(' ') : [],
        text
      )
    );

    actionButtonsContainer = currentDocument.getElementById('action-buttons');
    jest.spyOn(actionButtonsContainer.classList, 'add');
    jest.spyOn(actionButtonsContainer.classList, 'remove');
    actionButtonsContainer._listeners = {};
    jest
      .spyOn(actionButtonsContainer, 'addEventListener')
      .mockImplementation((event, cb) => {
        if (!actionButtonsContainer._listeners[event]) {
          actionButtonsContainer._listeners[event] = [];
        }
        actionButtonsContainer._listeners[event].push(cb);
      });

    globalMockSendButton = currentDocument.getElementById(
      'player-confirm-turn-button'
    );
    perceptibleEventMessage = currentDocument.getElementById(
      'perceptible-event-message'
    );
    perceptibleEventStatus = currentDocument.getElementById(
      'perceptible-event-status'
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (dom) {
      dom.window.close();
    }
  });

  describe('#checkPendingPerceptibleEvent', () => {
    const actionToSubmit = createTestComposite(
      1,
      'core:test_action',
      'Test Action',
      'A test action for pending event warning tests.'
    );
    const actions = [actionToSubmit];
    let renderer;
    let actionButtonInstance;
    let updateActionsHandler;

    beforeEach(async () => {
      actionButtonInstance = undefined;

      mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
        const btn = createMockElement(
          currentDocument,
          'button',
          '',
          cls ? cls.split(' ') : [],
          text
        );
        if (text === actionToSubmit.commandString) {
          actionButtonInstance = btn;
        }
        return btn;
      });

      renderer = createRendererUnderTest();
      // Advance fake timers to settle constructor's async refreshList
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      const subscribeCall = mockVed.subscribe.mock.calls.find(
        (call) => call[0] === 'core:update_available_actions'
      );
      if (!subscribeCall || !subscribeCall[1]) {
        throw new Error('Test setup failed: Renderer did not subscribe.');
      }
      updateActionsHandler = subscribeCall[1];

      await updateActionsHandler({
        type: 'core:update_available_actions',
        payload: { actorId: MOCK_ACTOR_ID, actions: actions },
      });

      if (!actionButtonInstance) {
        throw new Error(
          `Test setup error: actionButtonInstance for command '${actionToSubmit.commandString}' was not created.`
        );
      }

      // Select the action
      await actionButtonInstance.click();
      if (renderer.selectedAction?.index !== actionToSubmit.index) {
        throw new Error(
          `Test setup error: Expected action to be selected, but got ${JSON.stringify(renderer.selectedAction)}`
        );
      }
      if (globalMockSendButton.disabled) {
        throw new Error(
          'Test setup error: Expected send button to be enabled'
        );
      }

      jest.clearAllMocks();
    });

    it('should return false and allow action when message input is empty', async () => {
      perceptibleEventMessage.value = '';
      mockVed.dispatch.mockResolvedValue(true);

      await globalMockSendButton.click();

      expect(mockVed.dispatch).toHaveBeenCalledTimes(1);
      expect(mockVed.dispatch).toHaveBeenCalledWith(
        PLAYER_TURN_SUBMITTED_ID,
        expect.objectContaining({
          submittedByActorId: MOCK_ACTOR_ID,
          chosenIndex: actionToSubmit.index,
        })
      );
    });

    it('should return false and allow action when message contains only whitespace', async () => {
      perceptibleEventMessage.value = '   \n\t  ';
      mockVed.dispatch.mockResolvedValue(true);

      await globalMockSendButton.click();

      expect(mockVed.dispatch).toHaveBeenCalledTimes(1);
      expect(mockVed.dispatch).toHaveBeenCalledWith(
        PLAYER_TURN_SUBMITTED_ID,
        expect.objectContaining({
          submittedByActorId: MOCK_ACTOR_ID,
          chosenIndex: actionToSubmit.index,
        })
      );
    });

    it('should return true and block action when message has content', async () => {
      perceptibleEventMessage.value = 'A pending event message';
      mockVed.dispatch.mockResolvedValue(true);

      await globalMockSendButton.click();

      expect(mockVed.dispatch).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Action confirmation blocked')
      );
    });

    it('should return false gracefully when perceptible-event-message element not found', async () => {
      // Remove the message element from DOM
      perceptibleEventMessage.remove();
      mockVed.dispatch.mockResolvedValue(true);

      await globalMockSendButton.click();

      // Action should proceed normally
      expect(mockVed.dispatch).toHaveBeenCalledTimes(1);
      expect(mockVed.dispatch).toHaveBeenCalledWith(
        PLAYER_TURN_SUBMITTED_ID,
        expect.objectContaining({
          submittedByActorId: MOCK_ACTOR_ID,
          chosenIndex: actionToSubmit.index,
        })
      );
    });
  });

  describe('#showPendingEventWarning', () => {
    const actionToSubmit = createTestComposite(
      1,
      'core:test_action',
      'Test Action',
      'A test action for pending event warning tests.'
    );
    const actions = [actionToSubmit];
    let renderer;
    let actionButtonInstance;
    let updateActionsHandler;

    beforeEach(async () => {
      actionButtonInstance = undefined;

      mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
        const btn = createMockElement(
          currentDocument,
          'button',
          '',
          cls ? cls.split(' ') : [],
          text
        );
        if (text === actionToSubmit.commandString) {
          actionButtonInstance = btn;
        }
        return btn;
      });

      renderer = createRendererUnderTest();
      // Advance fake timers to settle constructor's async refreshList
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      const subscribeCall = mockVed.subscribe.mock.calls.find(
        (call) => call[0] === 'core:update_available_actions'
      );
      if (!subscribeCall || !subscribeCall[1]) {
        throw new Error('Test setup failed: Renderer did not subscribe.');
      }
      updateActionsHandler = subscribeCall[1];

      await updateActionsHandler({
        type: 'core:update_available_actions',
        payload: { actorId: MOCK_ACTOR_ID, actions: actions },
      });

      if (!actionButtonInstance) {
        throw new Error(
          `Test setup error: actionButtonInstance for command '${actionToSubmit.commandString}' was not created.`
        );
      }

      await actionButtonInstance.click();
      if (renderer.selectedAction?.index !== actionToSubmit.index) {
        throw new Error(
          `Test setup error: Expected action to be selected, but got ${JSON.stringify(renderer.selectedAction)}`
        );
      }

      jest.clearAllMocks();
    });

    it('should display warning message in status area', async () => {
      perceptibleEventMessage.value = 'Pending message';

      await globalMockSendButton.click();

      expect(perceptibleEventStatus.textContent).toBe(
        'Event message waiting for dispatch. Please send or clear before confirming action.'
      );
    });

    it('should add warning class to status area', async () => {
      perceptibleEventMessage.value = 'Pending message';

      await globalMockSendButton.click();

      expect(perceptibleEventStatus.className).toBe(
        'status-message-area warning'
      );
    });

    it('should auto-clear warning after 5 seconds', async () => {
      perceptibleEventMessage.value = 'Pending message';

      await globalMockSendButton.click();

      expect(perceptibleEventStatus.textContent).toBe(
        'Event message waiting for dispatch. Please send or clear before confirming action.'
      );

      // Advance timers by 5 seconds
      jest.advanceTimersByTime(5000);

      expect(perceptibleEventStatus.textContent).toBe('');
      expect(perceptibleEventStatus.className).toBe('status-message-area');
    });

    it('should clear previous timeout when showing new warning', async () => {
      perceptibleEventMessage.value = 'First message';

      await globalMockSendButton.click();

      expect(perceptibleEventStatus.textContent).toContain(
        'Event message waiting for dispatch'
      );

      // Advance by 3 seconds (less than 5)
      jest.advanceTimersByTime(3000);

      // Trigger again
      perceptibleEventMessage.value = 'Second message';
      await globalMockSendButton.click();

      // Advance by 3 more seconds (total 6 from first click, but only 3 from second)
      jest.advanceTimersByTime(3000);

      // Should still show warning (second timeout not expired yet)
      expect(perceptibleEventStatus.textContent).toContain(
        'Event message waiting for dispatch'
      );

      // Advance by 2 more seconds (now 5 seconds from second click)
      jest.advanceTimersByTime(2000);

      // Now it should be cleared
      expect(perceptibleEventStatus.textContent).toBe('');
    });

    it('should handle missing status area gracefully and still block action', async () => {
      // Remove the status area element
      perceptibleEventStatus.remove();
      perceptibleEventMessage.value = 'Pending message';

      await globalMockSendButton.click();

      // Action should still be blocked
      expect(mockVed.dispatch).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Action confirmation blocked')
      );
    });
  });

  describe('dispose cleanup', () => {
    const actionToSubmit = createTestComposite(
      1,
      'core:test_action',
      'Test Action',
      'A test action for dispose tests.'
    );
    const actions = [actionToSubmit];
    let renderer;
    let actionButtonInstance;
    let updateActionsHandler;

    beforeEach(async () => {
      actionButtonInstance = undefined;

      mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
        const btn = createMockElement(
          currentDocument,
          'button',
          '',
          cls ? cls.split(' ') : [],
          text
        );
        if (text === actionToSubmit.commandString) {
          actionButtonInstance = btn;
        }
        return btn;
      });

      renderer = createRendererUnderTest();
      // Advance fake timers to settle constructor's async refreshList
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      const subscribeCall = mockVed.subscribe.mock.calls.find(
        (call) => call[0] === 'core:update_available_actions'
      );
      if (!subscribeCall || !subscribeCall[1]) {
        throw new Error('Test setup failed: Renderer did not subscribe.');
      }
      updateActionsHandler = subscribeCall[1];

      await updateActionsHandler({
        type: 'core:update_available_actions',
        payload: { actorId: MOCK_ACTOR_ID, actions: actions },
      });

      if (!actionButtonInstance) {
        throw new Error(
          `Test setup error: actionButtonInstance for command '${actionToSubmit.commandString}' was not created.`
        );
      }

      await actionButtonInstance.click();
      jest.clearAllMocks();
    });

    it('should clear pending event warning timeout on dispose', async () => {
      perceptibleEventMessage.value = 'Pending message';

      // Trigger warning (starts a timeout)
      await globalMockSendButton.click();
      expect(perceptibleEventStatus.textContent).toContain(
        'Event message waiting for dispatch'
      );

      // Spy on clearTimeout to verify it's called
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      // Dispose the renderer
      renderer.dispose();

      // Verify clearTimeout was called (cleanup happened)
      expect(clearTimeoutSpy).toHaveBeenCalled();

      // Advance timers - should not affect status area since timeout was cleared
      // (Note: In real scenario, disposing would also remove DOM elements,
      // but we're specifically testing the timeout cleanup here)
    });
  });
});
