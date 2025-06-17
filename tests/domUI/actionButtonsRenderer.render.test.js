// tests/domUI/actionButtonsRenderer.render.test.js
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
import { DomUtils } from '../../src/utils/domUtils.js';

jest.mock('../../src/logging/consoleLogger.js');
jest.mock('../../src/events/validatedEventDispatcher.js');
jest.mock('../../src/domUI/domElementFactory.js');

/**
 * CORRECTED: Creates a valid ActionComposite object for testing.
 * The original `createValidTestAction` created objects that are now invalid.
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

describe('ActionButtonsRenderer', () => {
  let dom;
  let document;
  let docContext;
  let mockLogger;
  let mockVed;
  let mockDomElementFactoryInstance;
  let actionButtonsContainer;
  let mockSendButton;
  const CLASS_PREFIX = '[ActionButtonsRenderer]';

  const ACTION_BUTTONS_CONTAINER_SELECTOR = '#action-buttons';
  const SEND_BUTTON_SELECTOR = '#send-action-button';

  const createMockElement = (
    tagName = 'div',
    id = '',
    classes = [],
    textContent = ''
  ) => {
    const element = document.createElement(tagName);
    if (id) element.id = id;
    const classArray = Array.isArray(classes)
      ? classes
      : String(classes)
          .split(' ')
          .filter((c) => c);
    if (classArray.length > 0) element.classList.add(...classArray);
    element.textContent = textContent;
    element._attributes = {};
    element._listeners = {};
    element.addEventListener = jest.fn((event, cb) => {
      if (!element._listeners[event]) element._listeners[event] = [];
      element._listeners[event].push(cb);
    });
    element.removeEventListener = jest.fn();
    element.click = jest.fn(async () => {
      if (element._listeners['click']) {
        for (const listener of element._listeners['click']) await listener();
      }
    });
    jest.spyOn(element, 'setAttribute').mockImplementation((name, value) => {
      element._attributes[name] = value;
    });
    element.getAttribute = jest.fn((name) => element._attributes[name]);
    jest.spyOn(element, 'remove');
    let isDisabled = false;
    if (tagName === 'button') {
      Object.defineProperty(element, 'disabled', {
        get: () => isDisabled,
        set: (value) => {
          isDisabled = !!value;
        },
        configurable: true,
      });
    }
    if (element.classList) {
      jest.spyOn(element.classList, 'add');
      jest.spyOn(element.classList, 'remove');
      jest.spyOn(element.classList, 'contains');
    }
    return element;
  };

  beforeEach(() => {
    dom = new JSDOM(
      `<!DOCTYPE html><html><body><div id="game-container"><div id="action-buttons"></div><button id="send-action-button"></button></div></body></html>`
    );
    document = dom.window.document;
    global.document = document;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;

    docContext = new DocumentContext(document);
    mockLogger = new ConsoleLogger();
    mockVed = new ValidatedEventDispatcher({});
    mockDomElementFactoryInstance = new DomElementFactory(docContext);

    jest
      .spyOn(mockDomElementFactoryInstance, 'button')
      .mockImplementation((text, cls) => {
        const classes = cls
          ? Array.isArray(cls)
            ? cls
            : cls.split(' ').filter((c) => c)
          : [];
        const btn = createMockElement('button', '', classes, text);
        // The test environment might not fully respect the tagName, so we ensure it is correct.
        if (btn.tagName !== 'BUTTON') {
          Object.defineProperty(btn, 'tagName', {
            value: 'BUTTON',
            configurable: true,
          });
        }
        return btn;
      });
    jest
      .spyOn(mockDomElementFactoryInstance, 'p')
      .mockImplementation((cls, text) => {
        const classes = cls
          ? Array.isArray(cls)
            ? cls
            : cls.split(' ').filter((c) => c)
          : [];
        return createMockElement('p', '', classes, text);
      });

    actionButtonsContainer = document.getElementById('action-buttons');
    mockSendButton = createMockElement('button', 'send-action-button');
    const originalSendButton = document.getElementById('send-action-button');
    if (originalSendButton && originalSendButton.parentNode) {
      originalSendButton.parentNode.replaceChild(
        mockSendButton,
        originalSendButton
      );
    } else if (document.body) {
      document.body.appendChild(mockSendButton);
    }

    if (!actionButtonsContainer) {
      throw new Error(
        'Test setup failed: #action-buttons container not found in JSDOM.'
      );
    }

    jest.spyOn(mockLogger, 'info');
    jest.spyOn(mockLogger, 'warn');
    jest.spyOn(mockLogger, 'error');
    jest.spyOn(mockLogger, 'debug');

    if (!jest.isMockFunction(mockVed.subscribe)) mockVed.subscribe = jest.fn();
    if (!jest.isMockFunction(mockVed.dispatch)) mockVed.dispatch = jest.fn();
    mockVed.subscribe.mockReturnValue({ unsubscribe: jest.fn() });
    mockVed.dispatch.mockResolvedValue(true);

    jest.spyOn(actionButtonsContainer, 'appendChild');
    jest.spyOn(actionButtonsContainer, 'removeChild');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (dom) dom.window.close();
    delete global.document;
    delete global.HTMLElement;
    delete global.HTMLButtonElement;
  });

  // Helper to create renderer and wait for initial async operations from constructor
  const createRendererAndSettle = async (options = {}) => {
    const {
      containerSelectorParam = ACTION_BUTTONS_CONTAINER_SELECTOR,
      factoryOverrideParam = mockDomElementFactoryInstance,
      sendButtonSelectorParam = SEND_BUTTON_SELECTOR,
    } = options;

    const testDocContext = new DocumentContext(document);
    const renderer = new ActionButtonsRenderer({
      logger: mockLogger,
      documentContext: testDocContext,
      validatedEventDispatcher: mockVed,
      domElementFactory: factoryOverrideParam,
      actionButtonsContainerSelector: containerSelectorParam,
      sendButtonSelector: sendButtonSelectorParam,
    });
    // Allow microtasks from constructor's refreshList() to settle
    await new Promise((resolve) => setTimeout(resolve, 0));
    return renderer;
  };

  describe('render() functionality', () => {
    it('should clear the container when rendering', async () => {
      const oldButton = createMockElement(
        'button',
        'old-button',
        [],
        'Old Button'
      );
      actionButtonsContainer.appendChild(oldButton);

      const renderer = await createRendererAndSettle();
      // The constructor's `refreshList` already ran, cleared `oldButton`, and added an empty message.
      // We clear mock history to only track calls from this test's specific `refreshList` call.
      actionButtonsContainer.appendChild.mockClear();
      actionButtonsContainer.removeChild.mockClear();

      // CORRECTED: Use `createTestComposite` to create valid action objects.
      renderer.availableActions = [
        createTestComposite(
          1,
          'test:look',
          'look',
          'Look at your surroundings.'
        ),
        createTestComposite(
          2,
          'test:go_n',
          'go north',
          'Move towards the north.'
        ),
      ];

      await renderer.refreshList();

      // The container had an empty message <p>, which is now removed.
      expect(actionButtonsContainer.removeChild).toHaveBeenCalledTimes(1);
      expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(2);

      // JSDOM's querySelectorAll on the container itself works better than querying the document.
      const finalButtons = actionButtonsContainer.querySelectorAll(
        'button.action-button'
      );
      expect(finalButtons.length).toBe(2);

      const containerText = actionButtonsContainer.textContent;
      expect(containerText).not.toContain('Old Button');
      expect(containerText).toContain('look');
      expect(containerText).toContain('go north');
    });

    it('should render nothing and log debug if actions list is empty', async () => {
      const oldButton = createMockElement(
        'button',
        'old-button-empty-test',
        [],
        'Old Button'
      );
      actionButtonsContainer.appendChild(oldButton);

      const renderer = await createRendererAndSettle();
      // Constructor's refreshList removed oldButton and added an empty message.
      // Clear history for this test's action.
      actionButtonsContainer.appendChild.mockClear();
      actionButtonsContainer.removeChild.mockClear();
      mockLogger.debug.mockClear();

      renderer.availableActions = [];
      await renderer.refreshList();

      // refreshList clears the previous empty message, then adds a new one.
      expect(actionButtonsContainer.removeChild).toHaveBeenCalledTimes(1);
      expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(1);
      expect(actionButtonsContainer.children.length).toBe(1); // The new empty message.
      expect(mockDomElementFactoryInstance.button).not.toHaveBeenCalled();

      const emptyMessageP = actionButtonsContainer.querySelector(
        'p.empty-list-message'
      );
      expect(emptyMessageP).not.toBeNull();
      if (emptyMessageP)
        expect(emptyMessageP.textContent).toBe('No actions available.');
    });

    it('should render buttons for each valid action object', async () => {
      // CORRECTED: Use `createTestComposite` to provide valid data.
      const actions = [
        createTestComposite(
          1,
          'test:look',
          'look',
          'Examine your surroundings.'
        ),
        createTestComposite(
          2,
          'test:go_n',
          'go north',
          'Proceed to the north.'
        ),
        createTestComposite(
          3,
          'test:talk',
          'talk to npc',
          'Initiate conversation.'
        ),
      ];
      const renderer = await createRendererAndSettle();
      actionButtonsContainer.appendChild.mockClear();
      mockDomElementFactoryInstance.button.mockClear();

      renderer.availableActions = actions;
      await renderer.refreshList();

      expect(mockDomElementFactoryInstance.button).toHaveBeenCalledTimes(
        actions.length
      );
      expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(
        actions.length
      );
      expect(actionButtonsContainer.children.length).toBe(actions.length);

      actions.forEach((actionObject, index) => {
        expect(mockDomElementFactoryInstance.button).toHaveBeenCalledWith(
          actionObject.commandString,
          'action-button'
        );
        const renderedButton = actionButtonsContainer.children[index];
        expect(renderedButton).not.toBeNull();
        expect(renderedButton.tagName).toBe('BUTTON');
        expect(renderedButton.textContent).toBe(actionObject.commandString);
        expect(renderedButton.classList.contains('action-button')).toBe(true);

        // FINAL CORRECTION: Assert against the `title` property directly,
        // as this is how the SUT sets it. The mocked `getAttribute` does not
        // reflect this property assignment.
        expect(renderedButton.title).toBe(actionObject.description);

        // The SUT now sets `data-action-index`.
        expect(renderedButton.getAttribute('data-action-index')).toBe(
          String(actionObject.index)
        );
        const mockButtonFromFactory =
          mockDomElementFactoryInstance.button.mock.results[index].value;
        expect(mockButtonFromFactory.addEventListener).toHaveBeenCalledWith(
          'click',
          expect.any(Function)
        );
      });
    });

    it('should skip invalid actions and log warning', async () => {
      // CORRECTED: This test is rewritten to test the new validation logic in `_renderListItem`.
      const actionsToSet = [
        createTestComposite(1, 'test:valid1', 'do one', 'Description one.'),
        {
          /* invalid: missing index */ actionId: 'a:1',
          commandString: 'c:1',
          description: 'd:1',
        },
        {
          index: 2,
          /* invalid: missing actionId */ commandString: 'c:2',
          description: 'd:2',
        },
        {
          index: 3,
          actionId: 'a:3',
          /* invalid: missing commandString */ description: 'd:3',
        },
        {
          index: 4,
          actionId: 'a:4',
          commandString: 'c:4' /* invalid: missing description */,
        },
        null, // invalid
        createTestComposite(5, 'test:valid2', 'do two', 'Description two.'),
        {}, // invalid
      ];
      const expectedRenderedCount = 2; // Only the two valid composites should render.
      const expectedWarningCount = 6; // For the 6 invalid items.

      const renderer = await createRendererAndSettle();
      actionButtonsContainer.appendChild.mockClear();
      mockLogger.warn.mockClear();
      mockDomElementFactoryInstance.button.mockClear();

      renderer.availableActions = actionsToSet;
      await renderer.refreshList();

      expect(mockDomElementFactoryInstance.button).toHaveBeenCalledTimes(
        expectedRenderedCount
      );
      expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(
        expectedRenderedCount
      );
      expect(actionButtonsContainer.children.length).toBe(
        expectedRenderedCount
      );

      // CORRECTED: Check for the new, single warning message format.
      expect(mockLogger.warn).toHaveBeenCalledTimes(expectedWarningCount);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Skipping invalid action composite in _renderListItem: `,
        { actionComposite: actionsToSet[1] }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Skipping invalid action composite in _renderListItem: `,
        { actionComposite: actionsToSet[2] }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Skipping invalid action composite in _renderListItem: `,
        { actionComposite: null }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Skipping invalid action composite in _renderListItem: `,
        { actionComposite: {} }
      );
    });

    it('should treat non-array actions argument as empty list, not log error, and clear container', async () => {
      const oldButton = createMockElement('button', '', [], 'Old Button');
      const renderer = await createRendererAndSettle(); // Constructor call and its refreshList settles.

      expect(mockVed.subscribe).toHaveBeenCalledTimes(1);

      const subscribeCallArgs = mockVed.subscribe.mock.calls[0];
      const eventNameSubscribed = subscribeCallArgs[0];
      const actualEventHandler = subscribeCallArgs[1];
      expect(eventNameSubscribed).toBe('core:update_available_actions');

      const testCases = [
        {
          type: 'core:update_available_actions',
          payload: 'not an object payload',
        },
        {
          type: 'core:update_available_actions',
          payload: { actorId: 'testActor', actions: 'not an array' },
        },
        {
          type: 'core:update_available_actions',
          payload: { actorId: 'testActor', actions: null },
        },
        {
          type: 'core:update_available_actions',
          payload: { actorId: 'testActor', actions: undefined },
        },
        {
          type: 'core:update_available_actions',
          payload: { actorId: 'testActor', actions: {} },
        },
        {
          type: 'core:update_available_actions',
          payload: { actorId: '', actions: [] },
        },
        { type: 'core:update_available_actions', payload: null },
        {
          type: 'core:update_available_actions',
          payload: { actorId: 'testActor' },
        },
        { type: 'core:update_available_actions', payload: { actions: [] } },
      ];

      for (const eventInputCase of testCases) {
        DomUtils.clearElement(actionButtonsContainer);
        actionButtonsContainer.appendChild(oldButton);

        actionButtonsContainer.appendChild.mockClear();
        actionButtonsContainer.removeChild.mockClear();
        mockLogger.error.mockClear();
        mockLogger.warn.mockClear();
        mockDomElementFactoryInstance.button.mockClear();

        await actualEventHandler(eventInputCase);

        expect(mockLogger.error).not.toHaveBeenCalled();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            `${CLASS_PREFIX} Received invalid or incomplete event for`
          ),
          { receivedObject: eventInputCase }
        );

        expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(
          oldButton
        );
        expect(actionButtonsContainer.children.length).toBe(1);
        const emptyMsgEl = actionButtonsContainer.querySelector(
          'p.empty-list-message'
        );
        expect(emptyMsgEl).not.toBeNull();
        if (emptyMsgEl)
          expect(emptyMsgEl.textContent).toBe('No actions available.');

        expect(mockDomElementFactoryInstance.button).not.toHaveBeenCalled();
      }
    });

    it('should log error and skip if factory fails to create a button', async () => {
      // CORRECTED: Use `createTestComposite`
      const actionsForRenderer = [
        createTestComposite(1, 'test:look', 'look', 'Look desc.'),
        createTestComposite(2, 'test:fail', 'fail_command', 'Fail desc.'),
        createTestComposite(3, 'test:go_n', 'go north', 'Go north desc.'),
      ];
      const expectedFinalButtonCount = 2;

      mockDomElementFactoryInstance.button.mockReset();
      mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
        if (text === 'fail_command') return null; // Simulate factory failure
        const classes = cls
          ? Array.isArray(cls)
            ? cls
            : cls.split(' ').filter((c) => c)
          : [];
        return createMockElement('button', '', classes, text);
      });

      const renderer = await createRendererAndSettle();
      actionButtonsContainer.appendChild.mockClear();
      mockLogger.error.mockClear();

      renderer.availableActions = actionsForRenderer;
      await renderer.refreshList();

      expect(mockDomElementFactoryInstance.button).toHaveBeenCalledTimes(
        actionsForRenderer.length
      );
      expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(
        expectedFinalButtonCount
      );
      expect(actionButtonsContainer.children.length).toBe(
        expectedFinalButtonCount
      );

      // CORRECTED: Assert the new, correct error message and payload.
      expect(mockLogger.error).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Failed to create button element for action composite:`,
        { actionComposite: actionsForRenderer[1] } // The one that failed.
      );
    });
  });
});
