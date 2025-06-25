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

jest.mock('../../../src/bootstrapper/stages', () => ({
  __esModule: true,
  ensureCriticalDOMElementsStage: (...args) => mockEnsure(...args),
  setupDIContainerStage: (...args) => mockSetupDI(...args),
  resolveLoggerStage: (...args) => mockResolveCore(...args),
  initializeGameEngineStage: (...args) => mockInitEngine(...args),
  setupMenuButtonListenersStage: (...args) => mockMenu(...args),
  setupGlobalEventListenersStage: (...args) => mockGlobal(...args),
  startGameStage: (...args) => mockStartGame(...args),
}));

jest.mock('../../../src/bootstrapper/stages/auxiliary', () => ({
  __esModule: true,
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
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
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
    await new Promise((r) => setTimeout(r, 0));

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
    const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };
    const showLoad = jest.fn();

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: {} });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
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
    await new Promise((r) => setTimeout(r, 0));
    await main.beginGame(true);
    await new Promise((r) => setTimeout(r, 0));

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
    const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: {} });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
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
    await new Promise((r) => setTimeout(r, 0));
    await expect(main.beginGame()).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 0));

    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [, details] = mockDisplayFatal.mock.calls[0];
    expect(details.phase).toBe('Start Game');
  });
});
