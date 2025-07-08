import { jest, describe, it, expect, afterEach } from '@jest/globals';

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

/**
 *
 * @param uiElements
 */
function setupStageMocks(uiElements) {
  mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
  mockSetupDI.mockResolvedValue({ success: true, payload: {} });
  const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };
  mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
  mockInitEngine.mockResolvedValue({ success: true, payload: {} });
  mockInitAux.mockResolvedValue({ success: true });
  mockMenu.mockResolvedValue({ success: true });
  mockGlobal.mockResolvedValue({ success: true });
  mockStartGame.mockResolvedValue({ success: true });
  return logger;
}

afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  if (global.fetch) delete global.fetch;
  document.body.innerHTML = '';
});

describe('loadStartWorld via bootstrapApp', () => {
  it('uses startWorld from game.json when available', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'mars' }),
    });
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
    const logger = setupStageMocks(uiElements);

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });
    await main.bootstrapApp();
    await new Promise((r) => setTimeout(r, 0));
    await main.beginGame();
    await new Promise((r) => setTimeout(r, 0));

    expect(fetch).toHaveBeenCalledWith('./data/game.json');
    expect(mockStartGame).toHaveBeenCalledWith(
      expect.anything(),
      'mars',
      logger
    );
  });

  it('falls back to default when response lacks startWorld', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    document.body.innerHTML = `<div id="outputDiv"></div>`;
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: null,
      inputElement: null,
      titleElement: null,
      document,
    };
    const logger = setupStageMocks(uiElements);

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });
    await main.bootstrapApp();
    await new Promise((r) => setTimeout(r, 0));
    await main.beginGame();
    await new Promise((r) => setTimeout(r, 0));

    expect(mockStartGame).toHaveBeenCalledWith(
      expect.anything(),
      'default',
      logger
    );
  });

  it('handles non-ok fetch response gracefully', async () => {
    console.error = jest.fn();
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 404, statusText: 'NF' });
    document.body.innerHTML = `<div id="outputDiv"></div>`;
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: null,
      inputElement: null,
      titleElement: null,
      document,
    };
    const logger = setupStageMocks(uiElements);

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });
    await main.bootstrapApp();
    await new Promise((r) => setTimeout(r, 0));
    await main.beginGame();
    await new Promise((r) => setTimeout(r, 0));

    expect(console.error).toHaveBeenCalled();
    expect(mockStartGame).toHaveBeenCalledWith(
      expect.anything(),
      'default',
      logger
    );
  });

  it('handles fetch rejection gracefully', async () => {
    console.error = jest.fn();
    global.fetch = jest.fn().mockRejectedValue(new Error('net fail'));
    document.body.innerHTML = `<div id="outputDiv"></div>`;
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: null,
      inputElement: null,
      titleElement: null,
      document,
    };
    const logger = setupStageMocks(uiElements);

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });
    await main.bootstrapApp();
    await new Promise((r) => setTimeout(r, 0));
    await main.beginGame();
    await new Promise((r) => setTimeout(r, 0));

    expect(console.error).toHaveBeenCalled();
    expect(mockStartGame).toHaveBeenCalledWith(
      expect.anything(),
      'default',
      logger
    );
  });
});
