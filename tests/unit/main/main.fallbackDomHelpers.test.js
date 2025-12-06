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

describe('main.js fallback DOM helper coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Title</h1>
    `;
    global.alert = jest.fn();
  });

  afterEach(() => {
    jest.resetModules();
    document.body.innerHTML = '';
    delete global.fetch;
    global.alert = originalAlert;
  });

  it('invokes fallback DOM helpers and logs individual failures when DI setup fails without phase info', async () => {
    const uiElements = {
      outputDiv: document.getElementById('outputDiv'),
      errorDiv: document.getElementById('error-output'),
      inputElement: document.getElementById('speech-input'),
      titleElement: document.querySelector('h1'),
      document,
    };

    const stageError = new Error('setup failed unexpectedly');
    stageError.failures = [
      { service: 'Telemetry', error: new Error('telemetry offline') },
      { service: 'CachePriming', error: new Error('cache unavailable') },
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: false, error: stageError });

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();

    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [passedElements, errorDetails, loggerArg, domHelpers] =
      mockDisplayFatal.mock.calls[0];

    expect(passedElements).toBe(uiElements);
    expect(errorDetails.phase).toBe(
      'Bootstrap Orchestration - DI Container Setup'
    );
    expect(errorDetails.errorObject).toBe(stageError);
    expect(loggerArg).toBeNull();

    const insertedAnchor = document.createElement('div');
    document.body.appendChild(insertedAnchor);

    const createdNode = domHelpers.createElement('span');
    domHelpers.setTextContent(createdNode, 'boot failure');
    domHelpers.setStyle(createdNode, 'color', 'crimson');
    domHelpers.insertAfter(insertedAnchor, createdNode);
    domHelpers.alert('notify-ops');

    expect(createdNode.textContent).toBe('boot failure');
    expect(createdNode.style.color).toBe('crimson');
    expect(insertedAnchor.nextSibling).toBe(createdNode);
    expect(global.alert).toHaveBeenCalledWith('notify-ops');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('main.js: Failed to init Telemetry'),
      stageError.failures[0].error
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('main.js: Failed to init CachePriming'),
      stageError.failures[1].error
    );

    consoleErrorSpy.mockRestore();
  });

  it('exposes DOM helpers when beginGame is invoked before bootstrap', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await expect(main.beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [fallbackElements, errorDetails, loggerArg, domHelpers] =
      mockDisplayFatal.mock.calls[0];

    // beginGame now provides fallback UI elements when uiElements is undefined
    expect(fallbackElements).toMatchObject({
      outputDiv: expect.anything(),
      errorDiv: expect.anything(),
      inputElement: expect.anything(),
      document: expect.anything(),
    });
    expect(errorDetails.phase).toBe('Start Game');
    expect(loggerArg).toBeNull();

    const anchor = document.getElementById('outputDiv');
    const helperNode = domHelpers.createElement('p');
    domHelpers.setTextContent(helperNode, 'fatal');
    domHelpers.setStyle(helperNode, 'backgroundColor', 'orange');
    domHelpers.insertAfter(anchor, helperNode);
    domHelpers.alert('begin-failure');

    expect(helperNode.textContent).toBe('fatal');
    expect(helperNode.style.backgroundColor).toBe('orange');
    expect(anchor.nextSibling).toBe(helperNode);
    expect(global.alert).toHaveBeenCalledWith('begin-failure');

    consoleErrorSpy.mockRestore();
  });
});
