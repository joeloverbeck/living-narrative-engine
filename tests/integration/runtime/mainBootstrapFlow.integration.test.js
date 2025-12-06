import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';

const mockStageModule = {
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

jest.mock('../../../src/bootstrapper/stages/index.js', () => mockStageModule);

jest.mock('../../../src/utils/errorUtils.js', () => ({
  displayFatalStartupError: jest.fn(),
}));

jest.mock('../../../src/bootstrapper/UIBootstrapper.js', () => ({
  UIBootstrapper: class MockUIBootstrapper {},
}));

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => ({
  configureContainer: jest.fn(),
}));

jest.mock('../../../src/dependencyInjection/appContainer.js', () => ({
  __esModule: true,
  default: class MockAppContainer {},
}));

jest.mock('../../../src/engine/gameEngine.js', () => ({
  default: class MockGameEngine {
    constructor(options = {}) {
      this.options = options;
      this.logger = options.logger;
      this.showLoadGameUI = jest.fn().mockResolvedValue(undefined);
    }
  },
}));

const importMainModule = async () => {
  let mainModule;
  await jest.isolateModulesAsync(async () => {
    mainModule = await import('../../../src/main.js');
  });
  return mainModule;
};

const resetStageMocks = () => {
  for (const mockFn of Object.values(mockStageModule)) {
    mockFn.mockReset();
  }
};

const getStageModule = () =>
  jest.requireMock('../../../src/bootstrapper/stages/index.js');
const getErrorUtilsModule = () =>
  jest.requireMock('../../../src/utils/errorUtils.js');
const getAppContainerModule = () =>
  jest.requireMock('../../../src/dependencyInjection/appContainer.js');

const createUiElementsPayload = () => ({
  outputDiv: document.getElementById('outputDiv'),
  errorDiv: document.getElementById('error-output'),
  inputElement: /** @type {HTMLInputElement} */ (
    document.getElementById('speech-input')
  ),
  titleElement: document.querySelector('h1'),
  document,
});

const arrangeSuccessfulStages = () => {
  const stages = getStageModule();
  const uiElements = createUiElementsPayload();
  const eventBus = { subscribe: jest.fn() }; // Mock EventBus for cache invalidation
  // Mock handler validator and registry for startup completeness validation
  const mockHandlerValidator = {
    validateHandlerRegistryCompleteness: jest.fn().mockReturnValue({
      isComplete: true,
      missingHandlers: [],
      orphanedHandlers: [],
    }),
  };
  const mockOperationRegistry = {
    getRegisteredTypes: jest.fn().mockReturnValue([]),
  };
  const container = {
    resolve: jest.fn((token) => {
      // Return eventBus when IEventBus token is requested
      if (token === 'IEventBus' || token?.includes?.('EventBus')) {
        return eventBus;
      }
      // Return handler validator for startup completeness validation
      if (token === 'HandlerCompletenessValidator') {
        return mockHandlerValidator;
      }
      // Return operation registry for startup completeness validation
      if (token === 'OperationRegistry') {
        return mockOperationRegistry;
      }
      return undefined;
    }),
  };
  const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
  const gameEngine = { showLoadGameUI: jest.fn().mockResolvedValue(undefined) };

  stages.ensureCriticalDOMElementsStage.mockResolvedValue({
    success: true,
    payload: uiElements,
  });
  stages.setupDIContainerStage.mockResolvedValue({
    success: true,
    payload: container,
  });
  stages.resolveLoggerStage.mockResolvedValue({
    success: true,
    payload: { logger },
  });
  stages.initializeGlobalConfigStage.mockResolvedValue({
    success: true,
    payload: {},
  });
  stages.initializeGameEngineStage.mockResolvedValue({
    success: true,
    payload: gameEngine,
  });
  stages.initializeAuxiliaryServicesStage.mockResolvedValue({
    success: true,
    payload: {},
  });
  stages.setupMenuButtonListenersStage.mockResolvedValue({
    success: true,
    payload: {},
  });
  stages.setupGlobalEventListenersStage.mockResolvedValue({
    success: true,
    payload: {},
  });
  stages.startGameStage.mockResolvedValue({
    success: true,
    payload: {},
  });

  return { uiElements, container, logger, gameEngine, eventBus };
};

