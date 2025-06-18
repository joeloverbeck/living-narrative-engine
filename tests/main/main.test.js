import { jest, describe, it, afterEach, expect } from '@jest/globals';

const mockEnsure = jest.fn();
const mockSetupDI = jest.fn();
const mockResolveCore = jest.fn();
const mockInitEngine = jest.fn();
const mockInitAux = jest.fn();
const mockMenu = jest.fn();
const mockGlobal = jest.fn();
const mockStartGame = jest.fn();
const mockDisplayFatal = jest.fn();

jest.mock('../../src/bootstrapper/stages/index.js', () => ({
  __esModule: true,
  ensureCriticalDOMElementsStage: (...args) => mockEnsure(...args),
  setupDIContainerStage: (...args) => mockSetupDI(...args),
  resolveLoggerStage: (...args) => mockResolveCore(...args),
  initializeGameEngineStage: (...args) => mockInitEngine(...args),
  setupMenuButtonListenersStage: (...args) => mockMenu(...args),
  setupGlobalEventListenersStage: (...args) => mockGlobal(...args),
  startGameStage: (...args) => mockStartGame(...args),
}));
jest.mock('../../src/bootstrapper/stages/auxiliary', () => ({
  __esModule: true,
  initializeAuxiliaryServicesStage: (...args) => mockInitAux(...args),
}));

jest.mock('../../src/utils/errorUtils.js', () => ({
  __esModule: true,
  displayFatalStartupError: (...args) => mockDisplayFatal(...args),
}));

jest.mock('../../src/dependencyInjection/containerConfig.js', () => ({
  __esModule: true,
  configureContainer: jest.fn(),
}));

describe('main.js bootstrap process', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('runs all bootstrap stages in sequence on success', async () => {
    window.history.pushState({}, '', '?start=false');
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Title</h1>
    `;
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: document.querySelector('#error-output'),
      inputElement: document.querySelector('#speech-input'),
      titleElement: document.querySelector('h1'),
      document,
    };
    const logger = { info: jest.fn(), error: jest.fn() };

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: {} });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitEngine.mockResolvedValue({ success: true, payload: {} });
    mockInitAux.mockResolvedValue({ success: true });
    mockMenu.mockResolvedValue({ success: true });
    mockGlobal.mockResolvedValue({ success: true });
    mockStartGame.mockResolvedValue({ success: true });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../src/main.js');
    });
    await main.bootstrapApp();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(typeof main.beginGame).toBe('function');
    expect(mockStartGame).toHaveBeenCalledTimes(0);

    expect(mockEnsure.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetupDI.mock.invocationCallOrder[0]
    );
    expect(mockSetupDI.mock.invocationCallOrder[0]).toBeLessThan(
      mockResolveCore.mock.invocationCallOrder[0]
    );
  });

  it('shows fatal error when a stage fails', async () => {
    window.history.pushState({}, '', '?start=false');
    document.body.innerHTML = `<div id="outputDiv"></div>`;
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: null,
      inputElement: null,
      titleElement: null,
      document,
    };
    const stageError = new Error('DI failed');
    stageError.phase = 'DI Container Setup';

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: false, error: stageError });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../src/main.js');
    });
    await main.bootstrapApp();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSetupDI).toHaveBeenCalled();
    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [elements, details, passedLogger] = mockDisplayFatal.mock.calls[0];
    expect(elements.outputDiv).toBe(uiElements.outputDiv);
    expect(details.errorObject).toBe(stageError);
    expect(details.phase).toBe(stageError.phase);
    expect(passedLogger).toBeNull();
    expect(mockResolveCore).not.toHaveBeenCalled();
    expect(mockStartGame).not.toHaveBeenCalled();
  });

  it('handles aggregated auxiliary service failures', async () => {
    window.history.pushState({}, '', '?start=false');
    document.body.innerHTML = `<div id="outputDiv"></div>`;
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: null,
      inputElement: null,
      titleElement: null,
      document,
    };
    const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };

    const aggError = new Error('Aux fail');
    aggError.phase = 'Auxiliary Services Initialization';
    aggError.failures = [
      { service: 'EngineUIManager', error: new Error('bad') },
    ];

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: {} });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitEngine.mockResolvedValue({ success: true, payload: {} });
    mockInitAux.mockResolvedValue({ success: false, error: aggError });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../src/main.js');
    });
    await main.bootstrapApp();
    await new Promise((r) => setTimeout(r, 0));

    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [, details, passedLogger] = mockDisplayFatal.mock.calls[0];
    expect(details.errorObject).toBe(aggError);
    expect(details.phase).toBe(aggError.phase);
    expect(passedLogger).toBe(logger);
  });
});
