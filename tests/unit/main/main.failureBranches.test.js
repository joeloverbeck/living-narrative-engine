import { jest, describe, it, afterEach, expect } from '@jest/globals';

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
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
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

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: {} });
    const stageError = new Error('logger fail');
    stageError.phase = 'Core Services Resolution';
    mockResolveCore.mockResolvedValue({ success: false, error: stageError });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });
    await main.bootstrapApp();
    await new Promise((r) => setTimeout(r, 0));

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
    const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: {} });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitGlobalConfig.mockResolvedValue({ success: true });
    mockInitEngine.mockResolvedValue({ success: true, payload: {} });
    mockInitAux.mockResolvedValue({ success: true });
    const menuError = new Error('menu fail');
    menuError.phase = 'Menu Button Listeners Setup';
    mockMenu.mockResolvedValue({ success: false, error: menuError });

    const main = await import('../../../src/main.js');
    await main.bootstrapApp();
    await new Promise((r) => setTimeout(r, 0));

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
    const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: {} });
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
    await new Promise((r) => setTimeout(r, 0));

    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [, details, passedLogger] = mockDisplayFatal.mock.calls[0];
    expect(details.errorObject).toBe(globalError);
    expect(details.phase).toBe(globalError.phase);
    expect(passedLogger).toBe(logger);
  });
});
