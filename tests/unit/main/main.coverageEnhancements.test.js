import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { createMainBootstrapContainerMock } from '../../common/mockFactories/mainBootstrapContainer.js';

const mockStages = {
  ensure: jest.fn(),
  setupDI: jest.fn(),
  resolveLogger: jest.fn(),
  initGlobalConfig: jest.fn(),
  initGameEngine: jest.fn(),
  initAuxiliary: jest.fn(),
  setupMenu: jest.fn(),
  setupGlobal: jest.fn(),
  startGame: jest.fn(),
};

const mockDisplayFatalStartupError = jest.fn();

jest.mock('../../../src/bootstrapper/stages/index.js', () => ({
  __esModule: true,
  ensureCriticalDOMElementsStage: (...args) => mockStages.ensure(...args),
  setupDIContainerStage: (...args) => mockStages.setupDI(...args),
  resolveLoggerStage: (...args) => mockStages.resolveLogger(...args),
  initializeGlobalConfigStage: (...args) =>
    mockStages.initGlobalConfig(...args),
  initializeGameEngineStage: (...args) => mockStages.initGameEngine(...args),
  initializeAuxiliaryServicesStage: (...args) =>
    mockStages.initAuxiliary(...args),
  setupMenuButtonListenersStage: (...args) => mockStages.setupMenu(...args),
  setupGlobalEventListenersStage: (...args) => mockStages.setupGlobal(...args),
  startGameStage: (...args) => mockStages.startGame(...args),
}));

jest.mock('../../../src/utils/errorUtils.js', () => ({
  __esModule: true,
  displayFatalStartupError: (...args) => mockDisplayFatalStartupError(...args),
}));

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => ({
  __esModule: true,
  configureContainer: jest.fn(),
}));

jest.mock('../../../src/bootstrapper/UIBootstrapper.js', () => ({
  __esModule: true,
  UIBootstrapper: class MockUIBootstrapper {},
}));

jest.mock('../../../src/dependencyInjection/appContainer.js', () => ({
  __esModule: true,
  default: class MockAppContainer {},
}));

jest.mock('../../../src/engine/gameEngine.js', () => ({
  __esModule: true,
  default: class MockGameEngine {
    constructor(options = {}) {
      this.logger = options.logger;
      this.showLoadGameUI = jest.fn().mockResolvedValue(undefined);
    }
  },
}));

