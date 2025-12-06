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

const originalAlert = global.alert;
const originalConsoleError = console.error;

describe('main.js fallback DOM helper coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.alert = jest.fn();
    console.error = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'fallback-world' }),
    });

    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Title</h1>
      <div id="reference"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    if (global.fetch) {
      delete global.fetch;
    }
    global.alert = originalAlert;
    console.error = originalConsoleError;
    jest.resetAllMocks();
    jest.resetModules();
  });

  it('provides working fallback DOM helpers when bootstrap fails before UI setup', async () => {
    const stageError = new Error('ui bootstrap failed');
    mockEnsure.mockResolvedValue({ success: false, error: stageError });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();

    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [fallbackElements, errorDetails, passedLogger, domHelpers] =
      mockDisplayFatal.mock.calls[0];

    expect(fallbackElements.outputDiv).toBe(
      document.getElementById('outputDiv')
    );
    expect(errorDetails.phase).toBe(
      'Bootstrap Orchestration - UI Element Validation'
    );
    expect(passedLogger).toBeNull();

    const referenceNode = document.getElementById('reference');
    const createdNode = domHelpers.createElement('section');
    domHelpers.setTextContent(createdNode, 'fallback text');
    domHelpers.setStyle(createdNode, 'color', 'rgb(255, 0, 0)');
    domHelpers.insertAfter(referenceNode, createdNode);

    expect(referenceNode.nextSibling).toBe(createdNode);
    expect(createdNode.textContent).toBe('fallback text');
    expect(createdNode.style.color).toBe('rgb(255, 0, 0)');
    expect(global.alert).not.toHaveBeenCalled();
  });

  it('reuses fallback helpers when beginGame is invoked prior to bootstrapping', async () => {
    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await expect(main.beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [, , loggerArg, domHelpers] = mockDisplayFatal.mock.calls[0];
    expect(loggerArg).toBeNull();

    const referenceNode = document.getElementById('reference');
    const createdNode = domHelpers.createElement('article');
    domHelpers.insertAfter(referenceNode, createdNode);
    domHelpers.setTextContent(createdNode, 'beginGame fallback');
    domHelpers.setStyle(createdNode, 'backgroundColor', 'rgb(0, 0, 255)');

    expect(referenceNode.nextSibling).toBe(createdNode);
    expect(createdNode.textContent).toBe('beginGame fallback');
    expect(createdNode.style.backgroundColor).toBe('rgb(0, 0, 255)');
  });
});
