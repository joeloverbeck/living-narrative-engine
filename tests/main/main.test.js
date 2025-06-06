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
const mockInitEngine = jest.fn();
const mockInitAux = jest.fn();
const mockMenu = jest.fn();
const mockGlobal = jest.fn();
const mockStartGame = jest.fn();
const mockDisplayFatal = jest.fn();

jest.mock('../../src/bootstrapper/stages.js', () => ({
  __esModule: true,
  ensureCriticalDOMElementsStage: (...args) => mockEnsure(...args),
  setupDIContainerStage: (...args) => mockSetupDI(...args),
  resolveCoreServicesStage: (...args) => mockResolveCore(...args),
  initializeGameEngineStage: (...args) => mockInitEngine(...args),
  initializeAuxiliaryServicesStage: (...args) => mockInitAux(...args),
  setupMenuButtonListenersStage: (...args) => mockMenu(...args),
  setupGlobalEventListenersStage: (...args) => mockGlobal(...args),
  startGameStage: (...args) => mockStartGame(...args),
}));

jest.mock('../../src/bootstrapper/errorUtils.js', () => ({
  __esModule: true,
  displayFatalStartupError: (...args) => mockDisplayFatal(...args),
}));

jest.mock('../../src/dependencyInjection/containerConfig.js', () => ({
  __esModule: true,
  configureContainer: jest.fn(),
}));

describe('main.js bootstrap process', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('runs all bootstrap stages in sequence on success', async () => {
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
    const logger = { info: jest.fn(), error: jest.fn() };

    mockEnsure.mockResolvedValue(uiElements);
    mockSetupDI.mockResolvedValue({});
    mockResolveCore.mockResolvedValue({ logger });
    mockInitEngine.mockResolvedValue({});
    mockInitAux.mockResolvedValue();
    mockMenu.mockResolvedValue();
    mockGlobal.mockResolvedValue();
    mockStartGame.mockResolvedValue();

    await import('../../main.js');
    // wait for async error handling
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockEnsure).toHaveBeenCalledTimes(1);
    expect(mockSetupDI).toHaveBeenCalledTimes(1);
    expect(mockResolveCore).toHaveBeenCalledTimes(1);
    expect(mockInitEngine).toHaveBeenCalledTimes(1);
    expect(mockInitAux).toHaveBeenCalledTimes(1);
    expect(mockMenu).toHaveBeenCalledTimes(1);
    expect(mockGlobal).toHaveBeenCalledTimes(1);
    expect(mockStartGame).toHaveBeenCalledTimes(1);
    expect(mockDisplayFatal).not.toHaveBeenCalled();

    expect(mockEnsure.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetupDI.mock.invocationCallOrder[0]
    );
    expect(mockSetupDI.mock.invocationCallOrder[0]).toBeLessThan(
      mockResolveCore.mock.invocationCallOrder[0]
    );
    expect(mockResolveCore.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitEngine.mock.invocationCallOrder[0]
    );
    expect(mockInitEngine.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitAux.mock.invocationCallOrder[0]
    );
    expect(mockInitAux.mock.invocationCallOrder[0]).toBeLessThan(
      mockMenu.mock.invocationCallOrder[0]
    );
    expect(mockMenu.mock.invocationCallOrder[0]).toBeLessThan(
      mockGlobal.mock.invocationCallOrder[0]
    );
    expect(mockGlobal.mock.invocationCallOrder[0]).toBeLessThan(
      mockStartGame.mock.invocationCallOrder[0]
    );
  });

  it('shows fatal error when a stage fails', async () => {
    document.body.innerHTML = `<div id="outputDiv"></div>`;
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: null,
      inputElement: null,
      titleElement: null,
      document,
    };
    const stageError = new Error('DI failed');
    stageError.phase = 'DI Container Setup';

    mockEnsure.mockResolvedValue(uiElements);
    mockSetupDI.mockRejectedValue(stageError);

    await import('../../main.js');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSetupDI).toHaveBeenCalled();
    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [elements, details] = mockDisplayFatal.mock.calls[0];
    expect(elements.outputDiv).toBe(uiElements.outputDiv);
    expect(details.errorObject).toBe(stageError);
    expect(details.phase).toBe(stageError.phase);
    expect(mockResolveCore).not.toHaveBeenCalled();
    expect(mockStartGame).not.toHaveBeenCalled();
  });
});
