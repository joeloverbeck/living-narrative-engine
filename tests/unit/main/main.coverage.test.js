import {
  jest,
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
} from '@jest/globals';
import { createMainBootstrapContainerMock } from '../../common/mockFactories/mainBootstrapContainer.js';

const mockEnsure = jest.fn();
const mockSetupDI = jest.fn();
const mockResolveCore = jest.fn();
const mockInitGlobalConfig = jest.fn();
const mockInitEngine = jest.fn();
const mockInitAux = jest.fn();
const mockMenu = jest.fn();
const mockGlobal = jest.fn();
const mockStartGame = jest.fn();
const mockDisplayFatal = jest.fn();

jest.mock('../../../src/bootstrapper/stages/index.js', () => ({
  __esModule: true,
  ensureCriticalDOMElementsStage: (...args) => mockEnsure(...args),
  setupDIContainerStage: (...args) => mockSetupDI(...args),
  resolveLoggerStage: (...args) => mockResolveCore(...args),
  initializeGlobalConfigStage: (...args) => mockInitGlobalConfig(...args),
  initializeGameEngineStage: (...args) => mockInitEngine(...args),
  setupMenuButtonListenersStage: (...args) => mockMenu(...args),
  setupGlobalEventListenersStage: (...args) => mockGlobal(...args),
  startGameStage: (...args) => mockStartGame(...args),
  initializeAuxiliaryServicesStage: (...args) => mockInitAux(...args),
}));

jest.mock('../../../src/utils/errorUtils.js', () => ({
  __esModule: true,
  displayFatalStartupError: (...args) => mockDisplayFatal(...args),
}));

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => ({
  __esModule: true,
  configureContainer: jest.fn(),
}));

/**
 * Helper to execute all DOM helper utilities passed to displayFatalStartupError.
 *
 * @param {object} helpers
 * @param {{text?: string, color?: string, alertMessage?: string}} [options]
 */
function exerciseDomHelpers(
  helpers,
  { text = 'hi', color = 'red', alertMessage = 'msg' } = {}
) {
  const anchor = document.createElement('div');
  document.body.appendChild(anchor);
  const created = helpers.createElement('p');
  helpers.insertAfter(anchor, created);
  helpers.setTextContent(created, text);
  helpers.setStyle(created, 'color', color);
  helpers.alert(alertMessage);

  expect(created.textContent).toBe(text);
  expect(created.style.color).toBe(color);
  expect(window.alert).toHaveBeenLastCalledWith(alertMessage);

  anchor.remove();
}

