import { jest } from '@jest/globals';

const mockConfigureContainer = jest.fn();
const mockTokens = { ExampleToken: Symbol('ExampleToken') };
const mockDisplayFatalStartupError = jest.fn();

const uiBootstrapperInstances = [];
const mockUIBootstrapper = jest.fn().mockImplementation(() => {
  const instance = { gatherEssentialElements: jest.fn() };
  uiBootstrapperInstances.push(instance);
  return instance;
});

const appContainerInstances = [];
const mockAppContainer = jest.fn().mockImplementation(() => {
  const instance = { resolve: jest.fn() };
  appContainerInstances.push(instance);
  return instance;
});

const gameEngineInstances = [];
const mockGameEngine = jest.fn().mockImplementation((opts = {}) => {
  const instance = {
    ...opts,
    logger: opts.logger,
    showLoadGameUI: jest.fn().mockResolvedValue(undefined),
  };
  gameEngineInstances.push(instance);
  return instance;
});

const mockStages = {
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

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => ({
  __esModule: true,
  configureContainer: mockConfigureContainer,
}));

jest.mock('../../../src/dependencyInjection/tokens.js', () => ({
  __esModule: true,
  tokens: mockTokens,
}));

jest.mock('../../../src/utils/errorUtils.js', () => ({
  __esModule: true,
  displayFatalStartupError: mockDisplayFatalStartupError,
}));

jest.mock('../../../src/bootstrapper/UIBootstrapper.js', () => ({
  __esModule: true,
  UIBootstrapper: mockUIBootstrapper,
}));

jest.mock('../../../src/dependencyInjection/appContainer.js', () => ({
  __esModule: true,
  default: mockAppContainer,
}));

jest.mock('../../../src/engine/gameEngine.js', () => ({
  __esModule: true,
  default: mockGameEngine,
}));

jest.mock('../../../src/bootstrapper/stages/index.js', () => mockStages);

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const baseDom = `
  <div id="outputDiv"></div>
  <div id="error-output"></div>
  <input id="speech-input" />
  <button id="back-button"></button>
`;

const createUIElements = () => ({
  outputDiv: document.getElementById('outputDiv'),
  errorDiv: document.getElementById('error-output'),
  inputElement: document.getElementById('speech-input'),
  document,
});

const configureSuccessfulStages = (logger) => {
  const uiElements = createUIElements();
  const eventBus = { subscribe: jest.fn() }; // Mock EventBus for cache invalidation

  mockStages.ensureCriticalDOMElementsStage.mockImplementation(async () => ({
    success: true,
    payload: uiElements,
  }));

  mockStages.setupDIContainerStage.mockImplementation(
    async (_ui, configureContainer, { createAppContainer }) => {
      expect(configureContainer).toBe(mockConfigureContainer);
      const container = createAppContainer();
      // Add EventBus mock to container.resolve()
      container.resolve.mockImplementation((token) => {
        if (token === 'IEventBus' || token?.includes?.('EventBus')) {
          return eventBus;
        }
        return undefined;
      });
      return { success: true, payload: container };
    }
  );

  mockStages.resolveLoggerStage.mockImplementation(async () => ({
    success: true,
    payload: { logger },
  }));

  mockStages.initializeGlobalConfigStage.mockResolvedValue({ success: true });

  mockStages.initializeGameEngineStage.mockImplementation(
    async (_container, resolvedLogger, { createGameEngine }) => {
      expect(resolvedLogger).toBe(logger);
      const engine = createGameEngine({ createdFromStage: true });
      return { success: true, payload: engine };
    }
  );

  mockStages.initializeAuxiliaryServicesStage.mockResolvedValue({
    success: true,
  });
  mockStages.setupMenuButtonListenersStage.mockResolvedValue({ success: true });
  mockStages.setupGlobalEventListenersStage.mockResolvedValue({
    success: true,
  });
  mockStages.startGameStage.mockResolvedValue({ success: true });

  return uiElements;
};

