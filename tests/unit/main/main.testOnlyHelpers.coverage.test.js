import {
  describe,
  it,
  expect,
  jest,
  afterEach,
  beforeEach,
} from '@jest/globals';

const mockStageImplementations = {
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

const mockDisplayFatalStartupError = jest.fn();

jest.mock('../../../src/bootstrapper/stages/index.js', () => ({
  __esModule: true,
  ensureCriticalDOMElementsStage: (...args) =>
    mockStageImplementations.ensureCriticalDOMElementsStage(...args),
  setupDIContainerStage: (...args) =>
    mockStageImplementations.setupDIContainerStage(...args),
  resolveLoggerStage: (...args) =>
    mockStageImplementations.resolveLoggerStage(...args),
  initializeGlobalConfigStage: (...args) =>
    mockStageImplementations.initializeGlobalConfigStage(...args),
  initializeGameEngineStage: (...args) =>
    mockStageImplementations.initializeGameEngineStage(...args),
  initializeAuxiliaryServicesStage: (...args) =>
    mockStageImplementations.initializeAuxiliaryServicesStage(...args),
  setupMenuButtonListenersStage: (...args) =>
    mockStageImplementations.setupMenuButtonListenersStage(...args),
  setupGlobalEventListenersStage: (...args) =>
    mockStageImplementations.setupGlobalEventListenersStage(...args),
  startGameStage: (...args) => mockStageImplementations.startGameStage(...args),
}));

jest.mock('../../../src/utils/errorUtils.js', () => ({
  __esModule: true,
  displayFatalStartupError: (...args) => mockDisplayFatalStartupError(...args),
}));

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => ({
  __esModule: true,
  configureContainer: jest.fn(),
}));

const originalFetch = global.fetch;

/**
 *
 */
function resetStageMocks() {
  for (const mock of Object.values(mockStageImplementations)) {
    mock.mockReset();
  }
  mockDisplayFatalStartupError.mockReset();
}

describe('main.js test-only helpers', () => {
  beforeEach(() => {
    resetStageMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    global.fetch = originalFetch;
    document.body.innerHTML = '';
  });

  it('allows overriding the start world before beginning the game', async () => {
    const uiElements = {
      outputDiv: document.createElement('div'),
      errorDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    };
    const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const mockGameEngine = {
      showLoadGameUI: jest.fn().mockResolvedValue(),
      stop: jest.fn().mockResolvedValue(),
    };

    mockStageImplementations.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: true,
      payload: uiElements,
    });
    mockStageImplementations.setupDIContainerStage.mockResolvedValue({
      success: true,
      payload: {},
    });
    mockStageImplementations.resolveLoggerStage.mockResolvedValue({
      success: true,
      payload: { logger },
    });
    mockStageImplementations.initializeGlobalConfigStage.mockResolvedValue({
      success: true,
    });
    mockStageImplementations.initializeGameEngineStage.mockResolvedValue({
      success: true,
      payload: mockGameEngine,
    });
    mockStageImplementations.initializeAuxiliaryServicesStage.mockResolvedValue(
      { success: true }
    );
    mockStageImplementations.setupMenuButtonListenersStage.mockResolvedValue({
      success: true,
    });
    mockStageImplementations.setupGlobalEventListenersStage.mockResolvedValue({
      success: true,
    });
    mockStageImplementations.startGameStage.mockResolvedValue({
      success: true,
    });

    const fetchResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ startWorld: 'from-config' }),
    };
    global.fetch.mockResolvedValue(fetchResponse);

    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });

    await mainModule.bootstrapApp();
    mainModule.__TEST_ONLY__setStartWorld('custom-world');

    await expect(mainModule.beginGame(true)).resolves.toBeUndefined();

    expect(mockStageImplementations.startGameStage).toHaveBeenCalledTimes(1);
    expect(mockStageImplementations.startGameStage).toHaveBeenCalledWith(
      mockGameEngine,
      'custom-world',
      logger
    );
    expect(mockGameEngine.showLoadGameUI).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('./data/game.json');
    expect(fetchResponse.json).toHaveBeenCalledTimes(1);
    expect(mockDisplayFatalStartupError).not.toHaveBeenCalled();
  });

  it('propagates custom error phase set via test helper when bootstrap fails', async () => {
    const uiElements = {
      outputDiv: document.createElement('div'),
      errorDiv: null,
      inputElement: null,
      titleElement: null,
      document,
    };
    const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const stageFailure = new Error('Global config failed');
    let currentMain;

    mockStageImplementations.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: true,
      payload: uiElements,
    });
    mockStageImplementations.setupDIContainerStage.mockResolvedValue({
      success: true,
      payload: {},
    });
    mockStageImplementations.resolveLoggerStage.mockResolvedValue({
      success: true,
      payload: { logger },
    });
    mockStageImplementations.initializeGlobalConfigStage.mockImplementation(
      async () => {
        if (currentMain) {
          currentMain.__TEST_ONLY__setCurrentPhaseForError('Injected Phase');
        }
        return { success: false, error: stageFailure };
      }
    );
    mockStageImplementations.initializeGameEngineStage.mockResolvedValue({
      success: true,
      payload: {},
    });
    mockStageImplementations.initializeAuxiliaryServicesStage.mockResolvedValue(
      { success: true }
    );
    mockStageImplementations.setupMenuButtonListenersStage.mockResolvedValue({
      success: true,
    });
    mockStageImplementations.setupGlobalEventListenersStage.mockResolvedValue({
      success: true,
    });
    mockStageImplementations.startGameStage.mockResolvedValue({
      success: true,
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ startWorld: 'ignored' }),
    });

    await jest.isolateModulesAsync(async () => {
      currentMain = await import('../../../src/main.js');
    });

    currentMain.__TEST_ONLY__setCurrentPhaseForError('Preset Phase');

    await expect(currentMain.bootstrapApp()).resolves.toBeUndefined();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [, errorDetails, passedLogger] =
      mockDisplayFatalStartupError.mock.calls[0];
    expect(errorDetails.errorObject).toBe(stageFailure);
    expect(errorDetails.phase).toBe('Bootstrap Orchestration - Injected Phase');
    expect(passedLogger).toBe(logger);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Injected Phase'),
      stageFailure
    );
    expect(
      mockStageImplementations.initializeGameEngineStage
    ).not.toHaveBeenCalled();
  });
});
