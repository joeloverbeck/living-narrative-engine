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
  initializeAuxiliaryServicesStage: (...args) => mockInitAux(...args),
  setupMenuButtonListenersStage: (...args) => mockMenu(...args),
  setupGlobalEventListenersStage: (...args) => mockGlobal(...args),
  startGameStage: (...args) => mockStartGame(...args),
}));

jest.mock('../../../src/utils/errorUtils.js', () => ({
  __esModule: true,
  displayFatalStartupError: (...args) => mockDisplayFatal(...args),
}));

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => ({
  __esModule: true,
  configureContainer: jest.fn(),
}));

const originalAlert = global.alert;
const originalConsoleError = console.error;

/**
 *
 */
function createUiElements() {
  return {
    outputDiv: document.getElementById('outputDiv'),
    errorDiv: document.getElementById('error-output'),
    inputElement: document.getElementById('speech-input'),
    titleElement: document.querySelector('h1'),
    document,
  };
}

describe('main.js fallback coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Title</h1>
      <div id="after-target"></div>
    `;
    global.alert = jest.fn();
    console.error = jest.fn();
    delete global.fetch;
  });

  afterEach(() => {
    jest.resetModules();
    document.body.innerHTML = '';
    delete global.fetch;
    global.alert = originalAlert;
    console.error = originalConsoleError;
  });

  it('uses default DOM helpers when initial UI stage fails without explicit phase', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const stageError = new Error('UI validation failed');
    mockEnsure.mockResolvedValue({ success: false, error: stageError });

    mockDisplayFatal.mockImplementation((elements, details, loggerArg, domOps) => {
      expect(elements.outputDiv).toBe(document.getElementById('outputDiv'));
      expect(details.phase).toBe('Bootstrap Orchestration - UI Element Validation');
      expect(loggerArg).toBeNull();

      const placeholder = document.getElementById('after-target');
      const contentHolder = document.createElement('div');
      domOps.setTextContent(contentHolder, 'critical');
      expect(contentHolder.textContent).toBe('critical');

      domOps.setStyle(contentHolder, 'color', 'red');
      expect(contentHolder.style.color).toBe('red');

      const injected = domOps.createElement('span');
      expect(injected.tagName).toBe('SPAN');

      placeholder.parentElement.insertBefore(contentHolder, placeholder);
      domOps.insertAfter(contentHolder, injected);
      expect(contentHolder.nextSibling).toBe(injected);

      domOps.alert('notify');
    });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();

    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    expect(global.alert).toHaveBeenCalledWith('notify');
    expect(mockSetupDI).not.toHaveBeenCalled();
  });

  it('propagates explicit phase information when a later stage fails', async () => {
    const logger = { debug: jest.fn(), error: jest.fn() };
    const engineInstance = {};

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'nebula' }),
    });

    mockEnsure.mockResolvedValue({ success: true, payload: createUiElements() });
    mockSetupDI.mockResolvedValue({ success: true, payload: {} });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitGlobalConfig.mockResolvedValue({ success: true });
    mockInitEngine.mockResolvedValue({ success: true, payload: engineInstance });
    const auxError = new Error('aux fail');
    auxError.phase = 'Auxiliary Services Initialization';
    auxError.failures = [{ service: 'Telemetry', error: new Error('boom') }];
    mockInitAux.mockResolvedValue({ success: false, error: auxError });

    mockDisplayFatal.mockImplementation((elements, details, loggerArg) => {
      expect(elements.outputDiv).toBe(document.getElementById('outputDiv'));
      expect(details.phase).toBe('Auxiliary Services Initialization');
      expect(loggerArg).toBe(logger);
    });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap error caught'),
      auxError
    );
    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
  });

  it('falls back to default world when game configuration fails to load', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    });

    const logger = { debug: jest.fn(), error: jest.fn() };
    const engineInstance = {};

    mockEnsure.mockResolvedValue({ success: true, payload: createUiElements() });
    mockSetupDI.mockResolvedValue({ success: true, payload: {} });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitGlobalConfig.mockResolvedValue({ success: true });
    mockInitEngine.mockResolvedValue({ success: true, payload: engineInstance });
    mockInitAux.mockResolvedValue({ success: true });
    mockMenu.mockResolvedValue({ success: true });
    mockGlobal.mockResolvedValue({ success: true });
    mockStartGame.mockResolvedValue({ success: true });

    mockDisplayFatal.mockImplementation(() => {});

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();

    expect(console.error).toHaveBeenCalledWith(
      'Failed to load startWorld from game.json:',
      expect.any(Error)
    );

    await main.beginGame();

    expect(mockStartGame).toHaveBeenCalledWith(engineInstance, 'default', logger);
  });

  it('provides DOM helpers when beginGame is invoked without initialization', async () => {
    mockDisplayFatal.mockImplementation((elements, details, loggerArg, domOps) => {
      // beginGame now provides fallback UI elements when uiElements is undefined
      expect(elements).toMatchObject({
        outputDiv: expect.anything(),
        errorDiv: expect.anything(),
        inputElement: expect.anything(),
        document: expect.anything(),
      });
      expect(details.phase).toBe('Start Game');
      expect(loggerArg).toBeNull();

      const base = document.getElementById('after-target');
      const helper = document.createElement('div');
      domOps.setTextContent(helper, 'fatal');
      domOps.setStyle(helper, 'backgroundColor', 'black');
      const created = domOps.createElement('section');
      base.parentElement.insertBefore(helper, base);
      domOps.insertAfter(helper, created);
      domOps.alert('begin-failed');

      expect(helper.nextSibling).toBe(created);
      expect(helper.style.backgroundColor).toBe('black');
    });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await expect(main.beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(global.alert).toHaveBeenCalledWith('begin-failed');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Critical: GameEngine not initialized'),
    );
  });
});
