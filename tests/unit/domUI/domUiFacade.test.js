import { describe, it, expect, jest } from '@jest/globals';
import { DomUiFacade } from '../../../src/domUI/domUiFacade.js';

const createRenderer = (methods = {}) => ({
  dispose: jest.fn(),
  ...methods,
});

const createDependencies = (overrides = {}) => ({
  actionButtonsRenderer: createRenderer({ refreshList: jest.fn() }),
  locationRenderer: createRenderer({ render: jest.fn() }),
  titleRenderer: createRenderer({ set: jest.fn() }),
  inputStateController: createRenderer({ setEnabled: jest.fn() }),
  speechBubbleRenderer: createRenderer({ renderSpeech: jest.fn() }),
  perceptionLogRenderer: createRenderer({ refreshList: jest.fn() }),
  actionResultRenderer: createRenderer(),
  saveGameUI: createRenderer({ show: jest.fn() }),
  loadGameUI: createRenderer({ show: jest.fn() }),
  llmSelectionModal: createRenderer({ show: jest.fn() }),
  entityLifecycleMonitor: createRenderer({ clearEvents: jest.fn() }),
  ...overrides,
});

describe('DomUiFacade', () => {
  it('exposes each dependency via dedicated getters', () => {
    const deps = createDependencies();
    const facade = new DomUiFacade(deps);

    expect(facade.actionButtons).toBe(deps.actionButtonsRenderer);
    expect(facade.location).toBe(deps.locationRenderer);
    expect(facade.title).toBe(deps.titleRenderer);
    expect(facade.input).toBe(deps.inputStateController);
    expect(facade.speechBubble).toBe(deps.speechBubbleRenderer);
    expect(facade.perceptionLog).toBe(deps.perceptionLogRenderer);
    expect(facade.actionResults).toBe(deps.actionResultRenderer);
    expect(facade.saveGame).toBe(deps.saveGameUI);
    expect(facade.loadGame).toBe(deps.loadGameUI);
    expect(facade.llmSelectionModal).toBe(deps.llmSelectionModal);
    expect(facade.entityLifecycleMonitor).toBe(deps.entityLifecycleMonitor);
  });

  it('accepts a null entityLifecycleMonitor without throwing', () => {
    const deps = createDependencies({ entityLifecycleMonitor: null });
    const facade = new DomUiFacade(deps);
    expect(facade.entityLifecycleMonitor).toBeNull();
  });

  it('uses the default entityLifecycleMonitor when the dependency is omitted', () => {
    const { entityLifecycleMonitor: _unused, ...rest } = createDependencies();
    const facade = new DomUiFacade(rest);
    expect(facade.entityLifecycleMonitor).toBeNull();
  });

  describe('constructor validation', () => {
    it.each([
      [
        'actionButtonsRenderer',
        { actionButtonsRenderer: createRenderer({}) },
        'DomUiFacade: Missing or invalid actionButtonsRenderer dependency.',
      ],
      [
        'locationRenderer',
        { locationRenderer: createRenderer({}) },
        'DomUiFacade: Missing or invalid locationRenderer dependency.',
      ],
      [
        'titleRenderer',
        { titleRenderer: createRenderer({}) },
        'DomUiFacade: Missing or invalid titleRenderer dependency.',
      ],
      [
        'inputStateController',
        { inputStateController: createRenderer({}) },
        'DomUiFacade: Missing or invalid inputStateController dependency.',
      ],
      [
        'speechBubbleRenderer',
        { speechBubbleRenderer: createRenderer({}) },
        'DomUiFacade: Missing or invalid speechBubbleRenderer dependency.',
      ],
      [
        'perceptionLogRenderer',
        { perceptionLogRenderer: createRenderer({}) },
        'DomUiFacade: Missing or invalid perceptionLogRenderer dependency.',
      ],
      [
        'actionResultRenderer',
        { actionResultRenderer: null },
        'DomUiFacade: Missing or invalid actionResultRenderer dependency.',
      ],
      [
        'saveGameUI',
        { saveGameUI: createRenderer({}) },
        'DomUiFacade: Missing or invalid saveGameUI dependency.',
      ],
      [
        'loadGameUI',
        { loadGameUI: createRenderer({}) },
        'DomUiFacade: Missing or invalid loadGameUI dependency.',
      ],
      [
        'llmSelectionModal',
        { llmSelectionModal: createRenderer({}) },
        'DomUiFacade: Missing or invalid llmSelectionModal dependency.',
      ],
      [
        'entityLifecycleMonitor',
        { entityLifecycleMonitor: { dispose: jest.fn() } },
        'DomUiFacade: Invalid entityLifecycleMonitor dependency.',
      ],
    ])('validates the %s dependency', (_, override, expectedMessage) => {
      expect(() => new DomUiFacade(createDependencies(override))).toThrow(
        expectedMessage,
      );
    });
  });

  it('invokes dispose on each dependency when available', () => {
    const deps = createDependencies();
    const facade = new DomUiFacade(deps);

    facade.dispose();

    expect(deps.actionButtonsRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(deps.locationRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(deps.titleRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(deps.inputStateController.dispose).toHaveBeenCalledTimes(1);
    expect(deps.speechBubbleRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(deps.perceptionLogRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(deps.actionResultRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(deps.saveGameUI.dispose).toHaveBeenCalledTimes(1);
    expect(deps.loadGameUI.dispose).toHaveBeenCalledTimes(1);
    expect(deps.llmSelectionModal.dispose).toHaveBeenCalledTimes(1);
    expect(deps.entityLifecycleMonitor.dispose).toHaveBeenCalledTimes(1);
  });

  it('skips dispose calls gracefully when dependencies omit the method', () => {
    const depsWithoutDispose = createDependencies({
      actionButtonsRenderer: { refreshList: jest.fn() },
      locationRenderer: { render: jest.fn() },
      titleRenderer: { set: jest.fn() },
      inputStateController: { setEnabled: jest.fn() },
      speechBubbleRenderer: { renderSpeech: jest.fn() },
      perceptionLogRenderer: { refreshList: jest.fn() },
      actionResultRenderer: {},
      saveGameUI: { show: jest.fn() },
      loadGameUI: { show: jest.fn() },
      llmSelectionModal: { show: jest.fn() },
      entityLifecycleMonitor: null,
    });

    const facade = new DomUiFacade(depsWithoutDispose);

    expect(() => facade.dispose()).not.toThrow();
  });
});
