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

describe('main.js additional branch coverage', () => {
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

  it('falls back to default ui elements when DOM stage fails', async () => {
    window.history.pushState({}, '', '?start=false');
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Title</h1>
    `;
    const stageError = new Error('UI fail');
    stageError.phase = 'UI Element Validation';

    mockEnsure.mockResolvedValue({ success: false, error: stageError });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });
    await main.bootstrapApp();
    await Promise.resolve();
    jest.runAllTimers();

    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [elements, details] = mockDisplayFatal.mock.calls[0];
    expect(elements.outputDiv).toBe(document.getElementById('outputDiv'));
    expect(details.phase).toBe(stageError.phase);
  });

  it('shows load UI when beginGame called with true', async () => {
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
    const showLoad = jest.fn();

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
    mockInitEngine.mockResolvedValue({
      success: true,
      payload: { showLoadGameUI: showLoad },
    });
    mockInitAux.mockResolvedValue({ success: true });
    mockMenu.mockResolvedValue({ success: true });
    mockGlobal.mockResolvedValue({ success: true });
    mockStartGame.mockResolvedValue({ success: true });

    const main = await import('../../../src/main.js');
    await main.bootstrapApp();
    await Promise.resolve();
    jest.runAllTimers();
    await main.beginGame(true);
    await Promise.resolve();
    jest.runAllTimers();

    expect(mockStartGame).toHaveBeenCalled();
    expect(showLoad).toHaveBeenCalled();
  });

  it('handles startGameStage failure gracefully', async () => {
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
    mockGlobal.mockResolvedValue({ success: true });
    mockStartGame.mockResolvedValue({
      success: false,
      error: new Error('boom'),
    });

    const main = await import('../../../src/main.js');
    await main.bootstrapApp();
    await Promise.resolve();
    jest.runAllTimers();
    await expect(main.beginGame()).rejects.toThrow();
    await Promise.resolve();
    jest.runAllTimers();

    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [, details] = mockDisplayFatal.mock.calls[0];
    expect(details.phase).toBe('Start Game');
  });
});
