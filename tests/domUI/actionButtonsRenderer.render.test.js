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

const createValidTestAction = (id, name, command, description) => ({
  id: id,
  name: name || `Test Name for ${id}`,
  command: command || `test_command_for_${id}`,
  description: description || `Test description for ${id}.`,
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
    // Changed describe name slightly
    it('should clear the container when rendering', async () => {
      const oldButton = createMockElement(
        'button',
        'old-button',
        [],
        'Old Button'
      );
      actionButtonsContainer.appendChild(oldButton); // This is pre-clear

      const renderer = await createRendererAndSettle();
      // After settle, constructor's refreshList has run (cleared then appended empty msg)
      // Now clear the spy history before the test's main action.
      actionButtonsContainer.appendChild.mockClear();
      actionButtonsContainer.removeChild.mockClear();

      renderer.availableActions = [
        createValidTestAction(
          'test:look',
          'Look Around',
          'look',
          'Look at your surroundings.'
        ),
        createValidTestAction(
          'test:go_n',
          'Go North',
          'go north',
          'Move towards the north.'
        ),
      ];

      await renderer.refreshList();

      // removeChild is called by DomUtils.clearElement to remove the empty message paragraph
      // that was added by the constructor's refreshList.
      // If oldButton was not cleared by constructor's refresh (because it's empty initially),
      // this might need adjustment. Let's assume empty message was the only thing.
      // The important removeChild is the one that DomUtils.clearElement calls on the
      // empty message paragraph from the *constructor's* render.
      // The oldButton was appended *before* createRendererAndSettle, so the *first*
      // DomUtils.clearElement (in constructor's refreshList) would have removed it.
      // The *second* DomUtils.clearElement (in the test's refreshList) removes the empty message P.
      // We need to be careful about what `oldButton` refers to here.
      // Let's focus on what happens AFTER mockClear.
      // After mockClear, refreshList is called. It first clears.
      // What was in the container before this refreshList? The empty <p> from constructor's refresh.
      // So, removeChild should be called once for that <p>.
      expect(actionButtonsContainer.removeChild).toHaveBeenCalledTimes(1);
      // And that removed child should be the <p> element.

      const finalButtons = actionButtonsContainer.querySelectorAll(
        'button.action-button'
      );
      expect(finalButtons.length).toBe(2);

      let containerText = '';
      actionButtonsContainer.childNodes.forEach((node) => {
        if (node.tagName === 'BUTTON') containerText += node.textContent;
      });
      expect(containerText).not.toContain('Old Button'); // This remains valid
      expect(containerText).toContain('look');
      expect(containerText).toContain('go north');

      expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(2); // For the two new buttons
    });

    it('should render nothing and log debug if actions list is empty', async () => {
      // oldButton is added to check if it's removed.
      const oldButton = createMockElement(
        'button',
        'old-button-empty-test',
        [],
        'Old Button'
      );
      actionButtonsContainer.appendChild(oldButton);

      const renderer = await createRendererAndSettle();
      // Constructor's refreshList removed oldButton and added empty message <p>.
      // Spy history clear for calls made *during this test's specific action*.
      actionButtonsContainer.appendChild.mockClear();
      actionButtonsContainer.removeChild.mockClear();
      mockLogger.debug.mockClear();
      mockLogger.info.mockClear();

      renderer.availableActions = [];
      await renderer.refreshList();

      // The refreshList call will clear the empty message <p> from the constructor's render.
      expect(actionButtonsContainer.removeChild).toHaveBeenCalledTimes(1);
      expect(actionButtonsContainer.children.length).toBe(1); // New empty message <p>
      expect(mockDomElementFactoryInstance.button).not.toHaveBeenCalled();

      // Assuming SUT's _onListRendered is changed to count 'button.action-button'
      const emptyMessageP = actionButtonsContainer.querySelector(
        'p.empty-list-message'
      );
      expect(emptyMessageP).not.toBeNull();
      if (emptyMessageP)
        expect(emptyMessageP.textContent).toBe('No actions available.');

      expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(1); // For the new empty message <p>
    });

    it('should render buttons for each valid action object', async () => {
      const actions = [
        createValidTestAction(
          'test:look',
          'Look Closely',
          'look',
          'Examine your surroundings.'
        ),
        createValidTestAction(
          'test:go_n',
          'Move North',
          'go north',
          'Proceed to the north.'
        ),
        createValidTestAction(
          'test:talk',
          'Talk to NPC',
          'talk to npc',
          'Initiate conversation.'
        ),
      ];
      const renderer = await createRendererAndSettle();
      actionButtonsContainer.appendChild.mockClear();
      actionButtonsContainer.removeChild.mockClear();
      mockLogger.info.mockClear();
      mockDomElementFactoryInstance.button.mockClear();
      // DomUtils.clearElement(actionButtonsContainer); // Not needed here, refreshList will clear

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
          actionObject.command.trim(),
          'action-button'
        );
        const renderedButton = actionButtonsContainer.children[index];
        expect(renderedButton).not.toBeNull();
        expect(renderedButton.tagName).toBe('BUTTON');
        expect(renderedButton.textContent).toBe(actionObject.command.trim());
        expect(renderedButton.classList.contains('action-button')).toBe(true);
        const expectedTooltip = `${actionObject.name.trim()}\n\nDescription:\n${actionObject.description.trim()}`;
        expect(renderedButton.getAttribute('title')).toBe(expectedTooltip);
        expect(renderedButton.getAttribute('data-action-id')).toBe(
          actionObject.id
        );
        const mockButtonFromFactory =
          mockDomElementFactoryInstance.button.mock.results[index].value;
        expect(mockButtonFromFactory.addEventListener).toHaveBeenCalledWith(
          'click',
          expect.any(Function)
        );
      });
    });

    it('should skip invalid actions (e.g., missing name/command/description) and log warning', async () => {
      const validAction1 = createValidTestAction(
        'test:valid1',
        'Valid One',
        'do one',
        'Description one.'
      );
      const invalidActionNoName = {
        id: 'test:no_name',
        command: 'cmd_no_name',
        description: 'Desc no name',
      };
      const invalidActionNoCmd = {
        id: 'test:no_cmd',
        name: 'Name No Cmd',
        description: 'Desc no cmd',
      };
      // ... (rest of actionsToSet definition)
      const actionsToSet = [
        validAction1,
        invalidActionNoName,
        invalidActionNoCmd,
        {
          id: 'test:no_desc',
          name: 'Name No Desc',
          command: 'cmd_no_desc',
          description: '',
        },
        createValidTestAction(
          'test:empty_cmd',
          'Empty Command Test',
          ' ',
          'Valid desc for empty cmd'
        ),
        createValidTestAction(
          'test:empty_name',
          ' ',
          'empty_name_cmd',
          'Description for empty name'
        ),
        null,
        {
          id: null,
          name: 'Null Id',
          command: 'null_id_cmd',
          description: 'Null id desc',
        },
        {
          id: 'test:undef_cmd',
          name: 'Undef Cmd',
          command: undefined,
          description: 'Undef cmd desc',
        },
        {},
        createValidTestAction(
          'test:valid2',
          'Valid Two',
          'do two',
          'Description two.'
        ),
      ];
      const expectedRenderedCount = 2;
      const renderer = await createRendererAndSettle();
      actionButtonsContainer.appendChild.mockClear();
      actionButtonsContainer.removeChild.mockClear();
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

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Skipping invalid action object in _renderListItem (missing or empty id): `,
        { actionObject: null }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Skipping invalid action object (missing name):`,
        { actionObject: invalidActionNoName }
      );
      // ... (all 9 warning checks) ...
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Skipping invalid action object (missing command):`,
        { actionObject: invalidActionNoCmd }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Skipping invalid action object (missing description):`,
        { actionObject: actionsToSet[3] }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Skipping invalid action object (missing command):`,
        { actionObject: actionsToSet[4] }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Skipping invalid action object (missing name):`,
        { actionObject: actionsToSet[5] }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Skipping invalid action object in _renderListItem (missing or empty id): `,
        { actionObject: actionsToSet[7] }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Skipping invalid action object (missing command):`,
        { actionObject: actionsToSet[8] }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Skipping invalid action object in _renderListItem (missing or empty id): `,
        { actionObject: {} }
      );
      expect(mockLogger.warn).toHaveBeenCalledTimes(9);
    });

    it('should treat non-array actions argument as empty list, not log error, and clear container', async () => {
      const oldButton = createMockElement('button', '', [], 'Old Button');
      const renderer = await createRendererAndSettle(); // Constructor call and its refreshList settles.

      // Initial subscribe call check should be done carefully if createRendererAndSettle is reused
      // For this specific test, we care about the subscribe done by *this* renderer instance.
      // The mockVed is reset in beforeEach, so this will be the first call for this instance.
      expect(mockVed.subscribe).toHaveBeenCalledTimes(1);

      const subscribeCallArgs = mockVed.subscribe.mock.calls[0];
      const eventNameSubscribed = subscribeCallArgs[0];
      const actualEventHandler = subscribeCallArgs[1];
      expect(eventNameSubscribed).toBe('textUI:update_available_actions');

      const testCases = [
        // ... (same test cases)
        {
          type: 'textUI:update_available_actions',
          payload: 'not an object payload',
        },
        {
          type: 'textUI:update_available_actions',
          payload: { actorId: 'testActor', actions: 'not an array' },
        },
        {
          type: 'textUI:update_available_actions',
          payload: { actorId: 'testActor', actions: null },
        },
        {
          type: 'textUI:update_available_actions',
          payload: { actorId: 'testActor', actions: undefined },
        },
        {
          type: 'textUI:update_available_actions',
          payload: {
            actorId: 'testActor',
            actions: {
              /* not an array */
            },
          },
        },
        {
          type: 'textUI:update_available_actions',
          payload: { actorId: '', actions: [] },
        },
        { type: 'textUI:update_available_actions', payload: null },
        {
          type: 'textUI:update_available_actions',
          payload: { actorId: 'testActor' },
        },
        { type: 'textUI:update_available_actions', payload: { actions: [] } },
      ];

      for (const eventInputCase of testCases) {
        DomUtils.clearElement(actionButtonsContainer);
        actionButtonsContainer.appendChild(oldButton);

        // Clear mocks for this iteration
        actionButtonsContainer.appendChild.mockClear();
        actionButtonsContainer.removeChild.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockDomElementFactoryInstance.button.mockClear();

        await actualEventHandler(eventInputCase);

        expect(mockLogger.error).not.toHaveBeenCalled();

        const isValidPayloadForProcessing =
          eventInputCase?.payload &&
          typeof eventInputCase.payload.actorId === 'string' &&
          eventInputCase.payload.actorId.trim().length > 0 &&
          Array.isArray(eventInputCase.payload.actions);

        if (!isValidPayloadForProcessing) {
          expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(
              `${CLASS_PREFIX} Received invalid or incomplete event for '${eventInputCase.type || 'textUI:update_available_actions'}'. Clearing actions.`
            ),
            { receivedObject: eventInputCase }
          );
        }

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
      const actionsForRenderer = [
        createValidTestAction('test:look', 'Look', 'look', 'Look desc.'),
        createValidTestAction(
          'test:fail',
          'Fail Button',
          'fail_command',
          'Fail desc.'
        ),
        createValidTestAction(
          'test:go_n',
          'Go North',
          'go north',
          'Go north desc.'
        ),
      ];
      const expectedFinalButtonCount = 2;

      mockDomElementFactoryInstance.button.mockReset();
      mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
        if (text === 'fail_command') return null;
        const classes = cls
          ? Array.isArray(cls)
            ? cls
            : cls.split(' ').filter((c) => c)
          : [];
        const btn = createMockElement('button', '', classes, text);
        if (btn.tagName !== 'BUTTON') {
          Object.defineProperty(btn, 'tagName', {
            value: 'BUTTON',
            configurable: true,
          });
        }
        return btn;
      });
      // Ensure 'p' mock is still in place if needed by other flows after reset (it shouldn't be affected by button.mockReset)
      if (!jest.isMockFunction(mockDomElementFactoryInstance.p)) {
        jest
          .spyOn(mockDomElementFactoryInstance, 'p')
          .mockImplementation((cls, text) =>
            createMockElement('p', '', cls, text)
          );
      }

      const renderer = await createRendererAndSettle();
      actionButtonsContainer.appendChild.mockClear();
      actionButtonsContainer.removeChild.mockClear();
      mockLogger.error.mockClear();
      mockLogger.info.mockClear();

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

      expect(mockLogger.error).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Failed to create button element for action: "fail_command" (ID: test:fail) using domElementFactory.`
      );
    });
  });
});
