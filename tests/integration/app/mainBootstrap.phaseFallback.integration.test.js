import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';

const mockConfigureContainer = jest.fn();
const mockTokens = { ILogger: Symbol('ILogger') };

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
    showLoadGameUI: opts.showLoadGameUI,
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

const baseDom = `
  <div id="outputDiv"></div>
  <div id="error-output"></div>
  <input id="speech-input" />
  <h1>Story Engine</h1>
`;

const createUIElements = () => ({
  outputDiv: document.getElementById('outputDiv'),
  errorDiv: document.getElementById('error-output'),
  titleElement: document.querySelector('h1'),
  inputElement: document.getElementById('speech-input'),
  document,
});

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('main.js bootstrap fallback coverage', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules();
    Object.values(mockStages).forEach((mockFn) => mockFn.mockReset());
    mockConfigureContainer.mockReset();
    mockDisplayFatalStartupError.mockReset();
    uiBootstrapperInstances.length = 0;
    appContainerInstances.length = 0;
    gameEngineInstances.length = 0;

    document.body.innerHTML = baseDom;
    global.alert = jest.fn();
    global.fetch = jest.fn();

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    delete global.fetch;
    delete global.alert;
    delete window.bootstrapApp;
    delete window.beginGame;
  });

  it('infers Application Logic/Runtime when a late stage fails without metadata', async () => {
    const uiElements = createUIElements();
    const logger = createLogger();
    const stageError = new Error('Global listeners misconfigured');
    let setPhaseHelper;

    mockStages.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: true,
      payload: uiElements,
    });

    mockStages.setupDIContainerStage.mockResolvedValue({
      success: true,
      payload: { resolve: jest.fn() },
    });

    mockStages.resolveLoggerStage.mockResolvedValue({
      success: true,
      payload: { logger },
    });

    mockStages.initializeGlobalConfigStage.mockResolvedValue({ success: true });
    mockStages.initializeGameEngineStage.mockResolvedValue({
      success: true,
      payload: { showLoadGameUI: undefined },
    });
    mockStages.initializeAuxiliaryServicesStage.mockResolvedValue({
      success: true,
    });
    mockStages.setupMenuButtonListenersStage.mockResolvedValue({
      success: true,
    });
    mockStages.startGameStage.mockResolvedValue({ success: true });

    mockStages.setupGlobalEventListenersStage.mockImplementation(async () => {
      if (setPhaseHelper) {
        setPhaseHelper(null);
      }
      return { success: false, error: stageError };
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'ember-falls' }),
    });

    const mainModule = await import('../../../src/main.js');
    setPhaseHelper = mainModule.__TEST_ONLY__setCurrentPhaseForError;

    await mainModule.bootstrapApp();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [uiRefs, details, loggerArg] =
      mockDisplayFatalStartupError.mock.calls[0];
    expect(uiRefs).toBe(uiElements);
    expect(details.phase).toBe(
      'Bootstrap Orchestration - Application Logic/Runtime'
    );
    expect(loggerArg).toBe(logger);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap error caught in main orchestrator'),
      stageError
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('falls back to Core Services Resolution when logger resolution fails silently', async () => {
    const uiElements = createUIElements();
    const container = { resolve: jest.fn() };
    const stageError = new Error('Logger stage failure');
    let setPhaseHelper;

    mockStages.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: true,
      payload: uiElements,
    });

    mockStages.setupDIContainerStage.mockResolvedValue({
      success: true,
      payload: container,
    });

    mockStages.resolveLoggerStage.mockImplementation(async () => {
      if (setPhaseHelper) {
        setPhaseHelper(null);
      }
      return { success: false, error: stageError };
    });

    mockStages.initializeGlobalConfigStage.mockResolvedValue({ success: true });
    mockStages.initializeGameEngineStage.mockResolvedValue({
      success: true,
      payload: {},
    });
    mockStages.initializeAuxiliaryServicesStage.mockResolvedValue({
      success: true,
    });
    mockStages.setupMenuButtonListenersStage.mockResolvedValue({
      success: true,
    });
    mockStages.setupGlobalEventListenersStage.mockResolvedValue({
      success: true,
    });
    mockStages.startGameStage.mockResolvedValue({ success: true });

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'aurora-base' }),
    });

    const mainModule = await import('../../../src/main.js');
    setPhaseHelper = mainModule.__TEST_ONLY__setCurrentPhaseForError;

    await mainModule.bootstrapApp();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [uiRefs, details, loggerArg] =
      mockDisplayFatalStartupError.mock.calls[0];
    expect(uiRefs).toBe(uiElements);
    expect(details.phase).toBe(
      'Bootstrap Orchestration - Core Services Resolution'
    );
    expect(loggerArg).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap error caught in main orchestrator'),
      stageError
    );
  });

  it('infers UI Element Validation when DOM bootstrap fails without a phase hint', async () => {
    const stageError = new Error('DOM bootstrap broke');
    let setPhaseHelper;

    mockStages.ensureCriticalDOMElementsStage.mockImplementation(async () => {
      if (setPhaseHelper) {
        setPhaseHelper(null);
      }
      return { success: false, error: stageError };
    });

    mockStages.setupDIContainerStage.mockResolvedValue({
      success: true,
      payload: { resolve: jest.fn() },
    });
    mockStages.resolveLoggerStage.mockResolvedValue({
      success: true,
      payload: { logger: createLogger() },
    });
    mockStages.initializeGlobalConfigStage.mockResolvedValue({ success: true });
    mockStages.initializeGameEngineStage.mockResolvedValue({
      success: true,
      payload: {},
    });
    mockStages.initializeAuxiliaryServicesStage.mockResolvedValue({
      success: true,
    });
    mockStages.setupMenuButtonListenersStage.mockResolvedValue({
      success: true,
    });
    mockStages.setupGlobalEventListenersStage.mockResolvedValue({
      success: true,
    });
    mockStages.startGameStage.mockResolvedValue({ success: true });

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'fallback' }),
    });

    const mainModule = await import('../../../src/main.js');
    setPhaseHelper = mainModule.__TEST_ONLY__setCurrentPhaseForError;

    await mainModule.bootstrapApp();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [uiRefs, details, loggerArg] =
      mockDisplayFatalStartupError.mock.calls[0];
    expect(uiRefs).toBeDefined();
    expect(details.phase).toBe(
      'Bootstrap Orchestration - UI Element Validation'
    );
    expect(loggerArg).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap error caught in main orchestrator'),
      stageError
    );
  });

  it('skips the load UI hook when beginGame runs without a UI helper', async () => {
    const uiElements = createUIElements();
    const logger = createLogger();
    const engine = { showLoadGameUI: undefined };

    mockStages.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: true,
      payload: uiElements,
    });

    mockStages.setupDIContainerStage.mockResolvedValue({
      success: true,
      payload: { resolve: jest.fn() },
    });

    mockStages.resolveLoggerStage.mockResolvedValue({
      success: true,
      payload: { logger },
    });

    mockStages.initializeGlobalConfigStage.mockResolvedValue({ success: true });
    mockStages.initializeGameEngineStage.mockResolvedValue({
      success: true,
      payload: engine,
    });
    mockStages.initializeAuxiliaryServicesStage.mockResolvedValue({
      success: true,
    });
    mockStages.setupMenuButtonListenersStage.mockResolvedValue({
      success: true,
    });
    mockStages.setupGlobalEventListenersStage.mockResolvedValue({
      success: true,
    });
    mockStages.startGameStage.mockResolvedValue({ success: true });

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'crystal-reef' }),
    });

    const { bootstrapApp, beginGame } = await import('../../../src/main.js');

    await bootstrapApp();
    expect(mockDisplayFatalStartupError).not.toHaveBeenCalled();

    engine.showLoadGameUI = jest.fn().mockResolvedValue(undefined);

    await expect(beginGame(true)).resolves.toBeUndefined();
    expect(mockStages.startGameStage).toHaveBeenLastCalledWith(
      engine,
      'crystal-reef',
      logger
    );
    expect(engine.showLoadGameUI).toHaveBeenCalledTimes(1);
    expect(mockStages.startGameStage).toHaveBeenCalledTimes(1);

    engine.showLoadGameUI = undefined;

    await expect(beginGame(true)).resolves.toBeUndefined();
    expect(mockStages.startGameStage).toHaveBeenLastCalledWith(
      engine,
      'crystal-reef',
      logger
    );
    expect(mockStages.startGameStage).toHaveBeenCalledTimes(2);

    await expect(beginGame(false)).resolves.toBeUndefined();
    expect(mockStages.startGameStage).toHaveBeenLastCalledWith(
      engine,
      'crystal-reef',
      logger
    );
    expect(mockStages.startGameStage).toHaveBeenCalledTimes(3);
  });
});
