import {
  jest,
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
} from '@jest/globals';
import { createMainBootstrapContainerMock } from '../../common/mockFactories/mainBootstrapContainer.js';

const mockEnsure = jest.fn();
const mockSetupDI = jest.fn();
const mockResolveCore = jest.fn();
const mockInitGlobalConfig = jest.fn();
const mockInitEngine = jest.fn();
const mockInitAux = jest.fn();
const mockMenu = jest.fn();
const mockGlobal = jest.fn();
const mockStartGame = jest.fn();
const mockDisplayFatal = jest.fn();

jest.mock('../../../src/bootstrapper/stages/index.js', () => ({
  __esModule: true,
  ensureCriticalDOMElementsStage: (...args) => mockEnsure(...args),
  setupDIContainerStage: (...args) => mockSetupDI(...args),
  resolveLoggerStage: (...args) => mockResolveCore(...args),
  initializeGlobalConfigStage: (...args) => mockInitGlobalConfig(...args),
  initializeGameEngineStage: (...args) => mockInitEngine(...args),
  setupMenuButtonListenersStage: (...args) => mockMenu(...args),
  setupGlobalEventListenersStage: (...args) => mockGlobal(...args),
  startGameStage: (...args) => mockStartGame(...args),
  initializeAuxiliaryServicesStage: (...args) => mockInitAux(...args),
}));

jest.mock('../../../src/utils/errorUtils.js', () => ({
  __esModule: true,
  displayFatalStartupError: (...args) => mockDisplayFatal(...args),
}));

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => ({
  __esModule: true,
  configureContainer: jest.fn(),
}));

