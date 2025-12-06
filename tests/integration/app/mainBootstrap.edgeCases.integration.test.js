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
  <h1>Title</h1>
`;

const createUIElements = () => ({
  outputDiv: document.getElementById('outputDiv'),
  errorDiv: document.getElementById('error-output'),
  inputElement: document.getElementById('speech-input'),
  titleElement: document.querySelector('h1'),
  document,
});

const registerBaseMocks = ({
  stageMocks,
  container,
  logger,
  gameEngine,
  tokens = {
    ILogger: Symbol('ILogger'),
    GamePersistenceService: Symbol('GamePersistenceService'),
    PlaytimeTracker: Symbol('PlaytimeTracker'),
    ISafeEventDispatcher: Symbol('ISafeEventDispatcher'),
  },
}) => {
  jest.doMock('../../../src/bootstrapper/stages/index.js', () => stageMocks);
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
        return createUIElements();
      }
    },
  }));
  jest.doMock('../../../src/dependencyInjection/appContainer.js', () => ({
    __esModule: true,
    default: class AppContainer {
      resolve(token) {
        if (token === tokens.ILogger) {
          return logger;
        }
        return undefined;
      }
      isRegistered() {
        return false;
      }
    },
  }));
  jest.doMock('../../../src/engine/gameEngine.js', () => ({
    __esModule: true,
    default: class GameEngine {
      constructor(opts) {
        Object.assign(this, opts);
      }
      async showLoadGameUI() {
        return undefined;
      }
    },
  }));
};

const createSuccessfulStageMocks = ({
  uiElements,
  container,
  logger,
  gameEngine,
}) => {
  return {
    ensureCriticalDOMElementsStage: jest
      .fn()
      .mockResolvedValue({ success: true, payload: uiElements }),
    setupDIContainerStage: jest
      .fn()
      .mockResolvedValue({ success: true, payload: container }),
    resolveLoggerStage: jest
      .fn()
      .mockResolvedValue({ success: true, payload: { logger } }),
    initializeGlobalConfigStage: jest.fn().mockResolvedValue({ success: true }),
    initializeGameEngineStage: jest
      .fn()
      .mockResolvedValue({ success: true, payload: gameEngine }),
    initializeAuxiliaryServicesStage: jest
      .fn()
      .mockResolvedValue({ success: true }),
    setupMenuButtonListenersStage: jest
      .fn()
      .mockResolvedValue({ success: true }),
    setupGlobalEventListenersStage: jest
      .fn()
      .mockResolvedValue({ success: true }),
    startGameStage: jest.fn().mockResolvedValue({ success: true }),
  };
};

describe('main.js bootstrap edge cases', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = baseDom;
    global.alert = jest.fn();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
    delete global.alert;
  });

  it('falls back to the default start world when configuration loading fails', async () => {
    const uiElements = createUIElements();
    const container = {
      resolve: jest.fn(),
      isRegistered: jest.fn().mockReturnValue(false),
    };
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const gameEngine = {
      showLoadGameUI: jest.fn().mockResolvedValue(undefined),
    };
    const stageMocks = createSuccessfulStageMocks({
      uiElements,
      container,
      logger,
      gameEngine,
    });

    registerBaseMocks({ stageMocks, container, logger, gameEngine });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    });

    const { bootstrapApp, beginGame } = await import('../../../src/main.js');

    await bootstrapApp();
    await beginGame();

    expect(stageMocks.startGameStage).toHaveBeenCalledWith(
      gameEngine,
      'default',
      logger
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load startWorld from game.json:',
      expect.any(Error)
    );
  });

  it('uses fallback UI references when bootstrap fails before UI elements resolve', async () => {
    const uiElements = createUIElements();
    const container = {
      resolve: jest.fn(),
      isRegistered: jest.fn().mockReturnValue(false),
    };
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const gameEngine = {
      showLoadGameUI: jest.fn().mockResolvedValue(undefined),
    };
    const stageMocks = createSuccessfulStageMocks({
      uiElements,
      container,
      logger,
      gameEngine,
    });

    const stageError = new Error('UI bootstrap failed');
    stageMocks.ensureCriticalDOMElementsStage.mockResolvedValueOnce({
      success: false,
      error: stageError,
    });

    registerBaseMocks({ stageMocks, container, logger, gameEngine });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'emerald' }),
    });

    const { bootstrapApp } = await import('../../../src/main.js');

    await bootstrapApp();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap error caught in main orchestrator'),
      stageError
    );
    expect(document.getElementById('error-output').textContent).toContain(
      'Application failed to start due to a critical error'
    );
    expect(document.getElementById('speech-input').disabled).toBe(true);
  });

  it('reports a fatal error when beginGame is invoked before the engine is ready', async () => {
    const uiElements = createUIElements();
    const container = {
      resolve: jest.fn(),
      isRegistered: jest.fn().mockReturnValue(false),
    };
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const gameEngine = {
      showLoadGameUI: jest.fn().mockResolvedValue(undefined),
    };
    const stageMocks = createSuccessfulStageMocks({
      uiElements,
      container,
      logger,
      gameEngine,
    });

    registerBaseMocks({ stageMocks, container, logger, gameEngine });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'onyx' }),
    });

    const stageError = new Error('Engine bootstrap failed');
    stageMocks.initializeGameEngineStage.mockResolvedValueOnce({
      success: false,
      error: stageError,
    });

    const { bootstrapApp, beginGame } = await import('../../../src/main.js');

    await bootstrapApp();

    await expect(beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );
    expect(
      logger.error.mock.calls.some(([message]) =>
        message.includes('main.js: Critical: GameEngine not initialized')
      )
    ).toBe(true);
    expect(document.getElementById('error-output').textContent).toContain(
      'Critical: GameEngine not initialized'
    );
    expect(document.getElementById('speech-input').disabled).toBe(true);
  });
});
