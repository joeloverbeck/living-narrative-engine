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

const bootstrapperInstances = [];

jest.mock('../../../src/bootstrapper/UIBootstrapper.js', () => ({
  UIBootstrapper: class MockUIBootstrapper {
    constructor() {
      bootstrapperInstances.push(this);
    }
  },
}));

const createdGameEngines = [];

jest.mock('../../../src/engine/gameEngine.js', () => ({
  __esModule: true,
  default: class MockGameEngine {
    constructor(options = {}) {
      createdGameEngines.push({ instance: this, options });
      this.options = options;
      this.logger = options.logger;
      this.showLoadGameUI = jest.fn().mockResolvedValue(undefined);
    }
  },
}));

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => ({
  configureContainer: jest.fn(),
}));

class MockAppContainer {}

jest.mock('../../../src/dependencyInjection/appContainer.js', () => ({
  __esModule: true,
  default: MockAppContainer,
}));

const mockDisplayFatalStartupError = jest.fn();

jest.mock('../../../src/utils/errorUtils.js', () => ({
  displayFatalStartupError: mockDisplayFatalStartupError,
}));

const MAIN_MODULE_URL = new URL('../../../src/main.js', import.meta.url);

const importMainModule = async () => {
  let mainModule;
  await jest.isolateModulesAsync(async () => {
    mainModule = await import(MAIN_MODULE_URL);
  });
  return mainModule;
};

const resetStageMocks = () => {
  for (const mockFn of Object.values(mockStageModule)) {
    mockFn.mockReset();
  }
};

const createUiElementsPayload = () => ({
  outputDiv: document.getElementById('outputDiv'),
  errorDiv: document.getElementById('error-output'),
  titleElement: document.querySelector('h1'),
  inputElement: /** @type {HTMLInputElement} */ (
    document.getElementById('speech-input')
  ),
  document,
});

const arrangeSuccessfulStages = () => {
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
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };
  const gameEngine = { showLoadGameUI: jest.fn().mockResolvedValue(undefined) };

  mockStageModule.ensureCriticalDOMElementsStage.mockResolvedValue({
    success: true,
    payload: uiElements,
  });
  mockStageModule.setupDIContainerStage.mockResolvedValue({
    success: true,
    payload: container,
  });
  mockStageModule.resolveLoggerStage.mockResolvedValue({
    success: true,
    payload: { logger },
  });
  mockStageModule.initializeGlobalConfigStage.mockResolvedValue({
    success: true,
  });
  mockStageModule.initializeGameEngineStage.mockResolvedValue({
    success: true,
    payload: gameEngine,
  });
  mockStageModule.initializeAuxiliaryServicesStage.mockResolvedValue({
    success: true,
  });
  mockStageModule.setupMenuButtonListenersStage.mockResolvedValue({
    success: true,
  });
  mockStageModule.setupGlobalEventListenersStage.mockResolvedValue({
    success: true,
  });
  mockStageModule.startGameStage.mockResolvedValue({
    success: true,
  });

  return { uiElements, container, logger, gameEngine, eventBus };
};

