import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import { ActionButtonsRenderer } from '../../../src/domUI/actionButtonsRenderer.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';

describe('ActionButtonsRenderer hover interactions and rendering coverage', () => {
  let dom;
  let document;
  let docContext;
  let logger;
  let dispatcher;
  let domElementFactory;
  let actionCategorizationService;
  /** @type {Function | null} */
  let updateActionsHandler;

  const createInstrumentedButton = (text = '', cls = '') => {
    const button = document.createElement('button');
    button.textContent = text;
    if (cls) {
      button.className = cls;
    }
    button._listeners = {};
    button.addEventListener = jest.fn((event, handler, options) => {
      if (!button._listeners[event]) {
        button._listeners[event] = [];
      }
      button._listeners[event].push({ handler, options });
    });
    button.removeEventListener = jest.fn((event, handler) => {
      if (!button._listeners[event]) return;
      button._listeners[event] = button._listeners[event].filter(
        (entry) => entry.handler !== handler
      );
    });
    button.dispatchStored = async (eventType, payload = {}) => {
      const entries = button._listeners[eventType] || [];
      for (const { handler } of entries) {
        await handler({ target: button, ...payload });
      }
    };
    return button;
  };

  const createActionComposite = (index, actionId = `core:action-${index}`) => ({
    index,
    actionId,
    commandString: `Command ${index}`,
    description: `Description ${index}`,
    params: {},
  });

  const createRenderer = (overrides = {}) => {
    updateActionsHandler = null;
    const instance = new ActionButtonsRenderer({
      logger,
      documentContext: docContext,
      validatedEventDispatcher: dispatcher,
      domElementFactory,
      actionButtonsContainerSelector: '#action-buttons',
      sendButtonSelector: '#confirm-action-button',
      speechInputSelector: '#speech-input',
      actionCategorizationService,
      ...overrides,
    });
    if (!updateActionsHandler && dispatcher.subscribe.mock.calls.length > 0) {
      const latestCall = dispatcher.subscribe.mock.calls.find(
        (call) => call[0] === 'core:update_available_actions'
      );
      updateActionsHandler = latestCall ? latestCall[1] : null;
    }
    return instance;
  };

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id="action-buttons"></div>
      <button id="confirm-action-button"></button>
      <input id="speech-input" value="" />
    </body></html>`);
    document = dom.window.document;

    global.window = dom.window;
    global.document = document;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;
    global.HTMLInputElement = dom.window.HTMLInputElement;

    const container = document.getElementById('action-buttons');
    container._listeners = {};
    jest
      .spyOn(container, 'addEventListener')
      .mockImplementation((event, handler, options) => {
        if (!container._listeners[event]) {
          container._listeners[event] = [];
        }
        container._listeners[event].push({ handler, options });
      });
    jest
      .spyOn(container, 'removeEventListener')
      .mockImplementation((event, handler) => {
        if (!container._listeners[event]) return;
        container._listeners[event] = container._listeners[event].filter(
          (entry) => entry.handler !== handler
        );
      });

    docContext = new DocumentContext(document);
    // Provide compatibility properties expected by ActionButtonsRenderer helpers
    docContext.body = document.body;
    docContext.window = dom.window;

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    dispatcher = {
      subscribe: jest.fn((eventType, handler) => {
        if (eventType === 'core:update_available_actions') {
          updateActionsHandler = handler;
        }
        return () => {};
      }),
      dispatch: jest.fn().mockResolvedValue(true),
    };

    domElementFactory = new DomElementFactory(docContext);
    jest
      .spyOn(domElementFactory, 'button')
      .mockImplementation((text, cls) => createInstrumentedButton(text, cls));

    actionCategorizationService = {
      extractNamespace: jest.fn((actionId) => actionId.split(':')[0] || 'core'),
      shouldUseGrouping: jest.fn(() => false),
      groupActionsByNamespace: jest.fn(() => new Map()),
      getSortedNamespaces: jest.fn((namespaces) => [...namespaces]),
      formatNamespaceDisplayName: jest.fn((namespace) => namespace.toUpperCase()),
      shouldShowCounts: jest.fn(() => false),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (dom?.window) {
      dom.window.close();
    }
    delete global.window;
    delete global.document;
    delete global.HTMLElement;
    delete global.HTMLButtonElement;
    delete global.HTMLInputElement;
    updateActionsHandler = null;
  });

  it('toggles the confirm button disabled state when selection changes', () => {
    const renderer = createRenderer();
    const action = createActionComposite(1);
    const button = renderer._renderListItem(action);
    expect(button).toBeTruthy();

    renderer._onItemSelected(button, action);
    expect(renderer.elements.sendButtonElement.disabled).toBe(false);

    renderer._onItemSelected(null, null);
    expect(renderer.elements.sendButtonElement.disabled).toBe(true);
  });

  it('applies hover visuals, caches metadata, and warns on low contrast', () => {
    const renderer = createRenderer();
    jest.spyOn(renderer, '_validateContrast').mockReturnValue(false);
    const action = {
      ...createActionComposite(2, 'visual:test'),
      visual: {
        backgroundColor: '#000000',
        textColor: '#000000',
        hoverBackgroundColor: '#123456',
        hoverTextColor: '#654321',
        borderColor: '#999999',
      },
    };

    const button = renderer._renderListItem(action);
    expect(button.dataset.hoverBg).toBe('#123456');
    expect(button.dataset.hoverText).toBe('#654321');
    expect(button.dataset.hasCustomHover).toBe('true');
    expect(button.classList.contains('contrast-warning')).toBe(true);
    expect(renderer.buttonVisualMap.get(action.actionId)).toBeTruthy();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('insufficient contrast')
    );
  });

  it('parses colors via document context and caches the result', () => {
    const renderer = createRenderer();
    const result = renderer._parseColor('#336699');
    expect(result).toEqual({ r: 51, g: 102, b: 153 });
    expect(renderer.colorParseCache.get('#336699')).toEqual(result);

    // Second call should reuse cache and not throw
    const cachedResult = renderer._parseColor('#336699');
    expect(cachedResult).toBe(result);
  });

  it('delegates hover events to the actual action button targets', () => {
    const renderer = createRenderer();
    const container = renderer.elements.listContainerElement;
    const actionButton = renderer._renderListItem(createActionComposite(3));
    const child = document.createElement('span');
    actionButton.appendChild(child);
    container.appendChild(actionButton);

    const enterSpy = jest
      .spyOn(renderer, '_handleHoverEnter')
      .mockImplementation(() => {});
    const leaveSpy = jest
      .spyOn(renderer, '_handleHoverLeave')
      .mockImplementation(() => {});

    renderer._handleDelegatedHoverEnter({ target: child });
    renderer._handleDelegatedHoverLeave({ target: child });

    expect(enterSpy).toHaveBeenCalledWith({ target: actionButton });
    expect(leaveSpy).toHaveBeenCalledWith({ target: actionButton });
  });

  it('adds and removes hover listeners in test environments', () => {
    const renderer = createRenderer();
    const stubButton = {
      dataset: {},
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() },
    };

    renderer._addHoverListeners(stubButton);
    expect(stubButton.addEventListener).toHaveBeenCalledWith(
      'mouseenter',
      renderer.boundHoverHandlers.enter
    );
    expect(stubButton.dataset.hasHoverListeners).toBe('true');

    renderer._removeHoverListeners(stubButton);
    expect(stubButton.removeEventListener).toHaveBeenCalledWith(
      'mouseenter',
      renderer.boundHoverHandlers.enter
    );
    expect(stubButton.dataset.hasHoverListeners).toBeUndefined();
  });

  it('applies hover styles and restores selection visuals correctly', () => {
    const renderer = createRenderer();
    const button = renderer._renderListItem(createActionComposite(4));
    button.dataset.hoverBg = '#abcdef';
    button.dataset.hoverText = '#123123';
    button.dataset.originalBg = '#111111';
    button.dataset.originalText = '#222222';
    button.dataset.customBg = '#333333';
    button.classList.add('selected');

    renderer._applyHoverState(button, true);
    expect(button.style.backgroundColor).toBe('rgb(171, 205, 239)');
    expect(button.style.color).toBe('rgb(18, 49, 35)');
    expect(button.classList.contains('action-button-hovering')).toBe(true);

    renderer._applyHoverState(button, false);
    expect(button.style.backgroundColor).toBe('rgb(51, 51, 51)');
    expect(button.style.color).toBe('rgb(34, 34, 34)');
    expect(button.classList.contains('action-button-hovering')).toBe(false);
  });

  it('renders a custom empty list element when provided', async () => {
    const renderer = createRenderer();
    const customEmpty = document.createElement('p');
    customEmpty.textContent = 'Nothing here';
    jest
      .spyOn(renderer, '_getEmptyListMessage')
      .mockReturnValue(customEmpty);

    renderer.availableActions = [];
    await renderer.renderList();

    const container = renderer.elements.listContainerElement;
    expect(container.firstChild).toBe(customEmpty);
    expect(renderer._getEmptyListMessage).toHaveBeenCalled();
  });

  it('groups actions by namespace when categorization enables grouping', async () => {
    actionCategorizationService.shouldUseGrouping.mockReturnValue(true);
    actionCategorizationService.shouldShowCounts.mockReturnValue(true);
    const actionA = createActionComposite(1, 'core:wait');
    const actionB = createActionComposite(2, 'magic:cast');
    actionCategorizationService.groupActionsByNamespace.mockReturnValue(
      new Map([
        ['core', [actionA]],
        ['magic', [actionB]],
      ])
    );

    const renderer = createRenderer();
    renderer.availableActions = [actionA, actionB];
    await renderer.renderList();

    const container = renderer.elements.listContainerElement;
    const headers = container.querySelectorAll('.action-section-header');
    expect(headers).toHaveLength(2);
    expect(headers[0].textContent).toBe('CORE (1)');
    expect(headers[1].textContent).toBe('MAGIC (1)');
    const groups = container.querySelectorAll('.action-group');
    expect(groups).toHaveLength(2);
    expect(groups[0].querySelectorAll('button.action-button')).toHaveLength(1);
  });

  it('clears stale selections and updates container classes after rendering', () => {
    const renderer = createRenderer();
    const container = renderer.elements.listContainerElement;
    const actionA = createActionComposite(1);
    const actionB = createActionComposite(2);
    const buttonA = renderer._renderListItem(actionA);
    const buttonB = renderer._renderListItem(actionB);
    container.appendChild(buttonA);
    container.appendChild(buttonB);

    renderer.selectedAction = { index: 99, commandString: 'Old', actionId: 'core:old' };

    renderer._onListRendered([actionA, actionB], container);

    expect(container.classList.contains(ActionButtonsRenderer.FADE_IN_CLASS)).toBe(
      true
    );
    expect(buttonA.style.getPropertyValue('--i')).toBe('0');
    expect(buttonB.style.getPropertyValue('--i')).toBe('1');
    expect(renderer.selectedAction).toBeNull();
    expect(renderer.elements.sendButtonElement.disabled).toBe(true);
  });

  it('re-selects the existing action when it is still present after render', () => {
    const renderer = createRenderer();
    const container = renderer.elements.listContainerElement;
    const action = createActionComposite(1);
    const button = renderer._renderListItem(action);
    container.appendChild(button);

    renderer.selectedAction = action;
    const selectSpy = jest.spyOn(renderer, '_selectItem');

    renderer._onListRendered([action], container);

    expect(selectSpy).toHaveBeenCalledWith(button, action);
    expect(renderer.elements.sendButtonElement.disabled).toBe(false);
  });

  it('does not process update events once disposed', async () => {
    const renderer = createRenderer();

    renderer.dispose();
    renderer.availableActions = ['sentinel'];

    await updateActionsHandler?.({
      type: 'core:update_available_actions',
      payload: {
        actorId: 'core:actor',
        actions: [createActionComposite(1)],
      },
    });

    expect(renderer.availableActions).toEqual(['sentinel']);
  });

  it('ignores confirm button actions after dispose because of guard', async () => {
    const renderer = createRenderer();
    const clickEntry = renderer._managedDomListeners.find(
      (entry) =>
        entry.element === renderer.elements.sendButtonElement &&
        entry.eventType === 'click'
    );
    expect(clickEntry).toBeTruthy();

    renderer.dispose();
    dispatcher.dispatch.mockClear();

    await clickEntry.handler();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('cleans up hover timeouts, listeners, and caches on dispose', () => {
    const renderer = createRenderer();
    const container = renderer.elements.listContainerElement;
    const button = renderer._renderListItem(createActionComposite(10));
    button.dataset.hasHoverListeners = 'true';
    button.removeEventListener = jest.fn();
    container.appendChild(button);

    const fakeTimeoutId = setTimeout(() => {}, 10);
    renderer.hoverTimeouts.set(button, fakeTimeoutId);
    renderer.buttonVisualMap.set('core:cleanup', { button, visual: {} });
    renderer.colorParseCache.set('#ffffff', { r: 255, g: 255, b: 255 });

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    renderer.dispose();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(fakeTimeoutId);
    expect(renderer.hoverTimeouts.size).toBe(0);
    expect(renderer.buttonVisualMap.size).toBe(0);
    expect(renderer.colorParseCache.size).toBe(0);
    expect(container.children.length).toBe(0);
    expect(button.removeEventListener).toHaveBeenCalledWith(
      'mouseenter',
      renderer.boundHoverHandlers.enter
    );

    clearTimeoutSpy.mockRestore();
  });
});
