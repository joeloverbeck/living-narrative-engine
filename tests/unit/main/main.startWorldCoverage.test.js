import {
  jest,
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
} from '@jest/globals';

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

describe('main.js start world selection', () => {
  const originalFetch = global.fetch;
  /** @type {{ debug: jest.Mock; info: jest.Mock; warn: jest.Mock; error: jest.Mock }} */
  let logger;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Main title</h1>
    `;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'custom-world' }),
    });

    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: document.querySelector('#error-output'),
      inputElement: document.querySelector('#speech-input'),
      titleElement: document.querySelector('h1'),
      document,
    };

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const gameEngine = {
      showLoadGameUI: jest.fn().mockResolvedValue(undefined),
    };

    // Create mock container with resolve method
    const mockEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
    const mockContainer = {
      resolve: jest.fn((token) => {
        if (token === 'IEventBus') return mockEventBus;
        return null;
      }),
    };

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: mockContainer });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitGlobalConfig.mockResolvedValue({ success: true });
    mockInitEngine.mockResolvedValue({ success: true, payload: gameEngine });
    mockInitAux.mockResolvedValue({ success: true });
    mockMenu.mockResolvedValue({ success: true });
    mockGlobal.mockResolvedValue({ success: true });
    mockStartGame.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    global.fetch = originalFetch;
  });

  it('passes the configured startWorld through to the start stage', async () => {
    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });

    await mainModule.bootstrapApp();
    await mainModule.beginGame();

    expect(mockStartGame).toHaveBeenCalledWith(
      expect.any(Object),
      'custom-world',
      expect.objectContaining({ debug: expect.any(Function) })
    );
    expect(mockDisplayFatal).not.toHaveBeenCalled();
  });

  it('skips load UI when the engine does not expose a loader function', async () => {
    mockInitEngine.mockResolvedValueOnce({ success: true, payload: {} });

    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });

    await mainModule.bootstrapApp();
    await mainModule.beginGame(true);

    expect(mockStartGame).toHaveBeenCalledWith(
      expect.any(Object),
      'custom-world',
      expect.objectContaining({ debug: expect.any(Function) })
    );
    expect(mockDisplayFatal).not.toHaveBeenCalled();
  });

  it('falls back to the default world when the cached start world is cleared', async () => {
    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });

    await mainModule.bootstrapApp();
    mainModule.__TEST_ONLY__setStartWorld('');

    await mainModule.beginGame();

    expect(mockStartGame).toHaveBeenCalledWith(
      expect.any(Object),
      'default',
      logger
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Starting game with world: default'
    );
    expect(mockDisplayFatal).not.toHaveBeenCalled();
  });
});
