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

describe('main.js uncovered branches', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('executes factory helpers during bootstrap', async () => {
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

    mockEnsure.mockImplementation(async (doc, opts) => {
      opts.createUIBootstrapper();
      return { success: true, payload: uiElements };
    });
    mockSetupDI.mockImplementation(async (elements, configure, opts) => {
      opts.createAppContainer();
      return { success: true, payload: {} };
    });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitEngine.mockImplementation(async (container, log, opts) => {
      opts.createGameEngine();
      return { success: true, payload: {} };
    });
    mockInitAux.mockResolvedValue({ success: true });
    mockMenu.mockResolvedValue({ success: true });
    mockGlobal.mockResolvedValue({ success: true });
    mockStartGame.mockResolvedValue({ success: true });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();
    await new Promise((r) => setTimeout(r, 0));

    // verify mocks were called inside stage implementations
    expect(mockEnsure).toHaveBeenCalled();
    expect(mockSetupDI).toHaveBeenCalled();
    expect(mockInitEngine).toHaveBeenCalled();
  });

  it('invokes DOM helper functions on fatal error', async () => {
    window.alert = jest.fn();
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
    mockStartGame.mockResolvedValue({
      success: false,
      error: new Error('boom'),
    });

    const main = await import('../../../src/main.js');
    await main.bootstrapApp();
    await new Promise((r) => setTimeout(r, 0));
    await expect(main.beginGame()).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 0));

    expect(mockDisplayFatal).toHaveBeenCalled();
    const [, , , helpers] = mockDisplayFatal.mock.calls[0];
    const el = document.createElement('div');
    const p = helpers.createElement('p');
    helpers.insertAfter(el, p);
    helpers.setTextContent(p, 'hi');
    helpers.setStyle(p, 'color', 'red');
    helpers.alert('msg');

    expect(p.textContent).toBe('hi');
    expect(p.style.color).toBe('red');
    expect(window.alert).toHaveBeenCalledWith('msg');
  });
});
