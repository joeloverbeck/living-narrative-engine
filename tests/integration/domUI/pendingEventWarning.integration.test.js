// tests/integration/domUI/pendingEventWarning.integration.test.js

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

describe('Pending Event Warning - Integration Tests', () => {
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
    if (tagName === 'input' || tagName === 'textarea') {
      let currentValue = textContent || '';
      Object.defineProperty(element, 'value', {
        get: () => currentValue,
        set: (val) => {
          currentValue = String(val);
        },
        configurable: true,
      });
      if (tagName === 'input') {
        element.type = 'text';
      }
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

    dom = new JSDOM(`<!DOCTYPE html><html><body>
            <div id="game-container">
                <div id="action-buttons"></div>
                <button id="player-confirm-turn-button"></button>
                <input type="text" id="speech-input" />
                <div id="perceptible-event-sender-panel">
                    <textarea id="perceptible-event-message"></textarea>
                    <button id="send-perceptible-event-button">Send Event</button>
                    <div id="perceptible-event-status" class="status-message-area" role="status" aria-live="polite"></div>
                </div>
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

  describe('Full workflow integration', () => {
    const actionToSubmit = createTestComposite(
      1,
      'core:test_action',
      'Test Action',
      'A test action for integration tests.'
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

      jest.clearAllMocks();
    });

    afterEach(() => {
      if (renderer) {
        renderer.dispose();
      }
    });

    it('should block action when message is pending', async () => {
      // Arrange: Set pending message
      perceptibleEventMessage.value = 'A pending event message to be sent';
      mockVed.dispatch.mockResolvedValue(true);

      // Act: Try to confirm action
      await globalMockSendButton.click();

      // Assert: Action should NOT be dispatched
      expect(mockVed.dispatch).not.toHaveBeenCalled();

      // Assert: Warning should be shown
      expect(perceptibleEventStatus.textContent).toBe(
        'Event message waiting for dispatch. Please send or clear before confirming action.'
      );
      expect(perceptibleEventStatus.className).toBe(
        'status-message-area warning'
      );
    });

    it('should allow action after clearing the message', async () => {
      // Arrange: Set then clear pending message
      perceptibleEventMessage.value = 'A pending event message';

      // First attempt - should block
      await globalMockSendButton.click();
      expect(mockVed.dispatch).not.toHaveBeenCalled();

      // Clear the message
      perceptibleEventMessage.value = '';
      jest.clearAllMocks();

      // Act: Try to confirm action again
      await globalMockSendButton.click();

      // Assert: Action should be dispatched
      expect(mockVed.dispatch).toHaveBeenCalledTimes(1);
      expect(mockVed.dispatch).toHaveBeenCalledWith(
        PLAYER_TURN_SUBMITTED_ID,
        expect.objectContaining({
          submittedByActorId: MOCK_ACTOR_ID,
          chosenIndex: actionToSubmit.index,
        })
      );
    });

    it('should allow action when message contains only whitespace', async () => {
      // Arrange: Set whitespace-only message
      perceptibleEventMessage.value = '   \n\t   ';
      mockVed.dispatch.mockResolvedValue(true);

      // Act: Try to confirm action
      await globalMockSendButton.click();

      // Assert: Action should be dispatched (whitespace is not considered pending)
      expect(mockVed.dispatch).toHaveBeenCalledTimes(1);
      expect(mockVed.dispatch).toHaveBeenCalledWith(
        PLAYER_TURN_SUBMITTED_ID,
        expect.objectContaining({
          submittedByActorId: MOCK_ACTOR_ID,
          chosenIndex: actionToSubmit.index,
        })
      );
    });

    it('should auto-clear warning and allow subsequent action confirmation', async () => {
      // Arrange: Set pending message and trigger warning
      perceptibleEventMessage.value = 'Pending message';
      await globalMockSendButton.click();

      expect(perceptibleEventStatus.textContent).toContain(
        'Event message waiting for dispatch'
      );

      // Wait for auto-clear
      jest.advanceTimersByTime(5000);

      // Verify warning is cleared
      expect(perceptibleEventStatus.textContent).toBe('');
      expect(perceptibleEventStatus.className).toBe('status-message-area');

      // Clear the pending message
      perceptibleEventMessage.value = '';
      jest.clearAllMocks();

      // Act: Confirm action now
      await globalMockSendButton.click();

      // Assert: Action should be dispatched
      expect(mockVed.dispatch).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple blocked attempts correctly', async () => {
      // Arrange: Set pending message
      perceptibleEventMessage.value = 'Pending message';

      // Act: Try to confirm action multiple times
      await globalMockSendButton.click();
      await globalMockSendButton.click();
      await globalMockSendButton.click();

      // Assert: Action should never be dispatched
      expect(mockVed.dispatch).not.toHaveBeenCalled();

      // Warning should still be visible (timeout keeps resetting)
      expect(perceptibleEventStatus.textContent).toContain(
        'Event message waiting for dispatch'
      );
    });

    it('should not interfere with normal action confirmation flow when no pending message', async () => {
      // Arrange: No pending message
      perceptibleEventMessage.value = '';
      mockVed.dispatch.mockResolvedValue(true);

      // Act: Confirm action
      await globalMockSendButton.click();

      // Assert: Action should be dispatched normally
      expect(mockVed.dispatch).toHaveBeenCalledTimes(1);
      expect(mockVed.dispatch).toHaveBeenCalledWith(
        PLAYER_TURN_SUBMITTED_ID,
        expect.objectContaining({
          submittedByActorId: MOCK_ACTOR_ID,
          chosenIndex: actionToSubmit.index,
        })
      );

      // No warning should be shown
      expect(perceptibleEventStatus.textContent).toBe('');
    });
  });

  describe('DOM element resilience', () => {
    const actionToSubmit = createTestComposite(
      1,
      'core:test_action',
      'Test Action',
      'A test action.'
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
      updateActionsHandler = subscribeCall[1];

      await updateActionsHandler({
        type: 'core:update_available_actions',
        payload: { actorId: MOCK_ACTOR_ID, actions: actions },
      });

      await actionButtonInstance.click();
      jest.clearAllMocks();
    });

    afterEach(() => {
      if (renderer) {
        renderer.dispose();
      }
    });

    it('should allow action when perceptible-event-message element is removed from DOM', async () => {
      // Arrange: Remove the message element
      perceptibleEventMessage.remove();
      mockVed.dispatch.mockResolvedValue(true);

      // Act: Confirm action
      await globalMockSendButton.click();

      // Assert: Action should proceed (graceful degradation)
      expect(mockVed.dispatch).toHaveBeenCalledTimes(1);
    });

    it('should block action but handle missing status area gracefully', async () => {
      // Arrange: Remove status area but keep message with content
      perceptibleEventStatus.remove();
      perceptibleEventMessage.value = 'Pending message';

      // Act: Try to confirm action
      await globalMockSendButton.click();

      // Assert: Action should still be blocked
      expect(mockVed.dispatch).not.toHaveBeenCalled();

      // Debug log should indicate blocking
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Action confirmation blocked')
      );
    });
  });
});
