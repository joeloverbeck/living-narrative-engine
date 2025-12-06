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

describe('main.js fallback DOM helpers', () => {
  const stageMocks = [
    mockEnsure,
    mockSetupDI,
    mockResolveCore,
    mockInitGlobalConfig,
    mockInitEngine,
    mockInitAux,
    mockMenu,
    mockGlobal,
    mockStartGame,
  ];
  const originalAlert = global.alert;

  beforeEach(() => {
    stageMocks.forEach((mockFn) => mockFn.mockReset());
    mockDisplayFatal.mockReset();
    document.body.innerHTML = '';
    if (global.fetch) {
      delete global.fetch;
    }
    global.alert = jest.fn();
  });

  afterEach(() => {
    if (global.fetch) {
      delete global.fetch;
    }
    document.body.innerHTML = '';
    if (originalAlert) {
      global.alert = originalAlert;
    } else {
      delete global.alert;
    }
    jest.resetModules();
  });

  it('provides working fallback helpers when bootstrap fails before UI setup', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Title</h1>
    `;

    const placeholder = document.createElement('div');
    placeholder.id = 'placeholder-node';
    document
      .getElementById('outputDiv')
      .insertAdjacentElement('afterend', placeholder);

    const stageError = new Error('UI bootstrap failure');
    mockEnsure.mockResolvedValue({ success: false, error: stageError });

    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });

    await expect(mainModule.bootstrapApp()).resolves.toBeUndefined();

    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [fallbackElements, details, receivedLogger, helpers] =
      mockDisplayFatal.mock.calls[0];

    expect(fallbackElements.outputDiv).toBeInstanceOf(HTMLElement);
    expect(details.errorObject).toBe(stageError);
    expect(receivedLogger).toBeNull();

    const {
      createElement,
      insertAfter,
      setTextContent,
      setStyle,
      alert: alertHelper,
    } = helpers;
    const newNode = createElement('p');
    setTextContent(newNode, 'Bootstrap failed');
    setStyle(newNode, 'fontWeight', '600');
    insertAfter(fallbackElements.outputDiv, newNode);

    expect(fallbackElements.outputDiv.nextElementSibling).toBe(newNode);
    expect(newNode.textContent).toBe('Bootstrap failed');
    expect(newNode.style.fontWeight).toBe('600');

    alertHelper('bootstrap warning');
    expect(global.alert).toHaveBeenCalledWith('bootstrap warning');
  });

  it('exposes fallback helpers when beginGame runs before bootstrap completion', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Title</h1>
    `;

    const reference = document.getElementById('outputDiv');

    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });

    await expect(mainModule.beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [, , , helpers] = mockDisplayFatal.mock.calls[0];
    const {
      createElement,
      insertAfter,
      setTextContent,
      setStyle,
      alert: alertHelper,
    } = helpers;

    const newSection = createElement('section');
    setTextContent(newSection, 'Engine missing');
    setStyle(newSection, 'backgroundColor', 'rgb(255, 255, 0)');
    insertAfter(reference, newSection);

    expect(reference.nextElementSibling).toBe(newSection);
    expect(newSection.textContent).toBe('Engine missing');
    expect(newSection.style.backgroundColor).toBe('rgb(255, 255, 0)');

    alertHelper('begin warning');
    expect(global.alert).toHaveBeenCalledWith('begin warning');
  });
});
