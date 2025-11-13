import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

const baseDom = `
  <div id="outputDiv"></div>
  <div id="error-output"></div>
  <input id="speech-input" />
`;

const domWithoutErrorDiv = `
  <div id="outputDiv"></div>
  <input id="speech-input" />
`;

function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function registerBaseMocks({ stageMocks, tokensOverride, uiFactory }) {
  const tokens = tokensOverride ?? {
    ILogger: Symbol('ILogger'),
    GamePersistenceService: Symbol('GamePersistenceService'),
    PlaytimeTracker: Symbol('PlaytimeTracker'),
    ISafeEventDispatcher: Symbol('ISafeEventDispatcher'),
  };

  jest.doMock('../../../src/dependencyInjection/containerConfig.js', () => ({
    __esModule: true,
    configureContainer: jest.fn(),
  }));

  jest.doMock('../../../src/dependencyInjection/tokens.js', () => ({
    __esModule: true,
    tokens,
  }));

  jest.doMock('../../../src/bootstrapper/UIBootstrapper.js', () => ({
    __esModule: true,
    UIBootstrapper: class {
      gatherEssentialElements() {
        return uiFactory();
      }
    },
  }));

  jest.doMock('../../../src/dependencyInjection/appContainer.js', () => ({
    __esModule: true,
    default: class {
      resolve() {
        return undefined;
      }
      isRegistered() {
        return false;
      }
    },
  }));

  jest.doMock('../../../src/engine/gameEngine.js', () => ({
    __esModule: true,
    default: class {
      constructor(opts = {}) {
        Object.assign(this, opts);
        this.showLoadGameUI = jest.fn().mockResolvedValue(undefined);
      }
    },
  }));

  jest.doMock('../../../src/bootstrapper/stages/index.js', () => stageMocks);
}

describe('main.js error handling integration', () => {
  let consoleErrorSpy;
  let consoleWarnSpy;
  let consoleInfoSpy;
  let consoleDebugSpy;

  beforeEach(() => {
    jest.resetModules();
    global.alert = jest.fn();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
    delete global.alert;
  });

  it('uses fallback DOM adapters when UI bootstrap fails before UI elements resolve', async () => {
    document.body.innerHTML = domWithoutErrorDiv;

    const logger = createLogger();
    const stageError = new Error('UI stage failed');

    const stageMocks = {
      ensureCriticalDOMElementsStage: jest
        .fn()
        .mockResolvedValue({ success: false, error: stageError }),
      setupDIContainerStage: jest.fn(),
      resolveLoggerStage: jest.fn(),
      initializeGlobalConfigStage: jest.fn(),
      initializeGameEngineStage: jest.fn(),
      initializeAuxiliaryServicesStage: jest.fn(),
      setupMenuButtonListenersStage: jest.fn(),
      setupGlobalEventListenersStage: jest.fn(),
      startGameStage: jest.fn(),
    };

    registerBaseMocks({
      stageMocks,
      uiFactory: () => ({
        outputDiv: document.getElementById('outputDiv'),
        errorDiv: null,
        inputElement: document.getElementById('speech-input'),
        document,
      }),
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const { bootstrapApp } = await import('../../../src/main.js');

    await bootstrapApp();

    expect(global.fetch).toHaveBeenCalledWith('./data/game.json');

    const tempError = document.getElementById('temp-startup-error');
    expect(tempError).not.toBeNull();
    expect(tempError?.textContent).toContain(
      'Application failed to start due to a critical error: UI stage failed'
    );

    // Title element no longer exists in game.html - verify it's absent
    const titleElement = document.querySelector('h1');
    expect(titleElement).toBeNull();

    const inputElement = document.getElementById('speech-input');
    expect(inputElement?.disabled).toBe(true);
    expect(inputElement?.placeholder).toBe('Application failed to start.');

    expect(global.alert).not.toHaveBeenCalled();
  });

  it('propagates logger-managed error handling when game engine fails to initialize and beginGame is invoked', async () => {
    document.body.innerHTML = baseDom;

    const logger = createLogger();
    const engineFailure = new Error('engine initialization failed');

    const uiElements = {
      outputDiv: document.getElementById('outputDiv'),
      errorDiv: document.getElementById('error-output'),
      inputElement: document.getElementById('speech-input'),
      document,
    };

    const stageMocks = {
      ensureCriticalDOMElementsStage: jest
        .fn()
        .mockResolvedValue({ success: true, payload: uiElements }),
      setupDIContainerStage: jest
        .fn()
        .mockResolvedValue({ success: true, payload: {} }),
      resolveLoggerStage: jest
        .fn()
        .mockResolvedValue({ success: true, payload: { logger } }),
      initializeGlobalConfigStage: jest
        .fn()
        .mockResolvedValue({ success: true }),
      initializeGameEngineStage: jest
        .fn()
        .mockResolvedValue({ success: false, error: engineFailure }),
      initializeAuxiliaryServicesStage: jest.fn(),
      setupMenuButtonListenersStage: jest.fn(),
      setupGlobalEventListenersStage: jest.fn(),
      startGameStage: jest.fn(),
    };

    registerBaseMocks({
      stageMocks,
      uiFactory: () => uiElements,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'elysium' }),
    });

    const { bootstrapApp, beginGame } = await import('../../../src/main.js');

    await bootstrapApp();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap error caught in main orchestrator'),
      engineFailure
    );

    await expect(beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    const errorOutput = document.getElementById('error-output');
    expect(errorOutput?.textContent).toContain(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    const inputElement = document.getElementById('speech-input');
    expect(inputElement?.disabled).toBe(true);
    expect(inputElement?.placeholder).toBe('Application failed to start.');

    expect(stageMocks.startGameStage).not.toHaveBeenCalled();
  });
});
