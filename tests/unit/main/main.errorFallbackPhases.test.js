import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createMainBootstrapContainerMock } from '../../common/mockFactories/mainBootstrapContainer.js';

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
  startGameStage: (...args) =>
    mockStageImplementations.startGameStage(...args),
}));

const mockDisplayFatalStartupError = jest.fn();

jest.mock('../../../src/utils/errorUtils.js', () => ({
  __esModule: true,
  displayFatalStartupError: (...args) => mockDisplayFatalStartupError(...args),
}));

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => ({
  __esModule: true,
  configureContainer: jest.fn(),
}));

jest.mock('../../../src/bootstrapper/UIBootstrapper.js', () => ({
  UIBootstrapper: jest.fn(),
}));

jest.mock('../../../src/dependencyInjection/appContainer.js', () => ({
  __esModule: true,
  default: jest.fn(function MockAppContainer() {}),
}));

jest.mock('../../../src/engine/gameEngine.js', () => ({
  __esModule: true,
  default: jest.fn(function MockGameEngine() {}),
}));

let importedMainModule;

/**
 *
 */
async function importMainModule() {
  importedMainModule = await import('../../../src/main.js');
  return importedMainModule;
}

/**
 *
 */
function resetStageMocks() {
  Object.values(mockStageImplementations).forEach((mockFn) => {
    mockFn.mockReset();
  });
}

/**
 *
 */
function createUiElements() {
  return {
    outputDiv: document.getElementById('outputDiv'),
    errorDiv: document.getElementById('error-output'),
    inputElement: document.getElementById('speech-input'),
    document,
  };
}

describe('main.js bootstrap error fallbacks', () => {
  beforeEach(() => {
    jest.resetModules();
    importedMainModule = undefined;
    resetStageMocks();
    mockDisplayFatalStartupError.mockReset();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    global.alert = jest.fn();
    console.error = jest.fn();
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
    `;
  });

  afterEach(() => {
    delete global.fetch;
    delete global.alert;
    jest.clearAllMocks();
  });

  it('uses fallback DOM targets and reports UI validation phase when the first stage fails', async () => {
    const stageError = new Error('UI bootstrap failed');
    mockStageImplementations.ensureCriticalDOMElementsStage.mockImplementation(
      async () => {
        if (importedMainModule) {
          importedMainModule.__TEST_ONLY__setCurrentPhaseForError(null);
        }
        return { success: false, error: stageError };
      }
    );

    const main = await importMainModule();
    await main.bootstrapApp();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [uiArg, errorDetails, loggerArg, helperArg] =
      mockDisplayFatalStartupError.mock.calls[0];

    expect(uiArg.outputDiv).toBe(document.getElementById('outputDiv'));
    expect(uiArg.errorDiv).toBe(document.getElementById('error-output'));
    expect(errorDetails.consoleMessage).toContain('UI Element Validation');
    expect(errorDetails.userMessage).toContain('UI bootstrap failed');
    expect(loggerArg).toBeNull();
    expect(helperArg).toEqual(
      expect.objectContaining({
        createElement: expect.any(Function),
        insertAfter: expect.any(Function),
        setTextContent: expect.any(Function),
        setStyle: expect.any(Function),
        alert: global.alert,
      })
    );
  });

  it('derives DI container setup phase when the container stage fails after UI initialization', async () => {
    mockStageImplementations.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: true,
      payload: createUiElements(),
    });

    const stageError = new Error('Container wiring failed');
    mockStageImplementations.setupDIContainerStage.mockImplementation(
      async () => {
        if (importedMainModule) {
          importedMainModule.__TEST_ONLY__setCurrentPhaseForError(null);
        }
        return { success: false, error: stageError };
      }
    );

    const main = await importMainModule();
    await main.bootstrapApp();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [, errorDetails] = mockDisplayFatalStartupError.mock.calls[0];
    expect(errorDetails.consoleMessage).toContain('DI Container Setup');
    expect(errorDetails.userMessage).toContain('Container wiring failed');
  });

  it('reports core services resolution phase when logger resolution fails', async () => {
    mockStageImplementations.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: true,
      payload: createUiElements(),
    });

    mockStageImplementations.setupDIContainerStage.mockResolvedValue({
      success: true,
      payload: createMainBootstrapContainerMock(),
    });

    const stageError = new Error('Logger missing');
    mockStageImplementations.resolveLoggerStage.mockImplementation(async () => {
      if (importedMainModule) {
        importedMainModule.__TEST_ONLY__setCurrentPhaseForError(null);
      }
      return { success: false, error: stageError };
    });

    const main = await importMainModule();
    await main.bootstrapApp();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [, errorDetails] = mockDisplayFatalStartupError.mock.calls[0];
    expect(errorDetails.consoleMessage).toContain('Core Services Resolution');
    expect(errorDetails.userMessage).toContain('Logger missing');
  });

  it('falls back to application logic phase when auxiliary services initialization fails', async () => {
    const logger = { error: jest.fn(), debug: jest.fn(), warn: jest.fn() };
    const gameEngine = {};

    mockStageImplementations.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: true,
      payload: createUiElements(),
    });

    mockStageImplementations.setupDIContainerStage.mockResolvedValue({
      success: true,
      payload: createMainBootstrapContainerMock(),
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
      payload: gameEngine,
    });

    const stageError = new Error('Auxiliary service failed');
    mockStageImplementations.initializeAuxiliaryServicesStage.mockImplementation(
      async () => {
        if (importedMainModule) {
          importedMainModule.__TEST_ONLY__setCurrentPhaseForError(null);
        }
        return { success: false, error: stageError };
      }
    );

    const main = await importMainModule();
    await main.bootstrapApp();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [, errorDetails] = mockDisplayFatalStartupError.mock.calls[0];
    expect(errorDetails.consoleMessage).toContain('Application Logic/Runtime');
    expect(errorDetails.userMessage).toContain('Auxiliary service failed');
  });

  it('surfaces a fatal error if beginGame is invoked before bootstrap completes', async () => {
    const main = await importMainModule();

    await expect(main.beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [uiArg, errorDetails] = mockDisplayFatalStartupError.mock.calls[0];
    // beginGame now provides fallback UI elements when uiElements is undefined
    expect(uiArg).toMatchObject({
      outputDiv: expect.anything(),
      errorDiv: expect.anything(),
      inputElement: expect.anything(),
      document: expect.anything(),
    });
    expect(errorDetails.phase).toBe('Start Game');
  });
});