describe('main.js integration coverage enhancements', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    resetStageMocks();
    mockDisplayFatalStartupError.mockReset();
    bootstrapperInstances.length = 0;
    createdGameEngines.length = 0;

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

    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.fetch;
    delete global.alert;
  });

  it('provides UI fallbacks when bootstrap fails before initialization', async () => {
    const stageError = new Error('UI stage failed');

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({}),
    });
    mockStageModule.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: false,
      error: Object.assign(stageError, {
        failures: [
          { service: 'Renderer', error: new Error('renderer failed') },
        ],
      }),
    });

    const mainModule = await importMainModule();

    await mainModule.bootstrapApp();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [uiArg, errorDetails, loggerArg, helpers] =
      mockDisplayFatalStartupError.mock.calls[0];

    expect(uiArg.outputDiv).toBe(document.getElementById('outputDiv'));
    expect(errorDetails.userMessage).toContain('UI stage failed');
    expect(loggerArg).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      'main.js: Failed to init Renderer',
      stageError.failures[0].error
    );

    const placeholder = helpers.createElement('section');
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    helpers.insertAfter(anchor, placeholder);
    expect(anchor.nextElementSibling).toBe(placeholder);
    helpers.setTextContent(placeholder, 'bootstrap failed');
    helpers.setStyle(placeholder, 'color', 'red');
    helpers.alert('fatal');
    expect(placeholder.textContent).toBe('bootstrap failed');
    expect(placeholder.style.color).toBe('red');
    expect(global.alert).toHaveBeenCalledWith('fatal');
  });

  it('raises actionable diagnostics when beginGame runs before bootstrap', async () => {
    const mainModule = await importMainModule();

    await expect(mainModule.beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [, , , helpers] = mockDisplayFatalStartupError.mock.calls[0];
    const placeholder = helpers.createElement('div');
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    helpers.insertAfter(anchor, placeholder);
    expect(anchor.nextElementSibling).toBe(placeholder);
    helpers.setTextContent(placeholder, 'missing engine');
    helpers.setStyle(placeholder, 'backgroundColor', 'blue');
    helpers.alert('engine missing');
    expect(placeholder.textContent).toBe('missing engine');
    expect(placeholder.style.backgroundColor).toBe('blue');
    expect(global.alert).toHaveBeenCalledWith('engine missing');
  });

  it('instantiates bootstrapper and game engine factories during happy path', async () => {
    const { logger, gameEngine } = arrangeSuccessfulStages();

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'crystal-grove' }),
    });

    const mainModule = await importMainModule();

    await mainModule.bootstrapApp();

    const [ensureArgs] =
      mockStageModule.ensureCriticalDOMElementsStage.mock.calls;
    const bootstrapperFactory = ensureArgs[1].createUIBootstrapper;
    const bootstrapper = bootstrapperFactory();

    expect(bootstrapperInstances).toHaveLength(1);
    expect(bootstrapperInstances[0]).toBe(bootstrapper);

    const [diArgs] = mockStageModule.setupDIContainerStage.mock.calls;
    const appContainerFactory = diArgs[2].createAppContainer;
    const appContainerInstance = appContainerFactory();

    const [engineArgs] = mockStageModule.initializeGameEngineStage.mock.calls;
    const gameFactory = engineArgs[2].createGameEngine;
    const created = gameFactory({ custom: 'option' });

    expect(appContainerInstance).toBeInstanceOf(MockAppContainer);
    expect(createdGameEngines).toHaveLength(1);
    expect(createdGameEngines[0].instance).toBe(created);
    expect(createdGameEngines[0].options).toMatchObject({
      custom: 'option',
      logger,
    });

    await mainModule.beginGame(true);

    expect(mockStageModule.startGameStage).toHaveBeenCalledWith(
      gameEngine,
      'crystal-grove',
      logger
    );
    expect(gameEngine.showLoadGameUI).toHaveBeenCalledTimes(1);
  });

  it('reports start failures with helper utilities after initialization', async () => {
    const { logger } = arrangeSuccessfulStages();
    const startError = new Error('start failure');

    mockStageModule.startGameStage.mockResolvedValueOnce({
      success: false,
      error: startError,
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'evergreen' }),
    });

    const mainModule = await importMainModule();

    await mainModule.bootstrapApp();

    await expect(mainModule.beginGame()).rejects.toThrow('start failure');

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [, errorDetails, loggerArg, helpers] =
      mockDisplayFatalStartupError.mock.calls[0];

    expect(errorDetails.consoleMessage).toContain('Critical error');
    expect(loggerArg).toBe(logger);

    const placeholder = helpers.createElement('article');
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    helpers.insertAfter(anchor, placeholder);
    expect(anchor.nextElementSibling).toBe(placeholder);
    helpers.setTextContent(placeholder, 'start failure');
    helpers.setStyle(placeholder, 'borderColor', 'black');
    helpers.alert('start failed');
    expect(placeholder.textContent).toBe('start failure');
    expect(placeholder.style.borderColor).toBe('black');
    expect(global.alert).toHaveBeenCalledWith('start failed');
  });
});
