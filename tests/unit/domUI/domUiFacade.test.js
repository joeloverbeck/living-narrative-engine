import { describe, it, expect, jest } from '@jest/globals';
import { DomUiFacade } from '../../../src/domUI/domUiFacade.js';

const createRenderer = (methods = {}) => ({
  dispose: jest.fn(),
  ...methods,
});

const createDependencies = (overrides = {}) => ({
  actionButtonsRenderer: createRenderer({ refreshList: jest.fn() }),
  locationRenderer: createRenderer({ render: jest.fn() }),
  inputStateController: createRenderer({ setEnabled: jest.fn() }),
  speechBubbleRenderer: createRenderer({ renderSpeech: jest.fn() }),
  perceptionLogRenderer: createRenderer({ refreshList: jest.fn() }),
  actionResultRenderer: createRenderer(),
  saveGameUI: createRenderer({ show: jest.fn() }),
  loadGameUI: createRenderer({ show: jest.fn() }),
  llmSelectionModal: createRenderer({ show: jest.fn() }),
  promptPreviewModal: createRenderer({ show: jest.fn() }),
  turnOrderTickerRenderer: createRenderer({ render: jest.fn() }),
  injuryStatusPanel: createRenderer({ updateForActor: jest.fn() }),
  entityLifecycleMonitor: createRenderer({ clearEvents: jest.fn() }),
  ...overrides,
});

describe('DomUiFacade', () => {
  it('exposes each dependency via dedicated getters', () => {
    const deps = createDependencies();
    const facade = new DomUiFacade(deps);

    expect(facade.actionButtons).toBe(deps.actionButtonsRenderer);
    expect(facade.location).toBe(deps.locationRenderer);
    expect(facade.input).toBe(deps.inputStateController);
    expect(facade.speechBubble).toBe(deps.speechBubbleRenderer);
    expect(facade.perceptionLog).toBe(deps.perceptionLogRenderer);
    expect(facade.actionResults).toBe(deps.actionResultRenderer);
    expect(facade.saveGame).toBe(deps.saveGameUI);
    expect(facade.loadGame).toBe(deps.loadGameUI);
    expect(facade.llmSelectionModal).toBe(deps.llmSelectionModal);
    expect(facade.promptPreviewModal).toBe(deps.promptPreviewModal);
    expect(facade.turnOrderTicker).toBe(deps.turnOrderTickerRenderer);
    expect(facade.injuryStatus).toBe(deps.injuryStatusPanel);
    expect(facade.entityLifecycleMonitor).toBe(deps.entityLifecycleMonitor);
  });

  it('accepts a null entityLifecycleMonitor without throwing', () => {
    const deps = createDependencies({ entityLifecycleMonitor: null });
    const facade = new DomUiFacade(deps);
    expect(facade.entityLifecycleMonitor).toBeNull();
  });

  it('uses the default entityLifecycleMonitor when the dependency is omitted', () => {
    // eslint-disable-next-line no-unused-vars
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
        'promptPreviewModal',
        { promptPreviewModal: createRenderer({}) },
        'DomUiFacade: Missing or invalid promptPreviewModal dependency.',
      ],
      [
        'turnOrderTickerRenderer',
        { turnOrderTickerRenderer: createRenderer({}) },
        'DomUiFacade: Missing or invalid turnOrderTickerRenderer dependency.',
      ],
      [
        'injuryStatusPanel',
        { injuryStatusPanel: createRenderer({}) },
        'DomUiFacade: Missing or invalid injuryStatusPanel dependency.',
      ],
      [
        'entityLifecycleMonitor',
        { entityLifecycleMonitor: { dispose: jest.fn() } },
        'DomUiFacade: Invalid entityLifecycleMonitor dependency.',
      ],
    ])('validates the %s dependency', (_, override, expectedMessage) => {
      expect(() => new DomUiFacade(createDependencies(override))).toThrow(
        expectedMessage
      );
    });
  });

  it('invokes dispose on each dependency when available', () => {
    const deps = createDependencies();
    const facade = new DomUiFacade(deps);

    facade.dispose();

    expect(deps.actionButtonsRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(deps.locationRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(deps.inputStateController.dispose).toHaveBeenCalledTimes(1);
    expect(deps.speechBubbleRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(deps.perceptionLogRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(deps.actionResultRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(deps.saveGameUI.dispose).toHaveBeenCalledTimes(1);
    expect(deps.loadGameUI.dispose).toHaveBeenCalledTimes(1);
    expect(deps.llmSelectionModal.dispose).toHaveBeenCalledTimes(1);
    expect(deps.promptPreviewModal.dispose).toHaveBeenCalledTimes(1);
    expect(deps.turnOrderTickerRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(deps.injuryStatusPanel.dispose).toHaveBeenCalledTimes(1);
    expect(deps.entityLifecycleMonitor.dispose).toHaveBeenCalledTimes(1);
  });

  it('skips dispose calls gracefully when dependencies omit the method', () => {
    const depsWithoutDispose = createDependencies({
      actionButtonsRenderer: { refreshList: jest.fn() },
      locationRenderer: { render: jest.fn() },
      inputStateController: { setEnabled: jest.fn() },
      speechBubbleRenderer: { renderSpeech: jest.fn() },
      perceptionLogRenderer: { refreshList: jest.fn() },
      actionResultRenderer: {},
      saveGameUI: { show: jest.fn() },
      loadGameUI: { show: jest.fn() },
      llmSelectionModal: { show: jest.fn() },
      promptPreviewModal: { show: jest.fn() },
      turnOrderTickerRenderer: { render: jest.fn() },
      injuryStatusPanel: { updateForActor: jest.fn() },
      entityLifecycleMonitor: null,
    });

    const facade = new DomUiFacade(depsWithoutDispose);

    expect(() => facade.dispose()).not.toThrow();
  });
});