describe('main bootstrap integration', () => {
  beforeAll(() => {
    global.alert = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    Object.values(mockStages).forEach((mockFn) => mockFn.mockReset());
    document.body.innerHTML = baseDom;
    gameEngineInstances.length = 0;
    appContainerInstances.length = 0;
    uiBootstrapperInstances.length = 0;
    global.fetch = jest.fn();
  });

  it('bootstraps successfully and begins the game with load UI', async () => {
    const logger = createLogger();
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'solaria' }),
    });

    const uiElements = configureSuccessfulStages(logger);

    const { bootstrapApp, beginGame } = await import('../../../src/main.js');

    await bootstrapApp();

    expect(global.fetch).toHaveBeenCalledWith('./data/game.json');
    expect(mockStages.ensureCriticalDOMElementsStage).toHaveBeenCalledWith(
      document,
      expect.objectContaining({ createUIBootstrapper: expect.any(Function) })
    );

    expect(mockStages.initializeAuxiliaryServicesStage).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      logger,
      mockTokens
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'main.js: Bootstrap stages completed successfully.'
    );

    const engineInstance = gameEngineInstances.at(-1);
    expect(engineInstance).toBeDefined();
    expect(engineInstance.logger).toBe(logger);

    await beginGame(true);

    expect(mockStages.startGameStage).toHaveBeenCalledWith(
      engineInstance,
      'solaria',
      logger
    );
    expect(engineInstance.showLoadGameUI).toHaveBeenCalledTimes(1);

    expect(mockDisplayFatalStartupError).not.toHaveBeenCalled();
    expect(uiElements.outputDiv).toBe(document.getElementById('outputDiv'));
  });

  it('throws and renders fatal error when beginGame is called before bootstrap', async () => {
    const { beginGame } = await import('../../../src/main.js');

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await expect(beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [uiRefs, details] = mockDisplayFatalStartupError.mock.calls[0];
    expect(uiRefs).toMatchObject({
      outputDiv: document.getElementById('outputDiv'),
      errorDiv: document.getElementById('error-output'),
      inputElement: document.getElementById('speech-input'),
    });
    expect(details).toMatchObject({
      userMessage:
        'Critical: GameEngine not initialized before attempting Start Game stage.',
      phase: 'Start Game',
    });

    consoleErrorSpy.mockRestore();
  });

  it('handles bootstrap stage failures with logger context and suggested fixes', async () => {
    const logger = createLogger();
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'omega' }),
    });

    const uiElements = configureSuccessfulStages(logger);

    const failureError = new Error('Auxiliary stage failure');
    failureError.phase = 'Auxiliary Services Initialization';
    failureError.failures = [
      { service: 'ServiceA', error: new Error('A failed') },
      { service: 'ServiceB', error: new Error('B failed') },
    ];

    mockStages.initializeAuxiliaryServicesStage.mockResolvedValueOnce({
      success: false,
      error: failureError,
    });

    const { bootstrapApp } = await import('../../../src/main.js');

    await bootstrapApp();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap error caught in main orchestrator'),
      failureError
    );

    expect(logger.error).toHaveBeenCalledWith(
      'main.js: Failed to init ServiceA',
      failureError.failures[0].error
    );
    expect(logger.error).toHaveBeenCalledWith(
      'main.js: Failed to init ServiceB',
      failureError.failures[1].error
    );

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [uiRefs, details, passedLogger] =
      mockDisplayFatalStartupError.mock.calls[0];
    expect(uiRefs).toBe(uiElements);
    expect(passedLogger).toBe(logger);
    expect(details).toMatchObject({
      consoleMessage:
        'Critical error during application bootstrap in phase: Auxiliary Services Initialization.',
      phase: 'Auxiliary Services Initialization',
    });
  });

  it('falls back to default UI references and console logging when early bootstrap fails', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));

    mockStages.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: false,
      error: new Error('UI stage failed'),
    });

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { bootstrapApp } = await import('../../../src/main.js');

    await bootstrapApp();

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith('./data/game.json');

    const [uiRefs] = mockDisplayFatalStartupError.mock.calls[0];
    expect(uiRefs).toMatchObject({
      outputDiv: document.getElementById('outputDiv'),
      errorDiv: document.getElementById('error-output'),
      inputElement: document.getElementById('speech-input'),
    });

    consoleErrorSpy.mockRestore();
  });

  it('reports fatal errors when startGameStage fails after bootstrap', async () => {
    const logger = createLogger();
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'default' }),
    });

    configureSuccessfulStages(logger);

    const { bootstrapApp, beginGame } = await import('../../../src/main.js');

    await bootstrapApp();

    const engineInstance = gameEngineInstances.at(-1);
    const failure = new Error('start stage failure');
    mockStages.startGameStage.mockResolvedValueOnce({
      success: false,
      error: failure,
    });

    await expect(beginGame()).rejects.toThrow('start stage failure');

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [uiRefs, details, passedLogger] =
      mockDisplayFatalStartupError.mock.calls[0];
    expect(uiRefs).toMatchObject({
      outputDiv: document.getElementById('outputDiv'),
    });
    expect(passedLogger).toBe(logger);
    expect(details).toMatchObject({
      phase: 'Start Game',
      errorObject: failure,
    });

    expect(mockStages.startGameStage).toHaveBeenCalledWith(
      engineInstance,
      'default',
      logger
    );
    expect(engineInstance.showLoadGameUI).not.toHaveBeenCalled();
  });
});