describe('main.js failure branches', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Mock fetch to prevent real HTTP requests
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'default' }),
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.resetModules();
    jest.clearAllMocks();
    // Clean up fetch mock
    if (global.fetch) delete global.fetch;
    document.body.innerHTML = '';
  });

  it('handles logger resolution failure', async () => {
    window.history.pushState({}, '', '?start=false');
    document.body.innerHTML = `<div id="outputDiv"></div>`;
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: null,
      inputElement: null,
      titleElement: null,
      document,
    };

    // Create mock container with resolve method
    const mockEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
    const baseContainer = createMainBootstrapContainerMock();
    const mockContainer = {
      resolve: jest.fn((token) => {
        if (token === 'IEventBus') return mockEventBus;
        return baseContainer.resolve(token);
      }),
    };

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: mockContainer });
    const stageError = new Error('logger fail');
    stageError.phase = 'Core Services Resolution';
    mockResolveCore.mockResolvedValue({ success: false, error: stageError });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });
    await main.bootstrapApp();
    await Promise.resolve();
    jest.runAllTimers();

    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [, details, passedLogger] = mockDisplayFatal.mock.calls[0];
    expect(details.errorObject).toBe(stageError);
    expect(details.phase).toBe(stageError.phase);
    expect(passedLogger).toBeNull();
    expect(mockInitEngine).not.toHaveBeenCalled();
  });

  it('handles menu listener setup failure', async () => {
    window.history.pushState({}, '', '?start=false');
    document.body.innerHTML = `<div id="outputDiv"></div>`;
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: null,
      inputElement: null,
      titleElement: null,
      document,
    };
    const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() };

    // Create mock container with resolve method
    const mockEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
    const baseContainer = createMainBootstrapContainerMock();
    const mockContainer = {
      resolve: jest.fn((token) => {
        if (token === 'IEventBus') return mockEventBus;
        return baseContainer.resolve(token);
      }),
    };

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: mockContainer });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitGlobalConfig.mockResolvedValue({ success: true });
    mockInitEngine.mockResolvedValue({ success: true, payload: {} });
    mockInitAux.mockResolvedValue({ success: true });
    const menuError = new Error('menu fail');
    menuError.phase = 'Menu Button Listeners Setup';
    mockMenu.mockResolvedValue({ success: false, error: menuError });

    const main = await import('../../../src/main.js');
    await main.bootstrapApp();
    await Promise.resolve();
    jest.runAllTimers();

    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [, details, passedLogger] = mockDisplayFatal.mock.calls[0];
    expect(details.errorObject).toBe(menuError);
    expect(details.phase).toBe(menuError.phase);
    expect(passedLogger).toBe(logger);
    expect(mockGlobal).not.toHaveBeenCalled();
  });

  it('handles global listener setup failure', async () => {
    window.history.pushState({}, '', '?start=false');
    document.body.innerHTML = `<div id="outputDiv"></div>`;
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: null,
      inputElement: null,
      titleElement: null,
      document,
    };
    const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() };

    // Create mock container with resolve method
    const mockEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
    const baseContainer = createMainBootstrapContainerMock();
    const mockContainer = {
      resolve: jest.fn((token) => {
        if (token === 'IEventBus') return mockEventBus;
        return baseContainer.resolve(token);
      }),
    };

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: mockContainer });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitGlobalConfig.mockResolvedValue({ success: true });
    mockInitEngine.mockResolvedValue({ success: true, payload: {} });
    mockInitAux.mockResolvedValue({ success: true });
    mockMenu.mockResolvedValue({ success: true });
    const globalError = new Error('global fail');
    globalError.phase = 'Global Event Listeners Setup';
    mockGlobal.mockResolvedValue({ success: false, error: globalError });

    const main = await import('../../../src/main.js');
    await main.bootstrapApp();
    await Promise.resolve();
    jest.runAllTimers();

    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [, details, passedLogger] = mockDisplayFatal.mock.calls[0];
    expect(details.errorObject).toBe(globalError);
    expect(details.phase).toBe(globalError.phase);
    expect(passedLogger).toBe(logger);
  });

  it('handles global configuration initialization failure with logger context', async () => {
    window.history.pushState({}, '', '?start=false');
    document.body.innerHTML = `<div id="outputDiv"></div>`;
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: null,
      inputElement: null,
      titleElement: null,
      document,
    };
    const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'terra' }),
    });

    // Create mock container with resolve method
    const mockEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
    const baseContainer = createMainBootstrapContainerMock();
    const mockContainer = {
      resolve: jest.fn((token) => {
        if (token === 'IEventBus') return mockEventBus;
        return baseContainer.resolve(token);
      }),
    };

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: mockContainer });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    const configError = new Error('config fail');
    mockInitGlobalConfig.mockResolvedValue({ success: false, error: configError });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });
    await main.bootstrapApp();
    await Promise.resolve();
    jest.runAllTimers();

    expect(mockInitEngine).not.toHaveBeenCalled();
    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [elements, details, passedLogger] = mockDisplayFatal.mock.calls[0];
    expect(elements.outputDiv).toBe(uiElements.outputDiv);
    expect(details.errorObject).toBe(configError);
    expect(details.phase).toBe('Bootstrap Orchestration - Global Configuration Initialization');
    expect(passedLogger).toBe(logger);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap error caught in main orchestrator'),
      configError
    );
  });

  it('handles game engine initialization failure and reports the bootstrap phase', async () => {
    window.history.pushState({}, '', '?start=false');
    document.body.innerHTML = `<div id="outputDiv"></div>`;
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: null,
      inputElement: null,
      titleElement: null,
      document,
    };
    const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'elysium' }),
    });

    // Create mock container with resolve method
    const mockEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
    const baseContainer = createMainBootstrapContainerMock();
    const mockContainer = {
      resolve: jest.fn((token) => {
        if (token === 'IEventBus') return mockEventBus;
        return baseContainer.resolve(token);
      }),
    };

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: mockContainer });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitGlobalConfig.mockResolvedValue({ success: true });
    const engineError = new Error('engine fail');
    mockInitEngine.mockResolvedValue({ success: false, error: engineError });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });
    await main.bootstrapApp();
    await Promise.resolve();
    jest.runAllTimers();

    expect(mockInitAux).not.toHaveBeenCalled();
    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [, details, passedLogger] = mockDisplayFatal.mock.calls[0];
    expect(details.errorObject).toBe(engineError);
    expect(details.phase).toBe('Bootstrap Orchestration - Game Engine Initialization');
    expect(passedLogger).toBe(logger);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap error caught in main orchestrator'),
      engineError
    );
  });
});
