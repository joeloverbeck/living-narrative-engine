import {
  jest,
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
} from '@jest/globals';

const mockEnsure = jest.fn();
const mockSetupDI = jest.fn();
const mockResolveLogger = jest.fn();
const mockInitGlobalConfig = jest.fn();
const mockInitGameEngine = jest.fn();
const mockInitAux = jest.fn();
const mockMenuStage = jest.fn();
const mockGlobalStage = jest.fn();
const mockStartGameStage = jest.fn();
const mockDisplayFatalStartupError = jest.fn();

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
    constructor(opts = {}) {
      Object.assign(this, opts);
    }
  },
}));

jest.mock('../../../src/bootstrapper/stages/index.js', () => ({
  __esModule: true,
  ensureCriticalDOMElementsStage: (...args) => mockEnsure(...args),
  setupDIContainerStage: (...args) => mockSetupDI(...args),
  resolveLoggerStage: (...args) => mockResolveLogger(...args),
  initializeGlobalConfigStage: (...args) => mockInitGlobalConfig(...args),
  initializeGameEngineStage: (...args) => mockInitGameEngine(...args),
  initializeAuxiliaryServicesStage: (...args) => mockInitAux(...args),
  setupMenuButtonListenersStage: (...args) => mockMenuStage(...args),
  setupGlobalEventListenersStage: (...args) => mockGlobalStage(...args),
  startGameStage: (...args) => mockStartGameStage(...args),
}));

jest.mock('../../../src/utils/errorUtils.js', () => ({
  __esModule: true,
  displayFatalStartupError: (...args) => mockDisplayFatalStartupError(...args),
}));

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => ({
  __esModule: true,
  configureContainer: jest.fn(),
}));

/**
 *
 */
function buildUIElements() {
  return {
    outputDiv: document.getElementById('outputDiv'),
    errorDiv: document.getElementById('error-output'),
    inputElement: document.getElementById('speech-input'),
    document,
  };
}

/**
 *
 * @param logger
 * @param gameEngine
 */
