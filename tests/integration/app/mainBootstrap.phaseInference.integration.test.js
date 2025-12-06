import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';

const mockStageModules = {
  ensureCriticalDOMElementsStage: jest.fn(),
  setupDIContainerStage: jest.fn(),
  resolveLoggerStage: jest.fn(),
  initializeGlobalConfigStage: jest.fn(),
  initializeGameEngineStage: jest.fn(),
  initializeAuxiliaryServicesStage: jest.fn(),
  setupMenuButtonListenersStage: jest.fn(),
  setupGlobalEventListenersStage: jest.fn(),
  startGameStage: jest.fn(),
};

jest.mock('../../../src/bootstrapper/stages/index.js', () => mockStageModules);

describe('main.js bootstrap phase inference coverage', () => {
  let consoleErrorSpy;
  let originalAlert;

  beforeEach(() => {
    Object.values(mockStageModules).forEach((mockFn) => mockFn.mockReset());

    originalAlert = global.alert;
    global.alert = jest.fn();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = '';
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    global.alert = originalAlert;
    delete global.fetch;
    delete window.bootstrapApp;
    delete window.beginGame;
    document.body.innerHTML = '';
  });

  it('infers failure phase when DI setup fails without explicit phase metadata', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Story Engine</h1>
    `;

    const domUiElements = {
      outputDiv: document.getElementById('outputDiv'),
      errorDiv: document.getElementById('error-output'),
      titleElement: document.querySelector('h1'),
      inputElement: document.getElementById('speech-input'),
      document,
    };

    const diError = new Error('Failed to configure DI container');
    let setPhaseHelper;

    mockStageModules.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: true,
      payload: domUiElements,
    });

    mockStageModules.setupDIContainerStage.mockImplementation(async () => {
      if (setPhaseHelper) {
        setPhaseHelper(null);
      }
      return { success: false, error: diError };
    });

    // Stages after DI should never run, but keep predictable resolves
    mockStageModules.resolveLoggerStage.mockResolvedValue({
      success: true,
      payload: { logger: null },
    });
    mockStageModules.initializeGlobalConfigStage.mockResolvedValue({
      success: true,
    });
    mockStageModules.initializeGameEngineStage.mockResolvedValue({
      success: true,
      payload: {},
    });

    const fetchedConfig = { startWorld: 'azure-bay' };
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => fetchedConfig });

    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });
    setPhaseHelper = mainModule.__TEST_ONLY__setCurrentPhaseForError;

    await mainModule.bootstrapApp();

    expect(mockStageModules.setupDIContainerStage).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap error caught in main orchestrator'),
      diError
    );

    expect(
      consoleErrorSpy.mock.calls.some(([message]) =>
        message.includes('Bootstrap Orchestration - DI Container Setup')
      )
    ).toBe(true);

    expect(domUiElements.errorDiv?.textContent).toContain(
      'Application failed to start due to a critical error'
    );
    expect(domUiElements.titleElement?.textContent).toContain('Fatal Error');
    expect(domUiElements.inputElement?.disabled).toBe(true);
  });

  it('uses fallback DOM helpers when UI stage throws before returning elements and fetch fails', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Story Engine</h1>
    `;

    const stageFailure = new Error('UI bootstrap exploded');

    mockStageModules.ensureCriticalDOMElementsStage.mockImplementation(
      async () => {
        throw stageFailure;
      }
    );

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });

    await mainModule.bootstrapApp();

    expect(global.fetch).toHaveBeenCalledWith('./data/game.json');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load startWorld from game.json:',
      expect.any(Error)
    );

    expect(
      consoleErrorSpy.mock.calls.some(([message]) =>
        message.includes('Bootstrap Orchestration - UI Element Validation')
      )
    ).toBe(true);

    const errorOutput = document.getElementById('error-output');
    expect(errorOutput?.textContent).toContain(
      'Application failed to start due to a critical error'
    );

    const input = document.getElementById('speech-input');
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input?.disabled).toBe(true);
    expect(global.alert).not.toHaveBeenCalled();
  });

  it('surfaces fatal error when beginGame is invoked without bootstrap initialization', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Story Engine</h1>
    `;

    const domUiElements = {
      outputDiv: document.getElementById('outputDiv'),
      errorDiv: document.getElementById('error-output'),
      titleElement: document.querySelector('h1'),
      inputElement: document.getElementById('speech-input'),
      document,
    };

    const container = {};
    const logger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };

    mockStageModules.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: true,
      payload: domUiElements,
    });

    mockStageModules.setupDIContainerStage.mockResolvedValue({
      success: true,
      payload: container,
    });

    mockStageModules.resolveLoggerStage.mockResolvedValue({
      success: true,
      payload: { logger },
    });

    mockStageModules.initializeGlobalConfigStage.mockResolvedValue({
      success: true,
    });

    const engineError = new Error('engine boot failed');
    mockStageModules.initializeGameEngineStage.mockResolvedValue({
      success: false,
      error: engineError,
    });

    const fetchedConfig = { startWorld: 'evergreen' };
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => fetchedConfig });

    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });
    const { bootstrapApp, beginGame } = mainModule;

    await bootstrapApp();

    await expect(beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(
      logger.error.mock.calls.some(([message]) =>
        message.includes(
          'main.js: Critical: GameEngine not initialized before attempting Start Game stage.'
        )
      )
    ).toBe(true);

    const errorOutput = document.getElementById('error-output');
    expect(errorOutput?.textContent).toContain(
      'Critical: GameEngine not initialized'
    );

    const title = document.querySelector('h1');
    expect(title?.textContent).toContain('Fatal Error');
    expect(global.alert).not.toHaveBeenCalled();
  });
});
