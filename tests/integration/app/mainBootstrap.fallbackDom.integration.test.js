import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

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

describe('main.js bootstrap fallback DOM integration', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules();
    Object.values(mockStageModules).forEach((mockFn) => mockFn.mockReset());

    global.alert = jest.fn();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    delete global.fetch;
    delete global.alert;
    delete window.bootstrapApp;
    delete window.beginGame;
    document.body.innerHTML = '';
  });

  it('uses real fatal error handler with fallback DOM helpers when bootstrap fails before UI elements resolve', async () => {
    const stageError = new Error('UI bootstrap failed');
    stageError.phase = 'UI Element Validation';
    stageError.failures = [
      { service: 'UIBootstrapper', error: new Error('missing essential nodes') },
      { service: 'UIBinder', error: new Error('unable to attach listeners') },
    ];

    mockStageModules.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: false,
      error: stageError,
    });

    document.body.innerHTML = `
      <main id="root">
        <div id="outputDiv"></div>
        <input id="speech-input" />
      </main>
    `;

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    });

    const { bootstrapApp } = await import('../../../src/main.js');

    await bootstrapApp();

    expect(mockStageModules.ensureCriticalDOMElementsStage).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('./data/game.json');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load startWorld from game.json:',
      expect.any(Error),
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap error caught in main orchestrator'),
      stageError,
    );

    for (const failure of stageError.failures) {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `main.js: Failed to init ${failure.service}`,
        failure.error,
      );
    }

    const fallbackElement = document.getElementById('temp-startup-error');
    expect(fallbackElement).toBeInstanceOf(HTMLElement);
    expect(fallbackElement?.textContent).toContain('Application failed to start due to a critical error');

    // Title element no longer exists in game.html - verify it's absent
    const title = document.querySelector('h1');
    expect(title).toBeNull();

    const input = document.getElementById('speech-input');
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input?.disabled).toBe(true);
    expect(input?.placeholder).toContain('Application failed to start');
    expect(global.alert).not.toHaveBeenCalled();
  });

  it('reuses fallback DOM helpers when beginGame is invoked without an initialized engine', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
    `;

    const domUiElements = {
      outputDiv: document.getElementById('outputDiv'),
      errorDiv: document.getElementById('error-output'),
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

    mockStageModules.setupDIContainerStage.mockResolvedValue({ success: true, payload: container });
    mockStageModules.resolveLoggerStage.mockResolvedValue({ success: true, payload: { logger } });
    mockStageModules.initializeGlobalConfigStage.mockResolvedValue({ success: true });
    mockStageModules.initializeGameEngineStage.mockResolvedValue({
      success: false,
      error: new Error('Engine initialization failed'),
    });

    const fetchedConfig = { startWorld: 'evergreen' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => fetchedConfig,
    });

    const { bootstrapApp, beginGame } = await import('../../../src/main.js');

    await bootstrapApp();

    await expect(beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(
      logger.error.mock.calls.some(([message]) =>
        message.includes('main.js: Critical: GameEngine not initialized before attempting Start Game stage.')
      )
    ).toBe(true);

    expect(domUiElements.errorDiv?.textContent).toContain('Critical: GameEngine not initialized');

    expect(domUiElements.inputElement).toBeInstanceOf(HTMLInputElement);
    expect(domUiElements.inputElement?.disabled).toBe(true);
    expect(global.alert).not.toHaveBeenCalled();
  });
});