function primeSuccessfulStages(logger, gameEngine) {
  mockEnsure.mockImplementation(async (doc, { createUIBootstrapper }) => {
    if (typeof createUIBootstrapper === 'function') {
      createUIBootstrapper();
    }
    return { success: true, payload: buildUIElements() };
  });
  mockSetupDI.mockImplementation(async (elements, configureContainer, { createAppContainer }) => {
    if (typeof createAppContainer === 'function') {
      createAppContainer();
    }
    return { success: true, payload: {} };
  });
  mockResolveLogger.mockResolvedValue({ success: true, payload: { logger } });
  mockInitGlobalConfig.mockResolvedValue({ success: true });
  mockInitGameEngine.mockImplementation(async (container, resolvedLogger, { createGameEngine }) => {
    if (typeof createGameEngine === 'function') {
      createGameEngine({ logger: resolvedLogger });
    }
    return { success: true, payload: gameEngine };
  });
  mockInitAux.mockResolvedValue({ success: true });
  mockMenuStage.mockResolvedValue({ success: true });
  mockGlobalStage.mockResolvedValue({ success: true });
  mockStartGameStage.mockResolvedValue({ success: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEnsure.mockReset();
  mockSetupDI.mockReset();
  mockResolveLogger.mockReset();
  mockInitGlobalConfig.mockReset();
  mockInitGameEngine.mockReset();
  mockInitAux.mockReset();
  mockMenuStage.mockReset();
  mockGlobalStage.mockReset();
  mockStartGameStage.mockReset();
  mockDisplayFatalStartupError.mockReset();
  document.body.innerHTML = `
    <div id="outputDiv"></div>
    <div id="error-output"></div>
    <input id="speech-input" />
  `;
  delete global.fetch;
  delete global.alert;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('main.js additional coverage', () => {
  it('runs full bootstrap flow and honours manual start world overrides', async () => {
    const logger = { debug: jest.fn(), error: jest.fn(), info: jest.fn() };
    const gameEngine = { showLoadGameUI: jest.fn() };
    primeSuccessfulStages(logger, gameEngine);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'alpha-centauri' }),
    });

    mockDisplayFatalStartupError.mockImplementation(() => {});

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();
    main.__TEST_ONLY__setStartWorld('manual-world');
    await main.beginGame(true);

    expect(mockEnsure).toHaveBeenCalledTimes(1);
    expect(mockSetupDI).toHaveBeenCalledTimes(1);
    expect(mockResolveLogger).toHaveBeenCalledTimes(1);
    expect(mockInitGlobalConfig).toHaveBeenCalledTimes(1);
    expect(mockInitGameEngine).toHaveBeenCalledTimes(1);
    expect(mockInitAux).toHaveBeenCalledTimes(1);
    expect(mockMenuStage).toHaveBeenCalledTimes(1);
    expect(mockGlobalStage).toHaveBeenCalledTimes(1);
    expect(mockStartGameStage).toHaveBeenCalledWith(gameEngine, 'manual-world', logger);
    expect(gameEngine.showLoadGameUI).toHaveBeenCalledTimes(1);
    expect(mockDisplayFatalStartupError).not.toHaveBeenCalled();
  });

  it('uses test-only phase setter when beginGame is invoked before bootstrap', async () => {
    mockDisplayFatalStartupError.mockImplementation((uiElements, details, passedLogger, helpers) => {
      const ref = document.createElement('div');
      ref.insertAdjacentElement = jest.fn();
      const created = helpers.createElement('div');
      helpers.insertAfter(ref, created);
      helpers.setTextContent(created, details.consoleMessage);
      helpers.setStyle(created, 'color', 'red');
      helpers.alert('bootstrap begin');
      expect(passedLogger).toBeNull();
      // beginGame now provides fallback UI elements when uiElements is undefined
      expect(uiElements).toMatchObject({
        outputDiv: expect.anything(),
        errorDiv: expect.anything(),
        inputElement: expect.anything(),
        document: expect.anything(),
      });
    });
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const alertSpy = jest.fn();
    global.alert = alertSpy;

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    main.__TEST_ONLY__setCurrentPhaseForError('Manual Phase');

    await expect(main.beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [, details] = mockDisplayFatalStartupError.mock.calls[0];
    expect(details.phase).toBe('Start Game');
    expect(alertSpy).toHaveBeenCalledWith('bootstrap begin');

    consoleErrorSpy.mockRestore();
  });

  it('allows test overrides to influence detected bootstrap phase', async () => {
    mockEnsure.mockResolvedValue({ success: true, payload: buildUIElements() });
    mockDisplayFatalStartupError.mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'unused' }),
    });
    global.alert = jest.fn();

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    mockSetupDI.mockImplementationOnce(() => {
      main.__TEST_ONLY__setCurrentPhaseForError('Custom Phase');
      return Promise.resolve({ success: false, error: new Error('DI explode') });
    });

    await main.bootstrapApp();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [, details] = mockDisplayFatalStartupError.mock.calls[0];
    expect(details.phase).toBe('Bootstrap Orchestration - Custom Phase');
  });

  it('provides DOM fallbacks when bootstrap fails before UI elements exist', async () => {
    const aggregateError = new Error('UI bootstrap failed');
    aggregateError.phase = 'UI Element Validation';
    aggregateError.failures = [
      { service: 'UIBootstrapper', error: new Error('First failure') },
      { service: 'OtherService', error: new Error('Second failure') },
    ];

    mockEnsure.mockResolvedValue({ success: false, error: aggregateError });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'unused' }),
    });

    const alertSpy = jest.fn();
    global.alert = alertSpy;

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockDisplayFatalStartupError.mockImplementation((uiElements, details, logger, helpers) => {
      const ref = document.createElement('div');
      ref.insertAdjacentElement = jest.fn();
      const created = helpers.createElement('div');
      helpers.insertAfter(ref, created);
      helpers.setTextContent(created, details.consoleMessage);
      helpers.setStyle(created, 'color', 'red');
      helpers.alert('fatal alert');
      expect(logger).toBeNull();
    });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [fallbackElements] = mockDisplayFatalStartupError.mock.calls[0];
    expect(fallbackElements.outputDiv.id).toBe('outputDiv');
    expect(alertSpy).toHaveBeenCalledWith('fatal alert');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('main.js: Bootstrap error caught in main orchestrator'),
      aggregateError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'main.js: Failed to init UIBootstrapper',
      aggregateError.failures[0].error
    );

    consoleErrorSpy.mockRestore();
  });

  it('falls back to default start world when configuration fetch fails', async () => {
    const logger = { debug: jest.fn(), error: jest.fn(), info: jest.fn() };
    const gameEngine = { showLoadGameUI: jest.fn() };
    primeSuccessfulStages(logger, gameEngine);

    global.fetch = jest.fn().mockRejectedValue(new Error('network failure'));
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockDisplayFatalStartupError.mockImplementation(() => {});

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();
    await main.beginGame();

    expect(mockStartGameStage).toHaveBeenCalledWith(gameEngine, 'default', logger);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load startWorld from game.json:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('treats non-ok responses while loading start world as defaults', async () => {
    const logger = { debug: jest.fn(), error: jest.fn(), info: jest.fn() };
    const gameEngine = { showLoadGameUI: jest.fn() };
    primeSuccessfulStages(logger, gameEngine);

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockDisplayFatalStartupError.mockImplementation(() => {});

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();
    await main.beginGame();

    expect(mockStartGameStage).toHaveBeenCalledWith(gameEngine, 'default', logger);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load startWorld from game.json:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('reports startGame stage failures and exercises fatal helper functions', async () => {
    const logger = { debug: jest.fn(), error: jest.fn(), info: jest.fn() };
    const gameEngine = { showLoadGameUI: jest.fn() };
    primeSuccessfulStages(logger, gameEngine);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'terra' }),
    });

    const stageError = new Error('start failure');
    mockStartGameStage.mockResolvedValue({ success: false, error: stageError });

    const alertSpy = jest.fn();
    global.alert = alertSpy;

    mockDisplayFatalStartupError.mockImplementation((uiElements, details, passedLogger, helpers) => {
      const ref = document.createElement('div');
      ref.insertAdjacentElement = jest.fn();
      const created = helpers.createElement('div');
      helpers.insertAfter(ref, created);
      helpers.setTextContent(created, details.userMessage);
      helpers.setStyle(created, 'backgroundColor', 'black');
      helpers.alert('start failure');
      expect(passedLogger).toBe(logger);
      expect(uiElements.outputDiv.id).toBe('outputDiv');
    });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();
    await expect(main.beginGame()).rejects.toThrow(stageError);

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [, details] = mockDisplayFatalStartupError.mock.calls[0];
    expect(details.phase).toBe('Start Game');
    expect(alertSpy).toHaveBeenCalledWith('start failure');
  });
});