describe('main.js uncovered branches', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Mock fetch to prevent real HTTP requests
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'default' }),
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.resetModules();
    jest.clearAllMocks();
    // Clean up fetch mock
    if (global.fetch) delete global.fetch;
    document.body.innerHTML = '';
  });

  it('executes factory helpers during bootstrap', async () => {
    window.history.pushState({}, '', '?start=false');
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Title</h1>
    `;
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: document.querySelector('#error-output'),
      inputElement: document.querySelector('#speech-input'),
      titleElement: document.querySelector('h1'),
      document,
    };

    const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() };

    mockEnsure.mockImplementation(async (doc, opts) => {
      opts.createUIBootstrapper();
      return { success: true, payload: uiElements };
    });
    mockSetupDI.mockImplementation(async (elements, configure, opts) => {
      opts.createAppContainer();
      return { success: true, payload: createMainBootstrapContainerMock() };
    });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitGlobalConfig.mockResolvedValue({ success: true });
    mockInitEngine.mockImplementation(async (container, log, opts) => {
      opts.createGameEngine();
      return { success: true, payload: {} };
    });
    mockInitAux.mockResolvedValue({ success: true });
    mockMenu.mockResolvedValue({ success: true });
    mockGlobal.mockResolvedValue({ success: true });
    mockStartGame.mockResolvedValue({ success: true });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();
    await Promise.resolve();
    jest.runAllTimers();

    // verify mocks were called inside stage implementations
    expect(mockEnsure).toHaveBeenCalled();
    expect(mockSetupDI).toHaveBeenCalled();
    expect(mockInitEngine).toHaveBeenCalled();
  });

  it('invokes DOM helper functions on fatal error', async () => {
    window.alert = jest.fn();
    window.history.pushState({}, '', '?start=false');
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Title</h1>
    `;
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: document.querySelector('#error-output'),
      inputElement: document.querySelector('#speech-input'),
      titleElement: document.querySelector('h1'),
      document,
    };
    const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() };

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: createMainBootstrapContainerMock() });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitGlobalConfig.mockResolvedValue({ success: true });
    mockInitEngine.mockResolvedValue({ success: true, payload: {} });
    mockInitAux.mockResolvedValue({ success: true });
    mockMenu.mockResolvedValue({ success: true });
    mockGlobal.mockResolvedValue({ success: true });
    mockStartGame.mockResolvedValue({
      success: false,
      error: new Error('boom'),
    });

    const main = await import('../../../src/main.js');
    await main.bootstrapApp();
    await Promise.resolve();
    jest.runAllTimers();
    await expect(main.beginGame()).rejects.toThrow();
    await Promise.resolve();
    jest.runAllTimers();

    expect(mockDisplayFatal).toHaveBeenCalled();
    const [, , , helpers] = mockDisplayFatal.mock.calls[0];
    exerciseDomHelpers(helpers);
  });

  it('shows the load game UI when requested and supported by the engine', async () => {
    window.history.pushState({}, '', '?start=false');
    document.body.innerHTML = `
      <div id="outputDiv"></div>
    `;
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: null,
      inputElement: null,
      titleElement: null,
      document,
    };
    const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() };
    const showLoadGameUI = jest.fn().mockResolvedValue(undefined);

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: createMainBootstrapContainerMock() });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitGlobalConfig.mockResolvedValue({ success: true });
    mockInitEngine.mockResolvedValue({
      success: true,
      payload: { showLoadGameUI },
    });
    mockInitAux.mockResolvedValue({ success: true });
    mockMenu.mockResolvedValue({ success: true });
    mockGlobal.mockResolvedValue({ success: true });
    mockStartGame.mockResolvedValue({ success: true });

    const main = await import('../../../src/main.js');
    await main.bootstrapApp();
    await Promise.resolve();
    jest.runAllTimers();

    await main.beginGame(true);
    await Promise.resolve();
    jest.runAllTimers();

    expect(mockStartGame).toHaveBeenCalled();
    expect(showLoadGameUI).toHaveBeenCalledTimes(1);
  });

  it('falls back to default UI helpers when bootstrap fails early', async () => {
    const originalAlert = window.alert;
    const originalConsoleError = console.error;
    window.alert = jest.fn();
    console.error = jest.fn();

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Title</h1>
    `;

    const stageError = new Error('UI bootstrap failure');
    stageError.phase = 'UI Element Validation';
    stageError.failures = [
      { service: 'UIBootstrapper', error: new Error('broken dependency') },
    ];

    mockEnsure.mockResolvedValue({ success: false, error: stageError });

    try {
      const main = await import('../../../src/main.js');
      await main.bootstrapApp();
      await Promise.resolve();
      jest.runAllTimers();

      expect(global.fetch).toHaveBeenCalledWith('./data/game.json');
      expect(console.error).toHaveBeenCalledWith(
        'Failed to load startWorld from game.json:',
        expect.any(Error)
      );

      expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
      const [elements, errorDetails, passedLogger, helpers] =
        mockDisplayFatal.mock.calls[0];

      expect(elements.outputDiv).toBe(document.getElementById('outputDiv'));
      expect(errorDetails.phase).toBe('UI Element Validation');
      expect(passedLogger).toBeNull();

      exerciseDomHelpers(helpers, {
        text: 'bootstrap failed',
        color: 'orange',
        alertMessage: 'fatal bootstrap',
      });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Bootstrap error caught'),
        stageError
      );
      expect(console.error).toHaveBeenCalledWith(
        'main.js: Failed to init UIBootstrapper',
        stageError.failures[0].error
      );
    } finally {
      window.alert = originalAlert;
      console.error = originalConsoleError;
    }
  });

  it('reports fatal error when beginGame runs without bootstrap', async () => {
    const originalAlert = window.alert;
    const originalConsoleError = console.error;
    window.alert = jest.fn();
    console.error = jest.fn();

    try {
      const main = await import('../../../src/main.js');

      await expect(main.beginGame(true)).rejects.toThrow(
        'Critical: GameEngine not initialized before attempting Start Game stage.'
      );

      expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
      const [elements, errorDetails, passedLogger, helpers] =
        mockDisplayFatal.mock.calls[0];

      // beginGame now provides fallback UI elements when uiElements is undefined
      // DOM elements may be null if not set up in the test
      expect(elements).toEqual(
        expect.objectContaining({
          document: expect.anything(),
        })
      );
      expect(elements).toHaveProperty('outputDiv');
      expect(elements).toHaveProperty('errorDiv');
      expect(elements).toHaveProperty('inputElement');
      expect(errorDetails.phase).toBe('Start Game');
      expect(errorDetails.userMessage).toContain('Critical: GameEngine not initialized');
      expect(passedLogger).toBeNull();

      exerciseDomHelpers(helpers, {
        text: 'no engine ready',
        color: 'purple',
        alertMessage: 'begin game failure',
      });

      expect(console.error).toHaveBeenCalledWith(
        'main.js: Critical: GameEngine not initialized before attempting Start Game stage.'
      );
    } finally {
      window.alert = originalAlert;
      console.error = originalConsoleError;
    }
  });
});