describe('main.js high fidelity coverage', () => {
  const originalFetch = global.fetch;
  const originalAlert = global.alert;
  const originalConsoleError = console.error;

  /** @type {ReturnType<typeof buildUiElements>} */
  let defaultUiElements;
  /** @type {{ debug: jest.Mock, error: jest.Mock, info: jest.Mock }} */
  let logger;
  /** @type {{ showLoadGameUI: jest.Mock }} */
  let gameEngine;

  /**
   *
   * @param doc
   */
  function buildUiElements(doc = document) {
    return {
      outputDiv: doc.getElementById('outputDiv'),
      errorDiv: doc.getElementById('error-output'),
      inputElement: doc.getElementById('speech-input'),
      titleElement: doc.querySelector('h1'),
      document: doc,
    };
  }

  /**
   *
   */
  async function importMainModule() {
    return import('../../../src/main.js');
  }

  /**
   *
   */
  function prepareHappyPathStages() {
    logger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };
    gameEngine = { showLoadGameUI: jest.fn().mockResolvedValue(undefined) };

    mockStages.ensure.mockResolvedValue({
      success: true,
      payload: defaultUiElements,
    });
    mockStages.setupDI.mockResolvedValue({
      success: true,
      payload: createMainBootstrapContainerMock(),
    });
    mockStages.resolveLogger.mockResolvedValue({
      success: true,
      payload: { logger },
    });
    mockStages.initGlobalConfig.mockResolvedValue({ success: true });
    mockStages.initGameEngine.mockResolvedValue({
      success: true,
      payload: gameEngine,
    });
    mockStages.initAuxiliary.mockResolvedValue({ success: true });
    mockStages.setupMenu.mockResolvedValue({ success: true });
    mockStages.setupGlobal.mockResolvedValue({ success: true });
    mockStages.startGame.mockResolvedValue({ success: true });
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Bootstrap</h1>
    `;

    defaultUiElements = buildUiElements();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'world-from-config' }),
    });

    global.alert = jest.fn();
    console.error = jest.fn();

    prepareHappyPathStages();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    mockDisplayFatalStartupError.mockReset();

    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }

    if (originalAlert) {
      global.alert = originalAlert;
    } else {
      delete global.alert;
    }

    console.error = originalConsoleError;
  });

  it('falls back to default world when configuration fetch fails', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const main = await importMainModule();
    await main.bootstrapApp();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to load startWorld from game.json:',
      expect.any(Error)
    );

    await main.beginGame();

    expect(mockStages.startGame).toHaveBeenCalledWith(
      gameEngine,
      'default',
      logger
    );
    expect(mockDisplayFatalStartupError).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('provides DOM helpers and detected phase when initial UI validation fails', async () => {
    const stageError = new Error('UI bootstrap failed');
    stageError.failures = [
      { service: 'Telemetry', error: new Error('offline') },
      { service: 'CachePriming', error: new Error('unavailable') },
    ];

    const main = await importMainModule();
    const setPhase = main.__TEST_ONLY__setCurrentPhaseForError;

    mockStages.ensure.mockImplementation(async () => {
      setPhase(null);
      return { success: false, error: stageError };
    });

    await main.bootstrapApp();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [fallbackElements, errorDetails, passedLogger, domHelpers] =
      mockDisplayFatalStartupError.mock.calls[0];

    expect(fallbackElements.outputDiv).toBeInstanceOf(HTMLElement);
    expect(fallbackElements.errorDiv).toBeInstanceOf(HTMLElement);
    expect(fallbackElements.inputElement).toBeInstanceOf(HTMLElement);
    expect(fallbackElements.document).toBe(document);
    expect(errorDetails.phase).toBe(
      'Bootstrap Orchestration - UI Element Validation'
    );
    expect(passedLogger).toBeNull();

    const anchor = document.getElementById('outputDiv');
    const helperNode = domHelpers.createElement('p');
    domHelpers.setTextContent(helperNode, 'ui bootstrap failure');
    domHelpers.setStyle(helperNode, 'color', 'crimson');
    domHelpers.insertAfter(anchor, helperNode);
    domHelpers.alert('notify-admins');

    expect(helperNode.textContent).toBe('ui bootstrap failure');
    expect(helperNode.style.color).toBe('crimson');
    expect(anchor?.nextSibling).toBe(helperNode);
    expect(global.alert).toHaveBeenCalledWith('notify-admins');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('main.js: Failed to init Telemetry'),
      stageError.failures[0].error
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('main.js: Failed to init CachePriming'),
      stageError.failures[1].error
    );
  });

  it('derives core services phase when logger resolution fails without explicit phase', async () => {
    const main = await importMainModule();
    const setPhase = main.__TEST_ONLY__setCurrentPhaseForError;

    mockStages.resolveLogger.mockImplementation(async () => {
      setPhase(null);
      return {
        success: false,
        error: Object.assign(new Error('logger failure'), { failures: [] }),
      };
    });

    await main.bootstrapApp();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [elements, errorDetails, passedLogger] =
      mockDisplayFatalStartupError.mock.calls[0];

    expect(elements).toBe(defaultUiElements);
    expect(errorDetails.phase).toBe(
      'Bootstrap Orchestration - Core Services Resolution'
    );
    expect(passedLogger).toBeNull();
  });

  it('surfaces application runtime phase when auxiliary services fail', async () => {
    const auxError = new Error('auxiliary service crash');
    auxError.failures = [
      { service: 'EntityCache', error: new Error('cache corrupted') },
    ];

    const main = await importMainModule();
    const setPhase = main.__TEST_ONLY__setCurrentPhaseForError;

    mockStages.initAuxiliary.mockImplementation(async () => {
      setPhase(null);
      return { success: false, error: auxError };
    });

    await main.bootstrapApp();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [, errorDetails, passedLogger] =
      mockDisplayFatalStartupError.mock.calls[0];

    expect(errorDetails.phase).toBe(
      'Bootstrap Orchestration - Application Logic/Runtime'
    );
    expect(passedLogger).toBe(logger);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('main.js: Failed to init EntityCache'),
      auxError.failures[0].error
    );
  });

  it('reports fatal errors when game start stage fails', async () => {
    const main = await importMainModule();
    await main.bootstrapApp();

    const startError = new Error('start stage failure');
    mockStages.startGame.mockResolvedValueOnce({
      success: false,
      error: startError,
    });

    await expect(main.beginGame(true)).rejects.toThrow('start stage failure');

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [elements, errorDetails, passedLogger, domHelpers] =
      mockDisplayFatalStartupError.mock.calls[0];

    expect(elements).toBe(defaultUiElements);
    expect(errorDetails.phase).toBe('Start Game');
    expect(passedLogger).toBe(logger);

    const helperDiv = domHelpers.createElement('div');
    domHelpers.setTextContent(helperDiv, 'start failed');
    domHelpers.setStyle(helperDiv, 'backgroundColor', 'orange');
    domHelpers.insertAfter(defaultUiElements.outputDiv, helperDiv);

    expect(helperDiv.textContent).toBe('start failed');
    expect(helperDiv.style.backgroundColor).toBe('orange');
  });

  it('throws and surfaces fatal error when beginGame executes before bootstrap', async () => {
    const main = await importMainModule();

    await expect(main.beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [elements, errorDetails, passedLogger] =
      mockDisplayFatalStartupError.mock.calls[0];

    // beginGame now provides fallback UI elements when uiElements is undefined
    expect(elements).toMatchObject({
      outputDiv: expect.anything(),
      errorDiv: expect.anything(),
      inputElement: expect.anything(),
      document: expect.anything(),
    });
    expect(errorDetails.phase).toBe('Start Game');
    expect(errorDetails.consoleMessage).toBe(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );
    expect(passedLogger).toBeNull();
  });
});
