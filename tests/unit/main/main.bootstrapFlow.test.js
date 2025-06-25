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

describe('main.js bootstrap extended coverage', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('executes all bootstrap stages successfully', async () => {
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
    const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: {} });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitEngine.mockResolvedValue({ success: true, payload: {} });
    mockInitAux.mockResolvedValue({ success: true });
    mockMenu.mockResolvedValue({ success: true });
    mockGlobal.mockResolvedValue({ success: true });
    mockStartGame.mockResolvedValue({ success: true });

    const main = await import('../../../src/main.js');
    await main.bootstrapApp();
    await new Promise((r) => setTimeout(r, 0));
    await window.beginGame();
    await new Promise((r) => setTimeout(r, 0));

    expect(mockEnsure).toHaveBeenCalledTimes(1);
    expect(mockSetupDI).toHaveBeenCalledTimes(1);
    expect(mockResolveCore).toHaveBeenCalledTimes(1);
    expect(mockInitEngine).toHaveBeenCalledTimes(1);
    expect(mockInitAux).toHaveBeenCalledTimes(1);
    expect(mockMenu).toHaveBeenCalledTimes(1);
    expect(mockGlobal).toHaveBeenCalledTimes(1);
    expect(mockStartGame).toHaveBeenCalledTimes(1);

    const order = [
      mockEnsure,
      mockSetupDI,
      mockResolveCore,
      mockInitEngine,
      mockInitAux,
      mockMenu,
      mockGlobal,
      mockStartGame,
    ].map((fn) => fn.mock.invocationCallOrder[0]);

    const sorted = [...order].sort((a, b) => a - b);
    expect(order).toEqual(sorted);
  });

  it('displays fatal error when game engine fails to initialize', async () => {
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
    mockInitEngine.mockResolvedValue({ success: true, payload: null });

    const main = await import('../../../src/main.js');
    await main.bootstrapApp();
    await new Promise((r) => setTimeout(r, 0));
    await expect(window.beginGame()).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 0));

    expect(mockStartGame).not.toHaveBeenCalled();
    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [elements, details, passedLogger] = mockDisplayFatal.mock.calls[0];
    expect(elements.outputDiv).toBe(uiElements.outputDiv);
    expect(details.phase).toContain('Start Game');
    expect(passedLogger).toBe(logger);
  });
});