describe('main.js bootstrap orchestration', () => {
  let dom;
  let consoleErrorSpy;
  let consoleDebugSpy;

  beforeEach(() => {
    resetStageMocks();
    jest.clearAllMocks();

    dom = new JSDOM(`<!DOCTYPE html>
      <html>
        <body>
          <div id="outputDiv"></div>
          <div id="error-output"></div>
          <h1>Test Game</h1>
          <input id="speech-input" />
        </body>
      </html>`);

    global.window = dom.window;
    global.document = dom.window.document;
    global.alert = jest.fn();
    global.fetch = jest.fn();

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.fetch;
    delete global.alert;
  });

  it('bootstraps and begins the game using configured world data', async () => {
    const stages = getStageModule();
    const { uiElements, container, logger, gameEngine } =
      arrangeSuccessfulStages();
    const { displayFatalStartupError } = getErrorUtilsModule();
    const { default: MockAppContainer } = getAppContainerModule();

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'mystic-vale' }),
    });

    const mainModule = await importMainModule();

    await mainModule.bootstrapApp();

    expect(stages.ensureCriticalDOMElementsStage).toHaveBeenCalledWith(
      document,
      expect.objectContaining({
        createUIBootstrapper: expect.any(Function),
      })
    );

    const diArgs = stages.setupDIContainerStage.mock.calls[0];
    expect(diArgs[0]).toBe(uiElements);
    expect(diArgs[1]).toBeDefined();
    expect(typeof diArgs[2].createAppContainer).toBe('function');
    expect(diArgs[2].createAppContainer()).toBeInstanceOf(MockAppContainer);
    expect(diArgs[3]).toBe(console);

    expect(stages.initializeGameEngineStage).toHaveBeenCalledWith(
      container,
      logger,
      expect.objectContaining({
        createGameEngine: expect.any(Function),
      })
    );

    expect(stages.initializeAuxiliaryServicesStage).toHaveBeenCalledWith(
      container,
      gameEngine,
      logger,
      expect.any(Object)
    );

    await mainModule.beginGame(true);

    expect(stages.startGameStage).toHaveBeenCalledWith(
      gameEngine,
      'mystic-vale',
      logger
    );
    expect(gameEngine.showLoadGameUI).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      'Starting game with world: mystic-vale'
    );
    expect(displayFatalStartupError).not.toHaveBeenCalled();
  });

  it('defaults to "default" world when configuration load fails', async () => {
    const stages = getStageModule();
    const { logger, gameEngine } = arrangeSuccessfulStages();
    const { displayFatalStartupError } = getErrorUtilsModule();

    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    });

    const mainModule = await importMainModule();

    await mainModule.bootstrapApp();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load startWorld from game.json:',
      expect.any(Error)
    );

    await mainModule.beginGame();

    expect(stages.startGameStage).toHaveBeenCalledWith(
      gameEngine,
      'default',
      logger
    );
    expect(displayFatalStartupError).not.toHaveBeenCalled();
    expect(gameEngine.showLoadGameUI).not.toHaveBeenCalled();
  });

  it('reports early bootstrap failures with fallback UI elements', async () => {
    const stages = getStageModule();
    const { displayFatalStartupError } = getErrorUtilsModule();

    const bootstrapError = new Error('Missing essential UI');
    bootstrapError.phase = 'UI Validation';
    bootstrapError.failures = [
      { service: 'UIBootstrapper', error: new Error('outputDiv missing') },
    ];

    stages.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: false,
      error: bootstrapError,
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'ignored' }),
    });

    const mainModule = await importMainModule();

    await mainModule.bootstrapApp();

    expect(displayFatalStartupError).toHaveBeenCalledTimes(1);
    const [uiElementsArg, errorDetailsArg] =
      displayFatalStartupError.mock.calls[0];
    const fallbackOutputDiv = document.getElementById('outputDiv');
    const fallbackErrorDiv = document.getElementById('error-output');
    expect([fallbackOutputDiv, null]).toContain(uiElementsArg.outputDiv);
    expect([fallbackErrorDiv, null]).toContain(uiElementsArg.errorDiv);
    expect(uiElementsArg.document).toBe(document);
    expect(errorDetailsArg.phase).toContain('UI Validation');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('logs via resolved logger when later bootstrap stages fail', async () => {
    const stages = getStageModule();
    const { logger, uiElements } = arrangeSuccessfulStages();
    const { displayFatalStartupError } = getErrorUtilsModule();

    const laterError = new Error('Global listeners failed');
    laterError.phase = 'Global Event Listeners Setup';

    stages.setupGlobalEventListenersStage.mockResolvedValue({
      success: false,
      error: laterError,
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'later-failure' }),
    });

    const mainModule = await importMainModule();

    await mainModule.bootstrapApp();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap error caught in main orchestrator'),
      laterError
    );
    expect(displayFatalStartupError).toHaveBeenCalledWith(
      uiElements,
      expect.objectContaining({
        phase: expect.stringContaining('Global Event Listeners Setup'),
      }),
      logger,
      expect.any(Object)
    );
  });

  it('surfaces beginGame calls before initialization', async () => {
    const { displayFatalStartupError } = getErrorUtilsModule();

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'unused' }),
    });

    const mainModule = await importMainModule();

    await expect(mainModule.beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(displayFatalStartupError).toHaveBeenCalledTimes(1);
    const [uiElementsArg, errorDetailsArg, loggerArg] =
      displayFatalStartupError.mock.calls[0];
    expect(uiElementsArg).toMatchObject({
      outputDiv: document.getElementById('outputDiv'),
      errorDiv: document.getElementById('error-output'),
      inputElement: document.getElementById('speech-input'),
      document,
    });
    expect(errorDetailsArg).toEqual(
      expect.objectContaining({
        phase: 'Start Game',
      })
    );
    expect(loggerArg).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'main.js: Critical: GameEngine not initialized before attempting Start Game stage.'
    );
  });

  it('propagates start stage failures during beginGame', async () => {
    const stages = getStageModule();
    const { logger, gameEngine } = arrangeSuccessfulStages();
    const { displayFatalStartupError } = getErrorUtilsModule();

    const startError = new Error('Start stage failed');
    stages.startGameStage.mockResolvedValue({
      success: false,
      error: startError,
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'spiral' }),
    });

    const mainModule = await importMainModule();

    await mainModule.bootstrapApp();

    await expect(mainModule.beginGame(true)).rejects.toThrow(
      'Start stage failed'
    );

    expect(stages.startGameStage).toHaveBeenCalledWith(
      gameEngine,
      'spiral',
      logger
    );
    expect(displayFatalStartupError).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        phase: 'Start Game',
      }),
      logger,
      expect.any(Object)
    );
    expect(gameEngine.showLoadGameUI).not.toHaveBeenCalled();
  });
});
