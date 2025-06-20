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
import { ActionButtonsRenderer } from '../../../src/domUI';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../../src/constants/eventIds.js';

jest.mock('../../../src/logging/consoleLogger.js');
jest.mock('../../../src/events/validatedEventDispatcher.js');
jest.mock('../../../src/domUI/domElementFactory.js');

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

  /**
   * CORRECTED: Use a helper that creates a valid ActionComposite object.
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

  const createRendererUnderTest = (rendererConfig = {}) => {
    const defaults = {
      logger: mockLogger,
      documentContext: docContext,
      validatedEventDispatcher: mockVed,
      domElementFactory: mockDomElementFactoryInstance,
      actionButtonsContainerSelector: '#action-buttons',
      sendButtonSelector: '#player-confirm-turn-button',
      speechInputSelector: '#speech-input',
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
    commandInputElement = currentDocument.getElementById('speech-input');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (dom) {
      dom.window.close();
    }
  });

  describe('Confirm Action Button (#handleSendAction)', () => {
    const actionToSubmit = createTestComposite(
      1,
      'core:submit_me',
      'Submit This',
      'This action will be submitted for testing.'
    );
    const actions = [actionToSubmit];
    let renderer;
    let actionButtonInstance;
    let updateActionsHandler;

    beforeEach(async () => {
      actionButtonInstance = undefined;

      // Mock the factory to capture the specific button instance when it's created.
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

      // Create the renderer, which automatically subscribes to VED events.
      renderer = createRendererUnderTest();
      await new Promise((resolve) => setTimeout(resolve, 0)); // Settle constructor's async refreshList

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
          `Test setup error: actionButtonInstance for command '${actionToSubmit.commandString}' was not created. Check validation logic.`
        );
      }

      // --- Prepare for individual 'it' blocks ---
      jest.clearAllMocks(mockLogger, mockVed.dispatch);
      const spy = jest.spyOn(renderer, '_onItemSelected');
      await actionButtonInstance.click();
      // eslint-disable-next-line jest/no-standalone-expect
      expect(spy).toHaveBeenCalledWith(actionButtonInstance, actionToSubmit);
      // eslint-disable-next-line jest/no-standalone-expect
      expect(renderer.selectedAction).toEqual(actionToSubmit);
      // eslint-disable-next-line jest/no-standalone-expect
      expect(globalMockSendButton.disabled).toBe(false);

      jest.clearAllMocks(
        mockLogger,
        mockVed.dispatch,
        actionButtonInstance.classList.add,
        actionButtonInstance.classList.remove,
        actionButtonsContainer.classList.add
      );
    });

    it('should dispatch event with action index and speech, clear speech, deselect, and disable send button on successful dispatch', async () => {
      commandInputElement.value = 'Player says this';
      mockVed.dispatch.mockResolvedValue(true);

      const spyDispatch = jest.spyOn(renderer, '_onItemSelected');
      await globalMockSendButton.click();

      expect(mockVed.dispatch).toHaveBeenCalledTimes(1);
      expect(mockVed.dispatch).toHaveBeenCalledWith(PLAYER_TURN_SUBMITTED_ID, {
        submittedByActorId: MOCK_ACTOR_ID,
        chosenIndex: actionToSubmit.index,
        speech: 'Player says this',
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Event '${PLAYER_TURN_SUBMITTED_ID}' dispatched`
        )
      );
      expect(commandInputElement.value).toBe('');
      expect(renderer.selectedAction).toBeNull();
      expect(globalMockSendButton.disabled).toBe(true);
      expect(spyDispatch).toHaveBeenCalledWith(null, null);
      expect(actionButtonInstance.classList.contains('selected')).toBe(false);
      expect(actionButtonsContainer.classList.add).toHaveBeenCalledWith(
        'actions-fade-out'
      );

      // Simulate animation end to trigger cleanup logic
      const animationCallbacks =
        actionButtonsContainer._listeners['animationend'] || [];
      for (const cb of animationCallbacks) {
        cb();
      }

      expect(actionButtonsContainer.classList.add).toHaveBeenCalledWith(
        'actions-disabled'
      );
      expect(actionButtonsContainer.children.length).toBe(0);
    });

    it('should not disable container if new actions arrive before fade-out ends', async () => {
      mockVed.dispatch.mockResolvedValue(true);

      await globalMockSendButton.click();

      // New actions for next player before animation end
      await updateActionsHandler({
        type: 'core:update_available_actions',
        payload: { actorId: 'next-player', actions: [actionToSubmit] },
      });

      const animationCallbacks =
        actionButtonsContainer._listeners['animationend'] || [];
      for (const cb of animationCallbacks) {
        cb();
      }

      expect(actionButtonsContainer.classList.add).toHaveBeenCalledWith(
        'actions-fade-out'
      );
      expect(actionButtonsContainer.classList.add).not.toHaveBeenCalledWith(
        'actions-disabled'
      );
      expect(actionButtonsContainer.children.length).toBeGreaterThan(0);
    });

    it('should dispatch event with speech: null if speech input is empty', async () => {
      commandInputElement.value = '';
      mockVed.dispatch.mockResolvedValue(true);

      await globalMockSendButton.click();

      expect(mockVed.dispatch).toHaveBeenCalledWith(PLAYER_TURN_SUBMITTED_ID, {
        submittedByActorId: MOCK_ACTOR_ID,
        chosenIndex: actionToSubmit.index,
        speech: null,
      });
      expect(commandInputElement.value).toBe('');
    });

    it('should dispatch event with speech: null and log debug if speech input element is missing', async () => {
      renderer.elements.speechInputElement = null;
      mockVed.dispatch.mockResolvedValue(true);

      await globalMockSendButton.click();

      expect(mockVed.dispatch).toHaveBeenCalledWith(PLAYER_TURN_SUBMITTED_ID, {
        submittedByActorId: MOCK_ACTOR_ID,
        chosenIndex: actionToSubmit.index,
        speech: null,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${CLASS_PREFIX} No speech input element available.`
      );
    });

    it('should log error and not change UI state if dispatch returns false', async () => {
      commandInputElement.value = 'Test speech';
      mockVed.dispatch.mockResolvedValue(false);

      const spyDispatch = jest.spyOn(renderer, '_onItemSelected');
      await globalMockSendButton.click();

      expect(mockVed.dispatch).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Failed to dispatch '${PLAYER_TURN_SUBMITTED_ID}' for action index '${actionToSubmit.index}'.`,
        expect.anything()
      );
      expect(commandInputElement.value).toBe('Test speech');
      expect(renderer.selectedAction).toEqual(actionToSubmit);
      expect(globalMockSendButton.disabled).toBe(false);
      expect(spyDispatch).not.toHaveBeenCalled();
    });

    it('should log error and not change UI state if dispatch throws an error', async () => {
      commandInputElement.value = 'Test speech again';
      const dispatchError = new Error('Network Error');
      mockVed.dispatch.mockRejectedValue(dispatchError);

      const spyDispatch = jest.spyOn(renderer, '_onItemSelected');
      await globalMockSendButton.click();

      expect(mockVed.dispatch).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Exception during dispatch for '${PLAYER_TURN_SUBMITTED_ID}'.`,
        expect.objectContaining({ error: dispatchError })
      );
      expect(commandInputElement.value).toBe('Test speech again');
      expect(renderer.selectedAction).toEqual(actionToSubmit);
      expect(globalMockSendButton.disabled).toBe(false);
      expect(spyDispatch).not.toHaveBeenCalled();
    });

    it('should do nothing and log warning if no action is selected when send button clicked', async () => {
      renderer.selectedAction = null;
      globalMockSendButton.disabled = false; // Manually enable for test case

      await globalMockSendButton.click();

      expect(mockVed.dispatch).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} 'Confirm Action' clicked, but no action is selected.`
      );
      expect(globalMockSendButton.disabled).toBe(true);
    });

    it('should log error if sendButtonElement is somehow null during #handleSendAction', async () => {
      expect(renderer.selectedAction).toEqual(actionToSubmit);
      expect(globalMockSendButton.disabled).toBe(false);

      // Break the state for the test case
      renderer.elements.sendButtonElement = null;

      // Simulate the user clicking the send button.
      // The listener was already attached by the constructor to this DOM element.
      await globalMockSendButton.click();

      expect(mockLogger.error).toHaveBeenCalledWith(
        `${CLASS_PREFIX} #handleSendAction called, but sendButtonElement is null.`
      );
      expect(mockVed.dispatch).not.toHaveBeenCalled();
    });
  });
});
